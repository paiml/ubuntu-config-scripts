# RUCHY-003: Convert lib/schema.ts to Pure Ruchy (Serde)

## Status: RED Phase In Progress 🔴

### Ticket Information
- **ID**: RUCHY-003
- **Title**: Convert lib/schema.ts to Ruchy (Serde)
- **Phase**: Phase 1 - Foundation Libraries
- **Priority**: High
- **Complexity**: High
- **Estimated Hours**: 20

### Scope

Converting Zod-like schema validation to Ruchy using serde:

#### Schema Types (5 types)
- `StringSchema` - String validation with min/max/pattern
- `NumberSchema` - Number validation with min/max/int
- `BooleanSchema` - Boolean validation
- `ArraySchema<T>` - Array validation with item schema
- `ObjectSchema` - Object validation with field schemas

#### Core Operations (2 methods per schema)
- `parse()` - Parse and validate, panic on error
- `safe_parse()` - Parse and validate, return Result

#### Ruchy Approach
- Use Rust's `serde` for serialization/deserialization
- Use `Result<T, String>` instead of TypeScript union types
- Builder pattern for schema constraints
- Type-safe validation at compile time where possible

### Progress

#### RED Phase: Tests Written
- **Status**: In Progress
- **Target**: 15+ tests covering validation scenarios

### TypeScript Source
- **Original**: `scripts/lib/schema.ts` (250+ lines)
- **Target**: `ruchy/lib/schema_v2.ruchy`
- **API Adaptation**: Zod → serde + manual validation

### Notes on Ruchy Adaptation

**Serde Integration**: Use `#[derive(Serialize, Deserialize)]` for structs
**Result Type**: `Result<T, String>` for validation results
**Builder Pattern**: Method chaining for constraints
**Generics**: Support for `Schema<T>` pattern

---

**Status**: RED phase complete ✅
**Last Updated**: 2025-10-28
**Tests**: 15 validation tests written in test_schema.ruchy
**Next**: Wait for ruchy#67 resolution, then implement GREEN phase
