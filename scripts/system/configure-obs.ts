#!/usr/bin/env -S deno run --allow-all

import { logger } from "../lib/logger.ts";
import {
  commandExists,
  confirm,
  ensureDir,
  fileExists,
  parseArgs,
  runCommand,
} from "../lib/common.ts";
import { z } from "../../deps.ts";

const OBSConfigSchema = z.object({
  videoSettings: z.object({
    baseResolution: z.string().default("1920x1080"),
    outputResolution: z.string().default("1920x1080"),
    fps: z.number().int().min(1).max(120).default(30),
    encoder: z.enum(["obs_x264", "ffmpeg_nvenc", "ffmpeg_vaapi", "ffmpeg_qsv"])
      .default("obs_x264"),
    bitrate: z.number().int().min(1000).max(50000).default(6000),
    keyframeInterval: z.number().int().min(0).max(10).default(2),
    preset: z.enum([
      "ultrafast",
      "superfast",
      "veryfast",
      "faster",
      "fast",
      "medium",
      "slow",
      "slower",
      "veryslow",
    ]).default("medium"),
    profile: z.enum(["baseline", "main", "high"]).default("high"),
  }),
  audioSettings: z.object({
    sampleRate: z.enum(["44100", "48000"]).default("48000"),
    channels: z.enum(["mono", "stereo"]).default("stereo"),
    desktopAudioDevice: z.string().optional(),
    micDevice: z.string().optional(),
    micNoiseSupression: z.boolean().default(true),
    micNoiseGate: z.boolean().default(true),
    desktopAudioBitrate: z.number().int().min(64).max(320).default(160),
    micBitrate: z.number().int().min(64).max(320).default(160),
  }),
  recordingSettings: z.object({
    outputPath: z.string().default("~/Videos/OBS"),
    fileFormat: z.enum(["mkv", "mp4", "mov", "flv"]).default("mov"),
    filenameFormat: z.string().default("%CCYY-%MM-%DD %hh-%mm-%ss"),
    encoder: z.enum(["same_as_stream", "obs_x264", "ffmpeg_nvenc"]).default(
      "same_as_stream",
    ),
    quality: z.enum(["same_as_stream", "high", "indistinguishable"]).default(
      "indistinguishable",
    ),
  }),
  streamingSettings: z.object({
    service: z.enum(["youtube", "twitch", "custom"]).optional(),
    server: z.string().optional(),
    streamKey: z.string().optional(),
  }).default({}),
  generalSettings: z.object({
    theme: z.enum(["dark", "light", "system"]).default("dark"),
    language: z.string().default("en-US"),
    startMinimizedToTray: z.boolean().default(false),
    minimizeToTrayOnClose: z.boolean().default(false),
    warnBeforeStoppingStream: z.boolean().default(true),
    recordWhenStreaming: z.boolean().default(false),
    keepRecordingWhenStreamStops: z.boolean().default(true),
    replayBufferEnabled: z.boolean().default(false),
    replayBufferDuration: z.number().int().min(5).max(300).default(30),
  }),
  hotkeySettings: z.object({
    startRecording: z.string().default("Ctrl+Alt+R"),
    stopRecording: z.string().default("Ctrl+Alt+S"),
    pauseRecording: z.string().default("Ctrl+Alt+P"),
    startStreaming: z.string().default("Ctrl+Alt+T"),
    stopStreaming: z.string().default("Ctrl+Alt+Y"),
    pushToTalk: z.string().optional(),
    muteMic: z.string().default("Ctrl+Alt+M"),
    muteDesktop: z.string().default("Ctrl+Alt+D"),
  }),
});

type OBSConfig = z.infer<typeof OBSConfigSchema>;

export async function checkNvidiaSupport(): Promise<boolean> {
  const result = await runCommand(["nvidia-smi"]);
  return result.success;
}

export async function checkVaapiSupport(): Promise<boolean> {
  const result = await runCommand(["vainfo"]);
  return result.success;
}

export async function detectBestEncoder(): Promise<string> {
  if (await checkNvidiaSupport()) {
    logger.info("NVIDIA GPU detected - using NVENC encoder");
    return "ffmpeg_nvenc";
  }

  if (await checkVaapiSupport()) {
    logger.info("VAAPI support detected - using hardware acceleration");
    return "ffmpeg_vaapi";
  }

  logger.info("Using software x264 encoder");
  return "obs_x264";
}

export async function getAudioDevices(): Promise<{
  inputs: Array<{ name: string; id: string }>;
  outputs: Array<{ name: string; id: string }>;
}> {
  const devices = {
    inputs: [] as Array<{ name: string; id: string }>,
    outputs: [] as Array<{ name: string; id: string }>,
  };

  const sourcesResult = await runCommand(["pactl", "list", "sources", "short"]);
  if (sourcesResult.success) {
    const lines = sourcesResult.stdout.split("\n").filter((line) =>
      line.trim()
    );
    for (const line of lines) {
      const parts = line.split("\t");
      if (parts[1] && !parts[1].includes(".monitor")) {
        devices.inputs.push({
          id: parts[1],
          name: parts[1].replace(/_/g, " "),
        });
      }
    }
  }

  const sinksResult = await runCommand(["pactl", "list", "sinks", "short"]);
  if (sinksResult.success) {
    const lines = sinksResult.stdout.split("\n").filter((line) => line.trim());
    for (const line of lines) {
      const parts = line.split("\t");
      if (parts[1]) {
        devices.outputs.push({
          id: parts[1],
          name: parts[1].replace(/_/g, " "),
        });
      }
    }
  }

  return devices;
}

export async function installOBS(): Promise<void> {
  logger.info("Installing OBS Studio...");

  const addRepoResult = await runCommand([
    "sudo",
    "add-apt-repository",
    "-y",
    "ppa:obsproject/obs-studio",
  ]);

  if (!addRepoResult.success) {
    logger.warn("Failed to add OBS PPA, trying with default repository");
  }

  const updateResult = await runCommand(["sudo", "apt-get", "update"]);
  if (!updateResult.success) {
    throw new Error(`Failed to update package list: ${updateResult.stderr}`);
  }

  const installResult = await runCommand([
    "sudo",
    "apt-get",
    "install",
    "-y",
    "obs-studio",
  ]);

  if (!installResult.success) {
    throw new Error(`Failed to install OBS: ${installResult.stderr}`);
  }

  const pluginsResult = await runCommand([
    "sudo",
    "apt-get",
    "install",
    "-y",
    "obs-plugins",
    "v4l2loopback-dkms",
    "v4l2loopback-utils",
  ]);

  if (!pluginsResult.success) {
    logger.warn("Some OBS plugins failed to install");
  }

  logger.success("OBS Studio installed successfully");
}

export async function createOBSProfile(
  profileName: string,
  config: OBSConfig,
): Promise<void> {
  const homeDir = Deno.env.get("HOME");
  if (!homeDir) {
    throw new Error("HOME environment variable not set");
  }

  const obsConfigDir = `${homeDir}/.config/obs-studio`;
  const profileDir = `${obsConfigDir}/basic/profiles/${profileName}`;
  const scenesDir = `${obsConfigDir}/basic/scenes`;

  await ensureDir(profileDir);
  await ensureDir(scenesDir);

  const basicIni = `
[General]
Name=${profileName}

[Video]
BaseCX=${config.videoSettings.baseResolution.split("x")[0]}
BaseCY=${config.videoSettings.baseResolution.split("x")[1]}
OutputCX=${config.videoSettings.outputResolution.split("x")[0]}
OutputCY=${config.videoSettings.outputResolution.split("x")[1]}
FPSType=0
FPSCommon=${config.videoSettings.fps}
ScaleType=bicubic
ColorFormat=NV12
ColorSpace=709
ColorRange=Partial

[Audio]
SampleRate=${config.audioSettings.sampleRate}
ChannelSetup=${config.audioSettings.channels}

[Output]
Mode=Advanced

[AdvOut]
RecType=Standard
RecEncoder=${
    config.recordingSettings.encoder === "same_as_stream"
      ? config.videoSettings.encoder
      : config.recordingSettings.encoder
  }
RecFilePath=${config.recordingSettings.outputPath.replace("~", homeDir)}
RecFormat=${config.recordingSettings.fileFormat}
RecTracks=1
RecEncoderOpt=preset=${config.videoSettings.preset} profile=${config.videoSettings.profile} level=auto rc-lookahead=32 b_ref_mode=2
RecRB=false
RecSplitFile=None
RecSplitFileTime=30
RecRBTime=${config.generalSettings.replayBufferDuration}
RecRBPrefix=Replay
FileNameWithoutSpace=false
RecFileNameFormat=${config.recordingSettings.filenameFormat}

TrackIndex=1
TrackName=
Track1Bitrate=${config.audioSettings.desktopAudioBitrate}
Track1Name=

Track2Bitrate=${config.audioSettings.micBitrate}
Track2Name=

[Video]
Renderer=OpenGL

[Audio]
${
    config.audioSettings.desktopAudioDevice
      ? `Desktop1=${config.audioSettings.desktopAudioDevice}`
      : ""
  }
${
    config.audioSettings.micDevice
      ? `Mic1=${config.audioSettings.micDevice}`
      : ""
  }
`;

  await Deno.writeTextFile(`${profileDir}/basic.ini`, basicIni);

  const encoderSettings = `
[StreamEncoder]
preset=${config.videoSettings.preset}
profile=${config.videoSettings.profile}
tune=
x264opts=keyint=${
    config.videoSettings.keyframeInterval * config.videoSettings.fps
  } min-keyint=${
    config.videoSettings.keyframeInterval * config.videoSettings.fps
  }
rate_control=CBR
bitrate=${config.videoSettings.bitrate}
use_bufsize=1
buffer_size=${config.videoSettings.bitrate * 2}

[RecordingEncoder]
preset=${config.videoSettings.preset}
profile=${config.videoSettings.profile}
tune=
rate_control=CRF
crf=16
`;

  await Deno.writeTextFile(`${profileDir}/encoder.ini`, encoderSettings);

  const streamEncoderJson = {
    "bitrate": config.videoSettings.bitrate,
    "keyint_sec": config.videoSettings.keyframeInterval,
    "preset": config.videoSettings.preset,
    "profile": config.videoSettings.profile,
    "rate_control": "CBR",
    "width": parseInt(config.videoSettings.outputResolution.split("x")[0]!),
    "height": parseInt(config.videoSettings.outputResolution.split("x")[1]!),
  };

  await Deno.writeTextFile(
    `${profileDir}/streamEncoder.json`,
    JSON.stringify(streamEncoderJson, null, 2),
  );

  const recordEncoderJson = {
    "crf": 16,
    "keyint_sec": config.videoSettings.keyframeInterval,
    "preset": config.videoSettings.preset,
    "profile": config.videoSettings.profile,
    "rate_control": "CRF",
  };

  await Deno.writeTextFile(
    `${profileDir}/recordEncoder.json`,
    JSON.stringify(recordEncoderJson, null, 2),
  );

  logger.success(`OBS profile '${profileName}' created successfully`);
}

export async function createScreencastScene(
  sceneName = "Screencast",
): Promise<void> {
  const homeDir = Deno.env.get("HOME");
  if (!homeDir) {
    throw new Error("HOME environment variable not set");
  }

  const scenesFile =
    `${homeDir}/.config/obs-studio/basic/scenes/${sceneName}.json`;

  // Get Yamaha mic device ID
  const audioDevices = await getAudioDevices();
  const yamahaMic = audioDevices.inputs.find((d) =>
    d.id.toLowerCase().includes("yamaha") ||
    d.id.toLowerCase().includes("ycm01u")
  );
  const micDevice = yamahaMic?.id || "default";

  const sceneConfig = {
    "AuxAudioDevice1": micDevice,
    "DesktopAudioDevice1": "default",
    "current_program_scene": sceneName,
    "current_scene": sceneName,
    "current_transition": "Fade",
    "groups": [],
    "modules": {
      "auto-scene-switcher": {
        "active": false,
        "interval": 300,
        "non_matching_scene": "",
        "switch_if_not_matching": false,
        "switches": [],
      },
      "output-timer": {
        "autoStartRecordTimer": false,
        "autoStartStreamTimer": false,
        "pauseRecordTimer": true,
        "recordTimerHours": 0,
        "recordTimerMinutes": 0,
        "recordTimerSeconds": 30,
        "streamTimerHours": 0,
        "streamTimerMinutes": 0,
        "streamTimerSeconds": 30,
      },
    },
    "name": sceneName,
    "preview_locked": false,
    "quick_transitions": [
      {
        "duration": 300,
        "fade_to_black": false,
        "hotkeys": [],
        "id": 1,
        "name": "Cut",
      },
      {
        "duration": 300,
        "fade_to_black": false,
        "hotkeys": [],
        "id": 2,
        "name": "Fade",
      },
    ],
    "saved_projectors": [],
    "scaling_enabled": false,
    "scaling_level": 0,
    "scaling_off_x": 0.0,
    "scaling_off_y": 0.0,
    "scene_order": [
      {
        "name": sceneName,
      },
    ],
    "sources": [
      {
        "alignment": 5,
        "balance": 0.5,
        "bounds": {
          "alignment": 0,
          "type": 0,
          "x": 1920.0,
          "y": 1080.0,
        },
        "bounds_alignment": 0,
        "bounds_type": 0,
        "crop_bottom": 0,
        "crop_left": 0,
        "crop_right": 0,
        "crop_top": 0,
        "deinterlace_field_order": 0,
        "deinterlace_mode": 0,
        "enabled": true,
        "flags": 0,
        "hotkeys": {},
        "id": "pipewire_desktop_capture_source",
        "locked": false,
        "mixers": 0,
        "monitoring_type": 0,
        "muted": false,
        "name": "Screen Capture (PipeWire)",
        "pos": {
          "x": 0.0,
          "y": 0.0,
        },
        "prev_ver": 469762051,
        "private_settings": {},
        "push-to-mute": false,
        "push-to-mute-delay": 0,
        "push-to-talk": false,
        "push-to-talk-delay": 0,
        "rot": 0.0,
        "scale": {
          "x": 1.0,
          "y": 1.0,
        },
        "scale_filter": "disable",
        "settings": {
          "RestoreToken": "",
          "capture_cursor": true,
          "show_cursor": true,
        },
        "sync": 0,
        "versioned_id": "pipewire_desktop_capture_source",
        "visible": true,
        "volume": 1.0,
      },
      {
        "balance": 0.5,
        "deinterlace_field_order": 0,
        "deinterlace_mode": 0,
        "enabled": true,
        "flags": 0,
        "hotkeys": {
          "libobs.mute": [],
          "libobs.push-to-mute": [],
          "libobs.push-to-talk": [],
          "libobs.unmute": [],
        },
        "id": "pulse_input_capture",
        "mixers": 255,
        "monitoring_type": 0,
        "muted": false,
        "name": "Yamaha Microphone",
        "prev_ver": 469762051,
        "private_settings": {},
        "push-to-mute": false,
        "push-to-mute-delay": 0,
        "push-to-talk": false,
        "push-to-talk-delay": 0,
        "settings": {
          "device_id": micDevice,
        },
        "sync": 0,
        "versioned_id": "pulse_input_capture",
        "volume": 1.0,
      },
      {
        "balance": 0.5,
        "deinterlace_field_order": 0,
        "deinterlace_mode": 0,
        "enabled": true,
        "flags": 0,
        "hotkeys": {
          "libobs.mute": [],
          "libobs.push-to-mute": [],
          "libobs.push-to-talk": [],
          "libobs.unmute": [],
        },
        "id": "pulse_output_capture",
        "mixers": 255,
        "monitoring_type": 0,
        "muted": false,
        "name": "Desktop Audio",
        "prev_ver": 469762051,
        "private_settings": {},
        "push-to-mute": false,
        "push-to-mute-delay": 0,
        "push-to-talk": false,
        "push-to-talk-delay": 0,
        "settings": {
          "device_id": "default",
        },
        "sync": 0,
        "versioned_id": "pulse_output_capture",
        "volume": 0.2,
      },
    ],
    "transition_duration": 300,
    "transitions": [],
  };

  await ensureDir(`${homeDir}/.config/obs-studio/basic/scenes`);
  await Deno.writeTextFile(scenesFile, JSON.stringify(sceneConfig, null, 2));

  if (yamahaMic) {
    logger.success(
      `Scene '${sceneName}' created with Yamaha mic: ${yamahaMic.name}`,
    );
  } else {
    logger.success(`Scene '${sceneName}' created with default mic`);
  }
}

export async function configureHotkeys(config: OBSConfig): Promise<void> {
  const homeDir = Deno.env.get("HOME");
  if (!homeDir) {
    throw new Error("HOME environment variable not set");
  }

  const globalIniPath = `${homeDir}/.config/obs-studio/global.ini`;

  let globalIni = "";
  if (await fileExists(globalIniPath)) {
    globalIni = await Deno.readTextFile(globalIniPath);
  }

  const hotkeysSection = `
[Hotkeys]
OBSBasic.StartRecording=${config.hotkeySettings.startRecording}
OBSBasic.StopRecording=${config.hotkeySettings.stopRecording}
OBSBasic.PauseRecording=${config.hotkeySettings.pauseRecording}
OBSBasic.StartStreaming=${config.hotkeySettings.startStreaming}
OBSBasic.StopStreaming=${config.hotkeySettings.stopStreaming}
libobs.mute.Microphone=${config.hotkeySettings.muteMic}
libobs.mute.Desktop_Audio=${config.hotkeySettings.muteDesktop}
${
    config.hotkeySettings.pushToTalk
      ? `libobs.push-to-talk.Microphone=${config.hotkeySettings.pushToTalk}`
      : ""
  }
`;

  if (globalIni.includes("[Hotkeys]")) {
    globalIni = globalIni.replace(/\[Hotkeys\][^[]*/, hotkeysSection);
  } else {
    globalIni += hotkeysSection;
  }

  await Deno.writeTextFile(globalIniPath, globalIni);
  logger.success("Hotkeys configured successfully");
}

export async function optimizeForScreencasting(
  config: OBSConfig,
): Promise<void> {
  const homeDir = Deno.env.get("HOME");
  if (!homeDir) {
    throw new Error("HOME environment variable not set");
  }

  const globalIniPath = `${homeDir}/.config/obs-studio/global.ini`;

  let globalIni = "";
  if (await fileExists(globalIniPath)) {
    globalIni = await Deno.readTextFile(globalIniPath);
  }

  const generalSection = `
[General]
Theme=${config.generalSettings.theme}
Language=${config.generalSettings.language}
WarnBeforeStartingStream=false
WarnBeforeStoppingStream=${config.generalSettings.warnBeforeStoppingStream}
RecordWhenStreaming=${config.generalSettings.recordWhenStreaming}
KeepRecordingWhenStreamStops=${config.generalSettings.keepRecordingWhenStreamStops}
SysTrayEnabled=${config.generalSettings.startMinimizedToTray}
SysTrayWhenStarted=${config.generalSettings.startMinimizedToTray}
SysTrayMinimizeToTray=${config.generalSettings.minimizeToTrayOnClose}
SaveProjectors=false
ShowTransitionDuration=true
SwapScenesMode=false
PreviewProgramMode=false
DocksLocked=false
PreviewEnabled=true
AlwaysOnTop=false
SnappingEnabled=true
ScreenSnapping=true
SourceSnapping=true
CenterSnapping=false
SnapDistance=10.0
RecordingEncoder=${config.videoSettings.encoder}
EnableAutoUpdates=true
OpenStatsOnStartup=false
`;

  if (globalIni.includes("[General]")) {
    globalIni = globalIni.replace(/\[General\][^[]*/, generalSection);
  } else {
    globalIni += generalSection;
  }

  await Deno.writeTextFile(globalIniPath, globalIni);

  const performanceSection = `
[BasicWindow]
PreviewDrawSpaces=false
Multiview=false
MultiviewDrawNames=true
MultiviewDrawAreas=true
MultiviewMouseSwitch=true

[Performance]
EnableNewSocketLoop=true
EnableHighDPIScaling=true
EnableLinuxBrowserAcceleration=true
`;

  if (!globalIni.includes("[BasicWindow]")) {
    globalIni += performanceSection;
    await Deno.writeTextFile(globalIniPath, globalIni);
  }

  logger.success("OBS optimized for screencasting");
}

export async function configureOBS(options?: {
  profileName?: string;
  preset?: string;
  install?: boolean;
  audioDevices?: boolean;
}): Promise<void> {
  if (options?.install || !await commandExists("obs")) {
    await installOBS();
  }

  const profileName = options?.profileName || "Screencast";

  logger.info("Configuring OBS Studio for screencasting...");

  const encoder = await detectBestEncoder();

  const config: OBSConfig = OBSConfigSchema.parse({
    videoSettings: {
      baseResolution: "1920x1080",
      outputResolution: "1920x1080",
      fps: 30,
      encoder,
      bitrate: options?.preset === "high"
        ? 15000
        : options?.preset === "medium"
        ? 10000
        : 6000,
      keyframeInterval: 2,
      preset: options?.preset === "high"
        ? "slow"
        : options?.preset === "low"
        ? "veryfast"
        : "medium",
      profile: "high",
    },
    audioSettings: {
      sampleRate: "48000",
      channels: "stereo",
      micNoiseSupression: true,
      micNoiseGate: true,
      desktopAudioBitrate: 160,
      micBitrate: 160,
    },
    recordingSettings: {
      outputPath: "~/Videos/OBS",
      fileFormat: "mov",
      filenameFormat: "%CCYY-%MM-%DD %hh-%mm-%ss",
      encoder: "same_as_stream",
      quality: "indistinguishable",
    },
    generalSettings: {
      theme: "dark",
      language: "en-US",
      startMinimizedToTray: false,
      minimizeToTrayOnClose: false,
      warnBeforeStoppingStream: true,
      recordWhenStreaming: false,
      keepRecordingWhenStreamStops: true,
      replayBufferEnabled: false,
      replayBufferDuration: 30,
    },
    hotkeySettings: {
      startRecording: "Ctrl+Alt+R",
      stopRecording: "Ctrl+Alt+S",
      pauseRecording: "Ctrl+Alt+P",
      startStreaming: "Ctrl+Alt+T",
      stopStreaming: "Ctrl+Alt+Y",
      muteMic: "Ctrl+Alt+M",
      muteDesktop: "Ctrl+Alt+D",
    },
  });

  if (options?.audioDevices) {
    const devices = await getAudioDevices();

    if (devices.inputs.length > 0) {
      logger.info("Available microphones:");
      devices.inputs.forEach((device, i) => {
        logger.info(`  ${i + 1}. ${device.name}`);
      });

      if (devices.inputs.length === 1) {
        config.audioSettings.micDevice = devices.inputs[0]!.id;
      } else if (
        await confirm("Would you like to select a microphone?", true)
      ) {
        const defaultMic = devices.inputs.find((d) => d.id.includes("usb")) ||
          devices.inputs[0];
        if (defaultMic) {
          config.audioSettings.micDevice = defaultMic.id;
          logger.info(`Selected microphone: ${defaultMic.name}`);
        }
      }
    }

    if (devices.outputs.length > 0) {
      logger.info("Available audio outputs:");
      devices.outputs.forEach((device, i) => {
        logger.info(`  ${i + 1}. ${device.name}`);
      });
    }
  }

  await createOBSProfile(profileName, config);
  await createScreencastScene("Screencast");
  await configureHotkeys(config);
  await optimizeForScreencasting(config);

  const homeDir = Deno.env.get("HOME");
  await ensureDir(`${homeDir}/Videos/OBS`);

  logger.success("OBS Studio configured successfully for screencasting!");
  logger.info("");
  logger.info("Quick Start Guide:");
  logger.info("  1. Launch OBS Studio with: obs");
  logger.info(`  2. The '${profileName}' profile will load automatically`);
  logger.info("  3. Add sources to your scene:");
  logger.info("     - Click '+' → Screen Capture (PipeWire)");
  logger.info("     - Click '+' → Audio Input Capture (for mic)");
  logger.info("     - Click '+' → Audio Output Capture (for desktop audio)");
  logger.info("");
  logger.info("Keyboard Shortcuts:");
  logger.info("  - Start Recording: Ctrl+Alt+R");
  logger.info("  - Stop Recording:  Ctrl+Alt+S");
  logger.info("  - Pause Recording: Ctrl+Alt+P");
  logger.info("  - Mute Microphone: Ctrl+Alt+M");
  logger.info("  - Mute Desktop:    Ctrl+Alt+D");
  logger.info("");
  logger.info(`Recordings will be saved to: ${homeDir}/Videos/OBS`);
  logger.info(`Video format: MKV (can be remuxed to MP4 in OBS)`);
  logger.info(
    `Encoder: ${encoder.toUpperCase()} ${
      encoder !== "obs_x264" ? "(hardware accelerated)" : "(software)"
    }`,
  );
}

async function main(): Promise<void> {
  const args = parseArgs(Deno.args);

  if (args["help"] || args["h"]) {
    console.log(`
Usage: configure-obs.ts [OPTIONS]

Configure OBS Studio for optimal screencasting and course recording.

Options:
  --profile <name>    Profile name (default: "Screencast")
  --preset <quality>  Quality preset: low, medium, high (default: medium)
  --install           Install OBS Studio if not present
  --audio-devices     Detect and configure audio devices
  --help, -h          Show this help message
  --verbose, -v       Enable verbose logging

Examples:
  configure-obs.ts                          # Basic configuration
  configure-obs.ts --install                # Install and configure
  configure-obs.ts --preset high            # High quality recording
  configure-obs.ts --audio-devices          # Configure audio inputs
  configure-obs.ts --profile "Tutorial"     # Custom profile name

Recording Quality Presets:
  - low:    4 Mbps, veryfast encoding (smaller files, lower quality)
  - medium: 6 Mbps, medium encoding (balanced)
  - high:   10 Mbps, slow encoding (larger files, best quality)
`);
    Deno.exit(0);
  }

  if (args["verbose"] || args["v"]) {
    logger.setLevel(0);
  }

  try {
    await configureOBS({
      profileName: args["profile"] as string,
      preset: args["preset"] as string,
      install: !!args["install"],
      audioDevices: !!args["audio-devices"],
    });
  } catch (error) {
    logger.error(`Failed to configure OBS: ${error}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
