/**
 * OBS audio device detection
 */

import { logger } from "../../lib/logger.ts";
import { runCommand } from "../../lib/common.ts";

export interface AudioDevice {
  id: string;
  name: string;
  type: "source" | "sink";
}

export async function getAudioDevices(): Promise<{
  sources: AudioDevice[];
  sinks: AudioDevice[];
}> {
  logger.info("🔍 Detecting audio devices...");

  const sources: AudioDevice[] = [];
  const sinks: AudioDevice[] = [];

  // Get PulseAudio sources (microphones)
  const sourcesResult = await runCommand(["pactl", "list", "short", "sources"]);
  if (sourcesResult.success) {
    const lines = sourcesResult.stdout.trim().split("\n");
    for (const line of lines) {
      const parts = line.split("\t");
      if (parts.length >= 2) {
        const id = parts[1] ?? "";
        const name = parts[1] ?? "";

        // Filter out monitors
        if (!name.includes(".monitor")) {
          sources.push({ id, name, type: "source" });
        }
      }
    }
  }

  // Get PulseAudio sinks (speakers)
  const sinksResult = await runCommand(["pactl", "list", "short", "sinks"]);
  if (sinksResult.success) {
    const lines = sinksResult.stdout.trim().split("\n");
    for (const line of lines) {
      const parts = line.split("\t");
      if (parts.length >= 2) {
        const id = parts[1] ?? "";
        const name = parts[1] ?? "";
        sinks.push({ id, name, type: "sink" });
      }
    }
  }

  logger.info(
    `Found ${sources.length} audio input(s), ${sinks.length} output(s)`,
  );
  return { sources, sinks };
}
