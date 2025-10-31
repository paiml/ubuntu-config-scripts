# RUC-007: System Diagnostics CLI Tool

**Date**: 2025-10-30
**Completed**: 2025-10-31
**Status**: ✅ **COMPLETE** - Interpreter mode implementation
**Priority**: HIGH (user-facing diagnostic tool)
**Methodology**: Extreme TDD (RED → GREEN → REFACTOR)
**Depends On**: RUC-006 ✅, std::env::args ✅ (v3.153.0)
**Implementation Time**: 45 minutes
**Deployment Mode**: Interpreter only (Issue #103 blocks compilation)

---

## Objective

Create a user-facing CLI tool (`ubuntu-diag`) that provides easy access to system diagnostics functionality. This is the CLI wrapper around the diagnostics module from RUC-006.

**Goal**: Enable users to run system health checks via simple commands.

---

## Why Diagnostics CLI?

### 1. Follows Established Pattern ✅
- RUC-001 (library) → RUC-002 (CLI)
- RUC-003 (library) → RUC-004 (CLI)
- RUC-006 (library) → **RUC-007 (CLI)** ← We are here

### 2. User-Facing Tool 🎯
- Simple commands for common diagnostic tasks
- Helpful output for troubleshooting
- No need to understand Ruchy/code

### 3. Quick Win ✅
- Library already complete and tested
- Just need CLI argument parsing
- Minimal new code (~100-150 LOC)

---

## Requirements

### Functional Requirements

1. **Full Diagnostic Report** (default)
   ```bash
   ubuntu-diag
   # or
   ubuntu-diag all
   ```
   Runs all diagnostics and shows complete report

2. **Audio-Only Diagnostics**
   ```bash
   ubuntu-diag audio
   ```
   Shows only audio system diagnostics

3. **Video-Only Diagnostics**
   ```bash
   ubuntu-diag video
   ```
   Shows only video/GPU diagnostics

4. **Services-Only Diagnostics**
   ```bash
   ubuntu-diag services
   ```
   Shows only system services status

5. **Help Command**
   ```bash
   ubuntu-diag help
   # or
   ubuntu-diag --help
   ```
   Shows usage information

---

## Non-Functional Requirements

1. **Performance**: <200ms execution time
2. **Usability**: Clear error messages, helpful output
3. **Reliability**: Never crash, graceful error handling
4. **Simplicity**: Minimal dependencies, straightforward code

---

## Implementation Strategy

### Approach: Simple Argument Parsing

**RED Phase** (10 min):
1. Create test file demonstrating all commands
2. Verify tests fail (CLI not yet created)

**GREEN Phase** (20 min):
1. Create ubuntu-diag.ruchy CLI
2. Implement argument parsing
3. Wire up to diagnostics module functions
4. Handle each command case
5. Make tests pass

**REFACTOR Phase** (10 min):
1. Clean up code
2. Add error messages
3. Polish help text

---

## CLI Design

### Command Structure

```ruchy
use diagnostics;

fun main() {
    let args = std::env::args();

    if args.len() < 2 {
        cmd_all();
        return;
    }

    let command = args[1];

    match command {
        "all" => cmd_all(),
        "audio" => cmd_audio(),
        "video" => cmd_video(),
        "services" => cmd_services(),
        "help" => cmd_help(),
        "--help" => cmd_help(),
        _ => {
            println!("Unknown command: {}", command);
            cmd_help();
        }
    }
}

fun cmd_all() {
    match diagnostics::generate_report() {
        Ok(report) => diagnostics::print_report(report),
        Err(e) => println!("Error: {:?}", e),
    }
}

fun cmd_audio() {
    match diagnostics::diagnose_audio() {
        Ok(audio) => {
            println!("=== Audio System Diagnostics ===");
            // Print audio details
        }
        Err(e) => println!("Error: {:?}", e),
    }
}

// ... similar for video, services, help
```

---

## Example Usage

### Default (Full Report)
```bash
$ ubuntu-diag
=== Ubuntu System Diagnostics ===

📊 AUDIO SYSTEM
  PipeWire:        ✓ Running
  Audio Sinks:     ✓ 4 found
  Audio Sources:   ✓ 2 found
  ...

🎮 VIDEO/GPU
  GPUs Found:      1
  ...

⚙️  SYSTEM SERVICES
  pipewire ✓ active
  ...

=== DIAGNOSTICS COMPLETE ===
```

### Audio Only
```bash
$ ubuntu-diag audio
=== Audio System Diagnostics ===
  PipeWire:        ✓ Running
  Audio Sinks:     ✓ 4 found
  Audio Sources:   ✓ 2 found
  Default Sink:    alsa_output.usb-...
  Default Source:  alsa_input.usb-...
```

### Help
```bash
$ ubuntu-diag help
ubuntu-diag - System Diagnostics Tool

USAGE:
    ubuntu-diag [COMMAND]

COMMANDS:
    (none)      Run all diagnostics (default)
    all         Run all diagnostics
    audio       Audio system diagnostics
    video       Video/GPU diagnostics
    services    System services status
    help        Show this help message

EXAMPLES:
    ubuntu-diag              # Full diagnostic report
    ubuntu-diag audio        # Audio diagnostics only
    ubuntu-diag video        # Video diagnostics only
```

---

## Testing Strategy

### RED Phase Tests

Create `ruchy/bin/test-ubuntu-diag.ruchy`:
```ruchy
// Test 1: Can we run the CLI?
// Execute: ubuntu-diag
// Expected: Full report printed

// Test 2: Audio command works
// Execute: ubuntu-diag audio
// Expected: Audio diagnostics only

// Test 3: Video command works
// Execute: ubuntu-diag video
// Expected: Video diagnostics only

// Test 4: Services command works
// Execute: ubuntu-diag services
// Expected: Services diagnostics only

// Test 5: Help command works
// Execute: ubuntu-diag help
// Expected: Help text printed

// Test 6: Unknown command shows help
// Execute: ubuntu-diag unknown
// Expected: Error + help text
```

### Manual Testing
```bash
# Test all commands manually
ruchydbg run ruchy/bin/ubuntu-diag.ruchy
ruchydbg run ruchy/bin/ubuntu-diag.ruchy audio
ruchydbg run ruchy/bin/ubuntu-diag.ruchy video
ruchydbg run ruchy/bin/ubuntu-diag.ruchy services
ruchydbg run ruchy/bin/ubuntu-diag.ruchy help
ruchydbg run ruchy/bin/ubuntu-diag.ruchy invalid
```

---

## Success Criteria

### Must Have ✅

- [ ] Default command (no args) runs full diagnostics
- [ ] `audio` command shows audio diagnostics
- [ ] `video` command shows video diagnostics
- [ ] `services` command shows services status
- [ ] `help` command shows usage information
- [ ] Unknown commands show error + help
- [ ] Error handling for diagnostics failures

### Should Have 📋

- [ ] Clear, formatted output for each command
- [ ] Consistent status symbols (✓, ✗, ⚠, ?)
- [ ] Helpful error messages
- [ ] Fast execution (<200ms)

### Nice to Have 🎁

- [ ] Version flag (`--version`)
- [ ] Verbose flag (`-v`, `--verbose`)
- [ ] Quiet flag (`-q`, `--quiet`)
- [ ] Exit codes (0 = success, 1 = error)

---

## Risk Assessment

### Low Risk ✅

**Library Already Complete**:
- RUC-006 diagnostics module fully tested
- All functions working perfectly
- Just need CLI wrapper

**Command Execution Works**:
- No new system commands needed
- All diagnostics tested on real system

### Minimal Risk

**Argument Parsing**: Ruchy's `std::env::args()` may have quirks
- Mitigation: Test thoroughly, fallback to simple parsing

---

## Timeline

### Estimated: 30-45 minutes

**RED Phase** (10 min):
- Create test demonstrating CLI usage
- Verify it fails (no CLI yet)

**GREEN Phase** (20 min):
- Create ubuntu-diag.ruchy
- Implement argument parsing
- Wire up to diagnostics module
- Handle all commands
- Make tests pass

**REFACTOR Phase** (10 min):
- Clean up code
- Polish help text
- Add error handling

---

## Files to Create

```
ruchy/
└── bin/
    ├── ubuntu-diag.ruchy          # CLI tool (100-150 LOC estimated)
    └── test-ubuntu-diag.ruchy     # RED phase test (50 LOC)
```

**Total**: ~150-200 LOC estimated

---

## Dependencies

- ✅ Ruchy v3.151.0
- ✅ RUC-006 diagnostics module (complete)
- ✅ Module system (Issue #88 fixed)
- ✅ Command execution (Issue #85 fixed)
- ❓ std::env::args() (not yet tested, may need workaround)

---

## Integration with RUC-006

**Simple Module Usage**:
```ruchy
use diagnostics;

// Full report
let report = diagnostics::generate_report()?;
diagnostics::print_report(report);

// Individual diagnostics
let audio = diagnostics::diagnose_audio()?;
let video = diagnostics::diagnose_video()?;
let services = diagnostics::diagnose_services()?;
```

---

## Next Steps After RUC-007

Once CLI complete:
1. **RUC-008**: Combined audio CLI (merge speaker + mic CLIs)
2. **RUC-009**: Hardware detection (detailed device info)
3. **Wait for Issue #90**: Then build logger and refactor all modules

---

## Notes

- **Pattern Match**: Follows established lib → CLI pattern
- **Quick Win**: Library already complete and tested
- **User Value**: Provides easy-to-use diagnostic tool
- **No Blockers**: All dependencies available

---

**Ready to Start**: All dependencies met, library complete, proven pattern!

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
