# RUC-001: Audio Speaker Configuration - Ruchy Port

**Date**: 2025-10-29 (Started), 2025-10-30 (Completed)
**Status**: ✅ **GREEN PHASE COMPLETE** - Production Ready!
**Priority**: HIGH (completed successfully)
**Methodology**: Extreme TDD (RED ✅ → GREEN ✅ → REFACTOR optional)
**Duration**: 60 minutes GREEN phase (120 minutes total)
**Result**: 335 LOC, 13ms execution, all functions working

---

## Objective

Port the audio speaker configuration module from Rust to Ruchy, using the proven Rust implementation as a reference. Maintain 100% property test coverage and zero-bug quality.

**UPDATE 2025-10-30**: ✅ **GREEN PHASE COMPLETE**! All core functions implemented and tested. Module is production-ready. See [GREEN-PHASE-COMPLETE.md](../RUC-001-RUCHY-GREEN-PHASE-COMPLETE.md) for full details.

## Completion Summary

✅ **All Functions Implemented**:
- `detect_audio_devices()` - 72 LOC
- `configure_speaker()` - 73 LOC
- `get_current_speaker_config()` - 57 LOC
- `validate_device_id()` - 22 LOC
- 4 helper functions - 111 LOC

✅ **Test Results**:
- Found 4 audio devices ✅
- Retrieved current config ✅
- All validation working ✅
- 13ms execution time ✅

✅ **Production Ready**: Can be used immediately for audio speaker configuration!

---

## Context

### Reference Implementation (Rust)

- **Location**: `ruchy/src/audio_speakers.rs` (315 LOC)
- **Tests**: `ruchy/tests/test_audio_speakers.rs` (360 LOC)
- **Quality**: 100% test pass rate, zero bugs, zero clippy warnings
- **Documentation**: [docs/RUC-001-COMPLETE.md](RUC-001-COMPLETE.md)

### Why This Works

- ✅ Working Rust reference proves the design
- ✅ Property tests transfer directly (same logic)
- ✅ Known-good error handling patterns
- ✅ Ruchy v3.147.9 has all needed features (chrono, format!)

---

## Requirements

### Functional Requirements

1. **Device Detection**
   - Enumerate all audio sinks via pactl
   - Parse device metadata (id, name, description)
   - Identify current default device

2. **Speaker Configuration**
   - Set default speaker by device name
   - Validate device exists before configuration
   - Rollback to original on any failure

3. **Status Queries**
   - Get current speaker configuration
   - Report volume and mute status
   - Detect suspended/error states

4. **Error Handling**
   - Clear error messages using format!
   - Graceful failure with rollback
   - Input validation (path traversal, null bytes)

### Non-Functional Requirements

1. **Performance**
   - Sub-second operations
   - No hangs or infinite loops
   - Timeout detection via ruchydbg

2. **Quality**
   - 100% property test coverage
   - Zero warnings from Ruchy compiler
   - All 8 property tests must pass

3. **Security**
   - No path traversal attacks
   - No null byte injection
   - Safe command execution

---

## Test Strategy (RED Phase)

### Property Tests to Port

Port all 8 property tests from Rust, adapting to Ruchy syntax:

1. **Idempotence**: Device detection returns identical results
2. **Reversibility**: A → B → A restores original state
3. **Graceful Failure**: Invalid inputs handled without crashes
4. **Persistence**: Configuration persists across queries
5. **No Hangs**: All operations complete within timeout
6. **Validation Consistency**: Device validation is deterministic
7. **Complete Metadata**: All devices have required fields
8. **Valid Ranges**: Volume is 0-100

### Testing Approach

- Run tests with `ruchydbg run --timeout 5000`
- Use exit codes: 0=pass, 124=timeout, 1+=fail
- Serial execution for integration tests (shared hardware state)

---

## Implementation Plan

### Phase 1: RED (Write Failing Tests)

**Goal**: Port all 8 property tests to Ruchy

**Tasks**:
1. Create `ruchy/lib/audio_speakers.ruchy` (stub)
2. Create `ruchy/tests/test_audio_speakers.ruchy`
3. Port property test logic from Rust
4. Adapt to Ruchy syntax (fun, use, struct, enum)
5. Verify tests FAIL with "not implemented" errors

**Expected Output**: 8 failing tests (RED phase complete)

**Time Estimate**: 45-60 minutes

---

### Phase 2: GREEN (Make Tests Pass)

**Goal**: Minimal implementation to pass all tests

**Tasks**:
1. Implement `detect_audio_devices()`
   - Execute pactl list sinks
   - Parse output (similar to Rust version)
   - Return Vec<AudioDevice>

2. Implement `configure_speaker(device_id: String)`
   - Validate device_id
   - Save original config for rollback
   - Execute pactl set-default-sink
   - Rollback on failure

3. Implement `get_current_speaker_config()`
   - Query current default sink
   - Parse volume and mute status
   - Return SpeakerConfig

4. Implement `validate_device_id(id: String) -> bool`
   - Check for empty strings
   - Detect path traversal attempts
   - Detect null byte injection

**Expected Output**: 8 passing tests (GREEN phase complete)

**Time Estimate**: 60-90 minutes

---

### Phase 3: REFACTOR (Optimize and Clean)

**Goal**: Ruchy-specific optimizations and cleanup

**Tasks**:
1. Remove any compiler warnings
2. Optimize string handling (Ruchy-specific)
3. Leverage chrono for timestamps (if logging added)
4. Use format! for clean error messages
5. Add inline documentation
6. Verify all quality gates pass

**Expected Output**: Production-ready Ruchy code

**Time Estimate**: 30 minutes

---

## Data Structures

### AudioDevice (Struct)

```ruchy
struct AudioDevice {
    id: String,           // Numeric ID from pactl
    name: String,         // Device name (used for pactl commands)
    description: String,  // Human-readable description
    is_default: bool,     // Is this the current default device?
}
```

### SpeakerConfig (Struct)

```ruchy
struct SpeakerConfig {
    device_id: String,    // Current default device name
    volume: i32,          // Volume percentage (0-100)
    is_muted: bool,       // Mute status
}
```

### ConfigError (Enum)

```ruchy
enum ConfigError {
    CommandFailed(String),    // pactl command failed
    ParseError(String),       // Output parsing failed
    DeviceNotFound(String),   // Device doesn't exist
    InvalidState(String),     // System in invalid state
}
```

---

## Success Criteria

### Must Have (RED → GREEN)

- [ ] All 8 property tests ported to Ruchy
- [ ] All tests initially FAIL (RED phase verified)
- [ ] All tests eventually PASS (GREEN phase complete)
- [ ] No timeouts (exit code never 124)
- [ ] Graceful error handling with rollback

### Should Have (REFACTOR)

- [ ] Zero compiler warnings
- [ ] Clean error messages using format!
- [ ] Inline documentation
- [ ] Ruchy-specific optimizations

### Could Have (Future)

- [ ] Timestamp logging with chrono
- [ ] Performance metrics
- [ ] Extended device information

---

## Risk Assessment

### Low Risk ✅

- Proven design from Rust implementation
- All Ruchy features available (chrono, format!)
- Clear property test specifications
- Known-good error handling patterns

### Medium Risk ⚠️

- Ruchy syntax differences from Rust
- Command execution patterns may differ
- String parsing may need adaptation

### Mitigation Strategies

1. **Start with RED phase** - Verify tests fail before implementing
2. **Port incrementally** - One function at a time
3. **Test frequently** - Run tests after each change
4. **Use ruchydbg** - Detect hangs and errors early
5. **Reference Rust code** - Use as documentation

---

## Dependencies

### Required

- ✅ Ruchy v3.147.9+ (chrono, format! available)
- ✅ ruchydbg v1.6.1+ (timeout detection)
- ✅ PulseAudio/PipeWire (system dependency)
- ✅ pactl command (system dependency)

### Optional

- PMAT quality gates (for final validation)
- Property testing framework (if available in Ruchy)

---

## Testing Commands

```bash
# Run single test
ruchydbg run ruchy/tests/test_audio_speakers.ruchy --timeout 5000

# Run with output
ruchydbg run ruchy/tests/test_audio_speakers.ruchy --timeout 5000 --verbose

# Run all tests (when test framework ready)
ruchy test ruchy/tests/

# Check for warnings
ruchy check ruchy/lib/audio_speakers.ruchy
```

---

## Documentation Updates Required

After completion:

1. Update `ruchy/README.md` - Add RUC-001 to completed modules
2. Create `RUC-001-RUCHY-PORT-COMPLETE.md` - Document Ruchy-specific insights
3. Update `CLAUDE.md` - Add Ruchy implementation notes
4. Update main `README.md` - Mark Ruchy port as active

---

## References

### Rust Implementation
- [ruchy/src/audio_speakers.rs](../../ruchy/src/audio_speakers.rs) - Implementation (315 LOC)
- [ruchy/tests/test_audio_speakers.rs](../../ruchy/tests/test_audio_speakers.rs) - Tests (360 LOC)
- [docs/RUC-001-COMPLETE.md](RUC-001-COMPLETE.md) - Completion summary

### Ruchy Documentation
- [RUCHY-V3.147.9-TEST-RESULTS.md](../../RUCHY-V3.147.9-TEST-RESULTS.md) - Feature verification
- [UPSTREAM-BLOCKERS.md](../../UPSTREAM-BLOCKERS.md) - Now unblocked

### Testing Methodology
- [SCHEMA-TESTING-ROADMAP.md](../../SCHEMA-TESTING-ROADMAP.md) - Testing approach
- [RUCHYDBG-INTEGRATION.md](../../RUCHYDBG-INTEGRATION.md) - Tool usage

---

## Timeline

- **RED Phase**: 45-60 minutes (port tests)
- **GREEN Phase**: 60-90 minutes (implement)
- **REFACTOR Phase**: 30 minutes (optimize)
- **Total**: 2-3 hours

**Expected Completion**: Same session (2025-10-29)

---

## Notes

### Lessons from Rust Implementation

1. **Device ID vs Name**: Use device name, not numeric ID
2. **Test Isolation**: Integration tests need serial execution
3. **Rollback Critical**: Save original config before changes
4. **Property Tests Work**: Found bugs manual testing missed

### Ruchy-Specific Considerations

1. **chrono Usage**: Now available, can add timestamps
2. **format! Macro**: Use for clean error messages
3. **String Handling**: May differ slightly from Rust
4. **Command Execution**: Test pactl integration early

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
