#!/usr/bin/env -S deno run --allow-run --allow-read

import { logger } from "../lib/logger.ts";
import { commandExists, runCommand } from "../lib/common.ts";

/**
 * Check if vim is installed
 */
export async function isVimInstalled(): Promise<boolean> {
  return await commandExists("vim");
}

/**
 * Get vim version if installed
 */
export async function getVimVersion(): Promise<string | null> {
  if (!await isVimInstalled()) {
    return null;
  }

  const result = await runCommand(["vim", "--version"]);
  if (!result.success) {
    return null;
  }

  // Parse version from output like "VIM - Vi IMproved 8.2"
  const match = result.stdout.match(/VIM - Vi IMproved (\d+\.\d+)/);
  return match?.[1] ?? null;
}

/**
 * Install vim using apt
 */
export async function installVim(): Promise<boolean> {
  logger.info("Installing vim...");

  // Update package list
  const updateResult = await runCommand(["sudo", "apt", "update"]);
  if (!updateResult.success) {
    logger.error("Failed to update package list");
    return false;
  }

  // Install vim
  const installResult = await runCommand([
    "sudo",
    "apt",
    "install",
    "-y",
    "vim",
  ]);
  if (!installResult.success) {
    logger.error("Failed to install vim");
    logger.error(installResult.stderr);
    return false;
  }

  logger.success("Vim installed successfully!");
  return true;
}

async function main() {
  logger.info("Checking vim installation...");

  if (await isVimInstalled()) {
    const version = await getVimVersion();
    logger.success(
      `Vim is already installed (version ${version ?? "unknown"})`,
    );
    return;
  }

  logger.info("Vim is not installed");
  const success = await installVim();

  if (!success) {
    Deno.exit(1);
  }

  const version = await getVimVersion();
  logger.success(`Installation complete! Vim version: ${version ?? "unknown"}`);
}

if (import.meta.main) {
  main();
}
