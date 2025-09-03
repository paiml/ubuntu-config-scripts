#!/bin/bash

# PMAT Installation Script for Ubuntu/Debian
# This script installs all dependencies needed for PMAT

set -e

echo "Installing PMAT dependencies..."

# Check if running on Ubuntu/Debian
if [ ! -x /usr/bin/apt ]; then
    echo "This script is for Ubuntu/Debian systems only."
    echo "For other distributions, please install:"
    echo "  - pkg-config"
    echo "  - OpenSSL development libraries (openssl-devel on Fedora/RHEL)"
    exit 1
fi

# Install dependencies
echo "Installing pkg-config and libssl-dev..."
sudo apt update
sudo apt install -y pkg-config libssl-dev

# Check if cargo is installed
if ! command -v cargo &> /dev/null; then
    echo "Cargo not found. Please install Rust first:"
    echo "  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
fi

# Install PMAT
echo "Installing PMAT..."
cargo install pmat

echo "PMAT installation complete!"
echo "You can now use 'make pmat-check' or 'pmat' commands."