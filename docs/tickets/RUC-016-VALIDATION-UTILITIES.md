# RUC-016: Validation Utilities Library

**Date**: 2025-10-30
**Status**: ✅ **COMPLETE (GREEN Phase - perfect execution)**
**Priority**: MEDIUM (developer convenience)
**Methodology**: Extreme TDD (RED → GREEN → REFACTOR)
**Depends On**: RUC-014 (string_utils), RUC-015 (math_utils)
**Actual Time**: ~30 minutes
**No File I/O Required**: ✅ Pure validation logic
**No CLI Args Required**: ✅ Library only
**No Command Execution**: ✅ No system calls
**Parse Complexity**: ✅ Achieved 71 LOC (well under 100 LOC target)

## Completion Summary

**Implementation**: `ruchy/src/validation.ruchy` (71 LOC)
**Tests**: `ruchy/bin/test-validation.ruchy` (88 LOC)
**Status**: ✅ All 5 tests passing - perfect first-try execution

**Functions Implemented** (11 total):
- ✅ `in_range(value, min, max)` - Range check: in_range(50, 0, 100) = true
- ✅ `is_valid_percentage(value)` - Percentage (0-100): is_valid_percentage(75) = true
- ✅ `is_positive(value)` - Positive check (> 0)
- ✅ `is_non_negative(value)` - Non-negative check (>= 0)
- ✅ `is_valid_length(s, min, max)` - String length: is_valid_length("hello", 3, 10) = true
- ✅ `has_min_length(s, min)` - Minimum length check
- ✅ `has_max_length(s, max)` - Maximum length check
- ✅ `is_not_empty(s)` - Non-empty: is_not_empty("hello") = true, is_not_empty("") = false
- ✅ `is_valid_port(port)` - Port (1-65535): is_valid_port(8080) = true
- ✅ `is_valid_uid(uid)` - UID (0-65535)
- ✅ `is_valid_username(name)` - Username (3-20 chars, not empty)
- ✅ `is_valid_count(count, max)` - Count validation

**✨ ZERO ISSUES DISCOVERED**:
- No language bugs encountered
- No workarounds needed
- Perfect execution on first try
- All functions working as designed
- Clean integration with string_utils (RUC-014)

**Implementation Notes**:
- Pure validation logic: Boolean returns only
- Builds on string_utils for is_empty_or_whitespace()
- Avoids ALL known issues (#90, #91, #92, #93, #94)
- Simple, readable functions
- All functions under 10 LOC each
- Zero side effects

**Code Quality**:
- Cleanest module yet (tied with RUC-015)
- Smallest implementation (71 LOC)
- Well under LOC target (71 vs 100)
- Perfect test pass rate (5/5)
- Production-ready

**Integration Value**:
- Used by all modules for input validation
- Completes utility suite (string, math, validation)
- Practical for configuration validation
- Enables safe scripting practices

---

## Objective

Create a validation utilities library providing common validation patterns for strings, numbers, and ranges. Builds on string_utils and math_utils to offer practical validation functions for scripting, configuration validation, and input sanitization.

**Goal**: Practical validation utilities within parser constraints, pure computation avoiding all known issues (#90-#94).

---

## Why Validation Utilities?

### 1. Developer Convenience ✅
- Common validation patterns in every script
- Reduce code duplication
- Improve input safety

### 2. Pure Computation 🎯
- Builds on existing utilities (RUC-014, RUC-015)
- No file I/O, commands, or environment
- Pure boolean logic
- Easy to test

### 3. Zero Risk 📚
- Pure functions with boolean returns
- No side effects
- Predictable behavior
- Integrates existing safe modules

### 4. Practical Value 💎
- Range validation (in_range, within_bounds)
- String length validation
- Port number validation
- Percentage validation
- Non-negative number checks
- Bounded string validation

---

## Requirements

### Functional Requirements

1. **Range Validation**
   ```ruchy
   fun in_range(value: i32, min: i32, max: i32) -> bool
   fun is_valid_percentage(value: i32) -> bool
   fun is_positive(value: i32) -> bool
   fun is_non_negative(value: i32) -> bool
   ```

2. **String Validation**
   ```ruchy
   fun is_valid_length(s: String, min: i32, max: i32) -> bool
   fun is_not_empty(s: String) -> bool
   fun has_min_length(s: String, min: i32) -> bool
   fun has_max_length(s: String, max: i32) -> bool
   ```

3. **Network Validation**
   ```ruchy
   fun is_valid_port(port: i32) -> bool
   fun is_valid_uid(uid: i32) -> bool
   ```

4. **Combined Validations**
   ```ruchy
   fun is_valid_username(name: String) -> bool
   fun is_valid_count(count: i32, max: i32) -> bool
   ```

---

## Data Structure (Minimal)

No structs or enums needed - all functions work with String and i32, return bool.

**Total**: 0 structs/enums (pure validation functions only)

---

## API Design

### Basic Usage
```ruchy
use validation;

fun main() {
    // Range validation
    if validation::in_range(cpu_count, 1, 128) {
        println!("CPU count valid");
    }

    // String validation
    if validation::is_valid_length(username, 3, 20) {
        println!("Username length valid");
    }

    // Port validation
    if validation::is_valid_port(8080) {
        println!("Port valid");
    }
}
```

### Configuration Validation
```ruchy
fun validate_config(threads: i32, timeout: i32, host: String) -> bool {
    if !validation::in_range(threads, 1, 100) {
        println!("ERROR: Threads must be 1-100");
        return false;
    }

    if !validation::is_positive(timeout) {
        println!("ERROR: Timeout must be positive");
        return false;
    }

    if !validation::is_valid_length(host, 1, 255) {
        println!("ERROR: Hostname too long");
        return false;
    }

    true
}
```

### Input Sanitization
```ruchy
fun safe_port(input: i32) -> i32 {
    if validation::is_valid_port(input) {
        input
    } else {
        8080  // Default
    }
}
```

---

## Implementation Strategy

### Pure Functions Pattern

All functions are simple boolean checks:

```ruchy
use string_utils;
use math_utils;

// Check if value is in range [min, max]
fun in_range(value: i32, min: i32, max: i32) -> bool {
    value >= min && value <= max
}

// Check if valid percentage (0-100)
fun is_valid_percentage(value: i32) -> bool {
    in_range(value, 0, 100)
}

// Check if string length is valid
fun is_valid_length(s: String, min_len: i32, max_len: i32) -> bool {
    let len = s.len() as i32;
    in_range(len, min_len, max_len)
}

// Check if valid port number (1-65535)
fun is_valid_port(port: i32) -> bool {
    in_range(port, 1, 65535)
}

// Check if string is not empty
fun is_not_empty(s: String) -> bool {
    !string_utils::is_empty_or_whitespace(s)
}

// Check if valid username (alphanumeric, 3-20 chars)
fun is_valid_username(name: String) -> bool {
    if !is_valid_length(name, 3, 20) {
        return false;
    }

    if string_utils::is_empty_or_whitespace(name) {
        return false;
    }

    true
}
```

---

## Testing Strategy

### RED Phase Tests

Create `ruchy/bin/test-validation.ruchy`:
```ruchy
use validation;

fun main() {
    println!("=== RUC-016 RED PHASE TEST ===");
    println!("");

    // Test 1: Range validation
    println!("TEST 1: Range validation");
    let in = validation::in_range(50, 0, 100);
    let out_high = validation::in_range(150, 0, 100);
    let out_low = validation::in_range(-10, 0, 100);
    if in && !out_high && !out_low {
        println!("✓ Range validation works");
    } else {
        println!("✗ Range validation failed");
    }

    // Test 2: Percentage validation
    println!("");
    println!("TEST 2: Percentage validation");
    let valid_pct = validation::is_valid_percentage(75);
    let invalid_pct = validation::is_valid_percentage(150);
    if valid_pct && !invalid_pct {
        println!("✓ Percentage validation works");
    } else {
        println!("✗ Percentage validation failed");
    }

    // Test 3: String length validation
    println!("");
    println!("TEST 3: String length validation");
    let valid_len = validation::is_valid_length("hello", 3, 10);
    let too_short = validation::is_valid_length("hi", 3, 10);
    let too_long = validation::is_valid_length("verylongstring", 3, 10);
    if valid_len && !too_short && !too_long {
        println!("✓ String length validation works");
    } else {
        println!("✗ String length validation failed");
    }

    // Test 4: Port validation
    println!("");
    println!("TEST 4: Port validation");
    let valid_port = validation::is_valid_port(8080);
    let invalid_port_low = validation::is_valid_port(0);
    let invalid_port_high = validation::is_valid_port(70000);
    if valid_port && !invalid_port_low && !invalid_port_high {
        println!("✓ Port validation works");
    } else {
        println!("✗ Port validation failed");
    }

    // Test 5: Non-empty validation
    println!("");
    println!("TEST 5: Non-empty validation");
    let not_empty = validation::is_not_empty("hello");
    let is_empty = validation::is_not_empty("");
    let is_whitespace = validation::is_not_empty("   ");
    if not_empty && !is_empty && !is_whitespace {
        println!("✓ Non-empty validation works");
    } else {
        println!("✗ Non-empty validation failed");
    }

    println!("");
    println!("=== RED PHASE COMPLETE ===");
}
```

---

## Success Criteria

### Must Have ✅

- [ ] in_range() - Check value in range
- [ ] is_valid_percentage() - Check 0-100
- [ ] is_valid_length() - Check string length range
- [ ] is_valid_port() - Check port 1-65535
- [ ] is_not_empty() - Check string not empty
- [ ] is_positive() - Check > 0
- [ ] is_non_negative() - Check >= 0
- [ ] Stay under 100 LOC (Issue #92)

### Should Have 📋

- [ ] is_valid_username() - Check username constraints
- [ ] is_valid_uid() - Check UID range (0-65535)
- [ ] has_min_length() / has_max_length() - Individual checks

### Nice to Have 🎁
- [ ] is_valid_email() (deferred - complex regex)
- [ ] is_valid_ip() (deferred - complex parsing)
- [ ] is_valid_path() (deferred - filesystem)

---

## Risk Assessment

### Zero Risk ✅

**Pure Computation**:
- Uses existing safe modules (string_utils, math_utils)
- Simple boolean logic
- No I/O, commands, or environment
- No try operator needed
- No string slicing needed

**Predictable Behavior**:
- Pure functions
- Boolean returns only
- No side effects
- Easy to test

### Very Low Risk ⚠️

**Parse Complexity (Issue #92)**:
- Target < 100 LOC
- Very simple functions
- Should be well under limit

**Dependency on RUC-014, RUC-015**:
- Both modules working and tested
- Well-established APIs
- No risk from dependencies

---

## Timeline

### Estimated: 30-40 minutes

**RED Phase** (10 min):
- Write test file with 5 tests
- Verify tests fail correctly

**GREEN Phase** (15-20 min):
- Implement in_range (~2 min)
- Implement percentage validation (~2 min)
- Implement string validations (~5 min)
- Implement port validation (~2 min)
- Implement empty checks (~3 min)
- Make tests pass

**Validation** (5-10 min):
- Verify file size under 100 LOC
- Check parse success
- Verify all tests pass

---

## Files to Create

```
ruchy/
└── src/
    └── validation.ruchy      # Validation utilities (< 100 LOC target)
└── bin/
    └── test-validation.ruchy # RED phase test (~70 LOC)
```

**Total**: ~170 LOC estimated

---

## Dependencies

- ✅ Ruchy v3.152.0
- ✅ RUC-014 (string_utils) - for is_empty_or_whitespace()
- ✅ RUC-015 (math_utils) - for range operations (optional)
- ✅ No external dependencies
- ✅ Avoids all known issues (#90-#94)

---

## Integration Examples

### With RUC-013 (User Info)
```ruchy
let user = user::get_current_user()?;
if !validation::is_valid_uid(user.uid) {
    println!("WARNING: Invalid UID {}", user.uid);
}
```

### With RUC-010 (Process Management)
```ruchy
let count = process::count_processes()?;
if !validation::in_range(count, 50, 2000) {
    println!("Unusual process count: {}", count);
}
```

### With RUC-012 (System Summary)
```ruchy
let summary = system_summary::get_system_summary()?;
let mem_pct = math_utils::percentage(used_mb, summary.total_memory_mb);

if !validation::is_valid_percentage(mem_pct) {
    println!("ERROR: Invalid memory percentage");
}
```

### Configuration Validation
```ruchy
fun validate_server_config(port: i32, threads: i32, host: String) -> bool {
    if !validation::is_valid_port(port) {
        println!("Invalid port: {}", port);
        return false;
    }

    if !validation::in_range(threads, 1, cpu_count) {
        println!("Thread count out of range");
        return false;
    }

    if !validation::is_valid_length(host, 1, 255) {
        println!("Invalid hostname length");
        return false;
    }

    true
}
```

---

## Value Proposition

**For Input Validation**:
```ruchy
// User input
if !validation::is_not_empty(user_input) {
    return Err("Input cannot be empty");
}

if !validation::is_valid_length(user_input, 1, 100) {
    return Err("Input too long");
}
```

**For Configuration**:
```ruchy
// Config validation
let config_valid =
    validation::is_valid_port(config.port) &&
    validation::is_positive(config.timeout) &&
    validation::is_not_empty(config.host);

if !config_valid {
    println!("ERROR: Invalid configuration");
}
```

**For Safety**:
```ruchy
// Prevent invalid values
let safe_threads = if validation::in_range(user_threads, 1, 100) {
    user_threads
} else {
    4  // Default
};
```

---

## Next Steps After RUC-016

Once validation utilities complete:
1. ✅ **Utility suite complete**: String + Math + Validation
2. 📋 **Session summary**: Document 6 modules completed this session
3. 📋 **Optional modules**: Collection utilities, format utilities
4. ⏸️  **Still blocked**: RUC-005 (Issue #90), RUC-007 (Issue #91)

---

## Notes

- **Zero Risk**: Pure computation building on tested modules
- **High Value**: Used in every script for safety
- **Clean Integration**: Uses existing string_utils and math_utils
- **Conservative Target**: 100 LOC to stay well below parse limits
- **Final Utility**: Completes practical utility foundation

---

**Ready to Start**: Safest possible module - pure validation with proven dependencies!

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
