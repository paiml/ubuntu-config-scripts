/**
 * Playback testing module
 * Creates and tests audio/video playback
 */

import { logger } from "../../lib/logger.ts";
import { runCommand } from "../../lib/common.ts";
import type { DiagnosticResult } from "./audio.ts";
import { checkAudioDeviceStatus } from "./audio.ts";
import { testHardwareDecoding } from "./video.ts";

const TEST_DIR = "/tmp/av-diagnostics";
const TEST_AUDIO_FILE = `${TEST_DIR}/test-audio.wav`;
const TEST_VIDEO_FILE = `${TEST_DIR}/test-video.mp4`;

export async function createTestAudioFile(): Promise<void> {
  logger.info("Creating test audio file...");

  await Deno.mkdir(TEST_DIR, { recursive: true });

  const result = await runCommand([
    "ffmpeg",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=1000:duration=2",
    "-c:a",
    "pcm_s16le",
    TEST_AUDIO_FILE,
  ]);

  if (!result.success) {
    throw new Error(`Failed to create test audio file: ${result.stderr}`);
  }

  logger.info(`Test audio file created: ${TEST_AUDIO_FILE}`);
}

export async function createTestVideoFile(): Promise<void> {
  logger.info("Creating test video file...");

  await Deno.mkdir(TEST_DIR, { recursive: true });

  const result = await runCommand([
    "ffmpeg",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "testsrc=duration=5:size=1920x1080:rate=30",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=1000:duration=5",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-c:a",
    "aac",
    TEST_VIDEO_FILE,
  ]);

  if (!result.success) {
    throw new Error(`Failed to create test video file: ${result.stderr}`);
  }

  logger.info(`Test video file created: ${TEST_VIDEO_FILE}`);
}

export async function testAudioPlayback(): Promise<DiagnosticResult[]> {
  logger.info("\n🎵 Testing audio playback...");
  const results: DiagnosticResult[] = [];

  const hasDevices = await checkAudioDeviceStatus();
  if (!hasDevices) {
    results.push({
      category: "audio",
      severity: "critical",
      message: "Cannot test playback - no audio devices available",
    });
    return results;
  }

  const playbackTest = await runCommand([
    "paplay",
    "--volume",
    "32768",
    TEST_AUDIO_FILE,
  ]);

  if (playbackTest.success) {
    results.push({
      category: "audio",
      severity: "success",
      message: "Audio playback test successful",
    });
  } else {
    results.push({
      category: "audio",
      severity: "critical",
      message: "Audio playback test failed",
      fix: "Check audio device configuration",
    });
  }

  return results;
}

export async function testVideoPlayback(): Promise<DiagnosticResult[]> {
  logger.info("\n🎬 Testing video playback...");
  const results: DiagnosticResult[] = [];

  // Test basic video decode
  const decodeTest = await runCommand([
    "ffmpeg",
    "-i",
    TEST_VIDEO_FILE,
    "-f",
    "null",
    "-",
  ]);

  if (decodeTest.success) {
    results.push({
      category: "video",
      severity: "success",
      message: "Video decode test successful",
    });
  } else {
    results.push({
      category: "video",
      severity: "critical",
      message: "Video decode test failed",
    });
  }

  // Test hardware decoding
  const hwResults = await testHardwareDecoding(TEST_VIDEO_FILE);
  results.push(...hwResults);

  return results;
}

export async function cleanupTestFiles(): Promise<void> {
  logger.info("Cleaning up test files...");

  try {
    await Deno.remove(TEST_DIR, { recursive: true });
  } catch {
    // Ignore errors during cleanup
  }
}

export async function runAllPlaybackTests(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];

  try {
    await createTestAudioFile();
    await createTestVideoFile();

    const audioResults = await testAudioPlayback();
    const videoResults = await testVideoPlayback();

    results.push(...audioResults, ...videoResults);
  } finally {
    await cleanupTestFiles();
  }

  return results;
}
