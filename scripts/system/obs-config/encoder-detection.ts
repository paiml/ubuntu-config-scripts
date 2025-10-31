/**
 * OBS encoder detection and hardware acceleration
 */

import { logger } from "../../lib/logger.ts";
import { runCommand } from "../../lib/common.ts";

export async function checkNvidiaSupport(): Promise<boolean> {
  const result = await runCommand(["nvidia-smi"]);
  return result.success;
}

export async function checkVaapiSupport(): Promise<boolean> {
  const result = await runCommand(["vainfo"]);
  return result.success;
}

export async function detectBestEncoder(): Promise<string> {
  logger.info("🔍 Detecting best available encoder...");

  // Check for NVIDIA NVENC
  if (await checkNvidiaSupport()) {
    logger.info("✅ NVIDIA NVENC available");
    return "ffmpeg_nvenc";
  }

  // Check for VA-API (Intel/AMD)
  if (await checkVaapiSupport()) {
    logger.info("✅ VA-API hardware encoding available");
    return "ffmpeg_vaapi";
  }

  // Fall back to software encoding
  logger.info("ℹ️  Using software encoding (x264)");
  return "obs_x264";
}
