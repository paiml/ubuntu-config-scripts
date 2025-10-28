# Ruchy Syntax Issues - Blocking RUCHY-002 GREEN Phase

## Summary

Encountering persistent "Expected RightBrace, found Let" errors when implementing common utilities in pure Ruchy. Error messages point to end-of-file with incorrect line numbers, making debugging difficult.

## Environment

```bash
$ ruchy --version
ruchy 3.139.0

$ uname -a
Linux 6.8.0-85-generic #85-Ubuntu x86_64 GNU/Linux
```

## Issue 1: While Loop with HashMap Insert

### Minimal Reproduction

File: `ruchy/lib/parse_args_minimal.ruchy`

```ruchy
use std::collections::HashMap;

fun parse_args(args: Vec<String>) -> HashMap<String, String> {
    let mut parsed = HashMap::new();
    let mut i = 0;

    while i < args.len() {
        let arg = &args[i];

        if arg.starts_with("--") {
            let key_part = &arg[2..];
            parsed.insert(key_part.to_string(), String::from("value"));
        }

        i += 1;
    }

    parsed
}

fun main() {
    let test = vec![String::from("--test")];
    let result = parse_args(test);
    println!("Done");
}
```

### Error Output

```
✗ ruchy/lib/parse_args_minimal.ruchy:23: Syntax error: Expected RightBrace, found Let
Error: ruchy/lib/parse_args_minimal.ruchy:23: Syntax error: Expected RightBrace, found Let
```

### Expected Behavior

Code should compile successfully. This is valid Rust-like syntax that Ruchy should support.

### Actual Behavior

- Error at line 23 (beyond end of file - only 22 lines)
- Error message not helpful for identifying actual issue
- Binary search shows error is in the while loop logic

## Issue 2: `&'static str` Return Types

### Status: WORKAROUND FOUND ✅

**Problem**: Functions cannot return `&'static str`
**Solution**: Use `String` return type instead
**Example**:

```ruchy
// ❌ This fails
fun get_color() -> &'static str {
    "\x1b[90m"
}

// ✅ This works
fun get_color() -> String {
    String::from("\x1b[90m")
}
```

## Issue 3: `ruchy run` Timeout

### Minimal Reproduction

File: `ruchy/tests/test_minimal.ruchy`

```ruchy
fun main() {
    println!("Hello from Ruchy");
}
```

### Command

```bash
$ timeout 30 ruchy run ruchy/tests/test_minimal.ruchy
# Times out after 30 seconds with no output
```

### Expected Behavior

Should execute quickly and print "Hello from Ruchy"

### Actual Behavior

- Command hangs indefinitely
- No output produced
- `ruchy check` works fine for same file
- `ruchy transpile` works fine for same file

## Verification Steps Taken

✅ Created minimal reproduction for while loop issue
✅ Tested incremental complexity (works up to certain point)
✅ Checked against rosetta-ruchy examples
✅ Verified simpler constructs work (if/else, for loops with simple bodies)
✅ Confirmed `&'static str` workaround
✅ Binary search to isolate issue location

## Impact

**BLOCKS**:
- RUCHY-002 GREEN: Cannot implement `parse_args` function
- RUCHY-002 GREEN: Cannot test implementations (ruchy run timeout)

**WORKAROUNDS**:
- Issue 2: Use `String` instead of `&'static str` ✅
- Issue 1: No workaround found yet
- Issue 3: Can validate via `ruchy check` and `ruchy transpile`

## Files for Testing

All minimal reproductions available in:
- `/home/noah/src/ubuntu-config-scripts/ruchy/lib/common_green.ruchy` (full context)
- `/home/noah/src/ubuntu-config-scripts/ruchy/tests/test_minimal.ruchy` (ruchy run issue)

## Request

1. **While loop + HashMap**: Guidance on correct syntax or fix for Issue 1
2. **ruchy run timeout**: Investigation into why execution hangs (Issue 3)
3. **Error messages**: Consider improving error messages to show actual problem location

## Workarounds We Can Use

If there are alternative patterns for:
- HashMap insertion in loops
- Parsing command-line arguments
- Testing without `ruchy run`

We can adapt our code accordingly.

---

**Filed**: 2025-10-28
**Project**: Ubuntu Config Scripts Ruchy Conversion
**Repository**: https://github.com/paiml/ubuntu-config-scripts
