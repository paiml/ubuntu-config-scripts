#!/usr/bin/env -S deno run --allow-all

/**
 * optimize-rust-dev.ts - System optimization for Rust development
 * Configures swap, memory settings, and development tools for heavy Rust workloads
 */

import { Logger } from "../lib/logger.ts";
import { commandExists, requireRoot, runCommand } from "../lib/common.ts";
import { z } from "../lib/schema.ts";
import * as fs from "https://deno.land/std@0.224.0/fs/mod.ts";
import * as path from "https://deno.land/std@0.224.0/path/mod.ts";

const logger = new Logger({ prefix: "rust-optimizer" });

const SwapConfigSchema = z.object({
  currentSizeGb: z.number(),
  targetSizeGb: z.number(),
  swappiness: z.number().min(0).max(100),
  cachePressure: z.number().min(0).max(200),
});

type SwapConfig = z.infer<typeof SwapConfigSchema>;

interface OptimizationResult {
  swapConfigured: boolean;
  zramConfigured: boolean;
  sysctlConfigured: boolean;
  toolsInstalled: boolean;
  intellijConfigured: boolean;
}

async function checkRoot(): Promise<void> {
  requireRoot();
}

async function getCurrentSwapSize(): Promise<number> {
  try {
    const result = await runCommand([
      "swapon",
      "--show",
      "--bytes",
      "--noheadings",
    ]);
    if (!result.success || !result.stdout) return 0;

    const lines = result.stdout.trim().split("\n");
    if (lines.length === 0) return 0;

    const parts = lines[0].split(/\s+/);
    if (parts.length >= 3) {
      const sizeBytes = parseInt(parts[2], 10);
      return Math.floor(sizeBytes / (1024 * 1024 * 1024));
    }
  } catch {
    return 0;
  }
  return 0;
}

async function configureSwap(config: SwapConfig): Promise<boolean> {
  logger.info(
    `Configuring swap: ${config.currentSizeGb}GB -> ${config.targetSizeGb}GB`,
  );

  if (config.currentSizeGb >= config.targetSizeGb) {
    logger.info("Swap is already adequately sized");
    return false;
  }

  // Disable current swap if it exists
  if (await fs.exists("/swapfile")) {
    logger.info("Disabling current swap...");
    await runCommand(["swapoff", "/swapfile"]);
    await Deno.remove("/swapfile");
  }

  // Create new swap file
  logger.info(`Creating ${config.targetSizeGb}GB swap file...`);
  await runCommand(["fallocate", "-l", `${config.targetSizeGb}G`, "/swapfile"]);

  // Set permissions
  await runCommand(["chmod", "600", "/swapfile"]);

  // Make swap
  await runCommand(["mkswap", "/swapfile"]);

  // Enable swap
  await runCommand(["swapon", "/swapfile"]);

  // Update fstab if not already present
  const fstab = await Deno.readTextFile("/etc/fstab");
  if (!fstab.includes("/swapfile")) {
    logger.info("Adding swap to /etc/fstab...");
    await Deno.writeTextFile(
      "/etc/fstab",
      fstab + "\n/swapfile none swap sw 0 0\n",
    );
  }

  logger.success(`Swap configured: ${config.targetSizeGb}GB`);
  return true;
}

async function configureSysctl(config: SwapConfig): Promise<boolean> {
  logger.info("Configuring system memory parameters...");

  const sysctlConfigs = [
    ["vm.swappiness", config.swappiness.toString()],
    ["vm.vfs_cache_pressure", config.cachePressure.toString()],
    ["vm.dirty_ratio", "15"],
    ["vm.dirty_background_ratio", "5"],
  ];

  for (const [key, value] of sysctlConfigs) {
    // Apply immediately
    await runCommand(["sysctl", `${key}=${value}`]);

    // Make permanent
    const sysctlConf = await Deno.readTextFile("/etc/sysctl.conf").catch(() =>
      ""
    );
    if (!sysctlConf.includes(key)) {
      await Deno.writeTextFile(
        "/etc/sysctl.conf",
        sysctlConf + `\n${key}=${value}\n`,
        { append: true },
      );
    }
  }

  logger.success("System memory parameters configured");
  return true;
}

async function setupZram(): Promise<boolean> {
  logger.info("Setting up ZRAM compressed swap...");

  try {
    // Check if zram module is loaded
    const modules = await Deno.readTextFile("/proc/modules").catch(() => "");
    if (!modules.includes("zram")) {
      await runCommand(["modprobe", "zram"]);
    }

    // Check if zram0 exists
    if (!await fs.exists("/sys/block/zram0")) {
      logger.warn("ZRAM device not available, skipping");
      return false;
    }

    // Reset zram0 if it's already in use
    if (await fs.exists("/sys/block/zram0/disksize")) {
      const disksize = await Deno.readTextFile("/sys/block/zram0/disksize")
        .catch(() => "0");
      if (disksize.trim() !== "0") {
        await runCommand(["swapoff", "/dev/zram0"]).catch(() => {});
        await Deno.writeTextFile("/sys/block/zram0/reset", "1");
      }
    }

    // Configure compression algorithm
    try {
      await Deno.writeTextFile("/sys/block/zram0/comp_algorithm", "lz4");
    } catch {
      await Deno.writeTextFile("/sys/block/zram0/comp_algorithm", "lzo");
    }

    // Set size to 16GB
    await Deno.writeTextFile("/sys/block/zram0/disksize", "17179869184");

    // Make swap on zram
    await runCommand(["mkswap", "/dev/zram0"]);

    // Enable with higher priority than disk swap
    await runCommand(["swapon", "-p", "100", "/dev/zram0"]);

    // Create systemd service for persistence
    const serviceContent = `[Unit]
Description=Configure ZRAM swap device
After=multi-user.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/local/bin/setup-zram.sh

[Install]
WantedBy=multi-user.target
`;

    await Deno.writeTextFile(
      "/etc/systemd/system/zram.service",
      serviceContent,
    );

    // Create setup script
    const scriptContent = `#!/bin/bash
modprobe zram
echo lz4 > /sys/block/zram0/comp_algorithm 2>/dev/null || echo lzo > /sys/block/zram0/comp_algorithm
echo 17179869184 > /sys/block/zram0/disksize
mkswap /dev/zram0
swapon -p 100 /dev/zram0
`;

    await Deno.writeTextFile("/usr/local/bin/setup-zram.sh", scriptContent);
    await runCommand(["chmod", "+x", "/usr/local/bin/setup-zram.sh"]);
    await runCommand(["systemctl", "enable", "zram.service"]);

    logger.success("ZRAM configured: 16GB compressed swap with priority 100");
    return true;
  } catch (error) {
    logger.error(`ZRAM setup failed: ${error}`);
    return false;
  }
}

async function installDevTools(): Promise<boolean> {
  logger.info("Installing development tools...");

  const tools = [
    ["mold", "Fast linker for Rust"],
    ["clang", "LLVM compiler for better linking"],
    ["htop", "Interactive process viewer"],
    ["ncdu", "Disk usage analyzer"],
  ];

  let installed = false;

  for (const [tool, description] of tools) {
    logger.info(`Installing ${tool}: ${description}`);
    try {
      await runCommand(["apt-get", "install", "-y", tool]);
      installed = true;
    } catch {
      logger.warn(`Failed to install ${tool}`);
    }
  }

  // Install sccache via cargo if available
  if (await commandExists("cargo")) {
    logger.info("Installing sccache for compilation caching...");
    const sudoUser = Deno.env.get("SUDO_USER");
    if (sudoUser) {
      try {
        await runCommand(["su", "-", sudoUser, "-c", "cargo install sccache"]);
      } catch {
        logger.warn("Failed to install sccache");
      }
    }
  }

  if (installed) {
    logger.success("Development tools installed");
  }
  return installed;
}

async function configureIntelliJ(): Promise<boolean> {
  logger.info("Configuring IntelliJ IDEA memory settings...");

  const sudoUser = Deno.env.get("SUDO_USER");
  if (!sudoUser) {
    logger.warn("Cannot determine user for IntelliJ configuration");
    return false;
  }

  const homeDir = `/home/${sudoUser}`;
  const configDirs = [
    `${homeDir}/.config/JetBrains`,
    `${homeDir}/.local/share/JetBrains`,
  ];

  const vmOptions = `-Xms2048m
-Xmx8192m
-XX:ReservedCodeCacheSize=512m
-XX:+UseG1GC
-XX:SoftRefLRUPolicyMSPerMB=50
-XX:+UnlockDiagnosticVMOptions
-XX:+IgnoreUnrecognizedVMOptions
-XX:CICompilerCount=2
-XX:MaxGCPauseMillis=200
-XX:+DisableExplicitGC
-Djava.net.preferIPv4Stack=true
-Dsun.io.useCanonCaches=false
-Djb.vmOptionsFile=${homeDir}/.config/JetBrains/idea64.vmoptions
`;

  let configured = false;

  for (const configDir of configDirs) {
    if (await fs.exists(configDir)) {
      for await (const entry of Deno.readDir(configDir)) {
        if (
          entry.name.includes("IntelliJIdea") ||
          entry.name.includes("IdeaIC") || entry.name.includes("IdeaIU")
        ) {
          const vmoptionsPath = path.join(
            configDir,
            entry.name,
            "idea64.vmoptions",
          );
          logger.info(`Writing IntelliJ config to: ${vmoptionsPath}`);
          await Deno.writeTextFile(vmoptionsPath, vmOptions);
          await runCommand(["chown", `${sudoUser}:${sudoUser}`, vmoptionsPath]);
          configured = true;
        }
      }
    }
  }

  // Also create a global config
  const globalConfig = `${homeDir}/.config/JetBrains/idea64.vmoptions`;
  await fs.ensureDir(`${homeDir}/.config/JetBrains`);
  await Deno.writeTextFile(globalConfig, vmOptions);
  await runCommand([
    "chown",
    "-R",
    `${sudoUser}:${sudoUser}`,
    `${homeDir}/.config/JetBrains`,
  ]);

  if (configured) {
    logger.success("IntelliJ IDEA memory settings configured");
  } else {
    logger.info("IntelliJ configuration created for future installations");
  }

  return true;
}

async function createCargoConfig(): Promise<void> {
  logger.info("Creating optimized Cargo configuration...");

  const sudoUser = Deno.env.get("SUDO_USER");
  if (!sudoUser) return;

  const cargoDir = `/home/${sudoUser}/.cargo`;
  await fs.ensureDir(cargoDir);

  const configContent = `[build]
jobs = 8
rustc-wrapper = "sccache"

[target.x86_64-unknown-linux-gnu]
linker = "clang"
rustflags = ["-C", "link-arg=-fuse-ld=mold", "-C", "target-cpu=native"]

[net]
git-fetch-with-cli = true

[profile.dev]
opt-level = 0
debug = 1
lto = false
codegen-units = 256
incremental = true

[profile.release]
opt-level = 3
lto = "thin"
codegen-units = 1
`;

  const configPath = `${cargoDir}/config.toml`;

  // Backup existing config if it exists
  if (await fs.exists(configPath)) {
    const backupPath = `${configPath}.backup`;
    await Deno.copyFile(configPath, backupPath);
    logger.info(`Backed up existing config to ${backupPath}`);
  }

  await Deno.writeTextFile(configPath, configContent);
  await runCommand(["chown", `${sudoUser}:${sudoUser}`, configPath]);

  logger.success("Cargo configuration optimized for Rust development");
}

function printSummary(result: OptimizationResult): void {
  console.log("\n" + "=".repeat(60));
  logger.success("RUST DEVELOPMENT OPTIMIZATION COMPLETE");
  console.log("=".repeat(60));

  if (result.swapConfigured) {
    console.log("✅ Swap increased to 64GB");
  }
  if (result.zramConfigured) {
    console.log("✅ ZRAM 16GB compressed swap configured");
  }
  if (result.sysctlConfigured) {
    console.log("✅ System memory parameters optimized");
  }
  if (result.toolsInstalled) {
    console.log("✅ Development tools installed (mold, clang, etc.)");
  }
  if (result.intellijConfigured) {
    console.log("✅ IntelliJ IDEA memory settings configured");
  }

  console.log("\n📝 NEXT STEPS:");
  console.log("1. Reboot for all changes to take effect");
  console.log("2. Set environment variables in ~/.bashrc:");
  console.log("   export CARGO_BUILD_JOBS=8");
  console.log("   export RUSTC_WRAPPER=sccache");
  console.log('   export SCCACHE_CACHE_SIZE="50G"');
  console.log("3. Monitor memory with: watch -n 1 free -h");
  console.log("4. Clean old Rust artifacts regularly:");
  console.log("   cargo sweep -t 30  # Remove artifacts older than 30 days");

  console.log("\n⚡ PERFORMANCE TIPS:");
  console.log("- Use 'cargo clean -p <package>' for selective cleaning");
  console.log("- Run 'ncdu target/' to analyze build artifact sizes");
  console.log("- If IntelliJ freezes, run: pkill rust-analyzer");
  console.log("- Clear swap if needed: sudo swapoff -a && sudo swapon -a");
}

async function main(): Promise<void> {
  logger.info("Starting Rust Development Optimization");

  try {
    // Check if running as root
    await checkRoot();

    const result: OptimizationResult = {
      swapConfigured: false,
      zramConfigured: false,
      sysctlConfigured: false,
      toolsInstalled: false,
      intellijConfigured: false,
    };

    // Get current swap size
    const currentSwap = await getCurrentSwapSize();

    const config: SwapConfig = {
      currentSizeGb: Number(currentSwap),
      targetSizeGb: 64,
      swappiness: 10,
      cachePressure: 50,
    };

    // Validate config
    SwapConfigSchema.parse(config);

    // Configure swap
    try {
      result.swapConfigured = await configureSwap(config);
    } catch (error) {
      logger.error(`Swap configuration failed: ${error}`);
    }

    // Configure sysctl
    try {
      result.sysctlConfigured = await configureSysctl(config);
    } catch (error) {
      logger.error(`Sysctl configuration failed: ${error}`);
    }

    // Setup ZRAM
    try {
      result.zramConfigured = await setupZram();
    } catch (error) {
      logger.error(`ZRAM setup failed: ${error}`);
    }

    // Install development tools
    try {
      result.toolsInstalled = await installDevTools();
    } catch (error) {
      logger.error(`Tool installation failed: ${error}`);
    }

    // Configure IntelliJ
    try {
      result.intellijConfigured = await configureIntelliJ();
    } catch (error) {
      logger.error(`IntelliJ configuration failed: ${error}`);
    }

    // Create optimized Cargo config
    await createCargoConfig().catch((error) => {
      logger.error(`Cargo config creation failed: ${error}`);
    });

    // Print summary
    printSummary(result);
  } catch (error) {
    logger.error(`Fatal error: ${error}`);
    Deno.exit(1);
  }
}

// Run if executed directly
if (import.meta.main) {
  await main();
}
