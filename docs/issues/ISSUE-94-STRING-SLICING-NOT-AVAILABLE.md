# Issue #94: String Slicing/Indexing Not Available

**Upstream**: [#98](https://github.com/paiml/ruchy/issues/98) ✅ FILED 2025-10-31
**Date**: 2025-10-30
**Severity**: **MEDIUM** (limits string operations)
**Status**: ✅ **FIXED IN v3.153.0** 🎉
**Ruchy Version**: v3.152.0 (broken), v3.153.0 (fixed)
**Category**: Language Feature

---

## Summary

String indexing with ranges (slicing) is not available in Ruchy v3.152.0. Attempts to use `s[start..end]` or `s[start..]` syntax result in runtime error "Cannot index string with range". This significantly limits string manipulation capabilities.

**Error Message**: `Runtime error: Cannot index string with range`

---

## Detailed Description

### Error Message

```
Error: Evaluation error: Runtime error: Cannot index string with range
```

### Trigger Condition

Any attempt to slice a string using range syntax:

```ruchy
let s = "hello";
let first = s[0..1];  // ← Triggers error
let rest = s[1..];     // ← Triggers error
```

### Expected Behavior

String slicing should work like Rust:
- `s[0..1]` - Get substring from index 0 to 1 (exclusive)
- `s[1..]` - Get substring from index 1 to end
- `s[..3]` - Get substring from start to index 3 (exclusive)
- `s[..]` - Get entire string (copy)

This is standard Rust syntax that appears to parse but fails at runtime.

---

## Evidence from RUC-014

### Case 1: capitalize() function (FAILS)

**File**: `ruchy/src/string_utils.ruchy`
**Code**:
```ruchy
fun capitalize(s: String) -> String {
    if s.len() == 0 {
        return s;
    }

    let first = s[0..1].to_string().to_uppercase();  // ← Error
    let rest = s[1..].to_string();                    // ← Would error here too

    first + &rest
}
```

**Command**:
```bash
ruchy bin/test-string-utils.ruchy
```

**Result**:
```
Error: Evaluation error: Runtime error: Cannot index string with range
```

### Case 2: is_numeric() function (WORKS with workaround)

**Workaround Pattern**:
```ruchy
// Instead of: let ch = s[i..i+1];
// Use loop indexing:
let mut i = 0;
while i < s.len() {
    // Access character at index i indirectly
    // But still need way to get individual characters!
    i = i + 1;
}
```

**Problem**: Even the workaround is blocked - cannot access individual characters

---

## Reproduction Steps

### Minimal Reproduction

**Step 1**: Create test file with string slicing

```ruchy
// File: test_string_slicing.ruchy

fun main() {
    let s = "hello world";

    // Test basic slicing
    let first_char = s[0..1];
    println!("First: {}", first_char);

    let rest = s[1..];
    println!("Rest: {}", rest);

    let middle = s[2..5];
    println!("Middle: {}", middle);
}
```

**Step 2**: Run test

```bash
ruchy test_string_slicing.ruchy
```

**Expected**: Should print "First: h", "Rest: ello world", "Middle: llo"
**Actual**: Runtime error: "Cannot index string with range"

---

## Impact Analysis

### Medium Impact ⚠️

**Limits**:
- String manipulation operations
- Character extraction
- Substring operations
- Text parsing

**Common Use Cases Blocked**:
- Capitalize first letter
- Extract prefixes/suffixes
- Parse fixed-width fields
- Character-by-character processing

### Workarounds Available

**Workaround 1: Use split() for specific cases**

```ruchy
// Instead of s[0..1] for first character
let chars = s.split("");
if chars.len() > 0 {
    let first = chars[0];
}
```

**Problem**: `split("")` may not split into individual characters

**Workaround 2: Use chars() iterator (if available)**

```ruchy
let first = s.chars().nth(0)?;
```

**Problem**: Need to verify if `chars()` and `nth()` are available

**Workaround 3: Use take/skip patterns (if available)**

```ruchy
let first = s.chars().take(1).collect();
let rest = s.chars().skip(1).collect();
```

**Problem**: Need to verify iterator methods

---

## Available String Methods

### Confirmed Working
- `s.len()` - string length
- `s.split(delimiter)` - split into Vec<String>
- `s.trim()` - trim whitespace
- `s.to_string()` - clone
- `s.to_uppercase()` / `s.to_lowercase()` - case conversion
- `String::new()` - create empty string
- String concatenation with `+` and `&`

### Not Working
- `s[range]` - string slicing
- Unknown status:
  - `s.chars()` - character iterator
  - `s.char_at(index)` - character at index
  - `s.nth(index)` - nth character

---

## Use Cases Affected

### String Manipulation

```ruchy
// Capitalize: "hello" -> "Hello"
fun capitalize(s: String) -> String {
    let first = s[0..1].to_uppercase();  // ← Blocked
    let rest = s[1..];                     // ← Blocked
    first + &rest
}
```

### Prefix/Suffix Extraction

```ruchy
// Get file extension
fun get_extension(filename: String) -> String {
    let parts = filename.split(".");
    if parts.len() > 1 {
        return parts[parts.len() - 1];  // ← This works
    }
    "".to_string()
}
```

**Note**: Can work around using split() in some cases

### Character Processing

```ruchy
// Check if string is numeric
fun is_numeric(s: String) -> bool {
    let mut i = 0;
    while i < s.len() {
        let ch = s[i..i+1];  // ← Blocked - need single character
        if !ch.is_digit() {
            return false;
        }
        i = i + 1;
    }
    true
}
```

---

## Alternative Approaches

### Investigation Needed

Before filing upstream, need to test if these methods are available:

**Test 1: chars() iterator**
```ruchy
let s = "hello";
let chars_vec = s.chars();  // Does this work?
```

**Test 2: Character at index**
```ruchy
let ch = s.chars().nth(0);  // Does this work?
```

**Test 3: Split into characters**
```ruchy
let chars = s.split("");    // Does this split into chars?
```

If any of these work, we can implement string utilities without slicing.

---

## Current Workarounds for RUC-014

### Workaround Strategy

For RUC-014 (String Utilities), implement functions that don't require slicing:

**Functions That Can Work**:
```ruchy
// These don't need slicing
fun is_empty_or_whitespace(s: String) -> bool {
    s.trim().len() == 0
}

fun word_count(s: String) -> i32 {
    let words = s.split(" ");
    // Count non-empty words
}

fun to_uppercase(s: String) -> String {
    s.to_uppercase()
}
```

**Functions That Need Alternatives**:
```ruchy
// capitalize() - needs first char extraction
// truncate() - needs slicing OR take(n)
// is_numeric() - needs char-by-char check
```

---

## Requested Enhancement

### Short Term (Critical Path)

Implement string slicing:
- Support `s[start..end]` syntax
- Support `s[start..]` and `s[..end]` syntax
- Match Rust semantics

### Medium Term (Alternative)

If slicing is complex, provide alternatives:
- `s.chars()` - character iterator
- `s.char_at(index)` - get character at index
- `s.substring(start, len)` - extract substring

### Long Term (Completeness)

Full string manipulation:
- Slicing with all range types
- Character iteration
- Grapheme cluster support (Unicode)
- Pattern matching

---

## Priority

**MEDIUM**: String slicing is important for text processing but workarounds may exist via:
- split() for some use cases
- chars() iterator (if available)
- Alternative approaches for specific operations

**Impact on RUC-014**: Blocks implementation of:
- capitalize()
- truncate()
- is_numeric()
- Other character-level operations

---

## Next Steps

1. **Test alternatives**:
   - Does `s.chars()` work?
   - Does `s.split("")` give individual characters?
   - Any other string iteration methods?

2. **If alternatives exist**:
   - Document available approaches
   - Implement RUC-014 with workarounds
   - Update string utilities patterns

3. **If no alternatives**:
   - File upstream request for string slicing
   - Implement only functions that don't need slicing
   - Wait for feature implementation

---

**Filed By**: Claude (RUC-014 Development)
**Priority**: Medium (workarounds may exist)
**Next Steps**: Test available string methods, then decide on workaround vs upstream request

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
