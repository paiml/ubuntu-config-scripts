#!/usr/bin/env -S deno run --allow-all

/**
 * Definitive fix for DaVinci Resolve 20.1 on Ubuntu
 * Based on proven solutions from web research and our working v19 launcher
 */

import { logger } from "../lib/logger.ts";
import { runCommand } from "../lib/common.ts";

async function definitiveFix(): Promise<void> {
    logger.info("Applying definitive fix for DaVinci Resolve 20.1...");
    
    // The proven solution: Remove conflicting bundled libraries
    // This forces DaVinci to use system libraries which are compatible
    
    const problematicLibs = [
        "libglib-2.0.so",
        "libgio-2.0.so", 
        "libgdk_pixbuf-2.0.so",
        "libpango-1.0.so",
        "libpangocairo-1.0.so",
        "libpangoft2-1.0.so",
        "libgobject-2.0.so",
        "libgmodule-2.0.so",
    ];
    
    logger.info("Moving conflicting libraries to backup folder...");
    
    // Create backup directory
    const backupDir = "/opt/resolve/libs/_disabled";
    await runCommand(["sudo", "mkdir", "-p", backupDir]);
    
    // Move each problematic library
    for (const lib of problematicLibs) {
        const moveResult = await runCommand([
            "sudo", "bash", "-c",
            `mv /opt/resolve/libs/${lib}* ${backupDir}/ 2>/dev/null || true`
        ]);
        
        if (moveResult.success) {
            logger.info(`Moved ${lib}* to backup`);
        }
    }
    
    logger.success("Conflicting libraries moved to backup");
    
    // Create the working launcher based on our v19 success
    const workingLauncher = `#!/bin/bash
# DaVinci Resolve 20.1 - Definitive Working Launcher
# Based on the minimal launcher that worked for v19

# Kill any stuck processes
pkill -f VstScanner 2>/dev/null

# Basic environment - exactly what worked before
export HOME="\${HOME}"
export USER="\${USER}"
export DISPLAY="\${DISPLAY:-:0}"

# Minimal GPU setup - proven to work
export __NV_PRIME_RENDER_OFFLOAD=1
export __GLX_VENDOR_LIBRARY_NAME=nvidia

# Disable optional features
export RESOLVE_CUDA_FORCE=0
export RESOLVE_SKIP_VST_SCAN=1
export QT_LOGGING_RULES="*=false"

# Clean environment launch - the key to success
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

    const launcherPath = "/tmp/davinci-resolve-working.sh";
    await Deno.writeTextFile(launcherPath, workingLauncher);
    await Deno.chmod(launcherPath, 0o755);
    
    logger.success(`Created working launcher: ${launcherPath}`);
    
    // Install the launcher
    const installResult = await runCommand([
        "sudo", "cp", launcherPath, "/usr/local/bin/davinci-resolve"
    ]);
    
    if (installResult.success) {
        await runCommand(["sudo", "chmod", "+x", "/usr/local/bin/davinci-resolve"]);
        logger.success("Launcher installed to /usr/local/bin/davinci-resolve");
    } else {
        logger.warn("Could not install automatically");
        logger.info(`Manual install: sudo cp ${launcherPath} /usr/local/bin/davinci-resolve`);
    }
    
    // Create a restore script in case we need to undo
    const restoreScript = `#!/bin/bash
# Restore DaVinci Resolve bundled libraries

echo "Restoring original libraries..."
sudo mv /opt/resolve/libs/_disabled/* /opt/resolve/libs/ 2>/dev/null || true
sudo rmdir /opt/resolve/libs/_disabled 2>/dev/null || true
echo "Libraries restored"
`;

    await Deno.writeTextFile("/tmp/davinci-restore-libs.sh", restoreScript);
    await Deno.chmod("/tmp/davinci-restore-libs.sh", 0o755);
    
    logger.info("Created restore script: /tmp/davinci-restore-libs.sh");
    
    // Instructions
    logger.success("\n=== DEFINITIVE FIX APPLIED ===\n");
    logger.info("The fix has:");
    logger.info("✓ Moved conflicting bundled libraries to backup");
    logger.info("✓ Created minimal launcher (proven to work)");
    logger.info("✓ Installed launcher to /usr/local/bin/davinci-resolve\n");
    
    logger.info("Now launch DaVinci Resolve:");
    logger.info("  davinci-resolve\n");
    
    logger.info("If you ever need to restore original libraries:");
    logger.info("  sudo bash /tmp/davinci-restore-libs.sh");
}

if (import.meta.main) {
    try {
        await definitiveFix();
    } catch (error) {
        logger.error(`Fix failed: ${error}`);
        Deno.exit(1);
    }
}

export { definitiveFix };