# SEARCH-004: Database Seeding

**Priority**: P0 (Critical)
**Estimate**: 2 hours
**Status**: ✅ COMPLETE

## Objective
Seed Turso database with script metadata and vector embeddings for semantic search.

## Technical Requirements
1. ✅ Database schema creation (scripts table with vector column)
2. ✅ Script discovery and analysis
3. ✅ Batch embedding generation
4. ✅ Data insertion with transaction support
5. ✅ Progress tracking and error handling
6. ✅ Idempotent seeding (skip already indexed scripts)

## Dependencies
- SEARCH-001: TursoClient (database access)
- SEARCH-002: ScriptAnalyzer (metadata extraction)
- SEARCH-003: EmbeddingGenerator (vector generation)

## Progress
- [x] Ticket document created
- [x] RED: 14 failing tests written
- [x] GREEN: Implementation with 87.1% coverage
- [x] REFACTOR: Not needed (clean implementation)
- [x] QUALITY GATE: All tests pass

## Test Results
- **Unit Tests**: 14 passing
- **Coverage**: 87.1% line, 82.1% branch
- **Time**: ~65ms

## Files Created
- `scripts/lib/database-seeder.ts` (213 lines)
- `tests/lib/database-seeder.test.ts` (14 tests)

## Implementation Details
- **Schema**: SQLite table with BLOB column for embeddings
- **Discovery**: Recursive directory traversal for .ts files
- **Batch Processing**: All scripts analyzed, then batch embedding generation
- **Progress Tracking**: Optional callback with current/total counts
- **Error Handling**: Per-script error tracking with detailed error messages
- **Idempotent**: INSERT OR REPLACE based on unique path constraint

## Database Schema
```sql
CREATE TABLE scripts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  path TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  usage TEXT,
  tags TEXT,              -- JSON array
  dependencies TEXT,      -- JSON array
  embedding_text TEXT,    -- Text used to generate embedding
  embedding BLOB,         -- JSON-encoded vector
  tokens INTEGER,         -- Token count from embedding
  created_at DATETIME,
  updated_at DATETIME
);
```

## API Usage
```typescript
const seeder = new DatabaseSeeder({
  client: tursoClient,
  analyzer: scriptAnalyzer,
  embedder: embeddingGenerator,
  onProgress: (current, total) => {
    console.log(`Processing ${current}/${total} scripts...`);
  },
});

// Initialize schema
await seeder.initializeSchema();

// Seed scripts from directory
const result = await seeder.seedScripts("./scripts");
console.log(`Processed: ${result.processed}, Inserted: ${result.inserted}`);

// Get statistics
const stats = await seeder.getStats();
console.log(`Total scripts: ${stats.total_scripts}`);
```

## Next Steps
- SEARCH-005: Basic CRUD operations for scripts
- SEARCH-006: Vector similarity search implementation

**Commits**:
- 9d5dca0: [SEARCH-004] RED: failing tests for database seeding
- 9dcb4f9: [SEARCH-004] GREEN: Database seeder implementation with 14 passing tests
