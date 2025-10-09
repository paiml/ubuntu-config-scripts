# SEARCH-003: Embedding Generation

**Priority**: P0 (Critical)
**Estimate**: 4 hours
**Status**: In Progress - RED Phase

## Objective
Generate vector embeddings for script descriptions using OpenAI API for semantic search.

## Technical Requirements
1. ⏳ OpenAI API integration (text-embedding-3-small)
2. ⏳ Batch embedding generation
3. ⏳ Retry logic for API failures
4. ⏳ Rate limiting (3000 RPM for tier 1)
5. ⏳ Cost tracking and logging

## API Design
```typescript
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

## Progress
- [ ] Ticket document created
- [ ] RED: Failing tests written
- [ ] GREEN: Minimal implementation
- [ ] REFACTOR: Retry logic and optimization
- [ ] QUALITY GATE: Tests pass

## Notes
- Using OpenAI text-embedding-3-small model
- 1536 dimensions by default
- Cost: ~$0.00002 per 1K tokens
- Rate limit: 3000 RPM (tier 1)
- Following EXTREME TDD workflow
