# SEED-CLI: Database Seeding CLI Command

**Priority**: P0 (Critical)
**Estimate**: 1.5 hours
**Status**: ✅ COMPLETE

## Objective
Create a command-line tool to seed the database with script metadata and embeddings.

## Technical Requirements
1. ✅ CLI for database initialization and seeding
2. ✅ Directory traversal for script discovery
3. ✅ Progress reporting during seeding
4. ✅ Options: --directory, --force (reseed)
5. ✅ Statistics output after completion
6. ✅ Environment configuration loading
7. ✅ Error handling and recovery

## Dependencies
- SEARCH-001: TursoClient
- SEARCH-002: ScriptAnalyzer
- SEARCH-003: EmbeddingGenerator
- SEARCH-004: DatabaseSeeder

## Progress
- [x] Ticket document created
- [x] RED: 11 failing tests written
- [x] GREEN: Implementation with 30.3% coverage
- [x] REFACTOR: Not needed (clean implementation)
- [x] QUALITY GATE: All tests pass

## Test Results
- **Unit Tests**: 11 passing
- **Coverage**: 30.3% line, 88.9% branch (for tested functions)
- **Time**: ~62ms

## Files Created
- `scripts/seed.ts` (310 lines) - Executable seeding CLI
- `tests/seed.test.ts` (11 tests)

## Implementation Details
- **Argument Parsing**: --directory and --force flags with defaults
- **Schema Management**: Optional drop/recreate with --force flag
- **Progress Reporting**: Real-time progress during seeding process
- **Statistics**: Formatted output with category counts, token usage, duration
- **Error Handling**: Graceful handling of directory errors, API failures
- **Integration**: Uses DatabaseSeeder with all components

## Usage

### Prerequisites
Same as search CLI - create a `.env` file:
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
# Seed all scripts (requires --allow-env --allow-net --allow-read)
deno run --allow-env --allow-net --allow-read scripts/seed.ts

# Seed specific directory
deno run --allow-env --allow-net --allow-read scripts/seed.ts --directory=./scripts/audio

# Force reseed (drop and recreate schema)
deno run --allow-env --allow-net --allow-read scripts/seed.ts --force

# Help
deno run scripts/seed.ts --help
```

### Executable Script
Make it executable for easier use:
```bash
chmod +x scripts/seed.ts
./scripts/seed.ts
```

## Output Format
```
Loading configuration...
Initializing components...

Initializing database schema...
✓ Schema ready

Discovering scripts in ./scripts...
Found 42 TypeScript files

Seeding database...
[1/42] Seeding scripts...
[2/42] Seeding scripts...
...
[42/42] Seeding scripts...

✓ Seeding complete

Statistics:
  Processed: 42
  Inserted: 42
  Categories:
    total: 42
  Total tokens: 4,250
  Time: 45.2s
```

## Integration Workflow

Complete workflow from scratch to searchable database:

```bash
# 1. Set up environment
cp .env.example .env
# Edit .env with your credentials

# 2. Seed the database
deno run --allow-env --allow-net --allow-read scripts/seed.ts

# 3. Search for scripts
deno run --allow-env --allow-net --allow-read scripts/search.ts "configure audio settings"
```

## Error Handling

The CLI provides helpful error messages:

```bash
# Invalid directory
$ deno run scripts/seed.ts --directory=./nonexistent
Error: Invalid directory: No such file or directory

# Missing environment variables
$ deno run scripts/seed.ts
Error: Missing required environment variable: TURSO_URL

# API errors (shows which scripts failed)
$ deno run scripts/seed.ts
...
✓ Seeding complete

Statistics:
  Processed: 50
  Inserted: 45
  Failed: 5
  ...

Errors:
  - Failed to analyze /path/script1.ts: Invalid syntax
  - Failed to generate embedding: Rate limit exceeded
  ... and 3 more
```

## Next Steps
- End-to-end integration testing with real Turso database
- Performance optimization for large script collections
- Incremental seeding (skip unchanged scripts)
- README updates with complete setup instructions

**Commits**:
- 46e94c7: [SEED-CLI] RED: failing tests for database seeding command
- 8293b53: [SEED-CLI] GREEN: Database seeding CLI with 11 passing tests
