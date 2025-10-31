#!/usr/bin/env -S deno run --allow-all

/**
 * Find DaVinci Resolve installer files
 */

import { logger } from "../lib/logger.ts";
import { existsSync } from "https://deno.land/std@0.208.0/fs/mod.ts";

async function findInstallers(): Promise<void> {
  logger.info("Searching for DaVinci Resolve installers...\n");

  // Common download locations
  const searchPaths = [
    `${Deno.env.get("HOME")}/Downloads`,
    `${Deno.env.get("HOME")}/Documents`,
    `${Deno.env.get("HOME")}/Desktop`,
    `${Deno.env.get("HOME")}`,
    "/tmp",
    "/var/tmp",
  ];

  const installers: string[] = [];

  for (const basePath of searchPaths) {
    if (!existsSync(basePath)) continue;

    try {
      // Use find command to search for installers
      const findProc = new Deno.Command("find", {
        args: [
          basePath,
          "-maxdepth",
          "2",
          "-type",
          "f",
          "(",
          "-name",
          "*DaVinci*.run",
          "-o",
          "-name",
          "*DaVinci*.zip",
          "-o",
          "-name",
          "*Resolve*.run",
          "-o",
          "-name",
          "*Resolve*.zip",
          ")",
          "-ls",
        ],
        stdout: "piped",
        stderr: "null",
      });

      const { stdout } = await findProc.output();
      const output = new TextDecoder().decode(stdout);

      if (output.trim()) {
        const lines = output.trim().split("\n");
        for (const line of lines) {
          // Extract filename from ls output
          const parts = line.split(/\s+/);
          const filename = parts[parts.length - 1];
          if (filename) {
            installers.push(filename);

            // Get file info
            const stat = await Deno.stat(filename).catch(() => null);
            if (stat) {
              const sizeMB = (stat.size / 1024 / 1024).toFixed(2);
              const date = stat.mtime?.toLocaleDateString();

              // Try to determine version from filename
              const versionMatch = filename.match(/(\d+\.\d+(?:\.\d+)?)/);
              const version = versionMatch ? versionMatch[1] : "unknown";

              logger.success(`Found: ${filename}`);
              logger.info(`  Version: ${version}`);
              logger.info(`  Size: ${sizeMB} MB`);
              logger.info(`  Date: ${date}`);
            }
          }
        }
      }
    } catch {
      // Ignore errors from inaccessible directories
    }
  }

  if (installers.length === 0) {
    logger.warn("No DaVinci Resolve installers found");
    logger.info("\nYou can download previous versions from:");
    logger.info(
      "https://www.blackmagicdesign.com/support/family/davinci-resolve-and-fusion",
    );
    logger.info(
      "\nLook for version 20.0 or 20.0.1 which should work with Ubuntu 24.04",
    );
  } else {
    logger.info(`\nFound ${installers.length} installer(s)`);

    // Check for 20.0.x versions
    const compatible = installers.filter((f) =>
      f.includes("20.0") && !f.includes("20.1")
    );

    if (compatible.length > 0) {
      logger.success("\nCompatible version found!");
      logger.info("To reinstall the working version:");
      logger.info(
        `1. Uninstall current version: sudo /opt/resolve/bin/uninstall.sh`,
      );
      logger.info(`2. Install compatible version: sudo ${compatible[0]}`);
    }
  }
}

// Main
if (import.meta.main) {
  await findInstallers();
}
