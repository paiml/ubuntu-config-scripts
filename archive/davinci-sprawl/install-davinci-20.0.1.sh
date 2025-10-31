#!/bin/bash

echo "Installing DaVinci Resolve 20.0.1..."

# Install required packages
echo "Installing required packages..."
sudo apt-get update
sudo apt-get install -y libapr1 libaprutil1 libasound2 libglib2.0-0

# Run the installer with SKIP_PACKAGE_CHECK if packages still fail
echo "Running DaVinci Resolve 20.0.1 installer..."
SKIP_PACKAGE_CHECK=1 sudo /home/noah/Downloads/DaVinci_Resolve_Studio_20.0.1_Linux/DaVinci_Resolve_Studio_20.0.1_Linux.run

# Create working launcher
echo "Creating launcher..."
sudo tee /usr/local/bin/davinci-resolve > /dev/null << 'EOF'
#!/bin/bash
# DaVinci Resolve 20.0.1 Launcher

# Kill any stuck processes
pkill -f VstScanner 2>/dev/null

# Environment
export HOME="${HOME}"
export USER="${USER}"
export DISPLAY="${DISPLAY:-:0}"

# GPU settings
export __NV_PRIME_RENDER_OFFLOAD=1
export __GLX_VENDOR_LIBRARY_NAME=nvidia

# Skip VST scanning
export RESOLVE_SKIP_VST_SCAN=1

# Launch DaVinci Resolve
exec /opt/resolve/bin/resolve "$@"
EOF

sudo chmod +x /usr/local/bin/davinci-resolve

echo ""
echo "Installation complete!"
echo "Launch DaVinci Resolve with: davinci-resolve"