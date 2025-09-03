#!/usr/bin/env -S deno run --allow-all

import { logger } from "../lib/logger.ts";
import { parseArgs, runCommand } from "../lib/common.ts";

/**
 * Wrapper script to run other scripts with sudo privileges
 * This allows Claude Code to execute privileged operations and see output
 */

async function main(): Promise<void> {
  parseArgs(Deno.args); // Parse args for validation
  const scriptArgs = Deno.args.filter((arg) => !arg.startsWith("--"));

  if (scriptArgs.length === 0) {
    logger.error("Usage: sudo-wrapper.ts <script-path> [args...]");
    logger.info(
      "Example: sudo-wrapper.ts scripts/system/configure-davinci.ts --dry-run",
    );
    Deno.exit(1);
  }

  const scriptPath = scriptArgs[0];
  const scriptArgsRest = scriptArgs.slice(1);

  // Check if script exists
  try {
    await Deno.stat(scriptPath!);
  } catch {
    logger.error(`Script not found: ${scriptPath}`);
    Deno.exit(1);
  }

  // Build the sudo command
  const denoPath = Deno.env.get("DENO_PATH") || "/home/noah/.local/bin/deno";
  const sudoCmd = [
    "sudo",
    "-E", // Preserve environment
    denoPath,
    "run",
    "--allow-all",
    scriptPath!,
    ...scriptArgsRest,
  ];

  logger.info(`Running with sudo: ${scriptPath}`);

  // Execute with sudo
  const result = await runCommand(sudoCmd, {
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });

  if (!result.success) {
    logger.error(`Script failed with exit code: ${result.code}`);
    Deno.exit(result.code);
  }

  logger.success("✓ Script completed successfully");
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    logger.error(`Error: ${error}`);
    Deno.exit(1);
  }
}
