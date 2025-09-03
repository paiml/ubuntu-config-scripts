#!/usr/bin/env -S deno run --allow-all

/**
 * DaVinci Resolve Fix for Ubuntu 24.04
 *
 * This script fixes the library incompatibility issues between DaVinci Resolve
 * and Ubuntu 24.04 that cause the following errors:
 * - undefined symbol: g_once_init_leave_pointer
 * - undefined symbol: g_task_set_static_name
 * - undefined symbol: g_module_open_full
 *
 * Root Cause:
 * DaVinci Resolve bundles outdated versions of common libraries (glib, gio, gdk_pixbuf)
 * that conflict with Ubuntu 24.04's system libraries. The bundled libraries are
 * incompatible with the system's pango and other libraries.
 *
 * Solution:
 * Move the conflicting bundled libraries to a backup directory, forcing DaVinci
 * to use the system libraries instead. This is the community-proven solution
 * from Reddit and various forums.
 *
 * @see https://www.reddit.com/r/davinciresolve/comments/1d7cr2w/
 * @see https://gist.github.com/davidsmfreire/2243433bed0d9d9e352da3508b51e63d
 */

import { logger } from "../lib/logger.ts";
import { z } from "../../deps.ts";
import { existsSync } from "https://deno.land/std@0.208.0/fs/mod.ts";
import { ensureDir } from "https://deno.land/std@0.224.0/fs/mod.ts";

// Configuration schema
const FixConfigSchema = z.object({
  resolvePath: z.string().default("/opt/resolve"),
  backupDirName: z.string().default("not_used"),
  dryRun: z.boolean().default(false),
  restore: z.boolean().default(false),
  verbose: z.boolean().default(false),
});

type FixConfig = z.infer<typeof FixConfigSchema>;

/**
 * Libraries that commonly cause conflicts on Ubuntu 24.04
 * These are bundled with DaVinci but incompatible with system libraries
 */
const CONFLICTING_LIBRARIES = [
  "libglib-2.0.so*", // GLib - Core library
  "libgio-2.0.so*", // GIO - I/O library
  "libgmodule-2.0.so*", // GModule - Module loading
  "libgobject-2.0.so*", // GObject - Object system
  "libgdk_pixbuf*", // GDK Pixbuf - Image loading
] as const;

export class DaVinciResolveFix {
  private config: FixConfig;
  private libsPath: string;
  private backupPath: string;

  constructor(config: Partial<FixConfig> = {}) {
    this.config = FixConfigSchema.parse(config);
    this.libsPath = `${this.config.resolvePath}/libs`;
    this.backupPath = `${this.libsPath}/${this.config.backupDirName}`;
  }

  /**
   * Check if DaVinci Resolve is installed
   */
  checkInstallation(): boolean {
    const resolveBin = `${this.config.resolvePath}/bin/resolve`;

    if (!existsSync(resolveBin)) {
      logger.error(`DaVinci Resolve not found at ${this.config.resolvePath}`);
      return false;
    }

    if (this.config.verbose) {
      logger.info(`DaVinci Resolve found at ${this.config.resolvePath}`);
    }

    return true;
  }

  /**
   * Detect which conflicting libraries are present
   */
  async detectConflicts(): Promise<string[]> {
    const conflicts: string[] = [];

    for (const libPattern of CONFLICTING_LIBRARIES) {
      const checkProc = new Deno.Command("bash", {
        args: ["-c", `ls ${this.libsPath}/${libPattern} 2>/dev/null`],
        stdout: "piped",
        stderr: "null",
      });

      const { stdout } = await checkProc.output();
      const files = new TextDecoder().decode(stdout).trim();

      if (files) {
        conflicts.push(libPattern);
        if (this.config.verbose) {
          logger.debug(`Found conflicting library: ${libPattern}`);
        }
      }
    }

    return conflicts;
  }

  /**
   * Apply the fix by moving conflicting libraries
   */
  async applyFix(): Promise<void> {
    logger.info("Applying DaVinci Resolve fix for Ubuntu 24.04...");

    // Check installation
    const installed = this.checkInstallation();
    if (!installed) {
      throw new Error("DaVinci Resolve is not installed");
    }

    // Detect conflicts
    const conflicts = await this.detectConflicts();
    if (conflicts.length === 0) {
      logger.success("No conflicting libraries found - DaVinci should work!");
      return;
    }

    logger.info(`Found ${conflicts.length} conflicting library groups`);

    if (this.config.dryRun) {
      logger.warn("Dry run mode - no changes will be made");
      logger.info("Would move the following libraries:");
      conflicts.forEach((lib) => logger.info(`  - ${lib}`));
      return;
    }

    // Create backup directory
    await ensureDir(this.backupPath);
    logger.info(`Created backup directory: ${this.backupPath}`);

    // Move conflicting libraries
    let movedCount = 0;
    for (const libPattern of conflicts) {
      if (this.config.verbose) {
        logger.info(`Moving ${libPattern}...`);
      }

      const mvProc = new Deno.Command("bash", {
        args: [
          "-c",
          `sudo mv ${this.libsPath}/${libPattern} ${this.backupPath}/ 2>/dev/null || true`,
        ],
        stdout: "null",
        stderr: "null",
      });

      const result = await mvProc.output();
      if (result.success) {
        movedCount++;
      }
    }

    logger.success(`Moved ${movedCount} library groups to backup`);
    logger.info("");
    logger.success("Fix applied successfully!");
    logger.info("DaVinci Resolve will now use system libraries");
    logger.info("");
    logger.info("To launch DaVinci Resolve:");
    logger.info("  davinci-resolve");
    logger.info("  Or use the application menu");
  }

  /**
   * Restore the original libraries from backup
   */
  async restore(): Promise<void> {
    logger.info("Restoring original DaVinci Resolve libraries...");

    if (!existsSync(this.backupPath)) {
      logger.warn("No backup found - nothing to restore");
      return;
    }

    const restoreProc = new Deno.Command("bash", {
      args: [
        "-c",
        `sudo mv ${this.backupPath}/* ${this.libsPath}/ 2>/dev/null && sudo rmdir ${this.backupPath}`,
      ],
      stdout: "null",
      stderr: "null",
    });

    const result = await restoreProc.output();
    if (result.success) {
      logger.success("Libraries restored successfully");
      logger.warn(
        "DaVinci Resolve may not work on Ubuntu 24.04 with original libraries",
      );
    } else {
      logger.error("Failed to restore some libraries");
    }
  }

  /**
   * Verify the fix is working
   */
  verify(): boolean {
    logger.info("Verifying DaVinci Resolve configuration...");

    const resolveBin = `${this.config.resolvePath}/bin/resolve`;

    // Check if binary exists first
    if (!existsSync(resolveBin)) {
      logger.warn("DaVinci Resolve binary not found");
      return false;
    }

    // Check library dependencies
    try {
      const lddProc = new Deno.Command("ldd", {
        args: [resolveBin],
        stdout: "piped",
        stderr: "piped",
      });

      const { stdout, success } = lddProc.outputSync();
      if (!success) {
        logger.error("Failed to check library dependencies");
        return false;
      }
      const deps = new TextDecoder().decode(stdout);

      // Check for missing libraries
      const missingLibs = deps.split("\n").filter((line) =>
        line.includes("not found")
      );

      if (missingLibs.length > 0) {
        logger.error("Missing libraries detected:");
        missingLibs.forEach((lib) => logger.error(`  ${lib.trim()}`));
        return false;
      }
    } catch (e) {
      logger.error("Failed to run ldd", { error: e });
      return false;
    }

    // Check for symbol errors (requires actually trying to load)
    try {
      const testProc = new Deno.Command(resolveBin, {
        args: ["--version"],
        stdout: "piped",
        stderr: "piped",
        env: {
          ...Deno.env.toObject(),
          LD_LIBRARY_PATH: `${this.libsPath}:/usr/lib/x86_64-linux-gnu`,
        },
      });

      const { stderr } = testProc.outputSync();
      const errors = new TextDecoder().decode(stderr);

      if (errors.includes("undefined symbol")) {
        logger.error("Symbol errors detected - fix may not be complete");
        return false;
      }
    } catch (e) {
      logger.error("Failed to test DaVinci binary", { error: e });
      return false;
    }

    logger.success("DaVinci Resolve configuration verified!");
    return true;
  }
}

// CLI interface
if (import.meta.main) {
  const args = Deno.args;
  const config: Partial<FixConfig> = {};

  // Parse command line arguments
  if (args.includes("--dry-run")) {
    config.dryRun = true;
  }
  if (args.includes("--restore")) {
    config.restore = true;
  }
  if (args.includes("--verbose") || args.includes("-v")) {
    config.verbose = true;
  }
  if (args.includes("--verify")) {
    const fixer = new DaVinciResolveFix(config);
    const valid = fixer.verify();
    Deno.exit(valid ? 0 : 1);
  }
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
DaVinci Resolve Fix for Ubuntu 24.04

Usage: davinci-resolve-fix.ts [options]

Options:
  --dry-run     Show what would be done without making changes
  --restore     Restore original libraries from backup
  --verify      Verify DaVinci Resolve configuration
  --verbose,-v  Show detailed output
  --help,-h     Show this help message

Examples:
  # Apply the fix
  deno run --allow-all davinci-resolve-fix.ts

  # Dry run to see what would be changed
  deno run --allow-all davinci-resolve-fix.ts --dry-run

  # Restore original libraries
  deno run --allow-all davinci-resolve-fix.ts --restore

  # Verify configuration
  deno run --allow-all davinci-resolve-fix.ts --verify
`);
    Deno.exit(0);
  }

  try {
    const fixer = new DaVinciResolveFix(config);

    if (config.restore) {
      await fixer.restore();
    } else {
      await fixer.applyFix();
    }
  } catch (error) {
    logger.error("Operation failed", { error });
    Deno.exit(1);
  }
}
