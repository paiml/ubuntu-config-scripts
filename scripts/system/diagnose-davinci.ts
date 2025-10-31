#!/usr/bin/env -S deno run --allow-all

/**
 * DaVinci Resolve Diagnostic Launcher
 * Refactored to comply with PMAT quality standards (max 500 lines)
 *
 * Diagnoses why DaVinci Resolve hangs/crashes on launch
 * using the five-why methodology to identify root causes.
 */

import { logger } from "../lib/logger.ts";
import { runCommand } from "../lib/common.ts";
import { parseArgs } from "jsr:@std/cli@^1.0.0";

// Import diagnostic modules
import type { DiagnosticResult } from "./davinci-diagnostics/types.ts";
import { checkGPU } from "./davinci-diagnostics/gpu-check.ts";
import { checkLibraries } from "./davinci-diagnostics/library-check.ts";
import { checkResources } from "./davinci-diagnostics/resource-check.ts";
import { analyzeCrashLogs } from "./davinci-diagnostics/crash-analysis.ts";
import { FiveWhyAnalyzer } from "./davinci-diagnostics/five-why.ts";

const DAVINCI_PATH = "/opt/resolve/bin/resolve";

/**
 * Check file permissions
 */
async function checkPermissions(): Promise<DiagnosticResult[]> {
  logger.info("🔐 Checking permissions...");
  const results: DiagnosticResult[] = [];

  // Check if DaVinci binary exists
  const binExists = await Deno.stat(DAVINCI_PATH).catch(() => null);
  if (!binExists) {
    results.push({
      category: "permissions",
      severity: "critical",
      message: `DaVinci binary not found at ${DAVINCI_PATH}`,
    });
    return results;
  }

  // Check if binary is executable
  const perms = binExists.mode;
  if (perms && (perms & 0o111) === 0) {
    results.push({
      category: "permissions",
      severity: "critical",
      message: "DaVinci binary is not executable",
      fix: `chmod +x ${DAVINCI_PATH}`,
    });
  }

  // Check ownership
  const stat = await runCommand(["stat", "-c", "%U:%G", DAVINCI_PATH]);
  if (stat.success) {
    const owner = stat.stdout.trim();
    const currentUser = Deno.env.get("USER");

    if (!owner.startsWith(currentUser ?? "")) {
      results.push({
        category: "permissions",
        severity: "warning",
        message: `Binary owned by ${owner}, not current user`,
      });
    }
  }

  return results;
}

/**
 * Check environment variables
 */
function checkEnvironment(): DiagnosticResult[] {
  logger.info("🌍 Checking environment...");
  const results: DiagnosticResult[] = [];

  const importantVars = [
    "DISPLAY",
    "XDG_SESSION_TYPE",
    "QT_QPA_PLATFORM",
  ];

  for (const varName of importantVars) {
    const value = Deno.env.get(varName);
    if (!value) {
      results.push({
        category: "environment",
        severity: "warning",
        message: `${varName} not set`,
      });
    } else {
      results.push({
        category: "environment",
        severity: "info",
        message: `${varName}=${value}`,
      });
    }
  }

  // Check for Wayland (DaVinci works better on X11)
  const sessionType = Deno.env.get("XDG_SESSION_TYPE");
  if (sessionType === "wayland") {
    results.push({
      category: "environment",
      severity: "warning",
      message: "Running on Wayland. DaVinci may have issues.",
      fix: "Try switching to X11 session",
    });
  }

  return results;
}

/**
 * Monitor DaVinci process
 */
async function monitorProcess(
  pid: string,
  timeout: number = 30000,
): Promise<void> {
  logger.info(`Monitoring process ${pid} for ${timeout / 1000}s...`);

  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const check = await runCommand([
      "ps",
      "-p",
      pid,
      "-o",
      "pid,state,rss,pcpu,time",
    ]);

    if (!check.success) {
      logger.error("Process terminated");
      break;
    }

    const lines = check.stdout.trim().split("\n");
    if (lines.length > 1) {
      logger.info(`  ${lines[1]}`);
    }

    // Check if process is in zombie/stopped state
    if (check.stdout.includes(" Z ") || check.stdout.includes(" T ")) {
      logger.error("Process is in abnormal state");
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

/**
 * Launch DaVinci with diagnostics
 */
async function launchWithDiagnostics(): Promise<void> {
  logger.info("🚀 Launching DaVinci Resolve with diagnostics...\n");

  // Run all diagnostic checks first
  const gpuResults = await checkGPU();
  const resourceResults = await checkResources();
  const libResults = await checkLibraries();
  const permResults = await checkPermissions();
  const envResults = checkEnvironment();
  const crashResults = await analyzeCrashLogs();

  const allResults = [
    ...gpuResults,
    ...resourceResults,
    ...libResults,
    ...permResults,
    ...envResults,
    ...crashResults,
  ];

  // Print results
  printDiagnosticReport(allResults);

  // Check for critical issues
  const critical = allResults.filter((r) => r.severity === "critical");
  if (critical.length > 0) {
    logger.error("\n❌ Critical issues found! Fix these before launching:");
    critical.forEach((r) => {
      logger.error(`  - ${r.message}`);
      if (r.fix) {
        logger.info(`    Fix: ${r.fix}`);
      }
    });

    const analyzer = new FiveWhyAnalyzer();
    performFiveWhyAnalysis(analyzer, allResults);
    analyzer.print();

    return;
  }

  // Launch DaVinci
  logger.info("\n✅ Pre-flight checks passed. Launching DaVinci...\n");

  const process = new Deno.Command(DAVINCI_PATH, {
    stdout: "piped",
    stderr: "piped",
  }).spawn();

  const pid = process.pid.toString();
  logger.info(`DaVinci started with PID: ${pid}`);

  // Monitor for 30 seconds
  const monitorPromise = monitorProcess(pid);
  const statusPromise = process.status;

  const result = await Promise.race([
    monitorPromise.then(() => ({ type: "timeout" as const })),
    statusPromise.then((status) => ({ type: "exit" as const, status })),
  ]);

  if (result.type === "exit") {
    logger.error(`DaVinci exited with code: ${result.status.code}`);

    // Analyze why it crashed
    const analyzer = new FiveWhyAnalyzer();
    performFiveWhyAnalysis(analyzer, allResults);
    analyzer.print();
  } else {
    logger.info("\n✅ DaVinci appears to be running successfully!");
  }
}

/**
 * Perform five-why analysis on diagnostic results
 */
function performFiveWhyAnalysis(
  analyzer: FiveWhyAnalyzer,
  results: DiagnosticResult[],
): void {
  const critical = results.filter((r) => r.severity === "critical");

  if (critical.length === 0) {
    analyzer.addWhy(
      "Why did DaVinci crash?",
      "No critical issues found in diagnostics",
    );
    analyzer.setRootCause("Unknown - check application logs");
    return;
  }

  // Start with the most critical issue
  const mainIssue = critical[0];
  if (!mainIssue) return;

  analyzer.addWhy(
    "Why did DaVinci crash?",
    mainIssue.message,
  );

  // Categorize and dig deeper
  switch (mainIssue.category) {
    case "gpu":
      analyzer.addWhy(
        "Why is there a GPU issue?",
        "Driver or hardware problem",
      );
      analyzer.setRootCause(
        "GPU driver needs update or GPU hardware incompatible",
      );
      break;

    case "libs":
      analyzer.addWhy(
        "Why are libraries missing/conflicting?",
        "System libraries incompatible with bundled libraries",
      );
      analyzer.setRootCause(
        "Remove conflicting bundled libraries and use system libraries",
      );
      break;

    case "memory":
      analyzer.addWhy(
        "Why is memory insufficient?",
        "System doesn't meet DaVinci's requirements",
      );
      analyzer.setRootCause(
        "Need more RAM or need to close other applications",
      );
      break;

    default:
      analyzer.setRootCause(mainIssue.message);
  }
}

/**
 * Print diagnostic report
 */
function printDiagnosticReport(results: DiagnosticResult[]): void {
  logger.info("\n" + "=".repeat(80));
  logger.info("📋 DIAGNOSTIC REPORT");
  logger.info("=".repeat(80) + "\n");

  const categories = ["critical", "warning", "info"] as const;

  for (const severity of categories) {
    const filtered = results.filter((r) => r.severity === severity);
    if (filtered.length === 0) continue;

    const icon = severity === "critical"
      ? "❌"
      : severity === "warning"
      ? "⚠️"
      : "ℹ️";

    logger.info(`\n${icon} ${severity.toUpperCase()} (${filtered.length}):`);

    for (const result of filtered) {
      logger.info(`  [${result.category}] ${result.message}`);
      if (result.fix) {
        logger.info(`     Fix: ${result.fix}`);
      }
    }
  }

  logger.info("\n" + "=".repeat(80));
}

// CLI entry point
if (import.meta.main) {
  const args = parseArgs(Deno.args, {
    boolean: ["help", "monitor"],
    alias: { h: "help", m: "monitor" },
  });

  if (args.help) {
    console.log(`
DaVinci Resolve Diagnostic Launcher

Usage:
  diagnose-davinci.ts [OPTIONS]

Options:
  --monitor, -m    Only monitor running DaVinci process
  -h, --help       Show this help message

Examples:
  # Full diagnostics and launch
  diagnose-davinci.ts

  # Just monitor existing process
  diagnose-davinci.ts --monitor
    `);
    Deno.exit(0);
  }

  await launchWithDiagnostics();
}

export {
  analyzeCrashLogs,
  checkEnvironment,
  checkGPU,
  checkLibraries,
  checkPermissions,
  checkResources,
  FiveWhyAnalyzer,
};
