#!/usr/bin/env -S deno run --allow-net --allow-run --allow-env

import { logger } from "../lib/logger.ts";
import { parseArgs } from "../lib/common.ts";
import {
  checkDenoVersion,
  ensureLatestDeno,
  updateDeno,
} from "../lib/deno-updater.ts";

async function main(): Promise<void> {
  const args = parseArgs(Deno.args);

  if (args["help"] || args["h"]) {
    console.log(`
Usage: update-deno.ts [OPTIONS]

Check and update Deno to the latest version.

Options:
  --check-only    Only check for updates, don't install
  --force         Force update even if already up to date
  --help, -h      Show this help message
  --verbose, -v   Enable verbose logging

Examples:
  update-deno.ts                # Check and auto-update if needed
  update-deno.ts --check-only   # Only check for updates
  update-deno.ts --force        # Force reinstall latest version
`);
    Deno.exit(0);
  }

  if (args["verbose"] || args["v"]) {
    logger.setLevel(0);
  }

  try {
    if (args["check-only"]) {
      const versionInfo = await checkDenoVersion();

      if (!versionInfo) {
        logger.error("Could not check Deno version");
        Deno.exit(1);
      }

      logger.info(`Current version: v${versionInfo.current}`);
      logger.info(`Latest version: v${versionInfo.latest}`);

      if (versionInfo.needsUpdate) {
        logger.warn("Update available!");
        logger.info("Run 'make update-deno' to update");
        Deno.exit(0);
      } else {
        logger.success("Deno is up to date!");
        Deno.exit(0);
      }
    }

    if (args["force"]) {
      logger.info("Force updating Deno...");
      const success = await updateDeno();
      Deno.exit(success ? 0 : 1);
    }

    // Default: check and update if needed
    await ensureLatestDeno();
  } catch (error) {
    logger.error(`Failed to update Deno: ${error}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
