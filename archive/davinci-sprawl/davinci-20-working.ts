#!/usr/bin/env -S deno run --allow-all

/**
 * Working launcher for DaVinci Resolve 20.1
 * Based on the proven minimal approach from version 19
 */

import { logger } from "../lib/logger.ts";
import { runCommand } from "../lib/common.ts";

async function createWorkingLauncher(): Promise<void> {
    logger.info("Creating working launcher for DaVinci Resolve 20.1...");

    // The solution that worked for version 19 - minimal environment
    const workingLauncher = `#!/bin/bash
# DaVinci Resolve 20.1 - Minimal Working Launcher
# Based on the configuration that worked for version 19

# Clean any stuck processes
pkill -f VstScanner 2>/dev/null

# Minimal environment - what worked before
export HOME="\${HOME}"
export USER="\${USER}"
export DISPLAY="\${DISPLAY:-:0}"

# Basic GPU
export __NV_PRIME_RENDER_OFFLOAD=1
export __GLX_VENDOR_LIBRARY_NAME=nvidia

# Disable extras
export RESOLVE_CUDA_FORCE=0
export RESOLVE_SKIP_VST_SCAN=1

# The key: Let DaVinci find its own libraries
# Don't set LD_LIBRARY_PATH at all - let the binary use its RPATH
unset LD_LIBRARY_PATH
unset LD_PRELOAD

# Launch with minimal environment
exec env -i \\
    HOME="\$HOME" \\
    USER="\$USER" \\
    DISPLAY="\$DISPLAY" \\
    PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \\
    __NV_PRIME_RENDER_OFFLOAD=1 \\
    __GLX_VENDOR_LIBRARY_NAME=nvidia \\
    /opt/resolve/bin/resolve "\$@"
`;

    await Deno.writeTextFile("/tmp/davinci-minimal-20.sh", workingLauncher);
    await Deno.chmod("/tmp/davinci-minimal-20.sh", 0o755);
    
    logger.success("Created minimal launcher: /tmp/davinci-minimal-20.sh");

    // Alternative: Use patchelf to fix the binary's library search path
    logger.info("Checking if we can fix library paths with patchelf...");
    
    const patchelfCheck = await runCommand(["which", "patchelf"]);
    if (!patchelfCheck.success) {
        logger.info("patchelf not installed. To install: sudo apt install patchelf");
    } else {
        logger.info("patchelf available - creating patched launcher");
        
        const patchedLauncher = `#!/bin/bash
# DaVinci Resolve 20.1 - Patched Binary Launcher

# First, patch the binary to use correct library paths (run once)
if [ ! -f /opt/resolve/bin/resolve.patched ]; then
    echo "Patching DaVinci Resolve binary..."
    sudo cp /opt/resolve/bin/resolve /opt/resolve/bin/resolve.original
    sudo patchelf --set-rpath '/opt/resolve/libs:$ORIGIN/../libs' /opt/resolve/bin/resolve
    sudo touch /opt/resolve/bin/resolve.patched
fi

# Clean environment launch
export HOME="\${HOME}"
export USER="\${USER}"
export DISPLAY="\${DISPLAY:-:0}"
export __NV_PRIME_RENDER_OFFLOAD=1
export __GLX_VENDOR_LIBRARY_NAME=nvidia

# Launch
exec /opt/resolve/bin/resolve "\$@"
`;

        await Deno.writeTextFile("/tmp/davinci-patched.sh", patchedLauncher);
        await Deno.chmod("/tmp/davinci-patched.sh", 0o755);
        logger.info("Created patched launcher: /tmp/davinci-patched.sh");
    }

    // Last resort: Use the AppImage approach
    const appImageLauncher = `#!/bin/bash
# DaVinci Resolve 20.1 - AppImage-style Launcher

# Create a wrapper that completely isolates the application
export APPDIR=/opt/resolve
export APPIMAGE_EXTRACT_AND_RUN=1

# Set up library path to ONLY use bundled libraries
export LD_LIBRARY_PATH="\${APPDIR}/libs:\${APPDIR}/libs/plugins:\${APPDIR}/bin"

# Basic environment
export HOME="\${HOME}"
export USER="\${USER}"
export DISPLAY="\${DISPLAY:-:0}"

# GPU
export __NV_PRIME_RENDER_OFFLOAD=1
export __GLX_VENDOR_LIBRARY_NAME=nvidia

# Disable features
export RESOLVE_CUDA_FORCE=0
export RESOLVE_SKIP_VST_SCAN=1

# Use the bundled libraries by running from the app directory
cd /opt/resolve
exec ./bin/resolve "\$@"
`;

    await Deno.writeTextFile("/tmp/davinci-appimage.sh", appImageLauncher);
    await Deno.chmod("/tmp/davinci-appimage.sh", 0o755);
    
    logger.success("Created AppImage-style launcher: /tmp/davinci-appimage.sh");

    // Instructions
    logger.info("\n=== Three Solutions to Try ===\n");
    
    logger.info("1. MINIMAL (what worked for v19):");
    logger.info("   /tmp/davinci-minimal-20.sh");
    logger.info("   This uses the minimal environment that worked before\n");
    
    logger.info("2. APPIMAGE-STYLE:");
    logger.info("   /tmp/davinci-appimage.sh");
    logger.info("   Runs from /opt/resolve directory with bundled libs\n");
    
    if (patchelfCheck.success) {
        logger.info("3. PATCHED BINARY:");
        logger.info("   /tmp/davinci-patched.sh");
        logger.info("   Uses patchelf to fix library search paths\n");
    }
    
    logger.info("To make permanent, copy working launcher to:");
    logger.info("sudo cp [working-launcher] /usr/local/bin/davinci-resolve");
}

if (import.meta.main) {
    try {
        await createWorkingLauncher();
    } catch (error) {
        logger.error(`Failed: ${error}`);
        Deno.exit(1);
    }
}

export { createWorkingLauncher };