# RUCHY-007: Convert lib/system-command.ts to Pure Ruchy

## Status: BLOCKED 🚫 - Command Pattern Bug

### Ticket Information
- **ID**: RUCHY-007
- **Title**: Convert lib/system-command.ts to Ruchy
- **Phase**: Phase 1 - Foundation Libraries
- **Priority**: High (Simple, uses completed logger)
- **Complexity**: Low (65 lines, 1 struct, 2 methods)
- **Estimated Hours**: 4

### Scope

Converting simple command execution wrapper:

#### Struct (1 total)
- `SystemCommand` - Command executor with logging

#### Methods (2 total)
- `run()` - Execute command with full logging
- `run_quiet()` - Execute command without logging

#### Result Type (1 struct)
- `CommandResult` - stdout, stderr, code, success

### Blocker

**Issue**: ruchy#73 - Parser fails on std::process::Command usage

**Symptoms**:
- Files using `Command::new().output()` fail to parse
- Error: "Function parameters must be simple identifiers or destructuring patterns"
- Threshold around 30-40 lines with Command usage
- Files without Command work fine (even 276+ lines)

**Minimal Reproduction**: `ruchy/lib/system_command.ruchy` (41 lines)

**GitHub Issue**: https://github.com/paiml/ruchy/issues/73

**Impact**: Cannot implement command execution utilities

### Progress

#### RED Phase: Tests Written - BLOCKED ⏸️
- **Status**: Blocked by Command pattern bug
- **Tests Attempted**: 3-6 tests written
- **File**: `ruchy/tests/test_system_command_standalone.ruchy`
- **Blocker**: Cannot parse files using std::process::Command

### TypeScript Source
- **Original**: `scripts/lib/system-command.ts` (65 lines)
- **Target**: `ruchy/tests/test_system_command_standalone.ruchy`
- **Dependencies**: Logger (we have this ✅ - RUCHY-001)

### Notes on Ruchy Adaptation

**Command Execution**: Use `std::process::Command`
**Logger Integration**: Import from logger.ruchy
**Async**: Start with sync version (Ruchy supports async but simpler without)
**Result Struct**: Simple struct with 4 fields

### Test Coverage Plan

**10 Tests Planned**:
1. CommandResult struct creation
2. run() with successful command (ls)
3. run() with failing command (exit 1)
4. run() captures stdout
5. run() captures stderr
6. run() with command arguments
7. run_quiet() successful
8. run_quiet() with failure
9. run_quiet() captures output
10. Logger integration (debug messages)

---

**Status**: BLOCKED by ruchy#73
**Last Updated**: 2025-10-28
**GitHub Issue**: https://github.com/paiml/ruchy/issues/73
**Next**: Wait for Command pattern fix, then resume RED phase
