/**
 * GPU diagnostics module
 * Handles GPU-related diagnostic checks
 */

import { logger } from "../../lib/logger.ts";
import { runCommand } from "../../lib/common.ts";
import type { DiagnosticResult } from "./audio.ts";

export async function detectGPUDriver(): Promise<string> {
  const nvidiaCheck = await runCommand(["nvidia-smi", "--version"]);
  if (nvidiaCheck.success) {
    const driverMatch = nvidiaCheck.stdout.match(/Driver Version: ([\d.]+)/);
    return driverMatch ? `NVIDIA ${driverMatch[1]}` : "NVIDIA";
  }
  return "Unknown";
}

export async function diagnoseGPU(): Promise<DiagnosticResult[]> {
  logger.info("\n🎮 Diagnosing GPU...");
  const results: DiagnosticResult[] = [];

  // Check for NVIDIA GPU
  const nvidiaCheck = await runCommand(["nvidia-smi", "-L"]);
  if (nvidiaCheck.success) {
    const gpus = nvidiaCheck.stdout.trim().split("\n");
    results.push({
      category: "gpu",
      severity: "info",
      message: `Found ${gpus.length} NVIDIA GPU(s)`,
    });

    // Check driver status
    const driverCheck = await runCommand(["nvidia-smi"]);
    if (!driverCheck.success) {
      results.push({
        category: "gpu",
        severity: "critical",
        message: "NVIDIA driver not working properly",
        fix: "Reinstall or update NVIDIA drivers",
      });
    } else {
      results.push({
        category: "gpu",
        severity: "success",
        message: "NVIDIA driver is working",
      });

      // Check GPU utilization
      const utilizationMatch = driverCheck.stdout.match(/(\d+)%\s+Default/);
      if (utilizationMatch) {
        const utilization = parseInt(utilizationMatch[1] ?? "0");
        if (utilization > 90) {
          results.push({
            category: "gpu",
            severity: "warning",
            message: `GPU utilization is high: ${utilization}%`,
          });
        }
      }
    }

    // Check for CUDA
    const cudaCheck = await runCommand(["nvcc", "--version"]);
    if (!cudaCheck.success) {
      results.push({
        category: "gpu",
        severity: "warning",
        message: "CUDA toolkit not installed",
        fix: "Install CUDA toolkit for development",
      });
    } else {
      const versionMatch = cudaCheck.stdout.match(/release ([\d.]+)/);
      if (versionMatch) {
        results.push({
          category: "gpu",
          severity: "success",
          message: `CUDA toolkit ${versionMatch[1]} installed`,
        });
      }
    }
  } else {
    // Check for AMD GPU
    const amdCheck = await runCommand(["lspci", "-nn"]);
    if (amdCheck.success && amdCheck.stdout.toLowerCase().includes("amd")) {
      results.push({
        category: "gpu",
        severity: "info",
        message: "AMD GPU detected",
      });

      // Check for AMDGPU driver
      const driverCheck = await runCommand([
        "lsmod",
      ]);
      if (driverCheck.success && driverCheck.stdout.includes("amdgpu")) {
        results.push({
          category: "gpu",
          severity: "success",
          message: "AMD GPU driver loaded",
        });
      }
    } else {
      // Integrated Intel GPU
      if (amdCheck.success && amdCheck.stdout.toLowerCase().includes("intel")) {
        results.push({
          category: "gpu",
          severity: "info",
          message: "Intel integrated GPU detected",
        });
      }
    }
  }

  return results;
}
