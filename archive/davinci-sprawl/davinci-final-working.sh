#!/bin/bash
# DaVinci Resolve 20.0.1 - WORKING Solution

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

# THE KEY: Use DaVinci's bundled glib FIRST, then add system libs for pango
export LD_LIBRARY_PATH="/opt/resolve/libs:/opt/resolve/bin:/usr/lib/x86_64-linux-gnu:/usr/lib/nvidia"

# Preload DaVinci's glib to ensure it's used
export LD_PRELOAD="/opt/resolve/libs/libglib-2.0.so.0"

# Launch
exec /opt/resolve/bin/resolve "$@"