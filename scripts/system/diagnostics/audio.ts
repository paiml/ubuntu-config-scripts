/**
 * Audio diagnostics module
 * Handles all audio-related diagnostic checks
 */

import { logger } from "../../lib/logger.ts";
import { runCommand } from "../../lib/common.ts";
import { z } from "../../../deps.ts";

const DiagnosticResultSchema = z.object({
  category: z.enum(["audio", "video", "system", "gpu", "network"]),
  severity: z.enum(["critical", "warning", "info", "success"]),
  message: z.string(),
  fix: z.string().optional(),
  command: z.string().optional(),
});

export type DiagnosticResult = z.infer<typeof DiagnosticResultSchema>;

export type AudioServer = "PipeWire" | "PulseAudio" | "Unknown";

export async function detectAudioServer(): Promise<AudioServer> {
  const pipewireCheck = await runCommand(["pgrep", "pipewire"]);
  const pulseCheck = await runCommand(["pgrep", "pulseaudio"]);

  return pipewireCheck.success
    ? "PipeWire"
    : pulseCheck.success
    ? "PulseAudio"
    : "Unknown";
}

export async function diagnoseAudioSubsystem(
  audioServer: AudioServer
): Promise<DiagnosticResult[]> {
  logger.info("\n🔊 Diagnosing audio subsystem...");
  const results: DiagnosticResult[] = [];

  // Check if audio service is running
  const audioService = audioServer === "PipeWire" ? "pipewire" : "pulseaudio";
  const serviceCheck = await runCommand([
    "systemctl",
    "--user",
    "status",
    audioService,
  ]);

  if (!serviceCheck.success) {
    results.push({
      category: "audio",
      severity: "critical",
      message: `${audioService} service is not running`,
      fix: `Start ${audioService} service`,
      command: `systemctl --user start ${audioService}`,
    });
  } else {
    results.push({
      category: "audio",
      severity: "success",
      message: `${audioService} service is running`,
    });
  }

  // Check for audio devices
  const sinkCheck = await runCommand(["pactl", "list", "sinks", "short"]);
  if (sinkCheck.success) {
    const sinks = sinkCheck.stdout.trim().split("\n").filter((l) => l);
    if (sinks.length === 0) {
      results.push({
        category: "audio",
        severity: "critical",
        message: "No audio output devices found",
        fix: "Check hardware connections and drivers",
      });
    } else {
      results.push({
        category: "audio",
        severity: "success",
        message: `Found ${sinks.length} audio output device(s)`,
      });

      // Check for suspended sinks
      for (const sink of sinks) {
        const sinkId = sink.split("\t")[0];
        if (!sinkId) continue;

        const sinkInfo = await runCommand([
          "pactl",
          "list",
          "sinks",
        ]);

        if (sinkInfo.stdout.includes("State: SUSPENDED")) {
          results.push({
            category: "audio",
            severity: "warning",
            message: `Audio sink ${sinkId} is suspended`,
            fix: "Resume audio sink",
            command: `pactl suspend-sink ${sinkId} 0`,
          });
        }
      }
    }
  }

  // Check for audio sources (microphones)
  const sourceCheck = await runCommand(["pactl", "list", "sources", "short"]);
  if (sourceCheck.success) {
    const sources = sourceCheck.stdout.trim().split("\n").filter((l) => l);
    if (sources.length === 0) {
      results.push({
        category: "audio",
        severity: "warning",
        message: "No audio input devices found",
      });
    } else {
      results.push({
        category: "audio",
        severity: "success",
        message: `Found ${sources.length} audio input device(s)`,
      });
    }
  }

  // Check for PipeWire specific issues
  if (audioServer === "PipeWire") {
    const pwDumpCheck = await runCommand(["pw-dump"]);
    if (!pwDumpCheck.success) {
      results.push({
        category: "audio",
        severity: "warning",
        message: "PipeWire dump command failed",
        fix: "Check PipeWire installation",
      });
    } else if (pwDumpCheck.stdout.includes("error")) {
      results.push({
        category: "audio",
        severity: "warning",
        message: "PipeWire reports errors in pipeline",
        fix: "Restart PipeWire services",
        command: "systemctl --user restart pipewire pipewire-pulse",
      });
    }

    // Check for broken pipe errors in logs
    const logCheck = await runCommand([
      "journalctl",
      "--user",
      "-u",
      "pipewire",
      "--since",
      "1 hour ago",
      "-n",
      "100",
    ]);

    if (logCheck.success && logCheck.stdout.includes("Broken pipe")) {
      results.push({
        category: "audio",
        severity: "critical",
        message: "PipeWire has 'Broken pipe' errors in logs",
        fix: "Restart PipeWire and check configuration",
        command: "systemctl --user restart pipewire pipewire-pulse wireplumber",
      });
    }
  }

  // Check default sink
  const defaultSinkCheck = await runCommand([
    "pactl",
    "get-default-sink",
  ]);

  if (!defaultSinkCheck.success || !defaultSinkCheck.stdout.trim()) {
    results.push({
      category: "audio",
      severity: "warning",
      message: "No default audio output device set",
      fix: "Set a default audio output device",
    });
  }

  return results;
}

export async function checkAudioDeviceStatus(): Promise<boolean> {
  const sinkCheck = await runCommand(["pactl", "list", "sinks", "short"]);
  return sinkCheck.success && sinkCheck.stdout.trim().split("\n").length > 0;
}
