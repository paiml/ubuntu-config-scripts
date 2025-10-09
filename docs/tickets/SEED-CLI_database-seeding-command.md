# SEED-CLI: Database Seeding CLI Command

**Priority**: P0 (Critical)
**Estimate**: 1.5 hours
**Status**: 🔴 RED PHASE

## Objective
Create a command-line tool to seed the database with script metadata and embeddings.

## Technical Requirements
1. ⏳ CLI for database initialization and seeding
2. ⏳ Directory traversal for script discovery
3. ⏳ Progress reporting during seeding
4. ⏳ Options: --directory, --category filter, --force (reseed)
5. ⏳ Statistics output after completion
6. ⏳ Environment configuration loading
7. ⏳ Error handling and recovery

## Dependencies
- SEARCH-001: TursoClient
- SEARCH-002: ScriptAnalyzer
- SEARCH-003: EmbeddingGenerator
- SEARCH-004: DatabaseSeeder

## Progress
- [x] Ticket document created
- [ ] RED: Failing tests written
- [ ] GREEN: Implementation
- [ ] REFACTOR: Code cleanup
- [ ] QUALITY GATE: Tests + coverage

## Test Plan
- Argument parsing
- Directory validation
- Schema initialization
- Progress tracking
- Statistics formatting
- Error handling

## CLI Interface
```bash
# Seed all scripts
deno run scripts/seed.ts

# Seed specific directory
deno run scripts/seed.ts --directory=./scripts/audio

# Force reseed (replace existing)
deno run scripts/seed.ts --force

# Help
deno run scripts/seed.ts --help
```

## Output Format
```
Initializing database schema...
✓ Schema created

Discovering scripts in ./scripts...
Found 42 TypeScript files

Analyzing scripts...
[1/42] configure-speakers.ts
[2/42] enable-mic.ts
...
✓ Analyzed 42 scripts

Generating embeddings...
[1/42] Processing batch 1-10...
[2/42] Processing batch 11-20...
...
✓ Generated 42 embeddings

Seeding database...
[42/42] Inserted 42 scripts
✓ Seeding complete

Statistics:
  Total scripts: 42
  Categories: 3 (audio: 15, system: 18, dev: 9)
  Total tokens: 4,250
  Time: 45.2s
```

## Next Steps
After completion:
- End-to-end integration testing
- User documentation
- README updates

**Estimated Time**: 1.5 hours
