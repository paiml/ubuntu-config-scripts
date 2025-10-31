#!/bin/bash

echo "Checking DaVinci Resolve library situation..."
echo ""

echo "1. Checking if DaVinci bundles glib/pango:"
ls /opt/resolve/libs/*glib* 2>/dev/null && echo "  - Found glib" || echo "  - No glib bundled"
ls /opt/resolve/libs/*pango* 2>/dev/null && echo "  - Found pango" || echo "  - No pango bundled"

echo ""
echo "2. Testing minimal launch:"
LD_LIBRARY_PATH="/opt/resolve/libs:/opt/resolve/bin" ldd /opt/resolve/bin/resolve 2>&1 | grep "not found"

echo ""
echo "3. System library versions:"
ls -la /usr/lib/x86_64-linux-gnu/libglib-2.0.so* | head -3
ls -la /usr/lib/x86_64-linux-gnu/libpango-1.0.so* | head -3