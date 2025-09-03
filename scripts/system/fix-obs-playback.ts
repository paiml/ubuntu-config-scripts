#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-env

import { logger } from "../lib/logger.ts";

async function fixOBSPlayback(inputFile: string) {
  logger.info("Fixing OBS recording for playback", { file: inputFile });

  try {
    // Check if file exists
    try {
      await Deno.stat(inputFile);
    } catch {
      logger.error("File not found", { file: inputFile });
      return;
    }

    const outputFile = inputFile.replace(/\.(mp4|mov|mkv)$/, "-fixed.mp4");

    logger.info("Creating compatible version", { output: outputFile });

    // Use Deno.Command to run ffmpeg with proper error handling
    const ffmpegPath = "/usr/bin/ffmpeg";

    // First, try to find ffmpeg location
    const whichCmd = new Deno.Command("which", {
      args: ["ffmpeg"],
    });
    const whichResult = await whichCmd.output();
    new TextDecoder().decode(whichResult.stdout).trim() || ffmpegPath;

    // Try using static ffmpeg binary if available
    const staticFfmpeg = "/snap/bin/ffmpeg";
    try {
      await Deno.stat(staticFfmpeg);
      logger.info("Using snap ffmpeg");

      const cmd = new Deno.Command(staticFfmpeg, {
        args: [
          "-i",
          inputFile,
          "-map",
          "0:v:0", // First video stream
          "-map",
          "0:a:0", // First audio stream only
          "-c:v",
          "copy", // Copy video without re-encoding
          "-c:a",
          "aac", // Re-encode audio to AAC
          "-b:a",
          "192k", // Audio bitrate
          "-movflags",
          "+faststart", // Optimize for streaming
          outputFile,
          "-y", // Overwrite if exists
        ],
      });

      const output = await cmd.output();

      if (output.success) {
        logger.success("File fixed successfully", { output: outputFile });

        // Verify the output
        const verifyCmd = new Deno.Command(staticFfmpeg, {
          args: ["-v", "error", "-i", outputFile, "-f", "null", "-"],
        });
        const verifyResult = await verifyCmd.output();

        if (verifyResult.success) {
          logger.success("Output file verified - no errors found");
        } else {
          logger.warn("Output file may have issues", {
            error: new TextDecoder().decode(verifyResult.stderr),
          });
        }
      } else {
        logger.error("Failed to process file", {
          error: new TextDecoder().decode(output.stderr),
        });
      }
    } catch {
      logger.error("ffmpeg not available - please install it first");
      logger.info("Try: sudo snap install ffmpeg");
    }
  } catch (error) {
    logger.error("Failed to fix OBS playback", { error: String(error) });
  }
}

if (import.meta.main) {
  const inputFile = Deno.args[0];
  if (!inputFile) {
    logger.error("Usage: fix-obs-playback.ts <video-file>");
    Deno.exit(1);
  }
  await fixOBSPlayback(inputFile);
}
