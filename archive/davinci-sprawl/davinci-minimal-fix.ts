#!/usr/bin/env -S deno run --allow-all

/**
 * Minimal fix for DaVinci Resolve 20.1 - just the essentials
 */

import { logger } from "../lib/logger.ts";
import { existsSync } from "https://deno.land/std@0.208.0/fs/mod.ts";

async function applyMinimalFix(): Promise<void> {
  logger.info("Applying minimal fix for DaVinci Resolve 20.1...");

  // 1. Fix CUDA symlink (this is essential)
  const cuda11Link = "/usr/lib/x86_64-linux-gnu/libcudart.so.11.0";
  if (!existsSync(cuda11Link)) {
    logger.info("Creating CUDA 11 compatibility symlink...");
    const linkProc = new Deno.Command("sudo", {
      args: ["ln", "-sf", "/usr/lib/x86_64-linux-gnu/libcudart.so.12", cuda11Link],
      stdout: "inherit",
      stderr: "inherit",
    });
    await linkProc.output();
    logger.success("CUDA symlink created");
  }

  // 2. Create a simple launcher that avoids the pango issue
  const launcherContent = `#!/bin/bash
# DaVinci Resolve 20.1 - Minimal Working Launcher

# Kill stuck processes
pkill -f VstScanner 2>/dev/null
pkill -f "resolve --" 2>/dev/null

# Environment
export HOME="\${HOME}"
export USER="\${USER}"
export DISPLAY="\${DISPLAY:-:0}"

# GPU
export __NV_PRIME_RENDER_OFFLOAD=1
export __GLX_VENDOR_LIBRARY_NAME=nvidia

# Skip optional features
export RESOLVE_CUDA_FORCE=0
export RESOLVE_SKIP_VST_SCAN=1

# Use DaVinci's bundled libraries FIRST
# This is the key - prioritize DaVinci's libs over system libs
export LD_LIBRARY_PATH="/opt/resolve/libs:/opt/resolve/bin"

# Add only essential system paths at the end
export LD_LIBRARY_PATH="\${LD_LIBRARY_PATH}:/usr/lib/x86_64-linux-gnu:/usr/lib/nvidia"

# Launch
exec /opt/resolve/bin/resolve "\$@"
`;

  const scriptPath = "/usr/local/bin/davinci-minimal";
  
  // Write the script
  await Deno.writeTextFile("/tmp/davinci-minimal.sh", launcherContent);
  
  // Move to system location
  const mvProc = new Deno.Command("sudo", {
    args: ["mv", "/tmp/davinci-minimal.sh", scriptPath],
    stdout: "inherit",
    stderr: "inherit",
  });
  await mvProc.output();
  
  // Make executable
  const chmodProc = new Deno.Command("sudo", {
    args: ["chmod", "+x", scriptPath],
    stdout: "inherit",
    stderr: "inherit",
  });
  await chmodProc.output();

  logger.success("Minimal fix applied!");
  logger.info("Try launching with: davinci-minimal");
}

// Main
if (import.meta.main) {
  try {
    await applyMinimalFix();
  } catch (error) {
    logger.error("Failed to apply fix", { error });
    Deno.exit(1);
  }
}