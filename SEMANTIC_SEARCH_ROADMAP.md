# Semantic Search for Ubuntu Config Scripts - Implementation Roadmap

## 🎯 Project Goal

Enable natural language querying of script capabilities using semantic search powered by Turso database and vector embeddings.

**Example Queries:**
- "How do I fix audio issues?"
- "Configure my GPU for DaVinci Resolve"
- "Install development tools"
- "Monitor system resources"

## 📋 Project Overview

### Architecture
```
┌─────────────────┐
│ Natural Language│
│     Query       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Embedding API  │ (OpenAI/Claude)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Turso Database │ (LibSQL + Vector Search)
│  - Scripts      │
│  - Embeddings   │
│  - Metadata     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Ranked Results  │
│ + Usage Tips    │
└─────────────────┘
```

### Technology Stack
- **Database**: Turso (LibSQL with vector search extension)
- **Embeddings**: OpenAI text-embedding-3-small or Claude embeddings via MCP
- **Language**: TypeScript (Deno)
- **Testing**: EXTREME TDD with property-based tests (fast-check)
- **Quality**: PMAT enforcement (80% coverage, complexity <10)

## 📊 Implementation Phases

### Phase 1: Foundation (SEARCH-001 to SEARCH-005)
**Goal**: Database setup and script indexing

- **SEARCH-001**: Turso database setup and schema design
- **SEARCH-002**: Script metadata extraction
- **SEARCH-003**: Embedding generation for scripts
- **SEARCH-004**: Database seeding with all scripts
- **SEARCH-005**: Basic CRUD operations

### Phase 2: Search Engine (SEARCH-006 to SEARCH-010)
**Goal**: Core semantic search functionality

- **SEARCH-006**: Vector similarity search implementation
- **SEARCH-007**: Query embedding generation
- **SEARCH-008**: Result ranking and filtering
- **SEARCH-009**: Metadata-based augmentation
- **SEARCH-010**: Search CLI command

### Phase 3: Advanced Features (SEARCH-011 to SEARCH-015)
**Goal**: Enhanced search capabilities

- **SEARCH-011**: Multi-modal search (tags + semantic)
- **SEARCH-012**: Usage tracking and popularity scores
- **SEARCH-013**: Related scripts suggestion
- **SEARCH-014**: Category-based filtering
- **SEARCH-015**: Search result caching

### Phase 4: Integration (SEARCH-016 to SEARCH-020)
**Goal**: Project integration and automation

- **SEARCH-016**: Integrate with main CLI
- **SEARCH-017**: Auto-reindex on script changes
- **SEARCH-018**: MCP server for search
- **SEARCH-019**: Interactive search TUI
- **SEARCH-020**: Search analytics dashboard

## 🎫 Detailed Tickets

---

### SEARCH-001: Turso Database Setup and Schema Design

**Priority**: P0 (Critical)
**Estimate**: 4 hours
**Status**: Not Started

#### Objective
Set up Turso database connection and design schema for storing script metadata and embeddings.

#### Problem Statement
Need a scalable database solution that supports vector similarity search for semantic querying of script capabilities.

#### Technical Requirements
1. Turso client setup for Deno
2. Schema with vector search support
3. Connection pooling and error handling
4. Environment-based configuration
5. Migration scripts

#### Schema Design
```sql
-- Scripts table
CREATE TABLE scripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    path TEXT NOT NULL,
    category TEXT NOT NULL, -- 'audio', 'system', 'dev'
    description TEXT NOT NULL,
    usage TEXT,
    tags TEXT, -- JSON array
    dependencies TEXT, -- JSON array
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Embeddings table (vector storage)
CREATE TABLE script_embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    script_id INTEGER NOT NULL,
    embedding BLOB NOT NULL, -- Vector as binary
    embedding_model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE
);

-- Usage tracking
CREATE TABLE script_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    script_id INTEGER NOT NULL,
    query TEXT,
    rank INTEGER,
    executed BOOLEAN DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_scripts_category ON scripts(category);
CREATE INDEX idx_scripts_name ON scripts(name);
CREATE INDEX idx_usage_script_id ON script_usage(script_id);
CREATE INDEX idx_usage_timestamp ON script_usage(timestamp);
```

#### API Design
```typescript
// scripts/lib/turso-client.ts
export interface TursoConfig {
  url: string;
  authToken: string;
}

export class TursoClient {
  constructor(config: TursoConfig);
  async connect(): Promise<void>;
  async disconnect(): Promise<void>;
  async query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  async execute(sql: string, params?: unknown[]): Promise<void>;
}

// scripts/lib/search-db.ts
export interface Script {
  id: number;
  name: string;
  path: string;
  category: string;
  description: string;
  usage?: string;
  tags: string[];
  dependencies: string[];
}

export class SearchDatabase {
  constructor(client: TursoClient);
  async initialize(): Promise<void>;
  async insertScript(script: Omit<Script, 'id'>): Promise<number>;
  async getScript(id: number): Promise<Script | null>;
  async getAllScripts(): Promise<Script[]>;
}
```

#### Test Strategy
1. **Unit Tests** (turso-client.test.ts):
   - Connection establishment and teardown
   - Query execution with parameters
   - Error handling for connection failures
   - Query timeout handling

2. **Integration Tests** (search-db.integration.test.ts):
   - Schema creation and validation
   - CRUD operations on scripts table
   - Foreign key constraints
   - Transaction rollback

3. **Property Tests** (search-db.property.test.ts):
   - Script insertion idempotency
   - Query result consistency
   - Concurrent access safety

#### Acceptance Criteria
- [ ] Turso client connects successfully with credentials
- [ ] All tables created with correct schema
- [ ] CRUD operations work for scripts table
- [ ] Error handling for invalid queries
- [ ] All tests passing (unit + integration + property)
- [ ] PMAT quality gates pass (80% coverage, complexity <10)

#### Files to Create
- `scripts/lib/turso-client.ts`
- `scripts/lib/search-db.ts`
- `tests/lib/turso-client.test.ts`
- `tests/lib/search-db.integration.test.ts`
- `tests/lib/search-db.property.test.ts`
- `.env.example` (with TURSO_URL and TURSO_AUTH_TOKEN)

---

### SEARCH-002: Script Metadata Extraction

**Priority**: P0 (Critical)
**Estimate**: 3 hours
**Status**: Not Started

#### Objective
Extract metadata from all TypeScript scripts including description, usage, dependencies, and tags.

#### Problem Statement
Scripts lack structured metadata. Need to parse TypeScript files to extract documentation, imports, and usage information.

#### Technical Requirements
1. TypeScript AST parsing
2. JSDoc comment extraction
3. Import statement analysis
4. Category inference from file path
5. Tag generation from content

#### API Design
```typescript
// scripts/lib/script-analyzer.ts
export interface ScriptMetadata {
  name: string;
  path: string;
  category: string;
  description: string;
  usage: string;
  tags: string[];
  dependencies: string[];
}

export class ScriptAnalyzer {
  async analyzeScript(filePath: string): Promise<ScriptMetadata>;
  async analyzeAllScripts(rootDir: string): Promise<ScriptMetadata[]>;

  private extractDescription(ast: unknown): string;
  private extractUsage(ast: unknown): string;
  private extractDependencies(ast: unknown): string[];
  private generateTags(content: string): string[];
}
```

#### Test Strategy
1. **Unit Tests**:
   - Description extraction from JSDoc
   - Usage parsing from comments
   - Dependency import detection
   - Tag generation logic

2. **Integration Tests**:
   - Full script analysis on real files
   - Bulk analysis of scripts directory
   - Error handling for malformed files

3. **Property Tests**:
   - All scripts return valid metadata
   - Dependencies are valid module paths
   - Tags are non-empty arrays

#### Acceptance Criteria
- [ ] Extracts description from JSDoc or file header
- [ ] Parses usage instructions from comments
- [ ] Identifies all import dependencies
- [ ] Generates relevant tags from content
- [ ] Handles scripts without documentation
- [ ] All tests passing with 80%+ coverage

#### Files to Create
- `scripts/lib/script-analyzer.ts`
- `tests/lib/script-analyzer.test.ts`
- `tests/lib/script-analyzer.integration.test.ts`
- `tests/lib/script-analyzer.property.test.ts`

---

### SEARCH-003: Embedding Generation

**Priority**: P0 (Critical)
**Estimate**: 4 hours
**Status**: Not Started

#### Objective
Generate vector embeddings for script descriptions using OpenAI or Claude API.

#### Problem Statement
Need to convert text descriptions into vector embeddings for similarity search.

#### Technical Requirements
1. OpenAI API integration (text-embedding-3-small)
2. Batch embedding generation
3. Retry logic for API failures
4. Rate limiting (3000 RPM for tier 1)
5. Cost tracking and logging

#### API Design
```typescript
// scripts/lib/embedding-generator.ts
export interface EmbeddingConfig {
  apiKey: string;
  model: string; // 'text-embedding-3-small'
  dimensions?: number; // 1536 default
}

export interface EmbeddingResult {
  embedding: number[];
  tokens: number;
  model: string;
}

export class EmbeddingGenerator {
  constructor(config: EmbeddingConfig);

  async generateEmbedding(text: string): Promise<EmbeddingResult>;
  async generateBatch(texts: string[]): Promise<EmbeddingResult[]>;

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number
  ): Promise<T>;
}
```

#### Test Strategy
1. **Unit Tests**:
   - API request formatting
   - Response parsing
   - Retry logic with exponential backoff
   - Error handling for rate limits

2. **Integration Tests** (with API mocking):
   - Single embedding generation
   - Batch embedding generation
   - Token counting accuracy
   - Cost calculation

3. **Property Tests**:
   - Embedding dimensions are consistent
   - Same text produces same embedding
   - Batch and single match for same text

#### Acceptance Criteria
- [ ] Generates embeddings via OpenAI API
- [ ] Handles rate limiting gracefully
- [ ] Batch processing for efficiency
- [ ] Logs token usage and costs
- [ ] All tests passing with mocked API
- [ ] PMAT quality gates pass

#### Files to Create
- `scripts/lib/embedding-generator.ts`
- `tests/lib/embedding-generator.test.ts`
- `tests/lib/embedding-generator.integration.test.ts`
- `tests/lib/embedding-generator.property.test.ts`

---

### SEARCH-004: Database Seeding

**Priority**: P1 (High)
**Estimate**: 2 hours
**Status**: Not Started

#### Objective
Populate Turso database with all scripts and their embeddings.

#### Technical Requirements
1. Combine metadata extraction + embedding generation
2. Batch insert into database
3. Progress tracking
4. Incremental updates (only changed scripts)
5. Dry-run mode

#### API Design
```typescript
// scripts/dev/seed-search-db.ts
export interface SeedOptions {
  rootDir: string;
  force?: boolean; // Re-index all
  dryRun?: boolean;
  verbose?: boolean;
}

export class DatabaseSeeder {
  constructor(
    db: SearchDatabase,
    analyzer: ScriptAnalyzer,
    embedder: EmbeddingGenerator
  );

  async seedDatabase(options: SeedOptions): Promise<SeedResult>;
  async updateScript(scriptPath: string): Promise<void>;

  private async isScriptModified(script: ScriptMetadata): Promise<boolean>;
}

export interface SeedResult {
  scriptsIndexed: number;
  scriptsUpdated: number;
  scriptsSkipped: number;
  totalTokens: number;
  estimatedCost: number;
}
```

#### Test Strategy
1. **Unit Tests**:
   - Seeding logic
   - Incremental update detection
   - Progress tracking

2. **Integration Tests**:
   - Full database seeding
   - Incremental updates
   - Dry-run mode

3. **Property Tests**:
   - All scripts get indexed
   - No duplicate entries
   - Embeddings match scripts

#### Acceptance Criteria
- [ ] Seeds all scripts from scripts/ directory
- [ ] Generates and stores embeddings
- [ ] Tracks progress with logging
- [ ] Supports incremental updates
- [ ] Dry-run mode works correctly
- [ ] All tests passing

#### Files to Create
- `scripts/dev/seed-search-db.ts`
- `tests/dev/seed-search-db.test.ts`
- `tests/dev/seed-search-db.integration.test.ts`

---

### SEARCH-006: Vector Similarity Search

**Priority**: P0 (Critical)
**Estimate**: 5 hours
**Status**: Not Started

#### Objective
Implement cosine similarity search for finding relevant scripts based on query embeddings.

#### Problem Statement
Need efficient vector similarity computation to rank scripts by semantic relevance.

#### Technical Requirements
1. Cosine similarity calculation
2. Top-K retrieval
3. Score normalization (0-1 range)
4. Threshold filtering
5. Performance optimization for large datasets

#### API Design
```typescript
// scripts/lib/semantic-search.ts
export interface SearchQuery {
  text: string;
  category?: string; // Filter by category
  topK?: number; // Default: 10
  threshold?: number; // Min similarity score (0-1)
}

export interface SearchResult {
  script: Script;
  score: number; // Cosine similarity (0-1)
  embedding: number[];
}

export class SemanticSearchEngine {
  constructor(db: SearchDatabase, embedder: EmbeddingGenerator);

  async search(query: SearchQuery): Promise<SearchResult[]>;

  private cosineSimilarity(a: number[], b: number[]): number;
  private normalizeVector(vec: number[]): number[];
}
```

#### Test Strategy
1. **Unit Tests**:
   - Cosine similarity calculation
   - Vector normalization
   - Score threshold filtering
   - Top-K selection

2. **Integration Tests**:
   - Full search pipeline
   - Category filtering
   - Empty results handling
   - Edge cases (identical vectors, orthogonal vectors)

3. **Property Tests**:
   - Similarity scores in [0, 1] range
   - Top-K returns exactly K or fewer results
   - Higher scores rank first

#### Acceptance Criteria
- [ ] Calculates cosine similarity correctly
- [ ] Returns top-K most relevant scripts
- [ ] Filters by category if specified
- [ ] Handles edge cases gracefully
- [ ] Performance: <100ms for 100 scripts
- [ ] All tests passing with 80%+ coverage

#### Files to Create
- `scripts/lib/semantic-search.ts`
- `tests/lib/semantic-search.test.ts`
- `tests/lib/semantic-search.integration.test.ts`
- `tests/lib/semantic-search.property.test.ts`

---

### SEARCH-010: Search CLI Command

**Priority**: P1 (High)
**Estimate**: 3 hours
**Status**: Not Started

#### Objective
Create CLI command for searching scripts using natural language.

#### Technical Requirements
1. CLI argument parsing
2. Interactive mode support
3. Formatted output (table, JSON)
4. Color-coded relevance scores
5. Direct script execution option

#### API Design
```typescript
// scripts/dev/search-scripts.ts
export interface SearchCLIOptions {
  query: string;
  category?: string;
  limit?: number;
  threshold?: number;
  format?: 'table' | 'json';
  execute?: boolean; // Run top result
  interactive?: boolean;
}

async function searchScripts(options: SearchCLIOptions): Promise<void>;
```

#### CLI Usage
```bash
# Basic search
deno run --allow-all scripts/dev/search-scripts.ts "fix audio problems"

# Category filter
deno run --allow-all scripts/dev/search-scripts.ts "configure GPU" --category=system

# Interactive mode
deno run --allow-all scripts/dev/search-scripts.ts --interactive

# Execute top result
deno run --allow-all scripts/dev/search-scripts.ts "enable microphone" --execute

# JSON output
deno run --allow-all scripts/dev/search-scripts.ts "analyze disk" --format=json
```

#### Test Strategy
1. **Unit Tests**:
   - Argument parsing
   - Output formatting
   - Score visualization

2. **Integration Tests**:
   - Full search flow
   - Interactive mode simulation
   - Script execution

3. **Property Tests**:
   - All queries return valid results
   - Output format consistency

#### Acceptance Criteria
- [ ] CLI accepts natural language queries
- [ ] Displays results with relevance scores
- [ ] Color-coded output for readability
- [ ] Interactive mode for query refinement
- [ ] Can execute top result directly
- [ ] JSON output for scripting
- [ ] All tests passing

#### Files to Create
- `scripts/dev/search-scripts.ts`
- `tests/dev/search-scripts.test.ts`
- `tests/dev/search-scripts.integration.test.ts`

---

## 📐 EXTREME TDD Workflow

### RED-GREEN-REFACTOR Cycle (MANDATORY)

**For each ticket:**

1. **RED**: Write failing tests first
   ```bash
   # Create test file
   touch tests/lib/component.test.ts

   # Write comprehensive tests
   # - Unit tests
   # - Integration tests
   # - Property tests (fast-check)

   # Verify tests fail
   deno test tests/lib/component.test.ts
   # Expected: FAILED

   git add tests/lib/component.test.ts
   git commit -m "[SEARCH-XXX] RED: failing tests for feature"
   ```

2. **GREEN**: Minimal implementation
   ```bash
   # Create implementation file
   touch scripts/lib/component.ts

   # Write minimal code to pass tests
   # No premature optimization

   # Verify tests pass
   deno test tests/lib/component.test.ts
   # Expected: PASSED

   git add scripts/lib/component.ts
   git commit -m "[SEARCH-XXX] GREEN: minimal implementation"
   ```

3. **REFACTOR**: Clean up and optimize
   ```bash
   # Optimize, document, remove duplication
   # Add property tests
   # Check complexity

   deno test tests/lib/component.test.ts
   # Expected: PASSED

   git add scripts/lib/component.ts tests/lib/component.property.test.ts
   git commit -m "[SEARCH-XXX] REFACTOR: optimizations and cleanup"
   ```

4. **QUALITY GATE**: PMAT enforcement
   ```bash
   # Run quality checks
   deno test --allow-all --coverage=coverage
   deno coverage coverage
   # Expected: >80% coverage

   # Check complexity (manually or with tool)
   # Expected: <10 cyclomatic complexity

   git commit -m "[SEARCH-XXX] Complete with quality gates"
   git push origin main
   ```

## 🎯 Quality Standards (Zero Tolerance)

### PMAT Enforcement
- **Coverage**: ≥80% line, ≥75% branch
- **Complexity**: ≤10 cyclomatic (target: ≤7)
- **SATD**: 0 TODO/FIXME/HACK comments
- **Dead Code**: ≤10%
- **Property Tests**: 1000+ iterations per property

### Testing Requirements
1. **Unit Tests**: Test individual functions in isolation
2. **Integration Tests**: Test full workflows with real I/O
3. **Property Tests**: Test invariants with fast-check (1000+ iterations)
4. **Coverage**: Every line and branch tested

### Example Property Test
```typescript
import fc from "fast-check";

Deno.test("cosineSimilarity - commutative property", () => {
  fc.assert(
    fc.property(
      fc.array(fc.float(), { minLength: 10, maxLength: 100 }),
      fc.array(fc.float(), { minLength: 10, maxLength: 100 }),
      (a, b) => {
        const sim1 = cosineSimilarity(a, b);
        const sim2 = cosineSimilarity(b, a);
        return Math.abs(sim1 - sim2) < 0.0001;
      }
    ),
    { numRuns: 1000 }
  );
});
```

## 📊 Progress Tracking

### Phase 1: Foundation
- [ ] SEARCH-001: Turso database setup ⏱️ 4h
- [ ] SEARCH-002: Script metadata extraction ⏱️ 3h
- [ ] SEARCH-003: Embedding generation ⏱️ 4h
- [ ] SEARCH-004: Database seeding ⏱️ 2h
- [ ] SEARCH-005: Basic CRUD operations ⏱️ 2h

**Phase 1 Total**: 15 hours

### Phase 2: Search Engine
- [ ] SEARCH-006: Vector similarity search ⏱️ 5h
- [ ] SEARCH-007: Query embedding generation ⏱️ 2h
- [ ] SEARCH-008: Result ranking and filtering ⏱️ 3h
- [ ] SEARCH-009: Metadata-based augmentation ⏱️ 2h
- [ ] SEARCH-010: Search CLI command ⏱️ 3h

**Phase 2 Total**: 15 hours

### Phase 3: Advanced Features (Future)
- [ ] SEARCH-011: Multi-modal search ⏱️ 4h
- [ ] SEARCH-012: Usage tracking ⏱️ 3h
- [ ] SEARCH-013: Related scripts ⏱️ 3h
- [ ] SEARCH-014: Category filtering ⏱️ 2h
- [ ] SEARCH-015: Result caching ⏱️ 3h

**Phase 3 Total**: 15 hours

### Phase 4: Integration (Future)
- [ ] SEARCH-016: Main CLI integration ⏱️ 2h
- [ ] SEARCH-017: Auto-reindex ⏱️ 3h
- [ ] SEARCH-018: MCP server ⏱️ 4h
- [ ] SEARCH-019: Interactive TUI ⏱️ 4h
- [ ] SEARCH-020: Analytics dashboard ⏱️ 2h

**Phase 4 Total**: 15 hours

**Grand Total**: 60 hours (7.5 days of focused work)

## 🚀 Getting Started

### Prerequisites
```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Create Turso database
turso db create ubuntu-scripts-search

# Get database URL and token
turso db show ubuntu-scripts-search --url
turso db tokens create ubuntu-scripts-search

# Set environment variables
export TURSO_URL="libsql://..."
export TURSO_AUTH_TOKEN="..."
export OPENAI_API_KEY="sk-..."
```

### Start with SEARCH-001
```bash
# Create ticket document
mkdir -p docs/tickets
touch docs/tickets/SEARCH-001_turso-database-setup.md

# Follow RED-GREEN-REFACTOR cycle
# 1. Write failing tests
# 2. Minimal implementation
# 3. Refactor and optimize
# 4. PMAT quality gate
# 5. Push to GitHub
```

## 📚 Resources

- [Turso Documentation](https://docs.turso.tech/)
- [LibSQL Vector Search](https://github.com/tursodatabase/libsql-vector)
- [OpenAI Embeddings API](https://platform.openai.com/docs/guides/embeddings)
- [LibSQL JavaScript SDK](https://docs.turso.tech/libsql/client-access/javascript-typescript-sdk) - Works with Deno via `npm:@libsql/client`
- [fast-check Documentation](https://fast-check.dev/)

---

*Created: 2025-10-09*
*Status: Planning Phase*
*Next Action: Start SEARCH-001*
