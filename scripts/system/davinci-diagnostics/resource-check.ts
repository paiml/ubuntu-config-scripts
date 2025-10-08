/**
 * DaVinci Resolve system resource checks
 */

import { logger } from "../../lib/logger.ts";
import { runCommand } from "../../lib/common.ts";
import type { DiagnosticResult } from "./types.ts";

export async function checkResources(): Promise<DiagnosticResult[]> {
  logger.info("💾 Checking system resources...");
  const results: DiagnosticResult[] = [];

  // Check RAM
  const memCheck = await runCommand(["free", "-m"]);
  if (memCheck.success) {
    const memLines = memCheck.stdout.split("\n");
    const memLine = memLines[1];
    if (memLine) {
      const parts = memLine.split(/\s+/);
      const totalMB = parseInt(parts[1] ?? "0");
      const availableMB = parseInt(parts[6] ?? parts[3] ?? "0");

      if (totalMB < 16000) {
        results.push({
          category: "memory",
          severity: "warning",
          message: `Low total RAM: ${totalMB}MB. DaVinci recommends 16GB+`,
        });
      }

      if (availableMB < 4000) {
        results.push({
          category: "memory",
          severity: "critical",
          message: `Low available RAM: ${availableMB}MB`,
          fix: "Close other applications before launching DaVinci",
        });
      } else {
        results.push({
          category: "memory",
          severity: "info",
          message: `Available RAM: ${availableMB}MB`,
        });
      }
    }
  }

  // Check swap
  const swapCheck = await runCommand(["swapon", "--show"]);
  if (swapCheck.success && swapCheck.stdout.trim()) {
    const swapLines = swapCheck.stdout.split("\n");
    if (swapLines.length > 1) {
      results.push({
        category: "memory",
        severity: "info",
        message: "Swap is enabled",
      });
    }
  } else {
    results.push({
      category: "memory",
      severity: "warning",
      message: "No swap enabled (recommended for DaVinci)",
      fix: "Enable swap for better memory management",
    });
  }

  // Check disk space
  const dfCheck = await runCommand(["df", "-h", "/tmp"]);
  if (dfCheck.success) {
    const lines = dfCheck.stdout.split("\n");
    const tmpLine = lines[1];
    if (tmpLine) {
      const parts = tmpLine.split(/\s+/);
      const usePercent = parts[4];

      const percentNum = parseInt(usePercent?.replace("%", "") ?? "0");
      if (percentNum > 90) {
        results.push({
          category: "memory",
          severity: "critical",
          message: `/tmp is ${percentNum}% full`,
          fix: "Clean up /tmp directory",
        });
      }
    }
  }

  return results;
}
