#!/usr/bin/env -S deno run --allow-all

import { logger } from "../lib/logger.ts";
import { runCommand } from "../lib/common.ts";

/**
 * Fix OBS screen capture issues on Ubuntu
 * Addresses black screen problems with PipeWire capture
 */

async function fixOBSCapture(): Promise<void> {
  logger.info("Fixing OBS screen capture issues...");

  // Check if running under Wayland or X11
  const sessionType = Deno.env.get("XDG_SESSION_TYPE");
  logger.info(`Session type: ${sessionType}`);

  if (sessionType === "wayland") {
    logger.warn(
      "Wayland detected. OBS may have limited screen capture support.",
    );
    logger.info("Consider switching to X11 for better compatibility.");

    // Try to enable PipeWire permissions
    const portalResult = await runCommand([
      "flatpak",
      "override",
      "--user",
      "--filesystem=xdg-run/pipewire-0",
      "com.obsproject.Studio",
    ]);

    if (!portalResult.success) {
      logger.info("Not a Flatpak installation, checking system permissions...");
    }
  }

  // Set environment variables for better capture
  const envVars = [
    "OBS_USE_EGL=1",
    "QT_QPA_PLATFORM=xcb",
    "GDK_BACKEND=x11",
  ];

  logger.info("Setting environment variables for OBS...");

  // Add to user's profile
  const homeDir = Deno.env.get("HOME");
  if (!homeDir) {
    throw new Error("HOME environment variable not set");
  }

  const profilePath = `${homeDir}/.profile`;
  let profileContent = "";

  try {
    profileContent = await Deno.readTextFile(profilePath);
  } catch {
    logger.info("Creating new .profile file");
  }

  let modified = false;
  for (const envVar of envVars) {
    if (!profileContent.includes(envVar)) {
      profileContent += `\n# OBS screen capture fix\nexport ${envVar}\n`;
      modified = true;
    }
  }

  if (modified) {
    await Deno.writeTextFile(profilePath, profileContent);
    logger.success("Environment variables added to ~/.profile");
    logger.info("Please log out and back in for changes to take effect");
  }

  // Create a wrapper script for OBS
  const wrapperScript = `#!/bin/bash
# OBS wrapper script with capture fixes

export OBS_USE_EGL=1
export QT_QPA_PLATFORM=xcb
export GDK_BACKEND=x11

# For NVIDIA GPUs
if command -v nvidia-smi &> /dev/null; then
    export __GL_SYNC_TO_VBLANK=0
    export __GL_YIELD="NOTHING"
fi

# Launch OBS with proper permissions
exec /usr/bin/obs "$@"
`;

  const wrapperPath = `${homeDir}/.local/bin/obs-wrapper`;
  await Deno.mkdir(`${homeDir}/.local/bin`, { recursive: true });
  await Deno.writeTextFile(wrapperPath, wrapperScript);
  await Deno.chmod(wrapperPath, 0o755);

  logger.success(`OBS wrapper created at ${wrapperPath}`);

  // Update the alias to use the wrapper
  const zshrcPath = `${homeDir}/.zshrc`;
  try {
    let zshrcContent = await Deno.readTextFile(zshrcPath);

    // Remove old alias if exists
    zshrcContent = zshrcContent.replace(/alias obs=.*/g, "");

    // Add new alias
    if (!zshrcContent.includes("obs-wrapper")) {
      zshrcContent +=
        `\n# OBS with screen capture fixes\nalias obs="${wrapperPath} --profile 'Screencast' --disable-updater"\n`;
      await Deno.writeTextFile(zshrcPath, zshrcContent);
      logger.success("Updated obs alias in ~/.zshrc");
    }
  } catch {
    logger.warn("Could not update .zshrc");
  }

  // Check for required packages
  logger.info("Checking for required packages...");
  const packages = [
    "libxcomposite1",
    "libxss1",
    "libxtst6",
    "libxrandr2",
    "libxinerama1",
    "libxcursor1",
    "pipewire",
    "pipewire-pulse",
    "wireplumber",
  ];

  logger.info("Required packages for screen capture:");
  for (const pkg of packages) {
    const result = await runCommand(["dpkg", "-l", pkg]);
    if (result.success && result.stdout.includes("ii")) {
      logger.success(`✓ ${pkg} installed`);
    } else {
      logger.warn(
        `✗ ${pkg} not installed - install with: sudo apt-get install ${pkg}`,
      );
    }
  }

  // Test X11 capture availability
  const x11Test = await runCommand(["xdpyinfo"]);
  if (x11Test.success) {
    logger.success("X11 display server is accessible");
  } else {
    logger.warn("X11 display server may not be accessible");
    logger.info("Install xorg-x11-utils: sudo apt-get install x11-utils");
  }

  logger.info("\n=== Next Steps ===");
  logger.info("1. Install any missing packages listed above");
  logger.info("2. Log out and back in (or run: source ~/.profile)");
  logger.info("3. Launch OBS with: obs");
  logger.info("4. When adding Screen Capture:");
  logger.info("   - Try 'Screen Capture (XSHM)' if PipeWire fails");
  logger.info("   - Grant permission when prompted");
  logger.info("   - Select your monitor from the dropdown");

  if (sessionType === "wayland") {
    logger.info("\n=== Wayland Users ===");
    logger.info("For best results, switch to X11:");
    logger.info("1. Log out");
    logger.info("2. Click gear icon on login screen");
    logger.info("3. Select 'Ubuntu on Xorg'");
  }
}

if (import.meta.main) {
  try {
    await fixOBSCapture();
  } catch (error) {
    logger.error(`Failed to fix OBS capture: ${error}`);
    Deno.exit(1);
  }
}

export { fixOBSCapture };
