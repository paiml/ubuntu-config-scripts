# RUCHY-004: Convert lib/config.ts to Pure Ruchy

## Status: BLOCKED 🚫 - Compiler Bug

### Ticket Information
- **ID**: RUCHY-004
- **Title**: Convert lib/config.ts to Ruchy
- **Phase**: Phase 1 - Foundation Libraries
- **Priority**: High
- **Complexity**: Medium
- **Estimated Hours**: 16

### Scope

Converting ConfigManager class for JSON configuration management:

#### Core Structure (1 struct)
- `ConfigManager` - Configuration manager with nested key support

#### File Operations (2 methods)
- `load()` - Load JSON config from file
- `save()` - Save JSON config to file

#### Data Access (4 methods)
- `get<T>()` - Get nested value with dot notation (e.g., "server.port")
- `set()` - Set nested value with dot notation
- `has()` - Check if key exists
- `delete()` - Delete key

#### Data Manipulation (2 methods)
- `merge()` - Deep merge another config
- `to_json()` - Export as plain JSON

#### Helper Functions (1 function)
- `load_config()` - Create and load config manager

### Blocker

**Issue**: ruchy#68 - Two &str parameters + String return type causes parse error

**Symptoms**:
- Methods like `fun get_string(&self, key: &str, default: &str) -> String` fail to parse
- Error: "Function parameters must be simple identifiers or destructuring patterns"
- Combination of two `&str` params + `String` return triggers bug
- Either condition alone works fine

**Minimal Reproduction**: `ruchy/tests/test_config_minimal.ruchy`

**GitHub Issue**: https://github.com/paiml/ruchy/issues/68

**Impact**: Cannot implement standard config API pattern `get_string(key, default)`

### Progress

#### RED Phase: Tests Written - PARTIAL ⏸️
- **Status**: Blocked by compiler bug
- **Tests Written**: 19/20 tests (missing merge tests due to HashMap param issue)
- **File**: `ruchy/tests/test_config.ruchy`
- **Blocker**: Cannot complete due to issue #68

### TypeScript Source
- **Original**: `scripts/lib/config.ts` (167 lines)
- **Target**: `ruchy/lib/config_v2.ruchy`
- **API Parity**: Maintain same interface for config management

### Notes on Ruchy Adaptation

**JSON Handling**: Use `serde_json::Value` for dynamic JSON
**File I/O**: Use `std::fs` for file operations
**Error Handling**: Use `Result<T, String>` for fallible operations
**Nested Keys**: Split by "." and traverse nested maps
**Type Safety**: Generic `get<T>()` with type inference

### Test Coverage Plan

**20 Tests Planned**:
1. ConfigManager creation with/without path
2. Load config from existing file
3. Load config with missing file (use defaults)
4. Load config with invalid JSON (error)
5. Save config to file
6. Save config without path (error)
7. Get simple key
8. Get nested key with dot notation
9. Get missing key with default value
10. Get deeply nested key
11. Set simple key
12. Set nested key (auto-create parent objects)
13. Set deeply nested key
14. Has existing key
15. Has missing key
16. Has nested key
17. Delete simple key
18. Delete nested key
19. Merge configs (simple)
20. Merge configs (deep merge nested objects)
21. toJSON export
22. Load config helper function

### Files Created

```
ruchy/
├── tests/
│   ├── test_config.ruchy           # 19 tests (PARTIAL - blocked)
│   └── test_config_minimal.ruchy   # Minimal reproduction for issue #68
└── RUCHY-ISSUE-TWO-STR-STRING.md   # Bug documentation
```

---

**Status**: BLOCKED by ruchy#68
**Last Updated**: 2025-10-28
**GitHub Issue**: https://github.com/paiml/ruchy/issues/68
**Next**: Wait for compiler fix, then resume RED phase
