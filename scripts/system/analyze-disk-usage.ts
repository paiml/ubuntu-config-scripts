#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-env

import { logger } from "../lib/logger.ts";
import { commandExists, parseArgs, runCommand } from "../lib/common.ts";
import { z } from "../../deps.ts";
import { join, resolve } from "../../deps.ts";

const ConfigSchema = z.object({
  path: z.string().default("."),
  threshold: z.number().min(0).default(100), // MB
  limit: z.number().min(1).default(20),
  humanReadable: z.boolean().default(true),
  showRclean: z.boolean().default(true),
  depth: z.number().min(1).max(10).default(3),
  excludePatterns: z.array(z.string()).default([]),
});

type Config = z.infer<typeof ConfigSchema>;

interface DiskUsageItem {
  path: string;
  size: number;
  sizeHuman: string;
  type: "file" | "directory";
  percentage?: number;
}

interface DiskSpaceInfo {
  filesystem: string;
  total: number;
  used: number;
  available: number;
  usedPercentage: number;
  mountPoint: string;
}

class DiskUsageAnalyzer {
  private config: Config;
  private totalSize = 0;
  private hasRclean = false;

  constructor(config: Config) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    this.hasRclean = await commandExists("rclean");
    if (this.config.showRclean && !this.hasRclean) {
      logger.info("rclean not found. Install it for cleanup suggestions:");
      logger.info("  cargo install rclean");
    }
  }

  private formatBytes(bytes: number): string {
    if (!this.config.humanReadable) {
      return `${bytes}`;
    }

    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  private async getItemSize(path: string): Promise<number> {
    try {
      const stat = await Deno.stat(path);

      if (stat.isFile) {
        return stat.size;
      } else if (stat.isDirectory) {
        // Use du for directory sizes
        const result = await runCommand(["du", "-sb", path]);
        if (result.success) {
          const match = result.stdout.match(/^(\d+)/);
          if (match && match[1]) {
            return parseInt(match[1], 10);
          }
        }
      }
    } catch (error) {
      logger.debug(`Failed to get size for ${path}: ${error}`);
    }
    return 0;
  }

  private shouldExclude(path: string): boolean {
    for (const pattern of this.config.excludePatterns) {
      if (path.includes(pattern)) {
        return true;
      }
    }

    // Default exclusions
    const defaultExclusions = [
      "/.git/",
      "/node_modules/",
      "/.cache/",
      "/dist/",
      "/coverage/",
      "/.venv/",
      "/__pycache__/",
    ];

    for (const exclusion of defaultExclusions) {
      if (path.includes(exclusion)) {
        return true;
      }
    }

    return false;
  }

  private async scanDirectory(
    dirPath: string,
    currentDepth: number = 0,
  ): Promise<DiskUsageItem[]> {
    const items: DiskUsageItem[] = [];

    if (currentDepth >= this.config.depth) {
      return items;
    }

    try {
      for await (const entry of Deno.readDir(dirPath)) {
        const fullPath = join(dirPath, entry.name);

        if (this.shouldExclude(fullPath)) {
          continue;
        }

        const size = await this.getItemSize(fullPath);
        const sizeInMB = size / (1024 * 1024);

        if (sizeInMB >= this.config.threshold) {
          items.push({
            path: fullPath,
            size,
            sizeHuman: this.formatBytes(size),
            type: entry.isDirectory ? "directory" : "file",
          });
        }

        if (entry.isDirectory && currentDepth < this.config.depth - 1) {
          const subItems = await this.scanDirectory(fullPath, currentDepth + 1);
          items.push(...subItems);
        }
      }
    } catch (error) {
      logger.debug(`Failed to scan directory ${dirPath}: ${error}`);
    }

    return items;
  }

  private async getDiskSpaceInfo(path: string): Promise<DiskSpaceInfo | null> {
    const result = await runCommand(["df", "-B1", path]);
    if (!result.success) {
      return null;
    }

    const lines = result.stdout.trim().split("\n");
    if (lines.length < 2) {
      return null;
    }

    const dataLine = lines[1];
    const parts = dataLine?.split(/\s+/).filter((p) => p.length > 0);

    if (!parts || parts.length < 6) {
      return null;
    }

    return {
      filesystem: parts[0]!,
      total: parseInt(parts[1]!, 10),
      used: parseInt(parts[2]!, 10),
      available: parseInt(parts[3]!, 10),
      usedPercentage: parseInt(parts[4]!.replace("%", ""), 10),
      mountPoint: parts[5]!,
    };
  }

  private async findLargeSystemDirs(): Promise<DiskUsageItem[]> {
    const systemDirs = [
      "/var/log",
      "/var/cache",
      "/tmp",
      "/var/tmp",
      `${Deno.env.get("HOME")}/.cache`,
      `${Deno.env.get("HOME")}/.local/share/Trash`,
      `${Deno.env.get("HOME")}/Downloads`,
      `${Deno.env.get("HOME")}/snap`,
      "/var/lib/snapd/cache",
      "/var/lib/docker",
      "/var/lib/apt/lists",
    ];

    const items: DiskUsageItem[] = [];

    for (const dir of systemDirs) {
      try {
        await Deno.stat(dir);
        const size = await this.getItemSize(dir);
        const sizeInMB = size / (1024 * 1024);

        if (sizeInMB >= this.config.threshold) {
          items.push({
            path: dir,
            size,
            sizeHuman: this.formatBytes(size),
            type: "directory",
          });
        }
      } catch {
        // Directory doesn't exist or no permission
      }
    }

    return items;
  }

  private suggestRcleanTargets(items: DiskUsageItem[]): void {
    if (!this.hasRclean || !this.config.showRclean) {
      return;
    }

    const cleanablePatterns = [
      { pattern: /\.cache/, description: "cache directories" },
      { pattern: /node_modules/, description: "Node.js dependencies" },
      { pattern: /\.venv|venv/, description: "Python virtual environments" },
      { pattern: /target\/debug/, description: "Rust debug builds" },
      { pattern: /dist|build/, description: "build artifacts" },
      { pattern: /\.log$/, description: "log files" },
      { pattern: /tmp|temp/i, description: "temporary files" },
      { pattern: /Trash/, description: "trash/recycle bin" },
    ];

    const suggestions = new Map<string, string[]>();

    for (const item of items) {
      for (const { pattern, description } of cleanablePatterns) {
        if (pattern.test(item.path)) {
          if (!suggestions.has(description)) {
            suggestions.set(description, []);
          }
          suggestions.get(description)!.push(item.path);
        }
      }
    }

    if (suggestions.size > 0) {
      console.log("\n📦 Cleanup Suggestions (using rclean):");
      console.log("=".repeat(60));

      for (const [description, paths] of suggestions) {
        console.log(`\n🧹 Found ${description}:`);
        for (const path of paths.slice(0, 3)) {
          console.log(`   rclean ${path}`);
        }
        if (paths.length > 3) {
          console.log(`   ... and ${paths.length - 3} more`);
        }
      }

      console.log(
        "\n💡 Tip: Run 'rclean' in interactive mode to review before cleaning",
      );
    }
  }

  async analyze(): Promise<void> {
    const targetPath = resolve(this.config.path);

    logger.info(`Analyzing disk usage for: ${targetPath}`);
    logger.info(`Threshold: ${this.config.threshold} MB`);
    logger.info(`Depth: ${this.config.depth}`);

    // Get disk space info
    const diskInfo = await this.getDiskSpaceInfo(targetPath);
    if (diskInfo) {
      console.log("\n💾 Disk Space Information:");
      console.log("=".repeat(60));
      console.log(`Filesystem:     ${diskInfo.filesystem}`);
      console.log(`Mount Point:    ${diskInfo.mountPoint}`);
      console.log(`Total Space:    ${this.formatBytes(diskInfo.total)}`);
      console.log(
        `Used Space:     ${
          this.formatBytes(diskInfo.used)
        } (${diskInfo.usedPercentage}%)`,
      );
      console.log(`Available:      ${this.formatBytes(diskInfo.available)}`);

      if (diskInfo.usedPercentage > 90) {
        console.log("⚠️  WARNING: Disk usage is above 90%!");
      } else if (diskInfo.usedPercentage > 80) {
        console.log("⚠️  WARNING: Disk usage is above 80%");
      }
    }

    // Scan for large files and directories
    logger.info("\nScanning for large files and directories...");
    const items = await this.scanDirectory(targetPath);

    // Add system directories if analyzing root or home
    if (targetPath === "/" || targetPath === Deno.env.get("HOME")) {
      const systemItems = await this.findLargeSystemDirs();
      items.push(...systemItems);
    }

    // Calculate total size
    this.totalSize = items.reduce((sum, item) => sum + item.size, 0);

    // Sort by size (largest first)
    items.sort((a, b) => b.size - a.size);

    // Calculate percentages
    for (const item of items) {
      item.percentage = (item.size / this.totalSize) * 100;
    }

    // Display results
    const displayItems = items.slice(0, this.config.limit);

    console.log("\n📊 Top Large Files and Directories:");
    console.log("=".repeat(60));
    console.log(`${"Size".padEnd(12)} ${"Type".padEnd(10)} ${"Path"}`);
    console.log("-".repeat(60));

    for (const item of displayItems) {
      const typeIcon = item.type === "directory" ? "📁" : "📄";
      const sizeStr = item.sizeHuman.padEnd(12);
      const typeStr = `${typeIcon} ${item.type}`.padEnd(10);
      console.log(`${sizeStr} ${typeStr} ${item.path}`);

      if (item.percentage && item.percentage > 1) {
        console.log(
          `${"".padEnd(12)} ${"".padEnd(10)} (${
            item.percentage.toFixed(1)
          }% of scanned total)`,
        );
      }
    }

    if (items.length > this.config.limit) {
      console.log(
        `\n... and ${
          items.length - this.config.limit
        } more items above threshold`,
      );
    }

    console.log("\n📈 Summary:");
    console.log("=".repeat(60));
    console.log(`Total items found: ${items.length}`);
    console.log(
      `Total size of large items: ${this.formatBytes(this.totalSize)}`,
    );

    // Suggest rclean targets
    this.suggestRcleanTargets(displayItems);

    // Additional cleanup suggestions
    console.log("\n🔧 General Cleanup Commands:");
    console.log("=".repeat(60));
    console.log("# Clean APT cache:");
    console.log("  sudo apt-get clean");
    console.log("  sudo apt-get autoremove");
    console.log("\n# Clean snap cache:");
    console.log("  sudo snap set system refresh.retain=2");
    console.log("  sudo rm -rf /var/lib/snapd/cache/*");
    console.log("\n# Clean journal logs (keep last 7 days):");
    console.log("  sudo journalctl --vacuum-time=7d");
    console.log("\n# Find and remove old kernels:");
    console.log("  sudo apt-get autoremove --purge");

    if (this.hasRclean) {
      console.log("\n# Interactive cleanup with rclean:");
      console.log("  rclean");
    }
  }
}

async function main() {
  const args = parseArgs(Deno.args);

  if (args["help"]) {
    console.log(`
Disk Usage Analyzer - Identify large files and directories

Usage: analyze-disk-usage.ts [OPTIONS] [PATH]

Options:
  --threshold <MB>    Minimum size in MB to report (default: 100)
  --limit <N>         Maximum number of items to display (default: 20)
  --depth <N>         Maximum directory depth to scan (default: 3)
  --no-human          Show sizes in bytes instead of human-readable format
  --no-rclean         Don't show rclean suggestions
  --exclude <pattern> Exclude paths matching pattern (can be used multiple times)
  --help              Show this help message

Examples:
  # Analyze current directory
  ./analyze-disk-usage.ts

  # Analyze home directory with 50MB threshold
  ./analyze-disk-usage.ts --threshold 50 ~

  # Analyze system root with depth limit
  sudo ./analyze-disk-usage.ts --depth 2 /

  # Exclude specific patterns
  ./analyze-disk-usage.ts --exclude .git --exclude node_modules
`);
    Deno.exit(0);
  }

  try {
    // Parse configuration
    // Get positional arguments
    const positionalArgs = Deno.args.filter((arg) => !arg.startsWith("-"));
    const pathArg = positionalArgs[0] || args["path"] || ".";

    const config = ConfigSchema.parse({
      path: pathArg,
      threshold: args["threshold"] ? Number(args["threshold"]) : 100,
      limit: args["limit"] ? Number(args["limit"]) : 20,
      depth: args["depth"] ? Number(args["depth"]) : 3,
      humanReadable: args["no-human"] !== true,
      showRclean: args["no-rclean"] !== true,
      excludePatterns: Array.isArray(args["exclude"])
        ? args["exclude"] as string[]
        : args["exclude"]
        ? [String(args["exclude"])]
        : [],
    });

    const analyzer = new DiskUsageAnalyzer(config);
    await analyzer.initialize();
    await analyzer.analyze();
  } catch (error) {
    logger.error(`Failed to analyze disk usage: ${error}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}

export {
  type Config,
  type DiskSpaceInfo,
  DiskUsageAnalyzer,
  type DiskUsageItem,
};
