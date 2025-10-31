#!/usr/bin/env -S deno run --allow-all

import { logger } from "../lib/logger.ts";
import { runCommand } from "../lib/common.ts";

async function fixAudioRouting(): Promise<void> {
  logger.info("🔊 Fixing audio routing for NGS speakers...");

  // 1. Identify the correct audio sink (built-in controller for NGS speakers)
  const sinksResult = await runCommand(["pactl", "list", "short", "sinks"]);
  if (!sinksResult.success) {
    throw new Error("Failed to list audio sinks");
  }

  const sinks = sinksResult.stdout.split("\n").filter((line) => line.trim());
  logger.info(`Found ${sinks.length} audio sinks`);

  // Find the built-in audio controller (where NGS speakers are connected)
  const builtInSink = sinks.find((sink) =>
    sink.includes("pci-0000_00_1f.3") &&
    sink.includes("playback.0.0") &&
    !sink.includes("HDMI") &&
    !sink.includes("Deepbuffer")
  );

  if (!builtInSink) {
    logger.error("Could not find built-in audio controller");
    logger.info("Available sinks:");
    sinks.forEach((sink) => logger.info(`  ${sink}`));
    throw new Error("Built-in audio controller not found");
  }

  const sinkName = builtInSink.split("\t")[1];
  if (!sinkName) {
    throw new Error("Could not parse sink name");
  }

  logger.info(`Using sink: ${sinkName}`);

  // 2. Set as default sink
  logger.info("Setting as default audio output...");
  const setDefaultResult = await runCommand([
    "pactl",
    "set-default-sink",
    sinkName,
  ]);
  if (!setDefaultResult.success) {
    logger.warn(`Failed to set default sink: ${setDefaultResult.stderr}`);
  }

  // 3. Unmute the sink
  logger.info("Unmuting audio output...");
  const unmuteResult = await runCommand([
    "pactl",
    "set-sink-mute",
    sinkName,
    "0",
  ]);
  if (!unmuteResult.success) {
    logger.warn(`Failed to unmute: ${unmuteResult.stderr}`);
  }

  // 4. Set volume to reasonable level (80%)
  logger.info("Setting volume to 80%...");
  const volumeResult = await runCommand([
    "pactl",
    "set-sink-volume",
    sinkName,
    "80%",
  ]);
  if (!volumeResult.success) {
    logger.warn(`Failed to set volume: ${volumeResult.stderr}`);
  }

  // 5. Move all existing audio streams to the correct sink
  logger.info("Moving audio streams to correct output...");
  const inputsResult = await runCommand([
    "pactl",
    "list",
    "short",
    "sink-inputs",
  ]);
  if (inputsResult.success) {
    const inputs = inputsResult.stdout.split("\n").filter((line) =>
      line.trim()
    );
    for (const input of inputs) {
      const inputId = input.split("\t")[0];
      if (inputId) {
        await runCommand(["pactl", "move-sink-input", inputId, sinkName]);
      }
    }
  }

  // 6. Also check and unmute master volume controls via ALSA
  logger.info("Checking ALSA mixer settings...");

  // Unmute Master
  await runCommand(["amixer", "set", "Master", "unmute"]);
  await runCommand(["amixer", "set", "Master", "80%"]);

  // Unmute Speaker
  await runCommand(["amixer", "set", "Speaker", "unmute"]);
  await runCommand(["amixer", "set", "Speaker", "100%"]);

  // Unmute Headphone (in case NGS is connected via headphone jack)
  await runCommand(["amixer", "set", "Headphone", "unmute"]);
  await runCommand(["amixer", "set", "Headphone", "100%"]);

  // Unmute PCM
  await runCommand(["amixer", "set", "PCM", "unmute"]);
  await runCommand(["amixer", "set", "PCM", "100%"]);

  logger.success("✅ Audio routing fixed!");
  logger.info("");
  logger.info("Your NGS speakers should now work. Try playing some audio.");
  logger.info("If you still can't hear sound:");
  logger.info("  1. Check that NGS speakers are powered on");
  logger.info("  2. Check the volume knob on the speakers");
  logger.info("  3. Ensure speakers are connected to the green audio jack");
}

async function testAudio(): Promise<void> {
  logger.info("🔊 Testing audio output...");

  // Try to play a test sound
  const testFiles = [
    "/usr/share/sounds/freedesktop/stereo/audio-volume-change.oga",
    "/usr/share/sounds/freedesktop/stereo/bell.oga",
    "/usr/share/sounds/ubuntu/stereo/desktop-login.ogg",
  ];

  for (const file of testFiles) {
    try {
      const stat = await Deno.stat(file);
      if (stat.isFile) {
        logger.info(`Playing: ${file}`);
        const result = await runCommand(["paplay", file]);
        if (result.success) {
          logger.success("Test sound played successfully");
          return;
        }
      }
    } catch {
      // File doesn't exist, try next
    }
  }

  // Fallback to speaker-test
  logger.info("Playing test tone...");
  await runCommand(["speaker-test", "-t", "sine", "-f", "440", "-l", "1"])
    .catch(() => {
      logger.info("Test tone completed");
    });
}

async function showAudioStatus(): Promise<void> {
  logger.info("📊 Current Audio Status:");
  logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Get default sink
  const defaultSinkResult = await runCommand(["pactl", "get-default-sink"]);
  if (defaultSinkResult.success) {
    const sinkName = defaultSinkResult.stdout.trim();
    logger.info(`Default output: ${sinkName}`);

    // Get sink details
    const sinkInfoResult = await runCommand(["pactl", "list", "sinks"]);
    if (sinkInfoResult.success) {
      const sinks = sinkInfoResult.stdout.split("\n\n");
      for (const sink of sinks) {
        if (sink.includes(sinkName)) {
          const descMatch = sink.match(/Description: (.+)/);
          const muteMatch = sink.match(/Mute: (.+)/);
          const volumeMatch = sink.match(/Volume:.*?(\d+)%/);
          const stateMatch = sink.match(/State: (.+)/);

          if (descMatch) logger.info(`Device: ${descMatch[1]}`);
          if (stateMatch) logger.info(`State: ${stateMatch[1]}`);
          if (muteMatch) {
            logger.info(
              `Muted: ${muteMatch[1] === "yes" ? "Yes ❌" : "No ✅"}`,
            );
          }
          if (volumeMatch) logger.info(`Volume: ${volumeMatch[1]}%`);
          break;
        }
      }
    }
  }

  logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

async function main(): Promise<void> {
  try {
    await showAudioStatus();
    logger.info("");
    await fixAudioRouting();
    logger.info("");
    await testAudio();
    logger.info("");
    await showAudioStatus();
  } catch (error) {
    logger.error(`Failed to fix audio: ${error}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
