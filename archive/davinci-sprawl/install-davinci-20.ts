#!/usr/bin/env -S deno run --allow-all

/**
 * Install DaVinci Resolve 20.1 with all necessary fixes
 * 
 * Handles missing packages, environment setup, and applies working configuration
 */

import { logger } from "../lib/logger.ts";
import { runCommand, CommandResult } from "../lib/common.ts";
import { z } from "../../deps.ts";

const REQUIRED_PACKAGES = [
    "libapr1",
    "libaprutil1", 
    "libasound2",
    "libglib2.0-0",
    "libxcb-xinerama0",
    "libxcb-xinput0",
    "libxcb-cursor0",
    "libxcb-damage0",
    "libxcb-composite0",
    "libxcb-randr0",
    "libxcb-shape0",
    "libxcb-xfixes0",
    "ocl-icd-libopencl1",
];

const InstallConfigSchema = z.object({
    skipPackageCheck: z.boolean().default(false),
    skipBackup: z.boolean().default(false),
    installerPath: z.string().optional(),
    dryRun: z.boolean().default(false),
});

type InstallConfig = z.infer<typeof InstallConfigSchema>;

/**
 * Check if required packages are installed
 */
async function checkPackages(): Promise<string[]> {
    const missing: string[] = [];
    
    for (const pkg of REQUIRED_PACKAGES) {
        const result = await runCommand(["dpkg", "-l", pkg]);
        if (!result.success || !result.stdout.includes("ii")) {
            missing.push(pkg);
        }
    }
    
    return missing;
}

/**
 * Install missing packages
 */
async function installPackages(packages: string[]): Promise<boolean> {
    if (packages.length === 0) return true;
    
    logger.info(`Installing ${packages.length} missing packages...`);
    logger.info(`Packages: ${packages.join(", ")}`);
    
    // Update package list first
    logger.info("Updating package lists...");
    const updateResult = await runCommand(["sudo", "apt", "update"]);
    if (!updateResult.success) {
        logger.warn("Failed to update package lists");
    }
    
    // Install packages
    const installResult = await runCommand([
        "sudo", "apt", "install", "-y", ...packages
    ]);
    
    if (!installResult.success) {
        logger.error("Failed to install packages");
        logger.error(installResult.stderr);
        return false;
    }
    
    logger.success("Packages installed successfully");
    return true;
}

/**
 * Find DaVinci installer
 */
async function findInstaller(config: InstallConfig): Promise<string | null> {
    if (config.installerPath) {
        return config.installerPath;
    }
    
    // Check extracted folder
    const extractedDir = `${Deno.env.get("HOME")}/Downloads/DaVinci_Resolve_20.1_Linux`;
    const possiblePaths = [
        `${extractedDir}/DaVinci_Resolve_20.1_Linux.run`,
        `${extractedDir}/DaVinci_Resolve_Studio_20.1_Linux.run`,
        `${extractedDir}/installer.run`,
    ];
    
    for (const path of possiblePaths) {
        try {
            const stat = await Deno.stat(path);
            if (stat.isFile) {
                logger.info(`Found installer: ${path}`);
                return path;
            }
        } catch {
            // File doesn't exist
        }
    }
    
    // Try to find any .run file in the directory
    try {
        for await (const entry of Deno.readDir(extractedDir)) {
            if (entry.isFile && entry.name.endsWith(".run")) {
                const fullPath = `${extractedDir}/${entry.name}`;
                logger.info(`Found installer: ${fullPath}`);
                return fullPath;
            }
        }
    } catch {
        logger.warn(`Could not access directory: ${extractedDir}`);
    }
    
    return null;
}

/**
 * Backup current DaVinci installation
 */
async function backupInstallation(): Promise<string | null> {
    const home = Deno.env.get("HOME");
    if (!home) return null;
    
    const backupDir = `${home}/davinci-backup-${Date.now()}`;
    
    try {
        await Deno.mkdir(backupDir, { recursive: true });
        
        const dirsToBackup = [
            `${home}/.local/share/DaVinciResolve`,
            `${home}/.config/Blackmagic Design`,
        ];
        
        for (const dir of dirsToBackup) {
            try {
                await Deno.stat(dir);
                const destDir = `${backupDir}/${dir.replace(home + "/", "")}`;
                await Deno.mkdir(destDir.substring(0, destDir.lastIndexOf("/")), { recursive: true });
                
                const cpResult = await runCommand(["cp", "-r", dir, destDir]);
                if (cpResult.success) {
                    logger.info(`Backed up: ${dir.split("/").pop()}`);
                }
            } catch {
                // Directory doesn't exist
            }
        }
        
        logger.success(`Backup saved to: ${backupDir}`);
        return backupDir;
    } catch (error) {
        logger.error(`Backup failed: ${error}`);
        return null;
    }
}

/**
 * Create the working launcher script
 */
async function createLauncher(): Promise<void> {
    const launcherContent = `#!/bin/bash
# DaVinci Resolve 20.1 Launcher - Optimized Configuration

# Kill any stuck VST scanners
pkill -f VstScanner 2>/dev/null

# Basic environment
export HOME="\${HOME}"
export USER="\${USER}"
export DISPLAY="\${DISPLAY:-:0}"

# GPU configuration (minimal, proven to work)
export __NV_PRIME_RENDER_OFFLOAD=1
export __GLX_VENDOR_LIBRARY_NAME=nvidia

# Disable problematic features
export RESOLVE_CUDA_FORCE=0
export RESOLVE_SKIP_VST_SCAN=1
export QT_LOGGING_RULES="*=false"

# Clean environment launch
exec env -i \\
    HOME="\$HOME" \\
    USER="\$USER" \\
    DISPLAY="\$DISPLAY" \\
    PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \\
    LD_LIBRARY_PATH="/usr/lib/x86_64-linux-gnu:/usr/lib/nvidia" \\
    __NV_PRIME_RENDER_OFFLOAD=1 \\
    __GLX_VENDOR_LIBRARY_NAME=nvidia \\
    /opt/resolve/bin/resolve "\$@"
`;

    const tempPath = "/tmp/davinci-launcher";
    await Deno.writeTextFile(tempPath, launcherContent);
    await Deno.chmod(tempPath, 0o755);
    
    // Install the launcher
    const installResult = await runCommand([
        "sudo", "cp", tempPath, "/usr/local/bin/davinci-resolve"
    ]);
    
    if (installResult.success) {
        await runCommand(["sudo", "chmod", "+x", "/usr/local/bin/davinci-resolve"]);
        logger.success("Launcher installed to /usr/local/bin/davinci-resolve");
    } else {
        logger.warn("Could not install launcher automatically");
        logger.info(`Manual installation: sudo cp ${tempPath} /usr/local/bin/davinci-resolve`);
    }
}

/**
 * Main installation function
 */
export async function installDavinciResolve(config: InstallConfig): Promise<void> {
    logger.info("Starting DaVinci Resolve 20.1 installation...");
    
    // 1. Stop running processes
    logger.info("Stopping any running DaVinci processes...");
    await runCommand(["pkill", "-f", "resolve"]);
    await runCommand(["pkill", "-f", "VstScanner"]);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 2. Check and install packages
    if (!config.skipPackageCheck) {
        const missingPackages = await checkPackages();
        if (missingPackages.length > 0) {
            logger.warn(`Missing packages: ${missingPackages.join(", ")}`);
            
            if (!config.dryRun) {
                const installed = await installPackages(missingPackages);
                if (!installed) {
                    logger.error("Failed to install required packages");
                    logger.info("You can skip package check with --skip-packages");
                    Deno.exit(1);
                }
            }
        } else {
            logger.success("All required packages are installed");
        }
    }
    
    // 3. Find installer
    const installerPath = await findInstaller(config);
    if (!installerPath) {
        logger.error("DaVinci Resolve installer not found");
        logger.info("Expected location: ~/Downloads/DaVinci_Resolve_20.1_Linux/");
        logger.info("Download from: https://www.blackmagicdesign.com/products/davinciresolve");
        Deno.exit(1);
    }
    
    logger.success(`Found installer: ${installerPath}`);
    
    // 4. Backup if needed
    if (!config.skipBackup && !config.dryRun) {
        await backupInstallation();
    }
    
    // 5. Make installer executable
    await Deno.chmod(installerPath, 0o755);
    
    if (config.dryRun) {
        logger.info("Dry run complete. Would install from: " + installerPath);
        return;
    }
    
    // 6. Run installer with SKIP_PACKAGE_CHECK
    logger.info("Running installer (you will be prompted for sudo password)...");
    
    const env = {
        ...Deno.env.toObject(),
        SKIP_PACKAGE_CHECK: "1",  // Skip the installer's package check
        XDG_RUNTIME_DIR: `/tmp/runtime-${Deno.env.get("USER")}`,  // Fix XDG warning
    };
    
    // Create XDG runtime dir
    await Deno.mkdir(env.XDG_RUNTIME_DIR, { recursive: true, mode: 0o700 }).catch(() => {});
    
    const installCmd = new Deno.Command("sudo", {
        args: ["-E", installerPath, "-i"],
        env,
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
    });
    
    const installProcess = installCmd.spawn();
    const installResult = await installProcess.status;
    
    if (!installResult.success) {
        logger.error("Installation failed");
        logger.info("Try running with: SKIP_PACKAGE_CHECK=1 sudo " + installerPath);
        Deno.exit(1);
    }
    
    logger.success("DaVinci Resolve installed successfully!");
    
    // 7. Install the working launcher
    logger.info("Installing optimized launcher...");
    await createLauncher();
    
    // 8. Create desktop entry
    const desktopEntry = `[Desktop Entry]
Version=1.0
Type=Application
Name=DaVinci Resolve 20.1
Comment=Professional Video Editor
Icon=/opt/resolve/graphics/DV_Resolve.png
Exec=/usr/local/bin/davinci-resolve %f
Terminal=false
MimeType=application/x-resolveproj;
Categories=AudioVideo;AudioVideoEditing;Video;Graphics;
StartupNotify=true
`;

    const desktopPath = `${Deno.env.get("HOME")}/.local/share/applications/davinci-resolve.desktop`;
    await Deno.writeTextFile(desktopPath, desktopEntry);
    logger.info("Desktop entry created");
    
    // 9. Final setup
    logger.info("Applying final configurations...");
    
    // Set GPU persistence mode
    await runCommand(["sudo", "nvidia-smi", "-pm", "1"]);
    
    // Clear caches
    const cacheDirs = [
        `${Deno.env.get("HOME")}/.cache/BlackmagicDesign`,
        `${Deno.env.get("HOME")}/.nv/ComputeCache`,
    ];
    
    for (const dir of cacheDirs) {
        try {
            await Deno.remove(dir, { recursive: true });
        } catch {
            // Directory doesn't exist
        }
    }
    
    logger.success("Installation complete!");
    logger.info("\nYou can now launch DaVinci Resolve with: davinci-resolve");
}

// Parse command line arguments
function parseArgs(): InstallConfig {
    const config: Partial<InstallConfig> = {};
    const args = Deno.args;
    
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case "--skip-packages":
                config.skipPackageCheck = true;
                break;
            case "--skip-backup":
                config.skipBackup = true;
                break;
            case "--installer":
                if (i + 1 < args.length) {
                    config.installerPath = args[++i];
                }
                break;
            case "--dry-run":
                config.dryRun = true;
                break;
            case "--help":
                console.log(`
DaVinci Resolve 20.1 Installer

Usage: install-davinci-20.ts [options]

Options:
  --skip-packages    Skip package installation check
  --skip-backup      Skip backing up current installation
  --installer PATH   Specify installer path
  --dry-run          Test run without installing
  --help             Show this help

The installer will:
  1. Install missing system packages
  2. Backup current settings
  3. Install DaVinci Resolve 20.1
  4. Apply optimized launcher configuration
  5. Create desktop shortcuts
`);
                Deno.exit(0);
        }
    }
    
    return InstallConfigSchema.parse(config);
}

// Main execution
if (import.meta.main) {
    try {
        const config = parseArgs();
        await installDavinciResolve(config);
    } catch (error) {
        logger.error(`Installation failed: ${error}`);
        Deno.exit(1);
    }
}

export { checkPackages, installPackages, findInstaller, createLauncher };