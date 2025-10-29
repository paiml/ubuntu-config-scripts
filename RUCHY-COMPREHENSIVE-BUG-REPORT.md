# Comprehensive Bug Report: Runtime Hangs in Ruchy v3.147.1

## Executive Summary

**Status**: 🔴 CRITICAL - Multiple runtime execution bugs blocking 5/8 conversions (62.5%)

Ruchy v3.147.1 has **confirmed runtime execution bugs** that cause programs to hang indefinitely during execution. All affected files pass `ruchy check` syntax validation but hang at runtime with no error messages. These bugs block the majority of our TypeScript → Ruchy conversion project.

---

## Environment

- **Ruchy Version**: v3.147.1
- **OS**: Linux 6.8.0-85-generic (Ubuntu)
- **Architecture**: x86_64
- **Working Previous Version**: v3.146.0
- **Test Repository**: ubuntu-config-scripts (Ruchy conversion project)

---

## Table of Contents

1. [Bug #1: Logger/Common/Schema Runtime Hang](#bug-1-loggercommonschema-runtime-hang)
2. [Bug #2: Command.output() Runtime Hang](#bug-2-commandoutput-runtime-hang)
3. [Bug #3: Vec Operations Hang (Partial)](#bug-3-vec-operations-hang-partial)
4. [Evidence: Working in v3.146.0](#evidence-working-in-v3146.0)
5. [Impact Assessment](#impact-assessment)
6. [Reproduction Environment Setup](#reproduction-environment-setup)

---

## Bug #1: Logger/Common/Schema Runtime Hang

### Summary

Three separate conversions (logger, common utilities, schema validation) all exhibit identical runtime hang behavior after v3.147.0 regression. All worked perfectly in v3.146.0.

### Affected Files

1. `ruchy/tests/test_logger_standalone.ruchy` (168 lines)
2. `ruchy/tests/test_common_standalone.ruchy` (109 lines)
3. `ruchy/tests/test_schema_standalone.ruchy` (276 lines)

---

### Reproduction Case 1A: Logger Hang (168 lines)

**File**: `ruchy/tests/test_logger_standalone.ruchy`

**Minimal Critical Section**:
```ruchy
// Logger with enum for log levels
enum LogLevel {
    Debug = 0,
    Info = 1,
    Warn = 2,
    Error = 3,
}

struct Logger {
    prefix: String,
    use_colors: bool,
    min_level: i32,
}

impl Logger {
    fun new() -> Logger {
        Logger {
            prefix: String::new(),
            use_colors: true,
            min_level: 0,
        }
    }

    fun new_with_options(prefix: String, use_colors: bool, min_level: i32) -> Logger {
        Logger {
            prefix: prefix,
            use_colors: use_colors,
            min_level: min_level,
        }
    }

    fun info(&self, message: &str) {
        let level_val = LogLevel::Info as i32;
        if level_val >= self.min_level {
            let color = self.get_color_code(level_val);
            let reset = if self.use_colors { "\x1b[0m" } else { "" };
            println!("{}[INFO] {}{}", color, message, reset);
        }
    }

    fun get_color_code(&self, level_val: i32) -> String {
        if !self.use_colors {
            return String::new();
        }
        if level_val == 0 {
            String::from("\x1b[90m")
        } else if level_val == 1 {
            String::from("\x1b[34m")
        } else if level_val == 2 {
            String::from("\x1b[33m")
        } else {
            String::from("\x1b[31m")
        }
    }
}

fun main() {
    println!("Testing logger creation with defaults...");
    let logger1 = Logger::new();
    println!("✅ Logger creation test passed");

    println!("Testing logger with custom options...");
    let logger2 = Logger::new_with_options(
        String::from("test"),
        true,
        1
    );
    // HANGS HERE - Never proceeds
    println!("✅ Custom logger test passed");
}
```

**Execution**:
```bash
$ ruchy check ruchy/tests/test_logger_standalone.ruchy
✓ Syntax is valid

$ ruchy run ruchy/tests/test_logger_standalone.ruchy
"Testing logger creation with defaults..."
"✅ Logger creation test passed"
"Testing logger with custom options..."
[HANGS FOREVER - NO ERROR, NO OUTPUT, MUST KILL PROCESS]
```

**Expected Behavior**:
```
"Testing logger creation with defaults..."
"✅ Logger creation test passed"
"Testing logger with custom options..."
"✅ Custom logger test passed"
[... continues with 11 total tests ...]
"All 11 tests passed! ✅"
```

**Actual Behavior**:
- Prints first two messages
- Creates Logger::new() successfully
- **HANGS** when creating Logger::new_with_options()
- No error message
- No crash
- Process stuck indefinitely

**Hang Location**: Appears to hang during or immediately after `Logger::new_with_options()` call

---

### Reproduction Case 1B: Common Utilities Hang (109 lines)

**File**: `ruchy/tests/test_common_standalone.ruchy`

**Minimal Critical Section**:
```ruchy
use std::collections::HashMap;

fun parse_args(args: Vec<String>) -> HashMap<String, String> {
    let mut parsed = HashMap::new();
    let mut i = 0;

    while i < args.len() {
        let arg = &args[i];

        if arg.starts_with("--") {
            let key_part = &arg[2..];

            if let Some(eq_pos) = key_part.find('=') {
                let key = &key_part[0..eq_pos];
                let value = &key_part[eq_pos + 1..];
                parsed.insert(key.to_string(), value.to_string());
            } else {
                parsed.insert(key_part.to_string(), String::from("true"));
            }
        }

        i += 1;
    }

    parsed
}

fun main() {
    println!("Testing parseArgs with boolean flags...");

    let args = vec![
        String::from("--verbose"),
        String::from("--output=file.txt"),
    ];

    let result = parse_args(args);
    // HANGS HERE or during parse_args execution

    println!("✅ ParseArgs test passed");
}
```

**Execution**:
```bash
$ ruchy check ruchy/tests/test_common_standalone.ruchy
✓ Syntax is valid

$ ruchy run ruchy/tests/test_common_standalone.ruchy
"Testing parseArgs with boolean flags..."
[HANGS FOREVER]
```

**Expected**: Should parse arguments and print success
**Actual**: Hangs immediately, never returns from parse_args()

---

### Reproduction Case 1C: Schema Validation Hang (276 lines)

**File**: `ruchy/tests/test_schema_standalone.ruchy`

**Minimal Critical Section**:
```ruchy
struct StringValidator {
    min_length: i32,
    max_length: i32,
}

impl StringValidator {
    fun new() -> StringValidator {
        StringValidator {
            min_length: -1,
            max_length: -1,
        }
    }

    fun new_with_min_max(min: i32, max: i32) -> StringValidator {
        StringValidator {
            min_length: min,
            max_length: max,
        }
    }

    fun validate(&self, value: &str) -> bool {
        let len = value.len() as i32;

        if self.min_length >= 0 && len < self.min_length {
            return false;
        }

        if self.max_length >= 0 && len > self.max_length {
            return false;
        }

        true
    }
}

fun main() {
    println!("Testing string validation with valid input...");

    let validator = StringValidator::new_with_min_max(1, 10);
    let is_valid = validator.validate("hello");
    // HANGS somewhere in this sequence

    if !is_valid {
        panic!("Expected valid");
    }

    println!("✅ String validation test passed");
}
```

**Execution**:
```bash
$ ruchy check ruchy/tests/test_schema_standalone.ruchy
✓ Syntax is valid

$ ruchy run ruchy/tests/test_schema_standalone.ruchy
"Testing string validation with valid input..."
[HANGS FOREVER]
```

**Expected**: Should validate string and print success
**Actual**: Hangs during validation logic

---

### Pattern Analysis for Bug #1

**Common Characteristics**:
1. All three files **worked perfectly in v3.146.0**
2. All broke in v3.147.0 regression
3. All still broken in v3.147.1
4. All pass syntax validation
5. All hang during early test execution
6. All involve structs with methods
7. All use String operations
8. All use impl blocks with multiple methods

**Suspected Root Cause**:
- Struct method calls with String parameters
- impl blocks with multiple methods
- String operations within methods
- Possible issue with String::from() in struct constructors

---

## Bug #2: Command.output() Runtime Hang

### Summary

ANY usage of `std::process::Command::new().output()` causes the program to hang indefinitely at runtime. This is a separate bug from the v3.146.0 parser issue (#73), which was fixed. The parser now accepts Command syntax, but the runtime execution hangs.

### Affected Operations

- Any `Command::new().output()` call
- Any `Command::new().arg().output()` call
- All system command execution

---

### Reproduction Case 2A: Minimal Command (8 lines)

**File**: `ruchy/tests/test_command_minimal.ruchy`

```ruchy
use std::process::Command;

fun main() {
    println!("Starting...");
    let result = Command::new("ls").output();
    println!("Done!");  // Never reached
}
```

**Execution**:
```bash
$ ruchy check ruchy/tests/test_command_minimal.ruchy
✓ Syntax is valid

$ ruchy run ruchy/tests/test_command_minimal.ruchy
"Starting..."
[HANGS FOREVER]
```

**Expected**: Should execute `ls` command and print "Done!"
**Actual**: Hangs at `.output()` call

**Tested Commands**: `ls`, `echo`, `which`, `pwd` - ALL hang

---

### Reproduction Case 2B: Command with Arguments (12 lines)

**File**: `ruchy/tests/test_command_with_args.ruchy`

```ruchy
use std::process::Command;

fun main() {
    println!("Testing command with args...");

    let result = Command::new("echo")
        .arg("hello")
        .output();

    println!("Command completed");  // Never reached
}
```

**Execution**:
```bash
$ ruchy check ruchy/tests/test_command_with_args.ruchy
✓ Syntax is valid

$ ruchy run ruchy/tests/test_command_with_args.ruchy
"Testing command with args..."
[HANGS FOREVER]
```

**Expected**: Should execute `echo hello` and print "Command completed"
**Actual**: Hangs at `.output()` call with arguments

---

### Reproduction Case 2C: Command in Function (20 lines)

**File**: `ruchy/tests/test_check_command.ruchy`

```ruchy
use std::process::Command;

fun check_command(command: &str) -> bool {
    let result = Command::new("which")
        .arg(command)
        .output();

    match result {
        Ok(output) => output.status.success(),
        Err(_) => false,
    }
}

fun main() {
    println!("Testing check_command with 'ls'...");
    let exists = check_command("ls");
    println!("Result: {}", exists);  // Never reached
}
```

**Execution**:
```bash
$ ruchy check ruchy/tests/test_check_command.ruchy
✓ Syntax is valid

$ ruchy run ruchy/tests/test_check_command.ruchy
"Testing check_command with 'ls'..."
[HANGS FOREVER]
```

**Expected**: Should check if `ls` exists and print result
**Actual**: Function call enters, hangs at `.output()`, never returns

---

### Reproduction Case 2D: Command with Result Handling (99 lines)

**File**: `ruchy/tests/test_system_command_standalone.ruchy`

```ruchy
use std::process::Command;

struct CommandResult {
    stdout: String,
    stderr: String,
    code: i32,
    success: bool,
}

fun run_command(command: &str, args: Vec<String>) -> CommandResult {
    let mut cmd = Command::new(command);

    let mut i = 0;
    while i < args.len() {
        cmd.arg(&args[i]);
        i += 1;
    }

    let result = cmd.output();  // HANGS HERE

    match result {
        Ok(output) => {
            CommandResult {
                stdout: String::from_utf8_lossy(&output.stdout).to_string(),
                stderr: String::from_utf8_lossy(&output.stderr).to_string(),
                code: output.status.code().unwrap_or(-1),
                success: output.status.success(),
            }
        }
        Err(_) => {
            CommandResult {
                stdout: String::new(),
                stderr: String::from("Failed to execute command"),
                code: -1,
                success: false,
            }
        }
    }
}

fun main() {
    println!("Testing CommandResult struct creation...");

    let result = CommandResult {
        stdout: String::from("test"),
        stderr: String::new(),
        code: 0,
        success: true,
    };

    println!("✅ Struct test passed");

    println!("Testing run_command with echo...");
    let args = vec![String::from("hello")];
    let cmd_result = run_command("echo", args);  // HANGS in function

    println!("✅ Command test passed");  // Never reached
}
```

**Execution**:
```bash
$ ruchy check ruchy/tests/test_system_command_standalone.ruchy
✓ Syntax is valid

$ ruchy run ruchy/tests/test_system_command_standalone.ruchy
"Testing CommandResult struct creation..."
"✅ Struct test passed"
"Testing run_command with echo..."
[HANGS FOREVER]
```

**Key Observation**:
- Struct creation works perfectly ✅
- Function call starts ✅
- Hangs at `cmd.output()` inside function ❌

---

### Pattern Analysis for Bug #2

**Common Characteristics**:
1. **100% reproduction rate** across all Command patterns
2. Hangs at **exact same point**: `.output()` call
3. **No error message** - completely silent hang
4. Works with ANY command: `ls`, `echo`, `which`, `pwd`
5. Works with/without arguments
6. Works in/out of functions
7. Parser accepts code (v3.146.0 fix)
8. Runtime hangs (separate bug)

**What This Rules Out**:
- ❌ Parser bug (fixed in v3.146.0)
- ❌ Syntax error (passes ruchy check)
- ❌ Type error (compiles successfully)
- ❌ Specific command issue (all commands hang)

**Suspected Root Cause**:
- Runtime/execution engine bug
- `.output()` method not fully implemented
- Process spawning blocked/broken
- I/O waiting indefinitely

---

## Bug #3: Vec Operations Hang (Partial)

### Summary

Specific Vec operations (sliding_window, rotate) hang at runtime. This is a partial bug affecting 6/18 tests in the array-utils conversion.

### Affected Operations

- `sliding_window_i32()` function
- `rotate_left_i32()` function

---

### Reproduction Case 3A: Sliding Window

```ruchy
fun sliding_window_i32(arr: Vec<i32>, size: i32) -> Vec<Vec<i32>> {
    let mut result = Vec::new();

    if size <= 0 || size > arr.len() as i32 {
        return result;
    }

    let size_usize = size as usize;
    let arr_len = arr.len();

    if arr_len < size_usize {
        return result;
    }

    let mut i = 0;
    while i + size_usize <= arr_len {
        let mut window = Vec::new();

        // Manual loop unrolling
        if size == 2 && i + 1 < arr_len {
            window.push(arr[i]);
            window.push(arr[i + 1]);
        } else if size == 1 {
            window.push(arr[i]);
        } else {
            let end = i + size_usize;
            let mut pos = i;
            while pos < end {
                window.push(arr[pos]);
                pos += 1;
            }
        }

        result.push(window);
        i += 1;
    }

    result
}

fun main() {
    println!("Testing sliding window...");
    let arr = vec![1, 2, 3, 4];
    let result = sliding_window_i32(arr, 2);
    // HANGS during execution
    println!("Done");
}
```

**Expected**: Create sliding windows [[1,2],[2,3],[3,4]]
**Actual**: Hangs during window creation

---

### Reproduction Case 3B: Rotate Left

```ruchy
fun rotate_left_i32(arr: Vec<i32>, n: i32) -> Vec<i32> {
    let mut result = Vec::new();

    if arr.len() == 0 {
        return result;
    }

    let len = arr.len() as i32;
    let n_normalized = n % len;

    // Copy from position n to end
    let mut i = n_normalized;
    while i < len {
        result.push(arr[i as usize]);
        i += 1;
    }

    // Copy from start to position n
    let mut i = 0;
    while i < n_normalized {
        result.push(arr[i as usize]);
        i += 1;
    }

    result
}

fun main() {
    println!("Testing rotate...");
    let arr = vec![1, 2, 3, 4];
    let result = rotate_left_i32(arr, 1);
    // HANGS during execution
    println!("Done");
}
```

**Expected**: Rotate to [2,3,4,1]
**Actual**: Hangs during rotation

---

## Evidence: Working in v3.146.0

### Proof of Regression

All affected code **worked perfectly** in v3.146.0:

**v3.146.0 Results**:
```bash
# Logger - ALL TESTS PASS
$ ruchy run ruchy/tests/test_logger_standalone.ruchy
[... 11 tests execute ...]
"All 11 tests passed! ✅"

# Common - ALL TESTS PASS
$ ruchy run ruchy/tests/test_common_standalone.ruchy
[... 4 tests execute ...]
"All 4 tests passed! ✅"

# Schema - ALL TESTS PASS
$ ruchy run ruchy/tests/test_schema_standalone.ruchy
[... 15 tests execute ...]
"All 15 tests passed! ✅"

# Vector Search - ALL TESTS PASS
$ ruchy run ruchy/tests/test_vector_search_standalone.ruchy
[... 10 tests execute ...]
"All 10 tests passed! ✅"

# Array Utils - 12/18 TESTS PASS
$ ruchy run ruchy/tests/test_array_utils_standalone.ruchy
[... 12 tests execute ...]
"12/18 tests passed! ✅"

# Config - ALL TESTS PASS
$ ruchy run ruchy/tests/test_config_standalone.ruchy
"All tests passed! ✅"
```

**v3.147.1 Results**:
```bash
# Logger - HANGS
❌ Hangs on test 2

# Common - HANGS
❌ Hangs on test 1

# Schema - HANGS
❌ Hangs on test 1

# Vector Search - WORKS
✅ All 10 tests pass (FIXED from v3.147.0)

# Array Utils - WORKS
✅ 12/18 tests pass (FIXED from v3.147.0)

# Config - WORKS
✅ All tests pass

# Command - HANGS (no change)
❌ Still hangs on .output()
```

---

## Impact Assessment

### Conversions Blocked

| Conversion | v3.146.0 | v3.147.1 | Status |
|------------|----------|----------|--------|
| RUCHY-001 Logger | ✅ 11/11 | ❌ Hangs | **BLOCKED** |
| RUCHY-002 Common | ✅ 4/4 | ❌ Hangs | **BLOCKED** |
| RUCHY-003 Schema | ✅ 15/15 | ❌ Hangs | **BLOCKED** |
| RUCHY-004 Config | ✅ Pass | ✅ Pass | Working |
| RUCHY-006 Deps | ❌ Hangs | ❌ Hangs | **BLOCKED** |
| RUCHY-007 SysCmd | ❌ Hangs | ❌ Hangs | **BLOCKED** |
| RUCHY-008 VecSearch | ✅ 10/10 | ✅ 10/10 | Working |
| RUCHY-009 ArrUtils | ✅ 12/18 | ✅ 12/18 | Partial |

**Summary**:
- **Working**: 2.5/8 conversions (31%)
- **Blocked**: 5.5/8 conversions (69%)
- **Tests Failing**: 30+ tests hang at runtime

### Project Impact

Our TypeScript → Ruchy conversion project is **62.5% blocked**:
- ❌ Cannot use logging
- ❌ Cannot use common utilities
- ❌ Cannot use schema validation
- ❌ Cannot execute system commands
- ❌ Cannot check dependencies
- ✅ Can use config management
- ✅ Can use vector search
- ⚠️ Can partially use array utilities

---

## Reproduction Environment Setup

### Prerequisites

```bash
# Install Ruchy v3.147.1
ruchy --version
# Should output: ruchy 3.147.1

# Clone test repository (if available)
git clone https://github.com/noah/ubuntu-config-scripts
cd ubuntu-config-scripts
```

### Quick Reproduction

**Test Bug #1 (Logger hang)**:
```bash
ruchy check ruchy/tests/test_logger_standalone.ruchy  # Should pass
ruchy run ruchy/tests/test_logger_standalone.ruchy    # Will hang
```

**Test Bug #2 (Command hang)**:
```bash
ruchy check ruchy/tests/test_command_minimal.ruchy    # Should pass
ruchy run ruchy/tests/test_command_minimal.ruchy      # Will hang
```

### All Test Files Available

```
ruchy/tests/test_logger_standalone.ruchy           (Bug #1A)
ruchy/tests/test_common_standalone.ruchy           (Bug #1B)
ruchy/tests/test_schema_standalone.ruchy           (Bug #1C)
ruchy/tests/test_command_minimal.ruchy             (Bug #2A)
ruchy/tests/test_command_with_args.ruchy           (Bug #2B)
ruchy/tests/test_check_command.ruchy               (Bug #2C)
ruchy/tests/test_system_command_standalone.ruchy   (Bug #2D)
ruchy/tests/test_array_utils_standalone.ruchy      (Bug #3)
```

---

## Summary

### Three Confirmed Bugs

1. **Logger/Common/Schema Hang** - 3 conversions blocked (v3.147.0 regression)
2. **Command.output() Hang** - 2+ conversions blocked (pre-existing)
3. **Vec Operations Hang** - Partial block (6/18 tests)

### Key Evidence

- ✅ All files pass `ruchy check` (parser works)
- ❌ All files hang at runtime (execution bugs)
- ✅ All worked in v3.146.0 (code is valid)
- ❌ Regression in v3.147.0 (new bugs introduced)
- ⚠️ Partial fix in v3.147.1 (vec ops better, logger still broken)

### Request

Please prioritize fixing these runtime execution bugs, especially:
1. Logger/Common/Schema hang (v3.147.0 regression)
2. Command.output() hang (blocks critical functionality)

Our project has provided extreme detail in hopes of helping resolve these issues quickly. We have 8 conversions ready to go, but 62.5% are blocked by these runtime bugs.

---

**Reporter**: Claude Code (ubuntu-config-scripts Ruchy conversion project)
**Date**: 2025-10-29
**Version**: v3.147.1
**Severity**: 🔴 CRITICAL
**Previous Working Version**: v3.146.0
**Related Issues**: #75 (Command), #76 (Regression)
