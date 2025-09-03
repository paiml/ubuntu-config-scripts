#!/usr/bin/env -S deno run --allow-all

/**
 * Reinstall DaVinci Resolve 20.0.1 (the working version)
 */

import { logger } from "../lib/logger.ts";
import { existsSync } from "https://deno.land/std@0.208.0/fs/mod.ts";

async function reinstallDaVinci(): Promise<void> {
  logger.info("Reinstalling DaVinci Resolve 20.0.1...");

  // Step 1: Uninstall current version
  logger.info("Step 1: Uninstalling DaVinci Resolve 20.1...");
  
  const uninstallScript = "/opt/resolve/bin/uninstall.sh";
  if (existsSync(uninstallScript)) {
    const uninstallProc = new Deno.Command("sudo", {
      args: [uninstallScript],
      stdout: "inherit",
      stderr: "inherit",
      stdin: "inherit",
    });
    
    const result = await uninstallProc.output();
    if (result.success) {
      logger.success("DaVinci Resolve 20.1 uninstalled");
    } else {
      logger.warn("Uninstall may have had issues, continuing anyway...");
    }
  } else {
    logger.info("No uninstall script found, assuming clean state");
  }

  // Step 2: Clean up any remaining files
  logger.info("Step 2: Cleaning up remaining files...");
  
  const cleanupPaths = [
    "/opt/resolve",
    "/usr/local/bin/davinci-resolve-fixed",
    "/usr/local/bin/davinci-resolve-20",
    "/usr/local/bin/davinci-isolated",
    "/opt/davinci-isolated",
  ];

  for (const path of cleanupPaths) {
    if (existsSync(path)) {
      logger.info(`Removing ${path}...`);
      const rmProc = new Deno.Command("sudo", {
        args: ["rm", "-rf", path],
        stdout: "null",
        stderr: "null",
      });
      await rmProc.output();
    }
  }

  // Step 3: Find the 20.0.1 installer
  logger.info("Step 3: Looking for DaVinci Resolve 20.0.1 installer...");
  
  const possiblePaths = [
    `${Deno.env.get("HOME")}/Downloads/DaVinci_Resolve_20.0.1_Linux.run`,
    `${Deno.env.get("HOME")}/Downloads/DaVinci_Resolve_20.0.1_Linux/DaVinci_Resolve_20.0.1_Linux.run`,
    `${Deno.env.get("HOME")}/Downloads/DaVinci_Resolve_Studio_20.0.1_Linux.run`,
  ];

  let installerPath: string | null = null;
  
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      installerPath = path;
      logger.success(`Found installer: ${path}`);
      break;
    }
  }

  if (!installerPath) {
    // Try to find it with find command
    const findProc = new Deno.Command("find", {
      args: [
        `${Deno.env.get("HOME")}/Downloads`,
        "-name", "*20.0.1*.run",
        "-type", "f",
      ],
      stdout: "piped",
      stderr: "null",
    });
    
    const { stdout } = await findProc.output();
    const output = new TextDecoder().decode(stdout).trim();
    
    if (output) {
      installerPath = output.split("\n")[0];
      logger.success(`Found installer: ${installerPath}`);
    }
  }

  if (!installerPath) {
    logger.error("Could not find DaVinci Resolve 20.0.1 installer");
    logger.info("Please download it from:");
    logger.info("https://www.blackmagicdesign.com/support/family/davinci-resolve-and-fusion");
    return;
  }

  // Step 4: Make installer executable
  logger.info("Step 4: Making installer executable...");
  
  const chmodProc = new Deno.Command("chmod", {
    args: ["+x", installerPath],
    stdout: "null",
    stderr: "null",
  });
  await chmodProc.output();

  // Step 5: Run installer
  logger.info("Step 5: Installing DaVinci Resolve 20.0.1...");
  logger.info("This will require sudo password and may take a few minutes...");
  
  const installProc = new Deno.Command("sudo", {
    args: [installerPath],
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });
  
  const installResult = await installProc.output();
  
  if (installResult.success) {
    logger.success("DaVinci Resolve 20.0.1 installed successfully!");
    
    // Step 6: Apply the working fixes from before
    logger.info("Step 6: Applying known working fixes...");
    
    // Create the simple launcher that was working
    const launcherContent = `#!/bin/bash
# DaVinci Resolve 20.0.1 Launcher

# Kill any stuck processes
pkill -f VstScanner 2>/dev/null

# Environment
export HOME="\${HOME}"
export USER="\${USER}"
export DISPLAY="\${DISPLAY:-:0}"

# GPU settings
export __NV_PRIME_RENDER_OFFLOAD=1
export __GLX_VENDOR_LIBRARY_NAME=nvidia

# Skip VST scanning
export RESOLVE_SKIP_VST_SCAN=1

# Launch DaVinci Resolve
exec /opt/resolve/bin/resolve "\$@"
`;

    await Deno.writeTextFile("/tmp/davinci-launcher.sh", launcherContent);
    
    const mvProc = new Deno.Command("sudo", {
      args: ["mv", "/tmp/davinci-launcher.sh", "/usr/local/bin/davinci-resolve"],
      stdout: "null",
      stderr: "null",
    });
    await mvProc.output();
    
    const chmod2Proc = new Deno.Command("sudo", {
      args: ["chmod", "+x", "/usr/local/bin/davinci-resolve"],
      stdout: "null",
      stderr: "null",
    });
    await chmod2Proc.output();
    
    logger.success("Setup complete!");
    logger.info("");
    logger.info("Launch DaVinci Resolve with:");
    logger.info("  davinci-resolve");
    logger.info("Or:");
    logger.info("  make system-davinci-launch");
  } else {
    logger.error("Installation failed");
    logger.info("Please check the error messages above");
  }
}

// Main
if (import.meta.main) {
  try {
    await reinstallDaVinci();
  } catch (error) {
    logger.error("Reinstallation failed", { error });
    Deno.exit(1);
  }
}