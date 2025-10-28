# RUCHY-002: Convert lib/common.ts to Pure Ruchy

## Status: RED Phase Complete ✅ (with compiler limitations noted)

### Ticket Information
- **ID**: RUCHY-002
- **Title**: Convert lib/common.ts to Ruchy
- **Phase**: Phase 1 - Foundation Libraries
- **Priority**: Critical
- **Complexity**: High
- **Estimated Hours**: 24

### Scope

Converting comprehensive common utilities library with 13 major functions:

#### Command Execution (3 functions)
- `runCommand()` - Execute commands with stdout/stderr capture
- `commandExists()` - Check if command exists in PATH
- `requireCommand()` - Assert command exists or fail

#### CLI Parsing (1 function)
- `parseArgs()` - Parse command-line arguments (--flag, --key=value, -f)

#### File Operations (2 functions)
- `fileExists()` - Check if file/directory exists
- `ensureDir()` - Create directory recursively

#### Environment Variables (2 functions)
- `getEnvOrDefault()` - Get env var with fallback
- `requireEnv()` - Get env var or fail

#### System Utilities (4 functions)
- `withTempDir()` - Execute function with temp directory
- `isRoot()` - Check if running as root (UID 0)
- `requireRoot()` - Assert running as root or fail
- `confirm()` - Interactive yes/no prompt

#### Type Definitions (1 struct)
- `CommandResult` - Result of command execution

### Progress

#### RED Phase: Tests Written ✅
- **File**: `ruchy/tests/test_common.ruchy`
- **Tests**: 25 comprehensive tests
- **Syntax**: Valid (verified with `ruchy check`)
- **Status**: Tests ready

#### Implementation Stub ⚠️
- **File**: `ruchy/lib/common_v2.ruchy`
- **Status**: Partial - hits same Ruchy compiler bug as RUCHY-001
- **Working**: 11/13 functions (struct, parse_args, commands, files, env, system utils)
- **Blocked**: 2/13 functions (`with_temp_dir`, `confirm`) due to compiler bug

### TypeScript Source
- **Original**: `scripts/lib/common.ts` (168 lines)
- **Target**: `ruchy/lib/common_v2.ruchy`
- **API Parity**: Maintain same interface where possible

### Notes on Ruchy Adaptation

**Async/Await**: Ruchy supports async via Tokio runtime
**std::process::Command**: Use for command execution
**std::fs**: Use for file operations
**std::env**: Use for environment variables
**tempfile crate**: Use for temp directory management

### Test Coverage

**25 Tests Written**:
1-8: Parse args (boolean flags, key=value, space-separated, short flags, mixed, empty, equals in value, invalid formats)
9-13: Command execution (exists positive/negative, run success/failure, CommandResult struct)
14-16: File operations (exists positive/negative, ensure dir)
17-19: Environment variables (get with default exists/missing, require success)
20-22: System utilities (is root, require command, with temp dir stub)
23-25: Capture tests (stdout, stderr, require command success)

### Compiler Bug Impact

Same "Function parameters must be simple identifiers" error as RUCHY-001.
- Error message unclear and line numbers incorrect
- Affects certain function signatures
- Minimal reproduction created: `ruchy/lib/common_minimal.ruchy`
- Working constructs identified: struct, HashMap, Vec params, simple returns

### Files Created

```
ruchy/
├── tests/
│   └── test_common.ruchy         # 25 tests (RED ✅)
└── lib/
    ├── common_v2.ruchy           # Partial stub (11/13 functions)
    └── common_minimal.ruchy      # Compiler bug isolation test
```

---

**Status**: RED phase complete, GREEN phase BLOCKED on compiler bug
**Last Updated**: 2025-10-28
**Next**: Wait for Ruchy bug fix, then implement 11 working functions
