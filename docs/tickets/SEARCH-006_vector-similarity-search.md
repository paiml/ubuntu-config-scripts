# SEARCH-006: Vector Similarity Search

**Priority**: P0 (Critical)
**Estimate**: 3 hours
**Status**: 🔴 RED PHASE

## Objective
Implement vector similarity search using cosine similarity to find semantically similar scripts.

## Technical Requirements
1. ⏳ Cosine similarity calculation between vectors
2. ⏳ Search method with query embedding
3. ⏳ Ranking by similarity score (descending)
4. ⏳ Top-N results filtering
5. ⏳ Optional category filtering
6. ⏳ Minimum similarity threshold
7. ⏳ Integration with EmbeddingGenerator and ScriptRepository

## Dependencies
- SEARCH-003: EmbeddingGenerator (query embedding)
- SEARCH-005: ScriptRepository (data access)

## Progress
- [x] Ticket document created
- [ ] RED: Failing tests written
- [ ] GREEN: Implementation
- [ ] REFACTOR: Code cleanup
- [ ] QUALITY GATE: Tests + coverage

## Test Plan
- Cosine similarity calculation accuracy
- Vector normalization
- Search with query string
- Top-N filtering
- Category filtering
- Similarity threshold filtering
- Empty results handling
- Edge cases (zero vectors, identical vectors)

## Implementation Notes
- Cosine similarity: dot(A, B) / (||A|| * ||B||)
- Range: -1 (opposite) to 1 (identical)
- Efficient vector operations
- In-memory similarity computation (SQLite doesn't have native vector ops)
- Future: LibSQL vector extension for better performance

## Algorithm
```
1. Generate embedding for query text
2. Fetch all scripts (or by category)
3. Calculate cosine similarity for each script
4. Filter by minimum threshold
5. Sort by similarity descending
6. Return top N results
```

## Next Steps
After completion:
- SEARCH-010: Search CLI command
- SEARCH-007: Query parser and advanced ranking

**Estimated Time**: 3 hours
