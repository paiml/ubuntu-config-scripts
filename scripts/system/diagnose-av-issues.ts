#!/usr/bin/env -S deno run --allow-all

import { logger } from "../lib/logger.ts";
import { runCommand } from "../lib/common.ts";
import { z } from "../../deps.ts";

// Schema for diagnostic results
const DiagnosticResultSchema = z.object({
  category: z.enum(["audio", "video", "system", "gpu", "network"]),
  severity: z.enum(["critical", "warning", "info", "success"]),
  message: z.string(),
  fix: z.string().optional(),
  command: z.string().optional(),
});

type DiagnosticResult = z.infer<typeof DiagnosticResultSchema>;

const SystemInfoSchema = z.object({
  kernel: z.string(),
  distro: z.string(),
  desktop: z.string(),
  gpuDriver: z.string().optional(),
  audioServer: z.string(),
});

type SystemInfo = z.infer<typeof SystemInfoSchema>;

class AVDiagnostics {
  private results: DiagnosticResult[] = [];
  private systemInfo: SystemInfo | null = null;

  async run(includePlaybackTests: boolean = false): Promise<void> {
    logger.info("🔍 Starting comprehensive audio/video diagnostics...\n");

    try {
      await this.collectSystemInfo();
      await this.diagnoseAudioSubsystem();
      await this.diagnoseVideoSubsystem();
      await this.diagnoseGPU();
      await this.diagnoseNetworkForStreaming();
      await this.checkProcessesAndResources();

      // Run playback tests if requested
      if (includePlaybackTests) {
        await this.runPlaybackTests();
      }

      await this.applyFixes();
      this.generateReport();
    } catch (error) {
      logger.error("Diagnostic failed", { error: String(error) });
      Deno.exit(1);
    }
  }

  private async collectSystemInfo(): Promise<void> {
    logger.info("📊 Collecting system information...");

    const kernel = await this.getCommandOutput(["uname", "-r"]);
    const distro = await this.getCommandOutput(["lsb_release", "-d", "-s"]);
    const desktop = Deno.env.get("XDG_CURRENT_DESKTOP") || "Unknown";

    // Check audio server
    const pipewireCheck = await runCommand(["pgrep", "pipewire"]);
    const pulseCheck = await runCommand(["pgrep", "pulseaudio"]);
    const audioServer = pipewireCheck.success
      ? "PipeWire"
      : pulseCheck.success
      ? "PulseAudio"
      : "Unknown";

    // Check GPU driver
    const nvidiaCheck = await runCommand(["nvidia-smi", "--version"]);
    let gpuDriver = "Unknown";
    if (nvidiaCheck.success) {
      const driverMatch = nvidiaCheck.stdout.match(/Driver Version: ([\d.]+)/);
      gpuDriver = driverMatch ? `NVIDIA ${driverMatch[1]}` : "NVIDIA";
    }

    this.systemInfo = {
      kernel,
      distro,
      desktop,
      gpuDriver,
      audioServer,
    };

    logger.info("System info collected", this.systemInfo);
  }

  private async diagnoseAudioSubsystem(): Promise<void> {
    logger.info("\n🔊 Diagnosing audio subsystem...");

    // Check if audio service is running
    const audioService = this.systemInfo?.audioServer === "PipeWire"
      ? "pipewire"
      : "pulseaudio";
    const serviceCheck = await runCommand([
      "systemctl",
      "--user",
      "is-active",
      audioService,
    ]);

    if (!serviceCheck.success || serviceCheck.stdout.trim() !== "active") {
      this.addResult({
        category: "audio",
        severity: "critical",
        message: `${audioService} service is not running`,
        fix: `Start the audio service`,
        command: `systemctl --user restart ${audioService}`,
      });
    }

    // Check default audio sink
    const defaultSink = await runCommand(["pactl", "get-default-sink"]);
    if (!defaultSink.success || !defaultSink.stdout.trim()) {
      this.addResult({
        category: "audio",
        severity: "critical",
        message: "No default audio output device set",
        fix: "Set default audio output",
        command: "pactl set-default-sink @DEFAULT_SINK@",
      });
    }

    // Check audio sinks
    const sinks = await runCommand(["pactl", "list", "short", "sinks"]);
    if (!sinks.success || !sinks.stdout.trim()) {
      this.addResult({
        category: "audio",
        severity: "critical",
        message: "No audio output devices found",
        fix: "Restart audio subsystem",
        command:
          `systemctl --user restart ${audioService} && systemctl --user restart ${audioService}.socket`,
      });
    } else {
      const sinkLines = sinks.stdout.split("\n").filter((l) => l.trim());

      // Check for suspended sinks
      for (const sink of sinkLines) {
        if (sink.includes("SUSPENDED")) {
          const sinkName = sink.split("\t")[1];
          this.addResult({
            category: "audio",
            severity: "warning",
            message: `Audio sink ${sinkName} is suspended`,
            fix: "Resume suspended sink",
            command: `pactl suspend-sink ${sinkName} 0`,
          });
        }
      }
    }

    // Check mute status
    const muteCheck = await runCommand([
      "pactl",
      "get-sink-mute",
      "@DEFAULT_SINK@",
    ]);
    if (muteCheck.success && muteCheck.stdout.includes("yes")) {
      this.addResult({
        category: "audio",
        severity: "warning",
        message: "Default audio output is muted",
        fix: "Unmute audio",
        command: "pactl set-sink-mute @DEFAULT_SINK@ 0",
      });
    }

    // Check volume level
    const volumeCheck = await runCommand([
      "pactl",
      "get-sink-volume",
      "@DEFAULT_SINK@",
    ]);
    if (volumeCheck.success) {
      const volumeMatch = volumeCheck.stdout.match(/(\d+)%/);
      if (volumeMatch) {
        const volume = parseInt(volumeMatch[1]!);
        if (volume === 0) {
          this.addResult({
            category: "audio",
            severity: "warning",
            message: "Audio volume is set to 0%",
            fix: "Set volume to 75%",
            command: "pactl set-sink-volume @DEFAULT_SINK@ 75%",
          });
        } else if (volume < 20) {
          this.addResult({
            category: "audio",
            severity: "info",
            message: `Audio volume is very low (${volume}%)`,
            fix: "Increase volume",
            command: "pactl set-sink-volume @DEFAULT_SINK@ 75%",
          });
        }
      }
    }

    // Check ALSA mixer
    const alsaCheck = await runCommand(["amixer", "get", "Master"]);
    if (alsaCheck.success) {
      if (alsaCheck.stdout.includes("[off]")) {
        this.addResult({
          category: "audio",
          severity: "warning",
          message: "ALSA Master channel is muted",
          fix: "Unmute ALSA Master",
          command: "amixer set Master unmute",
        });
      }
    }

    // Check for audio codec issues
    const codecCheck = await runCommand(["pactl", "list", "modules"]);
    if (codecCheck.success && !codecCheck.stdout.includes("module-codec")) {
      this.addResult({
        category: "audio",
        severity: "info",
        message: "Audio codec modules may not be loaded",
        fix: "Load codec modules",
        command: "pactl load-module module-alsa-card",
      });
    }
  }

  private async diagnoseVideoSubsystem(): Promise<void> {
    logger.info("\n🎬 Diagnosing video subsystem...");

    // Check hardware acceleration
    const vaapiCheck = await runCommand(["vainfo"]);
    if (!vaapiCheck.success) {
      this.addResult({
        category: "video",
        severity: "warning",
        message: "VA-API hardware acceleration not available",
        fix: "Install VA-API drivers",
        command:
          "sudo apt install vainfo intel-media-va-driver mesa-va-drivers",
      });
    }

    // Check video codecs
    const codecsNeeded = [
      { name: "H.264", package: "libavcodec-extra" },
      { name: "H.265/HEVC", package: "libavcodec-extra" },
      { name: "VP9", package: "libavcodec-extra" },
    ];

    for (const codec of codecsNeeded) {
      const codecCheck = await runCommand(["ffmpeg", "-codecs"]);
      if (codecCheck.success) {
        if (!codecCheck.stdout.includes(codec.name.split("/")[0]!)) {
          this.addResult({
            category: "video",
            severity: "warning",
            message: `${codec.name} codec not available`,
            fix: `Install ${codec.name} codec`,
            command: `sudo apt install ${codec.package}`,
          });
        }
      }
    }

    // Check compositor settings that can cause stuttering
    if (this.systemInfo?.desktop?.includes("GNOME")) {
      const gsettingsCheck = await runCommand([
        "gsettings",
        "get",
        "org.gnome.mutter",
        "experimental-features",
      ]);
      if (
        gsettingsCheck.success &&
        !gsettingsCheck.stdout.includes("scale-monitor-framebuffer")
      ) {
        this.addResult({
          category: "video",
          severity: "info",
          message: "GNOME fractional scaling may cause stuttering",
          fix: "Enable better scaling support",
          command:
            "gsettings set org.gnome.mutter experimental-features \"['scale-monitor-framebuffer']\"",
        });
      }
    }

    // Check refresh rate
    const xrandrCheck = await runCommand(["xrandr", "--current"]);
    if (xrandrCheck.success) {
      const rateMatch = xrandrCheck.stdout.match(/\*\s+(\d+\.\d+)/);
      if (rateMatch) {
        const rate = parseFloat(rateMatch[1]!);
        if (rate < 60) {
          this.addResult({
            category: "video",
            severity: "warning",
            message: `Display refresh rate is low (${rate}Hz)`,
            fix: "Increase refresh rate to 60Hz or higher",
          });
        }
      }
    }
  }

  private async diagnoseGPU(): Promise<void> {
    logger.info("\n🎮 Diagnosing GPU...");

    // Check NVIDIA GPU
    if (this.systemInfo?.gpuDriver?.includes("NVIDIA")) {
      const smiCheck = await runCommand(["nvidia-smi"]);
      if (!smiCheck.success) {
        this.addResult({
          category: "gpu",
          severity: "critical",
          message: "NVIDIA driver not functioning properly",
          fix: "Reinstall NVIDIA driver",
          command: "sudo ubuntu-drivers autoinstall",
        });
      } else {
        // Check for GPU utilization issues
        const utilizationMatch = smiCheck.stdout.match(/(\d+)%\s+Default/);
        if (utilizationMatch) {
          const util = parseInt(utilizationMatch[1]!);
          if (util > 90) {
            this.addResult({
              category: "gpu",
              severity: "warning",
              message: `GPU utilization is very high (${util}%)`,
              fix: "Check for GPU-intensive processes",
              command: "nvidia-smi",
            });
          }
        }

        // Check NVDEC/NVENC support
        if (
          !smiCheck.stdout.includes("NVDEC") &&
          !smiCheck.stdout.includes("NVENC")
        ) {
          this.addResult({
            category: "gpu",
            severity: "info",
            message: "Hardware video encoding/decoding may not be available",
            fix: "Update NVIDIA driver for better codec support",
          });
        }
      }

      // Check CUDA for DaVinci
      const cudaCheck = await runCommand(["nvcc", "--version"]);
      if (!cudaCheck.success) {
        this.addResult({
          category: "gpu",
          severity: "info",
          message: "CUDA toolkit not installed (needed for DaVinci Resolve)",
          fix: "Install CUDA toolkit",
          command: "sudo apt install nvidia-cuda-toolkit",
        });
      }
    }

    // Check Intel GPU
    const intelCheck = await runCommand(["lspci"]);
    if (intelCheck.success && intelCheck.stdout.includes("Intel.*Graphics")) {
      const i915Check = await runCommand(["lsmod"]);
      if (!i915Check.success || !i915Check.stdout.includes("i915")) {
        this.addResult({
          category: "gpu",
          severity: "warning",
          message: "Intel GPU driver not loaded",
          fix: "Load Intel GPU driver",
          command: "sudo modprobe i915",
        });
      }
    }

    // Check OpenGL
    const glxCheck = await runCommand(["glxinfo", "-B"]);
    if (!glxCheck.success) {
      this.addResult({
        category: "gpu",
        severity: "warning",
        message: "OpenGL not properly configured",
        fix: "Install Mesa OpenGL drivers",
        command: "sudo apt install mesa-utils",
      });
    }
  }

  private async diagnoseNetworkForStreaming(): Promise<void> {
    logger.info("\n🌐 Diagnosing network for streaming...");

    // Check for network congestion (basic ping test)
    const pingCheck = await runCommand([
      "ping",
      "-c",
      "3",
      "-W",
      "1",
      "8.8.8.8",
    ]);
    if (pingCheck.success) {
      const lossMatch = pingCheck.stdout.match(/(\d+)% packet loss/);
      if (lossMatch) {
        const loss = parseInt(lossMatch[1]!);
        if (loss > 0) {
          this.addResult({
            category: "network",
            severity: "warning",
            message: `Network packet loss detected (${loss}%)`,
            fix: "Check network connection",
          });
        }
      }

      // Check latency
      const rttMatch = pingCheck.stdout.match(/avg = [\d.]+\/([\d.]+)/);
      if (rttMatch) {
        const latency = parseFloat(rttMatch[1]!);
        if (latency > 100) {
          this.addResult({
            category: "network",
            severity: "info",
            message: `High network latency (${latency}ms)`,
            fix: "May affect streaming quality",
          });
        }
      }
    }

    // Check DNS resolution
    const dnsCheck = await runCommand(["nslookup", "youtube.com"]);
    if (!dnsCheck.success) {
      this.addResult({
        category: "network",
        severity: "warning",
        message: "DNS resolution issues detected",
        fix: "Check DNS settings",
        command: "sudo systemctl restart systemd-resolved",
      });
    }

    // Check for bandwidth throttling (YouTube specific)
    const ytCheck = await runCommand(["curl", "-I", "https://www.youtube.com"]);
    if (!ytCheck.success) {
      this.addResult({
        category: "network",
        severity: "warning",
        message: "Cannot connect to YouTube",
        fix: "Check internet connection and firewall",
      });
    }
  }

  private async runPlaybackTests(): Promise<void> {
    logger.info("\n🎵 Running audio/video playback tests...");

    // Create test files
    await this.createTestAudioFile();
    await this.createTestVideoFile();

    // Test audio playback
    await this.testAudioPlayback();

    // Test video playback
    await this.testVideoPlayback();

    // Clean up test files
    await this.cleanupTestFiles();
  }

  private async createTestAudioFile(): Promise<void> {
    logger.info("Creating test audio file...");

    // Generate a simple sine wave audio file using ffmpeg
    const testFile = "/tmp/test-audio.wav";
    const command = new Deno.Command("ffmpeg", {
      args: [
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:duration=2",
        "-y",
        testFile,
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const { success, stderr } = await command.output();

    if (success) {
      this.addResult({
        category: "audio",
        severity: "success",
        message: "Test audio file created successfully",
      });
    } else {
      const errorMsg = new TextDecoder().decode(stderr);
      this.addResult({
        category: "audio",
        severity: "warning",
        message: "Failed to create test audio file",
        fix: "Install ffmpeg: sudo apt install ffmpeg",
        command: "sudo apt install ffmpeg",
      });
      logger.error("Failed to create audio file", { error: errorMsg });
    }
  }

  private async createTestVideoFile(): Promise<void> {
    logger.info("Creating test video file...");

    // Generate a simple test pattern video with audio
    const testFile = "/tmp/test-video.mp4";
    const command = new Deno.Command("ffmpeg", {
      args: [
        "-f",
        "lavfi",
        "-i",
        "testsrc=duration=3:size=640x480:rate=30",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:duration=3",
        "-pix_fmt",
        "yuv420p",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-c:a",
        "aac",
        "-y",
        testFile,
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const { success, stderr } = await command.output();

    if (success) {
      this.addResult({
        category: "video",
        severity: "success",
        message: "Test video file created successfully",
      });
    } else {
      const errorMsg = new TextDecoder().decode(stderr);
      this.addResult({
        category: "video",
        severity: "warning",
        message: "Failed to create test video file",
        fix:
          "Install ffmpeg with codecs: sudo apt install ffmpeg libavcodec-extra",
        command: "sudo apt install ffmpeg libavcodec-extra",
      });
      logger.error("Failed to create video file", { error: errorMsg });
    }
  }

  private async testAudioPlayback(): Promise<void> {
    logger.info("Testing audio playback...");

    const testFile = "/tmp/test-audio.wav";

    // Check if file exists
    try {
      await Deno.stat(testFile);
    } catch {
      logger.warn("Test audio file not found, skipping playback test");
      return;
    }

    // First check audio device status
    const audioDeviceWorking = await this.checkAudioDeviceStatus();

    // Test with multiple audio players with user interaction
    const players = [
      { cmd: "paplay", args: [testFile], name: "PulseAudio" },
      { cmd: "aplay", args: [testFile], name: "ALSA" },
      {
        cmd: "ffplay",
        args: ["-nodisp", "-autoexit", testFile],
        name: "FFplay",
      },
    ];

    let playbackWorked = false;
    let anyPlayerAvailable = false;

    for (const player of players) {
      try {
        const command = new Deno.Command(player.cmd, {
          args: player.args,
          stdout: "piped",
          stderr: "piped",
        });

        logger.info(`🔊 Playing test audio with ${player.name}...`);
        logger.info(`   Listen for a 2-second 440Hz tone`);

        // Run with shorter timeout since we're just testing if it works
        const process = command.spawn();
        const timeoutId = setTimeout(() => {
          try {
            process.kill();
          } catch {
            // Process might already be dead
          }
        }, 3000);

        try {
          const { success } = await process.status;
          clearTimeout(timeoutId);
          anyPlayerAvailable = true;

          if (success) {
            // Ask user if they heard the sound (in real scenario)
            this.addResult({
              category: "audio",
              severity: audioDeviceWorking ? "success" : "warning",
              message: `Audio player ${player.name} executed successfully`,
              fix: audioDeviceWorking
                ? undefined
                : "Check if you can hear audio - if not, audio devices may be muted or not working",
            });
            playbackWorked = true;

            // Add additional check for actual audio output
            if (!audioDeviceWorking) {
              this.addResult({
                category: "audio",
                severity: "warning",
                message:
                  "Audio playback command succeeded but no active audio devices detected",
                fix: "Check audio device configuration and volume levels",
                command: "pavucontrol", // Launch audio control panel
              });
            }
            break;
          }
        } catch {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        logger.debug(`${player.name} not available: ${error}`);
      }
    }

    if (!anyPlayerAvailable) {
      this.addResult({
        category: "audio",
        severity: "critical",
        message: "No audio players available for testing",
        fix: "Install audio tools",
        command: "sudo apt install pulseaudio-utils alsa-utils ffmpeg",
      });
    } else if (!playbackWorked) {
      this.addResult({
        category: "audio",
        severity: "critical",
        message: "Audio playback failed with all available players",
        fix: "Check audio drivers and device configuration",
        command: "sudo apt install pulseaudio-utils alsa-utils",
      });
    }
  }

  private async checkAudioDeviceStatus(): Promise<boolean> {
    try {
      // Check for running audio devices
      const result = await runCommand(["pactl", "list", "sinks", "short"]);
      if (result.success) {
        const activeSinks = result.stdout.split("\n").filter((line) =>
          line.trim() && !line.includes("SUSPENDED")
        );
        return activeSinks.length > 0;
      }
    } catch {
      // Fallback to ALSA check
      try {
        const result = await runCommand(["aplay", "-l"]);
        return result.success && result.stdout.includes("card");
      } catch {
        return false;
      }
    }
    return false;
  }

  private async testVideoPlayback(): Promise<void> {
    logger.info("Testing video playback...");

    const testFile = "/tmp/test-video.mp4";

    // Check if file exists
    try {
      await Deno.stat(testFile);
    } catch {
      logger.warn("Test video file not found, skipping playback test");
      return;
    }

    // Test video decoding with ffprobe first
    try {
      const command = new Deno.Command("ffprobe", {
        args: [
          "-v",
          "error",
          "-select_streams",
          "v:0",
          "-show_entries",
          "stream=codec_name,width,height,r_frame_rate",
          "-of",
          "json",
          testFile,
        ],
        stdout: "piped",
        stderr: "piped",
      });

      const { success, stdout } = await command.output();

      if (success) {
        const output = new TextDecoder().decode(stdout);
        const info = JSON.parse(output);

        if (info.streams && info.streams.length > 0) {
          this.addResult({
            category: "video",
            severity: "success",
            message: "Video file can be decoded successfully",
          });

          // Now test actual video playback
          await this.testActualVideoPlayback(testFile);

          // Test hardware acceleration
          await this.testHardwareDecoding(testFile);
        }
      } else {
        this.addResult({
          category: "video",
          severity: "warning",
          message: "Failed to decode test video",
          fix: "Install video codecs",
          command: "sudo apt install libavcodec-extra",
        });
      }
    } catch (error) {
      this.addResult({
        category: "video",
        severity: "warning",
        message: "ffprobe not available for video testing",
        fix: "Install ffmpeg",
        command: "sudo apt install ffmpeg",
      });
      logger.error("Video test failed", { error: String(error) });
    }
  }

  private async testActualVideoPlayback(testFile: string): Promise<void> {
    // Test with multiple video players with non-interactive flags
    const players = [
      {
        cmd: "ffplay",
        args: ["-t", "2", "-autoexit", "-loglevel", "quiet", testFile],
        name: "FFplay",
      },
      {
        cmd: "mpv",
        args: [
          "--length=2",
          "--really-quiet",
          "--no-terminal",
          "--vo=gpu",
          testFile,
        ],
        name: "MPV",
      },
      {
        cmd: "vlc",
        args: [
          "--play-and-exit",
          "--intf",
          "dummy",
          "--quiet",
          "--run-time=2",
          testFile,
        ],
        name: "VLC",
      },
    ];

    let anyPlayerWorked = false;
    let hasDisplay = false;

    // Check if we have a display
    try {
      const display = Deno.env.get("DISPLAY");
      const waylandDisplay = Deno.env.get("WAYLAND_DISPLAY");
      hasDisplay = !!(display || waylandDisplay);
    } catch {
      hasDisplay = false;
    }

    if (!hasDisplay) {
      this.addResult({
        category: "video",
        severity: "warning",
        message: "No display detected - video playback test skipped",
        fix: "Video playback requires a graphical session",
      });
      return;
    }

    for (const player of players) {
      try {
        logger.info(`🎬 Playing test video with ${player.name}...`);
        logger.info(`   Look for a 3-second test pattern video with audio`);

        const command = new Deno.Command(player.cmd, {
          args: player.args,
          stdout: "piped",
          stderr: "piped",
        });

        // Run with shorter timeout for testing
        const process = command.spawn();
        const timeoutId = setTimeout(() => {
          try {
            process.kill("SIGTERM");
          } catch {
            // Process might already be dead
          }
        }, 4000);

        try {
          const { success } = await process.status;
          clearTimeout(timeoutId);

          if (success) {
            this.addResult({
              category: "video",
              severity: "success",
              message: `Video playback successful with ${player.name}`,
            });
            anyPlayerWorked = true;
            break;
          }
        } catch {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        logger.debug(`${player.name} not available: ${error}`);
      }
    }

    if (!anyPlayerWorked) {
      this.addResult({
        category: "video",
        severity: "warning",
        message: "No video players could display the test video",
        fix: "Install video players for testing",
        command: "sudo apt install ffmpeg mpv vlc",
      });
    }
  }

  private async testHardwareDecoding(testFile: string): Promise<void> {
    // Test VAAPI hardware decoding
    const hwaccelTests = [
      {
        name: "VAAPI",
        args: ["-hwaccel", "vaapi", "-i", testFile, "-f", "null", "-"],
      },
      {
        name: "NVDEC",
        args: ["-hwaccel", "nvdec", "-i", testFile, "-f", "null", "-"],
      },
    ];

    for (const test of hwaccelTests) {
      try {
        const command = new Deno.Command("ffmpeg", {
          args: test.args,
          stdout: "piped",
          stderr: "piped",
        });

        const { success } = await command.output();

        if (success) {
          this.addResult({
            category: "video",
            severity: "success",
            message: `${test.name} hardware decoding working`,
          });
        }
      } catch {
        // Hardware decoding not available, this is ok
      }
    }
  }

  private async cleanupTestFiles(): Promise<void> {
    const testFiles = ["/tmp/test-audio.wav", "/tmp/test-video.mp4"];

    for (const file of testFiles) {
      try {
        await Deno.remove(file);
      } catch {
        // File might not exist, that's ok
      }
    }

    logger.info("Test files cleaned up");
  }

  private async checkProcessesAndResources(): Promise<void> {
    logger.info("\n💻 Checking system resources...");

    // Check CPU usage
    const topCheck = await runCommand(["top", "-bn1"]);
    if (topCheck.success) {
      const cpuMatch = topCheck.stdout.match(/Cpu\(s\):\s+([\d.]+)%us/);
      if (cpuMatch) {
        const cpuUsage = parseFloat(cpuMatch[1]!);
        if (cpuUsage > 80) {
          this.addResult({
            category: "system",
            severity: "warning",
            message: `High CPU usage (${cpuUsage}%)`,
            fix: "Check for CPU-intensive processes",
            command: "top",
          });
        }
      }
    }

    // Check memory usage
    const memCheck = await runCommand(["free", "-h"]);
    if (memCheck.success) {
      const lines = memCheck.stdout.split("\n");
      const memLine = lines.find((l) => l.startsWith("Mem:"));
      if (memLine) {
        const parts = memLine.split(/\s+/);
        const total = parseFloat(parts[1]!);
        const available = parseFloat(parts[6]!);
        const percentUsed = ((total - available) / total) * 100;

        if (percentUsed > 90) {
          this.addResult({
            category: "system",
            severity: "warning",
            message: `High memory usage (${percentUsed.toFixed(1)}%)`,
            fix: "Close unnecessary applications",
          });
        }
      }
    }

    // Check for zombie processes
    const zombieCheck = await runCommand(["ps", "aux"]);
    if (zombieCheck.success) {
      const zombies = zombieCheck.stdout.split("\n").filter((l) =>
        l.includes("<defunct>")
      );
      if (zombies.length > 0) {
        this.addResult({
          category: "system",
          severity: "info",
          message: `${zombies.length} zombie process(es) found`,
          fix: "Restart parent processes or reboot",
        });
      }
    }

    // Check swap usage
    const swapCheck = await runCommand(["swapon", "--show"]);
    if (swapCheck.success && swapCheck.stdout.includes("100%")) {
      this.addResult({
        category: "system",
        severity: "warning",
        message: "Swap space is full",
        fix: "Free up memory or increase swap size",
      });
    }
  }

  private async applyFixes(): Promise<void> {
    const criticalFixes = this.results.filter((r) =>
      r.severity === "critical" && r.command
    );

    if (criticalFixes.length === 0) {
      return;
    }

    logger.info("\n🔧 Applying critical fixes...");

    for (const fix of criticalFixes) {
      logger.info(`Applying: ${fix.fix}`);
      if (fix.command) {
        const parts = fix.command.split(" ");
        const result = await runCommand(parts);
        if (result.success) {
          logger.success(`✅ Fixed: ${fix.message}`);
        } else {
          logger.warn(`⚠️  Could not auto-fix: ${fix.message}`);
          logger.info(`   Run manually: ${fix.command}`);
        }
      }
    }
  }

  private generateReport(): void {
    logger.info("\n" + "=".repeat(60));
    logger.info("📋 DIAGNOSTIC REPORT");
    logger.info("=".repeat(60));

    // Group results by category
    const categories = ["audio", "video", "gpu", "system", "network"] as const;

    for (const category of categories) {
      const categoryResults = this.results.filter((r) =>
        r.category === category
      );
      if (categoryResults.length === 0) {
        continue;
      }

      logger.info(
        `\n${this.getCategoryEmoji(category)} ${category.toUpperCase()}`,
      );
      logger.info("-".repeat(40));

      // Sort by severity
      const severityOrder = ["critical", "warning", "info", "success"] as const;

      for (const severity of severityOrder) {
        const severityResults = categoryResults.filter((r) =>
          r.severity === severity
        );
        for (const result of severityResults) {
          const icon = this.getSeverityIcon(result.severity);
          logger.info(`${icon} ${result.message}`);
          if (result.fix) {
            logger.info(`   → ${result.fix}`);
            if (result.command) {
              logger.info(`     $ ${result.command}`);
            }
          }
        }
      }
    }

    // Summary
    logger.info("\n" + "=".repeat(60));
    const critical =
      this.results.filter((r) => r.severity === "critical").length;
    const warnings =
      this.results.filter((r) => r.severity === "warning").length;
    const info = this.results.filter((r) => r.severity === "info").length;

    logger.info("📊 SUMMARY");
    logger.info(`   Critical Issues: ${critical}`);
    logger.info(`   Warnings: ${warnings}`);
    logger.info(`   Info: ${info}`);

    if (critical > 0) {
      logger.error(
        "\n⚠️  Critical issues found! Fix these before running OBS/DaVinci",
      );
    } else if (warnings > 0) {
      logger.warn(
        "\n⚠️  Some warnings found. Consider fixing for better performance",
      );
    } else {
      logger.success("\n✅ System appears ready for OBS and DaVinci Resolve!");
    }

    // Quick fix script
    if (critical > 0 || warnings > 0) {
      logger.info("\n💡 To apply all suggested fixes, run:");
      logger.info("   make system-av-fix");
    }
  }

  private getCategoryEmoji(category: string): string {
    const emojis: Record<string, string> = {
      audio: "🔊",
      video: "🎬",
      gpu: "🎮",
      system: "💻",
      network: "🌐",
    };
    return emojis[category] || "📌";
  }

  private getSeverityIcon(severity: string): string {
    const icons: Record<string, string> = {
      critical: "❌",
      warning: "⚠️ ",
      info: "ℹ️ ",
      success: "✅",
    };
    return icons[severity] || "•";
  }

  private addResult(result: DiagnosticResult): void {
    this.results.push(DiagnosticResultSchema.parse(result));
  }

  private async getCommandOutput(args: string[]): Promise<string> {
    const result = await runCommand(args);
    return result.success ? result.stdout.trim() : "";
  }

  async exportFixes(): Promise<void> {
    const fixes = this.results
      .filter((r) =>
        r.command && (r.severity === "critical" || r.severity === "warning")
      )
      .map((r) => r.command)
      .filter((cmd): cmd is string => cmd !== undefined);

    if (fixes.length > 0) {
      const script = `#!/bin/bash
# Auto-generated fix script for audio/video issues
# Generated: ${new Date().toISOString()}

set -e

echo "🔧 Applying audio/video fixes..."

${fixes.join("\n")}

echo "✅ Fixes applied!"
`;

      const fixFile = "/tmp/av-fixes.sh";
      await Deno.writeTextFile(fixFile, script);
      await Deno.chmod(fixFile, 0o755);
      logger.info(`\n📝 Fix script saved to: ${fixFile}`);
    }
  }
}

// Export for testing
export { AVDiagnostics, DiagnosticResultSchema, SystemInfoSchema };

if (import.meta.main) {
  // Show help if requested
  if (Deno.args.includes("--help")) {
    console.log(`
Audio/Video Diagnostics Tool

Usage:
  deno run --allow-all diagnose-av-issues.ts [options]

Options:
  --test-playback   Run audio/video playback tests
  --export-fixes    Export fixes to shell script
  --help           Show this help message

Examples:
  # Run basic diagnostics
  make system-av-diagnose

  # Run with playback tests
  make system-av-test-playback

  # Export fixes
  make system-av-fix
`);
    Deno.exit(0);
  }

  const diagnostics = new AVDiagnostics();

  // Check for playback test flag
  const includePlaybackTests = Deno.args.includes("--test-playback");

  await diagnostics.run(includePlaybackTests);

  // Export fixes if requested
  if (Deno.args.includes("--export-fixes")) {
    await diagnostics.exportFixes();
  }
}
