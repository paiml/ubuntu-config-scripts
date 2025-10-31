#!/bin/bash
# install.sh - Install Ruchy Ubuntu Config Scripts
#
# Installs Ruchy-based system configuration and diagnostic tools
# to ~/.local/share/ruchy-ubuntu-scripts with CLI tools in ~/.local/bin

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="${HOME}/.local/share/ruchy-ubuntu-scripts"
BIN_DIR="${HOME}/.local/bin"
MIN_RUCHY_VERSION="3.155.0"

# Helper functions
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Version comparison helper
version_ge() {
    # Returns true if $1 >= $2
    [ "$(printf '%s\n' "$2" "$1" | sort -V | head -n1)" = "$2" ]
}

# Check if Ruchy is installed and meets minimum version
check_ruchy_version() {
    echo "Checking Ruchy installation..."

    if ! command -v ruchy &> /dev/null; then
        print_error "Ruchy not found"
        echo ""
        echo "Please install Ruchy v${MIN_RUCHY_VERSION} or higher:"
        echo "  cargo install ruchy --version ${MIN_RUCHY_VERSION}"
        echo ""
        echo "For more info: https://github.com/paiml/ruchy"
        exit 1
    fi

    # Get Ruchy version
    local version_output
    version_output=$(ruchy --version 2>&1)

    # Extract version number (handles formats like "ruchy 3.153.0" or "3.153.0")
    local version
    version=$(echo "$version_output" | grep -oP '\d+\.\d+\.\d+' | head -n1)

    if [ -z "$version" ]; then
        print_error "Could not determine Ruchy version"
        echo "Version output: $version_output"
        exit 1
    fi

    # Check if version meets minimum requirement
    if ! version_ge "$version" "$MIN_RUCHY_VERSION"; then
        print_error "Ruchy v${MIN_RUCHY_VERSION} or higher required (found v${version})"
        echo ""
        echo "Please upgrade Ruchy:"
        echo "  cargo install ruchy --version ${MIN_RUCHY_VERSION} --force"
        exit 1
    fi

    print_success "Ruchy v${version} detected"
}

# Check if we're in the right directory
check_directory() {
    if [ ! -d "ruchy" ] || [ ! -f "ruchy/Cargo.toml" ]; then
        print_error "Must run from ubuntu-config-scripts root directory"
        echo "Please cd to the repository root and try again"
        exit 1
    fi

    print_success "Repository structure validated"
}

# Install files to target directory
install_files() {
    echo ""
    echo "Installing files..."

    # Create installation directory
    mkdir -p "$INSTALL_DIR"

    # Copy all Ruchy files
    print_info "Copying files to $INSTALL_DIR"
    cp -r ruchy/* "$INSTALL_DIR/"

    # Set permissions
    chmod -R u+rw "$INSTALL_DIR"

    print_success "Files installed to $INSTALL_DIR"
}

# Create symlinks for CLI tools
create_symlinks() {
    echo ""
    echo "Creating command-line tools..."

    # Create bin directory if it doesn't exist
    mkdir -p "$BIN_DIR"

    # Create wrapper script for ubuntu-diag
    local diag_wrapper="$BIN_DIR/ubuntu-diag"

    cat > "$diag_wrapper" << 'EOF'
#!/bin/bash
# ubuntu-diag - System diagnostics CLI
# Wrapper script to run Ruchy diagnostics tool

RUCHY_SCRIPTS="${HOME}/.local/share/ruchy-ubuntu-scripts"

if [ ! -d "$RUCHY_SCRIPTS" ]; then
    echo "Error: Ruchy Ubuntu Scripts not installed"
    echo "Run: ./install.sh"
    exit 1
fi

cd "$RUCHY_SCRIPTS"
ruchy bin/ubuntu-diag.ruchy "$@"
EOF

    chmod +x "$diag_wrapper"

    print_success "Created ubuntu-diag command"
}

# Check PATH configuration
check_path() {
    echo ""

    if [[ ":$PATH:" != *":${BIN_DIR}:"* ]]; then
        print_info "Note: ${BIN_DIR} is not in your PATH"
        echo ""
        echo "Add this to your ~/.bashrc or ~/.zshrc:"
        echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
        echo ""
        echo "Then reload your shell:"
        echo "  source ~/.bashrc  # or source ~/.zshrc"
        echo ""
    else
        print_success "PATH is configured correctly"
    fi
}

# Run health check to validate installation
health_check() {
    echo ""
    echo "Running health check..."

    cd "$INSTALL_DIR"

    # Run integration test to verify installation
    if ruchy tests/integration/test_system_health.ruchy > /dev/null 2>&1; then
        print_success "Health check passed"
    else
        print_error "Health check failed"
        echo "Installation may be incomplete. Please check for errors above."
        exit 1
    fi
}

# Display post-installation information
show_next_steps() {
    echo ""
    echo "================================================="
    echo " Installation Complete! "
    echo "================================================="
    echo ""
    echo "Try these commands:"
    echo "  ubuntu-diag              # Run system diagnostics"
    echo ""
    echo "Documentation:"
    echo "  $INSTALL_DIR/README.md"
    echo ""
    echo "Module usage:"
    echo "  cat $INSTALL_DIR/examples/system_health_check.ruchy"
    echo ""
    echo "To uninstall:"
    echo "  ./uninstall.sh"
    echo ""
}

# Main installation flow
main() {
    echo "================================================="
    echo " Ruchy Ubuntu Config Scripts - Installation    "
    echo "================================================="
    echo ""

    check_ruchy_version
    check_directory
    install_files
    create_symlinks
    health_check
    check_path
    show_next_steps
}

# Run main installation
main
