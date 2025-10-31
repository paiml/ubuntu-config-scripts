/**
 * Memory information collector
 */

import { runCommand } from "../../lib/common.ts";

export async function collectMemoryInfo(): Promise<Record<string, unknown>> {
  const memInfoResult = await runCommand(["free", "-m"]);

  let totalMb = 0;
  let availableMb = 0;
  let usedMb = 0;
  let swapTotalMb = 0;
  let swapUsedMb = 0;

  if (memInfoResult.success) {
    const lines = memInfoResult.stdout.split("\n");

    // Parse memory line
    const memLine = lines[1];
    if (memLine) {
      const parts = memLine.split(/\s+/);
      totalMb = parseInt(parts[1] ?? "0");
      usedMb = parseInt(parts[2] ?? "0");
      availableMb = parseInt(parts[6] ?? parts[3] ?? "0");
    }

    // Parse swap line
    const swapLine = lines[2];
    if (swapLine) {
      const parts = swapLine.split(/\s+/);
      swapTotalMb = parseInt(parts[1] ?? "0");
      swapUsedMb = parseInt(parts[2] ?? "0");
    }
  }

  const usagePercent = totalMb > 0 ? (usedMb / totalMb) * 100 : 0;

  return {
    totalMb,
    availableMb,
    usedMb,
    usagePercent,
    swapTotalMb,
    swapUsedMb,
  };
}
