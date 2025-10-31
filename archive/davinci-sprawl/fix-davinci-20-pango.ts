#!/usr/bin/env -S deno run --allow-all

/**
 * Fix DaVinci Resolve 20.1 pango library symbol error
 * This script creates an isolated library environment to prevent conflicts
 */

import { logger } from "../lib/logger.ts";
import { existsSync } from "https://deno.land/std@0.208.0/fs/mod.ts";
import { ensureDir } from "https://deno.land/std@0.224.0/fs/mod.ts";

class DaVinciPangoFixer {
  private readonly resolvePath = "/opt/resolve";
  private readonly isolatedLibsPath = "/opt/resolve/libs_isolated";
  private readonly resolveExe = "/opt/resolve/bin/resolve";

  async createIsolatedLibraryEnvironment(): Promise<void> {
    logger.info("Creating isolated library environment for DaVinci Resolve...");

    // Create isolated libs directory
    await ensureDir(this.isolatedLibsPath);

    // List of essential system libraries that DaVinci needs but doesn't bundle
    const essentialSystemLibs = [
      // X11 and display libraries
      "libX11.so*",
      "libXext.so*",
      "libXrender.so*",
      "libXrandr.so*",
      "libXi.so*",
      "libXfixes.so*",
      "libXcursor.so*",
      "libXinerama.so*",
      "libxcb*.so*",

      // OpenGL/Mesa
      "libGL.so*",
      "libGLX.so*",
      "libEGL.so*",

      // NVIDIA
      "libnvidia*.so*",
      "libcuda*.so*",

      // Core system libraries
      "libc.so*",
      "libm.so*",
      "libdl.so*",
      "libpthread.so*",
      "librt.so*",
      "libresolv.so*",

      // ALSA for audio
      "libasound.so*",

      // Basic dependencies
      "libz.so*",
      "libbz2.so*",
      "libexpat.so*",
    ];

    logger.info("Copying essential system libraries...");

    // Copy essential libraries from system to isolated directory
    const systemLibPaths = [
      "/usr/lib/x86_64-linux-gnu",
      "/lib/x86_64-linux-gnu",
      "/usr/lib/nvidia",
    ];

    for (const libPattern of essentialSystemLibs) {
      for (const libPath of systemLibPaths) {
        try {
          const proc = new Deno.Command("bash", {
            args: [
              "-c",
              `find ${libPath} -maxdepth 1 -name "${libPattern}" -type f,l 2>/dev/null | head -5`,
            ],
            stdout: "piped",
            stderr: "null",
          });

          const { stdout } = await proc.output();
          const files = new TextDecoder().decode(stdout).trim().split("\n")
            .filter((f) => f);

          for (const file of files) {
            if (file) {
              const fileName = file.split("/").pop();
              const destPath = `${this.isolatedLibsPath}/${fileName}`;

              // Copy file, preserving symlinks
              const cpProc = new Deno.Command("sudo", {
                args: ["cp", "-P", file, destPath],
                stdout: "null",
                stderr: "null",
              });
              await cpProc.output();
            }
          }
        } catch {
          // Some patterns might not match, that's ok
        }
      }
    }

    logger.success("Isolated library environment created");
  }

  async createLauncherScript(): Promise<void> {
    logger.info("Creating fixed launcher script...");

    const launcherContent = `#!/bin/bash
# DaVinci Resolve 20.1 - Isolated Library Environment Launcher
# This script prevents pango symbol errors by using an isolated library environment

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

# Disable optional features
export RESOLVE_CUDA_FORCE=0
export RESOLVE_SKIP_VST_SCAN=1
export QT_LOGGING_RULES="*=false"

# CRITICAL: Use only DaVinci's bundled libraries + isolated essential system libs
# This prevents the pango symbol error by avoiding the system pango library
export LD_LIBRARY_PATH="/opt/resolve/libs:/opt/resolve/bin:/opt/resolve/libs_isolated"

# Debug: Show which libraries will be used
if [ "\$DEBUG" = "1" ]; then
    echo "LD_LIBRARY_PATH: \$LD_LIBRARY_PATH"
    echo "Checking for pango library..."
    ldd /opt/resolve/bin/resolve 2>/dev/null | grep pango || true
fi

# Launch DaVinci Resolve
exec /opt/resolve/bin/resolve "\$@"
`;

    const scriptPath = "/usr/local/bin/davinci-resolve-fixed";

    // Write the script
    await Deno.writeTextFile("/tmp/davinci-launcher.sh", launcherContent);

    // Move to system location with sudo
    const mvProc = new Deno.Command("sudo", {
      args: ["mv", "/tmp/davinci-launcher.sh", scriptPath],
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

    logger.success(`Launcher created at ${scriptPath}`);
  }

  async movePangoLibraries(): Promise<void> {
    logger.info("Moving problematic pango libraries out of the way...");

    const pangoLibs = [
      "/usr/lib/x86_64-linux-gnu/libpango-1.0.so.0",
      "/usr/lib/x86_64-linux-gnu/libpangocairo-1.0.so.0",
      "/usr/lib/x86_64-linux-gnu/libpangoft2-1.0.so.0",
    ];

    const backupDir = "/usr/lib/x86_64-linux-gnu/pango-backup";

    // Create backup directory
    const mkdirProc = new Deno.Command("sudo", {
      args: ["mkdir", "-p", backupDir],
      stdout: "null",
      stderr: "null",
    });
    await mkdirProc.output();

    for (const lib of pangoLibs) {
      if (existsSync(lib)) {
        const libName = lib.split("/").pop();
        const backupPath = `${backupDir}/${libName}`;

        logger.info(`Moving ${lib} to backup...`);

        // Move the library
        const mvProc = new Deno.Command("sudo", {
          args: ["mv", lib, backupPath],
          stdout: "null",
          stderr: "null",
        });

        try {
          await mvProc.output();
          logger.success(`Moved ${libName} to backup`);
        } catch (error) {
          logger.warn(`Could not move ${libName}`, { error });
        }
      }
    }
  }

  async restorePangoLibraries(): Promise<void> {
    logger.info("Restoring pango libraries...");

    const backupDir = "/usr/lib/x86_64-linux-gnu/pango-backup";

    if (!existsSync(backupDir)) {
      logger.info("No backup found, nothing to restore");
      return;
    }

    const lsProc = new Deno.Command("ls", {
      args: [backupDir],
      stdout: "piped",
      stderr: "null",
    });

    const { stdout } = await lsProc.output();
    const files = new TextDecoder().decode(stdout).trim().split("\n").filter(
      (f) => f,
    );

    for (const file of files) {
      const sourcePath = `${backupDir}/${file}`;
      const destPath = `/usr/lib/x86_64-linux-gnu/${file}`;

      const mvProc = new Deno.Command("sudo", {
        args: ["mv", sourcePath, destPath],
        stdout: "null",
        stderr: "null",
      });

      try {
        await mvProc.output();
        logger.success(`Restored ${file}`);
      } catch (error) {
        logger.warn(`Could not restore ${file}`, { error });
      }
    }

    // Remove backup directory
    const rmdirProc = new Deno.Command("sudo", {
      args: ["rmdir", backupDir],
      stdout: "null",
      stderr: "null",
    });
    await rmdirProc.output();
  }

  async apply(): Promise<void> {
    logger.info("Applying comprehensive pango fix for DaVinci Resolve 20.1...");

    // Check if DaVinci is installed
    if (!existsSync(this.resolveExe)) {
      throw new Error("DaVinci Resolve not found at /opt/resolve/bin/resolve");
    }

    // Create isolated library environment
    await this.createIsolatedLibraryEnvironment();

    // Create launcher script
    await this.createLauncherScript();

    // Option to move pango libraries (more aggressive)
    const aggressive = Deno.args.includes("--aggressive");
    if (aggressive) {
      await this.movePangoLibraries();
      logger.warn("Pango libraries moved. This may affect other applications!");
      logger.info("Run with --restore to restore pango libraries");
    }

    logger.success("Pango fix applied successfully!");
    logger.info("Launch DaVinci Resolve with: davinci-resolve-fixed");
    logger.info("Or use: make system-davinci-20-fixed");
  }
}

// Main execution
if (import.meta.main) {
  const fixer = new DaVinciPangoFixer();

  try {
    if (Deno.args.includes("--restore")) {
      await fixer.restorePangoLibraries();
    } else {
      await fixer.apply();
    }
  } catch (error) {
    logger.error("Failed to apply pango fix", { error });
    Deno.exit(1);
  }
}
