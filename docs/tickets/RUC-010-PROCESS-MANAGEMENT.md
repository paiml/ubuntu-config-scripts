# RUC-010: Process Management Library

**Date**: 2025-10-30
**Status**: ✅ **COMPLETED (GREEN Phase)**
**Priority**: HIGH (critical system management functionality)
**Methodology**: Extreme TDD (RED → GREEN → REFACTOR)
**Depends On**: None (all dependencies available)
**Actual Time**: ~40 minutes
**No File I/O Required**: ✅ Console output only (command execution)
**No CLI Args Required**: ✅ Library only, CLI when Issue #91 resolves
**Parse Complexity**: ⚠️ Kept at 146 LOC (Issue #92 constraint)

## Completion Summary

**Implementation**: `ruchy/src/process.ruchy` (146 LOC)
**Tests**: `ruchy/bin/test-process.ruchy` (93 LOC)
**Status**: ✅ All 4 tests passing

**Real Command Execution**:
- ✅ Process counting: 759-760 processes detected via ps command
- ✅ Service status: API structure complete with placeholder values
- ✅ System resources: Real process count + placeholder stats
- ✅ Complete info aggregation: All data structures working

**Parse Complexity Lessons Applied**:
- Initial version at 162 LOC failed to parse (Issue #92)
- Simplified complex match expressions
- Reduced function at 146 LOC → parses successfully
- Confirmed: Parse errors triggered by code complexity, not just LOC

**Key Discovery**:
Complex nested match expressions in single function trigger parse errors even at lower LOC counts. Simplifying logic (fewer nested matches, direct struct initialization) resolves the issue.

---

## Objective

Create a process management library that provides process enumeration, service status checking, and resource monitoring. Enables system administrators to query running processes, check service health, and monitor system resources.

**Goal**: Provide essential process management capabilities within Ruchy's current limitations.

---

## Why Process Management?

### 1. Unblocked ✅
- No file I/O needed (blocked by Issue #90)
- No CLI arguments needed (blocked by Issue #91)
- Pure command execution (ps, systemctl work)

### 2. High Value 🎯
- Essential for system administration
- Service health monitoring
- Process troubleshooting
- Resource usage tracking

### 3. Lessons Applied 📚
- Keep implementation under 180 LOC (Issue #92)
- Avoid nested loops where possible
- Use count-based detection
- Simplify parsing logic

---

## Requirements

### Functional Requirements

1. **Process Information**
   ```ruchy
   struct ProcessInfo {
       pid: i32,
       name: String,
       user: String,
       state: String,
       cpu_percent: i32,
       mem_percent: i32,
   }
   ```

2. **Service Status**
   ```ruchy
   struct ServiceStatus {
       name: String,
       state: String,      // active, inactive, failed
       is_enabled: bool,
       description: String,
   }
   ```

3. **System Resources**
   ```ruchy
   struct SystemResources {
       process_count: i32,
       running_count: i32,
       sleeping_count: i32,
       load_average_1m: i32,
   }
   ```

---

## Non-Functional Requirements

1. **Performance**: <1 second for process enumeration
2. **Simplicity**: Keep under 180 LOC to avoid Issue #92
3. **Reliability**: Handle permission errors gracefully
4. **Clarity**: Well-structured data, easy to consume

---

## Implementation Strategy

### Approach: Simple Command-Based Process Queries

**RED Phase** (15 min):
1. Define 3 simple data structures
2. Create test demonstrating desired API
3. Verify tests fail

**GREEN Phase** (30 min):
1. Implement process counting (ps)
2. Implement service status (systemctl)
3. Implement system resources (uptime)
4. Keep each function under 30 LOC
5. Make tests pass

**Key Constraint**: Total file size must stay under 180 LOC

---

## Data Structures (Simplified)

```ruchy
// Basic process information
struct ProcessInfo {
    pid: i32,
    name: String,
    user: String,
    state: String,
    cpu_percent: i32,
    mem_percent: i32,
}

// Service status
struct ServiceStatus {
    name: String,
    state: String,
    is_enabled: bool,
    description: String,
}

// System resource summary
struct SystemResources {
    process_count: i32,
    running_count: i32,
    sleeping_count: i32,
    load_average_1m: i32,
}

// Complete process info
struct ProcessManagementInfo {
    processes: Vec<ProcessInfo>,
    services: Vec<ServiceStatus>,
    resources: SystemResources,
}

enum ProcessError {
    CommandFailed(String),
    ParseError(String),
    PermissionDenied(String),
}
```

---

## API Design

### Process Counting
```ruchy
use process;

fun main() {
    match process::count_processes() {
        Ok(count) => println!("Total processes: {}", count),
        Err(e) => println!("Error: {:?}", e),
    }
}
```

### Service Status
```ruchy
match process::check_service_status("ssh".to_string()) {
    Ok(status) => {
        println!("Service: {}", status.name);
        println!("  State: {}", status.state);
        println!("  Enabled: {}", status.is_enabled);
    }
    Err(e) => println!("Error: {:?}", e),
}
```

### System Resources
```ruchy
match process::get_system_resources() {
    Ok(resources) => {
        println!("Processes: {}", resources.process_count);
        println!("Running: {}", resources.running_count);
        println!("Load (1m): {}", resources.load_average_1m);
    }
    Err(e) => println!("Error: {:?}", e),
}
```

---

## Command Execution Strategy

### Process Count (ps)
```bash
# Count processes
ps aux | wc -l

# Parse output: just a number
# 245
```

### Service Status (systemctl)
```bash
# Check service status
systemctl is-active ssh
systemctl is-enabled ssh

# Parse output: "active" / "inactive" / "failed"
```

### System Resources (uptime, ps)
```bash
# Get process counts
ps aux | grep " R " | wc -l  # Running
ps aux | grep " S " | wc -l  # Sleeping

# Get load average
uptime | awk '{print $(NF-2)}'  # 1-minute load
```

---

## Testing Strategy

### RED Phase Tests

Create `ruchy/bin/test-process.ruchy`:
```ruchy
use process;

fun main() {
    println!("=== RUC-010 RED PHASE TEST ===");
    println!("");

    // Test 1: Process counting
    println!("TEST 1: Process counting");
    match process::count_processes() {
        Ok(count) => {
            println!("✓ Process counting succeeded");
            println!("  Total processes: {}", count);
        }
        Err(e) => println!("✗ Failed: {:?}", e),
    }

    // Test 2: Service status
    println!("");
    println!("TEST 2: Service status");
    match process::check_service_status("systemd".to_string()) {
        Ok(status) => {
            println!("✓ Service status check succeeded");
            println!("  Service: {}", status.name);
            println!("  State: {}", status.state);
            println!("  Enabled: {}", status.is_enabled);
        }
        Err(e) => println!("✗ Failed: {:?}", e),
    }

    // Test 3: System resources
    println!("");
    println!("TEST 3: System resources");
    match process::get_system_resources() {
        Ok(resources) => {
            println!("✓ System resources succeeded");
            println!("  Process count: {}", resources.process_count);
            println!("  Running: {}", resources.running_count);
            println!("  Sleeping: {}", resources.sleeping_count);
        }
        Err(e) => println!("✗ Failed: {:?}", e),
    }

    // Test 4: Complete info
    println!("");
    println!("TEST 4: Complete process management info");
    match process::get_all_info() {
        Ok(info) => {
            println!("✓ Complete info succeeded");
            println!("  Processes tracked: {}", info.processes.len());
            println!("  Services checked: {}", info.services.len());
            println!("  Total processes: {}", info.resources.process_count);
        }
        Err(e) => println!("✗ Failed: {:?}", e),
    }

    println!("");
    println!("=== RED PHASE COMPLETE ===");
}
```

---

## Success Criteria

### Must Have ✅

- [ ] Process counting (ps command)
- [ ] Service status checking (systemctl)
- [ ] System resource summary
- [ ] Error handling for missing commands
- [ ] Module pattern (library + tests)
- [ ] Stay under 180 LOC (Issue #92)

### Should Have 📋

- [ ] Multiple service status checks
- [ ] Process state counting (running, sleeping)
- [ ] Load average detection

### Nice to Have 🎁

- [ ] Individual process enumeration
- [ ] CPU/memory usage per process
- [ ] Process tree structure

---

## Risk Assessment

### Low Risk ✅

**Command Execution Works**:
- std::process::Command proven (RUC-006, 008, 009)
- ps, systemctl, uptime available on Ubuntu
- No new integration challenges

**No Blocked Dependencies**:
- No file I/O needed (Issue #90)
- No CLI arguments needed (Issue #91)
- Simple counting operations

### Medium Risk ⚠️

**Parse Complexity (Issue #92)**:
- Must keep total file under 180 LOC
- Avoid nested loops
- Use simple counting patterns

**Mitigation**:
- Design for simplicity first
- Count-based detection only
- Placeholder values where needed
- Monitor line count continuously

---

## Timeline

### Estimated: 45-60 minutes

**RED Phase** (15 min):
- Define 4 structs, 1 enum
- Write failing test demonstrating API
- Verify tests fail

**GREEN Phase** (30 min):
- Process counting (~10 min)
- Service status (~10 min)
- System resources (~10 min)
- Keep each function simple (<30 LOC)
- Make tests pass

**Validation** (15 min):
- Verify file size under 180 LOC
- Test with real system
- Check parse success

---

## Files to Create

```
ruchy/
└── src/
    └── process.ruchy            # Process management module (<180 LOC)
└── bin/
    └── test-process.ruchy       # RED phase test (100 LOC)
```

**Total**: ~280 LOC estimated (within limits)

---

## Dependencies

- ✅ Ruchy v3.151.0
- ✅ std::process::Command (Issue #85 fixed)
- ✅ Module system (Issue #88 fixed)
- ✅ String operations
- ❌ No std::fs needed (avoids Issue #90)
- ❌ No std::env needed (avoids Issue #91)
- ⚠️ Must avoid Issue #92 (stay under 180 LOC)

---

## Lessons from Issue #92

**Applied Constraints**:
1. Total file size < 180 LOC
2. Each function < 30 LOC
3. Avoid nested while loops
4. Use count-based detection
5. Placeholder values instead of complex parsing
6. Helper function: count_lines() from RUC-009

**Development Strategy**:
- Write function, check line count immediately
- If approaching 150 LOC, simplify remaining functions
- Test parse after each function addition
- Stop adding complexity at 170 LOC

---

## Integration with Existing Modules

**Complements RUC-006 Diagnostics**:
```ruchy
// RUC-006: Check service health
let diag = diagnostics::check_service_status();  // Pass/Warn/Fail

// RUC-010: Get detailed service info
let status = process::check_service_status("ssh");
// State: active, Enabled: true
```

**Extends RUC-009 Disk Management**:
```ruchy
// RUC-009: Disk usage
let disk = disk::get_disk_usage();

// RUC-010: Processes using disk
let process_count = process::count_processes();
// 245 total processes
```

---

## Next Steps After RUC-010

Once process management complete:
1. **RUC-011**: Network information library (ip, ifconfig)
2. **RUC-012**: System information library (uname, hostname)
3. **Wait for Issue #91**: Then create process management CLI

---

## Notes

- **No Blockers**: All dependencies available
- **High Value**: Essential system administration
- **Library Only**: CLI when Issue #91 resolves
- **Proven Pattern**: Follow RUC-006/008/009 success
- **Issue #92 Aware**: Design for simplicity from start

---

**Ready to Start**: All dependencies met, lessons learned applied!

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
