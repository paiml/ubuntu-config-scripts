#!/usr/bin/env -S deno run --allow-all

/**
 * Final comprehensive fix for DaVinci Resolve 20.1
 * Uses patchelf to fix library loading issues
 */

import { logger } from "../lib/logger.ts";
import { runCommand } from "../lib/common.ts";

async function finalFix(): Promise<void> {
    logger.info("Applying final comprehensive fix for DaVinci Resolve 20.1...");

    // First, restore the original binary if we patched it
    const restoreResult = await runCommand([
        "sudo", "sh", "-c",
        "if [ -f /opt/resolve/bin/resolve.original ]; then cp /opt/resolve/bin/resolve.original /opt/resolve/bin/resolve; fi"
    ]);
    
    if (restoreResult.success) {
        logger.info("Restored original binary");
    }

    // Check current RPATH
    logger.info("Checking current library search paths...");
    const rpathResult = await runCommand(["patchelf", "--print-rpath", "/opt/resolve/bin/resolve"]);
    if (rpathResult.success) {
        logger.info(`Current RPATH: ${rpathResult.stdout.trim() || "(empty)"}`);
    }

    // Create the comprehensive fix script
    const fixScript = `#!/bin/bash
# DaVinci Resolve 20.1 - Comprehensive Library Fix

set -e

echo "Fixing DaVinci Resolve 20.1 library issues..."

# Backup original binary
if [ ! -f /opt/resolve/bin/resolve.original ]; then
    sudo cp /opt/resolve/bin/resolve /opt/resolve/bin/resolve.original
    echo "Backed up original binary"
fi

# Fix the RPATH to find all libraries
echo "Setting library search paths..."
sudo patchelf --set-rpath '/opt/resolve/libs:/opt/resolve/bin:/opt/resolve/libs/plugins/sqldrivers:/opt/resolve/libs/plugins/imageformats:/opt/resolve/libs/plugins/platforms:$ORIGIN:$ORIGIN/../libs:$ORIGIN/../libs/plugins' /opt/resolve/bin/resolve

# Also fix the fusionscript library path
if [ -f /opt/resolve/libs/fusionscript.so ]; then
    echo "fusionscript.so found in libs"
elif [ -f /opt/resolve/bin/fusionscript.so ]; then
    echo "fusionscript.so found in bin"
else
    echo "Warning: fusionscript.so not found, creating symlink..."
    # Look for it and create symlink
    FUSION_LIB=\$(find /opt/resolve -name "fusionscript.so" 2>/dev/null | head -1)
    if [ -n "\$FUSION_LIB" ]; then
        sudo ln -sf "\$FUSION_LIB" /opt/resolve/bin/fusionscript.so
    fi
fi

# Fix other binaries that might need it
for binary in /opt/resolve/bin/{FusionCompServer,FusionLoader,FusionServer}; do
    if [ -f "\$binary" ]; then
        echo "Fixing \$(basename \$binary)..."
        sudo patchelf --set-rpath '/opt/resolve/libs:/opt/resolve/bin:$ORIGIN:$ORIGIN/../libs' "\$binary" 2>/dev/null || true
    fi
done

echo "Library paths fixed!"
`;

    await Deno.writeTextFile("/tmp/fix-resolve-libs.sh", fixScript);
    await Deno.chmod("/tmp/fix-resolve-libs.sh", 0o755);

    logger.info("Created fix script: /tmp/fix-resolve-libs.sh");
    logger.info("Run it with: sudo bash /tmp/fix-resolve-libs.sh");

    // Create the final launcher
    const finalLauncher = `#!/bin/bash
# DaVinci Resolve 20.1 - Final Working Launcher

# Kill stuck processes
pkill -f VstScanner 2>/dev/null

# Set up environment
export HOME="\${HOME}"
export USER="\${USER}"
export DISPLAY="\${DISPLAY:-:0}"

# GPU settings
export __NV_PRIME_RENDER_OFFLOAD=1
export __GLX_VENDOR_LIBRARY_NAME=nvidia

# Disable problematic features
export RESOLVE_CUDA_FORCE=0
export RESOLVE_SKIP_VST_SCAN=1
export QT_LOGGING_RULES="*=false"

# Important: Set library path to include resolve directories
export LD_LIBRARY_PATH="/opt/resolve/libs:/opt/resolve/bin:\${LD_LIBRARY_PATH}"

# Run from the resolve directory to help find resources
cd /opt/resolve
exec ./bin/resolve "\$@"
`;

    await Deno.writeTextFile("/tmp/davinci-final.sh", finalLauncher);
    await Deno.chmod("/tmp/davinci-final.sh", 0o755);

    logger.success("Created final launcher: /tmp/davinci-final.sh");

    // Create a debug launcher to see what's happening
    const debugLauncher = `#!/bin/bash
# DaVinci Resolve 20.1 - Debug Launcher

echo "=== DaVinci Resolve Debug Launch ==="
echo "Checking libraries..."

# Check if libraries exist
for lib in fusionscript.so libglib-2.0.so.0 libpango-1.0.so.0; do
    echo -n "\$lib: "
    if [ -f "/opt/resolve/libs/\$lib" ]; then
        echo "found in libs/"
    elif [ -f "/opt/resolve/bin/\$lib" ]; then
        echo "found in bin/"
    else
        echo "NOT FOUND"
    fi
done

echo ""
echo "Library search paths:"
export LD_LIBRARY_PATH="/opt/resolve/libs:/opt/resolve/bin"
echo "LD_LIBRARY_PATH=\$LD_LIBRARY_PATH"

echo ""
echo "Starting DaVinci Resolve with strace..."
cd /opt/resolve
strace -e openat,open ./bin/resolve 2>&1 | grep -E "(\.so|ENOENT)" | head -20
`;

    await Deno.writeTextFile("/tmp/davinci-debug.sh", debugLauncher);
    await Deno.chmod("/tmp/davinci-debug.sh", 0o755);

    logger.info("Created debug launcher: /tmp/davinci-debug.sh");

    // Instructions
    logger.success("\n=== Fix Instructions ===\n");
    logger.info("1. First, fix the library paths:");
    logger.info("   sudo bash /tmp/fix-resolve-libs.sh\n");
    
    logger.info("2. Then try the final launcher:");
    logger.info("   /tmp/davinci-final.sh\n");
    
    logger.info("3. If it fails, run debug to see what's missing:");
    logger.info("   /tmp/davinci-debug.sh\n");
    
    logger.info("4. Once working, install the launcher:");
    logger.info("   sudo cp /tmp/davinci-final.sh /usr/local/bin/davinci-resolve");
}

if (import.meta.main) {
    try {
        await finalFix();
    } catch (error) {
        logger.error(`Fix failed: ${error}`);
        Deno.exit(1);
    }
}

export { finalFix };