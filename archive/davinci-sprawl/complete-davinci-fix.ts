#!/usr/bin/env -S deno run --allow-all

/**
 * Complete fix for DaVinci Resolve 20.0.1 - downloads ALL needed compatible libraries
 */

import { logger } from "../lib/logger.ts";
import { ensureDir } from "https://deno.land/std@0.224.0/fs/mod.ts";
import { existsSync } from "https://deno.land/std@0.208.0/fs/mod.ts";

async function downloadAndExtract(pkg: {name: string, url: string}, targetDir: string): Promise<boolean> {
  const debPath = `/tmp/${pkg.name}.deb`;
  
  logger.info(`Downloading ${pkg.name}...`);
  
  // Download
  const wgetProc = new Deno.Command("wget", {
    args: ["-q", "-O", debPath, pkg.url],
    stdout: "null",
    stderr: "null",
  });
  
  const result = await wgetProc.output();
  if (!result.success) {
    logger.warn(`Failed to download ${pkg.name}`);
    return false;
  }

  // Extract
  const extractProc = new Deno.Command("bash", {
    args: [
      "-c",
      `cd /tmp && ar x ${pkg.name}.deb && tar -xf data.tar.* 2>/dev/null || tar -xf data.tar.xz`,
    ],
    stdout: "null",
    stderr: "null",
  });
  await extractProc.output();

  // Copy libraries
  const copyProc = new Deno.Command("bash", {
    args: [
      "-c",
      `cp -P /tmp/usr/lib/x86_64-linux-gnu/*.so* ${targetDir}/ 2>/dev/null || true`,
    ],
    stdout: "null",
    stderr: "null",
  });
  await copyProc.output();

  // Cleanup
  await Deno.remove(debPath).catch(() => {});
  
  return true;
}

async function setupCompleteFix(): Promise<void> {
  logger.info("Setting up COMPLETE fix for DaVinci Resolve 20.0.1...");
  
  // Create test directory first (no sudo needed)
  const testDir = `${Deno.env.get("HOME")}/.local/share/davinci-libs`;
  await ensureDir(testDir);

  // Complete list of compatible libraries from Ubuntu 22.04
  const packages = [
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
    // GDK Pixbuf (the missing piece!)
    {
      name: "libgdk-pixbuf-2.0-0",
      url: "http://archive.ubuntu.com/ubuntu/pool/main/g/gdk-pixbuf/libgdk-pixbuf-2.0-0_2.42.8+dfsg-1ubuntu0.3_amd64.deb",
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
    // HarfBuzz
    {
      name: "libharfbuzz0b",
      url: "http://archive.ubuntu.com/ubuntu/pool/main/h/harfbuzz/libharfbuzz0b_2.7.4-1ubuntu3.1_amd64.deb",
    },
    // FriBidi
    {
      name: "libfribidi0",
      url: "http://archive.ubuntu.com/ubuntu/pool/main/f/fribidi/libfribidi0_1.0.8-2ubuntu3.1_amd64.deb",
    },
    // Fontconfig
    {
      name: "libfontconfig1",
      url: "http://archive.ubuntu.com/ubuntu/pool/main/f/fontconfig/libfontconfig1_2.13.1-4.2ubuntu5_amd64.deb",
    },
    // FreeType
    {
      name: "libfreetype6",
      url: "http://archive.ubuntu.com/ubuntu/pool/main/f/freetype/libfreetype6_2.11.1+dfsg-1ubuntu0.2_amd64.deb",
    },
    // Pixman
    {
      name: "libpixman-1-0",
      url: "http://archive.ubuntu.com/ubuntu/pool/main/p/pixman/libpixman-1-0_0.40.0-1ubuntu0.22.04.1_amd64.deb",
    },
  ];

  for (const pkg of packages) {
    await downloadAndExtract(pkg, testDir);
  }

  // Clean up tmp files
  const cleanupProc = new Deno.Command("bash", {
    args: ["-c", "rm -rf /tmp/usr /tmp/control.tar.* /tmp/data.tar.* /tmp/debian-binary 2>/dev/null"],
    stdout: "null",
    stderr: "null",
  });
  await cleanupProc.output();

  // Create test launcher
  const launcherContent = `#!/bin/bash
# DaVinci Resolve 20.0.1 - Complete Fix
# Uses ALL compatible libraries from isolated directory

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

# Use DaVinci's glib + our complete set of compatible libs
# This should have EVERYTHING needed
export LD_LIBRARY_PATH="/opt/resolve/libs:${testDir}:/opt/resolve/bin:/usr/lib/nvidia"

# Launch
exec /opt/resolve/bin/resolve "\$@"
`;

  const testLauncherPath = `${Deno.env.get("HOME")}/davinci-test.sh`;
  await Deno.writeTextFile(testLauncherPath, launcherContent);
  
  const chmodProc = new Deno.Command("chmod", {
    args: ["+x", testLauncherPath],
    stdout: "null",
    stderr: "null",
  });
  await chmodProc.output();

  logger.success(`Complete fix prepared!`);
  logger.info("");
  logger.info("TEST the launcher (no sudo needed):");
  logger.info(`  ${testLauncherPath}`);
  logger.info("");
  logger.info("If it works, install system-wide with:");
  logger.info(`  sudo cp ${testLauncherPath} /usr/local/bin/davinci-resolve`);
  logger.info(`  sudo mkdir -p /opt/resolve/libs_compat`);
  logger.info(`  sudo cp -r ${testDir}/* /opt/resolve/libs_compat/`);
}

// Main
if (import.meta.main) {
  try {
    await setupCompleteFix();
  } catch (error) {
    logger.error("Setup failed", { error });
    Deno.exit(1);
  }
}