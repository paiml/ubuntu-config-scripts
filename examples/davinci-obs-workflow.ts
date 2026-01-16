#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-env
/**
 * DaVinci Resolve + OBS Workflow Example
 *
 * This example demonstrates how to:
 * 1. Convert OBS recordings (AAC) to DaVinci-compatible format (PCM)
 * 2. Diagnose audio codec issues
 * 3. Batch convert files for editing
 *
 * CRITICAL: DaVinci Resolve on Linux CANNOT decode AAC audio!
 * You must use PCM audio codec for audio to play in DaVinci.
 *
 * Run with: deno run --allow-all examples/davinci-obs-workflow.ts
 */

import { parseArgs } from "jsr:@std/cli@^1.0.0";

// ANSI colors
const RED = "\x1b[0;31m";
const GREEN = "\x1b[0;32m";
const YELLOW = "\x1b[0;33m";
const CYAN = "\x1b[0;36m";
const NC = "\x1b[0m";

interface VideoInfo {
  hasVideo: boolean;
  hasAudio: boolean;
  audioCodec: string;
  videoCodec: string;
  sampleRate: number;
  channels: number;
  duration: number;
}

/**
 * Get video/audio information using ffprobe
 */
async function getVideoInfo(filePath: string): Promise<VideoInfo> {
  const cmd = new Deno.Command("ffprobe", {
    args: [
      "-v", "quiet",
      "-print_format", "json",
      "-show_streams",
      "-show_format",
      filePath,
    ],
    stdout: "piped",
    stderr: "piped",
  });

  const output = await cmd.output();
  const json = JSON.parse(new TextDecoder().decode(output.stdout));

  const videoStream = json.streams?.find((s: { codec_type: string }) => s.codec_type === "video");
  const audioStream = json.streams?.find((s: { codec_type: string }) => s.codec_type === "audio");

  return {
    hasVideo: !!videoStream,
    hasAudio: !!audioStream,
    audioCodec: audioStream?.codec_name || "none",
    videoCodec: videoStream?.codec_name || "none",
    sampleRate: parseInt(audioStream?.sample_rate || "0"),
    channels: audioStream?.channels || 0,
    duration: parseFloat(json.format?.duration || "0"),
  };
}

/**
 * Check if audio codec is DaVinci-compatible
 */
function isDaVinciCompatible(audioCodec: string): boolean {
  const compatibleCodecs = [
    "pcm_s16le", "pcm_s24le", "pcm_s32le",  // PCM variants
    "pcm_f32le", "pcm_f64le",                // Float PCM
    "flac",                                   // FLAC (lossless)
    "alac",                                   // Apple Lossless
  ];
  return compatibleCodecs.includes(audioCodec);
}

/**
 * Convert video to DaVinci-compatible format
 */
async function convertToDaVinci(
  inputPath: string,
  outputPath: string,
  mono: boolean = false,
): Promise<boolean> {
  console.log(`${CYAN}Converting: ${inputPath}${NC}`);
  console.log(`${CYAN}Output: ${outputPath}${NC}`);

  const args = [
    "-i", inputPath,
    "-c:v", "copy",           // Copy video without re-encoding
  ];

  if (mono) {
    args.push("-ac", "1");    // Convert to mono
  }

  args.push(
    "-c:a", "pcm_s24le",      // PCM 24-bit audio
    outputPath,
    "-y",                      // Overwrite if exists
  );

  const cmd = new Deno.Command("ffmpeg", {
    args,
    stdout: "piped",
    stderr: "piped",
  });

  const output = await cmd.output();
  return output.success;
}

/**
 * Diagnose a video file for DaVinci compatibility
 */
async function diagnoseFile(filePath: string): Promise<void> {
  console.log(`\n${CYAN}=== Diagnosing: ${filePath} ===${NC}\n`);

  try {
    const info = await getVideoInfo(filePath);

    console.log(`Video Codec:  ${info.videoCodec}`);
    console.log(`Audio Codec:  ${info.audioCodec}`);
    console.log(`Sample Rate:  ${info.sampleRate} Hz`);
    console.log(`Channels:     ${info.channels}`);
    console.log(`Duration:     ${info.duration.toFixed(2)}s`);

    if (!info.hasAudio) {
      console.log(`\n${RED}ERROR: No audio stream found!${NC}`);
      return;
    }

    if (isDaVinciCompatible(info.audioCodec)) {
      console.log(`\n${GREEN}✓ Audio is DaVinci-compatible (${info.audioCodec})${NC}`);
    } else {
      console.log(`\n${RED}✗ Audio codec '${info.audioCodec}' is NOT compatible with DaVinci on Linux!${NC}`);
      console.log(`${YELLOW}DaVinci will show: "Failed to decode the audio samples"${NC}`);
      console.log(`\n${GREEN}Fix: Convert to PCM audio:${NC}`);
      const outputPath = filePath.replace(/\.(mp4|mkv|mov)$/i, "-pcm.mov");
      console.log(`  ffmpeg -i "${filePath}" -c:v copy -c:a pcm_s24le "${outputPath}"`);
    }
  } catch (error) {
    console.log(`${RED}Error analyzing file: ${error}${NC}`);
  }
}

/**
 * Batch convert all incompatible files in a directory
 */
async function batchConvert(directory: string, mono: boolean = false): Promise<void> {
  console.log(`\n${CYAN}=== Batch Converting: ${directory} ===${NC}\n`);

  const extensions = [".mp4", ".mkv", ".mov", ".avi"];
  let converted = 0;
  let skipped = 0;
  let failed = 0;

  for await (const entry of Deno.readDir(directory)) {
    if (!entry.isFile) continue;

    const ext = entry.name.slice(entry.name.lastIndexOf(".")).toLowerCase();
    if (!extensions.includes(ext)) continue;

    // Skip already converted files
    if (entry.name.includes("-pcm.") || entry.name.includes("-mono.")) {
      skipped++;
      continue;
    }

    const inputPath = `${directory}/${entry.name}`;
    const info = await getVideoInfo(inputPath);

    if (isDaVinciCompatible(info.audioCodec)) {
      console.log(`${GREEN}✓ Already compatible: ${entry.name}${NC}`);
      skipped++;
      continue;
    }

    const suffix = mono ? "-mono.mov" : "-pcm.mov";
    const outputPath = inputPath.replace(/\.(mp4|mkv|mov|avi)$/i, suffix);

    const success = await convertToDaVinci(inputPath, outputPath, mono);
    if (success) {
      console.log(`${GREEN}✓ Converted: ${entry.name}${NC}`);
      converted++;
    } else {
      console.log(`${RED}✗ Failed: ${entry.name}${NC}`);
      failed++;
    }
  }

  console.log(`\n${CYAN}=== Summary ===${NC}`);
  console.log(`Converted: ${converted}`);
  console.log(`Skipped:   ${skipped}`);
  console.log(`Failed:    ${failed}`);
}

/**
 * Print OBS configuration guide
 */
function printOBSGuide(): void {
  console.log(`
${CYAN}╔══════════════════════════════════════════════════════════════╗
║          OBS Settings for DaVinci Resolve (Linux)            ║
╚══════════════════════════════════════════════════════════════╝${NC}

${YELLOW}CRITICAL: DaVinci on Linux cannot decode AAC audio!${NC}
You MUST use PCM audio codec for audio to play.

${GREEN}Required OBS Settings:${NC}

1. Settings → Output → ${CYAN}Output Mode: Advanced${NC}

2. Recording tab:
   - Recording Format:  ${CYAN}QuickTime (.mov)${NC}
   - Video Encoder:     ${CYAN}NVIDIA NVENC H.264 (FFmpeg)${NC}
   - Audio Encoder:     ${CYAN}FFmpeg PCM (24-bit)${NC}  ← CRITICAL!
   - Rate Control:      ${CYAN}CBR${NC}

${RED}DO NOT use Simple output mode - it only offers AAC audio!${NC}

${GREEN}Video Codec:${NC}
   - Use H.264 (not HEVC/H.265)
   - HEVC requires DaVinci Resolve Studio (paid)

${GREEN}DaVinci Cloud Settings:${NC}
   - File → Project Settings → Blackmagic Cloud
   - Select "Don't sync media" to prevent upload errors
   - Only edit list/timeline data will sync

${GREEN}Converting Existing Files:${NC}
   # Single file
   ffmpeg -i input.mp4 -c:v copy -c:a pcm_s24le output.mov

   # Stereo to mono (if one channel is empty)
   ffmpeg -i input.mp4 -c:v copy -ac 1 -c:a pcm_s24le output-mono.mov
`);
}

// Main CLI
if (import.meta.main) {
  const args = parseArgs(Deno.args, {
    boolean: ["help", "guide", "mono"],
    string: ["diagnose", "convert", "batch"],
    alias: { h: "help", g: "guide", d: "diagnose", c: "convert", b: "batch", m: "mono" },
  });

  if (args.help || Deno.args.length === 0) {
    console.log(`
${CYAN}DaVinci + OBS Workflow Tool${NC}

Usage:
  davinci-obs-workflow.ts [options]

Options:
  -g, --guide              Show OBS configuration guide
  -d, --diagnose <file>    Diagnose a video file for compatibility
  -c, --convert <file>     Convert a single file to DaVinci format
  -b, --batch <directory>  Batch convert all files in directory
  -m, --mono               Convert to mono audio (use with -c or -b)
  -h, --help               Show this help

Examples:
  # Show OBS setup guide
  ./davinci-obs-workflow.ts --guide

  # Check if a file is compatible
  ./davinci-obs-workflow.ts --diagnose recording.mp4

  # Convert a file
  ./davinci-obs-workflow.ts --convert recording.mp4

  # Convert to mono
  ./davinci-obs-workflow.ts --convert recording.mp4 --mono

  # Batch convert a folder
  ./davinci-obs-workflow.ts --batch ~/Videos/OBS
`);
    Deno.exit(0);
  }

  if (args.guide) {
    printOBSGuide();
    Deno.exit(0);
  }

  if (args.diagnose) {
    await diagnoseFile(args.diagnose);
    Deno.exit(0);
  }

  if (args.convert) {
    const suffix = args.mono ? "-mono.mov" : "-pcm.mov";
    const outputPath = args.convert.replace(/\.(mp4|mkv|mov|avi)$/i, suffix);
    const success = await convertToDaVinci(args.convert, outputPath, args.mono);
    Deno.exit(success ? 0 : 1);
  }

  if (args.batch) {
    await batchConvert(args.batch, args.mono);
    Deno.exit(0);
  }
}

export { convertToDaVinci, diagnoseFile, getVideoInfo, isDaVinciCompatible, printOBSGuide };
