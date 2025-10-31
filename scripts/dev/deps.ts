#!/usr/bin/env -S deno run --allow-read --allow-write --allow-net --allow-run

import { Logger } from "../lib/logger.ts";
import { parseArgs } from "../lib/common.ts";
import {
  checkOutdated,
  cleanCache,
  lockDependencies,
  scanDependencies,
  updateDependencies,
  verifyDependencies,
} from "../lib/deps-manager.ts";

const logger = new Logger({ prefix: "deps" });

function showHelp() {
  console.log(`
Ubuntu Config Scripts - Dependency Manager

Usage: deps.ts [COMMAND] [OPTIONS]

Commands:
  list      List all dependencies
  outdated  Check for outdated dependencies
  update    Update dependencies to latest versions
  lock      Update the lock file (deno.lock)
  verify    Verify all dependencies are locked and cached
  clean     Clean the dependency cache

Options:
  --help, -h         Show this help message
  --dry-run          Show what would be updated without making changes
  --interactive, -i  Interactive mode for updates

Examples:
  deps.ts list                    # List all dependencies
  deps.ts outdated               # Check for outdated dependencies
  deps.ts update                 # Update all dependencies
  deps.ts update --dry-run       # Preview updates without applying
  deps.ts update --interactive   # Choose which dependencies to update
  deps.ts lock                   # Update deno.lock file
  deps.ts verify                 # Verify locked dependencies
`);
}

async function listDependencies() {
  const deps = await scanDependencies(".");

  if (deps.length === 0) {
    logger.info("No external dependencies found");
    return;
  }

  console.log("\n📦 Dependencies:");
  console.log("─".repeat(60));

  // Group by registry
  const grouped = new Map<string, typeof deps>();

  for (const dep of deps) {
    let registry = "other";
    if (dep.url.includes("deno.land/std")) {
      registry = "Deno Standard Library";
    } else if (dep.url.includes("deno.land/x")) {
      registry = "Deno Third Party";
    } else if (dep.url.includes("esm.sh")) {
      registry = "ESM.sh";
    }

    if (!grouped.has(registry)) {
      grouped.set(registry, []);
    }
    grouped.get(registry)!.push(dep);
  }

  for (const [registry, deps] of grouped) {
    console.log(`\n${registry}:`);
    for (const dep of deps) {
      const module = dep.url.split("/").slice(-1)[0] ?? "";
      console.log(`  ${module.padEnd(30)} ${dep.version}`);
    }
  }

  console.log(`\nTotal: ${deps.length} dependencies`);
}

async function checkOutdatedDeps() {
  const outdated = await checkOutdated();

  if (outdated.length === 0) {
    logger.success("All dependencies are up to date! 🎉");
    return;
  }

  console.log("\n⚠️  Outdated dependencies:");
  console.log("─".repeat(60));

  for (const dep of outdated) {
    const module = dep.url.split("/").slice(-1)[0] ?? "";
    console.log(`  ${module.padEnd(30)} ${dep.version}`);
  }

  console.log(`\nRun 'deps.ts update' to update dependencies`);
}

async function updateDeps(args: Record<string, string | boolean>) {
  const dryRun = args["dry-run"] === true;
  const interactive = args["interactive"] === true || args["i"] === true;

  if (dryRun) {
    logger.info("Running in dry-run mode (no changes will be made)");
  }

  const results = await updateDependencies({ dryRun, interactive });

  const updated = results.filter((r) => r.updated).length;
  const failed = results.filter((r) => !r.updated && r.error).length;

  if (updated > 0) {
    logger.success(`Updated ${updated} dependencies`);

    if (!dryRun) {
      logger.info("Updating lock file...");
      await lockDependencies();
    }
  } else {
    logger.info("No updates available");
  }

  if (failed > 0) {
    logger.warn(`Failed to update ${failed} dependencies`);
  }
}

async function main() {
  const args = parseArgs(Deno.args);
  const command = Deno.args[0];

  if (args["help"] || args["h"] || !command) {
    showHelp();
    return;
  }

  try {
    switch (command) {
      case "list":
        await listDependencies();
        break;

      case "outdated":
        await checkOutdatedDeps();
        break;

      case "update":
        await updateDeps(args);
        break;

      case "lock":
        await lockDependencies();
        break;

      case "verify":
        const verified = await verifyDependencies();
        if (!verified) {
          Deno.exit(1);
        }
        break;

      case "clean":
        await cleanCache();
        break;

      default:
        logger.error(`Unknown command: ${command}`);
        showHelp();
        Deno.exit(1);
    }
  } catch (error) {
    logger.error("Command failed", error);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
