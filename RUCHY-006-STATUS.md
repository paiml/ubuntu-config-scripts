# RUCHY-006: Convert lib/deps.ts to Pure Ruchy

## Status: RED Phase In Progress 🔴

### Ticket Information
- **ID**: RUCHY-006
- **Title**: Convert lib/deps.ts to Ruchy
- **Phase**: Phase 1 - Foundation Libraries
- **Priority**: High (Simple, foundational)
- **Complexity**: Low (35 lines, 2 functions)
- **Estimated Hours**: 4

### Scope

Converting simple dependency checker with 2 functions:

#### Functions (2 total)
- `checkCommand()` - Check if command exists in PATH
- `validateDependencies()` - Check multiple commands, log results

### Progress

#### RED Phase: Tests Written
- **Status**: Starting
- **Target**: 8+ tests covering all scenarios

### TypeScript Source
- **Original**: `scripts/lib/deps.ts` (35 lines)
- **Target**: `ruchy/lib/deps_v2.ruchy`
- **Dependencies**: Logger (we have this ✅)

### Notes on Ruchy Adaptation

**Command Execution**: Use `std::process::Command`
**Async**: Ruchy supports async, but start with sync for simplicity
**Error Handling**: Use `Result<T, String>` pattern
**Logger Integration**: Import from logger.ruchy (RUCHY-001 ✅)

### Test Coverage Plan

**8 Tests Planned**:
1. checkCommand with existing command (true)
2. checkCommand with missing command (false)
3. validateDependencies with all present (true)
4. validateDependencies with one missing (false)
5. validateDependencies with multiple missing (false)
6. validateDependencies with empty list (true)
7. Logger integration (debug messages)
8. Logger integration (error messages)

---

**Status**: Starting RED phase
**Last Updated**: 2025-10-28
**Next**: Write comprehensive tests
