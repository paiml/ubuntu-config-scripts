/**
 * Vector Similarity Search
 *
 * Semantic search using cosine similarity on vector embeddings
 * - Query embedding generation
 * - Cosine similarity calculation
 * - Result ranking by similarity score
 * - Category and similarity filtering
 */

import { ScriptRecord, ScriptRepository } from "./script-repository.ts";
import { EmbeddingGenerator } from "./embedding-generator.ts";

export interface SearchConfig {
  repository: ScriptRepository;
  embedder: EmbeddingGenerator;
}

export interface SearchOptions {
  topN: number;
  category?: string;
  minSimilarity?: number;
}

export interface SearchResult {
  script: ScriptRecord;
  similarity: number;
}

export class VectorSearch {
  private repository: ScriptRepository;
  private embedder: EmbeddingGenerator;

  constructor(config: SearchConfig) {
    if (!config.repository) {
      throw new Error("Invalid config: repository is required");
    }
    if (!config.embedder) {
      throw new Error("Invalid config: embedder is required");
    }

    this.repository = config.repository;
    this.embedder = config.embedder;
  }

  /**
   * Calculate cosine similarity between two vectors
   * Returns value between -1 (opposite) and 1 (identical)
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("Vectors must have same length");
    }

    // Calculate dot product
    let dotProduct = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i]! * b[i]!;
    }

    // Calculate magnitudes
    let magnitudeA = 0;
    let magnitudeB = 0;
    for (let i = 0; i < a.length; i++) {
      magnitudeA += a[i]! * a[i]!;
      magnitudeB += b[i]! * b[i]!;
    }
    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    // Handle zero vectors
    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Search for similar scripts using semantic similarity
   */
  async search(
    query: string,
    options: SearchOptions,
  ): Promise<SearchResult[]> {
    // Validate inputs
    if (!query || query.trim() === "") {
      throw new Error("Invalid query: query cannot be empty");
    }

    if (options.topN <= 0) {
      throw new Error("Invalid topN: topN must be positive");
    }

    // Generate embedding for query
    const queryEmbeddingResult = await this.embedder.generateEmbedding(query);
    const queryEmbedding = queryEmbeddingResult.embedding;

    // Fetch all scripts (with optional category filter)
    const listOptions: {
      limit: number;
      offset: number;
      category?: string;
    } = {
      limit: 10000, // Large limit to get all
      offset: 0,
    };

    if (options.category) {
      listOptions.category = options.category;
    }

    const scripts = await this.repository.list(listOptions);

    // Calculate similarity for each script
    const results: SearchResult[] = [];
    for (const script of scripts) {
      // Skip scripts without embeddings
      if (!script.embedding || script.embedding.length === 0) {
        continue;
      }

      const similarity = this.cosineSimilarity(
        queryEmbedding,
        script.embedding,
      );

      // Apply minimum similarity threshold if specified
      if (
        options.minSimilarity !== undefined &&
        similarity < options.minSimilarity
      ) {
        continue;
      }

      results.push({ script, similarity });
    }

    // Sort by similarity descending
    results.sort((a, b) => b.similarity - a.similarity);

    // Return top N results
    return results.slice(0, options.topN);
  }
}
