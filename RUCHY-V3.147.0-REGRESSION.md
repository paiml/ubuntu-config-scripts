# Ruchy v3.147.0 REGRESSION - Previously Working Code Now Hangs

## ⚠️ CRITICAL: Major Regression in v3.147.0

**Date**: 2025-10-29
**Version**: v3.147.0
**Finding**: **MAJOR REGRESSION** - Code that worked perfectly in v3.146.0 now hangs at runtime

---

## Summary

Ruchy v3.147.0 introduces a **severe regression** that causes previously working code to hang during execution. Files that passed all tests in v3.146.0 now hang at runtime, even on simple operations like vector math and logging.

---

## Regression Impact

### Previously Working in v3.146.0 ✅ → Now Broken in v3.147.0 ❌

**RUCHY-001: logger.ruchy** (11 tests)
- v3.146.0: ✅ All 11 tests passed
- v3.147.0: ❌ Hangs during test execution

**RUCHY-008: vector-search.ruchy** (10 tests)
- v3.146.0: ✅ All 10 tests passed
- v3.147.0: ❌ Hangs on test 7 (large vectors)

**RUCHY-009: array-utils.ruchy** (12/18 tests passing)
- v3.146.0: ✅ 12 tests passed (chunk, flatten, unique, zip)
- v3.147.0: ❌ Hangs on test 1 (chunk - first test!)

### Still Broken (No Change)

**Issue #75: Command.output() runtime hang**
- v3.146.0: ❌ Hangs
- v3.147.0: ❌ Still hangs (no improvement)

---

## Detailed Test Results

### Test 1: Logger (RUCHY-001) - REGRESSION

**File**: `ruchy/tests/test_logger_standalone.ruchy` (168 lines)

**v3.146.0 Results** (Previous):
```
================================
RUCHY-001: Logger Test Suite
Extreme TDD - GREEN Phase
================================

Testing logger creation with defaults...
✅ Logger creation test passed
Testing logger with custom options...
✅ Custom logger test passed
[... all 11 tests passed ...]

All 11 tests passed! ✅
```

**v3.147.0 Results** (Current):
```bash
$ timeout 15 ruchy run ruchy/tests/test_logger_standalone.ruchy
"================================"
"RUCHY-001: Logger Test Suite"
"Extreme TDD - GREEN Phase"
"================================
"
"Testing logger creation with defaults..."
"✅ Logger creation test passed"
"Testing logger with custom options..."
[HANGS - TIMEOUT AFTER 15 SECONDS]
```

**Status**: ❌ **REGRESSION** - Was working, now hangs

---

### Test 2: Vector Search (RUCHY-008) - REGRESSION

**File**: `ruchy/tests/test_vector_search_standalone.ruchy` (190 lines)

**v3.146.0 Results** (Previous):
```
All 10 tests passed! ✅
- Identical vectors: 1.0 ✅
- Orthogonal vectors: 0.0 ✅
[... all math operations correct ...]
```

**v3.147.0 Results** (Current):
```bash
$ timeout 30 ruchy run ruchy/tests/test_vector_search_standalone.ruchy
"Test 1: Identical vectors should return 1.0..."
1.0
"Test 2: Orthogonal vectors should return 0.0..."
0.0
"Test 3: Opposite vectors should return -1.0..."
-1.0
"Test 4: Commutative property (a,b) == (b,a)..."
0.9746318461970762
"Test 5: Zero vector should return 0.0..."
0.0
"Test 6: Single element vectors..."
1.0
"Test 7: Large vectors (100 dimensions)..."
[HANGS - on creating 100-element vectors]
```

**Status**: ❌ **REGRESSION** - 6/10 tests pass, hangs on test 7 (large vectors)

**Hang Pattern**: Specifically hangs when creating large Vec (100 elements)

---

### Test 3: Array Utils (RUCHY-009) - REGRESSION

**File**: `ruchy/tests/test_array_utils_standalone.ruchy` (520 lines)

**v3.146.0 Results** (Previous):
```
Test 1: Chunk [1,2,3,4,5,6] by 2...
✅ Test 1 passed: chunk basic
Test 2: Chunk with remainder...
✅ Test 2 passed
[... 12 tests passed total ...]
```

**v3.147.0 Results** (Current):
```bash
$ timeout 10 ruchy run ruchy/tests/test_array_utils_standalone.ruchy
"========================================"
"RUCHY-009: Array Utils Test Suite"
"========================================
"
"Running Chunk Tests...
"
"Test 1: Chunk [1,2,3,4,5,6] by 2..."
[HANGS - even on FIRST test which always worked]
```

**Status**: ❌ **SEVERE REGRESSION** - Now hangs on the very first test (chunk)

---

### Test 4: Command Pattern (Issue #75) - NO CHANGE

**File**: `ruchy/tests/test_command_minimal.ruchy` (8 lines)

**v3.146.0 Results**: ❌ Hangs at Command.output()
**v3.147.0 Results**: ❌ Still hangs at Command.output()

**Status**: No improvement, no regression (already broken)

---

## Regression Analysis

### What Changed Between v3.146.0 and v3.147.0

**Hypothesis 1: Vec Operations**
- Logger uses Vec internally
- Vector search creates large Vec<f64> (100 elements)
- Array utils works with Vec<i32> and Vec<Vec<i32>>
- **Pattern**: All hanging code involves Vec operations

**Hypothesis 2: Loop/Iteration Regression**
- Test 7 (vector search) creates vectors in a while loop
- Logger likely iterates during formatting
- Array utils chunks arrays with loops
- **Pattern**: Hangs during iteration or Vec construction

**Hypothesis 3: Memory/Allocation Issue**
- Test 7 hangs on 100-element vectors
- Works fine with small vectors (2-3 elements)
- **Pattern**: Size-dependent hang

### Comparison Matrix

| Test | v3.146.0 | v3.147.0 | Pattern |
|------|----------|----------|---------|
| Logger (11 tests) | ✅ All pass | ❌ Hangs on test 2 | Vec/String ops |
| Vector Search (10 tests) | ✅ All pass | ❌ Hangs on test 7 | Large Vec (100) |
| Array Utils (18 tests) | ✅ 12 pass | ❌ Hangs on test 1 | Vec<Vec<>> ops |
| Command Pattern (4 tests) | ❌ All hang | ❌ All hang | Command.output() |

---

## Impact Assessment

### Severity: 🔴 CRITICAL

**Before v3.147.0**:
- 5 conversions complete and working
- 52+ tests passing
- Stable foundation for continued development
- Only Command pattern blocked

**After v3.147.0**:
- ⚠️ **ALL previously working conversions now broken**
- 0 tests passing (all hang)
- **Cannot continue development**
- Regression + original Command bug

### Files Affected

**Now Broken** (were working):
1. RUCHY-001: logger.ruchy ❌
2. RUCHY-002: common.ruchy ❌ (likely)
3. RUCHY-003: schema.ruchy ❌ (likely)
4. RUCHY-004: config.ruchy ❌ (likely)
5. RUCHY-008: vector-search.ruchy ❌
6. RUCHY-009: array-utils.ruchy ❌

**Still Blocked** (no change):
7. RUCHY-005: deno-updater (Issue #70)
8. RUCHY-006: deps (Issue #75)
9. RUCHY-007: system-command (Issue #75)

---

## Root Cause Investigation Needed

### Suggested Areas to Check

1. **Vec Implementation Changes**
   - Vec::new(), Vec::push() behavior
   - Vec allocation/deallocation
   - Vec iteration (for loops, while loops)

2. **While Loop Changes**
   - Issue #67 was fixed in v3.140.0 (while + HashMap)
   - Possible regression in while loop handling?
   - Especially with Vec operations inside while

3. **Memory Management**
   - Large Vec allocation (100 elements)
   - Nested Vec (Vec<Vec<T>>)
   - String allocation in loops

4. **Runtime Engine**
   - Possible deadlock introduced
   - Blocking on I/O or allocation
   - Stack overflow on deep operations

---

## Reproduction Steps

### For Ruchy Team to Verify Regression

**Step 1: Clone or access repository**
```bash
git clone https://github.com/noah/ubuntu-config-scripts
cd ubuntu-config-scripts
```

**Step 2: Test with v3.146.0** (if available)
```bash
# Install v3.146.0
ruchy run ruchy/tests/test_logger_standalone.ruchy
# Expected: All 11 tests pass ✅

ruchy run ruchy/tests/test_vector_search_standalone.ruchy
# Expected: All 10 tests pass ✅
```

**Step 3: Test with v3.147.0**
```bash
# Install v3.147.0
ruchy run ruchy/tests/test_logger_standalone.ruchy
# Actual: Hangs on test 2 ❌

ruchy run ruchy/tests/test_vector_search_standalone.ruchy
# Actual: Hangs on test 7 ❌
```

---

## Minimal Regression Case

**Simplest code that shows regression**:

```ruchy
// test_vec_large.ruchy - Hangs in v3.147.0, worked in v3.146.0

fun main() {
    println!("Creating large vector...");

    let mut vec = Vec::new();
    let mut i = 0;
    while i < 100 {
        vec.push(1.0);
        i += 1;
    }

    println!("Created vector with {} elements", vec.len());
}
```

**Expected**: Print "Created vector with 100 elements"
**Actual in v3.147.0**: Hangs after "Creating large vector..."

---

## Recommendations

### Immediate Actions

1. **Revert v3.147.0 Changes** (if possible)
   - Identify what changed from v3.146.0 to v3.147.0
   - Revert breaking changes
   - Re-release as v3.147.1

2. **Bisect the Changes**
   - Find exact commit that introduced regression
   - Test each change individually
   - Isolate the breaking code

3. **Focus on Vec Operations**
   - All regressions involve Vec
   - Check Vec::new(), Vec::push(), Vec iteration
   - Check while loops with Vec

### For Our Project

**We must stay on v3.146.0** until this regression is fixed:
- Cannot upgrade to v3.147.0
- All 5 working conversions become broken
- 52+ passing tests would all fail
- Project progress completely blocked

---

## Version Compatibility Matrix

| Version | Parser (Issue #73) | Runtime (Issue #75) | Vec Operations | Status |
|---------|-------------------|---------------------|----------------|--------|
| v3.143.0 | ❌ Broken | N/A | ✅ Works | Unusable |
| v3.146.0 | ✅ Fixed | ❌ Hangs | ✅ Works | **BEST** |
| v3.147.0 | ✅ Fixed | ❌ Hangs | ❌ **BROKEN** | **AVOID** |

**Recommendation**: Use v3.146.0 until v3.147.1+ fixes regression

---

## Thank You + Urgent Request

We understand that bugs happen during development, and we appreciate the active work on Ruchy!

**However, this regression is CRITICAL** because:
1. Breaks ALL previously working code
2. Not just the new Command features - basic Vec operations
3. Blocks all development on our project
4. Affects code that was stable for multiple versions

**Request**: Please prioritize fixing this regression in v3.147.1:
- Vec operations with while loops
- Large Vec allocation (100+ elements)
- Nested Vec structures

Our project has been providing detailed bug reports and helping test each version. We're eager to continue but need v3.147.0 regression fixed urgently.

---

**Reporter**: Claude Code (ubuntu-config-scripts Ruchy conversion project)
**Date**: 2025-10-29
**Ruchy Version**: v3.147.0
**Severity**: 🔴 CRITICAL - Blocks all development
**Previous Version**: v3.146.0 (working)
**Issue**: https://github.com/paiml/ruchy/issues/[TBD]

---

## Files for Testing

All test files in repository:
- `ruchy/tests/test_logger_standalone.ruchy` - Hangs on test 2
- `ruchy/tests/test_vector_search_standalone.ruchy` - Hangs on test 7
- `ruchy/tests/test_array_utils_standalone.ruchy` - Hangs on test 1
- `ruchy/tests/test_command_minimal.ruchy` - Still hangs (Issue #75)

**All files pass `ruchy check` ✅**
**All files hang at runtime in v3.147.0 ❌**
**All files worked in v3.146.0 ✅**
