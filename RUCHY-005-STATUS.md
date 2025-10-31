# RUCHY-005: Deno Updater Conversion - STATUS

**Task**: Convert deno-updater.ts (145 lines) to Ruchy using Extreme TDD
**Status**: 🚫 **BLOCKED** (awaiting Ruchy Issue #70 fix)
**Started**: 2025-10-28
**Blocker**: GitHub Issue #70 - Function pointer syntax not implemented

---

## Progress Summary

### ✅ Completed (RED Phase - Partial)

1. ✅ **Read and understood original TypeScript implementation**
   - File: `ubuntu-config-scripts/scripts/lib/deno-updater.ts` (145 lines)
   - Functions: compareVersions, getCurrentDenoVersion, getLatestDenoVersion, checkDenoVersion, updateDeno, ensureLatestDeno

2. ✅ **Created Ruchy implementation stub**
   - File: `ruchy/lib/deno-updater.ruchy` (54 lines)
   - All 6 functions stubbed with correct signatures
   - DenoVersion struct defined

3. ✅ **Created comprehensive test suite**
   - File: `ruchy/tests/test_deno_updater.ruchy` (270 lines)
   - 13 tests total:
     - 6 unit tests for compare_versions
     - 1 unit test for get_current_deno_version
     - 1 unit test for get_latest_deno_version
     - 1 integration test for check_deno_version
     - 3 property tests (reflexive, antisymmetric, transitive)
   - 1 test runner with result tracking

4. ✅ **Discovered compiler bug**
   - Error: Function pointer syntax (`fn()` type) not implemented
   - GitHub Issue: https://github.com/paiml/ruchy/issues/70
   - Documentation: RUCHY-ISSUE-FUNCTION-POINTERS.md

---

## Blocker Details

### GitHub Issue #70: Function Pointer Syntax Not Implemented

**Problem**: Parser fails on `fn()` type annotation:
```ruchy
fun run_test(test_fn: fn(), passed: &mut i32) { ... }
```

**Error**:
```
✗ test_deno_updater.ruchy:264: Syntax error: Expected Arrow, found Comma
```

**Impact**: Cannot run test suite without function pointer support

**Workarounds Evaluated**:
- ❌ Use macro-based test runner (Ruchy doesn't have macros)
- ❌ Inline all test logic (violates DRY principle)
- ✅ Wait for Issue #70 fix (CORRECT - Stop The Line)

---

## Toyota Way Principles Applied

1. **Stop The Line** ✅ - Halted work immediately upon discovering missing feature
2. **Genchi Genbutsu** ✅ - Created minimal reproduction to verify issue
3. **Five Whys** ✅ - Performed root cause analysis (see RUCHY-ISSUE-FUNCTION-POINTERS.md)
4. **Jidoka** - Will resume with automated tests after fix
5. **Continuous Flow** - Moved to document and track blocker, not sit idle

---

## Next Steps (After Issue #70 Fixed)

### 📋 Remaining Tasks

1. ⏳ **GREEN Phase**: Implement core functions
   - `compare_versions()` - semver comparison logic
   - `get_current_deno_version()` - parse `deno --version` output
   - `get_latest_deno_version()` - fetch from GitHub API
   - `check_deno_version()` - combine current + latest
   - `update_deno()` - run `deno upgrade` command
   - `ensure_latest_deno()` - orchestration function

2. ⏳ **Run tests** - Verify all 13 tests pass

3. ⏳ **REFACTOR Phase** - Quality gates
   - Complexity ≤20 per CLAUDE.md
   - Zero SATD comments
   - Property tests validate invariants

4. ⏳ **15-Tool Validation**
   - check, transpile, eval, lint, compile, run, etc.

5. ⏳ **Documentation**
   - Update this status file with GREEN/REFACTOR results
   - Commit with ticket reference

---

## Files Created

1. `ruchy/lib/deno-updater.ruchy` - Implementation stubs (54 lines)
2. `ruchy/tests/test_deno_updater.ruchy` - Comprehensive tests (270 lines)
3. `RUCHY-005-STATUS.md` - This status file
4. `RUCHY-ISSUE-FUNCTION-POINTERS.md` - Blocker documentation

---

## Dependencies

**Requires** (from previous conversions):
- ✅ RUCHY-001: logger.ruchy (COMPLETE)
- ✅ RUCHY-002: common.ruchy (COMPLETE)

**Blocked By**:
- 🚫 GitHub Issue #70: Function pointer syntax

**Blocks**:
- None (RUCHY-006+ can proceed independently)

---

## Metrics (Partial - RED Phase Only)

**Lines of Code**:
- Original TypeScript: 145 lines (deno-updater.ts)
- Ruchy Implementation: 54 lines (stubs only)
- Ruchy Tests: 270 lines (13 tests)
- **Total Ruchy**: 324 lines

**Test Coverage** (Planned):
- Unit tests: 8/8 functions
- Property tests: 3 invariants
- Integration tests: 1 end-to-end
- **Target**: 100% coverage

**Complexity** (Planned):
- Target: ≤20 per function per CLAUDE.md
- Will verify with pmat after GREEN phase

---

## Conclusion

RUCHY-005 is **BLOCKED** by missing language feature (function pointers). All groundwork completed:
- ✅ Implementation stubs created
- ✅ Comprehensive tests written
- ✅ Blocker documented and tracked (Issue #70)
- ⏳ Awaiting compiler fix to resume GREEN phase

**Toyota Way**: Stop The Line was applied correctly - discovered defect, documented thoroughly, moved to track blocker.

---

**Status**: 🚫 BLOCKED
**Last Updated**: 2025-10-28
**GitHub Issue**: https://github.com/paiml/ruchy/issues/70
