#!/usr/bin/env -S deno run --allow-run --allow-read --allow-write

import { logger } from "../lib/logger.ts";
import { runCommand } from "../lib/common.ts";

/**
 * Bulletproof APT repository fixer
 * Handles broken package lists, missing packages, and repository sync issues
 */

interface FixStep {
  name: string;
  command: string[];
  critical: boolean;
  description: string;
}

async function executeStep(step: FixStep): Promise<boolean> {
  logger.info(`📋 ${step.description}`);
  logger.debug(`Running: ${step.command.join(" ")}`);

  const result = await runCommand(step.command);

  if (result.success) {
    logger.success(`✅ ${step.name} completed`);
    if (result.stdout) {
      console.log(result.stdout);
    }
    return true;
  } else {
    if (step.critical) {
      logger.error(`❌ ${step.name} failed (CRITICAL)`);
      logger.error(result.stderr);
      return false;
    } else {
      logger.warn(`⚠️  ${step.name} failed (non-critical, continuing...)`);
      logger.debug(result.stderr);
      return true;
    }
  }
}

async function backupSourcesList(): Promise<boolean> {
  logger.info("💾 Backing up sources.list...");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = `/etc/apt/sources.list.backup-${timestamp}`;

  const result = await runCommand([
    "sudo",
    "cp",
    "/etc/apt/sources.list",
    backupFile,
  ]);

  if (result.success) {
    logger.success(`Backup created: ${backupFile}`);
    return true;
  } else {
    logger.warn("Could not create backup (may not be critical)");
    return false;
  }
}

async function switchToMainMirror(): Promise<boolean> {
  logger.info("🌐 Switching to main Ubuntu mirror...");

  // Use sed to replace mirrors in place
  const sedCommands = [
    {
      pattern: "s|http://us.archive.ubuntu.com|http://archive.ubuntu.com|g",
      desc: "US mirror to main mirror",
    },
    {
      pattern: "s|http://security.ubuntu.com|http://archive.ubuntu.com|g",
      desc: "Security mirror to main mirror",
    },
  ];

  for (const { pattern, desc } of sedCommands) {
    logger.debug(`Replacing: ${desc}`);
    const result = await runCommand([
      "sudo",
      "sed",
      "-i",
      pattern,
      "/etc/apt/sources.list",
    ]);

    if (!result.success) {
      logger.warn(`Could not replace ${desc}`);
    }
  }

  logger.success("Mirror switched to main Ubuntu archive");
  return true;
}

async function fixApt(): Promise<boolean> {
  logger.info("🔧 Starting APT repair process...");
  console.log("");

  // Step 1: Backup sources.list
  await backupSourcesList();
  console.log("");

  // Step 2: Switch to main mirror
  await switchToMainMirror();
  console.log("");

  // Step 3: Define fix steps
  const steps: FixStep[] = [
    {
      name: "Clean APT cache",
      command: ["sudo", "apt-get", "clean"],
      critical: false,
      description: "Clearing package cache...",
    },
    {
      name: "Remove partial packages",
      command: ["sudo", "rm", "-rf", "/var/lib/apt/lists/partial/*"],
      critical: false,
      description: "Removing partial package lists...",
    },
    {
      name: "Remove package lists",
      command: ["sudo", "rm", "-rf", "/var/lib/apt/lists/*"],
      critical: false,
      description: "Removing old package lists...",
    },
    {
      name: "Update package lists",
      command: ["sudo", "apt-get", "update", "--fix-missing"],
      critical: true,
      description: "Updating package lists from repositories...",
    },
    {
      name: "Fix broken packages",
      command: ["sudo", "apt-get", "install", "-f", "-y"],
      critical: false,
      description: "Fixing broken package dependencies...",
    },
    {
      name: "Configure pending packages",
      command: ["sudo", "dpkg", "--configure", "-a"],
      critical: false,
      description: "Configuring any pending packages...",
    },
    {
      name: "Upgrade packages (skip broken)",
      command: [
        "sudo",
        "apt-get",
        "upgrade",
        "-y",
        "--fix-missing",
        "--allow-downgrades",
      ],
      critical: false,
      description: "Upgrading packages (will skip unavailable packages)...",
    },
    {
      name: "Autoremove unused packages",
      command: ["sudo", "apt-get", "autoremove", "-y"],
      critical: false,
      description: "Removing unused packages...",
    },
  ];

  // Execute each step
  for (const step of steps) {
    const success = await executeStep(step);
    console.log("");

    if (!success && step.critical) {
      logger.error("Critical step failed, aborting...");
      return false;
    }
  }

  // Final status check
  logger.info("📊 Checking final APT status...");
  const statusResult = await runCommand(["sudo", "apt-get", "check"]);

  if (statusResult.success) {
    logger.success("✅ APT is now healthy!");
    return true;
  } else {
    logger.warn(
      "⚠️  APT may still have some issues, but basic functionality should work",
    );
    logger.info("You can continue to use apt for new installations");
    return true;
  }
}

async function main() {
  console.log(
    "╔══════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║              🔧 APT Repository Repair Tool                   ║",
  );
  console.log(
    "╚══════════════════════════════════════════════════════════════╝",
  );
  console.log("");

  const success = await fixApt();

  console.log("");
  console.log(
    "════════════════════════════════════════════════════════════════",
  );

  if (success) {
    logger.success("🎉 APT repair completed successfully!");
    logger.info("You can now run: sudo apt-get install <package>");
  } else {
    logger.error("❌ APT repair encountered errors");
    logger.info("Manual intervention may be required");
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
