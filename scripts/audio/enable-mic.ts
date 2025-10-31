#!/usr/bin/env -S deno run --allow-all

import { logger } from "../lib/logger.ts";
import {
  commandExists,
  confirm,
  parseArgs,
  runCommand,
} from "../lib/common.ts";

interface MicrophoneDevice {
  id: string;
  name: string;
  card: string;
  device: string;
  isMuted: boolean;
  volume: number;
}

export async function getPulseAudioDevices(): Promise<MicrophoneDevice[]> {
  const devices: MicrophoneDevice[] = [];

  const sourcesResult = await runCommand(["pactl", "list", "sources"]);
  if (!sourcesResult.success) {
    throw new Error(`Failed to list audio sources: ${sourcesResult.stderr}`);
  }

  const sources = sourcesResult.stdout.split("\n\n");

  for (const source of sources) {
    if (!source.includes("Source #")) continue;

    const idMatch = source.match(/Source #(\d+)/);
    const nameMatch = source.match(/Name: (.+)/);
    const descMatch = source.match(/Description: (.+)/);
    const muteMatch = source.match(/Mute: (.+)/);
    const volumeMatch = source.match(/Volume:.*?(\d+)%/);
    const cardMatch = source.match(/alsa\.card = "(\d+)"/);
    const deviceMatch = source.match(/alsa\.device = "(\d+)"/);

    if (idMatch && nameMatch) {
      devices.push({
        id: idMatch[1]!,
        name: descMatch?.[1] || nameMatch[1]!,
        card: cardMatch?.[1] || "unknown",
        device: deviceMatch?.[1] || "unknown",
        isMuted: muteMatch?.[1] === "yes",
        volume: parseInt(volumeMatch?.[1] || "0"),
      });
    }
  }

  return devices.filter((d) =>
    !d.name.toLowerCase().includes("monitor") &&
    (d.name.toLowerCase().includes("mic") ||
      d.name.toLowerCase().includes("input") ||
      d.name.toLowerCase().includes("capture"))
  );
}

export async function getAlsaDevices(): Promise<MicrophoneDevice[]> {
  const devices: MicrophoneDevice[] = [];

  const result = await runCommand(["arecord", "-l"]);
  if (!result.success) {
    logger.warn("Could not list ALSA devices");
    return devices;
  }

  const lines = result.stdout.split("\n");
  for (const line of lines) {
    const match = line.match(/card (\d+): .+?, device (\d+): (.+)/);
    if (match) {
      devices.push({
        id: `hw:${match[1]},${match[2]}`,
        name: match[3]!,
        card: match[1]!,
        device: match[2]!,
        isMuted: false,
        volume: 100,
      });
    }
  }

  return devices;
}

export async function enableMicrophone(device?: string): Promise<void> {
  const usePulseAudio = await commandExists("pactl");
  const useAlsa = await commandExists("amixer");

  if (!usePulseAudio && !useAlsa) {
    throw new Error(
      "Neither PulseAudio nor ALSA tools found. Please install pulseaudio-utils or alsa-utils",
    );
  }

  if (usePulseAudio) {
    logger.info("Using PulseAudio to enable microphone");

    const devices = await getPulseAudioDevices();

    if (devices.length === 0) {
      throw new Error("No microphone devices found");
    }

    let selectedDevice: MicrophoneDevice;

    if (device) {
      const found = devices.find((d) =>
        d.id === device ||
        d.name.toLowerCase().includes(device.toLowerCase()) ||
        d.card === device
      );

      if (!found) {
        logger.error(`Device '${device}' not found. Available devices:`);
        devices.forEach((d) => {
          logger.info(
            `  ${d.id}: ${d.name} (Card: ${d.card}, Device: ${d.device})`,
          );
        });
        throw new Error(`Device '${device}' not found`);
      }

      selectedDevice = found;
    } else {
      if (devices.length === 1) {
        selectedDevice = devices[0]!;
      } else {
        logger.info("Multiple microphone devices found:");
        devices.forEach((d, i) => {
          const status = d.isMuted ? "🔇 MUTED" : `🔊 ${d.volume}%`;
          logger.info(`  ${i + 1}. ${d.name} ${status}`);
          logger.info(`     ID: ${d.id}, Card: ${d.card}, Device: ${d.device}`);
        });

        const defaultDevice = devices[0];
        if (!defaultDevice) {
          throw new Error("No devices available");
        }
        if (
          !await confirm(`Use default device "${defaultDevice.name}"?`, true)
        ) {
          throw new Error("No device selected");
        }
        selectedDevice = defaultDevice;
      }
    }

    logger.info(`Enabling microphone: ${selectedDevice.name}`);

    const unmuteResult = await runCommand([
      "pactl",
      "set-source-mute",
      selectedDevice.id,
      "0",
    ]);

    if (!unmuteResult.success) {
      throw new Error(`Failed to unmute device: ${unmuteResult.stderr}`);
    }

    if (selectedDevice.volume < 50) {
      logger.info("Setting microphone volume to 70%");
      const volumeResult = await runCommand([
        "pactl",
        "set-source-volume",
        selectedDevice.id,
        "70%",
      ]);

      if (!volumeResult.success) {
        logger.warn(`Failed to set volume: ${volumeResult.stderr}`);
      }
    }

    const setDefaultResult = await runCommand([
      "pactl",
      "set-default-source",
      selectedDevice.id,
    ]);

    if (!setDefaultResult.success) {
      logger.warn(
        `Failed to set as default source: ${setDefaultResult.stderr}`,
      );
    }

    logger.success(`Microphone enabled successfully: ${selectedDevice.name}`);
  } else if (useAlsa) {
    logger.info("Using ALSA to enable microphone");

    const captureResult = await runCommand(["amixer", "set", "Capture", "cap"]);
    if (!captureResult.success) {
      logger.warn("Failed to enable capture");
    }

    const volumeResult = await runCommand(["amixer", "set", "Capture", "70%"]);
    if (!volumeResult.success) {
      logger.warn("Failed to set capture volume");
    }

    const micResult = await runCommand(["amixer", "set", "Mic", "unmute"]);
    if (!micResult.success) {
      logger.warn("Failed to unmute Mic");
    }

    logger.success("Microphone enabled via ALSA");
  }
}

async function main(): Promise<void> {
  const args = parseArgs(Deno.args);

  if (args["help"] || args["h"]) {
    console.log(`
Usage: enable-mic.ts [OPTIONS]

Enable microphone on Ubuntu system using PulseAudio or ALSA.

Options:
  --device <id|name>  Specify device ID, name, or card number
  --help, -h          Show this help message
  --verbose, -v       Enable verbose logging

Examples:
  enable-mic.ts                      # Enable default microphone
  enable-mic.ts --device 1           # Enable device with ID 1
  enable-mic.ts --device "USB Audio" # Enable device by name match
`);
    Deno.exit(0);
  }

  if (args["verbose"] || args["v"]) {
    logger.setLevel(0);
  }

  try {
    await enableMicrophone(args["device"] as string | undefined);
  } catch (error) {
    logger.error(`Failed to enable microphone: ${error}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
