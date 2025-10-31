# Issue #93: Try Operator (?) Not Implemented

**Upstream**: [#97](https://github.com/paiml/ruchy/issues/97) ✅ FILED 2025-10-31
**Date**: 2025-10-30
**Severity**: **HIGH** (blocks ergonomic error handling)
**Status**: ✅ **FIXED IN v3.153.0** 🎉
**Ruchy Version**: v3.152.0 (broken), v3.153.0 (fixed)
**Category**: Language Feature

---

## Summary

The try operator (`?`) for error propagation is not implemented in Ruchy v3.152.0. This forces verbose explicit match statements for all Result types, significantly reducing code ergonomics and readability.

**Error Message**: `Expression type not yet implemented: Try { expr: ... }`

---

## Detailed Description

### Error Message

```
Error: Evaluation error: Runtime error: Expression type not yet implemented: Try { expr: Expr { kind: Call { func: Expr { kind: Identifier("get_uid"), span: Span { start: 1132, end: 1139 }, attributes: [], leading_comments: [], trailing_comment: None }, args: [] }, span: Span { start: 0, end: 0 }, attributes: [], leading_comments: [], trailing_comment: None } }
```

### Trigger Condition

Any use of the `?` operator for error propagation:

```ruchy
fun is_root() -> Result<bool, UserError> {
    let uid = get_uid()?;  // ← Triggers error
    Ok(uid == 0)
}
```

### Expected Behavior

The `?` operator should:
1. Evaluate the expression
2. If Ok(value), unwrap and continue
3. If Err(e), return early with Err(e)

This is standard Rust syntax that Ruchy appears to parse but not evaluate.

---

## Evidence from RUC-013

### Case 1: is_root() function (FAILS)

**File**: `ruchy/src/user.ruchy`
**Code**:
```ruchy
// Check if root
fun is_root() -> Result<bool, UserError> {
    let uid = get_uid()?;  // ← Expression type not yet implemented: Try
    Ok(uid == 0)
}
```

**Command**:
```bash
ruchy bin/test-user.ruchy
```

**Result**:
```
Error: Evaluation error: Runtime error: Expression type not yet implemented: Try
```

### Case 2: get_current_user() function (FAILS)

**Code**:
```ruchy
fun get_current_user() -> Result<UserInfo, UserError> {
    let username = get_username()?;  // ← Would fail here
    let uid = get_uid()?;            // ← Or here

    Ok(UserInfo {
        username: username,
        uid: uid,
        // ...
    })
}
```

### Case 3: Tests that DID work

**Code without `?` operator**:
```ruchy
// TEST 1: Direct call without propagation
match user::get_username() {
    Ok(name) => println!("✓ Username: {}", name),
    Err(e) => println!("✗ Failed: {:?}", e),
}
```

**Result**: ✅ Works correctly
**Output**: `✓ Username: "noah"`

---

## Reproduction Steps

### Minimal Reproduction

**Step 1**: Create test file with try operator

```ruchy
// File: test_try_operator.ruchy

enum TestError {
    Failed(String),
}

fun might_fail() -> Result<i32, TestError> {
    Ok(42)
}

fun use_try_operator() -> Result<i32, TestError> {
    let value = might_fail()?;  // ← Try operator
    Ok(value + 1)
}

fun main() {
    match use_try_operator() {
        Ok(v) => println!("Success: {}", v),
        Err(e) => println!("Error: {:?}", e),
    }
}
```

**Step 2**: Run test

```bash
ruchy test_try_operator.ruchy
```

**Expected**: Should print "Success: 43"
**Actual**: Runtime error: "Expression type not yet implemented: Try"

---

## Impact Analysis

### High Impact ❌

**Blocks**:
- Ergonomic error handling across all modules
- Clean error propagation patterns
- Rust-like code ergonomics

**Forces Workaround**:
- Verbose explicit match statements
- More complex code
- Reduced readability

### Code Comparison

**With `?` operator (desired)**:
```ruchy
fun get_current_user() -> Result<UserInfo, UserError> {
    let username = get_username()?;
    let uid = get_uid()?;
    let gid = get_gid()?;

    Ok(UserInfo {
        username: username,
        uid: uid,
        gid: gid,
    })
}
```
**Lines of code**: 8

**Without `?` operator (current workaround)**:
```ruchy
fun get_current_user() -> Result<UserInfo, UserError> {
    let username = match get_username() {
        Ok(u) => u,
        Err(e) => return Err(e),
    };

    let uid = match get_uid() {
        Ok(u) => u,
        Err(e) => return Err(e),
    };

    let gid = match get_gid() {
        Ok(g) => g,
        Err(e) => return Err(e),
    };

    Ok(UserInfo {
        username: username,
        uid: uid,
        gid: gid,
    })
}
```
**Lines of code**: 24

**Complexity increase**: 3x more LOC, significantly less readable

---

## Current Workarounds

### Workaround 1: Explicit Match

```ruchy
fun is_root() -> Result<bool, UserError> {
    let uid = match get_uid() {
        Ok(u) => u,
        Err(e) => return Err(e),
    };
    Ok(uid == 0)
}
```

**Pros**: Works correctly
**Cons**: Verbose, reduces readability, increases LOC (Issue #92 risk)

### Workaround 2: Helper Function Pattern

```ruchy
fun propagate_uid() -> Result<i32, UserError> {
    match get_uid() {
        Ok(u) => Ok(u),
        Err(e) => Err(e),
    }
}

fun is_root() -> Result<bool, UserError> {
    match propagate_uid() {
        Ok(uid) => Ok(uid == 0),
        Err(e) => Err(e),
    }
}
```

**Pros**: Slightly more organized
**Cons**: Still verbose, adds function call overhead

### Workaround 3: Direct Unwrap (Unsafe)

```ruchy
fun is_root() -> Result<bool, UserError> {
    let uid = get_uid().unwrap();  // ← If unwrap() available
    Ok(uid == 0)
}
```

**Pros**: Concise
**Cons**: Panics on error instead of propagating, loses error handling

---

## Language Feature Status

### Parsing

✅ **Try operator PARSES correctly**
- Code with `?` operator compiles
- AST includes Try expression nodes
- Syntax is recognized

### Evaluation

❌ **Try operator NOT EVALUATED**
- Runtime error: "Expression type not yet implemented"
- Interpreter doesn't handle Try expressions
- Feature incomplete

---

## Test Cases

### Test 1: Basic Try Operator

```ruchy
fun might_fail() -> Result<i32, String> {
    Ok(42)
}

fun use_try() -> Result<i32, String> {
    let value = might_fail()?;
    Ok(value)
}
```

**Expected**: Returns Ok(42)
**Actual**: Runtime error

### Test 2: Error Propagation

```ruchy
fun will_fail() -> Result<i32, String> {
    Err("failed".to_string())
}

fun propagate_error() -> Result<i32, String> {
    let value = will_fail()?;
    Ok(value)
}
```

**Expected**: Returns Err("failed")
**Actual**: Runtime error

### Test 3: Multiple Try Operators

```ruchy
fun chained() -> Result<i32, String> {
    let a = might_fail()?;
    let b = might_fail()?;
    let c = might_fail()?;
    Ok(a + b + c)
}
```

**Expected**: Returns Ok(126)
**Actual**: Runtime error on first `?`

---

## Requested Enhancement

### Short Term (Critical Path)

Implement try operator (`?`) evaluation:
- Unwrap Ok values
- Propagate Err early return
- Match Rust semantics

### Medium Term (Developer Experience)

- Document try operator availability
- Add tests for error propagation patterns
- Ensure consistency with Rust behavior

### Long Term (Completeness)

- Full Result/Option ergonomics
- Try blocks (try { ... })
- Question mark in let statements

---

## Use Cases

### Error Handling in System Utilities

```ruchy
// Common pattern in system administration scripts
fun get_system_status() -> Result<SystemStatus, Error> {
    let cpu = detect_cpu()?;
    let memory = detect_memory()?;
    let disk = get_disk_usage()?;
    let network = get_network_info()?;

    Ok(SystemStatus {
        cpu: cpu,
        memory: memory,
        disk: disk,
        network: network,
    })
}
```

Without `?` operator, this becomes ~40 lines instead of ~10.

### Chained Operations

```ruchy
fun process_user_data() -> Result<UserData, UserError> {
    let username = get_username()?;
    let uid = get_uid()?;
    let groups = get_groups()?;
    let home = get_home_dir()?;

    Ok(UserData::new(username, uid, groups, home))
}
```

### Early Return Pattern

```ruchy
fun validate_and_process() -> Result<(), Error> {
    check_permissions()?;
    validate_input()?;
    process_data()?;
    Ok(())
}
```

---

## References

- RUC-013 Implementation: `/home/noah/src/ubuntu-config-scripts/ruchy/src/user.ruchy`
- Test Case: `/home/noah/src/ubuntu-config-scripts/ruchy/bin/test-user.ruchy`
- Rust Documentation: https://doc.rust-lang.org/book/ch09-02-recoverable-errors-with-result.html#a-shortcut-for-propagating-errors-the--operator

---

## Current Status

**Workaround Implemented**: ✅ Using explicit match statements
**Productivity Impact**: Medium - 2-3x more code for error handling
**Code Quality Impact**: High - Significantly reduced readability
**Blocking**: No critical features blocked, but major ergonomics issue

---

## Priority

**HIGH**: This is a fundamental language feature that significantly impacts:
- Code readability
- Development velocity
- Line count (compounds Issue #92 problems)
- Rust compatibility

---

**Filed By**: Claude (RUC-013 Development)
**Priority**: High (major ergonomics issue)
**Next Steps**: Await upstream implementation of try operator evaluation

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
