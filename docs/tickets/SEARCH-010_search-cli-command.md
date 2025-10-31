# SEARCH-010: Search CLI Command

**Priority**: P0 (Critical)
**Estimate**: 2 hours
**Status**: ✅ COMPLETE

## Objective
Create a command-line interface for semantic script search that integrates all components.

## Technical Requirements
1. ✅ CLI argument parsing (query, options)
2. ✅ Environment configuration loading (.env)
3. ✅ Component initialization (Client, Repository, Embedder, Search)
4. ✅ Search execution with user query
5. ✅ Formatted result output
6. ✅ Options: --category, --limit, --min-similarity
7. ✅ Error handling and user-friendly messages
8. ✅ Help documentation

## Dependencies
- SEARCH-001: TursoClient
- SEARCH-003: EmbeddingGenerator
- SEARCH-005: ScriptRepository
- SEARCH-006: VectorSearch

## Progress
- [x] Ticket document created
- [x] RED: 14 failing tests written
- [x] GREEN: Implementation with 63.0% coverage
- [x] REFACTOR: Not needed (clean implementation)
- [x] QUALITY GATE: All tests pass

## Test Results
- **Unit Tests**: 14 passing
- **Coverage**: 63.0% line, 81.2% branch (for tested functions)
- **Time**: ~44ms

## Files Created
- `scripts/search.ts` (237 lines) - Executable CLI script
- `tests/search.test.ts` (14 tests)

## Implementation Details
- **Argument Parsing**: Manual parsing with support for flags and multi-word queries
- **Configuration**: Environment variables loaded from .env file
- **Error Handling**: User-friendly error messages for missing config, invalid arguments
- **Output Format**: Structured display with similarity scores, categories, descriptions, usage
- **Help System**: Complete help text with examples
- **Integration**: Combines all 4 core components seamlessly

## Usage

### Prerequisites
Create a `.env` file with required configuration:
```bash
TURSO_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token-here
OPENAI_API_KEY=sk-your-api-key-here

# Optional
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
```

### Command-Line Interface
```bash
# Basic search (requires --allow-env --allow-net --allow-read)
deno run --allow-env --allow-net --allow-read scripts/search.ts "configure audio settings"

# With category filter
deno run --allow-env --allow-net --allow-read scripts/search.ts "fix microphone" --category=audio

# With result limit
deno run --allow-env --allow-net --allow-read scripts/search.ts "gpu setup" --limit=5

# With similarity threshold (only show high-quality matches)
deno run --allow-env --allow-net --allow-read scripts/search.ts "davinci resolve" --min-similarity=0.7

# Combined options
deno run --allow-env --allow-net --allow-read scripts/search.ts \
  "audio configuration" \
  --category=audio \
  --limit=3 \
  --min-similarity=0.6

# Help
deno run scripts/search.ts --help
```

### Executable Script
The script has a shebang for direct execution:
```bash
# Make executable (one time)
chmod +x scripts/search.ts

# Run directly
./scripts/search.ts "configure audio settings"
```

## Output Format
```
Searching for: "configure audio settings"

Found 3 results:

[0.95] configure-speakers
  Category: audio
  Configure external speaker settings
  Usage: deno run scripts/audio/configure-speakers.ts

[0.87] enable-mic
  Category: audio
  Enable and configure microphone
  Usage: deno run scripts/audio/enable-mic.ts

[0.72] fix-audio
  Category: audio
  Troubleshoot audio issues
  Usage: deno run scripts/audio/fix-audio.ts
```

## Error Handling
The CLI provides helpful error messages:

```bash
# Missing query
$ deno run scripts/search.ts
Error: Missing required argument: query

# Missing environment variables
$ deno run scripts/search.ts "test"
Error: Missing required environment variable: TURSO_URL

# API errors
$ deno run scripts/search.ts "test"
Error: Failed to generate embedding: Rate limit exceeded
```

## Integration

The CLI integrates all semantic search components:

```typescript
// Component initialization
const tursoClient = new TursoClient({ url, authToken });
const repository = new ScriptRepository(tursoClient);
const embedder = new EmbeddingGenerator({ apiKey, model });
const search = new VectorSearch({ repository, embedder });

// Search execution
const results = await search.search(query, options);

// Formatted output
console.log(formatResults(results));
```

## Next Steps
- SEARCH-011: Database seeding command to index scripts
- Integration testing with real Turso database
- Performance benchmarking with large script collections
- User documentation and examples

**Commits**:
- 7b74984: [SEARCH-010] RED: failing tests for search CLI command
- fa28e0d: [SEARCH-010] GREEN: Search CLI implementation with 14 passing tests
