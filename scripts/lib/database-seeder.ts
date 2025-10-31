/**
 * Database Seeder
 *
 * Seeds Turso database with script metadata and vector embeddings
 * - Discovers TypeScript scripts in directories
 * - Extracts metadata using ScriptAnalyzer
 * - Generates embeddings using EmbeddingGenerator
 * - Stores in Turso database with vector search support
 */

import { TursoClient } from "./turso-client.ts";
import { ScriptAnalyzer, ScriptMetadata } from "./script-analyzer.ts";
import { EmbeddingGenerator } from "./embedding-generator.ts";
import { join } from "../../deps.ts";

export interface SeederConfig {
  client: TursoClient;
  analyzer: ScriptAnalyzer;
  embedder: EmbeddingGenerator;
  onProgress?: (current: number, total: number) => void;
}

export interface SeedingResult {
  processed: number;
  inserted: number;
  updated: number;
  failed: number;
  errors: string[];
}

export interface SeederStats {
  total_scripts: number;
  total_categories: number;
  avg_tokens: number;
}

export class DatabaseSeeder {
  private client: TursoClient;
  private analyzer: ScriptAnalyzer;
  private embedder: EmbeddingGenerator;
  private onProgress: ((current: number, total: number) => void) | undefined;

  constructor(config: SeederConfig) {
    if (!config.client) {
      throw new Error("Invalid config: client is required");
    }
    if (!config.analyzer) {
      throw new Error("Invalid config: analyzer is required");
    }
    if (!config.embedder) {
      throw new Error("Invalid config: embedder is required");
    }

    this.client = config.client;
    this.analyzer = config.analyzer;
    this.embedder = config.embedder;
    this.onProgress = config.onProgress;
  }

  /**
   * Initialize database schema with vector support
   */
  async initializeSchema(): Promise<void> {
    const schema = `
      CREATE TABLE IF NOT EXISTS scripts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        path TEXT UNIQUE NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        usage TEXT,
        tags TEXT,
        dependencies TEXT,
        embedding_text TEXT,
        embedding BLOB,
        tokens INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_scripts_category ON scripts(category);
      CREATE INDEX IF NOT EXISTS idx_scripts_path ON scripts(path);
    `;

    await this.client.execute(schema);
  }

  /**
   * Discover TypeScript files in directory recursively
   */
  async discoverScripts(rootDir: string): Promise<string[]> {
    const scripts: string[] = [];

    async function walk(dir: string) {
      for await (const entry of Deno.readDir(dir)) {
        const path = join(dir, entry.name);

        if (entry.isDirectory) {
          // Recurse into subdirectories
          await walk(path);
        } else if (entry.isFile && entry.name.endsWith(".ts")) {
          scripts.push(path);
        }
      }
    }

    await walk(rootDir);
    return scripts;
  }

  /**
   * Seed database with scripts from directory
   */
  async seedScripts(rootDir: string): Promise<SeedingResult> {
    const result: SeedingResult = {
      processed: 0,
      inserted: 0,
      updated: 0,
      failed: 0,
      errors: [],
    };

    // Discover all TypeScript files
    const scriptPaths = await this.discoverScripts(rootDir);
    const total = scriptPaths.length;

    if (total === 0) {
      return result;
    }

    // Analyze all scripts
    const metadataList: ScriptMetadata[] = [];
    for (const path of scriptPaths) {
      try {
        const metadata = await this.analyzer.analyzeScript(path);
        metadataList.push(metadata);
      } catch (error) {
        const err = error as Error;
        result.errors.push(`Failed to analyze ${path}: ${err.message}`);
        result.failed++;
      }
    }

    result.processed = metadataList.length;

    // Generate embeddings in batch
    const embeddingTexts = metadataList.map((m) =>
      m.description || m.name || "script"
    );

    let embeddings;
    try {
      embeddings = await this.embedder.generateBatch(embeddingTexts);
    } catch (error) {
      const err = error as Error;
      result.errors.push(`Failed to generate embeddings: ${err.message}`);
      result.failed = metadataList.length;
      return result;
    }

    // Insert each script with its embedding
    for (let i = 0; i < metadataList.length; i++) {
      const metadata = metadataList[i];
      const embedding = embeddings[i];

      if (!metadata || !embedding) {
        continue;
      }

      try {
        const embeddingBlob = JSON.stringify(embedding.embedding);

        await this.client.execute(
          `INSERT OR REPLACE INTO scripts
           (name, path, category, description, usage, tags, dependencies, embedding_text, embedding, tokens, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [
            metadata.name,
            metadata.path,
            metadata.category,
            metadata.description,
            metadata.usage,
            JSON.stringify(metadata.tags),
            JSON.stringify(metadata.dependencies),
            embeddingTexts[i] || "",
            embeddingBlob,
            embedding.tokens,
          ],
        );

        result.inserted++;

        if (this.onProgress) {
          this.onProgress(i + 1, total);
        }
      } catch (error) {
        const err = error as Error;
        result.errors.push(
          `Failed to insert ${metadata.path}: ${err.message}`,
        );
        result.failed++;
      }
    }

    return result;
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<SeederStats> {
    const results = await this.client.query<SeederStats>(
      `SELECT
        COUNT(*) as total_scripts,
        COUNT(DISTINCT category) as total_categories,
        AVG(tokens) as avg_tokens
       FROM scripts`,
    );

    return results[0] || {
      total_scripts: 0,
      total_categories: 0,
      avg_tokens: 0,
    };
  }
}
