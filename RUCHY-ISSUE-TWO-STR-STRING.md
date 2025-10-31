# Ruchy Compiler Bug: Two &str Parameters + String Return Type

## Issue Summary
Methods with two `&str` parameters that return `String` cause a syntax error:
"Function parameters must be simple identifiers or destructuring patterns"

## Minimal Reproduction
File: `ruchy/tests/test_config_minimal.ruchy`

```ruchy
use std::collections::HashMap;

struct ConfigManager {
    config: HashMap<String, String>,
    config_path: String,
    has_path: bool,
}

impl ConfigManager {
    fun new() -> ConfigManager {
        panic!("Not implemented");
    }

    fun new_with_path(path: &str) -> ConfigManager {
        panic!("Not implemented");
    }

    fun load(&mut self) {
        panic!("Not implemented");
    }

    fun save(&self) {
        panic!("Not implemented");
    }

    fun has(&self, key: &str) -> bool {
        panic!("Not implemented");
    }

    // ✅ THIS WORKS
    fun test_two_refs_bool(&self, key: &str, value: &str) -> bool {
        panic!("Not implemented");
    }

    // ❌ THIS FAILS
    fun test_two_refs_string(&self, key: &str, default: &str) -> String {
        panic!("Not implemented");
    }
}

fun main() {
    println!("Test");
}
```

## Error Output
```
✗ ruchy/tests/test_config_minimal.ruchy:41: Syntax error: Function parameters must be simple identifiers or destructuring patterns
```

## Tested Combinations

| Params | Return Type | Result |
|--------|-------------|--------|
| `(&self, key: &str)` | `bool` | ✅ Works |
| `(&self, key: &str, value: &str)` | `bool` | ✅ Works |
| `(&self, key: &str)` | `String` | ✅ Works |
| `(&self, key: &str, default: &str)` | `String` | ❌ FAILS |

## Analysis
The combination of:
1. Two `&str` parameters (in addition to `&self`)
2. Returning `String` type

Triggers a parse error. Either condition alone works fine, but together they fail.

## Environment
- Ruchy version: v3.140.0
- File: ruchy/tests/test_config_minimal.ruchy
- Blocking ticket: RUCHY-004 (Config Manager conversion)

## Workaround
None found yet. This blocks implementing `get_string(&self, key: &str, default: &str) -> String` pattern.

## Impact
**Severity**: High - blocks common config management pattern
**Scope**: Any method needing two string refs with string return
**Ticket**: RUCHY-004 RED phase blocked

---

**Created**: 2025-10-28
**Status**: Ready to file GitHub issue
