#!/usr/bin/env -S deno run --allow-all

/**
 * Apply the Reddit community fix for DaVinci Resolve pango error
 */

import { logger } from "../lib/logger.ts";

async function applyRedditFix(): Promise<void> {
  logger.info("Applying community fix for DaVinci Resolve pango error...");

  // The solution from Reddit/forums: preload the correct glib
  const launcherContent = `#!/bin/bash
# DaVinci Resolve - Ubuntu 24.04 Fix
# Based on community solution for pango symbol error

# Kill stuck processes
pkill -f VstScanner 2>/dev/null

# Environment
export HOME="\${HOME}"
export USER="\${USER}"
export DISPLAY="\${DISPLAY:-:0}"

# GPU
export __NV_PRIME_RENDER_OFFLOAD=1
export __GLX_VENDOR_LIBRARY_NAME=nvidia

# Skip VST
export RESOLVE_SKIP_VST_SCAN=1

# THE FIX: Preload the system's glib to resolve symbol issues
export LD_PRELOAD="/usr/lib/x86_64-linux-gnu/libglib-2.0.so.0:/usr/lib/x86_64-linux-gnu/libgobject-2.0.so.0:/usr/lib/x86_64-linux-gnu/libgio-2.0.so.0"

# Use DaVinci's libs first, then system
export LD_LIBRARY_PATH="/opt/resolve/libs:/opt/resolve/bin:/usr/lib/x86_64-linux-gnu:/usr/lib/nvidia"

# Launch
exec /opt/resolve/bin/resolve "\$@"
`;

  await Deno.writeTextFile("/tmp/davinci-fix.sh", launcherContent);
  
  logger.success("Fix created!");
  logger.info("Install with:");
  logger.info("  sudo mv /tmp/davinci-fix.sh /usr/local/bin/davinci-resolve");
  logger.info("  sudo chmod +x /usr/local/bin/davinci-resolve");
  logger.info("");
  logger.info("Then launch with: davinci-resolve");
}

// Main
if (import.meta.main) {
  await applyRedditFix();
}