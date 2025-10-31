/**
 * System services information collector
 */

import { runCommand } from "../../lib/common.ts";

const MONITORED_SERVICES = [
  "pipewire",
  "pulseaudio",
  "docker",
  "ssh",
  "nginx",
  "apache2",
  "mysql",
  "postgresql",
];

export async function collectServiceInfo(): Promise<
  Array<Record<string, unknown>>
> {
  const services: Array<Record<string, unknown>> = [];

  for (const serviceName of MONITORED_SERVICES) {
    const statusResult = await runCommand([
      "systemctl",
      "is-active",
      serviceName,
    ]);

    const enabledResult = await runCommand([
      "systemctl",
      "is-enabled",
      serviceName,
    ]);

    // Get detailed status
    const detailsResult = await runCommand([
      "systemctl",
      "show",
      serviceName,
      "--no-pager",
    ]);

    let loadState = "unknown";
    let activeState = "unknown";
    let subState = "unknown";

    if (detailsResult.success) {
      const lines = detailsResult.stdout.split("\n");
      for (const line of lines) {
        if (line.startsWith("LoadState=")) {
          loadState = line.split("=")[1]?.trim() ?? "unknown";
        }
        if (line.startsWith("ActiveState=")) {
          activeState = line.split("=")[1]?.trim() ?? "unknown";
        }
        if (line.startsWith("SubState=")) {
          subState = line.split("=")[1]?.trim() ?? "unknown";
        }
      }
    }

    const state = statusResult.success ? statusResult.stdout.trim() : "inactive";
    const enabled = enabledResult.success && enabledResult.stdout.trim() === "enabled";

    services.push({
      name: serviceName,
      state,
      enabled: enabled ? 1 : 0,
      loadState,
      activeState,
      subState,
    });
  }

  return services;
}
