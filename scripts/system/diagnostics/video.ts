/**
 * Video diagnostics module
 * Handles all video-related diagnostic checks
 */

import { logger } from "../../lib/logger.ts";
import { runCommand } from "../../lib/common.ts";
import type { DiagnosticResult } from "./audio.ts";

export async function diagnoseVideoSubsystem(): Promise<DiagnosticResult[]> {
  logger.info("\n🎥 Diagnosing video subsystem...");
  const results: DiagnosticResult[] = [];

  // Check for video acceleration
  const vaInfoCheck = await runCommand(["vainfo"]);
  if (!vaInfoCheck.success) {
    results.push({
      category: "video",
      severity: "warning",
      message: "VA-API not available or not working",
      fix: "Install VA-API drivers for your GPU",
    });
  } else {
    // Parse VA-API profiles
    const profiles = vaInfoCheck.stdout.match(/VAProfile\w+/g);
    if (profiles && profiles.length > 0) {
      results.push({
        category: "video",
        severity: "success",
        message: `VA-API available with ${profiles.length} profiles`,
      });
    }
  }

  // Check for NVIDIA NVDEC
  const nvidiaCheck = await runCommand(["nvidia-smi", "-L"]);
  if (nvidiaCheck.success) {
    results.push({
      category: "video",
      severity: "info",
      message: "NVIDIA GPU detected",
    });

    // Check for NVENC/NVDEC support
    const nvencCheck = await runCommand([
      "ffmpeg",
      "-hide_banner",
      "-encoders",
    ]);
    if (
      nvencCheck.success &&
      (nvencCheck.stdout.includes("h264_nvenc") ||
        nvencCheck.stdout.includes("hevc_nvenc"))
    ) {
      results.push({
        category: "video",
        severity: "success",
        message: "NVIDIA NVENC hardware encoding available",
      });
    }
  }

  // Check for FFmpeg
  const ffmpegCheck = await runCommand(["ffmpeg", "-version"]);
  if (!ffmpegCheck.success) {
    results.push({
      category: "video",
      severity: "critical",
      message: "FFmpeg is not installed",
      fix: "Install FFmpeg for video processing",
      command: "sudo apt install ffmpeg",
    });
  } else {
    results.push({
      category: "video",
      severity: "success",
      message: "FFmpeg is installed",
    });
  }

  // Check display server
  const displayServer = Deno.env.get("WAYLAND_DISPLAY") ? "Wayland" : "X11";
  results.push({
    category: "video",
    severity: "info",
    message: `Display server: ${displayServer}`,
  });

  return results;
}

export async function testHardwareDecoding(
  testFile: string,
): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];

  // Test VAAPI decoding
  const vaapiTest = await runCommand([
    "ffmpeg",
    "-hwaccel",
    "vaapi",
    "-hwaccel_device",
    "/dev/dri/renderD128",
    "-i",
    testFile,
    "-f",
    "null",
    "-",
  ]);

  if (vaapiTest.success) {
    results.push({
      category: "video",
      severity: "success",
      message: "VA-API hardware decoding works",
    });
  } else {
    results.push({
      category: "video",
      severity: "warning",
      message: "VA-API hardware decoding failed",
    });
  }

  // Test NVDEC if NVIDIA GPU is present
  const nvdecTest = await runCommand([
    "ffmpeg",
    "-hwaccel",
    "cuda",
    "-i",
    testFile,
    "-f",
    "null",
    "-",
  ]);

  if (nvdecTest.success) {
    results.push({
      category: "video",
      severity: "success",
      message: "NVIDIA NVDEC hardware decoding works",
    });
  }

  return results;
}
