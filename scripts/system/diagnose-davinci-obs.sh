#!/usr/bin/env bash
# shellcheck shell=bash
#
# diagnose-davinci-obs.sh - Diagnostics for DaVinci Resolve + OBS Studio on Linux
#
# This script diagnoses common issues with DaVinci Resolve and OBS Studio,
# focusing on audio codec compatibility and configuration problems.
#
# Usage:
#   diagnose-davinci-obs.sh [command]
#
# Commands:
#   all         Run all diagnostics (default)
#   davinci     DaVinci Resolve diagnostics only
#   obs         OBS Studio diagnostics only
#   file FILE   Check if a video file is DaVinci-compatible
#   fix FILE    Convert file to DaVinci-compatible format
#   summary     Show quick summary of system status

set -euo pipefail

# Colors
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[0;33m'
readonly CYAN='\033[0;36m'
readonly BOLD='\033[1m'
readonly NC='\033[0m'

# Exit codes
readonly EXIT_SUCCESS=0
readonly EXIT_ERROR=1
readonly EXIT_WARNING=2

# Globals for test results
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_WARNED=0

#######################################
# Print a header section
# Arguments:
#   $1 - Header text
#######################################
print_header() {
    local text="$1"
    echo ""
    echo -e "${CYAN}${BOLD}════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}${BOLD}  ${text}${NC}"
    echo -e "${CYAN}${BOLD}════════════════════════════════════════════════════════════${NC}"
    echo ""
}

#######################################
# Print a success message
# Arguments:
#   $1 - Message text
#######################################
print_pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((TESTS_PASSED++)) || true
}

#######################################
# Print a failure message
# Arguments:
#   $1 - Message text
#######################################
print_fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    ((TESTS_FAILED++)) || true
}

#######################################
# Print a warning message
# Arguments:
#   $1 - Message text
#######################################
print_warn() {
    echo -e "${YELLOW}⚠ WARN${NC}: $1"
    ((TESTS_WARNED++)) || true
}

#######################################
# Print an info message
# Arguments:
#   $1 - Message text
#######################################
print_info() {
    echo -e "  ${CYAN}→${NC} $1"
}

#######################################
# Check if a command exists
# Arguments:
#   $1 - Command name
# Returns:
#   0 if exists, 1 otherwise
#######################################
command_exists() {
    command -v "$1" &>/dev/null
}

#######################################
# Check if DaVinci Resolve is installed
# Returns:
#   0 if installed, 1 otherwise
#######################################
check_davinci_installed() {
    if [[ -d "/opt/resolve" ]]; then
        print_pass "DaVinci Resolve is installed"
        local version
        version=$(grep -oP 'Version \K[0-9.]+' /opt/resolve/docs/ReadMe.html 2>/dev/null | head -1 || echo "unknown")
        print_info "Version: ${version}"
        return 0
    else
        print_fail "DaVinci Resolve is not installed"
        print_info "Download from: https://www.blackmagicdesign.com/products/davinciresolve"
        return 1
    fi
}

#######################################
# Check if DaVinci Resolve is running
# Returns:
#   0 if running, 1 otherwise
#######################################
check_davinci_running() {
    if pgrep -f "/opt/resolve" &>/dev/null; then
        print_pass "DaVinci Resolve is running"
        return 0
    else
        print_warn "DaVinci Resolve is not running"
        print_info "Start DaVinci for full API diagnostics"
        return 1
    fi
}

#######################################
# Check DaVinci logs for audio errors
# Returns:
#   0 if no errors, 1 if errors found
#######################################
check_davinci_logs() {
    local log_file="$HOME/.local/share/DaVinciResolve/logs/ResolveDebug.txt"

    if [[ ! -f "$log_file" ]]; then
        print_warn "DaVinci log file not found"
        return 1
    fi

    # Check for AAC decode errors (last 100 lines)
    local aac_errors
    aac_errors=$(tail -100 "$log_file" 2>/dev/null | grep -c "Failed to decode the audio samples" || echo "0")

    if [[ "$aac_errors" -gt 0 ]]; then
        print_fail "Found ${aac_errors} AAC audio decode errors in logs"
        print_info "DaVinci on Linux cannot decode AAC audio"
        print_info "Convert files to PCM: ffmpeg -i input.mp4 -c:v copy -c:a pcm_s24le output.mov"
        return 1
    else
        print_pass "No AAC audio decode errors in recent logs"
        return 0
    fi
}

#######################################
# Check DaVinci cloud sync errors
# Returns:
#   0 if no errors, 1 if errors found
#######################################
check_davinci_cloud() {
    local log_file="$HOME/.local/share/DaVinciResolve/logs/ResolveDebug.txt"

    if [[ ! -f "$log_file" ]]; then
        return 0
    fi

    local cloud_errors
    cloud_errors=$(tail -100 "$log_file" 2>/dev/null | grep -c "NotEnoughSpace\|volume full" || echo "0")

    if [[ "$cloud_errors" -gt 0 ]]; then
        print_warn "Blackmagic Cloud storage is full"
        print_info "Disable media sync: Project Settings → Blackmagic Cloud → Don't sync media"
        return 1
    else
        print_pass "No Blackmagic Cloud errors"
        return 0
    fi
}

#######################################
# Check for proxy/sync folder clutter
# Returns:
#   0 if clean, 1 if clutter found
#######################################
check_davinci_clutter() {
    local scratch_dirs=(
        "$HOME/Videos/ScratchDrive"
        "$HOME/Videos"
        "/mnt/nvme-raid0/videos"
    )

    local found_clutter=false

    for dir in "${scratch_dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            continue
        fi

        # Check for .blackmagicsync folders
        local sync_folders
        sync_folders=$(find "$dir" -maxdepth 2 -type d -name ".blackmagicsync*" 2>/dev/null | wc -l)
        if [[ "$sync_folders" -gt 0 ]]; then
            print_warn "Found ${sync_folders} Blackmagic sync folder(s) in ${dir}"
            print_info "Remove with: find \"${dir}\" -type d -name '.blackmagicsync*' -exec rm -rf {} +"
            found_clutter=true
        fi

        # Check for nested Proxy folders
        local proxy_folders
        proxy_folders=$(find "$dir" -maxdepth 4 -type d -name "Proxy" 2>/dev/null | wc -l)
        if [[ "$proxy_folders" -gt 0 ]]; then
            print_warn "Found ${proxy_folders} Proxy folder(s) in ${dir}"
            print_info "These may contain duplicate files"
            print_info "Disable in DaVinci: Playback → Proxy Mode → Off"
            found_clutter=true
        fi
    done

    if [[ "$found_clutter" == false ]]; then
        print_pass "No proxy/sync clutter found"
        return 0
    fi
    return 1
}

#######################################
# Check if OBS Studio is installed
# Returns:
#   0 if installed, 1 otherwise
#######################################
check_obs_installed() {
    if command_exists obs; then
        print_pass "OBS Studio is installed"
        local version
        version=$(obs --version 2>/dev/null | head -1 || echo "unknown")
        print_info "Version: ${version}"
        return 0
    else
        print_fail "OBS Studio is not installed"
        print_info "Install: sudo apt install obs-studio"
        return 1
    fi
}

#######################################
# Check OBS configuration for DaVinci compatibility
# Returns:
#   0 if compatible, 1 otherwise
#######################################
check_obs_config() {
    local config_dir="$HOME/.config/obs-studio"
    local profile_dir="${config_dir}/basic/profiles"

    if [[ ! -d "$config_dir" ]]; then
        print_warn "OBS config directory not found"
        print_info "Run OBS once to create config"
        return 1
    fi

    # Find active profile's recordEncoder setting
    local found_pcm=false
    local found_aac=false

    while IFS= read -r -d '' config_file; do
        if grep -q "RecFormat=mov" "$config_file" 2>/dev/null; then
            if grep -q "RecAEncoder=pcm" "$config_file" 2>/dev/null || \
               grep -q "Acodec=pcm" "$config_file" 2>/dev/null; then
                found_pcm=true
            elif grep -q "RecAEncoder=aac" "$config_file" 2>/dev/null || \
                 grep -q "Acodec=aac" "$config_file" 2>/dev/null; then
                found_aac=true
            fi
        fi
    done < <(find "$profile_dir" -name "*.ini" -print0 2>/dev/null)

    if [[ "$found_pcm" == true ]]; then
        print_pass "OBS configured with PCM audio (DaVinci compatible)"
        return 0
    elif [[ "$found_aac" == true ]]; then
        print_fail "OBS configured with AAC audio (NOT DaVinci compatible)"
        print_info "Change to: Settings → Output → Advanced → Audio Encoder → FFmpeg PCM (24-bit)"
        return 1
    else
        print_warn "Could not detect OBS audio encoder setting"
        print_info "Ensure OBS uses: Output Mode=Advanced, Audio Encoder=FFmpeg PCM (24-bit)"
        return 1
    fi
}

#######################################
# Check FFmpeg installation
# Returns:
#   0 if installed, 1 otherwise
#######################################
check_ffmpeg() {
    if command_exists ffmpeg && command_exists ffprobe; then
        print_pass "FFmpeg is installed"
        local version
        version=$(ffmpeg -version 2>/dev/null | head -1 | awk '{print $3}')
        print_info "Version: ${version}"
        return 0
    else
        print_fail "FFmpeg is not installed"
        print_info "Install: sudo apt install ffmpeg"
        return 1
    fi
}

#######################################
# Check system audio configuration
# Returns:
#   0 if OK, 1 otherwise
#######################################
check_audio_system() {
    # Check PipeWire/PulseAudio
    if command_exists pactl; then
        local default_sink
        default_sink=$(pactl info 2>/dev/null | grep "Default Sink" | awk '{print $3}')

        if [[ -n "$default_sink" ]]; then
            print_pass "Audio system configured"
            print_info "Default output: ${default_sink}"

            # Check sample rate
            local sample_rate
            sample_rate=$(pactl list sinks 2>/dev/null | grep -A5 "$default_sink" | grep "Sample Specification" | grep -oP '\d+(?=Hz)' | head -1)
            if [[ "$sample_rate" == "48000" ]]; then
                print_pass "Sample rate is 48000 Hz (optimal for video)"
            elif [[ -n "$sample_rate" ]]; then
                print_warn "Sample rate is ${sample_rate} Hz (48000 Hz recommended for video)"
            fi
            return 0
        else
            print_fail "No default audio output configured"
            return 1
        fi
    else
        print_warn "pactl not found - cannot check audio system"
        return 1
    fi
}

#######################################
# Check NVIDIA GPU for hardware encoding
# Returns:
#   0 if available, 1 otherwise
#######################################
check_nvidia() {
    if command_exists nvidia-smi; then
        local gpu_name
        gpu_name=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1)

        if [[ -n "$gpu_name" ]]; then
            print_pass "NVIDIA GPU detected: ${gpu_name}"

            # Check NVENC support
            if nvidia-smi -q 2>/dev/null | grep -q "Encoder"; then
                print_pass "NVENC hardware encoding available"
            fi
            return 0
        fi
    fi

    print_warn "NVIDIA GPU not detected"
    print_info "Hardware encoding will use CPU (slower)"
    return 1
}

#######################################
# Check if a video file has DaVinci-compatible audio
# Arguments:
#   $1 - File path
# Returns:
#   0 if compatible, 1 otherwise
#######################################
check_file_compatibility() {
    local file="$1"

    if [[ ! -f "$file" ]]; then
        print_fail "File not found: ${file}"
        return 1
    fi

    if ! command_exists ffprobe; then
        print_fail "ffprobe not installed"
        return 1
    fi

    print_header "File Analysis: $(basename "$file")"

    # Get file info
    local audio_codec video_codec sample_rate channels duration
    audio_codec=$(ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 "$file" 2>/dev/null || echo "none")
    video_codec=$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 "$file" 2>/dev/null || echo "none")
    sample_rate=$(ffprobe -v error -select_streams a:0 -show_entries stream=sample_rate -of default=noprint_wrappers=1:nokey=1 "$file" 2>/dev/null || echo "0")
    channels=$(ffprobe -v error -select_streams a:0 -show_entries stream=channels -of default=noprint_wrappers=1:nokey=1 "$file" 2>/dev/null || echo "0")
    duration=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$file" 2>/dev/null || echo "0")

    echo "  Video Codec:  ${video_codec}"
    echo "  Audio Codec:  ${audio_codec}"
    echo "  Sample Rate:  ${sample_rate} Hz"
    echo "  Channels:     ${channels}"
    echo "  Duration:     ${duration%.*}s"
    echo ""

    # Check audio compatibility
    local compatible_codecs=("pcm_s16le" "pcm_s24le" "pcm_s32le" "pcm_f32le" "flac" "alac")
    local is_compatible=false

    for codec in "${compatible_codecs[@]}"; do
        if [[ "$audio_codec" == "$codec" ]]; then
            is_compatible=true
            break
        fi
    done

    if [[ "$is_compatible" == true ]]; then
        print_pass "Audio codec '${audio_codec}' is DaVinci-compatible"
        return 0
    elif [[ "$audio_codec" == "aac" ]]; then
        print_fail "Audio codec 'aac' is NOT compatible with DaVinci on Linux"
        print_info "DaVinci will show: 'Failed to decode the audio samples'"
        print_info "Fix: ffmpeg -i \"${file}\" -c:v copy -c:a pcm_s24le \"${file%.mp4}-pcm.mov\""
        return 1
    elif [[ "$audio_codec" == "none" ]]; then
        print_warn "No audio stream found in file"
        return 1
    else
        print_warn "Audio codec '${audio_codec}' - compatibility unknown"
        print_info "Test in DaVinci or convert to PCM to be safe"
        return 1
    fi
}

#######################################
# Convert a file to DaVinci-compatible format
# Arguments:
#   $1 - Input file path
#   $2 - Mono flag (optional, "mono" for mono output)
# Returns:
#   0 if successful, 1 otherwise
#######################################
convert_file() {
    local input="$1"
    local mono="${2:-}"

    if [[ ! -f "$input" ]]; then
        print_fail "File not found: ${input}"
        return 1
    fi

    if ! command_exists ffmpeg; then
        print_fail "ffmpeg not installed"
        return 1
    fi

    local output
    if [[ "$mono" == "mono" ]]; then
        output="${input%.*}-mono.mov"
    else
        output="${input%.*}-pcm.mov"
    fi

    print_header "Converting to DaVinci Format"
    echo "  Input:  ${input}"
    echo "  Output: ${output}"
    echo ""

    local ffmpeg_args=("-i" "$input" "-c:v" "copy")

    if [[ "$mono" == "mono" ]]; then
        ffmpeg_args+=("-ac" "1")
    fi

    ffmpeg_args+=("-c:a" "pcm_s24le" "$output" "-y")

    if ffmpeg "${ffmpeg_args[@]}" 2>/dev/null; then
        print_pass "Conversion successful"
        print_info "Output: ${output}"
        return 0
    else
        print_fail "Conversion failed"
        return 1
    fi
}

#######################################
# Run all DaVinci diagnostics
#######################################
run_davinci_diagnostics() {
    print_header "DaVinci Resolve Diagnostics"

    check_davinci_installed || true
    check_davinci_running || true
    check_davinci_logs || true
    check_davinci_cloud || true
    check_davinci_clutter || true
}

#######################################
# Run all OBS diagnostics
#######################################
run_obs_diagnostics() {
    print_header "OBS Studio Diagnostics"

    check_obs_installed || true
    check_obs_config || true
}

#######################################
# Run all system diagnostics
#######################################
run_system_diagnostics() {
    print_header "System Diagnostics"

    check_ffmpeg || true
    check_audio_system || true
    check_nvidia || true
}

#######################################
# Print summary of results
#######################################
print_summary() {
    print_header "Diagnostic Summary"

    echo -e "  ${GREEN}Passed${NC}: ${TESTS_PASSED}"
    echo -e "  ${RED}Failed${NC}: ${TESTS_FAILED}"
    echo -e "  ${YELLOW}Warnings${NC}: ${TESTS_WARNED}"
    echo ""

    if [[ $TESTS_FAILED -gt 0 ]]; then
        echo -e "${RED}${BOLD}Action Required:${NC} Fix the failed checks above"
        echo ""
        echo "Common fixes:"
        echo "  1. Convert AAC to PCM: make audio-davinci-convert FILE=video.mp4"
        echo "  2. Configure OBS: Settings → Output → Advanced → Audio Encoder → PCM"
        echo "  3. Disable cloud sync: DaVinci Project Settings → Blackmagic Cloud"
        return $EXIT_ERROR
    elif [[ $TESTS_WARNED -gt 0 ]]; then
        echo -e "${YELLOW}${BOLD}Review warnings above${NC}"
        return $EXIT_WARNING
    else
        echo -e "${GREEN}${BOLD}All checks passed!${NC}"
        return $EXIT_SUCCESS
    fi
}

#######################################
# Print usage information
#######################################
print_usage() {
    cat << 'EOF'
diagnose-davinci-obs.sh - Diagnostics for DaVinci Resolve + OBS Studio

Usage:
  diagnose-davinci-obs.sh [command] [options]

Commands:
  all              Run all diagnostics (default)
  davinci          DaVinci Resolve diagnostics only
  obs              OBS Studio diagnostics only
  system           System diagnostics only
  file FILE        Check if a video file is DaVinci-compatible
  fix FILE         Convert file to DaVinci-compatible format (PCM audio)
  fix-mono FILE    Convert file to mono PCM for DaVinci
  summary          Show quick summary of system status
  help             Show this help message

Examples:
  # Run all diagnostics
  diagnose-davinci-obs.sh

  # Check a specific file
  diagnose-davinci-obs.sh file recording.mp4

  # Convert a file to DaVinci format
  diagnose-davinci-obs.sh fix recording.mp4

  # Convert to mono
  diagnose-davinci-obs.sh fix-mono recording.mp4

Key Information:
  - DaVinci Resolve on Linux CANNOT decode AAC audio
  - Use PCM audio (pcm_s24le) for DaVinci compatibility
  - OBS must use Advanced output mode for PCM encoding
  - Recommended: H.264 video, PCM audio, MOV container
EOF
}

#######################################
# Main function
# Arguments:
#   $@ - Command line arguments
#######################################
main() {
    local command="${1:-all}"

    case "$command" in
        all)
            run_davinci_diagnostics
            run_obs_diagnostics
            run_system_diagnostics
            print_summary
            ;;
        davinci)
            run_davinci_diagnostics
            print_summary
            ;;
        obs)
            run_obs_diagnostics
            print_summary
            ;;
        system)
            run_system_diagnostics
            print_summary
            ;;
        file)
            if [[ -z "${2:-}" ]]; then
                echo "Error: FILE argument required"
                echo "Usage: diagnose-davinci-obs.sh file <path>"
                exit $EXIT_ERROR
            fi
            check_file_compatibility "$2"
            ;;
        fix)
            if [[ -z "${2:-}" ]]; then
                echo "Error: FILE argument required"
                echo "Usage: diagnose-davinci-obs.sh fix <path>"
                exit $EXIT_ERROR
            fi
            convert_file "$2"
            ;;
        fix-mono)
            if [[ -z "${2:-}" ]]; then
                echo "Error: FILE argument required"
                echo "Usage: diagnose-davinci-obs.sh fix-mono <path>"
                exit $EXIT_ERROR
            fi
            convert_file "$2" "mono"
            ;;
        summary)
            # Quick check without full output
            local issues=0
            [[ -d "/opt/resolve" ]] || ((issues++))
            command_exists obs || ((issues++))
            command_exists ffmpeg || ((issues++))

            if [[ $issues -eq 0 ]]; then
                echo -e "${GREEN}✓ System ready for DaVinci + OBS workflow${NC}"
            else
                echo -e "${YELLOW}⚠ ${issues} issue(s) detected - run full diagnostics${NC}"
            fi
            ;;
        help|--help|-h)
            print_usage
            ;;
        *)
            echo "Unknown command: ${command}"
            print_usage
            exit $EXIT_ERROR
            ;;
    esac
}

# Run main if not being sourced
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
