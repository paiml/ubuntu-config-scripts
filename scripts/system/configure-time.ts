#!/usr/bin/env -S deno run --allow-run --allow-read --allow-write

import { z } from "../../deps.ts";
import { logger } from "../lib/logger.ts";
import { commandExists, runCommand } from "../lib/common.ts";

const TimeConfigSchema = z.object({
  timezone: z.string().default("Europe/Madrid"),
  enableNTP: z.boolean().default(true),
  syncNow: z.boolean().default(false),
  showStatus: z.boolean().default(true),
});

type TimeConfig = z.infer<typeof TimeConfigSchema>;

const SPAIN_TIMEZONES = [
  "Europe/Madrid", // Mainland Spain
  "Atlantic/Canary", // Canary Islands
  "Africa/Ceuta", // Ceuta
];

async function getCurrentTimezone(): Promise<string | null> {
  try {
    const result = await runCommand([
      "timedatectl",
      "show",
      "--property=Timezone",
      "--value",
    ]);
    if (result.code === 0) {
      return result.stdout.trim();
    }
  } catch (error) {
    logger.error("Failed to get current timezone", { error });
  }
  return null;
}

async function listTimezones(): Promise<string[]> {
  try {
    const result = await runCommand(["timedatectl", "list-timezones"]);
    if (result.code === 0) {
      return result.stdout.split("\n").filter((tz) => tz.length > 0);
    }
  } catch (error) {
    logger.error("Failed to list timezones", { error });
  }
  return [];
}

async function setTimezone(timezone: string): Promise<boolean> {
  logger.info("Setting timezone", { timezone });

  const availableTimezones = await listTimezones();
  if (!availableTimezones.includes(timezone)) {
    logger.error("Invalid timezone", { timezone, available: SPAIN_TIMEZONES });
    return false;
  }

  const result = await runCommand([
    "sudo",
    "timedatectl",
    "set-timezone",
    timezone,
  ]);
  if (result.code !== 0) {
    logger.error("Failed to set timezone", {
      timezone,
      error: result.stderr,
    });
    return false;
  }

  logger.success("Timezone set successfully", { timezone });
  return true;
}

async function configureNTP(enable: boolean): Promise<boolean> {
  const action = enable ? "true" : "false";
  logger.info(`${enable ? "Enabling" : "Disabling"} NTP synchronization`);

  const result = await runCommand(["sudo", "timedatectl", "set-ntp", action]);
  if (result.code !== 0) {
    logger.error("Failed to configure NTP", {
      enable,
      error: result.stderr,
    });
    return false;
  }

  logger.success(`NTP ${enable ? "enabled" : "disabled"} successfully`);
  return true;
}

async function syncTimeNow(): Promise<boolean> {
  logger.info("Forcing immediate time synchronization");

  if (!await commandExists("chronyc")) {
    logger.warn("chrony not installed, installing...");
    const installResult = await runCommand([
      "sudo",
      "apt-get",
      "install",
      "-y",
      "chrony",
    ]);
    if (installResult.code !== 0) {
      logger.error("Failed to install chrony", { error: installResult.stderr });
      return false;
    }
  }

  const result = await runCommand(["sudo", "chronyc", "makestep"]);
  if (result.code !== 0) {
    logger.warn("chronyc makestep failed, trying systemd-timesyncd");

    const restartResult = await runCommand([
      "sudo",
      "systemctl",
      "restart",
      "systemd-timesyncd",
    ]);
    if (restartResult.code !== 0) {
      logger.error("Failed to sync time", { error: restartResult.stderr });
      return false;
    }
  }

  logger.success("Time synchronization initiated");
  return true;
}

async function showTimeStatus(): Promise<void> {
  const statusResult = await runCommand(["timedatectl", "status"]);
  if (statusResult.code === 0) {
    console.log("\n📅 Current Time Configuration:");
    console.log("================================");
    console.log(statusResult.stdout);
  }

  const currentTz = await getCurrentTimezone();
  if (currentTz && SPAIN_TIMEZONES.includes(currentTz)) {
    logger.success("System is configured for Spain timezone", {
      timezone: currentTz,
    });
  } else if (currentTz) {
    logger.warn("System is NOT configured for Spain timezone", {
      current: currentTz,
      recommended: SPAIN_TIMEZONES,
    });
  }

  if (await commandExists("chronyc")) {
    const sourcesResult = await runCommand(["chronyc", "sources", "-v"]);
    if (sourcesResult.code === 0) {
      console.log("\n🔄 NTP Sources:");
      console.log("================");
      console.log(sourcesResult.stdout);
    }
  }
}

async function main() {
  const args = Deno.args;
  const config: TimeConfig = {
    timezone: "Europe/Madrid",
    enableNTP: true,
    syncNow: false,
    showStatus: true,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--timezone":
      case "-t":
        config.timezone = args[++i] || "Europe/Madrid";
        break;
      case "--canary":
        config.timezone = "Atlantic/Canary";
        break;
      case "--ceuta":
        config.timezone = "Africa/Ceuta";
        break;
      case "--disable-ntp":
        config.enableNTP = false;
        break;
      case "--sync":
      case "-s":
        config.syncNow = true;
        break;
      case "--no-status":
        config.showStatus = false;
        break;
      case "--help":
      case "-h":
        console.log(`
Time Configuration Script for Spain

Usage: deno run --allow-run --allow-read configure-time.ts [options]

Options:
  --timezone, -t <tz>  Set specific timezone (default: Europe/Madrid)
  --canary            Use Canary Islands timezone (Atlantic/Canary)
  --ceuta             Use Ceuta timezone (Africa/Ceuta)
  --disable-ntp       Disable NTP synchronization
  --sync, -s          Force immediate time synchronization
  --no-status         Don't show status after configuration
  --help, -h          Show this help message

Spain Timezones:
  Europe/Madrid    - Mainland Spain (UTC+1, UTC+2 during DST)
  Atlantic/Canary  - Canary Islands (UTC+0, UTC+1 during DST)
  Africa/Ceuta     - Ceuta (UTC+1, UTC+2 during DST)

Examples:
  # Set mainland Spain timezone with NTP
  deno run --allow-run configure-time.ts

  # Set Canary Islands timezone
  deno run --allow-run configure-time.ts --canary

  # Force sync and show status
  deno run --allow-run configure-time.ts --sync
`);
        Deno.exit(0);
    }
  }

  try {
    const validConfig = TimeConfigSchema.parse(config);

    logger.info("Starting time configuration for Spain", validConfig);

    const currentTz = await getCurrentTimezone();
    if (currentTz !== validConfig.timezone) {
      await setTimezone(validConfig.timezone);
    } else {
      logger.info("Timezone already set correctly", { timezone: currentTz });
    }

    await configureNTP(validConfig.enableNTP);

    if (validConfig.syncNow) {
      await syncTimeNow();
    }

    if (validConfig.showStatus) {
      await showTimeStatus();
    }

    logger.success("Time configuration completed successfully");
  } catch (error) {
    logger.error("Time configuration failed", { error });
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}

export {
  configureNTP,
  getCurrentTimezone,
  setTimezone,
  SPAIN_TIMEZONES,
  syncTimeNow,
};
