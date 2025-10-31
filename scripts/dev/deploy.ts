#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-env

import { logger } from "../lib/logger.ts";
import { parseArgs } from "../lib/common.ts";
import { createDeploymentPackage, deployBinaries } from "../lib/deploy.ts";
import { walk } from "@std/fs/walk.ts";

async function findScripts(category?: string): Promise<string[]> {
  const scripts: string[] = [];
  const baseDir = "scripts";

  for await (
    const entry of walk(baseDir, {
      includeFiles: true,
      includeDirs: false,
      exts: [".ts"],
    })
  ) {
    // Skip lib directory and test files
    if (entry.path.includes("/lib/") || entry.path.includes(".test.")) {
      continue;
    }

    // Filter by category if specified
    if (category && !entry.path.includes(`/${category}/`)) {
      continue;
    }

    scripts.push(entry.path);
  }

  return scripts.sort();
}

async function main(): Promise<void> {
  const args = parseArgs(Deno.args);

  if (args["help"] || args["h"]) {
    console.log(`
Usage: deploy.ts [OPTIONS]

Deploy Ubuntu Config Scripts as standalone binaries.

Options:
  --output <dir>      Output directory (default: dist)
  --category <name>   Only deploy scripts from specific category
  --targets <list>    Comma-separated list of targets (default: current platform)
  --package           Create deployment package (tar.gz)
  --list              List available scripts without building
  --help, -h          Show this help message
  --verbose, -v       Enable verbose logging

Available targets:
  x86_64-unknown-linux-gnu     Linux x64
  aarch64-unknown-linux-gnu    Linux ARM64
  x86_64-apple-darwin          macOS x64
  aarch64-apple-darwin         macOS ARM64
  x86_64-pc-windows-msvc       Windows x64

Examples:
  deploy.ts                                    # Deploy all scripts for current platform
  deploy.ts --category audio                   # Deploy only audio scripts
  deploy.ts --targets x86_64-unknown-linux-gnu # Deploy for specific target
  deploy.ts --package                          # Create distributable package
`);
    Deno.exit(0);
  }

  if (args["verbose"] || args["v"]) {
    logger.setLevel(0);
  }

  try {
    // Find scripts to deploy
    const category = args["category"] as string | undefined;
    const scripts = await findScripts(category);

    if (scripts.length === 0) {
      logger.error("No scripts found to deploy");
      Deno.exit(1);
    }

    if (args["list"]) {
      logger.info("Available scripts:");
      for (const script of scripts) {
        console.log(`  - ${script}`);
      }
      Deno.exit(0);
    }

    // Parse targets
    let targets: string[] | undefined;
    if (args["targets"]) {
      targets = (args["targets"] as string).split(",").map((t) => t.trim());
    }

    // Prepare script configurations
    const scriptConfigs = scripts.map((script) => {
      const name = script.split("/").pop()?.replace(".ts", "");
      return {
        source: script,
        ...(name ? { name } : {}),
        permissions: ["read", "write", "run", "net", "env"],
      };
    });

    const outputDir = (args["output"] as string) || "dist";

    logger.info(`Deploying ${scripts.length} scripts...`);

    if (args["package"]) {
      // Create deployment package
      const packagePath = await createDeploymentPackage({
        scripts: scriptConfigs,
        outputDir,
        ...(targets ? { targets } : {}),
        packageName: "ubuntu-config-scripts",
      });

      if (packagePath) {
        logger.success(`Deployment package created: ${packagePath}`);
        Deno.exit(0);
      } else {
        logger.error("Failed to create deployment package");
        Deno.exit(1);
      }
    } else {
      // Deploy binaries only
      const success = await deployBinaries({
        scripts: scriptConfigs,
        outputDir,
        ...(targets ? { targets } : {}),
      });

      if (success) {
        logger.success("Deployment completed successfully!");
        logger.info(`Binaries available in: ${outputDir}`);
        Deno.exit(0);
      } else {
        logger.error("Deployment failed");
        Deno.exit(1);
      }
    }
  } catch (error) {
    logger.error(`Deployment failed: ${error}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
