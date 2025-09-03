#!/usr/bin/env -S deno run --allow-all

/**
 * Simple DaVinci Resolve launcher - just the basics that used to work
 */

import { logger } from "../lib/logger.ts";

async function launchDaVinci(): Promise<void> {
  logger.info("Launching DaVinci Resolve (simple mode)...");

  // Kill any stuck processes
  try {
    const killProc = new Deno.Command("pkill", {
      args: ["-f", "resolve"],
      stdout: "null",
      stderr: "null",
    });
    await killProc.output();
  } catch {
    // Ignore if no process to kill
  }

  // Set minimal environment
  const env: Record<string, string> = {
    ...Deno.env.toObject(),
    // Skip VST scanning which often causes hangs
    RESOLVE_SKIP_VST_SCAN: "1",
    // Use system Qt settings
    QT_AUTO_SCREEN_SCALE_FACTOR: "0",
    QT_SCALE_FACTOR: "1",
    // GPU settings for NVIDIA
    __NV_PRIME_RENDER_OFFLOAD: "1",
    __GLX_VENDOR_LIBRARY_NAME: "nvidia",
  };

  // Launch DaVinci Resolve
  logger.info("Starting DaVinci Resolve...");

  const proc = new Deno.Command("/opt/resolve/bin/resolve", {
    env,
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });

  const result = await proc.output();

  if (result.success) {
    logger.success("DaVinci Resolve closed normally");
  } else {
    logger.error(`DaVinci Resolve exited with code ${result.code}`);
  }
}

// Main
if (import.meta.main) {
  try {
    await launchDaVinci();
  } catch (error) {
    logger.error("Failed to launch DaVinci Resolve", { error });
    Deno.exit(1);
  }
}
