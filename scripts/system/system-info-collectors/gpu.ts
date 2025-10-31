/**
 * GPU information collector
 */

import { runCommand } from "../../lib/common.ts";

export async function collectGpuInfo(): Promise<Array<Record<string, unknown>>> {
  const gpus: Array<Record<string, unknown>> = [];

  // Check for NVIDIA GPUs
  const nvidiaResult = await runCommand(["nvidia-smi", "--query-gpu=name,driver_version,memory.total,memory.used,temperature.gpu,utilization.gpu", "--format=csv,noheader"]);

  if (nvidiaResult.success) {
    const lines = nvidiaResult.stdout.trim().split("\n");

    for (const line of lines) {
      const parts = line.split(",").map((p) => p.trim());
      if (parts.length >= 6) {
        gpus.push({
          vendor: "NVIDIA",
          model: parts[0] ?? "",
          driverVersion: parts[1] ?? "",
          memoryTotalMb: parseInt(parts[2] ?? "0"),
          memoryUsedMb: parseInt(parts[3] ?? "0"),
          temperatureC: parseInt(parts[4] ?? "0"),
          utilizationPercent: parseInt(parts[5] ?? "0"),
        });
      }
    }
  }

  // If no NVIDIA GPUs found, check for Intel/AMD (simplified)
  if (gpus.length === 0) {
    const lspciResult = await runCommand(["lspci", "-nn"]);
    if (lspciResult.success && lspciResult.stdout.toLowerCase().includes("vga")) {
      gpus.push({
        vendor: "Integrated",
        model: "Unknown",
        driverVersion: "Unknown",
        memoryTotalMb: 0,
        memoryUsedMb: 0,
        temperatureC: 0,
        utilizationPercent: 0,
      });
    }
  }

  return gpus;
}
