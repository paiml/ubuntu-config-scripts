#!/bin/bash

# Launch OBS with proper settings for screencasting

echo "Launching OBS Studio for screencasting..."
echo ""
echo "IMPORTANT: For screen capture to work:"
echo "1. Click the '+' button under Sources"
echo "2. Select 'Screen Capture (XSHM)' - NOT PipeWire"
echo "3. Give it a name and click OK"
echo "4. Select your monitor (usually Screen 0)"
echo "5. Check 'Capture Cursor' if you want to see the mouse"
echo ""
echo "Audio should already be configured:"
echo "- Desktop Audio: For system sounds"
echo "- Mic/Aux: For your Yamaha microphone"
echo ""
echo "Recording shortcuts:"
echo "- Ctrl+Alt+R: Start recording"
echo "- Ctrl+Alt+S: Stop recording"
echo ""

# Set environment for better compatibility
export OBS_USE_EGL=1
export QT_QPA_PLATFORM=xcb
export GDK_BACKEND=x11

# For NVIDIA GPUs
if command -v nvidia-smi &> /dev/null; then
    export __GL_SYNC_TO_VBLANK=0
    export __GL_YIELD="NOTHING"
fi

# Launch OBS
exec /usr/bin/obs --profile "Screencast" --disable-updater "$@"