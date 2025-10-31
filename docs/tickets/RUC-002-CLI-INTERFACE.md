# RUC-002: Audio Speaker CLI Interface

**Date**: 2025-10-30
**Status**: ✅ **GREEN PHASE COMPLETE** - All commands working
**Priority**: HIGH (complete the audio module)
**Methodology**: Extreme TDD (RED → GREEN → REFACTOR)
**Depends On**: RUC-001 ✅ Complete
**Estimated Time**: 45-60 minutes (Actual: ~90 minutes)
**Completion Doc**: `docs/RUC-002-CLI-INTERFACE-COMPLETE.md`

---

## Objective

Create a command-line interface for the audio speaker configuration module (RUC-001). Provide user-friendly commands for device detection, configuration, and status queries.

**Goal**: Make RUC-001 functionality accessible via CLI for end users.

---

## Context

### Completed Work
- ✅ RUC-001: Core library functions implemented (335 LOC)
- ✅ All functions tested and working
- ✅ Command execution verified (v3.149.0)

### Why CLI Next
1. **Complete the Feature**: Library alone isn't user-facing
2. **Validate Integration**: Ensure library works in real usage
3. **User Value**: Provide immediate utility
4. **Pattern Establishment**: Set CLI patterns for future modules

---

## Requirements

### Functional Requirements

1. **List Devices Command**
   ```bash
   ubuntu-audio list
   # Output: Shows all audio devices with current default
   ```

2. **Get Current Configuration**
   ```bash
   ubuntu-audio current
   # Output: Shows current speaker, volume, mute status
   ```

3. **Configure Speaker**
   ```bash
   ubuntu-audio set <device-id-or-name>
   # Output: Confirms configuration or shows error
   ```

4. **Validate Device**
   ```bash
   ubuntu-audio validate <device-id>
   # Output: true/false with explanation
   ```

5. **Help Command**
   ```bash
   ubuntu-audio --help
   # Output: Shows usage information
   ```

### Non-Functional Requirements

1. **Performance**: Sub-second response time
2. **Error Messages**: Clear, actionable error messages
3. **Exit Codes**: 0=success, 1=error, 2=invalid args
4. **Output Format**: Human-readable by default
5. **Security**: Validate all user inputs

---

## Test Strategy (RED Phase)

### Property Tests to Create

Port testing approach from RUC-001:

1. **Command Parsing**: Args parsed correctly
2. **Error Handling**: Invalid commands show help
3. **Output Format**: Consistent formatting
4. **Exit Codes**: Correct codes returned
5. **Integration**: Library functions called correctly

### Manual Testing

```bash
# Test each command
ruchydbg run ruchy/bin/ubuntu-audio.ruchy -- list
ruchydbg run ruchy/bin/ubuntu-audio.ruchy -- current
ruchydbg run ruchy/bin/ubuntu-audio.ruchy -- set pebble
ruchydbg run ruchy/bin/ubuntu-audio.ruchy -- --help
```

---

## Implementation Plan

### Phase 1: RED (Write Tests First) - 15 min

1. Create test file: `ruchy/tests/test_cli_audio.ruchy`
2. Define expected behavior for each command
3. Test argument parsing
4. Test error cases
5. Verify tests FAIL (no implementation yet)

### Phase 2: GREEN (Make Tests Pass) - 30 min

1. Create main file: `ruchy/bin/ubuntu-audio.ruchy`
2. Implement argument parsing
3. Import library functions from RUC-001
4. Implement each command handler:
   - `list` → call `detect_audio_devices()`
   - `current` → call `get_current_speaker_config()`
   - `set <device>` → call `configure_speaker()`
   - `validate <id>` → call `validate_device_id()`
   - `--help` → show usage
5. Format output for humans
6. Handle errors gracefully
7. Run tests → all PASS

### Phase 3: REFACTOR (Polish) - 15 min

1. Improve error messages
2. Add color output (if available)
3. Improve help text
4. Add examples to help

---

## Success Criteria

### Must Have ✅
- [x] All 5 commands implemented (list, current, set, validate, help)
- [x] Library functions integrated (335 LOC inlined)
- [x] Error handling complete (all Results handled properly)
- [x] Help text comprehensive (with examples)
- [x] Tests pass (6/6 functionality tests passing)

### Should Have 📋
- [ ] Colored output for readability
- [ ] Progress indicators for operations
- [ ] Confirmation prompts for destructive ops
- [ ] Verbose mode (--verbose)

### Nice to Have 🎁
- [ ] JSON output mode (--json)
- [ ] Dry-run mode (--dry-run)
- [ ] Tab completion support
- [ ] Man page documentation

---

## Technical Design

### File Structure

```
ruchy/
├── bin/
│   └── ubuntu-audio.ruchy          # Main CLI entry point
├── lib/
│   └── audio_speakers.ruchy        # Library (RUC-001) ✅
└── tests/
    └── test_cli_audio.ruchy        # CLI tests
```

### Main Function Structure

```ruchy
use std::process::Command;

// Import library functions
// (Will need to figure out Ruchy's module system)

enum CliCommand {
    List,
    Current,
    Set(String),
    Validate(String),
    Help,
}

fun parse_args(args: Vec<String>) -> Result<CliCommand, String> {
    // Parse command-line arguments
}

fun run_command(cmd: CliCommand) -> Result<(), String> {
    match cmd {
        CliCommand::List => cmd_list(),
        CliCommand::Current => cmd_current(),
        CliCommand::Set(device) => cmd_set(device),
        CliCommand::Validate(id) => cmd_validate(id),
        CliCommand::Help => cmd_help(),
    }
}

fun main() {
    // Get args, parse, run, exit with appropriate code
}
```

### Command Handlers

```ruchy
fun cmd_list() -> Result<(), String> {
    let devices = match detect_audio_devices() {
        Ok(d) => d,
        Err(e) => return Err(format!("Failed to detect devices: {:?}", e)),
    };

    println!("Available Audio Devices:");
    let mut i = 0;
    while i < devices.len() {
        let d = &devices[i];
        let marker = if d.is_default { "* " } else { "  " };
        println!("{}[{}] {} - {}", marker, d.id, d.name, d.description);
        i = i + 1;
    }

    Ok(())
}
```

---

## Example Output

### List Command
```
$ ubuntu-audio list
Available Audio Devices:
  [1] alsa_output.pci-0000_00_1f.3.analog-stereo - Built-in Audio
* [2] alsa_output.usb-ACTIONS_Pebble_V3-00.analog-stereo - Pebble V3
  [3] alsa_output.pci-0000_01_00.1.hdmi-stereo - NVIDIA HDMI
```

### Current Command
```
$ ubuntu-audio current
Current Speaker Configuration:
  Device: alsa_output.usb-ACTIONS_Pebble_V3-00.analog-stereo
  Volume: 85%
  Muted: no
```

### Set Command
```
$ ubuntu-audio set pebble
✓ Successfully configured speaker: Pebble V3
  Device: alsa_output.usb-ACTIONS_Pebble_V3-00.analog-stereo
```

### Error Example
```
$ ubuntu-audio set invalid-device
✗ Error: Device not found: invalid-device

Available devices:
  - alsa_output.pci-0000_00_1f.3.analog-stereo
  - alsa_output.usb-ACTIONS_Pebble_V3-00.analog-stereo
  - alsa_output.pci-0000_01_00.1.hdmi-stereo

Run 'ubuntu-audio list' to see all devices
```

---

## Challenges to Anticipate

### Challenge 1: Module System

**Issue**: Ruchy may not have a clear way to import library functions.

**Solutions**:
- Option A: Include library code inline in CLI file
- Option B: Use load/include mechanism if available
- Option C: Compile library separately and link

### Challenge 2: Argument Parsing

**Issue**: Need to parse command-line arguments.

**Solutions**:
- Manual parsing (iterate through args)
- Check for arg parsing libraries in Ruchy
- Use environment inspection if available

### Challenge 3: Exit Codes

**Issue**: Need to return proper exit codes.

**Solutions**:
- Check if Ruchy has `std::process::exit()`
- Return from main with exit code
- Use appropriate Result types

---

## Dependencies

### Required
- ✅ Ruchy v3.149.0+
- ✅ RUC-001 library (audio_speakers.ruchy)
- ✅ pactl (for audio operations)

### Optional
- Colored output library (if available)
- Argument parsing library (if available)

---

## Testing Plan

### Unit Tests
- Argument parsing logic
- Command routing
- Error message formatting

### Integration Tests
- Full command execution
- Library function integration
- Error handling end-to-end

### Manual Tests
- Run each command variant
- Test edge cases
- Verify error messages
- Check exit codes

---

## Timeline

### Estimated Duration: 45-60 minutes

**RED Phase**: 15 minutes
- Write CLI tests
- Define expected behavior
- Verify tests fail

**GREEN Phase**: 30 minutes
- Implement CLI
- Import library functions
- Make tests pass

**REFACTOR Phase**: 15 minutes
- Polish output
- Improve errors
- Add examples

---

## Success Metrics

### Code Quality
- Clean argument parsing
- Clear error messages
- Proper exit codes
- Good help text

### User Experience
- Sub-second response time
- Intuitive commands
- Helpful error messages
- Easy to understand output

### Technical
- Library integration working
- No code duplication
- Maintainable structure
- Well-tested

---

## Next Steps After RUC-002

1. **RUC-003**: Package as binary (make install)
2. **RUC-004**: Port another module (logger, diagnostics)
3. **RUC-005**: Add more CLI features (JSON output, etc.)

---

## Resources

### Reference Implementations
- `scripts/audio/configure-speakers.ts` - TypeScript version
- `ruchy/src/audio_speakers.rs` - Rust library
- `ruchy/lib/audio_speakers.ruchy` - Ruchy library ✅

### Documentation
- RUC-001-RUCHY-GREEN-PHASE-COMPLETE.md
- Ruchy language docs
- pactl documentation

---

## Notes

- Keep it simple - don't over-engineer
- Focus on user experience
- Validate inputs thoroughly
- Provide clear error messages
- Make help text comprehensive

---

**Ready to Start**: RUC-001 provides solid foundation!

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
