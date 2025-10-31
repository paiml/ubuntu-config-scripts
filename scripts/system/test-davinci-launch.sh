#!/bin/bash
# Test launcher for DaVinci Resolve - can test without sudo

# Kill stuck processes
pkill -f VstScanner 2>/dev/null

# Environment
export HOME="${HOME}"
export USER="${USER}"
export DISPLAY="${DISPLAY:-:0}"

# GPU
export __NV_PRIME_RENDER_OFFLOAD=1
export __GLX_VENDOR_LIBRARY_NAME=nvidia

# Skip VST
export RESOLVE_SKIP_VST_SCAN=1

# Test different library configurations
echo "Testing DaVinci Resolve launch configurations..."
echo ""

# Test 1: Only DaVinci's bundled libraries
echo "Test 1: Using only DaVinci's bundled libraries"
LD_LIBRARY_PATH="/opt/resolve/libs:/opt/resolve/bin" ldd /opt/resolve/bin/resolve 2>&1 | grep "not found" | head -5

# Test 2: With compat libraries
echo ""
echo "Test 2: With compat libraries"
LD_LIBRARY_PATH="/opt/resolve/libs:/opt/resolve/libs_compat:/opt/resolve/bin" ldd /opt/resolve/bin/resolve 2>&1 | grep "not found" | head -5

# Test 3: Try to actually launch
echo ""
echo "Test 3: Attempting launch with compat libs..."
export LD_LIBRARY_PATH="/opt/resolve/libs:/opt/resolve/libs_compat:/opt/resolve/bin:/usr/lib/nvidia"

# Check what will be loaded
echo "Libraries that will be used:"
ldd /opt/resolve/bin/resolve 2>&1 | grep -E "(pango|glib|gdk|gtk)" | head -10

echo ""
echo "Launching..."
exec /opt/resolve/bin/resolve "$@"