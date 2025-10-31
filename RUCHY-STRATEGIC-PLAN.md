# RUCHY Conversion - Strategic Plan (PMAT-Driven)

## Current Status (2025-10-28)

### ✅ Completed Conversions (3/16)
1. **RUCHY-001: logger.ts → logger.ruchy** ✅
   - Status: GREEN phase complete
   - Lines: 168 → Ruchy implementation
   - Key learnings: Use `String` not `&'static str`, enum casting with `as i32`

2. **RUCHY-002: common.ts → common.ruchy** ✅
   - Status: GREEN phase complete
   - Lines: 168 → Ruchy implementation
   - Key learnings: While loops + HashMap work (post-#67 fix), selective imports

3. **RUCHY-003: schema.ts → schema.ruchy** ✅
   - Status: GREEN phase complete
   - Lines: 250+ → Ruchy validators
   - Key learnings: StringValidator, NumberValidator, BooleanValidator patterns

### 🚫 Blocked Conversions (2/16)
4. **RUCHY-004: config.ts** 🚫
   - Blocker: GitHub Issue #68
   - Problem: Two `&str` parameters + `String` return causes parse error
   - Impact: Cannot implement `get_string(&self, key: &str, default: &str) -> String`
   - Complexity: Bug appears file-size/complexity related

5. **RUCHY-005: deno-updater.ts** 🚫
   - Blocker: GitHub Issue #70
   - Problem: Function pointer syntax `fn()` not implemented
   - Impact: Cannot create test runner with function callbacks
   - Status: Implementation + tests complete, awaiting compiler fix

### 📋 Remaining Conversions (11/16)
6. strict-config.ts
7. deps.ts
8. deps-manager.ts
9. system-command.ts
10. script-analyzer.ts
11. script-repository.ts
12. deploy.ts
13. turso-client.ts
14. database-seeder.ts
15. embedding-generator.ts
16. vector-search.ts

---

## Key Learnings (PMAT Analysis)

### Pattern Recognition

**✅ Working Patterns**:
- Self-contained files (implementation + tests together)
- `String` return types (not `&'static str`)
- Enum comparisons via `as i32` casting
- While loops + HashMap (post-#67 fix)
- Selective `use` imports (avoid bulk imports)
- Methods: `&str + i32 -> String` works fine

**❌ Problematic Patterns**:
- Two `&str` parameters with `String` return (Issue #68)
- Function pointers `fn()` syntax (Issue #70)
- Large files with many methods (may trigger #68)
- Multiple std imports together

### Complexity Metrics

**PMAT Quality Gate Results** (ruchy/ directory):
- Total violations: 8
  - Complexity: 1 violation
  - Dead code: 2 violations
  - Entropy: 1 violation
  - Documentation: 3 violations
  - Provability: 1 violation

**Quality Target** (per CLAUDE.md):
- Complexity ≤20 per function
- 80% test coverage minimum
- Zero SATD comments
- Property-based testing for core logic

---

## Strategic Recommendations

### Option A: Wait for Compiler Fixes (Conservative)
**Pros**:
- Maintains Toyota "Stop The Line" principle
- Ensures quality, no workarounds
- Clear path forward once bugs fixed

**Cons**:
- Blocked on external team (Ruchy maintainers)
- Timeline uncertainty
- Progress stalls

### Option B: Continue with Simpler Files (Pragmatic) ⭐ **RECOMMENDED**
**Pros**:
- Maintains momentum
- Builds on successful patterns
- Identifies additional blockers early
- 11 files remain untouched

**Cons**:
- May hit more compiler bugs
- Need to carefully select "safe" files

**Strategy**:
1. Analyze remaining 11 files for complexity
2. Start with simplest files (fewest dependencies, no advanced features)
3. Use extreme TDD: RED → document blocker if hit → move to next
4. Build up pattern library of what works

### Option C: Focus on TypeScript Quality (Parallel Track)
**Pros**:
- TypeScript codebase still production
- Apply PMAT quality gates to TS
- Improve architecture before conversion

**Cons**:
- Diverts from Ruchy conversion goal
- Doesn't solve compiler blocking issues

---

## PMAT-Driven Action Plan (Option B)

### Phase 1: File Complexity Analysis
Use PMAT to analyze each remaining TypeScript file:
```bash
for file in scripts/lib/*.ts; do
  echo "=== $file ==="
  pmat analyze complexity --project-path $(dirname $file) --file $(basename $file)
done
```

### Phase 2: Prioritization Matrix

**Criteria**:
1. **Simplicity**: Lines of code, cyclomatic complexity
2. **Dependencies**: Does it use logger/common/schema? (we have these)
3. **Risk**: Does it likely need function pointers or problematic patterns?
4. **Value**: Is it foundational for other conversions?

**Scoring**: Simple (3) + Low deps (3) + Low risk (3) + High value (3) = 12 max

### Phase 3: Conversion Queue (Estimated)

**High Priority** (Simple, foundational, low risk):
1. **strict-config.ts** - Config validation, likely simple
2. **system-command.ts** - Command execution, uses common.ts (we have it)
3. **deps.ts** - Dependency definitions, likely just types

**Medium Priority** (Moderate complexity):
4. **deps-manager.ts** - Dependency management
5. **script-analyzer.ts** - Code analysis
6. **deploy.ts** - Deployment logic

**Lower Priority** (Complex, many dependencies):
7. **turso-client.ts** - Database client (HTTP, async)
8. **database-seeder.ts** - Database operations
9. **script-repository.ts** - File management
10. **embedding-generator.ts** - AI/ML operations
11. **vector-search.ts** - Search algorithms

### Phase 4: Execution Strategy

For each file:
1. **Analyze** with PMAT (complexity, dependencies)
2. **RED Phase**: Write comprehensive tests
3. **GREEN Phase**: Implement to pass tests
4. **BLOCKER Check**: Hit compiler bug? → Document → File issue → Next file
5. **REFACTOR Phase**: Apply PMAT quality gates
6. **COMMIT**: Document learnings

---

## Success Metrics

**Sprint Goal**: Convert 3-5 more simple files
**Quality Target**: All conversions pass PMAT quality gates
**Documentation**: Update RUCHY-STRATEGIC-PLAN.md after each attempt
**Blocker Tracking**: Document all new compiler issues found

**Definition of Done** (per file):
- ✅ RED phase tests written and validated
- ✅ GREEN phase implementation complete
- ✅ PMAT quality gate passing
- ✅ No compiler bugs blocking
- ✅ Committed with ticket reference

---

## Risk Mitigation

**Compiler Bug Risk**: HIGH
- Mitigation: Small incremental attempts, document blockers immediately
- Fallback: Maintain list of "safe" patterns that work

**Complexity Risk**: MEDIUM
- Mitigation: Start with simplest files, use PMAT to measure
- Fallback: Simplify TypeScript before converting

**Timeline Risk**: MEDIUM
- Mitigation: Set reasonable sprint goals (3-5 files, not all 11)
- Fallback: Focus on completing 3 perfect conversions vs 11 blocked

---

## Next Actions

1. ✅ Create this strategic plan
2. ⏳ Analyze remaining 11 files with PMAT
3. ⏳ Select next 3 simplest files
4. ⏳ Start RUCHY-006 with chosen file
5. ⏳ Update plan after each attempt

---

**Created**: 2025-10-28
**Status**: Active
**Approach**: Pragmatic incremental progress (Option B)
**Goal**: 6/16 files converted (3 done + 3 new), 2 blocked documented
