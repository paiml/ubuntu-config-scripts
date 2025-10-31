# Issue #95: ruchy compile Broken - Macros and Modules Not Supported

**Upstream**: [#103](https://github.com/paiml/ruchy/issues/103) ✅ FILED 2025-10-31
**Date**: 2025-10-31
**Ruchy Version**: v3.153.0
**Severity**: **CRITICAL** - Blocks all production binary compilation
**Status**: 🔄 **OPEN**
**Category**: Compilation/Transpilation

---

## Summary

The `ruchy compile` command cannot transpile programs that use:
1. **Macros** (`println!`, `format!`, etc.)
2. **Module imports** (`use` statements)

Both features work perfectly in **interpreter mode** but fail during compilation with "Unsupported expression kind" errors. This makes `ruchy compile` unusable for real-world applications.

**Error Messages**:
- Macros: `Unsupported expression kind: MacroInvocation`
- Modules: `Failed to find module 'modulename'`

---

## Impact Analysis

### What's Blocked ❌

- **CLI Tools**: Cannot compile (need `println!` for output)
- **Modular Programs**: Cannot compile (need `use` for organization)
- **Production Binaries**: Cannot distribute standalone executables
- **Real Applications**: Anything beyond toy examples

### What Works ✅

- **Interpreter Mode**: Full feature support, everything works perfectly
- **Simple Programs**: Compilation works for macro-free, module-free code
- **Binary Quality**: When it works, produces excellent binaries:
  - Stripped size: **347KB**
  - Execution time: **1ms**
  - Proper ELF format

---

## Detailed Reproduction

### Issue #1: Macros Not Supported

**File: test-macro.ruchy**
```ruchy
fun main() {
    println!("Hello World");
}
```

**Interpreter (WORKS)**:
```bash
$ ruchy test-macro.ruchy
"Hello World"
```

**Compilation (FAILS)**:
```bash
$ ruchy compile --output test test-macro.ruchy
→ Compiling test-macro.ruchy...
✗ Compilation failed: Failed to transpile to Rust
Error: Failed to transpile to Rust

Caused by:
    Unsupported expression kind: MacroInvocation { name: "println", args: [...] }
```

**Affected Macros**:
- `println!()` - Console output
- `format!()` - String formatting
- Likely all macro invocations

---

### Issue #2: Module Imports Not Supported

**File structure:**
```
test-module/
├── greeter.ruchy
└── main.ruchy
```

**greeter.ruchy:**
```ruchy
pub fun greet(name: String) -> String {
    name
}
```

**main.ruchy:**
```ruchy
use greeter;

fun main() {
    let result = greeter::greet("World");
}
```

**Interpreter (WORKS)**:
```bash
$ cd test-module
$ ruchy main.ruchy
# Works correctly
```

**Compilation (FAILS)**:
```bash
$ cd test-module
$ ruchy compile --output test main.ruchy
→ Compiling main.ruchy...
✗ Compilation failed: Failed to transpile to Rust
Error: Failed to transpile to Rust

Caused by:
    0: Failed to resolve import module 'greeter'
    1: Failed to find module 'greeter'
    2: Module 'greeter' not found. Searched in: ., ./src, ./modules
       Looked for: greeter.ruchy, greeter/mod.ruchy, greeter.rchy
```

---

## What Actually Works

### Working Example

```ruchy
// File: test-working.ruchy
// No macros, no modules

fun add(a: i32, b: i32) -> i32 {
    a + b
}

fun main() {
    let x = add(2, 3);
    let y = x * 4;
}
```

### Compilation Results

```bash
# Debug build (with symbols)
$ ruchy compile --output test test-working.ruchy
✓ Successfully compiled to: test
ℹ Binary size: 3904968 bytes (3.8MB)

# Release build (stripped)
$ ruchy compile --strip --output test test-working.ruchy
✓ Successfully compiled to: test
ℹ Binary size: 354680 bytes (347KB)

# Performance
$ time ./test
./test  0.00s user 0.00s system 81% cpu 0.001 total  # 1ms!
```

**Binary Quality** ✅:
- Debug: 3.8MB (with symbols)
- Release: **347KB** (stripped)
- Execution: **1ms**
- Format: Proper ELF 64-bit

---

## Expected vs Actual Behavior

### Expected

`ruchy compile` should support all interpreter features:
- Macro invocations (println!, format!, etc.)
- Module imports (use statements)
- Full standard library access
- Produce standalone binaries

### Actual

- ✅ **Interpreter**: Everything works
- ❌ **Compilation**: Crashes on macros and modules
- ⚠️ **Transpilation**: Fails with "Unsupported expression kind"
- ✅ **Binary Output**: Excellent when it works

---

## What This Blocks

### Immediate Impact

**RUC-007 (Diagnostics CLI)**: Cannot compile to standalone binary
- Needs `println!` for output
- Uses `diagnostics` module via `use`
- Must distribute as interpreted script

**All CLI Tools**: Compilation blocked
- All require console I/O (`println!`)
- Most use modules for organization

### Project Impact

- **Production deployment**: Blocked - no standalone binaries
- **Distribution**: Must ship interpreter + source code
- **Performance**: Cannot test optimized binaries
- **User experience**: Requires Ruchy installation

---

## Requested Enhancements

### Priority 1: Macro Transpilation

Implement macro support in transpiler:
```ruchy
println!("Hello");  // → println!("Hello");  (pass through to Rust)
format!("{}",  x);   // → format!("{}", x);   (pass through to Rust)
```

Most macros can pass through directly to generated Rust code.

### Priority 2: Module Bundling

Implement module resolution for compilation:
- Resolve `use` statements at compile time
- Bundle imported modules into transpiled output
- Support same module search paths as interpreter
- Generate single Rust file or proper Rust project structure

### Nice to Have

- `--release` flag for optimized builds
- Currently `--strip` produces excellent 347KB binaries
- Consider cargo-like optimization levels

---

## Workarounds

### Attempted Workarounds

1. ❌ **Remove println!**: Cannot - need output for CLI tools
2. ❌ **Inline modules**: Not practical - defeats modularity
3. ❌ **Use interpreter**: Works but can't distribute binaries

### Current Solution

**Use interpreter mode only**:
- Full feature support
- Works perfectly for development
- Cannot create standalone binaries
- Requires Ruchy installation on target systems

---

## Test Cases for Verification

### Test 1: Basic println!

```ruchy
fun main() {
    println!("Hello");
}
```

**Expected**: Compiles successfully
**Actual**: "Unsupported expression kind: MacroInvocation"

### Test 2: format! macro

```ruchy
fun main() {
    let msg = format!("Value: {}", 42);
    println!("{}", msg);
}
```

**Expected**: Compiles successfully
**Actual**: "Unsupported expression kind: MacroInvocation" (first line)

### Test 3: Module import

```ruchy
use mymodule;

fun main() {
    mymodule::do_something();
}
```

**Expected**: Compiles with module bundled
**Actual**: "Failed to find module 'mymodule'"

### Test 4: Combined (macros + modules)

```ruchy
use diagnostics;

fun main() {
    let report = diagnostics::generate_report();
    println!("Report: {:?}", report);
}
```

**Expected**: Compiles successfully with both features
**Actual**: Fails on module resolution (fails before checking macros)

---

## Architecture Analysis

### Transpilation Pipeline

```
Ruchy Source → Parser → AST → Transpiler → Rust Code → rustc → Binary
                                    ↑
                              FAILS HERE
```

**Current transpiler**:
- ✅ Handles basic syntax (functions, structs, enums)
- ✅ Handles control flow (match, if, while)
- ❌ Does NOT handle macro invocations
- ❌ Does NOT resolve module imports

### Suggested Fix

**For macros**:
```rust
// In transpiler
match expr {
    MacroInvocation { name, args } => {
        // Simple pass-through to Rust
        format!("{}!({}))", name, transpile_args(args))
    }
}
```

**For modules**:
```rust
// In transpiler
1. Collect all `use` statements
2. Recursively load imported modules
3. Transpile all modules
4. Generate Rust mod structure or single file
```

---

## Comparison with Other Languages

| Language | Macro Compilation | Module Compilation | Binary Size |
|----------|-------------------|-------------------|-------------|
| **Rust** | ✅ Full support | ✅ Full support | ~500KB-2MB |
| **Go** | N/A (no macros) | ✅ Full support | ~1-2MB |
| **Zig** | ✅ Comptime | ✅ Full support | ~100KB-1MB |
| **Ruchy** | ❌ Not supported | ❌ Not supported | 347KB when it works ✅ |

Ruchy has excellent binary characteristics but needs feature parity.

---

## Priority Justification

### CRITICAL Severity Because:

1. **Blocks production use**: Cannot ship standalone binaries
2. **Fundamental features**: Macros and modules are core language features
3. **Works in interpreter**: Inconsistency between modes is confusing
4. **No workaround**: Cannot achieve same functionality differently
5. **Industry standard**: All systems languages compile macros/modules

### Impact on ubuntu-config-scripts Project:

- **17 modules complete**: All use `println!` and `use` statements
- **0 can compile**: Every module blocked
- **Must ship interpreted**: Requires Ruchy on target systems
- **Distribution blocked**: Cannot create standalone tools

---

## References

- **Upstream Issue**: https://github.com/paiml/ruchy/issues/103
- **Rust Macros**: https://doc.rust-lang.org/book/ch19-06-macros.html
- **Rust Modules**: https://doc.rust-lang.org/book/ch07-00-managing-growing-projects-with-packages-crates-and-modules.html
- **RUC-007**: Diagnostics CLI (blocked by this issue)

---

## Current Status

**Workaround Implemented**: ✅ Use interpreter mode only
**Binary Compilation**: ❌ Blocked for all real programs
**Development Impact**: High - cannot test optimized binaries
**Production Impact**: **CRITICAL** - cannot ship standalone tools

---

## Priority

**CRITICAL**: Blocks all production binary compilation. Ruchy's value proposition includes "compile to fast binaries" but this is currently non-functional for real programs.

---

**Filed By**: Claude (RUC-007 Development)
**Discovered**: 2025-10-31 during CLI tool implementation
**Next Steps**: Await transpiler enhancements for macros and modules

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
