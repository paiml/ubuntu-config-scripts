#!/bin/bash
# uninstall.sh - Uninstall Ruchy Ubuntu Config Scripts
#
# Removes all installed files and symlinks

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="${HOME}/.local/share/ruchy-ubuntu-scripts"
BIN_DIR="${HOME}/.local/bin"

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

# Confirm uninstallation
confirm_uninstall() {
    echo "================================================="
    echo " Ruchy Ubuntu Config Scripts - Uninstallation  "
    echo "================================================="
    echo ""
    echo "This will remove:"
    echo "  - $INSTALL_DIR"
    echo "  - $BIN_DIR/ubuntu-diag"
    echo ""
    read -p "Continue? (y/N) " -n 1 -r
    echo ""

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Uninstallation cancelled"
        exit 0
    fi
}

# Remove symlinks
remove_symlinks() {
    echo ""
    echo "Removing command-line tools..."

    if [ -f "$BIN_DIR/ubuntu-diag" ]; then
        rm -f "$BIN_DIR/ubuntu-diag"
        print_success "Removed ubuntu-diag command"
    else
        print_info "ubuntu-diag not found (may already be removed)"
    fi
}

# Remove installation directory
remove_files() {
    echo ""
    echo "Removing installed files..."

    if [ -d "$INSTALL_DIR" ]; then
        rm -rf "$INSTALL_DIR"
        print_success "Removed $INSTALL_DIR"
    else
        print_info "Installation directory not found (may already be removed)"
    fi
}

# Verify uninstallation
verify_removal() {
    echo ""
    echo "Verifying removal..."

    local errors=0

    if [ -d "$INSTALL_DIR" ]; then
        print_error "Installation directory still exists"
        errors=$((errors + 1))
    fi

    if [ -f "$BIN_DIR/ubuntu-diag" ]; then
        print_error "ubuntu-diag symlink still exists"
        errors=$((errors + 1))
    fi

    if [ $errors -eq 0 ]; then
        print_success "All files removed"
    else
        print_error "Uninstallation incomplete ($errors issues)"
        exit 1
    fi
}

# Display completion message
show_completion() {
    echo ""
    echo "================================================="
    echo " Uninstallation Complete                       "
    echo "================================================="
    echo ""
    echo "Ruchy Ubuntu Config Scripts has been removed."
    echo ""
    echo "To reinstall:"
    echo "  ./install.sh"
    echo ""
}

# Main uninstallation flow
main() {
    confirm_uninstall
    remove_symlinks
    remove_files
    verify_removal
    show_completion
}

# Run main uninstallation
main
