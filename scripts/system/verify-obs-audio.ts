#!/usr/bin/env -S deno run --allow-read --allow-run --allow-env

import { logger } from "../lib/logger.ts";

async function verifyOBSAudio(videoDir: string = "/home/noah/Videos") {
  logger.info("Checking video files for audio", { directory: videoDir });

  try {
    const files = [];
    try {
      // Use Deno's readDir to properly handle files with spaces
      for await (const entry of Deno.readDir(videoDir)) {
        if (entry.isFile) {
          const ext = entry.name.split(".").pop()?.toLowerCase();
          if (ext && ["mkv", "mp4", "mov", "flv"].includes(ext)) {
            files.push(`${videoDir}/${entry.name}`);
          }
        }
      }
    } catch (error) {
      logger.error("Failed to read directory", { error: String(error) });
      return;
    }

    if (files.length === 0) {
      logger.warn("No video files found", { directory: videoDir });
      return;
    }

    for (const file of files) {
      const fileName = file.split("/").pop() || file;
      logger.info(`Analyzing: ${fileName}`);

      try {
        // Get file info
        const stat = await Deno.stat(file);
        const size = (stat.size / (1024 * 1024)).toFixed(2);
        logger.info(`File size: ${size} MB`);

        // Check for audio streams using ffprobe
        const ffprobeCmd = new Deno.Command("ffprobe", {
          args: [
            "-v",
            "error",
            "-select_streams",
            "a",
            "-show_entries",
            "stream=codec_name,sample_rate,channels,bit_rate",
            "-of",
            "json",
            file,
          ],
        });
        const audioOutput = await ffprobeCmd.output();
        const audioInfo = JSON.parse(
          new TextDecoder().decode(audioOutput.stdout),
        );

        if (audioInfo.streams && audioInfo.streams.length > 0) {
          logger.success("✓ Audio present", {
            streams: audioInfo.streams.length,
            codec: audioInfo.streams[0].codec_name,
            sampleRate: audioInfo.streams[0].sample_rate,
            channels: audioInfo.streams[0].channels,
            bitRate: audioInfo.streams[0].bit_rate,
          });

          // Get duration
          const durationCmd = new Deno.Command("ffprobe", {
            args: [
              "-v",
              "error",
              "-show_entries",
              "format=duration",
              "-of",
              "json",
              file,
            ],
          });
          const durationOutput = await durationCmd.output();
          const formatInfo = JSON.parse(
            new TextDecoder().decode(durationOutput.stdout),
          );
          if (formatInfo.format?.duration) {
            const duration = parseFloat(formatInfo.format.duration);
            logger.info(
              `Duration: ${duration.toFixed(2)} seconds (${
                (duration / 60).toFixed(2)
              } minutes)`,
            );
          }
        } else {
          logger.error("✗ No audio found!", { file: fileName });
        }
      } catch (error) {
        logger.error(`Failed to analyze ${fileName}`, { error: String(error) });
      }

      console.log("--------------------------------");
    }
  } catch (error) {
    logger.error("Failed to verify OBS audio", { error: String(error) });
  }
}

if (import.meta.main) {
  const videoDir = Deno.args[0] || "/home/noah/Videos";
  await verifyOBSAudio(videoDir);
}
