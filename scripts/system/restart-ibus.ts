#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-env

import { Logger } from "../lib/logger.ts";
import { runCommand } from "../lib/common.ts";

const logger = new Logger({ prefix: "restart-ibus" });

const SERVICE_NAME = "ibus-restart";
const SERVICE_PATH = `/home/${
  Deno.env.get("USER")
}/.config/systemd/user/${SERVICE_NAME}.service`;
const TIMER_PATH = `/home/${
  Deno.env.get("USER")
}/.config/systemd/user/${SERVICE_NAME}.timer`;

const SERVICE_CONTENT = `[Unit]
Description=Restart IBus Input Method Framework
After=graphical-session.target

[Service]
Type=oneshot
ExecStart=/usr/bin/ibus restart
RemainAfterExit=no

[Install]
WantedBy=default.target
`;

const TIMER_CONTENT = `[Unit]
Description=Weekly IBus Restart Timer
Requires=${SERVICE_NAME}.service

[Timer]
OnCalendar=weekly
Persistent=true

[Install]
WantedBy=timers.target
`;

async function createSystemdService(): Promise<void> {
  const userConfigDir = `/home/${Deno.env.get("USER")}/.config/systemd/user`;

  // Ensure systemd user directory exists
  logger.info(`Creating systemd user directory: ${userConfigDir}`);
  await Deno.mkdir(userConfigDir, { recursive: true });

  // Write service file
  logger.info(`Creating service file: ${SERVICE_PATH}`);
  await Deno.writeTextFile(SERVICE_PATH, SERVICE_CONTENT);

  // Write timer file
  logger.info(`Creating timer file: ${TIMER_PATH}`);
  await Deno.writeTextFile(TIMER_PATH, TIMER_CONTENT);

  // Set permissions
  await Deno.chmod(SERVICE_PATH, 0o644);
  await Deno.chmod(TIMER_PATH, 0o644);

  logger.success("Service and timer files created");
}

async function enableTimer(): Promise<void> {
  logger.info("Reloading systemd user daemon...");
  const reloadResult = await runCommand([
    "systemctl",
    "--user",
    "daemon-reload",
  ]);

  if (!reloadResult.success) {
    throw new Error(
      `Failed to reload systemd daemon: ${reloadResult.stderr}`,
    );
  }

  logger.info("Enabling timer...");
  const enableResult = await runCommand([
    "systemctl",
    "--user",
    "enable",
    `${SERVICE_NAME}.timer`,
  ]);

  if (!enableResult.success) {
    throw new Error(`Failed to enable timer: ${enableResult.stderr}`);
  }

  logger.info("Starting timer...");
  const startResult = await runCommand([
    "systemctl",
    "--user",
    "start",
    `${SERVICE_NAME}.timer`,
  ]);

  if (!startResult.success) {
    throw new Error(`Failed to start timer: ${startResult.stderr}`);
  }

  logger.success("Timer enabled and started");
}

async function showStatus(): Promise<void> {
  logger.info("Timer status:");
  const statusResult = await runCommand([
    "systemctl",
    "--user",
    "status",
    `${SERVICE_NAME}.timer`,
  ]);

  console.log(statusResult.stdout);

  logger.info("Next scheduled run:");
  const listResult = await runCommand([
    "systemctl",
    "--user",
    "list-timers",
    `${SERVICE_NAME}.timer`,
  ]);

  console.log(listResult.stdout);
}

async function restartNow(): Promise<void> {
  logger.info("Restarting IBus immediately...");
  const result = await runCommand(["ibus", "restart"]);

  if (!result.success) {
    logger.warn(
      `Could not restart IBus now: ${result.stderr.trim() || "already restarted"}`,
    );
    logger.info("Timer will restart IBus on next scheduled run");
    return;
  }

  logger.success("IBus restarted successfully");
}

async function main(): Promise<void> {
  logger.info("Setting up weekly IBus restart timer");

  try {
    await createSystemdService();
    await enableTimer();
    await restartNow();
    await showStatus();

    logger.success("Setup complete!");
    logger.info(
      "IBus will now automatically restart weekly to prevent input lag issues",
    );
    logger.info(
      `To check the timer status: systemctl --user status ${SERVICE_NAME}.timer`,
    );
    logger.info(
      `To manually trigger a restart: systemctl --user start ${SERVICE_NAME}.service`,
    );
  } catch (error) {
    logger.error(`Setup failed: ${error}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
