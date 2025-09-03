#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-env

/**
 * Launch DaVinci Resolve with proper window positioning
 *
 * This script handles the window positioning bug where DaVinci Resolve
 * windows appear off-screen on Ubuntu systems.
 */

import { logger } from "../lib/logger.ts";
import { CommandResult, runCommand } from "../lib/common.ts";
import { z } from "../../deps.ts";

// Configuration schema
const LaunchConfigSchema = z.object({
  clearGeometry: z.boolean().default(true),
  moveWindows: z.boolean().default(true),
  killExisting: z.boolean().default(true),
  timeout: z.number().min(1000).max(30000).default(5000),
});

type LaunchConfig = z.infer<typeof LaunchConfigSchema>;

export interface WindowInfo {
  id: string;
  title: string;
  geometry: string;
  position: { x: number; y: number };
}

/**
 * Parse window information from xwininfo output
 */
export function parseWindowInfo(line: string): WindowInfo | null {
  // Parse lines like: 0x4800094 "resolve": ("resolve" "resolve")  960x720+0+-14  +0+-14
  // The format has: ID "title": (class info) geometry position
  // We want the last position values
  const match = line.match(
    /\s*(0x[0-9a-f]+)\s+"([^"]+)"[^)]*\)\s+(\d+x\d+[+-]\d+[+-]\d+)\s+([+-]\d+)([+-]\d+)/i,
  );
  if (!match) return null;

  const [, id, title, geometry, xStr, yStr] = match;
  if (!id || !title || !geometry || !xStr || !yStr) return null;

  return {
    id,
    title,
    geometry,
    position: {
      x: parseInt(xStr),
      y: parseInt(yStr),
    },
  };
}

/**
 * Check if a window is off-screen
 */
export function isWindowOffScreen(window: WindowInfo): boolean {
  return window.position.y < 0 || window.position.x < -100;
}

/**
 * Find DaVinci Resolve processes
 */
async function findResolveProcesses(): Promise<string[]> {
  const result = await runCommand(["pgrep", "-f", "/opt/resolve/bin/resolve"]);
  if (!result.success || !result.stdout.trim()) {
    return [];
  }
  return result.stdout.trim().split("\n").filter(Boolean);
}

/**
 * Kill existing DaVinci Resolve processes
 */
async function killExistingResolve(): Promise<void> {
  const pids = await findResolveProcesses();
  if (pids.length === 0) {
    logger.debug("No existing DaVinci Resolve processes found");
    return;
  }

  logger.info(
    `Terminating ${pids.length} existing DaVinci Resolve process(es)`,
  );

  for (const pid of pids) {
    const result = await runCommand(["kill", "-TERM", pid]);
    if (!result.success) {
      logger.warn(`Failed to terminate process ${pid}, trying SIGKILL`);
      await runCommand(["kill", "-KILL", pid]);
    }
  }

  // Wait for processes to exit
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

/**
 * Clear saved window geometry that might be corrupt
 */
async function clearGeometryCache(): Promise<void> {
  const home = Deno.env.get("HOME");
  if (!home) {
    logger.warn("HOME environment variable not set");
    return;
  }

  const configPaths = [
    `${home}/.local/share/DaVinciResolve/configs/config.dat`,
    `${home}/.config/Blackmagic Design/DaVinci Resolve/geometry.conf`,
  ];

  for (const path of configPaths) {
    try {
      const stat = await Deno.stat(path);
      if (stat.isFile) {
        const backupPath = `${path}.bak.${Date.now()}`;
        await Deno.rename(path, backupPath);
        logger.info(`Backed up geometry: ${path}`);
      }
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        logger.debug(`Could not access ${path}: ${error}`);
      }
    }
  }
}

/**
 * Set environment variables for proper window positioning
 */
function setWindowEnvironment(): void {
  const envVars = {
    QT_AUTO_SCREEN_SCALE_FACTOR: "0",
    QT_SCREEN_SCALE_FACTORS: "1",
    QT_SCALE_FACTOR: "1",
    QT_ENABLE_HIGHDPI_SCALING: "0",
    QT_QPA_PLATFORM: "xcb",
    SDL_VIDEO_WINDOW_POS: "100,100",
    _JAVA_AWT_WM_NONREPARENTING: "1",
  };

  for (const [key, value] of Object.entries(envVars)) {
    Deno.env.set(key, value);
    logger.debug(`Set ${key}=${value}`);
  }
}

/**
 * Find DaVinci Resolve windows
 */
async function findResolveWindows(): Promise<WindowInfo[]> {
  const result = await runCommand(["xwininfo", "-root", "-tree"]);
  if (!result.success) {
    logger.warn("Failed to get window information");
    return [];
  }

  const windows: WindowInfo[] = [];
  const lines = result.stdout.split("\n");

  for (const line of lines) {
    if (line.toLowerCase().includes("resolve")) {
      const window = parseWindowInfo(line);
      if (window) {
        windows.push(window);
      }
    }
  }

  return windows;
}

/**
 * Move off-screen windows to visible position
 */
async function moveOffScreenWindows(windows: WindowInfo[]): Promise<void> {
  const offScreenWindows = windows.filter(isWindowOffScreen);

  if (offScreenWindows.length === 0) {
    logger.info("All windows are properly positioned");
    return;
  }

  logger.info(
    `Found ${offScreenWindows.length} off-screen window(s), repositioning...`,
  );

  // Check if xdotool is available
  const xdotoolResult = await runCommand(["which", "xdotool"]);
  if (!xdotoolResult.success) {
    logger.warn("xdotool not found. Install with: sudo apt install xdotool");
    logger.info("Windows may need manual repositioning (Alt+F7)");
    return;
  }

  for (const window of offScreenWindows) {
    logger.debug(
      `Moving window ${window.id} from ${window.position.x},${window.position.y}`,
    );

    // Move window to visible position
    await runCommand(["xdotool", "windowmove", window.id, "100", "100"]);

    // Try to activate the window
    await runCommand(["xdotool", "windowactivate", window.id]);
  }
}

/**
 * Launch DaVinci Resolve with window positioning fixes
 */
export async function launchDavinciResolve(
  config: Partial<LaunchConfig> = {},
): Promise<CommandResult> {
  const cfg = LaunchConfigSchema.parse(config);

  logger.info("Launching DaVinci Resolve with window positioning fixes");

  try {
    // Kill existing processes if requested
    if (cfg.killExisting) {
      await killExistingResolve();
    }

    // Clear geometry cache if requested
    if (cfg.clearGeometry) {
      await clearGeometryCache();
    }

    // Set environment for proper window placement
    setWindowEnvironment();

    // Launch DaVinci Resolve
    logger.info("Starting DaVinci Resolve...");
    const launchResult = await runCommand([
      "/usr/local/bin/davinci-resolve",
    ], {
      stdin: "null",
      stdout: "piped",
      stderr: "piped",
    });

    // If launch was successful but process exited quickly, it might be running in background
    if (!launchResult.success && launchResult.code === 0) {
      logger.debug("DaVinci Resolve launched in background mode");
    }

    // Wait for windows to appear
    if (cfg.moveWindows) {
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Find and move any off-screen windows
      const windows = await findResolveWindows();
      if (windows.length > 0) {
        await moveOffScreenWindows(windows);
      }
    }

    // Check if process is running
    const pids = await findResolveProcesses();
    if (pids.length > 0) {
      logger.success(
        `DaVinci Resolve launched successfully (PID: ${pids.join(", ")})`,
      );
      logger.info("If windows don't appear, try pressing Alt+F7 to move them");
    } else {
      logger.warn("DaVinci Resolve process not found after launch");
      logger.info(
        "Check ~/.local/share/DaVinciResolve/logs/ for error details",
      );
    }

    return launchResult;
  } catch (error) {
    logger.error(`Failed to launch DaVinci Resolve: ${error}`);
    throw error;
  }
}

// Parse command-line arguments
function parseArgs(): Partial<LaunchConfig> {
  const args = Deno.args;
  const config: Partial<LaunchConfig> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--no-kill":
        config.killExisting = false;
        break;
      case "--no-clear":
        config.clearGeometry = false;
        break;
      case "--no-move":
        config.moveWindows = false;
        break;
      case "--timeout":
        if (i + 1 < args.length) {
          config.timeout = parseInt(args[++i]!);
        }
        break;
      case "--help":
        console.log(`
DaVinci Resolve Launcher - Fix window positioning issues

Usage: launch-davinci.ts [options]

Options:
  --no-kill      Don't kill existing DaVinci Resolve processes
  --no-clear     Don't clear saved geometry cache
  --no-move      Don't attempt to move off-screen windows
  --timeout MS   Set timeout for window detection (default: 5000)
  --help         Show this help message
`);
        Deno.exit(0);
    }
  }

  return config;
}

// Run if executed directly
if (import.meta.main) {
  try {
    const config = parseArgs();
    await launchDavinciResolve(config);
  } catch (error) {
    logger.error(`Error: ${error}`);
    Deno.exit(1);
  }
}

export {
  clearGeometryCache,
  findResolveProcesses,
  findResolveWindows,
  killExistingResolve,
  moveOffScreenWindows,
  setWindowEnvironment,
};
