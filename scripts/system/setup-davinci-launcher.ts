#!/usr/bin/env -S deno run --allow-all

/**
 * Setup launcher for DaVinci Resolve 20.0.1 after installation
 */

import { logger } from "../lib/logger.ts";
import { existsSync } from "https://deno.land/std@0.208.0/fs/mod.ts";

async function setupLauncher(): Promise<void> {
  logger.info("Setting up DaVinci Resolve 20.0.1 launcher...");

  // Check if DaVinci is installed
  if (!existsSync("/opt/resolve/bin/resolve")) {
    logger.error("DaVinci Resolve not found at /opt/resolve");
    logger.info("Please install it first");
    return;
  }

  // Create the launcher script
  const launcherContent = `#!/bin/bash
# DaVinci Resolve 20.0.1 Launcher
# This version should work without library issues

# Kill any stuck processes
pkill -f VstScanner 2>/dev/null
pkill -f "resolve --" 2>/dev/null

# Basic environment
export HOME="\${HOME}"
export USER="\${USER}"
export DISPLAY="\${DISPLAY:-:0}"

# GPU settings for NVIDIA
export __NV_PRIME_RENDER_OFFLOAD=1
export __GLX_VENDOR_LIBRARY_NAME=nvidia

# Skip VST scanning to prevent hangs
export RESOLVE_SKIP_VST_SCAN=1

# Qt settings
export QT_AUTO_SCREEN_SCALE_FACTOR=0
export QT_SCALE_FACTOR=1

# Launch DaVinci Resolve
exec /opt/resolve/bin/resolve "\$@"
`;

  // Write to temp file
  await Deno.writeTextFile("/tmp/davinci-launcher.sh", launcherContent);

  // Move to system location
  const mvProc = new Deno.Command("sudo", {
    args: ["mv", "/tmp/davinci-launcher.sh", "/usr/local/bin/davinci-resolve"],
    stdout: "inherit",
    stderr: "inherit",
  });
  await mvProc.output();

  // Make executable
  const chmodProc = new Deno.Command("sudo", {
    args: ["chmod", "+x", "/usr/local/bin/davinci-resolve"],
    stdout: "inherit",
    stderr: "inherit",
  });
  await chmodProc.output();

  // Update desktop entry if it exists
  const desktopFile =
    "/usr/share/applications/com.blackmagicdesign.resolve.desktop";
  if (existsSync(desktopFile)) {
    logger.info("Updating desktop entry...");

    const sedProc = new Deno.Command("sudo", {
      args: [
        "sed",
        "-i",
        "s|Exec=/opt/resolve/bin/resolve %u|Exec=/usr/local/bin/davinci-resolve %u|",
        desktopFile,
      ],
      stdout: "inherit",
      stderr: "inherit",
    });
    await sedProc.output();
  }

  logger.success("Launcher setup complete!");
  logger.info("");
  logger.info("You can now launch DaVinci Resolve with:");
  logger.info("  davinci-resolve");
  logger.info("Or from the applications menu");
  logger.info("Or with: make system-davinci-launch");
}

// Main
if (import.meta.main) {
  try {
    await setupLauncher();
  } catch (error) {
    logger.error("Setup failed", { error });
    Deno.exit(1);
  }
}
