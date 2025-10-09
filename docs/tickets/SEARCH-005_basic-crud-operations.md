# SEARCH-005: Basic CRUD Operations

**Priority**: P0 (Critical)
**Estimate**: 2 hours
**Status**: ✅ COMPLETE

## Objective
Implement basic CRUD (Create, Read, Update, Delete) operations for script records in the database.

## Technical Requirements
1. ✅ Create single script record
2. ✅ Read script by ID
3. ✅ Read script by path
4. ✅ Update script metadata
5. ✅ Delete script by ID
6. ✅ List scripts with pagination
7. ✅ List scripts by category
8. ✅ Count scripts

## Dependencies
- SEARCH-001: TursoClient (database access)
- SEARCH-004: DatabaseSeeder (schema definition)

## Progress
- [x] Ticket document created
- [x] RED: 17 failing tests written
- [x] GREEN: Implementation with 73.1% coverage
- [x] REFACTOR: Not needed (clean implementation)
- [x] QUALITY GATE: All tests pass

## Test Results
- **Unit Tests**: 17 passing
- **Coverage**: 73.1% line, 62.5% branch
- **Time**: ~47ms

## Files Created
- `scripts/lib/script-repository.ts` (273 lines)
- `tests/lib/script-repository.test.ts` (17 tests)

## Implementation Details
- **Create**: Validates required fields, returns auto-increment ID
- **Read**: getById and getByPath with null for not found
- **Update**: Partial updates with field validation
- **Delete**: By ID with validation
- **List**: Pagination with LIMIT/OFFSET, optional category filter
- **Count**: Total or by category
- **Categories**: List all distinct categories
- **Type Safety**: JSON parsing for tags, dependencies, embeddings
- **NULL Handling**: Optional fields omitted if null (exactOptionalPropertyTypes compliance)

## API Usage
```typescript
const repo = new ScriptRepository(tursoClient);

// Create
const id = await repo.create({
  name: "configure-audio",
  path: "/scripts/audio/configure-audio.ts",
  category: "audio",
  description: "Configure audio settings",
  tags: ["audio", "config"],
  dependencies: ["./lib/common.ts"],
  embedding: [0.1, 0.2, ...],
  tokens: 42,
});

// Read
const script = await repo.getById(id);
const byPath = await repo.getByPath("/scripts/audio/configure-audio.ts");

// Update
await repo.update(id, {
  description: "Updated description",
  tags: ["audio", "config", "pipewire"],
});

// Delete
await repo.delete(id);

// List with pagination
const scripts = await repo.list({
  limit: 10,
  offset: 0,
  category: "audio", // optional
});

// Count
const total = await repo.count();
const audioCount = await repo.count("audio");

// Categories
const categories = await repo.listCategories();
// ["audio", "dev", "system"]
```

## Next Steps
- SEARCH-006: Vector similarity search implementation
- SEARCH-010: Search CLI command

**Commits**:
- 10430dc: [SEARCH-005] RED: failing tests for CRUD operations
- d866516: [SEARCH-005] GREEN: CRUD operations implementation with 17 passing tests
