# SEARCH-004: Database Seeding

**Priority**: P0 (Critical)
**Estimate**: 2 hours
**Status**: 🔴 RED PHASE

## Objective
Seed Turso database with script metadata and vector embeddings for semantic search.

## Technical Requirements
1. ⏳ Database schema creation (scripts table with vector column)
2. ⏳ Script discovery and analysis
3. ⏳ Batch embedding generation
4. ⏳ Data insertion with transaction support
5. ⏳ Progress tracking and error handling
6. ⏳ Idempotent seeding (skip already indexed scripts)

## Dependencies
- SEARCH-001: TursoClient (database access)
- SEARCH-002: ScriptAnalyzer (metadata extraction)
- SEARCH-003: EmbeddingGenerator (vector generation)

## Progress
- [x] Ticket document created
- [ ] RED: Failing tests written
- [ ] GREEN: Implementation
- [ ] REFACTOR: Code cleanup
- [ ] QUALITY GATE: Tests + coverage

## Test Plan
- Database schema creation
- Script discovery from directories
- Metadata extraction integration
- Embedding generation integration
- Batch insertion with transactions
- Duplicate handling (UPDATE vs INSERT)
- Error recovery and partial failures
- Progress tracking

## Implementation Notes
- Combine ScriptAnalyzer + EmbeddingGenerator + TursoClient
- Use Turso vector extension for embeddings
- Batch processing for efficiency
- Transaction support for atomicity
- Skip already indexed scripts (based on path + last modified time)

## Next Steps
After completion:
- SEARCH-005: Basic CRUD operations for scripts
- SEARCH-006: Vector similarity search implementation
