# Issue #91: std::env module not available

**Upstream**: [#96](https://github.com/paiml/ruchy/issues/96) ✅ FILED 2025-10-31
**Date**: 2025-10-30
**Ruchy Version**: v3.151.0 (broken), v3.153.0 (fixed)
**Severity**: **CRITICAL** - Blocks all CLI tools requiring argument parsing
**Status**: ✅ **FIXED IN v3.153.0** 🎉 - RUC-007 UNBLOCKED!

---

## Summary

The `std::env` module is not available in Ruchy v3.151.0, preventing access to command-line arguments via `std::env::args()`. This blocks implementation of CLI tools that need argument parsing.

**Error**: `Runtime error: Object has no field named 'env'`

---

## Impact

### Blocked Functionality
- ❌ Command-line argument parsing
- ❌ CLI tools with subcommands
- ❌ Environment variable access
- ❌ Program name detection

### Blocked Projects
- **RUC-007**: System diagnostics CLI tool (ubuntu-diag)
- **Future CLIs**: All command-line tools requiring arguments

### Current Workaround
**None available** - Cannot implement CLI tools with argument parsing

---

## Minimal Reproduction

### File: `issue_91_reproduction.ruchy`

```ruchy
// Issue #91: std::env module not available
// Blocks CLI tools that need command-line argument parsing

fun main() {
    println!("=== Issue #91: std::env not available ===");
    println!("");

    // Attempt to use std::env::args()
    println!("Attempting: let args = std::env::args();");
    let args = std::env::args();

    println!("Success! Got {} arguments", args.len());
}
```

### Execution

```bash
$ ruchy run issue_91_reproduction.ruchy
"=== Issue #91: std::env not available ==="
""
"Attempting: let args = std::env::args();"
Error: Evaluation error: Runtime error: Object has no field named 'env'
```

---

## Debugging Data

### 1. Parse Output (ruchy parse)

**Status**: ✅ Parses correctly

The AST shows the code parses successfully:
```
Expr {
    kind: Function {
        name: "main",
        ...
        body: Expr {
            kind: Block([
                // println! statements
                Expr {
                    kind: Let {
                        pattern: "args",
                        value: Expr {
                            kind: Access {
                                object: std::env,
                                field: "args",
                            }
                        }
                    }
                }
            ])
        }
    }
}
```

**Analysis**: The code structure is valid, but runtime evaluation fails.

### 2. Trace Output (ruchy --trace run)

```bash
$ ruchy --trace run issue_91_reproduction.ruchy
"=== Issue #91: std::env not available ==="
""
"Attempting: let args = std::env::args();"
Error: Evaluation error: Runtime error: Object has no field named 'env'
```

**Analysis**: Runtime fails when attempting to access `std::env`.

### 3. ruchydbg Output

```bash
$ ruchydbg run issue_91_reproduction.ruchy
🔍 Running: issue_91_reproduction.ruchy
⏱️  Timeout: 5000ms

"=== Issue #91: std::env not available ==="
""
"Attempting: let args = std::env::args();"
Error: Evaluation error: Runtime error: Object has no field named 'env'

⏱️  Execution time: 11ms
❌ FAILED with exit code: 1
```

**Analysis**: Execution time is fast (11ms), failure is immediate on std::env access.

---

## Expected Behavior

### Rust Standard Library Equivalent

```rust
// In Rust, this works:
fn main() {
    let args: Vec<String> = std::env::args().collect();

    println!("Program: {}", args[0]);
    println!("Arguments: {}", args.len() - 1);

    for (i, arg) in args.iter().enumerate() {
        println!("  arg[{}]: {}", i, arg);
    }
}
```

### Expected Ruchy Usage

```ruchy
fun main() {
    let args = std::env::args();

    println!("Program: {}", args[0]);
    println!("Arguments: {}", args.len() - 1);

    let mut i = 0;
    while i < args.len() {
        println!("  arg[{}]: {}", i, args[i]);
        i = i + 1;
    }
}
```

### Expected CLI Pattern

```ruchy
use diagnostics;

fun main() {
    let args = std::env::args();

    if args.len() < 2 {
        // No arguments, run default command
        cmd_all();
        return;
    }

    let command = args[1];

    match command {
        "audio" => cmd_audio(),
        "video" => cmd_video(),
        "services" => cmd_services(),
        "help" => cmd_help(),
        _ => {
            println!("Unknown command: {}", command);
            cmd_help();
        }
    }
}
```

---

## Related Issues

- **Issue #90**: std::fs file I/O not available (similar std module missing)
- **Issue #89**: Stdlib use statements in modules (related to std:: access)

---

## Proposed Implementation

### Phase 1: Basic args() Support

Implement `std::env::args()` that returns `Vec<String>`:

```ruchy
// Minimum viable implementation
let args = std::env::args();  // Returns Vec<String>
println!("Args: {}", args.len());
println!("Program: {}", args[0]);

if args.len() > 1 {
    let command = args[1];
    // Process command
}
```

### Phase 2: Environment Variables (Optional)

```ruchy
// Future enhancement
let home = std::env::var("HOME");
match home {
    Ok(path) => println!("HOME: {}", path),
    Err(_) => println!("HOME not set"),
}
```

### Phase 3: Program Info (Optional)

```ruchy
// Future enhancement
let exe = std::env::current_exe();
let dir = std::env::current_dir();
```

---

## Use Cases

### 1. CLI Tools with Subcommands

```ruchy
// ubuntu-diag audio
// ubuntu-diag video
// ubuntu-diag services

fun main() {
    let args = std::env::args();
    let command = if args.len() > 1 { args[1] } else { "all" };

    match command {
        "audio" => run_audio_diag(),
        "video" => run_video_diag(),
        "services" => run_service_diag(),
        "all" => run_all_diag(),
        _ => show_help(),
    }
}
```

### 2. Configuration Scripts

```ruchy
// configure-audio.ruchy --device "Scarlett 4i4" --volume 75

fun main() {
    let args = std::env::args();

    let mut i = 1;
    while i < args.len() {
        if args[i] == "--device" {
            let device = args[i + 1];
            i = i + 2;
        } else if args[i] == "--volume" {
            let volume = args[i + 1];
            i = i + 2;
        }
    }
}
```

### 3. System Administration Tools

```ruchy
// ubuntu-service start pipewire
// ubuntu-service stop pipewire
// ubuntu-service status pipewire

fun main() {
    let args = std::env::args();

    if args.len() < 3 {
        println!("Usage: ubuntu-service <command> <service>");
        return;
    }

    let command = args[1];
    let service = args[2];

    match command {
        "start" => start_service(service),
        "stop" => stop_service(service),
        "status" => show_status(service),
        _ => println!("Unknown command: {}", command),
    }
}
```

---

## Workaround Analysis

### Attempted Workarounds

1. ❌ **Pass args via environment variables**: Would need std::env::var()
2. ❌ **Read from stdin**: Requires user interaction, not suitable for CLI
3. ❌ **Use config files**: Requires std::fs (Issue #90)
4. ❌ **Hardcode commands**: Defeats purpose of CLI tool

### Current Solution

**Cannot implement CLI tools** - Must wait for std::env support

---

## Testing

### Test Case 1: Basic args() Access

```ruchy
fun test_args_access() {
    let args = std::env::args();
    assert!(args.len() >= 1);  // At least program name
    println!("✓ args() access works");
}
```

### Test Case 2: Argument Parsing

```ruchy
fun test_arg_parsing() {
    let args = std::env::args();

    if args.len() > 1 {
        let first_arg = args[1];
        println!("✓ First argument: {}", first_arg);
    }
}
```

### Test Case 3: Multi-Argument

```ruchy
fun test_multi_args() {
    let args = std::env::args();

    let mut i = 0;
    while i < args.len() {
        println!("✓ arg[{}]: {}", i, args[i]);
        i = i + 1;
    }
}
```

---

## Priority Justification

### Critical Severity Rationale

1. **Blocks CLI Development**: Cannot build command-line tools
2. **Common Use Case**: Most system scripts need argument parsing
3. **No Workaround**: Unlike some issues, no alternative approach exists
4. **Fundamental Feature**: CLI args are basic requirement for system tools

### Impact on Project

- **ubuntu-config-scripts**: 6+ CLI tools planned, all blocked
- **Ruchy adoption**: Limits use cases for systems programming
- **Developer experience**: Expected feature for CLI-focused language

---

## Comparison with Other std Modules

| Module | Status | Issue | Impact |
|--------|--------|-------|---------|
| `std::process::Command` | ✅ Works | N/A | System integration possible |
| `std::env` | ❌ Missing | **#91** | **CLI tools blocked** |
| `std::fs` | ❌ Missing | #90 | File operations blocked |
| `std::String` | ✅ Works | N/A | String operations work |
| `std::Vec` | ✅ Works | N/A | Collections work |

**Pattern**: Core runtime features work, but stdlib modules are incomplete

---

## Requested Features

### Minimum Required

- `std::env::args()` - Returns `Vec<String>` of command-line arguments
  - `args[0]` = program name/path
  - `args[1..]` = user-provided arguments

### Nice to Have

- `std::env::var(name: String)` - Get environment variable
- `std::env::vars()` - Get all environment variables
- `std::env::current_dir()` - Get working directory
- `std::env::current_exe()` - Get executable path

---

## References

- **Rust std::env**: https://doc.rust-lang.org/std/env/
- **Issue #90**: std::fs file I/O not available
- **Issue #89**: Stdlib use in modules
- **RUC-007**: Diagnostics CLI (blocked by this issue)

---

## To File Upstream

```markdown
# Feature Request: Implement std::env module

**Version**: Ruchy v3.151.0
**Priority**: High - Blocks CLI tool development

## Problem

`std::env` module is not available, preventing command-line argument parsing.

**Error**: `Runtime error: Object has no field named 'env'`

## Minimal Reproduction

```ruchy
fun main() {
    let args = std::env::args();  // Error: Object has no field named 'env'
    println!("Args: {}", args.len());
}
```

## Expected Behavior

Like Rust's std::env:
- `std::env::args()` - Returns Vec<String> of CLI arguments
- Enable CLI tools with subcommands and argument parsing

## Use Case

Building CLI tools like:
```bash
ubuntu-diag audio        # Run audio diagnostics
ubuntu-diag video        # Run video diagnostics
ubuntu-diag --help       # Show help
```

## Impact

Blocks all CLI tool development in Ruchy. No workaround available.

## Request

Implement `std::env::args()` to return command-line arguments as Vec<String>.
```

---

**Conclusion**: std::env is critical infrastructure for CLI tools. Without it, Ruchy cannot be used for command-line applications that need argument parsing.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
