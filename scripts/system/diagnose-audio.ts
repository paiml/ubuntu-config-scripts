#!/usr/bin/env -S deno run --allow-read --allow-run --allow-env

import { logger } from "../lib/logger.ts";

async function diagnoseAudio(videoFile: string) {
  logger.info("Diagnosing audio in video file", { file: videoFile });

  try {
    // Check file exists
    await Deno.stat(videoFile);

    // 1. Check audio streams
    logger.info("Checking audio streams...");
    const ffprobeCmd = new Deno.Command("ffprobe", {
      args: [
        "-v",
        "error",
        "-show_streams",
        "-select_streams",
        "a",
        "-of",
        "json",
        videoFile,
      ],
    });
    const streamsOutput = await ffprobeCmd.output();
    const streams = JSON.parse(new TextDecoder().decode(streamsOutput.stdout));

    if (!streams.streams || streams.streams.length === 0) {
      logger.error("NO AUDIO STREAMS FOUND IN FILE!");
      return;
    }

    logger.success(`Found ${streams.streams.length} audio stream(s)`);
    for (const [idx, stream] of streams.streams.entries()) {
      logger.info(`Stream ${idx}:`, {
        codec: stream.codec_name,
        sampleRate: stream.sample_rate,
        channels: stream.channels,
        bitrate: stream.bit_rate,
        duration: stream.duration,
      });
    }

    // 2. Check volume levels
    logger.info("Analyzing audio volume...");
    const volumeCmd = new Deno.Command("ffmpeg", {
      args: ["-i", videoFile, "-af", "volumedetect", "-f", "null", "-"],
      stderr: "piped",
    });
    const volumeOutput = await volumeCmd.output();
    const volumeText = new TextDecoder().decode(volumeOutput.stderr);

    const meanVolume = volumeText.match(/mean_volume: ([-\d.]+) dB/)?.[1];
    const maxVolume = volumeText.match(/max_volume: ([-\d.]+) dB/)?.[1];

    if (meanVolume && maxVolume) {
      logger.info("Volume levels:", {
        mean: `${meanVolume} dB`,
        max: `${maxVolume} dB`,
      });

      if (parseFloat(meanVolume) < -60) {
        logger.warn("AUDIO IS EXTREMELY QUIET (practically silent)");
      } else if (parseFloat(meanVolume) < -40) {
        logger.warn("Audio is very quiet");
      }
    }

    // 3. Check for silence
    logger.info("Checking for silence periods...");
    const silenceCmd = new Deno.Command("ffmpeg", {
      args: [
        "-i",
        videoFile,
        "-af",
        "silencedetect=n=-50dB:d=1",
        "-f",
        "null",
        "-",
      ],
      stderr: "piped",
    });
    const silenceOutput = await silenceCmd.output();
    const silenceText = new TextDecoder().decode(silenceOutput.stderr);

    const silenceMatches = silenceText.match(/silence_start: ([\d.]+)/g);
    if (silenceMatches && silenceMatches.length > 0) {
      logger.warn(
        `Found ${silenceMatches.length} silence period(s) in the audio`,
      );

      // Check if entire file is silent
      const duration = streams.streams[0]?.duration;
      if (duration) {
        const silenceDuration = silenceText.match(
          /silence_duration: ([\d.]+)/g,
        );
        if (silenceDuration) {
          const totalSilence = silenceDuration.reduce((sum, match) => {
            const dur = parseFloat(match.split(": ")[1]!);
            return sum + dur;
          }, 0);

          if (totalSilence >= parseFloat(duration) * 0.9) {
            logger.error("AUDIO IS MOSTLY OR ENTIRELY SILENT!");
          }
        }
      }
    } else {
      logger.success("No significant silence periods detected");
    }

    // 4. Extract sample and play
    logger.info("Extracting audio sample...");
    const sampleFile = `/tmp/audio-sample-${Date.now()}.wav`;
    const extractCmd = new Deno.Command("ffmpeg", {
      args: [
        "-i",
        videoFile,
        "-t",
        "5", // First 5 seconds
        "-vn", // No video
        "-ar",
        "44100", // Standard sample rate
        "-ac",
        "2", // Stereo
        "-f",
        "wav",
        sampleFile,
        "-y",
      ],
    });
    await extractCmd.output();

    logger.success(`Audio sample extracted to: ${sampleFile}`);
    logger.info("You can play this with: aplay " + sampleFile);

    // 5. Check audio device mapping
    logger.info("\nAudio might be playing but routed to wrong device.");
    logger.info("Check your system audio settings:");
    logger.info("1. Right-click volume icon → Sound Settings");
    logger.info("2. Check Output Device is correct");
    logger.info("3. Check application volume in 'Volume Levels'");
    logger.info("4. Try: pavucontrol for detailed audio routing");
  } catch (error) {
    logger.error("Failed to diagnose audio", { error: String(error) });
  }
}

if (import.meta.main) {
  const videoFile = Deno.args[0];
  if (!videoFile) {
    logger.error("Usage: diagnose-audio.ts <video-file>");
    Deno.exit(1);
  }
  await diagnoseAudio(videoFile);
}
