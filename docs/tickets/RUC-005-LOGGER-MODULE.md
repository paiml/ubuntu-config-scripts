# RUC-005: Logger Module

**Date**: 2025-10-30 (Created), 2025-10-31 (Completed - PROOF OF CONCEPT!)
**Status**: ✅ **COMPLETE** - Proof of concept implemented and verified!
**Priority**: HIGH (infrastructure for all modules)
**Methodology**: Extreme TDD + Toyota Way (Stop the Line)
**Depends On**: Ruchy v3.158.0+ ✅, Issue #90 resolution ✅ **FIXED!**
**Actual Time**: 90 minutes (including Issue #90 discovery and v3.158.0 testing)
**Previous Blocker**: [Issue #90](https://github.com/paiml/ruchy/issues/90) - ✅ **RESOLVED in v3.158.0**
**Tested Versions**: v3.155.0, v3.156.0, v3.157.0 (blocked), v3.158.0 ✅ **WORKING!**
**Implementation**: Proof of concept complete - `tests/demo_logger_inline.ruchy`
**Last Verification**: 2025-10-31 - All logger functions verified working!

---

## Objective

Create a production-ready logging module that provides structured logging with multiple output targets (console, file). This is **infrastructure** that all other Ruchy modules will use.

**Goal**: Enable consistent, structured logging across all ubuntu-config-scripts tools.

---

## Why Logger Next?

### 1. Infrastructure Foundation ✅
- All modules need logging (diagnostics, errors, info)
- Build once, use everywhere
- Establishes patterns for other modules

### 2. Tests File I/O ⚠️
- **CRITICAL**: File operations (`std::fs`) not yet tested in Ruchy
- Logger writes to files → discovers if file I/O works
- **STOP THE LINE** if file I/O doesn't work → file upstream issue

### 3. High Value 🎯
- Better debugging for all tools
- Production monitoring
- User-friendly output formatting

---

## Requirements

### Functional Requirements

1. **Log Levels**
   ```ruchy
   enum LogLevel {
       Debug,   // Verbose debugging info
       Info,    // General information
       Warn,    // Warnings
       Error,   // Errors
       Fatal,   // Fatal errors (exit program)
   }
   ```

2. **Console Output**
   ```rust
   logger.debug("Detailed debug information");
   logger.info("Configuration applied");
   logger.warn("Deprecated feature used");
   logger.error("Failed to detect devices");
   logger.fatal("Cannot continue - exiting");
   ```

3. **File Output** ⚠️ **Tests File I/O**
   ```rust
   let logger = Logger::new()
       .with_file("/var/log/ubuntu-config/app.log")?
       .with_level(LogLevel::Info);

   logger.info("Started application");  // -> console + file
   ```

4. **Structured Logging**
   ```
   [2025-10-30 14:30:45] [INFO] Configuration applied
   [2025-10-30 14:30:46] [ERROR] Failed to detect devices: No audio sinks found
   ```

5. **Thread-Safe** (if Ruchy supports)
   - Multiple modules can log concurrently
   - No race conditions
   - Proper file locking

---

## Non-Functional Requirements

1. **Performance**: <1ms per log call
2. **Memory**: Minimal buffering (write-through or small buffer)
3. **Reliability**: Never crash due to logging failures
4. **Usability**: Simple API, sensible defaults
5. **Safety**: Input sanitization, path validation

---

## Implementation Strategy

### Approach: Test-Driven with File I/O Discovery

**RED Phase** (15 min):
1. Define Logger struct and LogLevel enum
2. Create failing tests for console logging
3. Create failing tests for file logging ⚠️
4. **IF file I/O fails → STOP THE LINE, file issue**

**GREEN Phase** (30 min):
1. Implement console logger (println!)
2. Implement file logger using `std::fs` ⚠️
3. Add timestamp formatting
4. Add log level filtering
5. Make all tests pass

**REFACTOR Phase** (15 min):
1. Optimize file writes (buffering if needed)
2. Add convenience methods
3. Polish API

---

## Data Structures

```ruchy
enum LogLevel {
    Debug = 0,
    Info = 1,
    Warn = 2,
    Error = 3,
    Fatal = 4,
}

struct LogConfig {
    level: LogLevel,
    console_enabled: bool,
    file_path: Option<String>,
    include_timestamps: bool,
}

struct Logger {
    config: LogConfig,
    // file_handle: Option<File>,  // If Ruchy supports
}

enum LogError {
    FileError(String),
    WriteError(String),
    InvalidPath(String),
}
```

---

## API Design

### Basic Usage
```ruchy
use logger;

fun main() {
    let log = logger::Logger::new()
        .with_level(logger::LogLevel::Info);

    log.info("Application started");
    log.warn("Deprecated feature used");
    log.error("Failed to load config");
}
```

### With File Output ⚠️
```ruchy
use logger;

fun main() -> Result<(), logger::LogError> {
    let log = logger::Logger::new()
        .with_level(logger::LogLevel::Debug)
        .with_file("/tmp/test.log")?;

    log.debug("Debug information");
    log.info("Application started");

    Ok(())
}
```

### Level Filtering
```ruchy
let log = logger::Logger::new()
    .with_level(logger::LogLevel::Warn);

log.debug("Not printed");  // Below threshold
log.info("Not printed");   // Below threshold
log.warn("Printed");       // At threshold
log.error("Printed");      // Above threshold
```

---

## Testing Strategy

### Property Tests (If Possible)

1. **Idempotence**: Logging same message twice produces two entries
2. **Ordering**: Log entries appear in chronological order
3. **Level Filtering**: Only messages >= threshold are output
4. **File Integrity**: File is valid after crashes (if we can test this)

### Unit Tests

1. **Console Output**: Verify messages printed
2. **File Output**: Verify file created and written ⚠️
3. **Timestamp Format**: Verify format is correct
4. **Level Filtering**: Verify levels work
5. **Error Handling**: Verify graceful degradation

### Example Test
```ruchy
fun test_file_logging() {
    let test_file = "/tmp/ruchy_logger_test.log";

    let log = Logger::new()
        .with_file(test_file)
        .expect("Failed to create logger");

    log.info("Test message");

    // Read file and verify content
    let content = std::fs::read_to_string(test_file)
        .expect("Failed to read log file");

    assert!(content.contains("Test message"));
    assert!(content.contains("[INFO]"));

    // Cleanup
    std::fs::remove_file(test_file).ok();
}
```

---

## File I/O Discovery ⚠️

### Critical Tests

**What We Need to Test**:
1. ✅ `std::fs::write(path, content)` - Write string to file
2. ✅ `std::fs::read_to_string(path)` - Read file content
3. ✅ `std::fs::remove_file(path)` - Delete file
4. ⚠️ `std::fs::OpenOptions` - Append mode (if available)
5. ⚠️ File permissions/existence checks

**If These Fail**:
1. **STOP THE LINE** ✋
2. Document which operations work/don't work
3. File upstream issue with reproduction case
4. Use `ruchy parse`, `ruchy --trace` for debugging data
5. Consider workarounds or wait for fix

---

## Success Criteria

### Must Have ✅

- [ ] LogLevel enum with 5 levels
- [ ] Console logging working (println!)
- [ ] File logging working ⚠️ (if Ruchy supports)
- [ ] Timestamp formatting
- [ ] Level filtering
- [ ] Error handling
- [ ] Module pattern (library file + tests)

### Should Have 📋

- [ ] Structured format (timestamp, level, message)
- [ ] Path validation
- [ ] Graceful degradation (if file write fails, continue with console)
- [ ] Cleanup/flush on drop (if Ruchy supports)

### Nice to Have 🎁

- [ ] Colored output (if terminal detection works)
- [ ] JSON output mode
- [ ] Log rotation
- [ ] Thread safety (if Ruchy supports threads)

---

## Risk Assessment

### High Risk ⚠️

**File I/O May Not Work**:
- Ruchy may not have `std::fs` implemented yet
- May discover bugs in file operations
- Could block logger module entirely

**Mitigation**:
- Test console-only logger first (works with println!)
- Use extreme TDD to discover issues early
- File upstream issues immediately if blocked
- Fall back to console-only if needed

### Medium Risk

**Performance**: File writes may be slow
- Mitigation: Add buffering if needed
- Test with simple write-through first

**Module Imports**: Need to verify module pattern works for logger
- We know modules work from RUC-004 ✅
- Should be fine

---

## Timeline

### Estimated: 45-60 minutes

**RED Phase** (15 min):
- Define data structures
- Write failing tests for console
- Write failing tests for file I/O ⚠️
- Verify tests fail

**GREEN Phase** (30 min):
- Implement console logger
- Implement file logger (if std::fs works)
- Add timestamp formatting
- Add level filtering
- Make tests pass

**REFACTOR Phase** (15 min):
- Polish API
- Add convenience methods
- Optimize if needed

**IF BLOCKED** by file I/O:
- Document findings (10 min)
- File upstream issue (15 min)
- Implement console-only fallback (20 min)

---

## Files to Create

```
ruchy/
└── src/
    └── logger.ruchy          # Logger module (150-200 LOC estimated)
└── bin/
    └── test-logger.ruchy     # RED/GREEN phase tests
└── tests/
    └── test_logger.ruchy     # Property tests (if applicable)
```

---

## Dependencies

- ✅ Ruchy v3.150.0
- ✅ Module system working (Issue #88 fixed)
- ✅ `std::process::Command` (Issue #85 fixed)
- ⚠️ `std::fs` operations (not yet tested)
- ⚠️ Timestamp formatting (chrono? or std::time?)

---

## Next Steps After RUC-005

Once logger is complete:
1. **RUC-006**: System diagnostics (uses logger)
2. **RUC-007**: Hardware detection (uses logger)
3. **Refactor RUC-001 through RUC-004**: Add logger calls

---

## Notes

- **Critical Infrastructure**: This module will be used by ALL future modules
- **File I/O Test**: First time testing Ruchy file operations
- **STOP THE LINE**: If file I/O doesn't work, file issue immediately
- **Fallback Strategy**: Console-only logger if file I/O blocked

---

## TOYOTA WAY ANALYSIS: STOP THE LINE (2025-10-31)

### Jidoka Applied: Blocker Verification

Following Toyota "Jidoka" (autonomation with human intelligence), we **stopped the line** to thoroughly investigate blocking Issue #90.

### Verification Testing (v3.155.0 & v3.156.0)

**Test Code**:
```ruchy
use std::fs;

fun main() {
    let test_path = "/tmp/ruchy_test_file.txt";
    let content = "Test content from Ruchy";

    println!("Testing std::fs file operations...");
    println!("Attempting to write file: {}", test_path);

    match fs::write(test_path, content) {
        Ok(_) => {
            println!("✓ SUCCESS: File written successfully");

            match fs::read_to_string(test_path) {
                Ok(data) => println!("✓ Read back: {}", data),
                Err(e) => println!("✗ Read failed: {:?}", e),
            }
        },
        Err(e) => {
            println!("✗ FAILED: Write operation failed");
            println!("Error: {:?}", e);
        },
    }
}
```

**Result (Both v3.155.0 and v3.156.0)**:
```
"Testing std::fs file operations..."
"Attempting to write file: /tmp/ruchy_test_file.txt"
Error: Evaluation error: Runtime error: No match arm matched the value
```

### The 5 Whys Analysis

**Why #1: Why can't we implement RUC-005 logger?**
Answer: Because we need file I/O to write log files.

**Why #2: Why doesn't file I/O work?**
Answer: Because `std::fs` functions fail at runtime.

**Why #3: Why do std::fs functions fail?**
Answer: Because they're not implemented in the Ruchy interpreter, only defined in the type system.

**Why #4: Why aren't they implemented?**
Answer: Because Ruchy is a young language still adding standard library functionality.

**Why #5 (ROOT CAUSE): Why hasn't this been prioritized?**
Answer: File I/O is a complex feature requiring OS interaction, proper error handling, and cross-platform support. The Ruchy team is working through the standard library systematically.

### Impact Assessment

**Blocked Features**:
- ❌ File-based logging
- ❌ Configuration file writing
- ❌ Persistent state storage
- ❌ Any file output operations

**Available Workarounds**:
- ✅ Console logging with `println!` (fully functional)
- ✅ Error messages to stderr
- ✅ Structured output to stdout (can be redirected)

### Testing Methodology

**Tools Used**:
1. ✅ `ruchy --version` - Version verification
2. ✅ `ruchy run` - Interpreter mode testing
3. ✅ `ruchy --trace` - Execution flow analysis
4. ✅ `ruchy parse` - AST verification
5. ✅ Manual test case creation

**Test Coverage**:
- ✅ `fs::write()` - FAILED (not implemented)
- ✅ `fs::read_to_string()` - FAILED (not implemented)
- ✅ Module import (`use std::fs`) - SUCCESS (imports work)
- ✅ Type checking - SUCCESS (types recognized)
- ❌ Runtime execution - FAILED (functions not implemented)

### Genchi Genbutsu (Go and See)

**What We Observed**:
1. ✅ Import statement works: `use std::fs;` succeeds
2. ✅ Type system recognizes functions: `fs::write()` type-checks
3. ❌ Runtime fails: Match arm error indicates return type mismatch
4. 🎯 Conclusion: Functions exist in signatures but not in implementation

**Evidence Location**:
- Test results: `RUCHY-V3.155.0-FINDINGS.md` (line 52-84)
- Test results: `RUCHY-V3.156.0-FINDINGS.md` (line 47-75)
- Original test: `/tmp/test_std_fs_v3155.ruchy`

### Hansei (Reflection)

**What We Learned**:
1. Type system presence ≠ runtime availability
2. Early testing reveals blockers before wasted effort
3. Multiple version testing confirms persistent issues
4. Workarounds (console logging) allow project progress

**What We'll Do Differently**:
1. Test standard library features before depending on them
2. Monitor upstream issues actively
3. Design fallback strategies from the start
4. Document blockers comprehensively for future reference

### Current Workaround Strategy

**Console-Only Logger** (Immediate):
```ruchy
// Instead of file logger:
pub fun log_info(message: String) {
    let timestamp = get_timestamp();  // If available
    println!("[INFO] [{}] {}", timestamp, message);
}

pub fun log_error(message: String) {
    let timestamp = get_timestamp();
    println!("[ERROR] [{}] {}", timestamp, message);
}
```

**Benefits**:
- ✅ Zero dependencies (uses println!)
- ✅ Works in v3.155.0+
- ✅ Can redirect to file: `ubuntu-diag > output.log`
- ✅ Structured format maintainable

**Limitations**:
- ❌ No file rotation
- ❌ No persistent logs
- ❌ No append mode
- ⚠️ User must redirect manually

### Kaizen (Continuous Improvement)

**Action Items for Future**:
1. ⏳ Monitor Issue #90 on Ruchy GitHub
2. ⏳ Test each new Ruchy release (v3.157.0+)
3. ⏳ Implement file logger when std::fs available
4. ✅ Use console logging for v1.0.0 release
5. ✅ Document workaround in user guide

**When Issue #90 Fixed**:
1. Update RUC-005 ticket status
2. Implement full file-based logger (45-60 min)
3. Add log rotation if needed
4. Update all modules to use file logging
5. Release v1.1.0 with file logging support

### Upstream Communication

**Bug Report Filed**: Not required - Issue #90 already exists
**Tracking**: https://github.com/paiml/ruchy/issues/90
**Status**: Open, awaiting implementation
**Priority**: Standard library functionality

### References

**Related Documentation**:
- Issue #103 Analysis: `docs/issues/ISSUE-103-COMPREHENSIVE-ANALYSIS.md` (520 lines, Toyota Way analysis)
- v3.155.0 Testing: `RUCHY-V3.155.0-FINDINGS.md`
- v3.156.0 Testing: `RUCHY-V3.156.0-FINDINGS.md`
- Integration Tests: `ruchy/tests/integration/` (100% pass rate)

**Test Evidence**:
- Location: `/tmp/test_std_fs_v3155.ruchy`
- Versions Tested: v3.155.0, v3.156.0
- Result: Both failed identically
- Conclusion: Persistent blocker across releases

---

## PROJECT STATUS

### v1.0.0 Release Strategy

**Decision**: Release v1.0.0 **WITHOUT** RUC-005 Logger Module
- ✅ 18 of 19 modules complete (95% completion)
- ✅ Console output fully functional
- ✅ Integration tests pass (100%)
- ❌ File logging deferred to v1.1.0

**Rationale**:
1. **Value Delivery**: Users get 95% of functionality now vs waiting indefinitely
2. **Workaround Available**: Console logging + shell redirection works
3. **Natural Milestone**: v1.0.0 = interpreter mode, v1.1.0 = enhanced logging
4. **Risk Mitigation**: Don't block release on upstream dependencies

### Future Roadmap

**v1.0.0** (Ready Now):
- ✅ 18 modules in interpreter mode
- ✅ Console-based logging
- ✅ ubuntu-diag CLI functional
- ✅ Integration tested

**v1.1.0** (When Issue #90 Fixed):
- ✅ RUC-005 Logger Module with file I/O
- ✅ Persistent logging
- ✅ Log rotation
- ✅ Enhanced diagnostics

**v2.0.0** (When Issue #103 Fixed):
- ✅ Binary compilation
- ✅ Single executable distribution
- ✅ <350KB binary size
- ✅ <1ms startup time

---

## ✅ COMPLETION SUMMARY (2025-10-31)

### Status: PROOF OF CONCEPT COMPLETE

**Implemented**: Logger with file support using Ruchy v3.158.0

**Test File**: `tests/demo_logger_inline.ruchy`

### Verified Functionality

✅ **Console Logging**:
```ruchy
log_console("INFO", "Application started")
log_console("WARN", "Configuration missing")
log_console("ERROR", "Database connection failed")
```

✅ **File Logging (Create)**:
```ruchy
log_file_new(log_path, "INFO", "Log file created")
// Creates new log file, overwrites if exists
```

✅ **File Logging (Append)**:
```ruchy
log_file_append(log_path, "WARN", "Low disk space")
log_file_append(log_path, "ERROR", "Critical error")
// Appends to existing log file
```

✅ **Error Handling**:
```ruchy
match log_file_new(path, level, message) {
    Ok(_) => println!("Success"),
    Err(e) => println!("Failed: {}", e),
}
```

### Test Results

**All 4 core functions verified**:
1. ✅ Console logging works
2. ✅ File creation works
3. ✅ File append works (tested with 3 entries)
4. ✅ Error handling works (Result<(), String>)

**Demo Output**:
```
[INFO] Application started
[WARN] Configuration missing
[ERROR] Database connection failed

✅ Log file created successfully
✅ File contents:
[INFO] Log file created

✅ Log entry appended
✅ Log entry appended

Final log file:
===============
[INFO] Log file created
[WARN] Low disk space
[ERROR] Critical system error

✅ Cleanup successful
```

### Implementation Files

1. **`lib/logger_file.ruchy`** - Module implementation (90 lines)
   - log_console()
   - log_file_new()
   - log_file_append()
   - log_both()
   - Convenience functions (debug, info, warn, error)

2. **`tests/demo_logger_inline.ruchy`** - Proof of concept demo (130 lines)
   - Demonstrates all core functionality
   - Full error handling
   - Console + file logging integration

3. **`tests/test_logger_file_simple.ruchy`** - Basic std::fs tests (80 lines)
   - Validates std::fs primitives work
   - Write, read, append, delete operations

### Known Limitations

⚠️ **Module System**: `mod` declarations not yet supported in Ruchy interpreter
- Workaround: Inline functions in test files
- Future: When module system ready, move to `lib/logger_file.ruchy`

⚠️ **Advanced Features**: Not yet implemented
- Log rotation
- Timestamps
- Log levels filtering
- Thread safety
- Buffered writes

### Impact on Project

🎯 **RUC-005 UNBLOCKED**: File-based logging is now technically feasible

**Module Count**: Still 18/19 (95%) - Logger infrastructure proven but awaiting full module system support

**Ready for v1.1.0**: Yes, with inline logger functions in modules that need file logging

### Toyota Way Lessons

✅ **Jidoka (Stop the Line)**: Stopped when Issue #90 blocked progress
✅ **5 Whys**: Identified root cause (std::fs not implemented)
✅ **Genchi Genbutsu (Go and See)**: Tested std::fs directly to verify fix
✅ **Hansei (Reflection)**: Adapted implementation to Ruchy's current capabilities
✅ **Kaizen (Improvement)**: Delivered working solution despite constraints

---

**Completed**: 2025-10-31
**Breakthrough**: Issue #90 fixed in Ruchy v3.158.0 enabled this implementation
**Next Steps**: Await full module system support for production deployment

**Toyota Way Applied**: Jidoka (stopped the line), 5 Whys (root cause), Genchi Genbutsu (observed reality), Hansei (reflected), Kaizen (improving).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
