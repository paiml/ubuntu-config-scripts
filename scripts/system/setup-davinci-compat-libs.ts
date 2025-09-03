#!/usr/bin/env -S deno run --allow-all

/**
 * Setup compatible libraries for DaVinci Resolve without touching system files
 */

import { logger } from "../lib/logger.ts";
import { ensureDir } from "https://deno.land/std@0.224.0/fs/mod.ts";

async function setupCompatLibs(): Promise<void> {
  logger.info("Setting up compatible libraries for DaVinci Resolve 20.0.1...");

  // Create isolated directory for compatible libs
  const compatDir = "/opt/resolve/libs_compat";
  await ensureDir(compatDir);

  // Download Ubuntu 22.04 pango (compatible with glib 2.68)
  const packages = [
    {
      name: "libpango-1.0-0",
      url:
        "http://archive.ubuntu.com/ubuntu/pool/main/p/pango1.0/libpango-1.0-0_1.50.6+ds-2ubuntu1_amd64.deb",
    },
    {
      name: "libpangocairo-1.0-0",
      url:
        "http://archive.ubuntu.com/ubuntu/pool/main/p/pango1.0/libpangocairo-1.0-0_1.50.6+ds-2ubuntu1_amd64.deb",
    },
    {
      name: "libpangoft2-1.0-0",
      url:
        "http://archive.ubuntu.com/ubuntu/pool/main/p/pango1.0/libpangoft2-1.0-0_1.50.6+ds-2ubuntu1_amd64.deb",
    },
    {
      name: "libharfbuzz0b",
      url:
        "http://archive.ubuntu.com/ubuntu/pool/main/h/harfbuzz/libharfbuzz0b_2.7.4-1ubuntu3.1_amd64.deb",
    },
    {
      name: "libfribidi0",
      url:
        "http://archive.ubuntu.com/ubuntu/pool/main/f/fribidi/libfribidi0_1.0.8-2ubuntu3.1_amd64.deb",
    },
  ];

  for (const pkg of packages) {
    logger.info(`Downloading ${pkg.name}...`);

    const debPath = `/tmp/${pkg.name}.deb`;

    // Download package
    const wgetProc = new Deno.Command("wget", {
      args: ["-q", "-O", debPath, pkg.url],
      stdout: "null",
      stderr: "null",
    });

    const result = await wgetProc.output();
    if (!result.success) {
      logger.warn(`Failed to download ${pkg.name}`);
      continue;
    }

    // Extract package
    logger.info(`Extracting ${pkg.name}...`);
    const extractProc = new Deno.Command("bash", {
      args: [
        "-c",
        `cd /tmp && ar x ${pkg.name}.deb && tar -xf data.tar.* 2>/dev/null || tar -xf data.tar.xz`,
      ],
      stdout: "null",
      stderr: "null",
    });
    await extractProc.output();

    // Copy libraries to compat directory
    const copyProc = new Deno.Command("bash", {
      args: [
        "-c",
        `sudo cp -P /tmp/usr/lib/x86_64-linux-gnu/*.so* ${compatDir}/ 2>/dev/null || true`,
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
    args: [
      "-c",
      "rm -rf /tmp/usr /tmp/control.tar.* /tmp/data.tar.* /tmp/debian-binary 2>/dev/null",
    ],
    stdout: "null",
    stderr: "null",
  });
  await cleanupProc.output();

  // Create launcher that uses these compatible libs
  const launcherContent = `#!/bin/bash
# DaVinci Resolve 20.0.1 - With Compatible Libraries
# Uses isolated compatible libraries, no system modifications

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

# Use DaVinci's bundled libs + our compatible pango libs
# NO system libraries in the path to avoid conflicts
export LD_LIBRARY_PATH="/opt/resolve/libs:/opt/resolve/libs_compat:/opt/resolve/bin:/usr/lib/nvidia"

# Launch
exec /opt/resolve/bin/resolve "\$@"
`;

  await Deno.writeTextFile("/tmp/davinci-launcher.sh", launcherContent);

  // Install launcher
  const mvProc = new Deno.Command("sudo", {
    args: ["mv", "/tmp/davinci-launcher.sh", "/usr/local/bin/davinci-resolve"],
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });
  await mvProc.output();

  const chmodProc = new Deno.Command("sudo", {
    args: ["chmod", "+x", "/usr/local/bin/davinci-resolve"],
    stdout: "inherit",
    stderr: "inherit",
  });
  await chmodProc.output();

  logger.success("Compatible libraries installed in /opt/resolve/libs_compat");
  logger.success("Launcher created!");
  logger.info("");
  logger.info("Your system libraries are untouched!");
  logger.info("Launch DaVinci Resolve with: davinci-resolve");
}

// Main
if (import.meta.main) {
  try {
    await setupCompatLibs();
  } catch (error) {
    logger.error("Setup failed", { error });
    Deno.exit(1);
  }
}
