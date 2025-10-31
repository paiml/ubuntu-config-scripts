/**
 * System information collection module
 */

import { logger } from "../../lib/logger.ts";
import { runCommand } from "../../lib/common.ts";
import { z } from "../../../deps.ts";
import { detectAudioServer } from "./audio.ts";
import { detectGPUDriver } from "./gpu.ts";

export const SystemInfoSchema = z.object({
  kernel: z.string(),
  distro: z.string(),
  desktop: z.string(),
  gpuDriver: z.string().optional(),
  audioServer: z.string(),
});

export type SystemInfo = z.infer<typeof SystemInfoSchema>;

async function getCommandOutput(args: string[]): Promise<string> {
  const result = await runCommand(args);
  return result.success ? result.stdout.trim() : "Unknown";
}

export async function collectSystemInfo(): Promise<SystemInfo> {
  logger.info("📊 Collecting system information...");

  const kernel = await getCommandOutput(["uname", "-r"]);
  const distro = await getCommandOutput(["lsb_release", "-d", "-s"]);
  const desktop = Deno.env.get("XDG_CURRENT_DESKTOP") || "Unknown";
  const audioServer = await detectAudioServer();
  const gpuDriver = await detectGPUDriver();

  const info: SystemInfo = {
    kernel,
    distro,
    desktop,
    gpuDriver,
    audioServer,
  };

  logger.info("System info collected", info);
  return info;
}
