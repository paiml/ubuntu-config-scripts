# RUC-004: Microphone CLI Interface

**Date**: 2025-10-30
**Status**: ⚠️ **UNBLOCKED** - Module system working (v3.150.0) with workaround
**Priority**: HIGH (complete the audio module)
**Methodology**: Extreme TDD (RED → GREEN → REFACTOR) + Module pattern
**Depends On**: RUC-003 ✅, Ruchy v3.150.0 ✅
**Estimated Time**: 60-75 minutes (with workaround for Issue #89)
**Blocker Resolution**: Issue #88 FIXED, using modules with fully qualified paths
**See Also**: `RUCHY-V3.150.0-MODULE-SYSTEM.md`, Issue #89

---

## Objective

Create a command-line interface for the microphone configuration module (RUC-003). Provide user-friendly commands for device detection, configuration, volume control, and mute management.

**Goal**: Make RUC-003 functionality accessible via CLI for end users.

---

## Context

### Completed Work
- ✅ RUC-001: Audio speaker configuration library (335 LOC)
- ✅ RUC-002: Audio speaker CLI (465 LOC)
- ✅ RUC-003: Microphone configuration library (450 LOC)

### Why CLI Next
1. **Complete the Audio Module**: Library + CLI = full microphone support
2. **User Value**: Provide immediate utility for microphone management
3. **Pattern Reuse**: Copy RUC-002 structure, swap sink→source commands
4. **Consistency**: Match speaker CLI interface for unified experience

### Reference Implementation
- RUC-002: `ruchy/bin/ubuntu-audio.ruchy` (465 LOC)
- Pattern established, proven working
- Should be ~90% copy-paste with command changes

---

## Requirements

### Functional Requirements

1. **List Microphones Command**
   ```bash
   ubuntu-mic list
   # Output: Shows all microphones with current default marked
   ```

2. **Get Current Configuration**
   ```bash
   ubuntu-mic current
   # Output: Shows current microphone, volume, mute status
   ```

3. **Configure Microphone**
   ```bash
   ubuntu-mic set <device-id-or-name>
   # Output: Confirms configuration or shows error
   ```

4. **Set Volume**
   ```bash
   ubuntu-mic volume <device> <0-100>
   # Output: Confirms volume change or shows error
   ```

5. **Mute/Unmute**
   ```bash
   ubuntu-mic mute <device>
   ubuntu-mic unmute <device>
   # Output: Confirms mute state change
   ```

6. **Validate Device**
   ```bash
   ubuntu-mic validate <device-id>
   # Output: true/false with explanation
   ```

7. **Help Command**
   ```bash
   ubuntu-mic --help
   # Output: Shows usage information
   ```

### Non-Functional Requirements

1. **Performance**: Sub-second response time
2. **Error Messages**: Clear, actionable error messages
3. **Exit Codes**: 0=success, 1=error
4. **Output Format**: Human-readable by default
5. **Security**: Validate all user inputs

---

## Implementation Strategy

### Approach: Copy RUC-002, Replace Commands

**Why**: RUC-002 CLI already works perfectly. We just need to:
1. Copy the file structure
2. Replace "sink" with "source" in pactl commands
3. Replace "speaker" with "microphone" in messages
4. Add volume/mute commands (new features)

**Time Savings**: ~70% faster implementation

### Files to Create

```
ruchy/
└── bin/
    └── ubuntu-mic.ruchy       # New CLI (copy of ubuntu-audio.ruchy)
```

### Implementation Plan

**RED Phase** (15 min):
1. Copy RUC-002 test structure
2. Define expected CLI behavior
3. Create stub implementations
4. Verify tests fail

**GREEN Phase** (30 min):
1. Copy RUC-003 library code into CLI file (inline approach)
2. Implement command handlers:
   - `cmd_list()` → call `detect_microphone_devices()`
   - `cmd_current()` → call `get_current_mic_config()`
   - `cmd_set()` → call `configure_microphone()`
   - `cmd_volume()` → call `set_mic_volume()` **NEW**
   - `cmd_mute()` → call `set_mic_mute(true)` **NEW**
   - `cmd_unmute()` → call `set_mic_mute(false)` **NEW**
   - `cmd_validate()` → call `validate_mic_device_id()`
   - `cmd_help()` → show usage
3. Format output for users
4. Handle errors gracefully
5. Run tests → all PASS

**REFACTOR Phase** (15 min):
1. Polish output formatting
2. Improve error messages
3. Add examples to help text

---

## Commands

### 1. list
```bash
$ ubuntu-mic list
Available Microphones:

  [2] alsa_input.pci-0000_05_00.7.analog-stereo
  Description: HD-Audio Generic Analog Stereo

* [4] alsa_input.usb-Focusrite_Scarlett_4i4_USB_D8C8H5G0C89E96-00.multichannel-input
  Description: Scarlett 4i4 USB Multichannel
  (Current default)
```

### 2. current
```bash
$ ubuntu-mic current
Current Microphone Configuration:

  Device: alsa_input.usb-Focusrite_Scarlett_4i4_USB_D8C8H5G0C89E96-00.multichannel-input
  Volume: 100%
  Muted: no
```

### 3. set
```bash
$ ubuntu-mic set alsa_input.pci-0000_05_00.7.analog-stereo
Configuring microphone: alsa_input.pci-0000_05_00.7.analog-stereo
✓ Successfully configured microphone
  Device: alsa_input.pci-0000_05_00.7.analog-stereo
```

### 4. volume (NEW)
```bash
$ ubuntu-mic volume alsa_input.usb-Focusrite_Scarlett_4i4_USB-00 75
Setting volume to 75%...
✓ Volume set successfully
  Device: alsa_input.usb-Focusrite_Scarlett_4i4_USB-00
  Volume: 75%
```

### 5. mute/unmute (NEW)
```bash
$ ubuntu-mic mute alsa_input.usb-Focusrite_Scarlett_4i4_USB-00
Muting microphone...
✓ Microphone muted

$ ubuntu-mic unmute alsa_input.usb-Focusrite_Scarlett_4i4_USB-00
Unmuting microphone...
✓ Microphone unmuted
```

### 6. validate
```bash
$ ubuntu-mic validate test-device
Validating device ID: 'test-device'
✓ Valid device ID format

$ ubuntu-mic validate ../bad
Validating device ID: '../bad'
✗ Invalid device ID format

Device IDs must:
  - Not be empty
  - Not contain null bytes
  - Not contain path traversal (../)
  - Not contain spaces
```

### 7. help
```bash
$ ubuntu-mic --help
Ubuntu Microphone Configuration Tool

USAGE:
  ubuntu-mic <command> [arguments]

COMMANDS:
  list                    List all microphones
  current                 Show current microphone configuration
  set <device>            Set default microphone (by ID or name)
  volume <device> <0-100> Set microphone volume
  mute <device>           Mute microphone
  unmute <device>         Unmute microphone
  validate <id>           Validate device ID format
  help, --help            Show this help message

EXAMPLES:
  ubuntu-mic list
  ubuntu-mic current
  ubuntu-mic set alsa_input.usb-Focusrite_Scarlett_4i4_USB-00
  ubuntu-mic volume alsa_input.usb-Focusrite_Scarlett_4i4_USB-00 75
  ubuntu-mic mute alsa_input.usb-Focusrite_Scarlett_4i4_USB-00
  ubuntu-mic validate test-device
```

---

## Technical Design

### Inline Library Approach

Following RUC-002 pattern, inline all library code:

```ruchy
// RUC-004: Ubuntu Microphone CLI Tool
//
// Command-line interface for microphone configuration
// Uses RUC-003 library functions (inlined)

use std::process::Command;

// Data structures (from RUC-003)
struct MicDevice { ... }
struct MicConfig { ... }
enum ConfigError { ... }

// Library functions (from RUC-003)
fun detect_microphone_devices() -> Result<Vec<MicDevice>, ConfigError> { ... }
fun get_current_mic_config() -> Result<MicConfig, ConfigError> { ... }
fun configure_microphone(device_id: String) -> Result<(), ConfigError> { ... }
fun set_mic_volume(device_id: String, volume: i32) -> Result<(), ConfigError> { ... }
fun set_mic_mute(device_id: String, muted: bool) -> Result<(), ConfigError> { ... }
fun validate_mic_device_id(device_id: String) -> bool { ... }

// CLI Command Handlers
fun cmd_list() -> Result<(), ConfigError> { ... }
fun cmd_current() -> Result<(), ConfigError> { ... }
fun cmd_set(device_id: String) -> Result<(), ConfigError> { ... }
fun cmd_volume(device_id: String, volume: i32) -> Result<(), ConfigError> { ... }
fun cmd_mute(device_id: String) -> Result<(), ConfigError> { ... }
fun cmd_unmute(device_id: String) -> Result<(), ConfigError> { ... }
fun cmd_validate(device_id: String) { ... }
fun cmd_help() { ... }

fun main() {
    // Demo mode (like RUC-002)
    println!("Ubuntu Microphone CLI - Demo Mode");
    // Run all commands to demonstrate functionality
}
```

---

## Success Criteria

### Must Have ✅
- [ ] All 7 commands implemented (list, current, set, volume, mute, unmute, validate, help)
- [ ] Library functions integrated (450 LOC from RUC-003)
- [ ] Error handling complete
- [ ] Help text comprehensive
- [ ] Demo mode working

### Should Have 📋
- [ ] Clear output formatting
- [ ] Progress indicators
- [ ] Confirmation messages
- [ ] Error recovery suggestions

### Nice to Have 🎁
- [ ] Colored output
- [ ] JSON output mode
- [ ] Dry-run mode
- [ ] Tab completion

---

## Timeline

### Estimated Duration: 45-60 minutes

**RED Phase**: 15 minutes
- Copy RUC-002 test structure
- Adapt for microphone commands
- Add volume/mute test cases
- Verify tests fail

**GREEN Phase**: 30 minutes
- Copy RUC-003 library (450 LOC)
- Implement 7 command handlers (~100 LOC)
- Demo mode runner (~40 LOC)
- Total: ~590 LOC
- Make all tests pass

**REFACTOR Phase**: 15 minutes
- Polish output formatting
- Improve error messages
- Add usage examples

---

## Differences from RUC-002

### New Commands
- **volume**: Set microphone volume (not in RUC-002)
- **mute**: Mute microphone (not in RUC-002)
- **unmute**: Unmute microphone (not in RUC-002)

### Command Changes
- "speakers" → "microphones"
- "sink" → "source"
- "audio device" → "microphone"

### Expected Size
- RUC-002: 465 LOC (5 commands)
- RUC-004: ~590 LOC (7 commands + 3 new features)
- **125 LOC larger** due to volume/mute commands

---

## Testing Strategy

### Demo Mode Testing

Like RUC-002, run all commands in sequence:

```ruchy
fun main() {
    println!("=== COMMAND: list ===");
    cmd_list();

    println!("=== COMMAND: current ===");
    cmd_current();

    println!("=== COMMAND: validate test-device ===");
    cmd_validate("test-device".to_string());

    println!("=== COMMAND: help ===");
    cmd_help();
}
```

### Manual Testing
```bash
# Test each command
ruchydbg run ruchy/bin/ubuntu-mic.ruchy
```

---

## Risk Assessment

### Low Risk ✅
- **Pattern Proven**: RUC-002 works perfectly
- **Library Tested**: RUC-003 already verified
- **No New Patterns**: Just combining existing code

### Medium Risk ⚠️
- **Volume Command**: May have device name vs ID issues (saw in RUC-003 tests)
- **Mute Command**: Need to ensure state tracking works

### Mitigation
- Test volume/mute commands carefully
- Provide clear error messages if commands fail
- Document any quirks discovered

---

## Next Steps After RUC-004

1. **RUC-005**: Combined audio CLI (speakers + microphones in one tool)
2. **RUC-006**: Audio diagnostics and troubleshooting
3. **RUC-007**: Package as .deb for distribution

---

## Resources

### Reference Implementations
- `ruchy/bin/ubuntu-audio.ruchy` - Speaker CLI (RUC-002) ✅
- `ruchy/lib/microphone.ruchy` - Microphone library (RUC-003) ✅

### Documentation
- RUC-002-CLI-INTERFACE-COMPLETE.md
- RUC-003-MICROPHONE-GREEN-PHASE-COMPLETE.md

---

## Notes

- **Fast Track**: This should be the fastest RUC ticket yet
- **Pattern Reuse**: 90% of code already written
- **New Features**: Volume/mute commands are straightforward additions
- **Quality**: Maintain zero-defect standard

---

**Ready to Start**: RUC-003 provides solid foundation, RUC-002 provides CLI pattern!

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
