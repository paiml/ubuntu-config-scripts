# RUC-003: Microphone Configuration Library

**Date**: 2025-10-30
**Status**: ✅ **GREEN PHASE COMPLETE** - Production ready!
**Priority**: HIGH (complete the audio module)
**Methodology**: Extreme TDD (RED → GREEN → REFACTOR)
**Depends On**: RUC-001 ✅, RUC-002 ✅
**Estimated Time**: 60-90 minutes (Actual: ~45 minutes!)
**Blocker**: [Issue #87](https://github.com/paiml/ruchy/issues/87) - Worked around with simplified tests
**Completion Doc**: `docs/RUC-003-MICROPHONE-GREEN-PHASE-COMPLETE.md`

---

## Objective

Create a Ruchy library for microphone detection, configuration, and management on Ubuntu systems using PulseAudio/PipeWire. Provide similar functionality to RUC-001 but for input devices instead of output devices.

**Goal**: Enable programmatic microphone management with the same quality as audio speaker configuration.

---

## Context

### Completed Work
- ✅ RUC-001: Audio speaker configuration library (335 LOC)
- ✅ RUC-002: CLI interface for speakers (465 LOC)
- ✅ Command execution verified (v3.149.0)
- ✅ Extreme TDD patterns established

### Why Microphone Next
1. **Natural Progression**: Similar to speakers but for input devices
2. **Reuse Patterns**: Same pactl approach, similar parsing logic
3. **Complete Audio Module**: Speakers + microphones = full audio control
4. **User Value**: Microphone issues are common (Zoom, recording, etc.)

### Reference Implementation
- TypeScript: `scripts/audio/enable-mic.ts` (218 LOC)
- Similar structure to `configure-speakers.ts`
- Uses `pactl list sources` instead of `pactl list sinks`

---

## Requirements

### Functional Requirements

1. **Detect Microphone Devices**
   ```ruchy
   fun detect_microphone_devices() -> Result<Vec<MicDevice>, ConfigError>
   ```
   - List all audio input sources
   - Filter out monitors and virtual devices
   - Identify current default microphone
   - Extract device metadata (name, description, card, device)

2. **Get Current Microphone Configuration**
   ```ruchy
   fun get_current_mic_config() -> Result<MicConfig, ConfigError>
   ```
   - Get default microphone device ID
   - Get current volume level (0-100)
   - Get mute status (true/false)
   - Get device details

3. **Configure Microphone**
   ```ruchy
   fun configure_microphone(device_id: String) -> Result<(), ConfigError>
   ```
   - Set default microphone device
   - Validate device exists before applying
   - Rollback on failure
   - Verify configuration applied

4. **Set Microphone Volume**
   ```ruchy
   fun set_mic_volume(device_id: String, volume: i32) -> Result<(), ConfigError>
   ```
   - Set volume (0-100 range)
   - Validate volume range
   - Apply to specific device

5. **Mute/Unmute Microphone**
   ```ruchy
   fun set_mic_mute(device_id: String, muted: bool) -> Result<(), ConfigError>
   ```
   - Mute or unmute specific device
   - Verify mute state applied

6. **Validate Device ID**
   ```ruchy
   fun validate_mic_device_id(device_id: String) -> bool
   ```
   - Security validation (path traversal, null bytes)
   - Format checking

### Non-Functional Requirements

1. **Performance**: Sub-50ms for detection, sub-100ms for configuration
2. **Reliability**: Rollback on any failure
3. **Security**: Input validation, no command injection
4. **Error Handling**: Clear, actionable error messages
5. **Compatibility**: PulseAudio and PipeWire support

---

## Data Structures

### MicDevice
```ruchy
struct MicDevice {
    id: String,           // Source ID from pactl
    name: String,         // Device name (e.g., "alsa_input.usb...")
    description: String,  // Human-readable description
    card: String,         // ALSA card number
    device: String,       // ALSA device number
    is_default: bool,     // Is this the current default?
}
```

### MicConfig
```ruchy
struct MicConfig {
    device_id: String,    // Current default device
    volume: i32,          // Volume level (0-100)
    is_muted: bool,       // Mute status
}
```

### ConfigError
```ruchy
enum ConfigError {
    CommandFailed(String),
    ParseError(String),
    DeviceNotFound(String),
    InvalidState(String),
    InvalidVolume(i32),
}
```

---

## Test Strategy (RED Phase)

### Property Tests to Create

Following RUC-001 approach, create 5 property tests:

1. **test_mic_detection_idempotent**
   - Calling `detect_microphone_devices()` multiple times returns same results
   - Verifies no side effects from detection

2. **test_mic_config_reversible**
   - Configure device A → device B → device A
   - Final state equals initial state
   - Verifies configuration doesn't corrupt state

3. **test_mic_volume_bounds**
   - Set volume to various values (0-100, negative, >100)
   - Verify clamping and validation work correctly
   - Test boundary conditions

4. **test_mic_mute_toggle**
   - Mute → unmute → mute sequence
   - Verify mute state persists correctly
   - Test rapid toggling

5. **test_invalid_device_graceful**
   - Try to configure non-existent device
   - Verify returns error (doesn't panic)
   - Original config unchanged

### Manual Testing

```bash
# Test detection
ruchydbg run /tmp/test_mic_detection.ruchy

# Test configuration
ruchydbg run /tmp/test_mic_config.ruchy

# Test volume control
ruchydbg run /tmp/test_mic_volume.ruchy

# Test mute/unmute
ruchydbg run /tmp/test_mic_mute.ruchy
```

---

## Implementation Plan

### Phase 1: RED (Write Tests First) - 20 min

1. Create test file: `ruchy/tests/test_microphone.ruchy`
2. Define all 5 property tests
3. Create data structures (MicDevice, MicConfig, ConfigError)
4. Create stub implementations that return errors
5. Run tests → verify all FAIL (RED phase)
6. Document test results

### Phase 2: GREEN (Make Tests Pass) - 40 min

1. Create library file: `ruchy/lib/microphone.ruchy`
2. Implement helper functions:
   - `bytes_to_string()` (reuse from RUC-001)
   - `extract_field()` (reuse from RUC-001)
   - `parse_volume_from_line()` (reuse from RUC-001)
   - `parse_pactl_sources()` (new - similar to parse_pactl_output)
3. Implement core functions:
   - `detect_microphone_devices()` (use `pactl list sources`)
   - `get_current_mic_config()` (use `pactl get-default-source`)
   - `configure_microphone()` (use `pactl set-default-source`)
   - `set_mic_volume()` (use `pactl set-source-volume`)
   - `set_mic_mute()` (use `pactl set-source-mute`)
   - `validate_mic_device_id()` (same as RUC-001)
4. Run tests → all PASS (GREEN phase)
5. Verify with real microphone devices

### Phase 3: REFACTOR (Polish) - 20 min

1. Extract common code with RUC-001 (if possible)
2. Improve error messages
3. Add inline documentation
4. Optimize parsing logic
5. Final testing and validation

---

## Success Criteria

### Must Have ✅
- [ ] All 5 core functions implemented
- [ ] Property tests pass
- [ ] Error handling complete
- [ ] Security validation working
- [ ] Performance < 100ms per operation

### Should Have 📋
- [ ] Reuse code from RUC-001 where possible
- [ ] Comprehensive error messages
- [ ] Handle edge cases (no devices, permission issues)
- [ ] Volume range validation

### Nice to Have 🎁
- [ ] Support for per-application input routing
- [ ] Noise cancellation detection
- [ ] Echo cancellation configuration
- [ ] Hardware vs. software device detection

---

## Technical Design

### File Structure

```
ruchy/
├── lib/
│   ├── audio_speakers.ruchy    # RUC-001 ✅
│   └── microphone.ruchy         # RUC-003 (new)
└── tests/
    ├── test_audio_speakers.ruchy  # RUC-001 ✅
    └── test_microphone.ruchy      # RUC-003 (new)
```

### Key Differences from RUC-001

| Aspect | RUC-001 (Speakers) | RUC-003 (Microphones) |
|--------|-------------------|----------------------|
| Command | `pactl list sinks` | `pactl list sources` |
| Default | `get-default-sink` | `get-default-source` |
| Set | `set-default-sink` | `set-default-source` |
| Volume | `set-sink-volume` | `set-source-volume` |
| Mute | `set-sink-mute` | `set-source-mute` |
| Filter | Output devices | Input devices (exclude monitors) |

### Parsing Strategy

**Source Output Example**:
```
Source #1
	Name: alsa_input.usb-Focusrite_Scarlett_4i4_USB-00.analog-stereo
	Description: Scarlett 4i4 USB Analog Stereo
	Volume: front-left: 65536 / 100% / 0.00 dB,   front-right: 65536 / 100% / 0.00 dB
	Mute: no
	Properties:
		alsa.card = "2"
		alsa.device = "0"
```

**Parsing Approach**:
1. Split by "Source #" (similar to RUC-001's "Sink #")
2. Extract fields: Name, Description, Volume, Mute
3. Extract properties: alsa.card, alsa.device
4. Filter out monitors: `!name.contains("monitor")`
5. Build MicDevice structs

---

## Code Reuse from RUC-001

### Functions to Reuse

1. **bytes_to_string()**
   ```ruchy
   fun bytes_to_string(bytes: Vec<u8>) -> Result<String, ConfigError>
   ```
   - Identical implementation

2. **extract_field()**
   ```ruchy
   fun extract_field(text: String, field: String) -> String
   ```
   - Identical implementation

3. **parse_volume_from_line()**
   ```ruchy
   fun parse_volume_from_line(line: String) -> i32
   ```
   - Identical implementation

4. **validate_device_id()** (rename to validate_mic_device_id)
   ```ruchy
   fun validate_mic_device_id(device_id: String) -> bool
   ```
   - Identical validation logic

### New Functions Needed

1. **parse_pactl_sources()** (based on parse_pactl_output)
   - Parse "Source #" instead of "Sink #"
   - Filter out monitor devices
   - Extract alsa.card and alsa.device properties

2. **detect_microphone_devices()** (based on detect_audio_devices)
   - Use `pactl list sources`
   - Use `pactl get-default-source`

3. **get_current_mic_config()** (based on get_current_speaker_config)
   - Use `pactl get-default-source`
   - Parse source info from `pactl list sources`

4. **configure_microphone()** (based on configure_speaker)
   - Use `pactl set-default-source`
   - Same rollback logic

5. **set_mic_volume()** (new feature)
   - Use `pactl set-source-volume <device> <volume>%`

6. **set_mic_mute()** (new feature)
   - Use `pactl set-source-mute <device> yes/no`

---

## Example Usage

### Detect Microphones
```ruchy
let devices = match detect_microphone_devices() {
    Ok(d) => d,
    Err(e) => {
        println!("Error: {:?}", e);
        return;
    }
};

println!("Found {} microphones", devices.len());
for device in devices {
    let marker = if device.is_default { "* " } else { "  " };
    println!("{}{} - {}", marker, device.name, device.description);
}
```

### Configure Default Microphone
```ruchy
match configure_microphone("alsa_input.usb-Focusrite_Scarlett_4i4_USB-00.analog-stereo".to_string()) {
    Ok(_) => println!("✓ Microphone configured"),
    Err(e) => println!("✗ Error: {:?}", e),
}
```

### Set Volume
```ruchy
match set_mic_volume("alsa_input.usb-Focusrite_Scarlett_4i4_USB-00.analog-stereo".to_string(), 75) {
    Ok(_) => println!("✓ Volume set to 75%"),
    Err(e) => println!("✗ Error: {:?}", e),
}
```

### Mute/Unmute
```ruchy
match set_mic_mute("alsa_input.usb-Focusrite_Scarlett_4i4_USB-00.analog-stereo".to_string(), true) {
    Ok(_) => println!("✓ Microphone muted"),
    Err(e) => println!("✗ Error: {:?}", e),
}
```

---

## Challenges to Anticipate

### Challenge 1: Monitor Device Filtering

**Issue**: `pactl list sources` returns monitor devices (speakers as input sources) which we need to filter out.

**Solution**:
```ruchy
// Filter logic in parse_pactl_sources
if name.contains(".monitor") || description.contains("Monitor of") {
    // Skip this device
    continue;
}
```

### Challenge 2: Property Extraction

**Issue**: Card and device numbers are in Properties section, not top-level fields.

**Solution**:
```ruchy
// Extract properties separately
let card = extract_property(block, "alsa.card");
let device = extract_property(block, "alsa.device");
```

### Challenge 3: Volume Format Differences

**Issue**: Volume may be shown differently for input vs output devices.

**Solution**:
- Test with real microphone to verify format
- Reuse parse_volume_from_line() if format matches
- Create mic-specific parser if needed

### Challenge 4: Default Source Detection

**Issue**: `pactl get-default-source` might not be set on some systems.

**Solution**:
```ruchy
// Handle missing default gracefully
let default_source = if default_output.status.success {
    match bytes_to_string(default_output.stdout) {
        Ok(s) => s.trim().to_string(),
        Err(_) => "".to_string(),
    }
} else {
    "".to_string()  // No default set
};
```

---

## Dependencies

### Required
- ✅ Ruchy v3.149.0+
- ✅ pactl (PulseAudio/PipeWire CLI)
- ✅ RUC-001 patterns (for reference)

### Optional
- arecord (ALSA recording - for additional testing)
- pavucontrol (GUI tool for verification)

---

## Testing Plan

### Unit Tests
- bytes_to_string() conversion
- extract_field() parsing
- parse_volume_from_line() extraction
- validate_mic_device_id() validation
- Monitor device filtering

### Integration Tests
- Detect real microphones on system
- Configure default microphone
- Set volume and verify
- Mute/unmute and verify
- Rollback on failure

### Property Tests
- Idempotence (detection)
- Reversibility (configuration)
- Volume bounds (0-100 range)
- Mute toggle consistency
- Graceful failure (invalid devices)

### Manual Tests
```bash
# Test with real microphone
ruchydbg run /tmp/test_mic_real.ruchy

# Verify with pactl
pactl list sources short
pactl get-default-source

# Test volume changes
# (should hear change in Zoom/recording)

# Test mute
# (should not hear anything in recording)
```

---

## Timeline

### Estimated Duration: 60-90 minutes

**RED Phase**: 20 minutes
- Write data structures
- Write 5 property tests
- Create stub implementations
- Verify tests fail

**GREEN Phase**: 40 minutes
- Implement helper functions (reuse from RUC-001)
- Implement core detection
- Implement configuration
- Implement volume/mute control
- Make all tests pass

**REFACTOR Phase**: 20 minutes
- Extract common code
- Improve error messages
- Add documentation
- Final validation

---

## Success Metrics

### Code Quality
- Clean separation of concerns
- Proper error handling (no unwrap)
- Security validation (no injection)
- Good test coverage (5 property tests)

### User Experience
- Sub-50ms device detection
- Clear error messages
- Reliable configuration
- Volume/mute work consistently

### Technical
- Code reuse from RUC-001 where possible
- Same patterns and conventions
- Performance equal to RUC-001
- Ready for RUC-004 (CLI interface)

---

## Next Steps After RUC-003

1. **RUC-004**: Microphone CLI interface (like RUC-002 for speakers)
2. **RUC-005**: Combined audio CLI (speakers + microphones)
3. **RUC-006**: Audio troubleshooting/diagnostics
4. **RUC-007**: Port to other system modules

---

## Resources

### Reference Implementations
- `scripts/audio/enable-mic.ts` - TypeScript version (218 LOC)
- `ruchy/lib/audio_speakers.ruchy` - Similar patterns ✅
- `ruchy/bin/ubuntu-audio.ruchy` - CLI patterns ✅

### Documentation
- RUC-001-RUCHY-GREEN-PHASE-COMPLETE.md
- RUC-002-CLI-INTERFACE-COMPLETE.md
- pactl documentation: `man pactl`

### Testing
- Property-based testing examples from RUC-001
- Manual testing procedures
- Real device verification steps

---

## Notes

- **Reuse Patterns**: Follow RUC-001 exactly for consistency
- **Extreme TDD**: RED → GREEN → REFACTOR strictly enforced
- **Security First**: Validate all user inputs
- **Performance**: Keep under 100ms per operation
- **Error Messages**: Clear and actionable

---

**Ready to Start**: RUC-001 and RUC-002 provide solid foundation!

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
