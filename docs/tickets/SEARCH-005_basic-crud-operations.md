# SEARCH-005: Basic CRUD Operations

**Priority**: P0 (Critical)
**Estimate**: 2 hours
**Status**: 🔴 RED PHASE

## Objective
Implement basic CRUD (Create, Read, Update, Delete) operations for script records in the database.

## Technical Requirements
1. ⏳ Create single script record
2. ⏳ Read script by ID
3. ⏳ Read script by path
4. ⏳ Update script metadata
5. ⏳ Delete script by ID
6. ⏳ List scripts with pagination
7. ⏳ List scripts by category
8. ⏳ Count scripts

## Dependencies
- SEARCH-001: TursoClient (database access)
- SEARCH-004: DatabaseSeeder (schema definition)

## Progress
- [x] Ticket document created
- [ ] RED: Failing tests written
- [ ] GREEN: Implementation
- [ ] REFACTOR: Code cleanup
- [ ] QUALITY GATE: Tests + coverage

## Test Plan
- Create operations with validation
- Read operations (by ID, by path, not found cases)
- Update operations with partial updates
- Delete operations (existing and non-existing)
- List operations with pagination
- Category filtering
- Count operations

## Implementation Notes
- Build on TursoClient wrapper
- Type-safe interfaces for script records
- Proper NULL handling for optional fields
- Validation for required fields
- Efficient pagination queries

## Next Steps
After completion:
- SEARCH-006: Vector similarity search implementation
- SEARCH-007: Search query parser and ranking

**Estimated Time**: 2 hours
