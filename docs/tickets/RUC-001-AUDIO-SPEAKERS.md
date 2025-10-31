# RUC-001: Audio Speaker Configuration Module (Extreme TDD)

**Status**: 🔴 OPEN
**Priority**: HIGH
**Category**: Audio Configuration
**Methodology**: Extreme TDD (RED → GREEN → REFACTOR)
**Target Coverage**: 85%+

---

## Objective

Port the TypeScript audio speaker configuration script to Ruchy with comprehensive property-based testing and PMAT quality gates.

---

## Success Criteria

- [ ] **Property-based tests written FIRST** (RED phase)
- [ ] **All tests pass** (GREEN phase)
- [ ] **Code refactored** with PMAT enforcement (REFACTOR phase)
- [ ] **85%+ test coverage** verified
- [ ] **No PMAT critical issues**
- [ ] **Cyclomatic complexity < 10**
- [ ] **Zero technical debt**

---

## TDD Workflow

### Phase 1: RED (Write Failing Tests First)

**Test File**: `ruchy/tests/test_audio_speakers.rs`

**Property Tests to Write**:

1. **Property: Audio device detection is idempotent**
   ```rust
   #[test]
   fn prop_device_detection_idempotent() {
       // Running detection twice should return same results
       let devices1 = detect_audio_devices();
       let devices2 = detect_audio_devices();
       assert_eq!(devices1, devices2);
   }
   ```

2. **Property: Speaker configuration is reversible**
   ```rust
   #[quickcheck]
   fn prop_speaker_config_reversible(device_id: String) {
       // Save current config
       let original = get_current_speaker_config();

       // Apply new config
       configure_speaker(&device_id);

       // Restore original
       configure_speaker(&original.device_id);

       // Should be back to original state
       assert_eq!(get_current_speaker_config(), original);
   }
   ```

3. **Property: Invalid device IDs fail gracefully**
   ```rust
   #[quickcheck]
   fn prop_invalid_device_fails_gracefully(invalid_id: String) {
       // Assume random strings are invalid device IDs
       let result = configure_speaker(&invalid_id);
       assert!(result.is_err());

       // System should still be in valid state
       assert!(get_current_speaker_config().is_ok());
   }
   ```

4. **Property: Configuration persists across module reloads**
   ```rust
   #[test]
   fn prop_config_persists() {
       let device = get_test_device();
       configure_speaker(&device.id);

       // Simulate module reload
       drop_module_state();

       // Config should still be applied
       let current = get_current_speaker_config();
       assert_eq!(current.device_id, device.id);
   }
   ```

5. **Property: No hangs or infinite loops** (using timeout)
   ```rust
   #[test]
   fn prop_no_hangs() {
       // All operations complete within timeout
       let result = timeout(Duration::from_secs(5), async {
           detect_audio_devices();
           configure_speaker("test-device");
       }).await;

       assert!(result.is_ok());
   }
   ```

**Expected Result**: 🔴 **ALL TESTS FAIL** (no implementation yet)

---

### Phase 2: GREEN (Minimal Implementation)

**Implementation File**: `ruchy/audio/configure_speakers.ruchy`

**Core Functions to Implement**:

```ruchy
// Audio device detection
fun detect_audio_devices() -> Vec<AudioDevice> {
    // Use pactl or pw-cli to list sinks
    // Parse output
    // Return structured data
}

// Speaker configuration
fun configure_speaker(device_id: &str) -> Result<(), ConfigError> {
    // Validate device exists
    // Set as default sink with pactl/pw-cli
    // Verify configuration applied
}

// Get current configuration
fun get_current_speaker_config() -> Result<SpeakerConfig, ConfigError> {
    // Query current default sink
    // Return config struct
}
```

**Structs**:

```ruchy
struct AudioDevice {
    id: String,
    name: String,
    description: String,
    is_default: bool,
}

struct SpeakerConfig {
    device_id: String,
    volume: i32,
    muted: bool,
}

enum ConfigError {
    DeviceNotFound,
    CommandFailed(String),
    InvalidState,
}
```

**Expected Result**: ✅ **ALL TESTS PASS**

---

### Phase 3: REFACTOR (Quality Gates)

**PMAT Quality Checks**:

```bash
# Run PMAT analysis via MCP
mcp_pmat_analyze --file ruchy/audio/configure_speakers.ruchy

# Check coverage
mcp_pmat_quality_gate --coverage 85

# Verify complexity
mcp_pmat_enforce --max-complexity 10
```

**Refactoring Checklist**:
- [ ] Extract complex logic into helper functions
- [ ] Add comprehensive error handling
- [ ] Document all public functions
- [ ] Remove code duplication
- [ ] Optimize performance hotspots
- [ ] Add logging for debugging
- [ ] Ensure no workarounds (Toyota Way)

**Expected Result**: 🟢 **All PMAT gates pass, 85%+ coverage, complexity < 10**

---

## TypeScript Reference

**Source**: `scripts/audio/configure-speakers.ts`

**Key Functionality to Port**:
1. PulseAudio/PipeWire sink detection
2. Default sink configuration
3. Volume control
4. Error handling for missing devices
5. User-friendly CLI output

**Do NOT copy directly** - rewrite with Ruchy idioms and extreme TDD

---

## Testing Strategy

### Unit Tests (Mocked)
- Test parsing logic with known pactl/pw-cli output
- Test error handling with invalid inputs
- Test state management

### Integration Tests (Real System)
- Test with actual audio system (requires test environment)
- Verify configuration persists
- Test edge cases (no audio devices, multiple devices)

### Property Tests (QuickCheck)
- Idempotence
- Reversibility
- Graceful degradation
- No hangs (timeout-based)

---

## Implementation Notes

### Avoid Known Ruchy Bugs

**✅ Safe Patterns**:
- Enum casts work correctly (Issue #79 fixed in v3.147.8)
- Direct println! for output (format! workaround for Issue #83)
- Avoid chrono for now (Issue #82 - use std time if needed)

**❌ Avoid**:
- `use chrono::Utc;` (broken in v3.147.7/8)
- `format!` macro (not implemented in v3.147.7/8)
- Async/await (not yet implemented)

### Rust Interop

Use Rust crates for:
- Command execution: `std::process::Command`
- Error handling: `Result<T, E>` and `thiserror`
- Testing: `quickcheck` for property tests

---

## Acceptance Criteria

### Functional
- [  ] Detects all available audio devices
- [ ] Configures speaker as default sink
- [ ] Handles device not found gracefully
- [ ] Works with both PulseAudio and PipeWire
- [ ] CLI output is user-friendly

### Quality
- [ ] 85%+ test coverage
- [ ] All property tests pass
- [ ] No PMAT critical issues
- [ ] Cyclomatic complexity < 10
- [ ] Zero compiler warnings

### Documentation
- [ ] Function signatures documented
- [ ] Error cases explained
- [ ] Usage examples provided
- [ ] Test strategy documented

---

## Timeline

**Estimated**: 2-3 hours (with extreme TDD)

- **RED phase**: 45 minutes (write 5+ property tests)
- **GREEN phase**: 60 minutes (implement minimal code to pass)
- **REFACTOR phase**: 30 minutes (PMAT quality gates)
- **Documentation**: 15 minutes

---

## Dependencies

- [x] Ruchy v3.147.8 installed
- [x] RuchyRuchy v1.6.1 installed
- [ ] Test environment with audio system
- [ ] PMAT MCP server configured

---

## Related Tickets

- TypeScript reference: `scripts/audio/configure-speakers.ts`
- Related: RUC-002 (Microphone configuration)
- Blocks: RUC-010 (Audio diagnostics module)

---

## Notes

**Toyota Way Principles**:
- No workarounds - fix root causes
- Stop the line if tests fail
- 85% coverage is MINIMUM, not target
- Refactor continuously

**Extreme TDD Rules**:
1. Write test BEFORE code
2. Write simplest code to pass test
3. Refactor only after tests pass
4. Never skip RED → GREEN → REFACTOR cycle

---

**Status**: Ready to start RED phase 🔴

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
