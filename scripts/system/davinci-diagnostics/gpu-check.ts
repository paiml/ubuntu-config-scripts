/**
 * DaVinci Resolve GPU diagnostics
 */

import { logger } from "../../lib/logger.ts";
import { runCommand } from "../../lib/common.ts";
import type { DiagnosticResult } from "./types.ts";

export async function checkGPU(): Promise<DiagnosticResult[]> {
  logger.info("🎮 Checking GPU configuration...");
  const results: DiagnosticResult[] = [];

  // Check for NVIDIA GPU
  const nvidiaCheck = await runCommand(["nvidia-smi"]);
  if (!nvidiaCheck.success) {
    results.push({
      category: "gpu",
      severity: "critical",
      message: "NVIDIA GPU not detected or driver not installed",
      fix: "Install NVIDIA drivers: sudo ubuntu-drivers install",
    });
    return results;
  }

  // Check GPU driver version
  const driverMatch = nvidiaCheck.stdout.match(/Driver Version: ([\d.]+)/);
  if (driverMatch) {
    const version = driverMatch[1];
    results.push({
      category: "gpu",
      severity: "info",
      message: `NVIDIA driver version: ${version}`,
    });

    // DaVinci Resolve requires driver >= 470
    const majorVersion = parseInt(version?.split(".")[0] ?? "0");
    if (majorVersion < 470) {
      results.push({
        category: "gpu",
        severity: "critical",
        message: `NVIDIA driver too old (${version}). DaVinci needs >= 470`,
        fix: "Update NVIDIA drivers",
      });
    }
  }

  // Check GPU mode (prime-select)
  const primeCheck = await runCommand(["prime-select", "query"]);
  if (primeCheck.success) {
    const mode = primeCheck.stdout.trim();
    if (mode !== "nvidia") {
      results.push({
        category: "gpu",
        severity: "warning",
        message:
          `GPU mode is '${mode}', should be 'nvidia' for best performance`,
        fix: "sudo prime-select nvidia",
      });
    } else {
      results.push({
        category: "gpu",
        severity: "info",
        message: "GPU mode set to nvidia (optimal)",
      });
    }
  }

  // Check GPU utilization
  const utilMatch = nvidiaCheck.stdout.match(/(\d+)%\s+Default/);
  if (utilMatch) {
    const util = parseInt(utilMatch[1] ?? "0");
    if (util > 95) {
      results.push({
        category: "gpu",
        severity: "warning",
        message: `GPU utilization high: ${util}%`,
      });
    }
  }

  // Check GPU memory
  const memMatch = nvidiaCheck.stdout.match(/(\d+)MiB\s*\/\s*(\d+)MiB/);
  if (memMatch) {
    const used = parseInt(memMatch[1] ?? "0");
    const total = parseInt(memMatch[2] ?? "0");
    const percent = (used / total) * 100;

    if (percent > 90) {
      results.push({
        category: "gpu",
        severity: "warning",
        message: `GPU memory ${percent.toFixed(1)}% full`,
      });
    }
  }

  // Check CUDA
  const cudaCheck = await runCommand(["nvcc", "--version"]);
  if (cudaCheck.success) {
    const cudaMatch = cudaCheck.stdout.match(/release ([\d.]+)/);
    if (cudaMatch) {
      results.push({
        category: "gpu",
        severity: "info",
        message: `CUDA version: ${cudaMatch[1]}`,
      });
    }
  } else {
    results.push({
      category: "gpu",
      severity: "warning",
      message: "CUDA not installed (optional for DaVinci)",
    });
  }

  return results;
}
