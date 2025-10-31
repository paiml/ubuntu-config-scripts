# Ruchy Module System Status

**Date**: 2025-10-30
**Status**: ⚠️ **PARTIAL IMPLEMENTATION** - Backend exists, interpreter integration incomplete
**Issue**: [#88 - Module system not working in interpreter mode](https://github.com/paiml/ruchy/issues/88)

---

## Summary

Ruchy has a sophisticated module loading system in the backend (`src/backend/module_loader.rs`), but it is **not yet integrated with the interpreter** that `ruchydbg run` uses. This means:

- ✅ **Compiler mode**: Module system exists but limited by transpiler features
- ❌ **Interpreter mode**: `use` statements are parsed but modules not actually loaded
- ✅ **Inline pattern**: Works perfectly (RUC-001, RUC-002 proven)

---

## Investigation Summary

### What Exists

**Backend Module Loader** (`src/backend/module_loader.rs`):
- Full file discovery and caching system
- Circular dependency detection
- Multiple search paths (`.`, `./src`, `./modules`)
- Supports three file patterns:
  1. `module_name.ruchy`
  2. `module_name/mod.ruchy`
  3. `module_name.rchy`

**Syntax**:
```ruchy
use mylib;  // Looks for mylib.ruchy in search paths

fun main() {
    mylib::some_function();
}
```

### What Doesn't Work

**Interpreter Mode** (`ruchydbg run`, `ruchy run`):
```bash
$ cd /tmp/test_ruchy_use
$ ls
main.ruchy  mylib.ruchy

$ ruchydbg run main.ruchy
Error: Undefined variable: mylib
```

The `use mylib;` statement is **parsed** but the module is **not loaded** at runtime.

**Compiler Mode** (`ruchy compile`):
- Module loader exists but transpiler has limitations
- Many Ruchy features (like `println!`) not yet supported in transpilation
- Would need full transpiler support to test module compilation

---

## Evidence

### Test Case Created

**File**: `/tmp/test_ruchy_use/main.ruchy`
```ruchy
use mylib;

fun main() {
    println!("Testing Ruchy module import...");
    let result = mylib::add(2, 3);
    println!("2 + 3 = {}", result);
}
```

**File**: `/tmp/test_ruchy_use/mylib.ruchy`
```ruchy
fun add(a: i32, b: i32) -> i32 {
    a + b
}

fun multiply(a: i32, b: i32) -> i32 {
    a * b
}
```

**Result**:
```
$ ruchydbg run main.ruchy
"Testing Ruchy module import..."
Error: Evaluation error: Runtime error: Undefined variable: mylib
```

### Module Loader Documentation

From `src/backend/module_loader.rs`:
```rust
//! Multi-file module system implementation
//!
//! Enables `use external_file;` imports for larger Ruchy programs while preserving
//! 100% compatibility with existing inline modules.
```

The code clearly shows a complete implementation with:
- Parse caching
- Dependency resolution
- Circular dependency detection
- Multiple search paths

---

## Impact on RUC-004

### Problem

RUC-004 (Microphone CLI) is blocked by **two separate issues**:

1. **Issue #87** (Primary): Pattern-specific compiler bug with RUC-003 library patterns
2. **Module System** (This document): Cannot use separate files to avoid Issue #87

### Attempted Workaround

Goal: Keep `microphone.ruchy` in `ruchy/lib/`, import it from CLI binary

Result: ❌ Module system not available in interpreter mode

### Current Solution

**Use inline pattern** (copy library into CLI file) - proven to work for:
- ✅ RUC-001 library (335 LOC) + RUC-002 CLI (129 LOC) = 464 LOC total ✅ Works
- ❌ RUC-003 library (450 LOC) + RUC-004 CLI (~130 LOC) = ~580 LOC ❌ Triggers Issue #87

---

## Conclusions

### For This Project

1. **Module system cannot help with RUC-004 blocker** - not available in interpreter
2. **Inline pattern remains only option** - but triggers Issue #87 with RUC-003
3. **RUC-004 remains BLOCKED** until Issue #87 resolved

### For Ruchy Project

**Feature Request Needed**: Wire module loader into interpreter

**Benefits**:
- Enable larger programs without hitting file size limits
- Allow code reuse across multiple binaries
- Avoid pattern-specific compiler bugs by splitting code

**Current State**:
- Backend implementation is complete and sophisticated
- Just needs integration with `runtime/interpreter.rs`

---

## Recommendations

### Short Term

**For RUC-004**: Continue using inline pattern, wait for Issue #87 fix

**Reasoning**:
- Module system won't help (not in interpreter)
- Inline pattern is proven (RUC-002 works perfectly)
- Issue #87 is pattern-specific, not fundamental

### Medium Term

**File Ruchy Feature Request**: Enable module loading in interpreter mode

**Title**: "Wire ModuleLoader into interpreter for multi-file programs"

**Description**:
- Backend exists in `src/backend/module_loader.rs`
- Need integration with `src/runtime/interpreter.rs`
- Would enable `use` statements in interpreted mode
- Critical for larger programs

### Long Term

Once module system works in interpreter:
- Restructure all RUC libraries as separate modules
- Create thin CLI wrappers that import libraries
- Avoid file size/complexity limits
- Better code organization

---

## Testing Artifacts

### Files Created

```
/tmp/test_ruchy_use/
├── main.ruchy     (tests use mylib;)
└── mylib.ruchy    (simple add/multiply functions)

/tmp/test_module_import/
├── main.ruchy     (tests mod mylib;)
└── mylib.ruchy    (same library)
```

### Commands Run

```bash
# Test 1: mod keyword (Rust style)
cd /tmp/test_module_import && ruchydbg run main.ruchy
# Result: Syntax error: Expected LeftBrace, found Semicolon

# Test 2: mod with empty body
mod mylib {}
# Result: Module expression type not yet implemented

# Test 3: use keyword (correct Ruchy style)
use mylib;
# Result: Parsed, but Undefined variable: mylib at runtime

# Test 4: Compilation mode
ruchy compile main.ruchy
# Result: Transpiler doesn't support println! macro yet
```

---

## Next Actions

1. ✅ Document findings (this file)
2. ✅ **Filed Issue #88**: Module system not working in interpreter mode
3. ⏸️ Monitor Issue #88 for resolution (interpreter integration)
4. ⏸️ Monitor Issue #87 for resolution (enum matching bug)
5. 🔄 When either #87 or #88 resolved, unblock RUC-004 development

---

**Status**: Module system exists but not usable. Issue #88 filed with comprehensive debugging data. RUC-004 remains blocked by Issue #87 AND #88.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
