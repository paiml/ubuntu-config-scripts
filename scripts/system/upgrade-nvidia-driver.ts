#!/usr/bin/env -S deno run --allow-all

import { logger } from "../lib/logger.ts";
import { confirm, requireRoot, runCommand } from "../lib/common.ts";
import { z } from "../../deps.ts";

const ConfigSchema = z.object({
  targetVersion: z.string().default("575"),
  force: z.boolean().default(false),
  skipBackup: z.boolean().default(false),
  autoReboot: z.boolean().default(false),
});

interface DriverInfo {
  currentVersion: string | null;
  currentPackage: string | null;
  availableVersions: string[];
}

async function detectCurrentDriver(): Promise<DriverInfo> {
  logger.info("Detecting current NVIDIA driver...");

  const info: DriverInfo = {
    currentVersion: null,
    currentPackage: null,
    availableVersions: [],
  };

  // Get current driver version
  const smiResult = await runCommand([
    "nvidia-smi",
    "--query-gpu=driver_version",
    "--format=csv,noheader",
  ]);

  if (smiResult.success) {
    info.currentVersion = smiResult.stdout.trim();
    logger.info(`Current driver version: ${info.currentVersion}`);
  } else {
    logger.warn(
      "No NVIDIA driver currently installed or nvidia-smi not available",
    );
  }

  // Find installed package
  const dpkgResult = await runCommand(["dpkg", "-l"]);
  if (dpkgResult.success) {
    const lines = dpkgResult.stdout.split("\n");
    for (const line of lines) {
      if (line.includes("nvidia-driver-") && line.startsWith("ii")) {
        const match = line.match(/nvidia-driver-(\d+)/);
        if (match) {
          info.currentPackage = `nvidia-driver-${match[1]}`;
          logger.info(`Current package: ${info.currentPackage}`);
          break;
        }
      }
    }
  }

  // Get available versions
  const searchResult = await runCommand([
    "apt-cache",
    "search",
    "^nvidia-driver-[0-9]",
  ]);

  if (searchResult.success) {
    const versions = searchResult.stdout
      .split("\n")
      .map((line) => {
        const match = line.match(/^nvidia-driver-(\d+)\s/);
        return match ? match[1] : null;
      })
      .filter((v): v is string => v !== null)
      .sort((a, b) => parseInt(b, 10) - parseInt(a, 10));

    info.availableVersions = versions;
    logger.info(
      `Available driver versions: ${versions.slice(0, 5).join(", ")}...`,
    );
  }

  return info;
}

async function backupCurrentConfig(): Promise<void> {
  logger.info("Backing up current configuration...");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = `/tmp/nvidia-backup-${timestamp}`;

  await runCommand(["mkdir", "-p", backupDir]);

  // Backup xorg.conf if it exists
  const xorgResult = await runCommand([
    "cp",
    "-p",
    "/etc/X11/xorg.conf",
    `${backupDir}/xorg.conf`,
  ]);

  if (!xorgResult.success) {
    logger.debug("No xorg.conf to backup");
  }

  // Backup modprobe configs
  await runCommand([
    "cp",
    "-rp",
    "/etc/modprobe.d/",
    `${backupDir}/`,
  ]);

  // Save current package list
  const packageList = await runCommand([
    "dpkg",
    "-l",
  ]);

  if (packageList.success) {
    await Deno.writeTextFile(
      `${backupDir}/nvidia-packages.txt`,
      packageList.stdout.split("\n")
        .filter((line) => line.includes("nvidia"))
        .join("\n"),
    );
  }

  logger.success(`Backup saved to ${backupDir}`);
}

async function removeOldDriver(packageName: string): Promise<void> {
  logger.info(`Removing old driver package: ${packageName}...`);

  // First, stop display manager
  logger.info("Stopping display manager...");
  await runCommand(["systemctl", "stop", "gdm3"]);
  await runCommand(["systemctl", "stop", "lightdm"]);

  // Remove old driver
  const removeResult = await runCommand([
    "apt-get",
    "remove",
    "--purge",
    "-y",
    packageName,
    `${packageName}-*`,
  ]);

  if (!removeResult.success) {
    logger.error(`Failed to remove old driver: ${removeResult.stderr}`);
    throw new Error("Failed to remove old driver");
  }

  // Clean up
  await runCommand(["apt-get", "autoremove", "-y"]);
  await runCommand(["apt-get", "autoclean", "-y"]);

  logger.success("Old driver removed");
}

async function installNewDriver(version: string): Promise<void> {
  logger.info(`Installing NVIDIA driver ${version}...`);

  // Update package list
  const updateResult = await runCommand(["apt-get", "update"]);
  if (!updateResult.success) {
    logger.error("Failed to update package list");
    throw new Error("Failed to update package list");
  }

  // Install new driver
  const packageName = `nvidia-driver-${version}`;
  const installResult = await runCommand([
    "apt-get",
    "install",
    "-y",
    packageName,
    "nvidia-cuda-toolkit",
    "nvidia-cuda-dev",
  ]);

  if (!installResult.success) {
    logger.error(`Failed to install driver: ${installResult.stderr}`);
    throw new Error("Failed to install new driver");
  }

  // Update initramfs
  logger.info("Updating initramfs...");
  await runCommand(["update-initramfs", "-u"]);

  logger.success(`Driver ${version} installed successfully`);
}

async function verifyInstallation(): Promise<boolean> {
  logger.info("Verifying installation...");

  // Check kernel modules
  const lsmodResult = await runCommand(["lsmod"]);
  if (lsmodResult.success && lsmodResult.stdout.includes("nvidia")) {
    logger.success("✓ NVIDIA kernel modules loaded");
  } else {
    logger.warn("✗ NVIDIA kernel modules not loaded (may require reboot)");
    return false;
  }

  // Check DKMS status
  const dkmsResult = await runCommand(["dkms", "status"]);
  if (dkmsResult.success) {
    logger.info("DKMS status:");
    const nvidiaModules = dkmsResult.stdout
      .split("\n")
      .filter((line) => line.includes("nvidia"));

    for (const module of nvidiaModules) {
      logger.info(`  ${module}`);
    }
  }

  return true;
}

async function updateDaVinciWrapper(): Promise<void> {
  logger.info("Updating DaVinci Resolve wrapper...");

  const wrapperPath = "/usr/local/bin/davinci-resolve";
  const wrapperExists = await runCommand(["test", "-f", wrapperPath]);

  if (wrapperExists.success) {
    // Update the wrapper to include new driver paths
    const wrapperContent = `#!/bin/bash
# DaVinci Resolve Wrapper - Updated for new NVIDIA driver
# Generated by upgrade-nvidia-driver.ts

# Set NVIDIA environment
export NVIDIA_DRIVER_CAPABILITIES=all
export __NV_PRIME_RENDER_OFFLOAD=1
export __GLX_VENDOR_LIBRARY_NAME=nvidia
export CUDA_VISIBLE_DEVICES=0
export VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json

# Force CUDA mode
export RESOLVE_CUDA_FORCE=1
export DR_USE_GPU=1

# Set library paths - updated for new driver
export LD_LIBRARY_PATH=/usr/local/cuda-12/lib64:/usr/local/cuda/lib64:/usr/lib/x86_64-linux-gnu:/usr/lib/nvidia:$LD_LIBRARY_PATH

# Set CUDA paths
export CUDA_HOME=/usr/local/cuda
export CUDA_PATH=/usr/local/cuda
export PATH=$CUDA_HOME/bin:$PATH

# OpenCL settings
export OCL_ICD_VENDORS=/etc/OpenCL/vendors/

# Nvidia runtime settings
export __GL_SHADER_DISK_CACHE=1
export __GL_SHADER_DISK_CACHE_PATH=/tmp

# Launch DaVinci Resolve
exec /opt/resolve/bin/resolve "$@"
`;

    await Deno.writeTextFile("/tmp/davinci-wrapper.sh", wrapperContent);
    await runCommand(["cp", "/tmp/davinci-wrapper.sh", wrapperPath]);
    await runCommand(["chmod", "+x", wrapperPath]);

    logger.success("DaVinci wrapper updated");
  }
}

async function main(): Promise<void> {
  const args = parseArgs(Deno.args);
  const config = ConfigSchema.parse({
    targetVersion: args["version"] || "575",
    force: args["force"] || false,
    skipBackup: args["skip-backup"] || false,
    autoReboot: args["auto-reboot"] || false,
  });

  logger.info("NVIDIA Driver Upgrade Script for DaVinci Resolve 20");
  logger.info("=====================================================");

  requireRoot();

  const driverInfo = await detectCurrentDriver();

  if (!driverInfo.availableVersions.includes(config.targetVersion)) {
    logger.error(`Driver version ${config.targetVersion} is not available`);
    logger.info(
      `Available versions: ${
        driverInfo.availableVersions.slice(0, 10).join(", ")
      }`,
    );
    Deno.exit(1);
  }

  if (driverInfo.currentVersion) {
    const currentMajor = parseInt(driverInfo.currentVersion.split(".")[0]!, 10);
    const targetMajor = parseInt(config.targetVersion, 10);

    if (currentMajor >= targetMajor && !config.force) {
      logger.info(
        `Current driver (${driverInfo.currentVersion}) is already ${targetMajor} or newer`,
      );
      logger.info("Use --force to reinstall anyway");
      Deno.exit(0);
    }
  }

  logger.warn("\n⚠️  WARNING: This will upgrade your NVIDIA driver!");
  logger.warn("⚠️  Your display may go black during the process.");
  logger.warn("⚠️  A reboot will be required after installation.");

  const proceed = await confirm(
    `\nUpgrade from ${
      driverInfo.currentVersion || "none"
    } to ${config.targetVersion}?`,
    false,
  );

  if (!proceed) {
    logger.info("Upgrade cancelled");
    Deno.exit(0);
  }

  try {
    // Backup current configuration
    if (!config.skipBackup) {
      await backupCurrentConfig();
    }

    // Remove old driver if installed
    if (driverInfo.currentPackage) {
      await removeOldDriver(driverInfo.currentPackage);
    }

    // Install new driver
    await installNewDriver(config.targetVersion);

    // Update DaVinci wrapper
    await updateDaVinciWrapper();

    // Verify installation
    await verifyInstallation();

    logger.success("\n✅ Driver upgrade completed!");

    if (config.autoReboot) {
      logger.warn("System will reboot in 10 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 10000));
      await runCommand(["reboot"]);
    } else {
      logger.info(
        "\n🔄 Please reboot your system to complete the driver installation:",
      );
      logger.info("   sudo reboot");
      logger.info("\nAfter reboot, launch DaVinci Resolve with:");
      logger.info("   davinci-resolve");
    }
  } catch (error) {
    logger.error(`Upgrade failed: ${error}`);
    logger.info("\nTo restore previous configuration:");
    logger.info("1. Check backups in /tmp/nvidia-backup-*");
    logger.info("2. Reinstall previous driver manually");
    Deno.exit(1);
  }
}

function parseArgs(args: string[]): Record<string, string | boolean> {
  const parsed: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      if (i + 1 < args.length && args[i + 1] && !args[i + 1]!.startsWith("-")) {
        parsed[key] = args[++i]!;
      } else {
        parsed[key] = true;
      }
    }
  }

  return parsed;
}

if (import.meta.main) {
  await main();
}
