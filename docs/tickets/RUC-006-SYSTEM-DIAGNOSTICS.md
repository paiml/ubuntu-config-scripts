# RUC-006: System Diagnostics Tool

**Date**: 2025-10-30
**Status**: 🟢 **READY TO START**
**Priority**: HIGH (troubleshooting infrastructure)
**Methodology**: Extreme TDD (RED → GREEN → REFACTOR)
**Depends On**: Ruchy v3.150.0 ✅, Command execution ✅
**Estimated Time**: 60-90 minutes
**No File I/O Required**: ✅ Console output only

---

## Objective

Create a comprehensive system diagnostics tool that checks audio, video, and system service health for Ubuntu systems. Provides structured diagnostic output to help troubleshoot issues.

**Goal**: Enable quick system health checks and troubleshooting for ubuntu-config-scripts ecosystem.

---

## Why System Diagnostics?

### 1. Unblocked ✅
- Uses only `std::process::Command` (working since v3.149.0)
- No file I/O needed (blocked by Issue #90)
- Console output only

### 2. High Value 🎯
- Essential for troubleshooting
- Helps users diagnose audio/video issues
- Validates system configuration
- Foundation for other diagnostic tools

### 3. Proven Patterns ✅
- Command execution works perfectly (RUC-003, RUC-004)
- Module pattern established
- Error handling patterns known

---

## Requirements

### Functional Requirements

1. **Audio System Diagnostics**
   ```bash
   ubuntu-diag audio
   ```
   - Check PulseAudio/PipeWire status
   - Detect audio sinks (speakers)
   - Detect audio sources (microphones)
   - Show current defaults
   - Verify audio system running

2. **Video/GPU Diagnostics**
   ```bash
   ubuntu-diag video
   ```
   - Detect GPU hardware (lspci)
   - Check NVIDIA driver status (nvidia-smi)
   - Check for VA-API support
   - Verify video acceleration

3. **System Services**
   ```bash
   ubuntu-diag services
   ```
   - Check PipeWire/PulseAudio service
   - Check critical system services
   - Show service status

4. **Full Diagnostic Report**
   ```bash
   ubuntu-diag all
   ```
   - Run all diagnostic checks
   - Structured output
   - Success/failure indicators

---

## Non-Functional Requirements

1. **Performance**: Complete all checks in <2 seconds
2. **Clarity**: Clear, color-coded output (if possible)
3. **Reliability**: Never crash, graceful degradation
4. **Usability**: Helpful error messages with suggestions
5. **Non-invasive**: Read-only operations, no system changes

---

## Implementation Strategy

### Approach: Test-Driven Diagnostic Checks

**RED Phase** (20 min):
1. Define diagnostic data structures
2. Create failing tests for audio checks
3. Create failing tests for video checks
4. Create failing tests for service checks
5. Verify all tests fail appropriately

**GREEN Phase** (40 min):
1. Implement audio diagnostics (pactl)
2. Implement video diagnostics (lspci, nvidia-smi)
3. Implement service diagnostics (systemctl)
4. Format structured output
5. Make all tests pass

**REFACTOR Phase** (20 min):
1. Polish output formatting
2. Add color coding (if Ruchy supports)
3. Add diagnostic suggestions
4. Optimize command execution

---

## Data Structures

```ruchy
enum DiagnosticStatus {
    Pass,
    Warn,
    Fail,
    Unknown,
}

struct AudioDiagnostic {
    pipewire_running: DiagnosticStatus,
    sinks_found: i32,
    sources_found: i32,
    default_sink: Option<String>,
    default_source: Option<String>,
}

struct VideoDiagnostic {
    gpus_found: Vec<String>,
    nvidia_driver: DiagnosticStatus,
    va_api_available: DiagnosticStatus,
}

struct ServiceDiagnostic {
    service_name: String,
    status: DiagnosticStatus,
    active: bool,
}

struct DiagnosticReport {
    audio: AudioDiagnostic,
    video: VideoDiagnostic,
    services: Vec<ServiceDiagnostic>,
}
```

---

## API Design

### Module Pattern (Following RUC-004)

**Library**: `ruchy/src/diagnostics.ruchy`
```ruchy
// Diagnostic functions
fun diagnose_audio() -> AudioDiagnostic { ... }
fun diagnose_video() -> VideoDiagnostic { ... }
fun diagnose_services() -> Vec<ServiceDiagnostic> { ... }
fun generate_report() -> DiagnosticReport { ... }
```

**CLI**: `ruchy/bin/ubuntu-diag.ruchy`
```ruchy
use diagnostics;

fun main() {
    let report = diagnostics::generate_report();
    diagnostics::print_report(report);
}
```

---

## Command Execution Examples

### Audio Detection (pactl)

```ruchy
// Check if PipeWire/PulseAudio is running
let output = std::process::Command::new("pactl")
    .arg("info")
    .output();

match output {
    Ok(o) if o.status.success => DiagnosticStatus::Pass,
    _ => DiagnosticStatus::Fail,
}

// List sinks
let output = std::process::Command::new("pactl")
    .arg("list")
    .arg("short")
    .arg("sinks")
    .output()?;

let count = count_lines(String::from_utf8(output.stdout)?);
```

### GPU Detection (lspci)

```ruchy
let output = std::process::Command::new("lspci")
    .output()?;

let text = String::from_utf8(output.stdout)?;
let gpus = extract_gpus(text);  // Parse VGA/3D/Display lines
```

### NVIDIA Status (nvidia-smi)

```ruchy
let output = std::process::Command::new("nvidia-smi")
    .arg("--query")
    .output();

match output {
    Ok(o) if o.status.success => DiagnosticStatus::Pass,
    _ => DiagnosticStatus::Warn,  // NVIDIA not available, not critical
}
```

### Service Status (systemctl)

```ruchy
let output = std::process::Command::new("systemctl")
    .arg("--user")
    .arg("is-active")
    .arg("pipewire")
    .output()?;

let active = output.status.success;
```

---

## Output Format

### Example Output

```
=== Ubuntu System Diagnostics ===

📊 AUDIO SYSTEM
  PipeWire:        ✓ Running
  Audio Sinks:     ✓ 2 found
  Audio Sources:   ✓ 2 found
  Default Sink:    alsa_output.usb-Focusrite_Scarlett_4i4_USB-00
  Default Source:  alsa_input.usb-Focusrite_Scarlett_4i4_USB-00
  Status:          ✓ PASS

🎮 VIDEO/GPU
  GPUs Found:      2
    - NVIDIA TU104 [GeForce RTX 2080]
    - AMD Renoir [Radeon Graphics]
  NVIDIA Driver:   ✓ Running (Driver 535.183.01)
  VA-API:          ✓ Available
  Status:          ✓ PASS

⚙️  SYSTEM SERVICES
  pipewire:        ✓ active (running)
  pipewire-pulse:  ✓ active (running)
  Status:          ✓ PASS

=== OVERALL: PASS ===
All systems operational
```

---

## Testing Strategy

### RED Phase Tests

```ruchy
// Test 1: Can detect audio system
fun test_audio_detection() {
    let audio = diagnose_audio();
    // Should have some result, even if Fail
    assert!(audio.sinks_found >= 0);
}

// Test 2: Can detect GPUs
fun test_gpu_detection() {
    let video = diagnose_video();
    assert!(video.gpus_found.len() >= 0);
}

// Test 3: Can check services
fun test_service_check() {
    let services = diagnose_services();
    assert!(services.len() > 0);
}

// Test 4: Full report generation
fun test_full_report() {
    let report = generate_report();
    // Report should complete without crashing
}
```

### Expected Behavior

**RED Phase**: All tests should fail (functions not yet implemented)

**GREEN Phase**: All tests should pass with real system data

---

## Success Criteria

### Must Have ✅

- [ ] Audio system diagnostics (PulseAudio/PipeWire)
- [ ] Video/GPU detection
- [ ] System service status checks
- [ ] Structured output format
- [ ] Error handling (graceful degradation)
- [ ] Module pattern (library + CLI)

### Should Have 📋

- [ ] Clear status indicators (✓/✗)
- [ ] Default device information
- [ ] Service active/inactive status
- [ ] Helpful diagnostic suggestions

### Nice to Have 🎁

- [ ] Color-coded output (green/yellow/red)
- [ ] JSON output mode
- [ ] Verbose mode (detailed info)
- [ ] Performance metrics (command timing)

---

## Risk Assessment

### Low Risk ✅

**Command Execution**: Proven working
- We've used Command extensively in RUC-003, RUC-004
- All system commands available (pactl, lspci, systemctl)
- Error handling patterns established

### Medium Risk ⚠️

**System Command Availability**:
- Some commands may not be installed (nvidia-smi)
- Different Ubuntu versions may have different tools

**Mitigation**:
- Check if commands exist before running
- Graceful degradation if tools missing
- Clear error messages

### Minimal Risk

**No File I/O**: All output to console
- Avoids Issue #90 (std::fs blocked)
- Console-only = no file permission issues

---

## Timeline

### Estimated: 60-90 minutes

**RED Phase** (20 min):
- Define data structures (4 structs, 1 enum)
- Write 4-5 failing tests
- Create test structure
- Verify tests fail

**GREEN Phase** (40 min):
- Audio diagnostics (~15 min)
- Video diagnostics (~10 min)
- Service diagnostics (~10 min)
- Output formatting (~5 min)
- Make all tests pass

**REFACTOR Phase** (20 min):
- Polish output format
- Add diagnostic suggestions
- Optimize if needed
- Add convenience methods

---

## Files to Create

```
ruchy/
└── src/
    └── diagnostics.ruchy      # Diagnostics module (300-400 LOC estimated)
└── bin/
    └── ubuntu-diag.ruchy      # CLI tool (150-200 LOC)
    └── test-diagnostics.ruchy # RED phase tests (100 LOC)
```

**Total**: ~550-700 LOC estimated

---

## Dependencies

- ✅ Ruchy v3.150.0
- ✅ Module system (Issue #88 fixed)
- ✅ Command execution (Issue #85 fixed)
- ✅ format! macro (Issue #83 fixed)
- ❌ No file I/O needed (avoids Issue #90)

---

## System Commands Used

| Command | Purpose | Fallback if Missing |
|---------|---------|---------------------|
| `pactl` | Audio system info | Warn user, skip audio |
| `lspci` | GPU detection | Use fallback detection |
| `nvidia-smi` | NVIDIA status | Optional, warn if missing |
| `systemctl` | Service status | Report as unknown |

---

## Integration with Other Modules

### Future Integration

- **RUC-002/RUC-004**: Can call diagnostics before config changes
- **RUC-005 (Logger)**: Can log diagnostic results (when unblocked)
- **Future tools**: Provides health check foundation

### Example Usage

```ruchy
// Before configuring audio
let audio_diag = diagnostics::diagnose_audio();
if audio_diag.pipewire_running == DiagnosticStatus::Fail {
    println!("Warning: PipeWire not running");
    println!("Run 'ubuntu-diag audio' for more info");
}

// Proceed with configuration...
```

---

## Next Steps After RUC-006

Once diagnostics complete:
1. **RUC-007**: Hardware detection (detailed device info)
2. **RUC-008**: Combined audio CLI (merge RUC-002 + RUC-004)
3. **Wait for Issue #90**: Then build logger and refactor all modules

---

## Notes

- **No File I/O**: Completely avoids Issue #90 blocker ✅
- **High Value**: Essential troubleshooting tool
- **Quick Win**: Can complete in one session
- **Foundation**: Other diagnostic tools can build on this

---

**Ready to Start**: All dependencies met, no blockers, proven patterns!

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
