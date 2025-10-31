#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-env

import { Logger } from "../lib/logger.ts";
import { runCommand } from "../lib/common.ts";

const logger = new Logger({ prefix: "pipewire-monitor" });

const SERVICE_NAME = "pipewire-monitor";
const SERVICE_PATH = `/home/${
  Deno.env.get("USER")
}/.config/systemd/user/${SERVICE_NAME}.service`;
const SCRIPT_PATH = `/home/${
  Deno.env.get("USER")
}/.local/bin/pipewire-monitor.sh`;

const MONITOR_SCRIPT = `#!/bin/bash
# PipeWire Audio Monitor and Auto-Restart Script
# Monitors PipeWire for "Broken pipe" errors and restarts services when detected

LOG_FILE="/tmp/pipewire-monitor.log"
CHECK_INTERVAL=30  # Check every 30 seconds
ERROR_THRESHOLD=5  # Number of errors before restart
RESTART_COOLDOWN=300  # Wait 5 minutes between restarts

last_restart=0
error_count=0

log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

check_pipewire_health() {
    # Check for "Broken pipe" errors in the last minute
    local errors=$(journalctl --user -u pipewire --since "1 minute ago" 2>/dev/null | grep -c "Broken pipe")
    
    # Check if any audio sinks are in error state
    local sink_errors=$(pactl list sinks 2>/dev/null | grep -c "State: ERROR")
    
    # Check if pipewire is running
    if ! systemctl --user is-active --quiet pipewire; then
        log_message "ERROR: PipeWire service is not running"
        return 1
    fi
    
    if [ "$errors" -gt 0 ] || [ "$sink_errors" -gt 0 ]; then
        log_message "WARNING: Detected $errors Broken pipe errors and $sink_errors sinks in error state"
        return 1
    fi
    
    return 0
}

restart_pipewire() {
    local current_time=$(date +%s)
    local time_since_restart=$((current_time - last_restart))
    
    if [ "$time_since_restart" -lt "$RESTART_COOLDOWN" ]; then
        log_message "INFO: Skipping restart (cooldown period, $time_since_restart seconds since last restart)"
        return
    fi
    
    log_message "INFO: Restarting PipeWire services..."
    systemctl --user restart pipewire pipewire-pulse wireplumber
    
    # Wait for services to stabilize
    sleep 5
    
    if systemctl --user is-active --quiet pipewire; then
        log_message "SUCCESS: PipeWire services restarted successfully"
        last_restart=$current_time
        error_count=0
    else
        log_message "ERROR: Failed to restart PipeWire services"
    fi
}

log_message "PipeWire monitor started"

while true; do
    if ! check_pipewire_health; then
        error_count=$((error_count + 1))
        
        if [ "$error_count" -ge "$ERROR_THRESHOLD" ]; then
            log_message "ERROR: Error threshold reached ($error_count errors), triggering restart"
            restart_pipewire
        fi
    else
        # Reset error count if we had a successful check
        if [ "$error_count" -gt 0 ]; then
            log_message "INFO: PipeWire health restored, resetting error count"
            error_count=0
        fi
    fi
    
    sleep "$CHECK_INTERVAL"
done
`;

const SERVICE_CONTENT = `[Unit]
Description=PipeWire Audio Monitor and Auto-Restart
After=pipewire.service
PartOf=default.target

[Service]
Type=simple
ExecStart=/bin/bash ${SCRIPT_PATH}
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
`;

async function createMonitorService() {
  logger.info("Creating PipeWire monitor service...");

  // Create directories if they don't exist
  const scriptDir = `/home/${Deno.env.get("USER")}/.local/bin`;
  const serviceDir = `/home/${Deno.env.get("USER")}/.config/systemd/user`;

  await Deno.mkdir(scriptDir, { recursive: true });
  await Deno.mkdir(serviceDir, { recursive: true });

  // Write monitor script
  logger.info(`Writing monitor script to ${SCRIPT_PATH}`);
  await Deno.writeTextFile(SCRIPT_PATH, MONITOR_SCRIPT);
  await Deno.chmod(SCRIPT_PATH, 0o755);

  // Write systemd service
  logger.info(`Writing service file to ${SERVICE_PATH}`);
  await Deno.writeTextFile(SERVICE_PATH, SERVICE_CONTENT);

  // Reload systemd and enable service
  logger.info("Reloading systemd daemon...");
  await runCommand(["systemctl", "--user", "daemon-reload"]);

  logger.info("Enabling PipeWire monitor service...");
  await runCommand(["systemctl", "--user", "enable", SERVICE_NAME]);

  logger.info("Starting PipeWire monitor service...");
  await runCommand(["systemctl", "--user", "restart", SERVICE_NAME]);

  // Check service status
  const result = await runCommand([
    "systemctl",
    "--user",
    "is-active",
    SERVICE_NAME,
  ]);

  if (result.code === 0) {
    logger.success(
      "✅ PipeWire monitor service created and started successfully!",
    );
    logger.info("Monitor will check PipeWire health every 30 seconds");
    logger.info("Automatic restart will trigger after 5 consecutive errors");
    logger.info(`View logs: journalctl --user -u ${SERVICE_NAME} -f`);
  } else {
    logger.error("Failed to start PipeWire monitor service");
    logger.info(`Check status: systemctl --user status ${SERVICE_NAME}`);
  }
}

async function main() {
  try {
    await createMonitorService();

    // Also create a PipeWire config to prevent the specific error
    logger.info("\nCreating PipeWire configuration to prevent errors...");

    const configDir = `/home/${
      Deno.env.get("USER")
    }/.config/pipewire/pipewire.conf.d`;
    const configPath = `${configDir}/99-fix-alsa-errors.conf`;

    // Create config directory if it doesn't exist
    await Deno.mkdir(configDir, { recursive: true });

    const configContent = `# Fix for ALSA "Broken pipe" errors
# This configuration helps prevent recurring audio issues

context.properties = {
    # Increase timeouts to prevent broken pipe errors
    link.max-buffers = 64
    core.daemon = true
    core.name = pipewire-0
}

context.modules = [
    {
        name = libpipewire-module-rt
        args = {
            nice.level = -11
            rt.prio = 88
            rt.time.soft = 2000000
            rt.time.hard = 2000000
        }
        flags = [ ifexists nofail ]
    }
]

stream.properties = {
    # Prevent suspension timeouts
    node.suspend-on-idle = false
    resample.disable = false
    channelmix.disable = false
}
`;

    await Deno.writeTextFile(configPath, configContent);
    logger.success("✅ PipeWire configuration created");

    logger.info("\n🔄 Restarting PipeWire to apply configuration...");
    await runCommand([
      "systemctl",
      "--user",
      "restart",
      "pipewire",
      "pipewire-pulse",
      "wireplumber",
    ]);

    logger.success("\n✅ Complete! Your audio system now has:");
    logger.info("1. Automatic monitoring and recovery from errors");
    logger.info("2. Configuration to prevent 'Broken pipe' errors");
    logger.info("3. Improved buffer and timeout settings");
  } catch (error) {
    logger.error("Failed to create PipeWire monitor service", error);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
