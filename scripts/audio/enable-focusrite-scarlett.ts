#!/usr/bin/env -S deno run --allow-all

import { logger } from "../lib/logger.ts";
import { parseArgs, runCommand } from "../lib/common.ts";

interface ScarlettDevice {
  sourceId: string;
  sourceName: string;
  sinkId: string;
  sinkName: string;
  cardId: string;
  cardName: string;
  model: string;
  isConnected: boolean;
}

interface AudioSource {
  id: string;
  name: string;
  description: string;
  state: string;
  isMuted: boolean;
  volume: number;
}

async function findScarlettDevice(): Promise<ScarlettDevice | null> {
  // Check USB devices first
  const lsusbResult = await runCommand(["lsusb"]);
  if (!lsusbResult.success) {
    logger.warn("Could not check USB devices");
  }

  const usbLines = lsusbResult.stdout.split("\n");
  const focusriteLine = usbLines.find(
    (line) =>
      line.toLowerCase().includes("focusrite") ||
      line.toLowerCase().includes("scarlett"),
  );

  if (!focusriteLine) {
    return null;
  }

  logger.info(`Found USB device: ${focusriteLine.trim()}`);

  // Get detailed info from pactl
  const sourcesResult = await runCommand(["pactl", "list", "sources"]);
  const sinksResult = await runCommand(["pactl", "list", "sinks"]);
  const cardsResult = await runCommand(["pactl", "list", "cards"]);

  let sourceId = "";
  let sourceName = "";
  let sinkId = "";
  let sinkName = "";
  let cardId = "";
  let cardName = "";
  let model = "Scarlett";

  // Find Scarlett source (input)
  if (sourcesResult.success) {
    const sources = sourcesResult.stdout.split("\n\n");
    for (const source of sources) {
      if (
        source.toLowerCase().includes("focusrite") ||
        source.toLowerCase().includes("scarlett")
      ) {
        const idMatch = source.match(/Source #(\d+)/);
        const nameMatch = source.match(/Name: (.+)/);
        if (idMatch) sourceId = idMatch[1]!;
        if (nameMatch) sourceName = nameMatch[1]!;

        const modelMatch = source.match(
          /device\.product\.name = "([^"]+)"/,
        );
        if (modelMatch) model = modelMatch[1]!;
        break;
      }
    }
  }

  // Find Scarlett sink (output)
  if (sinksResult.success) {
    const sinks = sinksResult.stdout.split("\n\n");
    for (const sink of sinks) {
      if (
        sink.toLowerCase().includes("focusrite") ||
        sink.toLowerCase().includes("scarlett")
      ) {
        const idMatch = sink.match(/Sink #(\d+)/);
        const nameMatch = sink.match(/Name: (.+)/);
        if (idMatch) sinkId = idMatch[1]!;
        if (nameMatch) sinkName = nameMatch[1]!;
        break;
      }
    }
  }

  // Find Scarlett card
  if (cardsResult.success) {
    const cards = cardsResult.stdout.split("\n\n");
    for (const card of cards) {
      if (
        card.toLowerCase().includes("focusrite") ||
        card.toLowerCase().includes("scarlett")
      ) {
        const idMatch = card.match(/Card #(\d+)/);
        const nameMatch = card.match(/Name: (.+)/);
        if (idMatch) cardId = idMatch[1]!;
        if (nameMatch) cardName = nameMatch[1]!;
        break;
      }
    }
  }

  return {
    sourceId,
    sourceName,
    sinkId,
    sinkName,
    cardId,
    cardName,
    model,
    isConnected: true,
  };
}

async function getSourceInfo(sourceName: string): Promise<AudioSource | null> {
  const result = await runCommand(["pactl", "list", "sources"]);
  if (!result.success) return null;

  const sources = result.stdout.split("\n\n");
  for (const source of sources) {
    if (source.includes(`Name: ${sourceName}`)) {
      const idMatch = source.match(/Source #(\d+)/);
      const descMatch = source.match(/Description: (.+)/);
      const stateMatch = source.match(/State: (.+)/);
      const muteMatch = source.match(/Mute: (.+)/);
      const volumeMatch = source.match(/Volume:.*?(\d+)%/);

      return {
        id: idMatch?.[1] || "",
        name: sourceName,
        description: descMatch?.[1] || sourceName,
        state: stateMatch?.[1] || "UNKNOWN",
        isMuted: muteMatch?.[1] === "yes",
        volume: parseInt(volumeMatch?.[1] || "0"),
      };
    }
  }
  return null;
}

async function enableScarlettMic(
  device: ScarlettDevice,
  volume: number,
): Promise<void> {
  logger.info(`Configuring ${device.model} microphone input...`);

  // Set as default source
  if (device.sourceName) {
    const setDefaultResult = await runCommand([
      "pactl",
      "set-default-source",
      device.sourceName,
    ]);
    if (setDefaultResult.success) {
      logger.success(`Set ${device.model} as default input source`);
    } else {
      logger.warn(`Could not set as default source: ${setDefaultResult.stderr}`);
    }

    // Unmute
    const unmuteResult = await runCommand([
      "pactl",
      "set-source-mute",
      device.sourceName,
      "0",
    ]);
    if (unmuteResult.success) {
      logger.success("Microphone unmuted");
    } else {
      logger.warn(`Could not unmute: ${unmuteResult.stderr}`);
    }

    // Set volume
    const volumeResult = await runCommand([
      "pactl",
      "set-source-volume",
      device.sourceName,
      `${volume}%`,
    ]);
    if (volumeResult.success) {
      logger.success(`Microphone volume set to ${volume}%`);
    } else {
      logger.warn(`Could not set volume: ${volumeResult.stderr}`);
    }
  } else {
    throw new Error("No Scarlett input source found in PulseAudio");
  }
}

async function enableScarlettOutput(device: ScarlettDevice): Promise<void> {
  if (!device.sinkName) {
    logger.info("No Scarlett output sink found (this is normal if you only use it for input)");
    return;
  }

  logger.info(`Configuring ${device.model} headphone output...`);

  // Optionally set as default output (user might not want this)
  const setDefaultResult = await runCommand([
    "pactl",
    "set-default-sink",
    device.sinkName,
  ]);
  if (setDefaultResult.success) {
    logger.success(`Set ${device.model} as default output`);
  }
}

async function listAllSources(): Promise<void> {
  const result = await runCommand(["pactl", "list", "sources", "short"]);
  if (!result.success) {
    logger.error("Could not list sources");
    return;
  }

  logger.info("\nAvailable audio input sources:");
  logger.info("─".repeat(60));

  const lines = result.stdout.trim().split("\n");
  for (const line of lines) {
    const parts = line.split("\t");
    if (parts.length >= 2) {
      const [id, name] = parts;
      const isFocusrite =
        name?.toLowerCase().includes("focusrite") ||
        name?.toLowerCase().includes("scarlett");
      const prefix = isFocusrite ? ">>> " : "    ";
      logger.info(`${prefix}${id}: ${name}`);
    }
  }
}

async function testMicrophone(device: ScarlettDevice): Promise<void> {
  logger.info("\nTesting microphone (speak for 3 seconds)...");

  const tempFile = "/tmp/scarlett-mic-test.wav";

  // Record 3 seconds
  const recordResult = await runCommand([
    "timeout",
    "3",
    "parecord",
    "--device",
    device.sourceName,
    "--file-format=wav",
    tempFile,
  ]);

  if (!recordResult.success && recordResult.code !== 124) {
    logger.warn("Recording test failed - check that PipeWire/PulseAudio is running");
    return;
  }

  logger.info("Playing back recording...");

  // Play back
  const playResult = await runCommand(["paplay", tempFile]);
  if (!playResult.success) {
    logger.warn("Playback failed");
  }

  // Cleanup
  try {
    await Deno.remove(tempFile);
  } catch {
    // Ignore
  }

  logger.success("Microphone test complete");
}

async function showStatus(device: ScarlettDevice): Promise<void> {
  logger.info(`\n${device.model} Status:`);
  logger.info("─".repeat(40));

  if (device.sourceName) {
    const sourceInfo = await getSourceInfo(device.sourceName);
    if (sourceInfo) {
      logger.info(`Input:  ${sourceInfo.description}`);
      logger.info(`State:  ${sourceInfo.state}`);
      logger.info(`Muted:  ${sourceInfo.isMuted ? "YES" : "NO"}`);
      logger.info(`Volume: ${sourceInfo.volume}%`);
    }
  }

  // Check default source
  const defaultResult = await runCommand(["pactl", "get-default-source"]);
  if (defaultResult.success) {
    const isDefault = defaultResult.stdout.trim() === device.sourceName;
    logger.info(`Default: ${isDefault ? "YES" : "NO"}`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(Deno.args);

  if (args["help"] || args["h"]) {
    console.log(`
Usage: enable-focusrite-scarlett.ts [OPTIONS]

Enable and configure Focusrite Scarlett audio interface for live streaming.

Options:
  --volume <0-100>  Set microphone input volume (default: 80)
  --output          Also set Scarlett as default audio output
  --test            Test microphone after configuration
  --list            List all available audio sources
  --status          Show current Scarlett status only
  --help, -h        Show this help message
  --verbose, -v     Enable verbose logging

Examples:
  enable-focusrite-scarlett.ts              # Enable with defaults
  enable-focusrite-scarlett.ts --volume=70  # Set input volume to 70%
  enable-focusrite-scarlett.ts --test       # Enable and test microphone
  enable-focusrite-scarlett.ts --list       # List all sources to troubleshoot
`);
    Deno.exit(0);
  }

  if (args["verbose"] || args["v"]) {
    logger.setLevel(0);
  }

  if (args["list"]) {
    await listAllSources();
    Deno.exit(0);
  }

  logger.info("Searching for Focusrite Scarlett interface...");

  const device = await findScarlettDevice();

  if (!device) {
    logger.error("Focusrite Scarlett not detected!");
    logger.info("\nTroubleshooting steps:");
    logger.info("  1. Check that Scarlett is connected via USB");
    logger.info("  2. Ensure Scarlett is powered on");
    logger.info("  3. Try a different USB port (preferably USB 2.0)");
    logger.info("  4. Run: lsusb | grep -i focusrite");
    logger.info("  5. Check dmesg: sudo dmesg | grep -i focusrite");
    logger.info("\nRun with --list to see all available audio sources");
    Deno.exit(1);
  }

  logger.success(`Found: ${device.model}`);
  logger.debug(`  Source: ${device.sourceName}`);
  logger.debug(`  Sink: ${device.sinkName}`);
  logger.debug(`  Card: ${device.cardName}`);

  if (args["status"]) {
    await showStatus(device);
    Deno.exit(0);
  }

  const volume = parseInt(String(args["volume"] || "80"));

  try {
    await enableScarlettMic(device, volume);

    if (args["output"]) {
      await enableScarlettOutput(device);
    }

    await showStatus(device);

    if (args["test"]) {
      await testMicrophone(device);
    }

    logger.success(`\n${device.model} is ready for live streaming!`);
  } catch (error) {
    logger.error(`Failed to configure Scarlett: ${error}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
