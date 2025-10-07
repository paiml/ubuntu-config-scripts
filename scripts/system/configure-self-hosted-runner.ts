#!/usr/bin/env -S deno run --allow-read --allow-run --allow-env --allow-net

/**
 * Configure Self-Hosted GitHub Actions Runner
 *
 * This script configures a machine as a self-hosted GitHub Actions runner by:
 * 1. Reading configuration from YAML file
 * 2. Installing required system packages
 * 3. Installing Rust toolchain via rustup
 * 4. Installing Deno
 * 5. Verifying all installations
 *
 * Usage:
 *   deno run --allow-read --allow-run --allow-env --allow-net configure-self-hosted-runner.ts [--config path/to/config.yaml]
 */

import { parse } from "https://deno.land/std@0.224.0/yaml/mod.ts";
import { parse as parseArgs } from "https://deno.land/std@0.224.0/flags/mod.ts";
import { logger } from "../lib/logger.ts";
import { runCommand } from "../lib/common.ts";
import { type InferType, z } from "../lib/schema.ts";

// Schema definitions
const PackageSchema = z.object({
  system: z.optional(z.array(z.string())),
  development: z.optional(z.array(z.string())),
  rust: z.optional(
    z.object({
      install_method: z.literal("rustup"),
      components: z.array(z.string()),
    }),
  ),
  javascript: z.optional(
    z.array(
      z.object({
        name: z.string(),
        install_method: z.string(),
        url: z.string(),
      }),
    ),
  ),
  docker: z.optional(
    z.object({
      enabled: z.boolean(),
      packages: z.array(z.string()),
    }),
  ),
});

const RunnerConfigSchema = z.object({
  runner: z.object({
    name: z.string(),
    labels: z.array(z.string()),
    work_directory: z.string(),
  }),
  packages: PackageSchema,
  github: z.object({
    organization: z.string(),
    version: z.string(),
  }),
  system: z.object({
    update_system: z.boolean(),
    clean_cache: z.boolean(),
    restart_services: z.boolean(),
  }),
});

export type RunnerConfig = InferType<typeof RunnerConfigSchema>;

/**
 * Load and parse YAML configuration file
 */
export async function loadConfig(configPath: string): Promise<RunnerConfig> {
  try {
    const content = await Deno.readTextFile(configPath);
    const parsed = parse(content);
    return RunnerConfigSchema.parse(parsed);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      logger.error(`Configuration file not found: ${configPath}`);
    } else if (error instanceof Error) {
      logger.error(`Failed to load configuration: ${error.message}`);
    } else {
      logger.error(`Failed to load configuration: ${String(error)}`);
    }
    throw error;
  }
}

/**
 * Update system package lists
 */
export async function updateSystem(): Promise<boolean> {
  logger.info("📦 Updating system package lists...");
  const result = await runCommand(["sudo", "apt-get", "update"]);
  if (!result.success) {
    logger.error("Failed to update package lists");
    return false;
  }
  logger.success("System package lists updated");
  return true;
}

/**
 * Install system packages via apt
 */
export async function installAptPackages(
  packages: string[],
): Promise<boolean> {
  if (packages.length === 0) {
    logger.debug("No apt packages to install");
    return true;
  }

  logger.info(`📦 Installing ${packages.length} system packages...`);
  logger.debug(`Packages: ${packages.join(", ")}`);

  const result = await runCommand([
    "sudo",
    "apt-get",
    "install",
    "-y",
    ...packages,
  ]);

  if (!result.success) {
    logger.error("Failed to install some packages");
    logger.error(result.stderr);
    return false;
  }

  logger.success(`Installed ${packages.length} packages`);
  return true;
}

/**
 * Check if a command exists
 */
export async function commandExists(command: string): Promise<boolean> {
  const result = await runCommand(["which", command]);
  return result.success;
}

/**
 * Install Rust toolchain via rustup
 */
export async function installRust(): Promise<boolean> {
  logger.info("🦀 Installing Rust toolchain...");

  // Check if rustup is already installed
  if (await commandExists("rustup")) {
    logger.info("Rustup already installed, updating...");
    const updateResult = await runCommand(["rustup", "update", "stable"]);
    if (!updateResult.success) {
      logger.warn("Failed to update rustup");
    }
  } else {
    // Install rustup
    logger.info("Downloading and installing rustup...");
    const installResult = await runCommand([
      "sh",
      "-c",
      'curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable',
    ]);

    if (!installResult.success) {
      logger.error("Failed to install rustup");
      return false;
    }
  }

  // Source cargo env
  const cargoEnv = `${Deno.env.get("HOME")}/.cargo/env`;

  // Verify installation
  const verifyResult = await runCommand([
    "sh",
    "-c",
    `. ${cargoEnv} && cargo --version`,
  ]);

  if (!verifyResult.success) {
    logger.error("Rust installation verification failed");
    return false;
  }

  logger.success("Rust toolchain installed successfully");
  logger.info(`Cargo version: ${verifyResult.stdout.trim()}`);

  return true;
}

/**
 * Install Deno
 */
export async function installDeno(url: string): Promise<boolean> {
  logger.info("🦕 Installing Deno...");

  // Check if already installed
  if (await commandExists("deno")) {
    const versionResult = await runCommand(["deno", "--version"]);
    logger.info(`Deno already installed: ${versionResult.stdout.split("\n")[0]}`);
    return true;
  }

  // Install Deno
  const installResult = await runCommand([
    "sh",
    "-c",
    `curl -fsSL ${url} | sh`,
  ]);

  if (!installResult.success) {
    logger.error("Failed to install Deno");
    return false;
  }

  logger.success("Deno installed successfully");
  return true;
}

/**
 * Clean package cache
 */
export async function cleanCache(): Promise<boolean> {
  logger.info("🧹 Cleaning package cache...");
  const result = await runCommand(["sudo", "apt-get", "clean"]);
  if (!result.success) {
    logger.warn("Failed to clean package cache");
    return false;
  }
  logger.success("Package cache cleaned");
  return true;
}

/**
 * Verify all required commands are available
 */
export async function verifyInstallations(
  config: RunnerConfig,
): Promise<boolean> {
  logger.info("✅ Verifying installations...");

  const requiredCommands: string[] = [];

  // Add system packages
  if (config.packages.system) {
    requiredCommands.push(...config.packages.system.filter((pkg: string) =>
      !pkg.includes("-")
    ));
  }

  // Add Rust components
  if (config.packages.rust) {
    requiredCommands.push("cargo", "rustc");
  }

  // Add Deno
  if (config.packages.javascript) {
    requiredCommands.push("deno");
  }

  let allPresent = true;
  for (const cmd of requiredCommands) {
    const exists = await commandExists(cmd);
    if (exists) {
      logger.debug(`✓ ${cmd}`);
    } else {
      logger.error(`✗ ${cmd} not found`);
      allPresent = false;
    }
  }

  if (allPresent) {
    logger.success("All required commands are available");
  } else {
    logger.error("Some required commands are missing");
  }

  return allPresent;
}

/**
 * Main configuration function
 */
export async function configureRunner(
  configPath: string,
): Promise<boolean> {
  logger.info("🏃 Configuring self-hosted GitHub Actions runner...");

  // Load configuration
  const config = await loadConfig(configPath);
  logger.info(`Runner name: ${config.runner.name}`);
  logger.info(`Organization: ${config.github.organization}`);

  // Update system if requested
  if (config.system.update_system) {
    if (!await updateSystem()) {
      return false;
    }
  }

  // Install system packages
  const allSystemPackages: string[] = [];
  if (config.packages.system) {
    allSystemPackages.push(...config.packages.system);
  }
  if (config.packages.development) {
    allSystemPackages.push(...config.packages.development);
  }
  if (config.packages.docker?.enabled && config.packages.docker.packages) {
    allSystemPackages.push(...config.packages.docker.packages);
  }

  if (allSystemPackages.length > 0) {
    if (!await installAptPackages(allSystemPackages)) {
      logger.error("Failed to install system packages");
      return false;
    }
  }

  // Install Rust if configured
  if (config.packages.rust) {
    if (!await installRust()) {
      return false;
    }
  }

  // Install JavaScript tools (Deno)
  if (config.packages.javascript) {
    for (const tool of config.packages.javascript) {
      if (tool.name === "deno") {
        if (!await installDeno(tool.url)) {
          return false;
        }
      }
    }
  }

  // Clean cache if requested
  if (config.system.clean_cache) {
    await cleanCache();
  }

  // Verify all installations
  if (!await verifyInstallations(config)) {
    return false;
  }

  logger.success("✅ Self-hosted runner configuration complete!");
  logger.info(`Next steps:`);
  logger.info(`  1. Set environment variables:`);
  logger.info(`     export GITHUB_REPO_URL=https://github.com/${config.github.organization}`);
  logger.info(`     export GITHUB_RUNNER_TOKEN=<your_token>`);
  logger.info(`  2. Run: make system-setup-runner`);

  return true;
}

/**
 * Main CLI function - exported for testing
 */
export async function main(args: string[]): Promise<number> {
  const parsedArgs = parseArgs(args, {
    string: ["config"],
    default: {
      config: "config/runner-config.yaml",
    },
  });

  try {
    const success = await configureRunner(parsedArgs.config);
    return success ? 0 : 1;
  } catch (error) {
    logger.error(`Configuration failed: ${error}`);
    return 1;
  }
}

// CLI entry point
if (import.meta.main) {
  const exitCode = await main(Deno.args);
  Deno.exit(exitCode);
}
