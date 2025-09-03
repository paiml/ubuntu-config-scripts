# Ubuntu Config Scripts → Ruchy Migration Execution Roadmap

*Following Ruchy project methodology with unique task IDs and systematic execution*

## 🎯 CURRENT SPRINT: UCS-SYNTAX-FIX Sprint (CRITICAL PATH)

**Context**: Real Ruchy v0.9.12 compiler testing revealed syntax incompatibilities requiring immediate fixes
**Priority**: P0 - BLOCKING for all further migration progress
**Duration**: 2-4 hours (immediate execution)

### Sprint Overview
- **Task IDs**: UCS-SYNTAX-001 to UCS-SYNTAX-006
- **Goal**: Fix all syntax errors and establish working Ruchy code foundation
- **Success Criteria**: All files pass `ruchy check` and basic functionality works
- **Impact**: Unblocks entire migration pipeline

## 🚨 CRITICAL SYNTAX FIXES (P0 Priority)

### UCS-SYNTAX-001: Fix Function Declaration Syntax ⚡ IMMEDIATE
**Status**: 🔄 IN PROGRESS  
**Complexity**: 6/10  
**Dependencies**: None  
**Acceptance Criteria**:
- Convert all `let name = fn(args) {} in` → `fun name(args: Type) {}`
- Add proper type annotations to function parameters
- Test each function with `ruchy check`
- All function declarations compile successfully

**Implementation**:
```ruchy
// BEFORE (broken):
let create_logger = fn(level, prefix, use_colors) { ... } in

// AFTER (working):
fun create_logger(level: i32, prefix: String, use_colors: bool) {
    // function body with return
}
```

### UCS-SYNTAX-002: Fix String Formatting ⚡ IMMEDIATE  
**Status**: 📋 PENDING  
**Complexity**: 4/10  
**Dependencies**: UCS-SYNTAX-001  
**Acceptance Criteria**:
- Replace all `f"..."` interpolation with `format!()` macro
- Update all `println!()` calls to use proper format strings
- Test string formatting functionality
- All output functions work correctly

**Implementation**:
```ruchy
// BEFORE (broken):
f"Command failed with code {code}: {error}"

// AFTER (working):
format!("Command failed with code {}: {}", code, error)
```

### UCS-SYNTAX-003: Simplify Pattern Matching ⚡ IMMEDIATE
**Status**: 📋 PENDING  
**Complexity**: 7/10  
**Dependencies**: UCS-SYNTAX-001  
**Acceptance Criteria**:
- Remove complex Result<T,E> patterns not yet implemented
- Use simple value matching and conditionals
- Test pattern matching compiles
- Maintain logical functionality

**Implementation**:
```ruchy
// BEFORE (broken):
match execute_command(cmd) {
    Ok(output) => create_result(true, output.stdout),
    Err(error) => create_result(false, error.to_string())
}

// AFTER (working):
let success = command_succeeded(cmd)
if success {
    create_result(true, get_output(cmd))
} else {
    create_result(false, get_error(cmd))
}
```

### UCS-SYNTAX-004: Fix Data Structure Creation ⚡ IMMEDIATE
**Status**: 📋 PENDING  
**Complexity**: 5/10  
**Dependencies**: UCS-SYNTAX-001, UCS-SYNTAX-002  
**Acceptance Criteria**:
- Fix object literal syntax and struct creation
- Update array operations to use working patterns
- Test data structure creation
- All collections work correctly

### UCS-SYNTAX-005: Update Test Functions ⚡ IMMEDIATE
**Status**: 📋 PENDING  
**Complexity**: 3/10  
**Dependencies**: UCS-SYNTAX-001 through UCS-SYNTAX-004  
**Acceptance Criteria**:
- Convert all test functions to working syntax
- Update assertion patterns
- Test execution with `ruchy run`
- All tests execute without syntax errors

### UCS-SYNTAX-006: Validate Complete Syntax Fix ⚡ IMMEDIATE
**Status**: 📋 PENDING  
**Complexity**: 2/10  
**Dependencies**: All above tasks  
**Acceptance Criteria**:
- All .ruchy files pass `ruchy check`
- All test files execute with `ruchy run`
- Make targets work correctly: `make check`, `make test`
- Foundation ready for migration continuation

## 📋 EXECUTION PROTOCOL

**All development follows systematic approach:**

1. **IMPLEMENT** single task with minimal complexity
2. **TEST** immediately with `ruchy check filename.ruchy`
3. **VERIFY** functionality with `ruchy run filename.ruchy` if applicable
4. **COMMIT** working code with task reference
5. **CONTINUE** to next task only after current task passes

**Success Metrics per Task**:
- ✅ Syntax validation: `ruchy check` passes
- ✅ Compilation: No syntax errors
- ✅ Basic execution: Core functionality works
- ✅ Quality: Code follows working patterns

## 🔄 EXECUTION PHASES

### Phase 1: Individual Function Fixes (1-2 hours)
**Objective**: Fix one function at a time, test immediately

1. **UCS-SYNTAX-001A**: Fix `create_logger` function declaration
2. **UCS-SYNTAX-001B**: Fix core utility functions  
3. **UCS-SYNTAX-001C**: Test each function individually

### Phase 2: Integration Testing (30 minutes)
**Objective**: Ensure functions work together

1. **UCS-SYNTAX-002A**: Fix string formatting across all functions
2. **UCS-SYNTAX-003A**: Simplify complex pattern matching
3. **UCS-SYNTAX-004A**: Update data structures

### Phase 3: Test Suite Restoration (30 minutes)  
**Objective**: Get test suite working with corrected syntax

1. **UCS-SYNTAX-005A**: Fix test function syntax
2. **UCS-SYNTAX-005B**: Update test execution patterns
3. **UCS-SYNTAX-006A**: Full validation pipeline

### Phase 4: Quality Gates (30 minutes)
**Objective**: Ensure all quality gates pass

1. **UCS-SYNTAX-006B**: Full `make check` passes
2. **UCS-SYNTAX-006C**: Full `make test` passes  
3. **UCS-SYNTAX-006D**: Commit working foundation

## 🚀 IMMEDIATE EXECUTION PLAN

### Starting NOW: UCS-SYNTAX-001 (Function Declaration Fix)

**Step 1**: Create working logger function
```ruchy
fun create_logger(level: i32, prefix: String, use_colors: bool) -> Logger {
    // Implementation
}
```

**Step 2**: Test immediately
```bash
source "$HOME/.cargo/env" && ruchy check lib/logger_working.ruchy
```

**Step 3**: Build up functionality piece by piece
- Add debug function
- Add info function  
- Add warn function
- Add error function
- Test each addition

**Step 4**: Move to next function only when current function is 100% working

## 📊 TRACKING PROGRESS

### Completed Tasks ✅
- [x] **Foundation Setup**: Ruchy v0.9.12 installed and working
- [x] **Syntax Analysis**: Real compiler testing identified issues
- [x] **Working Examples**: Basic patterns verified

### In Progress 🔄
- [ ] **UCS-SYNTAX-001**: Function declaration fixes

### Pending 📋
- [ ] **UCS-SYNTAX-002**: String formatting fixes
- [ ] **UCS-SYNTAX-003**: Pattern matching simplification  
- [ ] **UCS-SYNTAX-004**: Data structure fixes
- [ ] **UCS-SYNTAX-005**: Test function updates
- [ ] **UCS-SYNTAX-006**: Complete validation

## 🎯 SUCCESS CRITERIA

**Sprint Complete When**:
✅ All .ruchy files pass `ruchy check`  
✅ Basic test execution works with `ruchy run`  
✅ Make targets function correctly  
✅ Foundation ready for continued migration  
✅ Zero syntax errors in codebase

**Next Sprint After This**: UCS-0003 Audio Configuration Migration

---

**Status**: Ready for immediate execution ⚡  
**Estimated Duration**: 2-4 hours total  
**Blocking Issues**: None - all tools available  
**Ready to Execute**: YES - beginning UCS-SYNTAX-001 now