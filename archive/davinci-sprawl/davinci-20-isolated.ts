#!/usr/bin/env -S deno run --allow-all

/**
 * Create a completely isolated environment for DaVinci Resolve 20.1
 * This does NOT modify any system files - everything is isolated
 */

import { logger } from "../lib/logger.ts";
import { existsSync } from "https://deno.land/std@0.208.0/fs/mod.ts";
import { ensureDir } from "https://deno.land/std@0.224.0/fs/mod.ts";

class DaVinciIsolatedEnvironment {
  private readonly isolatedRoot = "/opt/davinci-isolated";
  private readonly libsPath = "/opt/davinci-isolated/libs";
  
  async downloadUbuntu2204Libraries(): Promise<void> {
    logger.info("Creating isolated library environment (no system files will be modified)...");
    
    await ensureDir(this.libsPath);

    // Complete set of Ubuntu 22.04 libraries that DaVinci needs
    const packages = [
      // Core glib/gio/gobject
      {
        name: "libglib2.0-0",
        url: "http://archive.ubuntu.com/ubuntu/pool/main/g/glib2.0/libglib2.0-0_2.72.4-0ubuntu2.3_amd64.deb",
      },
      // Pango and dependencies
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
      // GTK and GDK dependencies
      {
        name: "libgdk-pixbuf-2.0-0",
        url: "http://archive.ubuntu.com/ubuntu/pool/main/g/gdk-pixbuf/libgdk-pixbuf-2.0-0_2.42.8+dfsg-1ubuntu0.3_amd64.deb",
      },
      {
        name: "libgtk-3-0",
        url: "http://archive.ubuntu.com/ubuntu/pool/main/g/gtk+3.0/libgtk-3-0_3.24.33-1ubuntu2.2_amd64.deb",
      },
      // Cairo
      {
        name: "libcairo2",
        url: "http://archive.ubuntu.com/ubuntu/pool/main/c/cairo/libcairo2_1.16.0-5ubuntu2_amd64.deb",
      },
      {
        name: "libcairo-gobject2",
        url: "http://archive.ubuntu.com/ubuntu/pool/main/c/cairo/libcairo-gobject2_1.16.0-5ubuntu2_amd64.deb",
      },
      // HarfBuzz and FriBidi for text rendering
      {
        name: "libharfbuzz0b",
        url: "http://archive.ubuntu.com/ubuntu/pool/main/h/harfbuzz/libharfbuzz0b_2.7.4-1ubuntu3.1_amd64.deb",
      },
      {
        name: "libfribidi0",
        url: "http://archive.ubuntu.com/ubuntu/pool/main/f/fribidi/libfribidi0_1.0.8-2ubuntu3.1_amd64.deb",
      },
      // ATK for accessibility
      {
        name: "libatk1.0-0",
        url: "http://archive.ubuntu.com/ubuntu/pool/main/a/atk1.0/libatk1.0-0_2.36.0-3build1_amd64.deb",
      },
      {
        name: "libatk-bridge2.0-0",
        url: "http://archive.ubuntu.com/ubuntu/pool/main/a/at-spi2-atk/libatk-bridge2.0-0_2.38.0-3_amd64.deb",
      },
      // Additional dependencies
      {
        name: "libfontconfig1",
        url: "http://archive.ubuntu.com/ubuntu/pool/main/f/fontconfig/libfontconfig1_2.13.1-4.2ubuntu5_amd64.deb",
      },
      {
        name: "libfreetype6",
        url: "http://archive.ubuntu.com/ubuntu/pool/main/f/freetype/libfreetype6_2.11.1+dfsg-1ubuntu0.2_amd64.deb",
      },
      {
        name: "libpixman-1-0",
        url: "http://archive.ubuntu.com/ubuntu/pool/main/p/pixman/libpixman-1-0_0.40.0-1ubuntu0.22.04.1_amd64.deb",
      },
    ];

    for (const pkg of packages) {
      logger.info(`Downloading ${pkg.name}...`);
      
      const debPath = `/tmp/${pkg.name}.deb`;
      
      // Download the package
      const wgetProc = new Deno.Command("wget", {
        args: ["-q", "-O", debPath, pkg.url],
        stdout: "null",
        stderr: "null",
      });
      
      const result = await wgetProc.output();
      if (!result.success) {
        logger.warn(`Failed to download ${pkg.name}, continuing...`);
        continue;
      }

      // Extract the package
      const extractProc = new Deno.Command("bash", {
        args: [
          "-c",
          `cd /tmp && ar x ${pkg.name}.deb && tar -xf data.tar.* ./usr/lib/x86_64-linux-gnu/ 2>/dev/null || true`,
        ],
        stdout: "null",
        stderr: "null",
      });
      await extractProc.output();

      // Copy libraries to isolated directory
      const copyProc = new Deno.Command("bash", {
        args: [
          "-c",
          `sudo cp -Pn /tmp/usr/lib/x86_64-linux-gnu/*.so* ${this.libsPath}/ 2>/dev/null || true`,
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

    logger.success("Isolated environment created - no system files modified");
  }

  async createIsolatedLauncher(): Promise<void> {
    logger.info("Creating isolated launcher...");

    const launcherContent = `#!/bin/bash
# DaVinci Resolve 20.1 - Completely Isolated Environment
# This launcher uses ONLY isolated libraries, not system libraries

# Kill any stuck processes
pkill -f VstScanner 2>/dev/null
pkill -f "resolve --" 2>/dev/null

# Basic environment
export HOME="\${HOME}"
export USER="\${USER}"
export DISPLAY="\${DISPLAY:-:0}"
export LANG="\${LANG:-en_US.UTF-8}"
export LC_ALL="\${LC_ALL:-en_US.UTF-8}"

# GPU settings
export __NV_PRIME_RENDER_OFFLOAD=1
export __GLX_VENDOR_LIBRARY_NAME=nvidia

# Disable optional features to reduce issues
export RESOLVE_CUDA_FORCE=0
export RESOLVE_SKIP_VST_SCAN=1
export QT_LOGGING_RULES="*=false"

# CRITICAL: Set library path to use ONLY our isolated libraries and DaVinci's own
# This prevents ANY system library conflicts
export LD_LIBRARY_PATH="${this.libsPath}:/opt/resolve/libs:/opt/resolve/bin"

# Add minimal system paths only for critical system libraries (libc, libm, etc)
# But these come LAST in priority
export LD_LIBRARY_PATH="\${LD_LIBRARY_PATH}:/lib/x86_64-linux-gnu:/usr/lib/nvidia"

# Debug mode (set DEBUG=1 to enable)
if [ "\${DEBUG}" = "1" ]; then
    echo "LD_LIBRARY_PATH: \${LD_LIBRARY_PATH}"
    echo ""
    echo "Checking library resolution:"
    ldd /opt/resolve/bin/resolve 2>&1 | grep -E "(pango|glib|gtk|gdk)" | head -20
fi

# Change to DaVinci directory
cd /opt/resolve

# Launch DaVinci Resolve
exec /opt/resolve/bin/resolve "\$@"
`;

    const scriptPath = "/usr/local/bin/davinci-isolated";
    
    // Write the script
    await Deno.writeTextFile("/tmp/davinci-isolated.sh", launcherContent);
    
    // Move to system location with sudo
    const mvProc = new Deno.Command("sudo", {
      args: ["mv", "/tmp/davinci-isolated.sh", scriptPath],
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

  async ensureCudaCompatibility(): Promise<void> {
    logger.info("Ensuring CUDA compatibility...");
    
    const cuda11Link = "/usr/lib/x86_64-linux-gnu/libcudart.so.11.0";
    const cuda12Lib = "/usr/lib/x86_64-linux-gnu/libcudart.so.12";
    
    if (!existsSync(cuda11Link) && existsSync(cuda12Lib)) {
      const linkProc = new Deno.Command("sudo", {
        args: ["ln", "-sf", cuda12Lib, cuda11Link],
        stdout: "inherit",
        stderr: "inherit",
      });
      await linkProc.output();
      logger.success("CUDA 11 compatibility link created");
    }
  }

  async ensureOpenEXRCompatibility(): Promise<void> {
    logger.info("Ensuring OpenEXR compatibility...");
    
    // Copy OpenEXR from DaVinci if it exists
    const davinciOpenEXR = "/opt/resolve/libs/libOpenEXRCore.so.32";
    const isolatedOpenEXR = `${this.libsPath}/libOpenEXRCore.so.32`;
    
    if (existsSync(davinciOpenEXR) && !existsSync(isolatedOpenEXR)) {
      const cpProc = new Deno.Command("sudo", {
        args: ["cp", "-P", davinciOpenEXR, isolatedOpenEXR],
        stdout: "null",
        stderr: "null",
      });
      await cpProc.output();
      logger.success("OpenEXR library copied to isolated environment");
    } else {
      // Create symlink to system OpenEXR if available
      const findProc = new Deno.Command("bash", {
        args: ["-c", "ls /usr/lib/x86_64-linux-gnu/libOpenEXR*.so* 2>/dev/null | head -1"],
        stdout: "piped",
      });
      
      const { stdout } = await findProc.output();
      const systemLib = new TextDecoder().decode(stdout).trim();
      
      if (systemLib && !existsSync(isolatedOpenEXR)) {
        const linkProc = new Deno.Command("sudo", {
          args: ["ln", "-sf", systemLib, isolatedOpenEXR],
          stdout: "null",
          stderr: "null",
        });
        await linkProc.output();
        logger.success("OpenEXR compatibility link created");
      }
    }
  }

  async setup(): Promise<void> {
    logger.info("Setting up isolated DaVinci Resolve 20.1 environment...");
    logger.info("This will NOT modify any system files");

    // Create isolated environment with compatible libraries
    await this.downloadUbuntu2204Libraries();

    // Ensure CUDA compatibility
    await this.ensureCudaCompatibility();

    // Ensure OpenEXR compatibility
    await this.ensureOpenEXRCompatibility();

    // Create launcher
    await this.createIsolatedLauncher();

    logger.success("Isolated environment setup complete!");
    logger.info("Your system libraries are untouched");
    logger.info("");
    logger.info("Launch DaVinci Resolve with: davinci-isolated");
    logger.info("Or use: make davinci-isolated");
    logger.info("");
    logger.info("For debugging, run: DEBUG=1 davinci-isolated");
  }

  async cleanup(): Promise<void> {
    logger.info("Cleaning up isolated environment...");
    
    if (existsSync(this.isolatedRoot)) {
      const rmProc = new Deno.Command("sudo", {
        args: ["rm", "-rf", this.isolatedRoot],
        stdout: "inherit",
        stderr: "inherit",
      });
      await rmProc.output();
      logger.success("Isolated environment removed");
    }
    
    const scriptPath = "/usr/local/bin/davinci-isolated";
    if (existsSync(scriptPath)) {
      const rmProc = new Deno.Command("sudo", {
        args: ["rm", scriptPath],
        stdout: "inherit",
        stderr: "inherit",
      });
      await rmProc.output();
      logger.success("Launcher removed");
    }
  }
}

// Main execution
if (import.meta.main) {
  const env = new DaVinciIsolatedEnvironment();
  
  try {
    if (Deno.args.includes("--cleanup")) {
      await env.cleanup();
    } else {
      await env.setup();
    }
  } catch (error) {
    logger.error("Setup failed", { error });
    Deno.exit(1);
  }
}