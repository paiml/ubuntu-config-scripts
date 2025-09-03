#!/usr/bin/env -S deno run --allow-all

/**
 * Fix DaVinci Resolve 20.1 glib symbol error
 * 
 * Fixes: undefined symbol: g_once_init_leave_pointer
 */

import { logger } from "../lib/logger.ts";
import { runCommand } from "../lib/common.ts";

async function fixGlibSymbolError(): Promise<void> {
    logger.info("Fixing DaVinci Resolve 20.1 glib symbol error...");

    // The issue is that DaVinci bundles its own older glib that conflicts
    // We need to use the system libraries instead

    // 1. Create a fixed launcher that preloads correct libraries
    const fixedLauncher = `#!/bin/bash
# DaVinci Resolve 20.1 Launcher - Fixed for glib symbol error

# Kill any stuck VST scanners
pkill -f VstScanner 2>/dev/null

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

# FIX: Use system glib instead of bundled version
# This fixes the g_once_init_leave_pointer symbol error
export LD_LIBRARY_PATH="/usr/lib/x86_64-linux-gnu:\${LD_LIBRARY_PATH}"
export LD_PRELOAD="/usr/lib/x86_64-linux-gnu/libglib-2.0.so.0:/usr/lib/x86_64-linux-gnu/libpango-1.0.so.0:\${LD_PRELOAD}"

# Alternative fix: Skip DaVinci's bundled libraries
RESOLVE_LIB_DIR="/opt/resolve/libs"

# Move problematic bundled libraries out of the way
if [ -f "\${RESOLVE_LIB_DIR}/libglib-2.0.so.0" ]; then
    sudo mv "\${RESOLVE_LIB_DIR}/libglib-2.0.so.0" "\${RESOLVE_LIB_DIR}/libglib-2.0.so.0.disabled" 2>/dev/null || true
fi

if [ -f "\${RESOLVE_LIB_DIR}/libpango-1.0.so.0" ]; then
    sudo mv "\${RESOLVE_LIB_DIR}/libpango-1.0.so.0" "\${RESOLVE_LIB_DIR}/libpango-1.0.so.0.disabled" 2>/dev/null || true
fi

# Launch with corrected library path
exec /opt/resolve/bin/resolve "\$@"
`;

    // Write the fixed launcher
    const tempPath = "/tmp/davinci-fixed-glib.sh";
    await Deno.writeTextFile(tempPath, fixedLauncher);
    await Deno.chmod(tempPath, 0o755);

    logger.info("Created fixed launcher");

    // 2. Check for problematic bundled libraries
    logger.info("Checking for conflicting bundled libraries...");
    
    const libsToCheck = [
        "/opt/resolve/libs/libglib-2.0.so.0",
        "/opt/resolve/libs/libpango-1.0.so.0",
        "/opt/resolve/libs/libgobject-2.0.so.0",
    ];

    for (const lib of libsToCheck) {
        try {
            await Deno.stat(lib);
            logger.warn(`Found bundled library: ${lib}`);
            logger.info(`This may conflict with system libraries`);
        } catch {
            // Library doesn't exist, that's good
        }
    }

    // 3. Install the fixed launcher
    logger.info("Installing fixed launcher...");
    
    const installResult = await runCommand([
        "sudo", "cp", tempPath, "/usr/local/bin/davinci-resolve"
    ]);

    if (installResult.success) {
        await runCommand(["sudo", "chmod", "+x", "/usr/local/bin/davinci-resolve"]);
        logger.success("Fixed launcher installed");
    } else {
        logger.warn("Could not install automatically");
        logger.info(`Manual install: sudo cp ${tempPath} /usr/local/bin/davinci-resolve`);
    }

    // 4. Alternative solution - symlink approach
    const symlinkScript = `#!/bin/bash
# Alternative fix using symlinks

echo "Creating symlinks for system libraries..."

# Backup and replace bundled libraries with symlinks to system versions
RESOLVE_LIBS="/opt/resolve/libs"

for lib in libglib-2.0.so.0 libpango-1.0.so.0 libgobject-2.0.so.0; do
    if [ -f "\${RESOLVE_LIBS}/\${lib}" ]; then
        echo "Replacing \${lib}..."
        sudo mv "\${RESOLVE_LIBS}/\${lib}" "\${RESOLVE_LIBS}/\${lib}.backup" 2>/dev/null || true
        sudo ln -sf "/usr/lib/x86_64-linux-gnu/\${lib}" "\${RESOLVE_LIBS}/\${lib}"
    fi
done

echo "Symlinks created. Try launching DaVinci Resolve again."
`;

    await Deno.writeTextFile("/tmp/davinci-symlink-fix.sh", symlinkScript);
    await Deno.chmod("/tmp/davinci-symlink-fix.sh", 0o755);

    // 5. Check system library versions
    logger.info("Checking system library versions...");
    
    const glibCheck = await runCommand([
        "ldd", "--version"
    ]);
    
    if (glibCheck.success) {
        const version = glibCheck.stdout.split('\n')[0];
        logger.info(`System glibc: ${version}`);
    }

    const pangoCheck = await runCommand([
        "pkg-config", "--modversion", "pango"
    ]);
    
    if (pangoCheck.success) {
        logger.info(`System pango: ${pangoCheck.stdout.trim()}`);
    }

    // 6. Final instructions
    logger.success("Fix applied!");
    logger.info("\n=== Solutions Applied ===");
    logger.info("1. Primary fix: Updated launcher with LD_PRELOAD");
    logger.info("2. Alternative: Symlink script at /tmp/davinci-symlink-fix.sh");
    logger.info("\nTry launching DaVinci Resolve:");
    logger.info("  davinci-resolve");
    logger.info("\nIf it still fails, run the symlink fix:");
    logger.info("  sudo bash /tmp/davinci-symlink-fix.sh");
}

if (import.meta.main) {
    try {
        await fixGlibSymbolError();
    } catch (error) {
        logger.error(`Fix failed: ${error}`);
        Deno.exit(1);
    }
}

export { fixGlibSymbolError };