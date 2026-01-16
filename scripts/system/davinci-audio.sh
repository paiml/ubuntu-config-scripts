#!/usr/bin/env bash
# DaVinci Resolve Audio Control Script
# Wrapper for DaVinci Resolve Python API
#
# Usage:
#   davinci-audio.sh status          # Show audio status
#   davinci-audio.sh tracks          # List audio tracks
#   davinci-audio.sh project         # Show project audio settings
#   davinci-audio.sh clip            # Show current clip audio info
#   davinci-audio.sh enable <track>  # Enable audio track
#   davinci-audio.sh disable <track> # Disable audio track

set -euo pipefail

# DaVinci Resolve API environment
export RESOLVE_SCRIPT_API="/opt/resolve/Developer/Scripting"
export RESOLVE_SCRIPT_LIB="/opt/resolve/libs/Fusion/fusionscript.so"
export PYTHONPATH="${PYTHONPATH:-}:$RESOLVE_SCRIPT_API/Modules/"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_SCRIPT="$SCRIPT_DIR/davinci-audio.py"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

usage() {
    echo -e "${CYAN}DaVinci Resolve Audio Control${NC}"
    echo ""
    echo "Usage: $(basename "$0") <command> [args]"
    echo ""
    echo "Commands:"
    echo "  status           Show overall audio status"
    echo "  tracks           List all audio tracks"
    echo "  project          Show project audio settings"
    echo "  clip             Show current clip audio info"
    echo "  enable <track>   Enable audio track (1-based index)"
    echo "  disable <track>  Disable audio track (1-based index)"
    echo "  fairlight        List Fairlight presets"
    echo "  render-h264      Configure render settings for H.264"
    echo "  disable-proxy    Show how to disable proxy generation"
    echo "  defaults         Apply recommended Linux defaults"
    echo ""
    echo "Examples:"
    echo "  $(basename "$0") status"
    echo "  $(basename "$0") enable 1"
    echo "  $(basename "$0") render-h264"
    echo "  $(basename "$0") defaults"
    echo ""
    echo -e "${YELLOW}Note: DaVinci Resolve must be running${NC}"
}

check_resolve_running() {
    # DaVinci uses various process names
    if ! pgrep -f "/opt/resolve" > /dev/null 2>&1; then
        echo -e "${RED}Error: DaVinci Resolve is not running${NC}"
        echo "Please start DaVinci Resolve first."
        exit 1
    fi
}

run_python() {
    python3 "$PYTHON_SCRIPT" "$@"
}

main() {
    if [[ $# -lt 1 ]]; then
        usage
        exit 1
    fi

    check_resolve_running

    case "$1" in
        status|tracks|project|clip|fairlight|render-h264|disable-proxy|defaults)
            run_python "$1"
            ;;
        enable)
            if [[ $# -lt 2 ]]; then
                echo -e "${RED}Error: track index required${NC}"
                exit 1
            fi
            run_python enable "$2"
            ;;
        disable)
            if [[ $# -lt 2 ]]; then
                echo -e "${RED}Error: track index required${NC}"
                exit 1
            fi
            run_python disable "$2"
            ;;
        -h|--help|help)
            usage
            ;;
        *)
            echo -e "${RED}Unknown command: $1${NC}"
            usage
            exit 1
            ;;
    esac
}

main "$@"
