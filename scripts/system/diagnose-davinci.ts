#!/usr/bin/env -S deno run --allow-all

/**
 * DaVinci Resolve Diagnostic Launcher
 *
 * This script diagnoses why DaVinci Resolve hangs/crashes on launch
 * using the five-why methodology to identify root causes.
 */

import { logger } from "../lib/logger.ts";
import { runCommand } from "../lib/common.ts";
import { z } from "../../deps.ts";

// Diagnostic result schema
const DiagnosticResultSchema = z.object({
  category: z.enum([
    "gpu",
    "memory",
    "libs",
    "permissions",
    "config",
    "environment",
    "unknown",
  ]),
  severity: z.enum(["critical", "warning", "info"]),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
  fix: z.string().optional(),
});

type DiagnosticResult = z.infer<typeof DiagnosticResultSchema>;

interface ProcessInfo {
  pid: string;
  state: string;
  memory: string;
  cpu: string;
  time: string;
}

/**
 * Five-Why Analysis for DaVinci Resolve crashes
 */
class FiveWhyAnalyzer {
  private whys: string[] = [];
  private rootCause: string | null = null;

  addWhy(question: string, answer: string): void {
    this.whys.push(`Q${this.whys.length + 1}: ${question}\nA: ${answer}`);
  }

  setRootCause(cause: string): void {
    this.rootCause = cause;
  }

  getAnalysis(): string {
    const analysis = [
      "=== Five-Why Analysis ===",
      ...this.whys,
      this.rootCause ? `\nRoot Cause: ${this.rootCause}` : "",
    ];
    return analysis.join("\n");
  }
}

/**
 * Check GPU and driver status
 */
async function checkGPU(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];

  logger.info("Checking GPU and NVIDIA driver...");

  // Check nvidia-smi
  const smiResult = await runCommand([
    "nvidia-smi",
    "--query-gpu=name,driver_version,memory.total,memory.used",
    "--format=csv,noheader",
  ]);

  if (!smiResult.success) {
    results.push({
      category: "gpu",
      severity: "critical",
      message: "NVIDIA driver not functioning properly",
      details: { error: smiResult.stderr },
      fix: "Run: sudo ubuntu-drivers autoinstall",
    });
    return results;
  }

  const gpuInfo = smiResult.stdout.trim();
  logger.info(`GPU Info: ${gpuInfo}`);

  // Check CUDA
  const cudaResult = await runCommand(["nvcc", "--version"]);
  if (!cudaResult.success) {
    results.push({
      category: "gpu",
      severity: "warning",
      message: "CUDA toolkit not found",
      fix: "Install CUDA toolkit for DaVinci Resolve GPU acceleration",
    });
  }

  // Check OpenGL
  const glResult = await runCommand(["glxinfo", "-B"]);
  if (glResult.success) {
    const hasNvidia = glResult.stdout.includes("NVIDIA");
    if (!hasNvidia) {
      results.push({
        category: "gpu",
        severity: "critical",
        message: "OpenGL not using NVIDIA driver",
        details: {
          vendor: glResult.stdout.match(/OpenGL vendor string: (.+)/)?.[1],
        },
        fix: "Run: sudo prime-select nvidia",
      });
    }
  }

  // Check if GPU is in compute mode
  const computeResult = await runCommand(["nvidia-smi", "-q", "-d", "COMPUTE"]);
  if (computeResult.success && computeResult.stdout.includes("Prohibited")) {
    results.push({
      category: "gpu",
      severity: "critical",
      message: "GPU compute mode is prohibited",
      fix: "Run: sudo nvidia-smi -c DEFAULT",
    });
  }

  return results;
}

/**
 * Check system resources
 */
async function checkResources(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];

  logger.info("Checking system resources...");

  // Check memory
  const memResult = await runCommand(["free", "-h"]);
  if (memResult.success) {
    const lines = memResult.stdout.split("\n");
    const memLine = lines[1];
    if (memLine) {
      const parts = memLine.split(/\s+/);
      const total = parseFloat(parts[1] || "0");
      if (total < 16) {
        results.push({
          category: "memory",
          severity: "warning",
          message: `Low system memory: ${parts[1]} (16GB+ recommended)`,
          fix: "Close other applications or add more RAM",
        });
      }
    }
  }

  // Check disk space in /opt
  const dfResult = await runCommand(["df", "-h", "/opt"]);
  if (dfResult.success) {
    const lines = dfResult.stdout.split("\n");
    const diskLine = lines[1];
    if (diskLine) {
      const parts = diskLine.split(/\s+/);
      const usePercent = parseInt(parts[4]?.replace("%", "") || "0");
      if (usePercent > 90) {
        results.push({
          category: "memory",
          severity: "warning",
          message: `Low disk space in /opt: ${parts[4]} used`,
          fix: "Free up disk space",
        });
      }
    }
  }

  // Check ulimits
  const ulimitResult = await runCommand(["bash", "-c", "ulimit -a"]);
  if (ulimitResult.success) {
    const openFiles = ulimitResult.stdout.match(/open files\s+\(-n\)\s+(\d+)/)
      ?.[1];
    if (openFiles && parseInt(openFiles) < 4096) {
      results.push({
        category: "environment",
        severity: "warning",
        message: `Low file descriptor limit: ${openFiles}`,
        fix: "Add to /etc/security/limits.conf: * soft nofile 4096",
      });
    }
  }

  return results;
}

/**
 * Check required libraries
 */
async function checkLibraries(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];

  logger.info("Checking required libraries...");

  const requiredLibs = [
    "libglib-2.0.so.0",
    "libGL.so.1",
    "libOpenCL.so.1",
    "libcuda.so.1",
    "libcudart.so",
    "libQt5Core.so.5",
    "libQt5Gui.so.5",
    "libQt5Widgets.so.5",
  ];

  for (const lib of requiredLibs) {
    const lddResult = await runCommand(["ldconfig", "-p"]);
    if (lddResult.success && !lddResult.stdout.includes(lib)) {
      results.push({
        category: "libs",
        severity: "critical",
        message: `Missing library: ${lib}`,
        fix: `Install package providing ${lib}`,
      });
    }
  }

  // Check DaVinci Resolve binary dependencies
  const lddResolve = await runCommand(["ldd", "/opt/resolve/bin/resolve"]);
  if (lddResolve.success) {
    const notFound = lddResolve.stdout.match(/=> not found/g);
    if (notFound) {
      results.push({
        category: "libs",
        severity: "critical",
        message: `Missing ${notFound.length} library dependencies`,
        details: {
          missing: lddResolve.stdout.split("\n").filter((l) =>
            l.includes("not found")
          ),
        },
        fix: "Install missing libraries or reinstall DaVinci Resolve",
      });
    }
  }

  return results;
}

/**
 * Check permissions and ownership
 */
async function checkPermissions(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];

  logger.info("Checking permissions...");

  const paths = [
    "/opt/resolve",
    `${Deno.env.get("HOME")}/.local/share/DaVinciResolve`,
    `${Deno.env.get("HOME")}/.config/Blackmagic Design`,
  ];

  for (const path of paths) {
    try {
      const stat = await Deno.stat(path);
      if (!stat.isDirectory) {
        results.push({
          category: "permissions",
          severity: "critical",
          message: `Path is not a directory: ${path}`,
          fix: `Remove and recreate: rm -rf "${path}" && mkdir -p "${path}"`,
        });
      }

      // Check if writable
      const testFile = `${path}/.write_test_${Date.now()}`;
      try {
        await Deno.writeTextFile(testFile, "test");
        await Deno.remove(testFile);
      } catch {
        results.push({
          category: "permissions",
          severity: "critical",
          message: `Cannot write to: ${path}`,
          fix: `Fix permissions: chmod 755 "${path}" && chown $USER "${path}"`,
        });
      }
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        if (path.includes("/opt/resolve")) {
          results.push({
            category: "permissions",
            severity: "critical",
            message: "DaVinci Resolve not installed",
            fix: "Install DaVinci Resolve from BlackMagic Design website",
          });
        }
      }
    }
  }

  return results;
}

/**
 * Check environment variables
 */
function checkEnvironment(): DiagnosticResult[] {
  const results: DiagnosticResult[] = [];

  logger.info("Checking environment variables...");

  // Check display
  if (!Deno.env.get("DISPLAY")) {
    results.push({
      category: "environment",
      severity: "critical",
      message: "DISPLAY variable not set",
      fix: "Export DISPLAY=:0",
    });
  }

  // Check Wayland vs X11
  const waylandDisplay = Deno.env.get("WAYLAND_DISPLAY");
  const sessionType = Deno.env.get("XDG_SESSION_TYPE");

  if (waylandDisplay || sessionType === "wayland") {
    results.push({
      category: "environment",
      severity: "warning",
      message: "Running under Wayland (X11 recommended)",
      details: { wayland: waylandDisplay, session: sessionType },
      fix: "Log out and select 'Ubuntu on Xorg' at login screen",
    });
  }

  // Check locale
  const locale = Deno.env.get("LANG");
  if (!locale || !locale.includes("UTF-8")) {
    results.push({
      category: "environment",
      severity: "warning",
      message: `Non-UTF8 locale: ${locale}`,
      fix: "Export LANG=en_US.UTF-8",
    });
  }

  return results;
}

/**
 * Monitor DaVinci Resolve process
 */
async function monitorProcess(
  pid: string,
  duration: number = 5000,
): Promise<ProcessInfo[]> {
  const samples: ProcessInfo[] = [];
  const interval = 500; // Sample every 500ms
  const iterations = duration / interval;

  for (let i = 0; i < iterations; i++) {
    const psResult = await runCommand([
      "ps",
      "-p",
      pid,
      "-o",
      "pid,state,vsz,rss,%cpu,etime",
      "--no-headers",
    ]);

    if (!psResult.success) {
      logger.warn(`Process ${pid} no longer exists`);
      break;
    }

    const parts = psResult.stdout.trim().split(/\s+/);
    if (parts.length >= 6) {
      samples.push({
        pid: parts[0]!,
        state: parts[1]!,
        memory: parts[3]!,
        cpu: parts[4]!,
        time: parts[5]!,
      });
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  return samples;
}

/**
 * Analyze crash logs
 */
async function analyzeCrashLogs(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];
  const logDir = `${Deno.env.get("HOME")}/.local/share/DaVinciResolve/logs`;

  try {
    // Find recent log files
    const entries = [];
    for await (const entry of Deno.readDir(logDir)) {
      if (entry.isFile && entry.name.endsWith(".log")) {
        entries.push(entry);
      }
    }

    if (entries.length > 0) {
      // Get the most recent log
      const recentLog = entries[entries.length - 1]!;
      const logPath = `${logDir}/${recentLog.name}`;
      const content = await Deno.readTextFile(logPath);

      // Look for error patterns
      const patterns = [
        {
          regex: /CUDA.*error/i,
          category: "gpu" as const,
          message: "CUDA initialization error",
        },
        {
          regex: /OpenCL.*error/i,
          category: "gpu" as const,
          message: "OpenCL initialization error",
        },
        {
          regex: /segmentation fault/i,
          category: "libs" as const,
          message: "Segmentation fault detected",
        },
        {
          regex: /permission denied/i,
          category: "permissions" as const,
          message: "Permission denied errors",
        },
        {
          regex: /out of memory/i,
          category: "memory" as const,
          message: "Out of memory error",
        },
      ];

      for (const pattern of patterns) {
        if (pattern.regex.test(content)) {
          results.push({
            category: pattern.category,
            severity: "critical",
            message: pattern.message,
            details: { log: recentLog!.name },
          });
        }
      }
    }
  } catch {
    // Log directory doesn't exist or can't be read
  }

  return results;
}

/**
 * Launch DaVinci Resolve with diagnostics
 */
async function launchWithDiagnostics(): Promise<void> {
  const analyzer = new FiveWhyAnalyzer();

  logger.info("Starting DaVinci Resolve diagnostic launch...");

  // Why 1: Why does DaVinci Resolve hang?
  analyzer.addWhy(
    "Why does DaVinci Resolve hang on launch?",
    "The process starts but gets killed (signal 9 - SIGKILL)",
  );

  // Run preliminary checks
  const diagnostics: DiagnosticResult[] = [];

  diagnostics.push(...await checkGPU());
  diagnostics.push(...await checkResources());
  diagnostics.push(...await checkLibraries());
  diagnostics.push(...await checkPermissions());
  diagnostics.push(...checkEnvironment());
  diagnostics.push(...await analyzeCrashLogs());

  // Display diagnostic results
  const critical = diagnostics.filter((d) => d.severity === "critical");
  const warnings = diagnostics.filter((d) => d.severity === "warning");

  if (critical.length > 0) {
    logger.error(`Found ${critical.length} critical issues:`);
    for (const issue of critical) {
      logger.error(`  [${issue.category}] ${issue.message}`);
      if (issue.fix) {
        logger.info(`    Fix: ${issue.fix}`);
      }
    }

    // Why 2: Why is the process being killed?
    analyzer.addWhy(
      "Why is the process being killed with SIGKILL?",
      critical[0]?.message || "Critical system issue detected",
    );
  }

  if (warnings.length > 0) {
    logger.warn(`Found ${warnings.length} warnings:`);
    for (const warning of warnings) {
      logger.warn(`  [${warning.category}] ${warning.message}`);
    }
  }

  // Try to launch with monitoring
  logger.info("Attempting to launch DaVinci Resolve with monitoring...");

  // Set up environment with debugging
  const env: Record<string, string> = {
    ...Deno.env.toObject(),
    // Debug environment variables
    "QT_DEBUG_PLUGINS": "1",
    "LIBGL_DEBUG": "verbose",
    "MESA_DEBUG": "1",
    "CUDA_LAUNCH_BLOCKING": "1",
    // Disable GPU features that might cause issues
    "RESOLVE_CUDA_FORCE": "0", // Try without CUDA first
    "__GL_SYNC_TO_VBLANK": "0",
    // Core dumps
    "RESOLVE_ENABLE_CRASH_HANDLER": "1",
  };

  // Launch with strace for system call tracing
  const straceCmd = new Deno.Command("strace", {
    args: [
      "-f", // Follow forks
      "-e",
      "trace=open,openat,access,stat,execve", // Trace file operations
      "-o",
      "/tmp/davinci-strace.log",
      "/opt/resolve/bin/resolve",
    ],
    env,
    stdin: "null",
    stdout: "piped",
    stderr: "piped",
  });

  const process = straceCmd.spawn();
  const pid = process.pid?.toString() || "unknown";

  logger.info(`Launched DaVinci Resolve with PID: ${pid}`);

  // Monitor the process
  if (pid !== "unknown") {
    const monitorPromise = monitorProcess(pid, 10000);

    // Wait for process to exit or timeout
    const result = await Promise.race([
      process.output(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000)),
    ]);

    await monitorPromise;

    if (result) {
      // Process exited
      const { code, stderr } = result;
      const stderrStr = new TextDecoder().decode(stderr);

      logger.error(`Process exited with code: ${code}`);

      if (stderrStr) {
        logger.error("stderr output:");
        console.log(stderrStr.slice(0, 1000)); // First 1000 chars
      }

      // Why 3: Why did the process exit?
      if (code === 137 || code === 9) {
        analyzer.addWhy(
          "Why was the process killed with SIGKILL (code 137/9)?",
          "Likely killed by OOM killer or system resource limit",
        );

        // Why 4: Why did we hit resource limits?
        analyzer.addWhy(
          "Why did we hit system resource limits?",
          "Check dmesg for OOM killer messages: dmesg | grep -i 'killed process'",
        );

        // Why 5: Root cause
        analyzer.addWhy(
          "Why is DaVinci using excessive resources?",
          "Possible GPU memory allocation failure or library conflict",
        );

        analyzer.setRootCause(
          "GPU initialization failure causing excessive memory allocation attempts",
        );
      }
    } else {
      logger.info("Process still running after 10 seconds");

      // Check if window appeared
      const xwinResult = await runCommand(["xwininfo", "-root", "-tree"]);
      if (
        xwinResult.success &&
        xwinResult.stdout.toLowerCase().includes("resolve")
      ) {
        logger.success("DaVinci Resolve window detected!");
      } else {
        logger.warn("No DaVinci Resolve window detected");
      }
    }

    // Analyze strace output
    try {
      const straceLog = await Deno.readTextFile("/tmp/davinci-strace.log");
      const enoentCount = (straceLog.match(/ENOENT/g) || []).length;
      const eaccessCount = (straceLog.match(/EACCES/g) || []).length;

      if (enoentCount > 100) {
        logger.warn(
          `High number of missing files: ${enoentCount} ENOENT errors`,
        );
      }
      if (eaccessCount > 0) {
        logger.error(`Permission denied errors: ${eaccessCount} EACCES errors`);
      }
    } catch {
      // Couldn't read strace log
    }
  }

  // Display five-why analysis
  console.log("\n" + analyzer.getAnalysis());

  // Suggest next steps
  if (critical.length > 0) {
    logger.info("\n=== Recommended Actions ===");
    logger.info("1. Fix all critical issues listed above");
    logger.info("2. Check system logs: journalctl -xe | grep -i resolve");
    logger.info("3. Check for OOM killer: dmesg | grep -i 'killed process'");
    logger.info(
      "4. Try launching without GPU: RESOLVE_CUDA_FORCE=0 /opt/resolve/bin/resolve",
    );
    logger.info("5. Reinstall DaVinci Resolve if library issues persist");
  }
}

// Run diagnostics
if (import.meta.main) {
  try {
    await launchWithDiagnostics();
  } catch (error) {
    logger.error(`Diagnostic failed: ${error}`);
    Deno.exit(1);
  }
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
