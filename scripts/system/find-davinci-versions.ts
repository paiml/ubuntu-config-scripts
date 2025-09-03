#!/usr/bin/env -S deno run --allow-all

/**
 * Find all DaVinci Resolve installations on the system
 */

import { logger } from "../lib/logger.ts";
import { existsSync } from "https://deno.land/std@0.208.0/fs/mod.ts";

async function findDaVinciInstallations(): Promise<void> {
  logger.info("Searching for DaVinci Resolve installations...\n");

  // Common installation paths
  const searchPaths = [
    "/opt/resolve",
    "/opt/resolve-19",
    "/opt/resolve-20",
    "/opt/DaVinciResolve",
    "/usr/local/bin/resolve",
    "/usr/bin/resolve",
  ];

  // Check each path
  for (const path of searchPaths) {
    if (existsSync(path)) {
      logger.success(`Found: ${path}`);

      // Check for binary
      const binPath = path.includes("bin/resolve")
        ? path
        : `${path}/bin/resolve`;
      if (existsSync(binPath)) {
        logger.info(`  Binary: ${binPath}`);

        // Check file date
        try {
          const stat = await Deno.stat(binPath);
          logger.info(`  Modified: ${stat.mtime?.toISOString()}`);
        } catch {
          // Ignore stat errors
        }
      }
    }
  }

  // Check for backup directories
  logger.info("\nChecking for backup directories...");

  const backupPaths = [
    "/opt/resolve.bak",
    "/opt/resolve.old",
    "/opt/resolve-backup",
    "/opt/resolve_19",
  ];

  for (const path of backupPaths) {
    if (existsSync(path)) {
      logger.success(`Found backup: ${path}`);
    }
  }

  // Check user configs for version info
  logger.info("\nChecking user configuration...");

  const configPaths = [
    `${Deno.env.get("HOME")}/.local/share/DaVinciResolve`,
    `${Deno.env.get("HOME")}/.config/Blackmagic Design`,
    `${Deno.env.get("HOME")}/.cache/BlackmagicDesign`,
  ];

  for (const path of configPaths) {
    if (existsSync(path)) {
      logger.info(`Config found: ${path}`);

      // Check for version info in configs
      const versionFile = `${path}/version`;
      if (existsSync(versionFile)) {
        try {
          const version = await Deno.readTextFile(versionFile);
          logger.info(`  Version: ${version.trim()}`);
        } catch {
          // Ignore read errors
        }
      }
    }
  }

  // Check if there are multiple desktop entries
  logger.info("\nChecking desktop entries...");

  const desktopPaths = [
    "/usr/share/applications/com.blackmagicdesign.resolve.desktop",
    "/usr/share/applications/davinci-resolve.desktop",
    "/usr/share/applications/DaVinciResolve.desktop",
    `${Deno.env.get("HOME")}/.local/share/applications/davinci-resolve.desktop`,
  ];

  for (const path of desktopPaths) {
    if (existsSync(path)) {
      logger.info(`Desktop entry: ${path}`);

      // Read the Exec line to see what it launches
      try {
        const content = await Deno.readTextFile(path);
        const execLine = content.split("\n").find((line) =>
          line.startsWith("Exec=")
        );
        if (execLine) {
          logger.info(`  Launches: ${execLine.substring(5)}`);
        }
      } catch {
        // Ignore read errors
      }
    }
  }

  // Check for wrapper scripts
  logger.info("\nChecking for wrapper scripts...");

  const wrapperPaths = [
    "/usr/local/bin/davinci-resolve",
    "/usr/local/bin/davinci-resolve-fixed",
    "/usr/local/bin/davinci-resolve-20",
    "/usr/local/bin/davinci-isolated",
    "/usr/bin/davinci-resolve",
  ];

  for (const path of wrapperPaths) {
    if (existsSync(path)) {
      logger.info(`Wrapper script: ${path}`);

      // Check what it actually runs
      try {
        const content = await Deno.readTextFile(path);
        const execLine = content.split("\n").find((line) =>
          line.includes("/opt/resolve") || line.includes("exec ")
        );
        if (execLine) {
          logger.info(`  Executes: ${execLine.trim()}`);
        }
      } catch {
        // Ignore read errors
      }
    }
  }
}

// Main
if (import.meta.main) {
  await findDaVinciInstallations();
}
