#!/usr/bin/env -S deno run --allow-all

/**
 * Install dependencies for DaVinci Resolve 20.0.1
 */

import { logger } from "../lib/logger.ts";

async function installDependencies(): Promise<void> {
  logger.info("Installing dependencies for DaVinci Resolve 20.0.1...");

  const packages = [
    "libapr1",
    "libaprutil1",
    "libasound2",
    "libglib2.0-0",
    "libxcb-xinerama0",
    "libxcb-xinput0",
    "libxcb-cursor0",
  ];

  // Update package list
  logger.info("Updating package list...");
  const updateProc = new Deno.Command("sudo", {
    args: ["apt-get", "update"],
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });
  await updateProc.output();

  // Install packages
  logger.info("Installing required packages...");
  const installProc = new Deno.Command("sudo", {
    args: ["apt-get", "install", "-y", ...packages],
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });

  const result = await installProc.output();

  if (result.success) {
    logger.success("Dependencies installed successfully");

    logger.info("\nNow run the installer:");
    logger.info(
      "SKIP_PACKAGE_CHECK=1 sudo /home/noah/Downloads/DaVinci_Resolve_Studio_20.0.1_Linux/DaVinci_Resolve_Studio_20.0.1_Linux.run",
    );
  } else {
    logger.error("Failed to install some packages");
  }
}

// Main
if (import.meta.main) {
  try {
    await installDependencies();
  } catch (error) {
    logger.error("Installation failed", { error });
    Deno.exit(1);
  }
}
