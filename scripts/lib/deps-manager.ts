import { Logger } from "./logger.ts";
import { runCommand } from "./common.ts";
import { exists } from "https://deno.land/std@0.224.0/fs/mod.ts";

const logger = new Logger({ prefix: "deps-manager" });

export interface DependencyInfo {
  url: string;
  version: string;
  specifier: string;
}

export interface UpdateResult {
  updated: boolean;
  from?: string;
  to?: string;
  error?: string;
}

/**
 * Parse dependencies from TypeScript files
 */
export async function scanDependencies(
  directory: string = ".",
): Promise<DependencyInfo[]> {
  const deps: DependencyInfo[] = [];
  const importRegex = /from\s+["']([^"']+)["']/g;
  const versionRegex = /@(v?\d+\.\d+\.\d+)/;

  async function scanDir(dir: string) {
    for await (const entry of Deno.readDir(dir)) {
      const path = `${dir}/${entry.name}`;

      if (
        entry.isDirectory && !path.includes("node_modules") &&
        !path.includes(".git") && !path.includes("coverage")
      ) {
        await scanDir(path);
      } else if (entry.isFile && entry.name.endsWith(".ts")) {
        const content = await Deno.readTextFile(path);
        let match;

        while ((match = importRegex.exec(content)) !== null) {
          const url = match[1];
          if (url && url.startsWith("http")) {
            const versionMatch = url.match(versionRegex);
            if (versionMatch && versionMatch[1]) {
              deps.push({
                url,
                version: versionMatch[1],
                specifier: url,
              });
            }
          }
        }
      }
    }
  }

  await scanDir(directory);

  // Remove duplicates
  const unique = new Map<string, DependencyInfo>();
  for (const dep of deps) {
    const key = dep.url.replace(versionRegex, "");
    if (!unique.has(key) || dep.version > (unique.get(key)?.version || "")) {
      unique.set(key, dep);
    }
  }

  return Array.from(unique.values());
}

/**
 * Check for outdated dependencies
 */
export async function checkOutdated(): Promise<DependencyInfo[]> {
  logger.info("Checking for outdated dependencies...");

  const deps = await scanDependencies(".");
  const outdated: DependencyInfo[] = [];

  for (const dep of deps) {
    if (dep.url.includes("deno.land/std")) {
      // For Deno std lib, check latest version
      try {
        const response = await fetch("https://api.deno.land/modules/std");
        const data = await response.json();
        const latestVersion = data.latest_version;

        if (latestVersion && dep.version !== latestVersion) {
          outdated.push({
            ...dep,
            version: `${dep.version} -> ${latestVersion}`,
          });
        }
      } catch (error) {
        logger.debug(`Failed to check std version: ${error}`);
      }
    }
    // Add more registries as needed (deno.land/x, etc.)
  }

  return outdated;
}

/**
 * Update all dependencies to latest versions
 */
export async function updateDependencies(
  options: { dryRun?: boolean; interactive?: boolean } = {},
): Promise<UpdateResult[]> {
  const results: UpdateResult[] = [];
  const deps = await scanDependencies(".");

  logger.info(`Found ${deps.length} dependencies`);

  for (const dep of deps) {
    if (dep.url.includes("deno.land/std")) {
      try {
        const response = await fetch("https://api.deno.land/modules/std");
        const data = await response.json();
        const latestVersion = data.latest_version;

        if (latestVersion && dep.version !== latestVersion) {
          const newUrl = dep.url.replace(dep.version, latestVersion);

          if (options.interactive) {
            logger.info(`Update ${dep.url} to ${latestVersion}? (y/n)`);
            const answer = prompt("> ");
            if (answer?.toLowerCase() !== "y") {
              continue;
            }
          }

          if (!options.dryRun) {
            await updateImportsInFiles(dep.url, newUrl);
          }

          results.push({
            updated: true,
            from: dep.version,
            to: latestVersion,
          });

          logger.success(
            `Updated ${
              dep.url.split("/").pop()
            } from ${dep.version} to ${latestVersion}`,
          );
        }
      } catch (error) {
        results.push({
          updated: false,
          error: String(error),
        });
      }
    }
  }

  return results;
}

/**
 * Update imports in all TypeScript files
 */
async function updateImportsInFiles(oldUrl: string, newUrl: string) {
  async function updateDir(dir: string) {
    for await (const entry of Deno.readDir(dir)) {
      const path = `${dir}/${entry.name}`;

      if (
        entry.isDirectory && !path.includes("node_modules") &&
        !path.includes(".git") && !path.includes("coverage")
      ) {
        await updateDir(path);
      } else if (entry.isFile && entry.name.endsWith(".ts")) {
        const content = await Deno.readTextFile(path);
        if (content.includes(oldUrl)) {
          const updated = content.replace(
            new RegExp(oldUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
            newUrl,
          );
          await Deno.writeTextFile(path, updated);
        }
      }
    }
  }

  await updateDir(".");
}

/**
 * Lock dependencies (update deno.lock)
 */
export async function lockDependencies(): Promise<boolean> {
  logger.info("Updating dependency lock file...");

  const result = await runCommand([
    "deno",
    "cache",
    "--lock=deno.lock",
    "--lock-write",
    "deps.ts",
  ], {
    cwd: ".",
  });

  if (!result.success) {
    logger.error("Failed to update lock file", result.stderr);
    return false;
  }

  logger.success("Lock file updated successfully");
  return true;
}

/**
 * Verify locked dependencies
 */
export async function verifyDependencies(): Promise<boolean> {
  logger.info("Verifying locked dependencies...");

  if (!await exists("deno.lock")) {
    logger.error("No deno.lock file found");
    return false;
  }

  const result = await runCommand([
    "deno",
    "cache",
    "--lock=deno.lock",
    "--cached-only",
    "deps.ts",
  ], {
    cwd: ".",
  });

  if (!result.success) {
    logger.error("Dependency verification failed", result.stderr);
    return false;
  }

  logger.success("All dependencies verified");
  return true;
}

/**
 * Clean dependency cache
 */
export async function cleanCache(): Promise<boolean> {
  logger.info("Cleaning dependency cache...");

  const result = await runCommand(["deno", "cache", "--reload"], {
    cwd: ".",
  });

  if (!result.success) {
    logger.error("Failed to clean cache", result.stderr);
    return false;
  }

  logger.success("Cache cleaned successfully");
  return true;
}
