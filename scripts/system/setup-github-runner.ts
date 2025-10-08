#!/usr/bin/env -S deno run --allow-run --allow-read --allow-write --allow-net --allow-env

import { logger } from "../lib/logger.ts";
import { commandExists, runCommand } from "../lib/common.ts";
import { parseArgs } from "../lib/common.ts";

/**
 * GitHub Self-Hosted Runner Setup Script
 * Sets up this machine as a self-hosted GitHub Actions runner
 * Runner name: Linux-VM-Noah-MacPro-Intel
 */

interface RunnerConfig {
  name: string;
  url?: string;
  token?: string;
  labels?: string[];
  workDir?: string;
}

interface RunnerInfo {
  version: string;
  downloadUrl: string;
  architecture: string;
}

/**
 * Detect system architecture
 */
export function detectArchitecture(): string {
  const arch = Deno.build.arch;

  if (arch === "x86_64") {
    return "x64";
  } else if (arch === "aarch64") {
    return "arm64";
  } else {
    return "x64"; // Default to x64
  }
}

/**
 * Get latest GitHub Actions runner version
 */
export function getLatestRunnerVersion(): RunnerInfo {
  const arch = detectArchitecture();

  // For now, use a known stable version
  // In production, you'd fetch from GitHub API: https://api.github.com/repos/actions/runner/releases/latest
  const version = "2.311.0";
  const downloadUrl =
    `https://github.com/actions/runner/releases/download/v${version}/actions-runner-linux-${arch}-${version}.tar.gz`;

  return {
    version,
    downloadUrl,
    architecture: arch,
  };
}

/**
 * Validate runner configuration
 */
export function validateConfig(
  config: Partial<RunnerConfig>,
): config is RunnerConfig {
  if (!config.name || config.name.trim().length === 0) {
    logger.error("Runner name is required");
    return false;
  }

  if (!config.url || !config.url.startsWith("https://github.com/")) {
    logger.error("Invalid GitHub URL. Must start with https://github.com/");
    return false;
  }

  if (!config.token || config.token.trim().length === 0) {
    logger.error("GitHub token is required");
    return false;
  }

  return true;
}

/**
 * Check if runner is already installed
 */
export async function isRunnerInstalled(workDir: string): Promise<boolean> {
  try {
    const configPath = `${workDir}/.runner`;
    await Deno.stat(configPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Download and extract GitHub Actions runner
 */
async function downloadRunner(
  workDir: string,
  runnerInfo: RunnerInfo,
): Promise<boolean> {
  logger.info(`📥 Downloading GitHub Actions runner v${runnerInfo.version}...`);
  logger.debug(`Architecture: ${runnerInfo.architecture}`);
  logger.debug(`URL: ${runnerInfo.downloadUrl}`);

  // Create work directory
  await Deno.mkdir(workDir, { recursive: true });

  // Download runner tarball
  const tarballPath = `${workDir}/actions-runner.tar.gz`;
  const downloadResult = await runCommand([
    "curl",
    "-o",
    tarballPath,
    "-L",
    runnerInfo.downloadUrl,
  ]);

  if (!downloadResult.success) {
    logger.error("Failed to download runner");
    logger.error(downloadResult.stderr);
    return false;
  }

  logger.success("Runner downloaded successfully");

  // Extract tarball
  logger.info("📦 Extracting runner...");
  const extractResult = await runCommand([
    "tar",
    "xzf",
    tarballPath,
    "-C",
    workDir,
  ]);

  if (!extractResult.success) {
    logger.error("Failed to extract runner");
    logger.error(extractResult.stderr);
    return false;
  }

  // Remove tarball
  await Deno.remove(tarballPath);

  logger.success("Runner extracted successfully");
  return true;
}

/**
 * Configure the runner
 */
async function configureRunner(
  workDir: string,
  config: RunnerConfig,
): Promise<boolean> {
  logger.info("⚙️  Configuring runner...");

  const configScript = `${workDir}/config.sh`;

  if (!config.url || !config.token) {
    logger.error("URL and token are required for configuration");
    return false;
  }

  // Build configuration command
  const configArgs: string[] = [
    configScript,
    "--url",
    config.url,
    "--token",
    config.token,
    "--name",
    config.name,
    "--unattended", // Non-interactive mode
  ];

  // Add labels if provided
  if (config.labels && config.labels.length > 0) {
    configArgs.push("--labels");
    configArgs.push(config.labels.join(","));
  }

  // Add work directory if provided
  if (config.workDir) {
    configArgs.push("--work");
    configArgs.push(config.workDir);
  }

  logger.debug(`Running: ${configArgs.join(" ")}`);

  const result = await runCommand(configArgs, {
    cwd: workDir,
  });

  if (!result.success) {
    logger.error("Failed to configure runner");
    logger.error(result.stderr);
    return false;
  }

  logger.success("✅ Runner configured successfully!");
  console.log(result.stdout);

  return true;
}

/**
 * Install runner as a systemd service
 * Currently disabled - provided for future use
 */
export async function installService(workDir: string): Promise<boolean> {
  // Marked as unused for now - will be used when service installation is enabled
  logger.info("🔧 Installing runner as systemd service...");

  const installScript = `${workDir}/svc.sh`;

  // Check if script exists
  try {
    await Deno.stat(installScript);
  } catch {
    logger.error("Service install script not found");
    return false;
  }

  // Install service
  const installResult = await runCommand([
    "sudo",
    installScript,
    "install",
  ], {
    cwd: workDir,
  });

  if (!installResult.success) {
    logger.error("Failed to install service");
    logger.error(installResult.stderr);
    return false;
  }

  logger.success("Service installed successfully");

  // Start service
  logger.info("🚀 Starting runner service...");
  const startResult = await runCommand([
    "sudo",
    installScript,
    "start",
  ], {
    cwd: workDir,
  });

  if (!startResult.success) {
    logger.error("Failed to start service");
    logger.error(startResult.stderr);
    return false;
  }

  logger.success("✅ Runner service started successfully!");

  // Check status
  const statusResult = await runCommand([
    "sudo",
    installScript,
    "status",
  ], {
    cwd: workDir,
  });

  console.log(statusResult.stdout);

  return true;
}

async function main() {
  console.log(
    "╔══════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║         🏃 GitHub Self-Hosted Runner Setup                   ║",
  );
  console.log(
    "╚══════════════════════════════════════════════════════════════╝",
  );
  console.log("");

  // Parse arguments
  const args = parseArgs(Deno.args);

  const nameArg = args["name"] as string | undefined;
  const urlArg = args["url"] as string | undefined;
  const tokenArg = args["token"] as string | undefined;
  const labelsArg = args["labels"] as string | undefined;
  const workArg = args["work"] as string | undefined;

  const config: Partial<RunnerConfig> = {
    name: nameArg || "Linux-VM-Noah-MacPro-Intel",
    labels: labelsArg ? labelsArg.split(",") : ["self-hosted", "Linux", "X64"],
    workDir: workArg || `${Deno.env.get("HOME")}/actions-runner`,
  };

  // Add optional properties only if they exist
  const urlValue = urlArg || Deno.env.get("GITHUB_REPO_URL");
  const tokenValue = tokenArg || Deno.env.get("GITHUB_RUNNER_TOKEN");
  if (urlValue) config.url = urlValue;
  if (tokenValue) config.token = tokenValue;

  // Validate configuration
  if (!validateConfig(config)) {
    logger.error("Invalid configuration");
    console.log("");
    console.log("Usage:");
    console.log("  deno run --allow-all setup-github-runner.ts \\");
    console.log("    --url https://github.com/OWNER/REPO \\");
    console.log("    --token YOUR_TOKEN \\");
    console.log("    --name Linux-VM-Noah-MacPro-Intel");
    console.log("");
    console.log("Or set environment variables:");
    console.log("  export GITHUB_REPO_URL=https://github.com/OWNER/REPO");
    console.log("  export GITHUB_RUNNER_TOKEN=YOUR_TOKEN");
    console.log("");
    Deno.exit(1);
  }

  logger.info(`Runner name: ${config.name}`);
  logger.info(`Repository: ${config.url}`);
  logger.info(`Work directory: ${config.workDir}`);
  console.log("");

  // Check if runner is already installed
  if (await isRunnerInstalled(config.workDir!)) {
    logger.warn("⚠️  Runner already installed at this location");
    logger.info("To reconfigure, remove the existing installation first:");
    logger.info(`  rm -rf ${config.workDir}`);
    Deno.exit(1);
  }

  // Check dependencies
  if (!await commandExists("curl")) {
    logger.error("curl is not installed. Please install it first:");
    logger.error("  sudo apt-get install -y curl");
    Deno.exit(1);
  }

  if (!await commandExists("tar")) {
    logger.error("tar is not installed. Please install it first:");
    logger.error("  sudo apt-get install -y tar");
    Deno.exit(1);
  }

  // Get runner info
  const runnerInfo = await getLatestRunnerVersion();
  logger.info(`Latest runner version: ${runnerInfo.version}`);
  console.log("");

  // Download runner
  if (!await downloadRunner(config.workDir!, runnerInfo)) {
    logger.error("Failed to download runner");
    Deno.exit(1);
  }
  console.log("");

  // Configure runner
  if (!await configureRunner(config.workDir!, config)) {
    logger.error("Failed to configure runner");
    Deno.exit(1);
  }
  console.log("");

  // Ask if user wants to install as service
  logger.info("📋 Runner configured successfully!");
  logger.info("");
  logger.info("To install as a systemd service (runs automatically on boot):");
  logger.info(`  sudo ${config.workDir}/svc.sh install`);
  logger.info(`  sudo ${config.workDir}/svc.sh start`);
  logger.info("");
  logger.info("Or run manually:");
  logger.info(`  cd ${config.workDir}`);
  logger.info("  ./run.sh");
  logger.info("");

  console.log(
    "════════════════════════════════════════════════════════════════",
  );
  logger.success("🎉 GitHub Actions runner setup complete!");
  if (config.url) {
    const repoPath = config.url.split("github.com/")[1];
    if (repoPath) {
      logger.info(
        `Check status: https://github.com/${repoPath}/settings/actions/runners`,
      );
    }
  }
}

if (import.meta.main) {
  main();
}
