# SEARCH-010: Search CLI Command

**Priority**: P0 (Critical)
**Estimate**: 2 hours
**Status**: 🔴 RED PHASE

## Objective
Create a command-line interface for semantic script search that integrates all components.

## Technical Requirements
1. ⏳ CLI argument parsing (query, options)
2. ⏳ Environment configuration loading (.env)
3. ⏳ Component initialization (Client, Repository, Embedder, Search)
4. ⏳ Search execution with user query
5. ⏳ Formatted result output
6. ⏳ Options: --category, --limit, --min-similarity
7. ⏳ Error handling and user-friendly messages
8. ⏳ Help documentation

## Dependencies
- SEARCH-001: TursoClient
- SEARCH-003: EmbeddingGenerator
- SEARCH-005: ScriptRepository
- SEARCH-006: VectorSearch

## Progress
- [x] Ticket document created
- [ ] RED: Failing tests written
- [ ] GREEN: Implementation
- [ ] REFACTOR: Code cleanup
- [ ] QUALITY GATE: Tests + coverage

## Test Plan
- Argument parsing (query, flags)
- Configuration loading
- Component initialization
- Search execution
- Output formatting
- Error handling (missing config, API errors)
- Help text display

## Implementation Notes
- Use Deno CLI argument parsing
- Load from .env for configuration
- Graceful error messages for users
- Formatted output with similarity scores
- Support for filtering options

## CLI Interface
```bash
# Basic search
deno run scripts/search.ts "configure audio settings"

# With category filter
deno run scripts/search.ts "fix microphone" --category=audio

# With limit
deno run scripts/search.ts "gpu setup" --limit=5

# With similarity threshold
deno run scripts/search.ts "davinci resolve" --min-similarity=0.7

# Help
deno run scripts/search.ts --help
```

## Output Format
```
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

## Next Steps
After completion:
- Integration testing with real database
- Performance benchmarking
- User documentation

**Estimated Time**: 2 hours
