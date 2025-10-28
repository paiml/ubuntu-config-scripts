# RUCHY BUG REPORT: Misleading "Expected type" Error

## **STOP THE LINE**

Following Toyota Production System philosophy, halting RUCHY-001 development to file this bug.

## Bug Description

`ruchy check` reports "Expected type" syntax error with incorrect line number, making it impossible to identify the actual syntax issue.

## Minimal Reproduction

```ruchy
// File: ruchy/lib/logger_v3.ruchy (75 lines total)
use chrono::Utc;

enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
}

struct Logger {
    level: LogLevel,
    prefix: String,
    use_colors: bool,
}

impl Logger {
    fun new() -> Logger {
        Logger {
            level: LogLevel::Info,
            prefix: String::new(),
            use_colors: true,
        }
    }

    fun get_color(level: &LogLevel, use_colors: bool) -> &'static str {
        if !use_colors {
            return "";
        }

        match level {
            LogLevel::Debug => "\x1b[90m",
            LogLevel::Info => "\x1b[34m",
            LogLevel::Warn => "\x1b[33m",
            LogLevel::Error => "\x1b[31m",
        }
    }

    fun info(&self, message: &str) {
        // ... implementation
    }
}
```

## Expected Behavior

- Either syntax should be valid and pass `ruchy check`
- OR error message should clearly indicate which line/token has the syntax error
- OR error message should explain what type is expected and why

## Actual Behavior

```bash
$ ruchy check ruchy/lib/logger_v3.ruchy
✗ ruchy/lib/logger_v3.ruchy:76: Syntax error: Expected type
Error: ruchy/lib/logger_v3.ruchy:76: Syntax error: Expected type
```

**Problems**:
1. Line 76 doesn't exist (file is 75 lines)
2. "Expected type" is not specific enough
3. Cannot determine which token/construct is causing the error

##Environment

```bash
$ ruchy --version
ruchy 3.139.0

$ lsb_release -a
Distributor ID:	Ubuntu
Description:	Ubuntu 22.04.3 LTS
Release:	22.04
Codename:	jammy

$ cargo --version
cargo 1.83.0 (5ffbef321 2024-10-29)
```

## Additional Context

### Attempts to Isolate

1. Removed `#[derive(...)]` attributes - still fails
2. Simplified to minimal enum + struct + impl - still fails
3. `ruchy transpile` gives same error without line number
4. `ruchy run` times out silently (separate issue?)

### Working Examples

The following Ruchy code from `../rosetta-ruchy` DOES work:

```ruchy
enum Priority {
    Low = 1,
    Normal = 2,
    High = 3,
}

impl Process {
    fun new(id: &str, priority: Priority) -> Self {
        Self {
            id: id.to_string(),
            priority,
        }
    }
}
```

### Suspected Issues

1. Maybe `fun` in `impl` block with certain signatures?
2. Maybe `match` on enum with `&` reference?
3. Maybe `&'static str` return type?
4. Maybe combination of features?

## Impact

**BLOCKS**: RUCHY-001 (logger conversion) - cannot proceed with GREEN phase
**SEVERITY**: High - prevents basic Ruchy development workflow
**WORKAROUND**: None identified yet

## Next Steps

1. File issue at `git@github.com:paiml/ruchy.git`
2. Wait for fix or clarification
3. Do NOT work around - need proper solution
4. Track as "BLOCKED: ruchy#XXX" in RUCHY-001-STATUS.md

---

**Filed**: 2025-10-28
**Status**: BLOCKED - Awaiting Ruchy team response
