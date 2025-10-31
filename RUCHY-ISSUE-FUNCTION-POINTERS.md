# Ruchy Issue: Function Pointers Not Implemented

**Issue Type**: Missing Language Feature
**Severity**: BLOCKS RUCHY-005 (Deno Updater conversion)
**Discovered**: 2025-10-28 during Extreme TDD RED phase
**Context**: ubuntu-config-scripts TypeScript→Ruchy conversion project

## Problem Statement

Ruchy does not support function pointer syntax (`fn()` type), which is required for higher-order functions like test runners.

## Minimal Reproduction

```ruchy
// File: /tmp/test_fn_pointer.ruchy
fun hello() {
    println!("Hello");
}

fun run_test(test_fn: fn(), passed: &mut i32) {
    test_fn();
    *passed += 1;
}

fun main() {
    let mut count = 0;
    run_test(hello, &mut count);
    println!("Count: {}", count);
}
```

**Error**:
```
✗ /tmp/test_fn_pointer.ruchy:7: Syntax error: Expected Arrow, found Comma
Error: /tmp/test_fn_pointer.ruchy:7: Syntax error: Expected Arrow, found Comma
```

## Expected Behavior

The code should:
1. Parse `fn()` as a function pointer type annotation
2. Allow passing function names as arguments
3. Allow calling function pointers via `test_fn()`

## Root Cause Analysis (Five Whys)

1. **Why does parsing fail?**
   - Parser expects `->` after `test_fn: fn()`, suggesting it's treating `fn` as a regular identifier

2. **Why is `fn` treated as identifier?**
   - The `fn()` function pointer type syntax is not implemented in the parser

3. **Why is this feature missing?**
   - Function pointers are advanced Rust feature, may not have been prioritized yet

4. **Why does this block RUCHY-005?**
   - Test runner pattern requires passing test functions to `run_test()` helper

5. **Why is test runner pattern required?**
   - Industry best practice for modular test suites with shared reporting logic

## Impact

**Blocked Conversions**:
- ✅ RUCHY-001 Logger: Complete (no function pointers needed)
- ✅ RUCHY-002 Common: Complete (no function pointers needed)
- ✅ RUCHY-003 Schema: Complete (no function pointers needed)
- 🚫 RUCHY-004 Config: BLOCKED (GitHub Issue #68 - different blocker)
- 🚫 RUCHY-005 Deno Updater: BLOCKED (this issue)

**Workaround Options**:
1. ❌ Use macro-based test runner (Ruchy doesn't have macros yet)
2. ❌ Inline all test logic in main() (violates DRY principle)
3. ✅ Simplify test file to call tests directly without helper (TEMPORARY)
4. ✅ Implement function pointer feature (CORRECT - Stop The Line)

## Proposed Solution

Following CLAUDE.md mandate:
> **IF YOU DISCOVER A LANGUAGE FEATURE IS "NOT IMPLEMENTED" - IMPLEMENT IT, DON'T SKIP IT!**

### Implementation Plan (Extreme TDD):

**1. RED Phase** - Write failing tests:
```rust
// tests/parser_085_function_pointers.rs
#[test]
fn test_parse_function_pointer_type() {
    let code = "fun run(f: fn()) {}";
    assert!(Parser::new(code).parse().is_ok());
}

#[test]
fn test_parse_function_pointer_with_args() {
    let code = "fun run(f: fn(i32) -> i32) {}";
    assert!(Parser::new(code).parse().is_ok());
}

#[test]
fn test_call_function_pointer() {
    let code = r#"
        fun add(a: i32, b: i32) -> i32 { a + b }
        fun apply(f: fn(i32, i32) -> i32, x: i32, y: i32) -> i32 {
            f(x, y)
        }
        fun main() {
            let result = apply(add, 5, 3);
            println!("{}", result);
        }
    "#;
    assert_transpile_and_run!(code, "8");
}
```

**2. GREEN Phase** - Minimal implementation:
- Add `FunctionPointer` variant to `Type` enum
- Update parser to recognize `fn(...)` -> `Type` syntax
- Update transpiler to convert to Rust `fn(...)` type
- Support calling function pointers in interpreter

**3. REFACTOR Phase** - Quality gates:
- Complexity ≤10 per CLAUDE.md
- Property tests for function pointer parsing
- Integration with existing type system

## Rust Reference

Function pointer syntax in Rust:
```rust
// Type annotation
fn apply_op(f: fn(i32, i32) -> i32, a: i32, b: i32) -> i32 {
    f(a, b)
}

// Usage
fn add(x: i32, y: i32) -> i32 { x + y }
let result = apply_op(add, 5, 3); // 8
```

## Testing Requirements

**Must Pass**:
- Parser tests: fn() types parse correctly
- Transpiler tests: fn() types translate to Rust
- Interpreter tests: fn pointers can be called
- Integration tests: Full examples work end-to-end
- Property tests: Type checking invariants hold
- 15-tool validation: check, transpile, eval, compile, etc.

## Success Criteria

✅ Function pointer syntax parses correctly
✅ Transpiler generates valid Rust code with fn pointers
✅ Interpreter evaluates function pointer calls
✅ RUCHY-005 test file parses without errors
✅ Property tests verify type system invariants
✅ All 15 tools work with function pointer code

## Timeline Estimate

- **Parser changes**: 30-60 min
- **Type system integration**: 30-45 min
- **Transpiler support**: 45-60 min
- **Interpreter support**: 60-90 min
- **Tests + property tests**: 60-90 min
- **Total**: 4-5 hours

## Related Issues

- GitHub Issue (to be filed): ruchy#69 (Function Pointer Support)
- Depends on: None
- Blocks: RUCHY-005 (Deno Updater conversion)

## Toyota Way Principles Applied

1. **Stop The Line**: Halted RUCHY-005 immediately upon discovering missing feature
2. **Genchi Genbutsu**: Created minimal reproduction to verify issue
3. **Five Whys**: Performed root cause analysis
4. **Jidoka**: Will implement with automated tests to prevent regressions
5. **Kaizen**: Small incremental implementation following TDD

## Next Steps

1. ✅ Document issue (this file)
2. ⏳ File GitHub issue on paiml/ruchy repository
3. ⏳ Add [FEATURE-069] to docs/execution/roadmap.yaml
4. ⏳ Create tests/parser_085_function_pointers.rs (RED phase)
5. ⏳ Implement parser support (GREEN phase)
6. ⏳ Implement transpiler + interpreter support
7. ⏳ REFACTOR: Apply quality gates
8. ⏳ Resume RUCHY-005 with working function pointers

---

**Status**: DOCUMENTED, awaiting GitHub issue creation
**Created**: 2025-10-28
**Updated**: 2025-10-28
