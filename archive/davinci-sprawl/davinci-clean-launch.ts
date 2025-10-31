#!/usr/bin/env -S deno run --allow-all

/**
 * Clean launch for DaVinci Resolve - no system library interference
 */

import { logger } from "../lib/logger.ts";

async function createCleanLauncher(): Promise<void> {
  logger.info("Creating clean launcher for DaVinci Resolve...");

  // Use a minimal, clean environment
  const launcherContent = `#!/bin/bash
# DaVinci Resolve - Clean Launch (no system library conflicts)

# Kill stuck processes
pkill -f VstScanner 2>/dev/null

# Use env -i for a completely clean environment
# This prevents system libraries from interfering
exec env -i \\
  HOME="\${HOME}" \\
  USER="\${USER}" \\
  DISPLAY="\${DISPLAY:-:0}" \\
  PATH="/usr/bin:/bin" \\
  LD_LIBRARY_PATH="/opt/resolve/libs:/opt/resolve/bin" \\
  __NV_PRIME_RENDER_OFFLOAD=1 \\
  __GLX_VENDOR_LIBRARY_NAME=nvidia \\
  RESOLVE_SKIP_VST_SCAN=1 \\
  /opt/resolve/bin/resolve "\$@"
`;

  await Deno.writeTextFile("/tmp/davinci-clean.sh", launcherContent);
  
  logger.success("Clean launcher created!");
  logger.info("Install with:");
  logger.info("  sudo mv /tmp/davinci-clean.sh /usr/local/bin/davinci-resolve");
  logger.info("  sudo chmod +x /usr/local/bin/davinci-resolve");
  logger.info("");
  logger.info("Then launch with: davinci-resolve");
}

// Main
if (import.meta.main) {
  await createCleanLauncher();
}