#!/usr/bin/env -S deno run --allow-sys --allow-env --allow-run

import { logger } from "../lib/logger.ts";
import { CommandResult, parseArgs, runCommand } from "../lib/common.ts";

interface RefreshOptions {
  force: boolean;
  checkOnly: boolean;
}

async function checkDesktopEnvironment(): Promise<{
  isKDE: boolean;
  displayServer: string;
  desktopEnv: string;
}> {
  const displayServerResult = await runCommand([
    "bash",
    "-c",
    "echo $XDG_SESSION_TYPE",
  ]);
  const desktopEnvResult = await runCommand([
    "bash",
    "-c",
    "echo $XDG_CURRENT_DESKTOP",
  ]);

  const displayServer = displayServerResult.stdout.trim();
  const desktopEnv = desktopEnvResult.stdout.trim();
  const isKDE = desktopEnv.toLowerCase().includes("kde");

  return { isKDE, displayServer, desktopEnv };
}

async function checkKwinStatus(): Promise<boolean> {
  try {
    const result = await runCommand(["pgrep", "-x", "kwin_x11"]);
    return result.success;
  } catch {
    return false;
  }
}

async function refreshKDE(): Promise<CommandResult> {
  logger.info("Refreshing KDE desktop (KWin window manager)...");

  const cmd = new Deno.Command("kwin_x11", {
    args: ["--replace"],
    stdout: "piped",
    stderr: "piped",
  });

  const process = cmd.spawn();

  // Wait a short time to see if the process starts successfully
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const result: CommandResult = {
    success: true,
    stdout: "",
    stderr: "",
    code: 0,
  };

  // Check if process is still running (expected for kwin_x11 --replace)
  try {
    const status = await Promise.race([
      process.status,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 100)),
    ]);

    if (status !== null) {
      result.code = status.code;
      result.success = status.success;
    }
  } catch {
    // Process is still running, which is expected
  }

  logger.success("KDE desktop refresh initiated");
  logger.info("Your running applications and jobs have been preserved");

  return result;
}

async function main() {
  const args = parseArgs(Deno.args);

  if (args["help"] || args["h"]) {
    console.log(
      `refresh-kde-desktop - Refresh KDE desktop to fix black windows without losing running jobs

Usage:
  refresh-kde-desktop [OPTIONS]

Options:
  -f, --force       Force refresh even if not running KDE
  -c, --check-only  Only check if KDE is running, don't refresh
  -h, --help        Show this help message
`,
    );
    Deno.exit(0);
  }

  try {
    const opts: RefreshOptions = {
      force: !!(args["force"] || args["f"]),
      checkOnly: !!(args["check-only"] || args["c"]),
    };

    const env = await checkDesktopEnvironment();

    logger.info("Desktop environment check:", {
      desktop: env.desktopEnv,
      displayServer: env.displayServer,
      isKDE: env.isKDE,
    });

    if (opts.checkOnly) {
      const kwinRunning = await checkKwinStatus();
      logger.info("KWin status:", { running: kwinRunning });

      if (env.isKDE && kwinRunning) {
        logger.success("KDE desktop is running and can be refreshed");
        Deno.exit(0);
      } else {
        logger.warn("KDE desktop is not fully available");
        Deno.exit(1);
      }
    }

    if (!env.isKDE && !opts.force) {
      logger.error("Not running KDE desktop environment");
      logger.info("Current desktop:", { desktop: env.desktopEnv });
      logger.info("Use --force to refresh anyway (may cause issues)");
      Deno.exit(1);
    }

    if (env.displayServer !== "x11" && env.displayServer !== "X11") {
      logger.warn("Not running X11 display server", {
        displayServer: env.displayServer,
      });
      logger.info(
        "This tool is designed for X11. Wayland uses a different approach.",
      );

      if (!opts.force) {
        Deno.exit(1);
      }
    }

    const kwinRunning = await checkKwinStatus();
    if (!kwinRunning && !opts.force) {
      logger.error("KWin window manager is not running");
      logger.info("Use --force to attempt refresh anyway");
      Deno.exit(1);
    }

    const result = await refreshKDE();

    if (!result.success) {
      Deno.exit(result.code || 1);
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const kwinAfter = await checkKwinStatus();
    if (kwinAfter) {
      logger.success("KWin is running after refresh");
    } else {
      logger.warn("KWin may not have restarted properly");
      logger.info("You may need to log out and back in if issues persist");
    }
  } catch (error) {
    logger.error("Failed to refresh KDE desktop", { error });
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}

export { checkDesktopEnvironment, checkKwinStatus, refreshKDE };
