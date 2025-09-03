#!/usr/bin/env -S deno run --allow-all

/**
 * DaVinci Resolve 20.1 Launcher
 * Fixes library symbol errors and ensures proper environment setup
 */

import { logger } from "../lib/logger.ts";
import { existsSync } from "https://deno.land/std@0.208.0/fs/mod.ts";
interface LaunchOptions {
  cleanEnvironment?: boolean;
  restoreLibraries?: boolean;
  usePreload?: boolean;
  skipVstScan?: boolean;
  forceCuda?: boolean;
}

export class DaVinciLauncher {
  private readonly resolvePath = "/opt/resolve";
  private readonly resolveExe = "/opt/resolve/bin/resolve";
  private readonly libsPath = "/opt/resolve/libs";
  private readonly disabledLibsPath = "/opt/resolve/libs/_disabled";

  constructor(private options: LaunchOptions = {}) {
    // Set defaults
    this.options = {
      cleanEnvironment: options.cleanEnvironment ?? true,
      restoreLibraries: options.restoreLibraries ?? false,
      usePreload: options.usePreload ?? false,
      skipVstScan: options.skipVstScan ?? true,
      forceCuda: options.forceCuda ?? false,
    };
  }

  /**
   * Kill any stuck DaVinci processes
   */
  async killStuckProcesses(): Promise<void> {
    try {
      const proc = new Deno.Command("pkill", {
        args: ["-f", "VstScanner"],
        stdout: "null",
        stderr: "null",
      });
      await proc.output();
      logger.info("Killed stuck VST scanner processes");
    } catch {
      // Process might not exist, that's fine
    }

    try {
      const proc = new Deno.Command("pkill", {
        args: ["-f", "resolve --"],
        stdout: "null",
        stderr: "null",
      });
      await proc.output();
      logger.info("Killed stuck DaVinci processes");
    } catch {
      // Process might not exist, that's fine
    }
  }

  /**
   * Restore previously disabled libraries
   */
  async restoreLibraries(): Promise<void> {
    if (!existsSync(this.disabledLibsPath)) {
      logger.debug("No disabled libraries found");
      return;
    }

    logger.info("Restoring bundled libraries...");
    try {
      const mvProc = new Deno.Command("sudo", {
        args: ["mv", `${this.disabledLibsPath}/*`, `${this.libsPath}/`],
        stdout: "null",
        stderr: "null",
      });
      await mvProc.output();
      
      const rmdirProc = new Deno.Command("sudo", {
        args: ["rmdir", this.disabledLibsPath],
        stdout: "null",
        stderr: "null",
      });
      await rmdirProc.output();
      logger.success("Libraries restored");
    } catch (error) {
      logger.warn("Failed to restore some libraries", { error });
    }
  }

  /**
   * Find CUDA library paths
   */
  findCudaPaths(): string[] {
    const cudaPaths: string[] = [];
    const potentialPaths = [
      "/usr/local/cuda-12/lib64",
      "/usr/local/cuda-11/lib64",
      "/usr/local/cuda/lib64",
      "/usr/lib/x86_64-linux-gnu",
      "/usr/lib/nvidia",
    ];

    for (const path of potentialPaths) {
      if (existsSync(path)) {
        cudaPaths.push(path);
        logger.debug(`Found CUDA path: ${path}`);
      }
    }

    return cudaPaths;
  }

  /**
   * Build environment variables for DaVinci
   */
  buildEnvironment(): Record<string, string> {
    const cudaPaths = this.findCudaPaths();

    // Build library path with DaVinci libs first
    const libraryPath = [
      this.libsPath,
      `${this.resolvePath}/bin`,
      ...cudaPaths,
    ].join(":");

    const baseEnv: Record<string, string> = {
      HOME: Deno.env.get("HOME") || "",
      USER: Deno.env.get("USER") || "",
      DISPLAY: Deno.env.get("DISPLAY") || ":0",
      PATH: `/opt/resolve/bin:/usr/bin:/bin:${Deno.env.get("PATH") || ""}`,
      LD_LIBRARY_PATH: libraryPath,
      __NV_PRIME_RENDER_OFFLOAD: "1",
      __GLX_VENDOR_LIBRARY_NAME: "nvidia",
    };

    // Add optional environment variables
    if (this.options.skipVstScan) {
      baseEnv["RESOLVE_SKIP_VST_SCAN"] = "1";
    }

    if (!this.options.forceCuda) {
      baseEnv["RESOLVE_CUDA_FORCE"] = "0";
    }

    // Add preload if requested
    if (this.options.usePreload) {
      const preloadLibs = [
        `${this.libsPath}/libglib-2.0.so.0`,
        `${this.libsPath}/libgio-2.0.so.0`,
        `${this.libsPath}/libgobject-2.0.so.0`,
      ].filter((lib) => existsSync(lib));

      if (preloadLibs.length > 0) {
        baseEnv["LD_PRELOAD"] = preloadLibs.join(":");
        logger.info("Using LD_PRELOAD for glib libraries");
      }
    }

    // Suppress Qt warnings
    baseEnv["QT_LOGGING_RULES"] = "*=false";

    return baseEnv;
  }

  /**
   * Launch DaVinci Resolve with proper environment
   */
  async launch(args: string[] = []): Promise<void> {
    logger.info("Starting DaVinci Resolve 20.1...");

    // Kill stuck processes first
    await this.killStuckProcesses();

    // Restore libraries if requested
    if (this.options.restoreLibraries) {
      await this.restoreLibraries();
    }

    // Check if DaVinci is installed
    if (!existsSync(this.resolveExe)) {
      throw new Error("DaVinci Resolve not found at /opt/resolve/bin/resolve");
    }

    const env = this.buildEnvironment();

    logger.info("Environment configuration:", {
      cleanEnvironment: this.options.cleanEnvironment,
      usePreload: this.options.usePreload,
      skipVstScan: this.options.skipVstScan,
      cudaPaths: this.findCudaPaths().length,
    });

    try {
      if (this.options.cleanEnvironment) {
        // Use env -i for clean environment
        logger.info("Launching with clean environment...");

        const envArgs = Object.entries(env)
          .flatMap(([key, value]) => [`${key}=${value}`]);

        const proc = new Deno.Command("env", {
          args: ["-i", ...envArgs, this.resolveExe, ...args],
          stdout: "inherit",
          stderr: "inherit",
          stdin: "inherit",
        });

        const result = await proc.output();
        if (!result.success) {
          throw new Error(`DaVinci exited with code ${result.code}`);
        }
      } else {
        // Launch with modified environment
        logger.info("Launching with modified environment...");

        const proc = new Deno.Command(this.resolveExe, {
          args,
          env,
          stdout: "inherit",
          stderr: "inherit",
          stdin: "inherit",
        });

        const result = await proc.output();
        if (!result.success) {
          throw new Error(`DaVinci exited with code ${result.code}`);
        }
      }

      logger.success("DaVinci Resolve closed normally");
    } catch (error) {
      logger.error("Failed to launch DaVinci Resolve", { error });
      throw error;
    }
  }

  /**
   * Try different launch strategies to find what works
   */
  async autoFix(args: string[] = []): Promise<void> {
    const strategies = [
      { cleanEnvironment: true, usePreload: false, name: "Clean environment" },
      { cleanEnvironment: false, usePreload: true, name: "With preload" },
      { cleanEnvironment: true, usePreload: true, name: "Clean + preload" },
      {
        cleanEnvironment: false,
        usePreload: false,
        restoreLibraries: true,
        name: "Restored libs",
      },
    ];

    for (const strategy of strategies) {
      logger.info(`Trying strategy: ${strategy.name}`);

      this.options = {
        cleanEnvironment: strategy.cleanEnvironment ?? this.options.cleanEnvironment,
        restoreLibraries: strategy.restoreLibraries ?? this.options.restoreLibraries,
        usePreload: strategy.usePreload ?? this.options.usePreload,
        skipVstScan: this.options.skipVstScan,
        forceCuda: this.options.forceCuda,
      };

      try {
        await this.launch(args);
        logger.success(`Strategy "${strategy.name}" worked!`);
        return;
      } catch (error) {
        logger.warn(`Strategy "${strategy.name}" failed`, { error });
        continue;
      }
    }

    logger.error("All launch strategies failed");
    throw new Error("Unable to launch DaVinci Resolve with any strategy");
  }
}

// Main execution
if (import.meta.main) {
  const launcher = new DaVinciLauncher({
    cleanEnvironment: true,
    skipVstScan: true,
    forceCuda: false,
  });

  try {
    // Get command line arguments
    const args = Deno.args;

    // Check for auto-fix flag
    if (args.includes("--auto-fix")) {
      const filteredArgs = args.filter((arg) => arg !== "--auto-fix");
      await launcher.autoFix(filteredArgs);
    } else {
      await launcher.launch(args);
    }
  } catch (error) {
    logger.error("Launch failed", { error });
    Deno.exit(1);
  }
}
