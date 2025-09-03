#!/usr/bin/env -S deno run --allow-all

/**
 * Apply the Reddit/community fix for DaVinci Resolve on Ubuntu 24.04
 * This moves conflicting libraries so DaVinci uses system versions
 */

import { logger } from "../lib/logger.ts";
import { existsSync } from "https://deno.land/std@0.208.0/fs/mod.ts";

async function applyRedditFix(): Promise<void> {
  logger.info("Applying Reddit/community fix for DaVinci Resolve on Ubuntu 24.04...");
  
  const resolveLibsPath = "/opt/resolve/libs";
  const backupPath = `${resolveLibsPath}/not_used`;
  
  // Create backup directory
  logger.info("Creating backup directory for conflicting libraries...");
  const mkdirProc = new Deno.Command("sudo", {
    args: ["mkdir", "-p", backupPath],
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });
  await mkdirProc.output();
  
  // List of libraries to move (based on Reddit solutions)
  const librariesToMove = [
    "libglib-2.0.so*",
    "libgio*",
    "libgmodule*",
    "libgdk_pixbuf*",  // Also move gdk_pixbuf as it's causing issues
  ];
  
  logger.info("Moving conflicting libraries...");
  
  for (const libPattern of librariesToMove) {
    logger.info(`Moving ${libPattern}...`);
    
    // Use bash to handle wildcards
    const mvProc = new Deno.Command("bash", {
      args: [
        "-c",
        `sudo mv ${resolveLibsPath}/${libPattern} ${backupPath}/ 2>/dev/null || true`
      ],
      stdout: "inherit",
      stderr: "inherit",
    });
    await mvProc.output();
  }
  
  logger.success("Conflicting libraries moved!");
  logger.info("");
  logger.info("The fix forces DaVinci to use system libraries instead of bundled ones.");
  logger.info("Try launching DaVinci Resolve now with: davinci-resolve");
  logger.info("");
  logger.info("If you need to restore the original libraries:");
  logger.info(`  sudo mv ${backupPath}/* ${resolveLibsPath}/`);
}

// Main
if (import.meta.main) {
  try {
    await applyRedditFix();
  } catch (error) {
    logger.error("Fix failed", { error });
    Deno.exit(1);
  }
}