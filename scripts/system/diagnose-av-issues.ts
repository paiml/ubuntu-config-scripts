#!/usr/bin/env -S deno run --allow-all

/**
 * Comprehensive Audio/Video Diagnostics Tool
 * Refactored to comply with PMAT quality standards (max 500 lines)
 */

import { logger } from "../lib/logger.ts";
import { runCommand } from "../lib/common.ts";
import { parseArgs } from "jsr:@std/cli@^1.0.0";

// Import diagnostic modules
import type { DiagnosticResult } from "./diagnostics/audio.ts";
import {
  diagnoseAudioSubsystem,
  detectAudioServer,
} from "./diagnostics/audio.ts";
import { diagnoseVideoSubsystem } from "./diagnostics/video.ts";
import { diagnoseGPU } from "./diagnostics/gpu.ts";
import { collectSystemInfo } from "./diagnostics/system-info.ts";
import { runAllPlaybackTests } from "./diagnostics/playback-tests.ts";
import {
  applyFixes,
  exportFixes,
  generateReport,
} from "./diagnostics/reporting.ts";

/**
 * Network diagnostics for streaming
 */
async function diagnoseNetworkForStreaming(): Promise<DiagnosticResult[]> {
  logger.info("\n🌐 Diagnosing network for streaming...");
  const results: DiagnosticResult[] = [];

  // Check network interfaces
  const ifConfigCheck = await runCommand(["ip", "link", "show"]);
  if (ifConfigCheck.success) {
    const interfaces = ifConfigCheck.stdout.match(/\d+: (\w+):/g);
    if (interfaces) {
      results.push({
        category: "network",
        severity: "info",
        message: `Found ${interfaces.length} network interface(s)`,
      });
    }
  }

  // Check for active network connection
  const pingCheck = await runCommand([
    "ping",
    "-c",
    "1",
    "-W",
    "2",
    "8.8.8.8",
  ]);

  if (pingCheck.success) {
    results.push({
      category: "network",
      severity: "success",
      message: "Internet connectivity OK",
    });
  } else {
    results.push({
      category: "network",
      severity: "warning",
      message: "Internet connectivity issues detected",
    });
  }

  // Check for streaming tools
  const rtmpCheck = await runCommand(["which", "ffmpeg"]);
  if (rtmpCheck.success) {
    results.push({
      category: "network",
      severity: "success",
      message: "FFmpeg available for streaming",
    });
  }

  return results;
}

/**
 * Check system resources and processes
 */
async function checkProcessesAndResources(): Promise<DiagnosticResult[]> {
  logger.info("\n💻 Checking processes and resources...");
  const results: DiagnosticResult[] = [];

  // Check CPU usage
  const cpuCheck = await runCommand(["top", "-bn1"]);
  if (cpuCheck.success) {
    const cpuMatch = cpuCheck.stdout.match(/Cpu\(s\):\s*([\d.]+)%us/);
    if (cpuMatch) {
      const cpuUsage = parseFloat(cpuMatch[1] ?? "0");
      if (cpuUsage > 80) {
        results.push({
          category: "system",
          severity: "warning",
          message: `High CPU usage: ${cpuUsage}%`,
        });
      } else {
        results.push({
          category: "system",
          severity: "success",
          message: `CPU usage normal: ${cpuUsage}%`,
        });
      }
    }
  }

  // Check memory usage
  const memCheck = await runCommand(["free", "-m"]);
  if (memCheck.success) {
    const memLines = memCheck.stdout.split("\n");
    const memLine = memLines[1];
    if (memLine) {
      const parts = memLine.split(/\s+/);
      const total = parseInt(parts[1] ?? "0");
      const used = parseInt(parts[2] ?? "0");
      const percentUsed = (used / total) * 100;

      if (percentUsed > 90) {
        results.push({
          category: "system",
          severity: "warning",
          message: `High memory usage: ${percentUsed.toFixed(1)}%`,
        });
      } else {
        results.push({
          category: "system",
          severity: "success",
          message: `Memory usage OK: ${percentUsed.toFixed(1)}%`,
        });
      }
    }
  }

  // Check for audio/video processes
  const processes = [
    "pipewire",
    "pulseaudio",
    "obs",
    "ffmpeg",
    "vlc",
  ];

  for (const proc of processes) {
    const procCheck = await runCommand(["pgrep", "-x", proc]);
    if (procCheck.success) {
      results.push({
        category: "system",
        severity: "info",
        message: `${proc} is running`,
      });
    }
  }

  return results;
}

/**
 * Main diagnostics orchestrator
 */
class AVDiagnostics {
  private results: DiagnosticResult[] = [];

  async run(options: {
    includePlaybackTests?: boolean;
    exportFixes?: boolean;
  } = {}): Promise<void> {
    logger.info("🔍 Starting comprehensive audio/video diagnostics...\n");

    try {
      // Collect system information
      await collectSystemInfo();

      // Run all diagnostic checks
      const audioServer = await detectAudioServer();
      const audioResults = await diagnoseAudioSubsystem(audioServer);
      const videoResults = await diagnoseVideoSubsystem();
      const gpuResults = await diagnoseGPU();
      const networkResults = await diagnoseNetworkForStreaming();
      const systemResults = await checkProcessesAndResources();

      this.results.push(
        ...audioResults,
        ...videoResults,
        ...gpuResults,
        ...networkResults,
        ...systemResults
      );

      // Run playback tests if requested
      if (options.includePlaybackTests) {
        const playbackResults = await runAllPlaybackTests();
        this.results.push(...playbackResults);
      }

      // Generate report
      generateReport(this.results);

      // Apply or export fixes
      if (options.exportFixes) {
        await exportFixes(this.results);
      } else {
        await applyFixes(this.results);
      }
    } catch (error) {
      logger.error("Diagnostic failed", { error: String(error) });
      Deno.exit(1);
    }
  }

  getResults(): DiagnosticResult[] {
    return this.results;
  }
}

// CLI entry point
if (import.meta.main) {
  const args = parseArgs(Deno.args, {
    boolean: ["playback-tests", "export-fixes", "help"],
    alias: { h: "help" },
  });

  if (args.help) {
    console.log(`
Audio/Video Diagnostics Tool

Usage:
  diagnose-av-issues.ts [OPTIONS]

Options:
  --playback-tests    Run real playback tests (requires FFmpeg)
  --export-fixes      Export fixes to a shell script
  -h, --help          Show this help message

Examples:
  # Basic diagnostics
  diagnose-av-issues.ts

  # Full diagnostics with playback tests
  diagnose-av-issues.ts --playback-tests

  # Export fixes to script
  diagnose-av-issues.ts --export-fixes
    `);
    Deno.exit(0);
  }

  const diagnostics = new AVDiagnostics();
  await diagnostics.run({
    includePlaybackTests: args["playback-tests"],
    exportFixes: args["export-fixes"],
  });
}

export { AVDiagnostics };
export type { DiagnosticResult };
