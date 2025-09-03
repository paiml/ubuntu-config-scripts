#!/usr/bin/env -S deno run --allow-all

/**
 * Check DaVinci Resolve installation and version
 */

import { logger } from "../lib/logger.ts";
import { existsSync } from "https://deno.land/std@0.208.0/fs/mod.ts";

async function checkInstallation(): Promise<void> {
  logger.info("Checking DaVinci Resolve installation...");

  const resolvePath = "/opt/resolve/bin/resolve";

  if (!existsSync(resolvePath)) {
    logger.error("DaVinci Resolve not found at /opt/resolve");
    return;
  }

  // Check version from the installation
  logger.info("Checking version information...");

  // Look for version in various places
  const versionFiles = [
    "/opt/resolve/version.txt",
    "/opt/resolve/VERSION",
    "/opt/resolve/.version",
    "/opt/resolve/docs/VERSION",
  ];

  for (const file of versionFiles) {
    if (existsSync(file)) {
      try {
        const version = await Deno.readTextFile(file);
        logger.info(`Version from ${file}: ${version.trim()}`);
      } catch {
        // Ignore read errors
      }
    }
  }

  // Check library dependencies
  logger.info("\nChecking library dependencies...");

  const lddProc = new Deno.Command("ldd", {
    args: [resolvePath],
    stdout: "piped",
    stderr: "piped",
  });

  const { stdout } = await lddProc.output();
  const deps = new TextDecoder().decode(stdout);

  // Check for missing libraries
  const lines = deps.split("\n");
  const missingLibs = lines.filter((line) => line.includes("not found"));

  if (missingLibs.length > 0) {
    logger.error("Missing libraries:");
    missingLibs.forEach((lib) => logger.error(`  ${lib.trim()}`));

    logger.info("\nSuggested fixes:");

    if (missingLibs.some((lib) => lib.includes("libcudart.so.11"))) {
      logger.info("- CUDA 11 library missing. Create symlink:");
      logger.info(
        "  sudo ln -sf /usr/lib/x86_64-linux-gnu/libcudart.so.12 /usr/lib/x86_64-linux-gnu/libcudart.so.11.0",
      );
    }

    if (missingLibs.some((lib) => lib.includes("libOpenEXR"))) {
      logger.info("- OpenEXR library missing. Install:");
      logger.info("  sudo apt-get install libopenexr-dev");
    }

    if (missingLibs.some((lib) => lib.includes("pango"))) {
      logger.info("- Pango library issues detected");
      logger.info("  This is a known issue with DaVinci 20.1 on Ubuntu 24");
    }
  } else {
    logger.success("All library dependencies are satisfied");
  }

  // Check if it's actually executable
  logger.info("\nTrying to get version directly...");

  try {
    const versionProc = new Deno.Command(resolvePath, {
      args: ["--version"],
      stdout: "piped",
      stderr: "piped",
      env: {
        ...Deno.env.toObject(),
        LD_LIBRARY_PATH: "/opt/resolve/libs:/opt/resolve/bin",
      },
    });

    const { stdout: vOut, stderr: vErr } = await versionProc.output();
    const versionOut = new TextDecoder().decode(vOut);
    const versionErr = new TextDecoder().decode(vErr);

    if (versionOut) {
      logger.info(`Version output: ${versionOut}`);
    }
    if (versionErr) {
      logger.warn(`Version errors: ${versionErr}`);
    }
  } catch (error) {
    logger.error("Could not run version check", { error });
  }

  // Check apt for installed version
  logger.info("\nChecking apt package info...");

  const dpkgProc = new Deno.Command("dpkg", {
    args: ["-l"],
    stdout: "piped",
  });

  const { stdout: dpkgOut } = await dpkgProc.output();
  const packages = new TextDecoder().decode(dpkgOut);
  const davinciLine = packages.split("\n").find((line) =>
    line.includes("davinci") || line.includes("resolve")
  );

  if (davinciLine) {
    logger.info(`Package info: ${davinciLine.trim()}`);
  }
}

// Main
if (import.meta.main) {
  await checkInstallation();
}
