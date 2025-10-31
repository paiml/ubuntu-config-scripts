# RUC-005: Logger Module

**Date**: 2025-10-30
**Status**: 🔴 **BLOCKED** - std::fs not implemented (Issue #90)
**Priority**: HIGH (infrastructure for all modules)
**Methodology**: Extreme TDD (RED → GREEN → REFACTOR)
**Depends On**: Ruchy v3.150.0 ✅, Issue #90 resolution
**Estimated Time**: 45-60 minutes (when unblocked)
**Blocker**: [Issue #90](https://github.com/paiml/ruchy/issues/90) - std::fs file I/O not available

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

**Ready to Start**: Module system proven, extreme TDD ready, file I/O discovery planned!

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
