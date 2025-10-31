#!/usr/bin/env -S deno run --allow-all

/**
 * Final fix for DaVinci Resolve 20.1 - Downloads and uses compatible libraries
 */

import { logger } from "../lib/logger.ts";
import { existsSync } from "https://deno.land/std@0.208.0/fs/mod.ts";
import { ensureDir } from "https://deno.land/std@0.224.0/fs/mod.ts";

class DaVinciFinalFix {
  private readonly compatLibsPath = "/opt/resolve/libs_compat";

  async downloadCompatibleLibraries(): Promise<void> {
    logger.info("Downloading compatible libraries for DaVinci Resolve 20.1...");

    await ensureDir(this.compatLibsPath);

    // Download Ubuntu 22.04 (Jammy) packages which have compatible versions
    const packages = [
      {
        name: "libglib2.0-0",
        url: "http://archive.ubuntu.com/ubuntu/pool/main/g/glib2.0/libglib2.0-0_2.72.4-0ubuntu2.3_amd64.deb",
      },
      {
        name: "libpango-1.0-0", 
        url: "http://archive.ubuntu.com/ubuntu/pool/main/p/pango1.0/libpango-1.0-0_1.50.6+ds-2ubuntu1_amd64.deb",
      },
      {
        name: "libpangocairo-1.0-0",
        url: "http://archive.ubuntu.com/ubuntu/pool/main/p/pango1.0/libpangocairo-1.0-0_1.50.6+ds-2ubuntu1_amd64.deb",
      },
      {
        name: "libpangoft2-1.0-0",
        url: "http://archive.ubuntu.com/ubuntu/pool/main/p/pango1.0/libpangoft2-1.0-0_1.50.6+ds-2ubuntu1_amd64.deb",
      },
      {
        name: "libharfbuzz0b",
        url: "http://archive.ubuntu.com/ubuntu/pool/main/h/harfbuzz/libharfbuzz0b_2.7.4-1ubuntu3.1_amd64.deb",
      },
      {
        name: "libfribidi0",
        url: "http://archive.ubuntu.com/ubuntu/pool/main/f/fribidi/libfribidi0_1.0.8-2.1ubuntu1_amd64.deb",
      },
    ];

    for (const pkg of packages) {
      logger.info(`Downloading ${pkg.name}...`);
      
      const debPath = `/tmp/${pkg.name}.deb`;
      
      // Download the package
      const wgetProc = new Deno.Command("wget", {
        args: ["-q", "-O", debPath, pkg.url],
        stdout: "inherit",
        stderr: "inherit",
      });
      
      const result = await wgetProc.output();
      if (!result.success) {
        logger.error(`Failed to download ${pkg.name}`);
        continue;
      }

      // Extract the package
      logger.info(`Extracting ${pkg.name}...`);
      const extractProc = new Deno.Command("bash", {
        args: [
          "-c",
          `cd /tmp && ar x ${pkg.name}.deb && tar -xf data.tar.* 2>/dev/null || tar -xf data.tar`,
        ],
        stdout: "null",
        stderr: "null",
      });
      await extractProc.output();

      // Copy libraries to compat directory
      const copyProc = new Deno.Command("bash", {
        args: [
          "-c",
          `sudo cp -P /tmp/usr/lib/x86_64-linux-gnu/*.so* ${this.compatLibsPath}/ 2>/dev/null || true`,
        ],
        stdout: "null",
        stderr: "null",
      });
      await copyProc.output();

      // Cleanup
      await Deno.remove(debPath).catch(() => {});
    }

    // Clean up extracted files
    const cleanupProc = new Deno.Command("bash", {
      args: ["-c", "rm -rf /tmp/usr /tmp/control.tar.* /tmp/data.tar.* /tmp/debian-binary 2>/dev/null"],
      stdout: "null",
      stderr: "null",
    });
    await cleanupProc.output();

    logger.success("Compatible libraries downloaded");
  }

  async createFinalLauncher(): Promise<void> {
    logger.info("Creating final launcher script...");

    const launcherContent = `#!/bin/bash
# DaVinci Resolve 20.1 - Final Working Launcher
# Uses compatible libraries from Ubuntu 22.04

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

# Use compatible libraries, then DaVinci's libraries, then minimal system libs
export LD_LIBRARY_PATH="/opt/resolve/libs_compat:/opt/resolve/libs:/opt/resolve/bin:/usr/lib/x86_64-linux-gnu:/usr/lib/nvidia"

# Launch DaVinci Resolve
exec /opt/resolve/bin/resolve "\$@"
`;

    const scriptPath = "/usr/local/bin/davinci-resolve-20";
    
    // Write the script
    await Deno.writeTextFile("/tmp/davinci-launcher-final.sh", launcherContent);
    
    // Move to system location with sudo
    const mvProc = new Deno.Command("sudo", {
      args: ["mv", "/tmp/davinci-launcher-final.sh", scriptPath],
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

    // Also update the existing fixed script
    const cpProc = new Deno.Command("sudo", {
      args: ["cp", scriptPath, "/usr/local/bin/davinci-resolve-fixed"],
      stdout: "inherit",
      stderr: "inherit",
    });
    await cpProc.output();

    logger.success(`Launcher created at ${scriptPath}`);
  }

  async fixOpenEXR(): Promise<void> {
    logger.info("Creating OpenEXR symlink...");
    
    // Find existing OpenEXR library
    const findProc = new Deno.Command("bash", {
      args: ["-c", "ls /usr/lib/x86_64-linux-gnu/libOpenEXR*.so* 2>/dev/null | head -1"],
      stdout: "piped",
    });
    
    const { stdout } = await findProc.output();
    const existingLib = new TextDecoder().decode(stdout).trim();
    
    if (existingLib) {
      // Create symlink for version 32
      const linkProc = new Deno.Command("sudo", {
        args: ["ln", "-sf", existingLib, "/usr/lib/x86_64-linux-gnu/libOpenEXRCore.so.32"],
        stdout: "inherit",
        stderr: "inherit",
      });
      await linkProc.output();
      logger.success("OpenEXR symlink created");
    } else {
      logger.warn("OpenEXR library not found, skipping");
    }
  }

  async fixCudaSymlink(): Promise<void> {
    logger.info("Ensuring CUDA 11 compatibility symlink...");
    
    const symlinkPath = "/usr/lib/x86_64-linux-gnu/libcudart.so.11.0";
    
    if (!existsSync(symlinkPath)) {
      const linkProc = new Deno.Command("sudo", {
        args: ["ln", "-sf", "/usr/lib/x86_64-linux-gnu/libcudart.so.12", symlinkPath],
        stdout: "inherit",
        stderr: "inherit",
      });
      await linkProc.output();
      logger.success("CUDA symlink created");
    } else {
      logger.info("CUDA symlink already exists");
    }
  }

  async restorePangoIfNeeded(): Promise<void> {
    // First restore pango libraries if they were moved
    const backupDir = "/usr/lib/x86_64-linux-gnu/pango-backup";
    if (existsSync(backupDir)) {
      logger.info("Restoring system pango libraries...");
      const restoreProc = new Deno.Command("sudo", {
        args: ["/home/noah/.local/bin/deno", "run", "--allow-all", "scripts/system/fix-davinci-20-pango.ts", "--restore"],
        stdout: "inherit",
        stderr: "inherit",
      });
      await restoreProc.output();
    }
  }

  async apply(): Promise<void> {
    logger.info("Applying final comprehensive fix for DaVinci Resolve 20.1...");

    // Restore pango if it was moved
    await this.restorePangoIfNeeded();

    // Download compatible libraries
    await this.downloadCompatibleLibraries();

    // Fix CUDA symlink
    await this.fixCudaSymlink();

    // Fix OpenEXR
    await this.fixOpenEXR();

    // Create final launcher
    await this.createFinalLauncher();

    logger.success("Final fix applied successfully!");
    logger.info("Launch DaVinci Resolve with: davinci-resolve-20");
    logger.info("Or use: make system-davinci-20-run");
  }
}

// Main execution
if (import.meta.main) {
  const fixer = new DaVinciFinalFix();
  
  try {
    await fixer.apply();
  } catch (error) {
    logger.error("Failed to apply final fix", { error });
    Deno.exit(1);
  }
}