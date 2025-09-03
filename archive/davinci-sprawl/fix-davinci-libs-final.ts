#!/usr/bin/env -S deno run --allow-all

/**
 * Final fix for DaVinci Resolve 20.1 library issues
 * 
 * Uses DaVinci's bundled libraries exclusively to avoid symbol conflicts
 */

import { logger } from "../lib/logger.ts";
import { runCommand } from "../lib/common.ts";

async function fixDavinciLibraries(): Promise<void> {
    logger.info("Applying final fix for DaVinci Resolve 20.1 library issues...");

    // The solution: Use ONLY DaVinci's bundled libraries, not system ones
    // This avoids symbol mismatches between different library versions

    const finalLauncher = `#!/bin/bash
# DaVinci Resolve 20.1 Launcher - Final Fix
# Uses bundled libraries exclusively to avoid symbol conflicts

# Kill any stuck processes
pkill -f VstScanner 2>/dev/null
pkill -f FusionCompServer 2>/dev/null

# Basic environment
export HOME="\${HOME}"
export USER="\${USER}"
export DISPLAY="\${DISPLAY:-:0}"

# GPU configuration
export __NV_PRIME_RENDER_OFFLOAD=1
export __GLX_VENDOR_LIBRARY_NAME=nvidia

# Disable problematic features
export RESOLVE_CUDA_FORCE=0
export RESOLVE_SKIP_VST_SCAN=1
export QT_LOGGING_RULES="*=false"

# CRITICAL FIX: Use ONLY DaVinci's bundled libraries
# This prevents symbol mismatches with system libraries
export LD_LIBRARY_PATH="/opt/resolve/libs:\${LD_LIBRARY_PATH}"

# Ensure bundled libraries are restored if they were disabled
RESOLVE_LIB_DIR="/opt/resolve/libs"

# Restore any disabled libraries
for lib in libglib-2.0.so.0 libpango-1.0.so.0 libgobject-2.0.so.0; do
    if [ -f "\${RESOLVE_LIB_DIR}/\${lib}.disabled" ]; then
        sudo mv "\${RESOLVE_LIB_DIR}/\${lib}.disabled" "\${RESOLVE_LIB_DIR}/\${lib}" 2>/dev/null || true
    fi
    if [ -f "\${RESOLVE_LIB_DIR}/\${lib}.backup" ]; then
        sudo mv "\${RESOLVE_LIB_DIR}/\${lib}.backup" "\${RESOLVE_LIB_DIR}/\${lib}" 2>/dev/null || true
    fi
done

# Launch with bundled libraries taking precedence
exec /opt/resolve/bin/resolve "\$@"
`;

    // Write the final launcher
    const tempPath = "/tmp/davinci-final-fix.sh";
    await Deno.writeTextFile(tempPath, finalLauncher);
    await Deno.chmod(tempPath, 0o755);

    logger.success("Created final launcher");

    // Restore any disabled libraries
    logger.info("Restoring bundled libraries...");
    
    const libDir = "/opt/resolve/libs";
    const libsToRestore = [
        "libglib-2.0.so.0",
        "libpango-1.0.so.0",
        "libgobject-2.0.so.0",
        "libgdk_pixbuf-2.0.so.0",
    ];

    for (const lib of libsToRestore) {
        // Check for disabled versions
        const disabledPath = `${libDir}/${lib}.disabled`;
        const backupPath = `${libDir}/${lib}.backup`;
        const libPath = `${libDir}/${lib}`;

        try {
            await Deno.stat(disabledPath);
            logger.info(`Restoring ${lib} from disabled state`);
            await runCommand(["sudo", "mv", disabledPath, libPath]);
        } catch {
            // Not disabled
        }

        try {
            await Deno.stat(backupPath);
            logger.info(`Restoring ${lib} from backup`);
            await runCommand(["sudo", "mv", backupPath, libPath]);
        } catch {
            // No backup
        }
    }

    // Alternative: Wrapper that isolates library environment completely
    const isolatedLauncher = `#!/bin/bash
# DaVinci Resolve 20.1 - Isolated Environment Launcher

# Kill stuck processes
pkill -f VstScanner 2>/dev/null

# Create isolated environment with ONLY what DaVinci needs
exec env -i \\
    HOME="\${HOME}" \\
    USER="\${USER}" \\
    DISPLAY="\${DISPLAY:-:0}" \\
    PATH="/opt/resolve/bin:/usr/bin:/bin" \\
    LD_LIBRARY_PATH="/opt/resolve/libs" \\
    __NV_PRIME_RENDER_OFFLOAD=1 \\
    __GLX_VENDOR_LIBRARY_NAME=nvidia \\
    RESOLVE_CUDA_FORCE=0 \\
    RESOLVE_SKIP_VST_SCAN=1 \\
    /opt/resolve/bin/resolve "\$@"
`;

    await Deno.writeTextFile("/tmp/davinci-isolated.sh", isolatedLauncher);
    await Deno.chmod("/tmp/davinci-isolated.sh", 0o755);

    // Install the launcher
    logger.info("Installing final launcher...");
    
    const installResult = await runCommand([
        "sudo", "cp", tempPath, "/usr/local/bin/davinci-resolve"
    ]);

    if (installResult.success) {
        await runCommand(["sudo", "chmod", "+x", "/usr/local/bin/davinci-resolve"]);
        logger.success("Final launcher installed");
    } else {
        logger.warn("Could not install automatically");
        logger.info(`Manual install: sudo cp ${tempPath} /usr/local/bin/davinci-resolve`);
    }

    // Check library dependencies
    logger.info("Checking DaVinci Resolve library dependencies...");
    
    const lddResult = await runCommand([
        "ldd", "/opt/resolve/bin/resolve"
    ]);
    
    if (lddResult.success) {
        const missingLibs = lddResult.stdout.split('\n')
            .filter(line => line.includes("not found"))
            .map(line => line.trim());
            
        if (missingLibs.length > 0) {
            logger.warn("Missing libraries detected:");
            missingLibs.forEach(lib => logger.warn(`  ${lib}`));
        } else {
            logger.success("All libraries found");
        }
    }

    // Final instructions
    logger.success("\n=== Fix Applied ===");
    logger.info("Two launcher options created:");
    logger.info("1. Standard fix: Uses bundled libraries with proper ordering");
    logger.info("2. Isolated environment: /tmp/davinci-isolated.sh");
    logger.info("\nTry launching:");
    logger.info("  davinci-resolve");
    logger.info("\nIf that fails, try the isolated launcher:");
    logger.info("  /tmp/davinci-isolated.sh");
    logger.info("\nLast resort - run directly with bundled libs:");
    logger.info("  LD_LIBRARY_PATH=/opt/resolve/libs /opt/resolve/bin/resolve");
}

if (import.meta.main) {
    try {
        await fixDavinciLibraries();
    } catch (error) {
        logger.error(`Fix failed: ${error}`);
        Deno.exit(1);
    }
}

export { fixDavinciLibraries };