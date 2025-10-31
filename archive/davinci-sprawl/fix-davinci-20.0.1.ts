#!/usr/bin/env -S deno run --allow-all

/**
 * Fix DaVinci Resolve 20.0.1 to work on Ubuntu 24.04
 */

import { logger } from "../lib/logger.ts";

async function fixDaVinci(): Promise<void> {
  logger.info("Fixing DaVinci Resolve 20.0.1 for Ubuntu 24.04...");

  // Create launcher that prioritizes DaVinci's bundled libraries
  const launcherContent = `#!/bin/bash
# DaVinci Resolve 20.0.1 - Working launcher for Ubuntu 24.04

# Kill any stuck processes
pkill -f VstScanner 2>/dev/null
pkill -f "resolve --" 2>/dev/null

# Basic environment
export HOME="\${HOME}"
export USER="\${USER}"
export DISPLAY="\${DISPLAY:-:0}"

# GPU settings
export __NV_PRIME_RENDER_OFFLOAD=1
export __GLX_VENDOR_LIBRARY_NAME=nvidia

# Skip VST scanning
export RESOLVE_SKIP_VST_SCAN=1

# CRITICAL: Use ONLY DaVinci's libraries to avoid pango conflicts
# This is what makes it work!
export LD_LIBRARY_PATH="/opt/resolve/libs:/opt/resolve/bin"

# Add minimal system paths only for NVIDIA/CUDA
export LD_LIBRARY_PATH="\${LD_LIBRARY_PATH}:/usr/lib/nvidia"

# Launch DaVinci
exec /opt/resolve/bin/resolve "\$@"
`;

  // Write launcher
  await Deno.writeTextFile("/tmp/davinci-launcher.sh", launcherContent);
  
  // Install launcher
  const mvProc = new Deno.Command("sudo", {
    args: ["mv", "/tmp/davinci-launcher.sh", "/usr/local/bin/davinci-resolve"],
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });
  await mvProc.output();
  
  // Make executable
  const chmodProc = new Deno.Command("sudo", {
    args: ["chmod", "+x", "/usr/local/bin/davinci-resolve"],
    stdout: "inherit",
    stderr: "inherit",
  });
  await chmodProc.output();

  logger.success("Fix applied!");
  logger.info("Launch DaVinci Resolve with: davinci-resolve");
}

// Main
if (import.meta.main) {
  try {
    await fixDaVinci();
  } catch (error) {
    logger.error("Fix failed", { error });
    Deno.exit(1);
  }
}