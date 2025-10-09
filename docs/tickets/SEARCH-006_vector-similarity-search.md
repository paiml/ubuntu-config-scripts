# SEARCH-006: Vector Similarity Search

**Priority**: P0 (Critical)
**Estimate**: 3 hours
**Status**: ✅ COMPLETE

## Objective
Implement vector similarity search using cosine similarity to find semantically similar scripts.

## Technical Requirements
1. ✅ Cosine similarity calculation between vectors
2. ✅ Search method with query embedding
3. ✅ Ranking by similarity score (descending)
4. ✅ Top-N results filtering
5. ✅ Optional category filtering
6. ✅ Minimum similarity threshold
7. ✅ Integration with EmbeddingGenerator and ScriptRepository

## Dependencies
- SEARCH-003: EmbeddingGenerator (query embedding)
- SEARCH-005: ScriptRepository (data access)

## Progress
- [x] Ticket document created
- [x] RED: 14 failing tests written
- [x] GREEN: Implementation with 95.8% coverage
- [x] REFACTOR: Not needed (clean implementation)
- [x] QUALITY GATE: All tests pass

## Test Results
- **Unit Tests**: 14 passing
- **Coverage**: 95.8% line, 96.0% branch
- **Time**: ~83ms

## Files Created
- `scripts/lib/vector-search.ts` (142 lines)
- `tests/lib/vector-search.test.ts` (14 tests)

## Implementation Details
- **Cosine Similarity**: dot(A, B) / (||A|| * ||B||) with proper normalization
- **Range**: -1 (opposite) to 1 (identical), 0 for orthogonal
- **Zero Vector Handling**: Returns 0 similarity for safety
- **In-Memory Computation**: Calculates similarity for all scripts in memory
- **Efficient Sorting**: Single sort after all similarities computed
- **Edge Cases**: Handles missing embeddings, zero vectors, normalized vectors

## Algorithm
```typescript
1. Validate query and options
2. Generate embedding for query text (via EmbeddingGenerator)
3. Fetch all scripts from repository (with optional category filter)
4. For each script with embedding:
   - Calculate cosine similarity
   - Filter by minSimilarity threshold
5. Sort results by similarity descending
6. Return top N results
```

## Performance Characteristics
- **Time Complexity**: O(n * d) where n = scripts, d = embedding dimensions
- **Space Complexity**: O(n) for results array
- **Current**: In-memory computation suitable for thousands of scripts
- **Future**: LibSQL vector extension for native vector operations

## API Usage
```typescript
const search = new VectorSearch({
  repository: scriptRepository,
  embedder: embeddingGenerator,
});

// Basic search - top 10 results
const results = await search.search("configure audio settings", {
  topN: 10,
});

// Search with category filter
const audioResults = await search.search("fix microphone", {
  topN: 5,
  category: "audio",
});

// Search with similarity threshold (only high-quality matches)
const preciseResults = await search.search("davinci resolve gpu", {
  topN: 10,
  minSimilarity: 0.7,
});

// Process results
for (const result of results) {
  console.log(`${result.script.name}: ${result.similarity.toFixed(3)}`);
  console.log(`  ${result.script.description}`);
}
```

## Cosine Similarity Examples
```typescript
// Identical vectors
cosineSimilarity([1, 0, 0], [1, 0, 0]) // → 1.0

// Orthogonal vectors (independent)
cosineSimilarity([1, 0, 0], [0, 1, 0]) // → 0.0

// Opposite vectors
cosineSimilarity([1, 0, 0], [-1, 0, 0]) // → -1.0

// Similar but not identical
cosineSimilarity([1, 0.1, 0], [1, 0.2, 0]) // → ~0.99
```

## Next Steps
- SEARCH-010: Search CLI command for end-to-end usage
- Performance optimization: Batch similarity computation
- Future: LibSQL vector extension integration

**Commits**:
- 857255a: [SEARCH-006] RED: failing tests for vector similarity search
- bb89953: [SEARCH-006] GREEN: Vector similarity search implementation with 14 passing tests
