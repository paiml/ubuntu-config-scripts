/**
 * System information collector
 */

import { runCommand } from "../../lib/common.ts";

export async function collectSystemInfo(): Promise<Record<string, unknown>> {
  const hostname = await getCommandOutput(["hostname"]);
  const kernel = await getCommandOutput(["uname", "-r"]);
  const architecture = await getCommandOutput(["uname", "-m"]);

  // Get OS info
  const osName = await getCommandOutput(["lsb_release", "-i", "-s"]);
  const osVersion = await getCommandOutput(["lsb_release", "-r", "-s"]);

  // Get uptime
  const uptimeResult = await runCommand(["cat", "/proc/uptime"]);
  const uptimeSeconds = uptimeResult.success
    ? parseInt(uptimeResult.stdout.split(" ")[0] ?? "0")
    : 0;

  // Get boot time
  const bootTime = new Date(Date.now() - uptimeSeconds * 1000).toISOString();

  // Get timezone
  const timezone = Deno.env.get("TZ") || "UTC";

  return {
    hostname,
    kernel,
    osName,
    osVersion,
    architecture,
    uptimeSeconds,
    bootTime,
    timezone,
  };
}

async function getCommandOutput(args: string[]): Promise<string> {
  const result = await runCommand(args);
  return result.success ? result.stdout.trim() : "Unknown";
}
