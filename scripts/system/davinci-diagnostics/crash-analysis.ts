/**
 * DaVinci Resolve crash log analysis
 */

import { logger } from "../../lib/logger.ts";
import { runCommand } from "../../lib/common.ts";
import type { DiagnosticResult } from "./types.ts";

const CRASH_PATTERNS = [
  { pattern: /Segmentation fault/i, message: "Segmentation fault detected" },
  {
    pattern: /SIGSEGV/i,
    message: "Segmentation violation (memory access error)",
  },
  { pattern: /SIGABRT/i, message: "Abort signal (crash)" },
  { pattern: /SIGILL/i, message: "Illegal instruction (CPU incompatibility?)" },
  {
    pattern: /cannot allocate memory/i,
    message: "Out of memory error",
  },
  {
    pattern: /Failed to load.*\.so/i,
    message: "Library loading failed",
  },
  {
    pattern: /GLIBC.*version/i,
    message: "GLIBC version mismatch",
  },
];

export async function analyzeCrashLogs(): Promise<DiagnosticResult[]> {
  logger.info("📋 Analyzing crash logs...");
  const results: DiagnosticResult[] = [];

  // Check system logs
  const journalCheck = await runCommand([
    "journalctl",
    "--user",
    "-b",
    "-0",
    "--no-pager",
    "-n",
    "500",
  ]);

  if (journalCheck.success) {
    const logs = journalCheck.stdout;

    // Check for crash patterns
    for (const { pattern, message } of CRASH_PATTERNS) {
      if (pattern.test(logs)) {
        results.push({
          category: "unknown",
          severity: "critical",
          message: `Crash pattern found: ${message}`,
        });
      }
    }

    // Check for DaVinci-specific errors
    if (logs.includes("resolve")) {
      const resolveErrors = logs.split("\n").filter((line) =>
        line.toLowerCase().includes("resolve") &&
        (line.includes("error") || line.includes("fail"))
      );

      if (resolveErrors.length > 0) {
        results.push({
          category: "unknown",
          severity: "warning",
          message:
            `Found ${resolveErrors.length} DaVinci-related error(s) in logs`,
          details: {
            samples: resolveErrors.slice(0, 3),
          },
        });
      }
    }
  }

  // Check dmesg for kernel-level errors
  const dmesgCheck = await runCommand(["dmesg", "-T"]);
  if (dmesgCheck.success) {
    const dmesg = dmesgCheck.stdout;

    if (dmesg.includes("GPU")) {
      const gpuErrors = dmesg.split("\n").filter((line) =>
        line.includes("GPU") && line.toLowerCase().includes("error")
      );

      if (gpuErrors.length > 0) {
        results.push({
          category: "gpu",
          severity: "critical",
          message: "GPU errors detected in kernel logs",
          details: {
            count: gpuErrors.length,
          },
        });
      }
    }
  }

  return results;
}
