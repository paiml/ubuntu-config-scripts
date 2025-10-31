#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-env

import { logger } from "../lib/logger.ts";
import {
  commandExists,
  confirm,
  parseArgs,
  runCommand,
} from "../lib/common.ts";
import { z } from "../../deps.ts";
import { join } from "../../deps.ts";

const ConfigSchema = z.object({
  dryRun: z.boolean().default(false),
  interactive: z.boolean().default(true),
  cleanRust: z.boolean().default(true),
  cleanCache: z.boolean().default(true),
  cleanSystem: z.boolean().default(false),
  minSize: z.number().min(0).default(100), // MB
  paths: z.array(z.string()).default([]),
});

type Config = z.infer<typeof ConfigSchema>;

interface CleanupTarget {
  path: string;
  type: "rust-target" | "cache" | "system" | "custom";
  size: number;
  sizeHuman: string;
  command?: string;
  safe: boolean;
}

class DiskCleaner {
  private config: Config;
  private targets: CleanupTarget[] = [];
  private totalSaved = 0;
  private hasRclean = false;
  private hasCargo = false;

  constructor(config: Config) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    this.hasRclean = await commandExists("rclean");
    this.hasCargo = await commandExists("cargo");

    if (!this.hasCargo && this.config.cleanRust) {
      logger.warn("Cargo not found - Rust cleanup will be skipped");
    }
  }

  private formatBytes(bytes: number): string {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  private async getDirectorySize(path: string): Promise<number> {
    try {
      const result = await runCommand(["du", "-sb", path]);
      if (result.success) {
        const match = result.stdout.match(/^(\d+)/);
        if (match && match[1]) {
          return parseInt(match[1], 10);
        }
      }
    } catch (error) {
      logger.debug(`Failed to get size for ${path}: ${error}`);
    }
    return 0;
  }

  private async findRustProjects(): Promise<CleanupTarget[]> {
    const targets: CleanupTarget[] = [];
    const searchPaths = this.config.paths.length > 0
      ? this.config.paths
      : [`${Deno.env.get("HOME")}/src`];

    for (const searchPath of searchPaths) {
      try {
        // Find all Cargo.toml files
        const result = await runCommand([
          "find",
          searchPath,
          "-name",
          "Cargo.toml",
          "-type",
          "f",
          "-maxdepth",
          "3",
        ]);

        if (result.success) {
          const cargoFiles = result.stdout.trim().split("\n").filter((f) => f);

          for (const cargoFile of cargoFiles) {
            const projectDir = cargoFile.replace("/Cargo.toml", "");
            const targetDir = join(projectDir, "target");

            try {
              const stat = await Deno.stat(targetDir);
              if (stat.isDirectory) {
                const size = await this.getDirectorySize(targetDir);
                const sizeInMB = size / (1024 * 1024);

                if (sizeInMB >= this.config.minSize) {
                  targets.push({
                    path: targetDir,
                    type: "rust-target",
                    size,
                    sizeHuman: this.formatBytes(size),
                    command: `cd ${projectDir} && cargo clean`,
                    safe: true,
                  });
                }
              }
            } catch {
              // Target directory doesn't exist
            }
          }
        }
      } catch (error) {
        logger.debug(`Failed to search ${searchPath}: ${error}`);
      }
    }

    // Sort by size (largest first)
    targets.sort((a, b) => b.size - a.size);
    return targets;
  }

  private async findCacheDirectories(): Promise<CleanupTarget[]> {
    const targets: CleanupTarget[] = [];
    const home = Deno.env.get("HOME");

    const cachePaths = [
      `${home}/.cache`,
      `${home}/.local/share/Trash`,
      `${home}/snap/*/common/.cache`,
      "/tmp",
      "/var/tmp",
    ];

    for (const cachePath of cachePaths) {
      try {
        const stat = await Deno.stat(cachePath);
        if (stat.isDirectory) {
          const size = await this.getDirectorySize(cachePath);
          const sizeInMB = size / (1024 * 1024);

          if (sizeInMB >= this.config.minSize) {
            targets.push({
              path: cachePath,
              type: "cache",
              size,
              sizeHuman: this.formatBytes(size),
              command: cachePath.includes("Trash")
                ? `rm -rf ${cachePath}/*`
                : `find ${cachePath} -type f -atime +7 -delete`,
              safe: !cachePath.startsWith("/var"),
            });
          }
        }
      } catch {
        // Directory doesn't exist or no permission
      }
    }

    return targets;
  }

  private getSystemCleanupTargets(): CleanupTarget[] {
    return [
      {
        path: "APT cache",
        type: "system",
        size: 0,
        sizeHuman: "varies",
        command: "sudo apt-get clean && sudo apt-get autoremove -y",
        safe: true,
      },
      {
        path: "Snap cache",
        type: "system",
        size: 0,
        sizeHuman: "varies",
        command:
          "sudo snap set system refresh.retain=2 && sudo rm -rf /var/lib/snapd/cache/*",
        safe: true,
      },
      {
        path: "Journal logs (keep 7 days)",
        type: "system",
        size: 0,
        sizeHuman: "varies",
        command: "sudo journalctl --vacuum-time=7d",
        safe: true,
      },
      {
        path: "Old kernels",
        type: "system",
        size: 0,
        sizeHuman: "varies",
        command: "sudo apt-get autoremove --purge -y",
        safe: true,
      },
    ];
  }

  async scan(): Promise<void> {
    logger.info("Scanning for cleanup targets...");

    if (this.config.cleanRust && this.hasCargo) {
      logger.info("Finding Rust build directories...");
      const rustTargets = await this.findRustProjects();
      this.targets.push(...rustTargets);
    }

    if (this.config.cleanCache) {
      logger.info("Finding cache directories...");
      const cacheTargets = await this.findCacheDirectories();
      this.targets.push(...cacheTargets);
    }

    if (this.config.cleanSystem) {
      logger.info("Adding system cleanup targets...");
      const systemTargets = this.getSystemCleanupTargets();
      this.targets.push(...systemTargets);
    }

    // Calculate total size
    const totalSize = this.targets
      .filter((t) => t.type !== "system")
      .reduce((sum, t) => sum + t.size, 0);

    console.log("\n🎯 Cleanup Targets Found:");
    console.log("=".repeat(60));

    if (this.targets.length === 0) {
      console.log("No cleanup targets found above threshold.");
      return;
    }

    // Group by type
    const rustTargets = this.targets.filter((t) => t.type === "rust-target");
    const cacheTargets = this.targets.filter((t) => t.type === "cache");
    const systemTargets = this.targets.filter((t) => t.type === "system");

    if (rustTargets.length > 0) {
      console.log("\n📦 Rust Build Directories:");
      console.log("-".repeat(60));
      for (const target of rustTargets) {
        console.log(`  ${target.sizeHuman.padEnd(12)} ${target.path}`);
      }
    }

    if (cacheTargets.length > 0) {
      console.log("\n🗑️  Cache Directories:");
      console.log("-".repeat(60));
      for (const target of cacheTargets) {
        console.log(`  ${target.sizeHuman.padEnd(12)} ${target.path}`);
      }
    }

    if (systemTargets.length > 0) {
      console.log("\n⚙️  System Cleanup:");
      console.log("-".repeat(60));
      for (const target of systemTargets) {
        console.log(`  ${target.sizeHuman.padEnd(12)} ${target.path}`);
      }
    }

    console.log("\n📊 Summary:");
    console.log("=".repeat(60));
    console.log(`Total recoverable space: ${this.formatBytes(totalSize)}`);
    console.log(`Total targets: ${this.targets.length}`);
  }

  async clean(): Promise<void> {
    if (this.targets.length === 0) {
      logger.info("No targets to clean");
      return;
    }

    if (this.config.dryRun) {
      console.log("\n🔍 DRY RUN MODE - No changes will be made");
      console.log("=".repeat(60));
      for (const target of this.targets) {
        if (target.command) {
          console.log(`Would run: ${target.command}`);
        }
      }
      return;
    }

    if (this.config.interactive) {
      const proceed = await confirm(
        `\n⚠️  Ready to clean ${this.targets.length} targets. Continue?`,
        false,
      );
      if (!proceed) {
        console.log("Cleanup cancelled");
        return;
      }
    }

    console.log("\n🧹 Starting cleanup...");
    console.log("=".repeat(60));

    for (const target of this.targets) {
      if (this.config.interactive && !target.safe) {
        const clean = await confirm(
          `Clean ${target.path} (${target.sizeHuman})?`,
          false,
        );
        if (!clean) {
          console.log(`  Skipped: ${target.path}`);
          continue;
        }
      }

      console.log(`\n🔧 Cleaning: ${target.path}`);

      if (target.type === "rust-target" && this.hasCargo) {
        // Use cargo clean for Rust projects
        const projectDir = target.path.replace("/target", "");
        const result = await runCommand(["cargo", "clean"], {
          cwd: projectDir,
        });

        if (result.success) {
          console.log(`  ✅ Cleaned: ${target.path}`);
          this.totalSaved += target.size;
        } else {
          console.log(`  ❌ Failed: ${result.stderr}`);
        }
      } else if (target.command) {
        // Run the specified command
        const result = await runCommand(["sh", "-c", target.command]);

        if (result.success) {
          console.log(`  ✅ Cleaned: ${target.path}`);
          if (target.size > 0) {
            this.totalSaved += target.size;
          }
        } else {
          console.log(`  ❌ Failed: ${result.stderr}`);
        }
      }
    }

    console.log("\n✨ Cleanup Complete!");
    console.log("=".repeat(60));
    console.log(`Space freed: ${this.formatBytes(this.totalSaved)}`);

    // Show new disk usage
    const dfResult = await runCommand(["df", "-h", "/"]);
    if (dfResult.success) {
      console.log("\n💾 Current Disk Usage:");
      console.log(dfResult.stdout);
    }
  }

  async runInteractiveRclean(): Promise<void> {
    if (!this.hasRclean) {
      console.log("\n📦 rclean not found. Install it with:");
      console.log("  cargo install rclean");
      return;
    }

    console.log("\n🚀 Launching rclean for interactive cleanup...");
    const result = await runCommand(["rclean"], {
      cwd: Deno.env.get("HOME") + "/src",
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });

    if (!result.success) {
      logger.error("rclean failed to run");
    }
  }
}

async function main() {
  const args = parseArgs(Deno.args);

  if (args["help"]) {
    console.log(`
Disk Cleanup Tool - Free up disk space safely

Usage: cleanup-disk.ts [OPTIONS] [PATHS...]

Options:
  --dry-run           Show what would be cleaned without making changes
  --no-interactive    Don't prompt for confirmation (use with caution!)
  --no-rust          Skip Rust target directory cleanup
  --no-cache         Skip cache directory cleanup
  --system           Include system cleanup (APT, snap, etc.)
  --min-size <MB>    Minimum size to consider for cleanup (default: 100)
  --rclean           Use rclean for interactive cleanup
  --help             Show this help message

Examples:
  # Preview cleanup targets
  ./cleanup-disk.ts --dry-run

  # Clean Rust projects interactively
  ./cleanup-disk.ts

  # Clean everything including system
  ./cleanup-disk.ts --system

  # Clean specific directory
  ./cleanup-disk.ts ~/projects

  # Non-interactive cleanup (careful!)
  ./cleanup-disk.ts --no-interactive

  # Use rclean for interactive cleanup
  ./cleanup-disk.ts --rclean
`);
    Deno.exit(0);
  }

  try {
    // Parse configuration
    const positionalArgs = Deno.args.filter((arg) => !arg.startsWith("-"));

    const config = ConfigSchema.parse({
      dryRun: args["dry-run"] === true,
      interactive: args["no-interactive"] !== true,
      cleanRust: args["no-rust"] !== true,
      cleanCache: args["no-cache"] !== true,
      cleanSystem: args["system"] === true,
      minSize: args["min-size"] ? Number(args["min-size"]) : 100,
      paths: positionalArgs.length > 0 ? positionalArgs : [],
    });

    const cleaner = new DiskCleaner(config);
    await cleaner.initialize();

    if (args["rclean"]) {
      await cleaner.runInteractiveRclean();
    } else {
      await cleaner.scan();
      await cleaner.clean();
    }
  } catch (error) {
    logger.error(`Cleanup failed: ${error}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}

export { type CleanupTarget, type Config, DiskCleaner };
