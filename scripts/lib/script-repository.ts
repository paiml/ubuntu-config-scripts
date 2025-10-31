/**
 * Script Repository
 *
 * CRUD operations for script records in Turso database
 * - Create, Read, Update, Delete scripts
 * - List with pagination and filtering
 * - Category management
 */

import { TursoClient } from "./turso-client.ts";

export interface ScriptRecord {
  id?: number;
  name: string;
  path: string;
  category: string;
  description?: string;
  usage?: string;
  tags?: string[];
  dependencies?: string[];
  embedding_text?: string;
  embedding?: number[];
  tokens?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ListOptions {
  limit: number;
  offset: number;
  category?: string;
}

interface DbScriptRecord {
  id: number;
  name: string;
  path: string;
  category: string;
  description: string | null;
  usage: string | null;
  tags: string | null;
  dependencies: string | null;
  embedding_text: string | null;
  embedding: string | null;
  tokens: number | null;
  created_at: string;
  updated_at: string;
}

export class ScriptRepository {
  private client: TursoClient;

  constructor(client: TursoClient) {
    if (!client) {
      throw new Error("Invalid config: client is required");
    }
    this.client = client;
  }

  /**
   * Create a new script record
   */
  async create(script: ScriptRecord): Promise<number> {
    // Validate required fields
    if (!script.name || script.name.trim() === "") {
      throw new Error("Invalid script: name is required");
    }
    if (!script.path || script.path.trim() === "") {
      throw new Error("Invalid script: path is required");
    }
    if (!script.category || script.category.trim() === "") {
      throw new Error("Invalid script: category is required");
    }

    const embeddingBlob = script.embedding
      ? JSON.stringify(script.embedding)
      : null;

    await this.client.execute(
      `INSERT INTO scripts
       (name, path, category, description, usage, tags, dependencies, embedding_text, embedding, tokens)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        script.name,
        script.path,
        script.category,
        script.description || null,
        script.usage || null,
        script.tags ? JSON.stringify(script.tags) : null,
        script.dependencies ? JSON.stringify(script.dependencies) : null,
        script.embedding_text || null,
        embeddingBlob,
        script.tokens || null,
      ]
    );

    // Get the last inserted ID
    const result = await this.client.query<{ id: number }>(
      "SELECT last_insert_rowid() as id"
    );

    return result[0]?.id || 0;
  }

  /**
   * Get script by ID
   */
  async getById(id: number): Promise<ScriptRecord | null> {
    const results = await this.client.query<DbScriptRecord>(
      "SELECT * FROM scripts WHERE id = ?",
      [id]
    );

    if (results.length === 0) {
      return null;
    }

    return this.mapDbRecord(results[0]!);
  }

  /**
   * Get script by path
   */
  async getByPath(path: string): Promise<ScriptRecord | null> {
    const results = await this.client.query<DbScriptRecord>(
      "SELECT * FROM scripts WHERE path = ?",
      [path]
    );

    if (results.length === 0) {
      return null;
    }

    return this.mapDbRecord(results[0]!);
  }

  /**
   * Update script by ID
   */
  async update(
    id: number,
    updates: Partial<ScriptRecord>
  ): Promise<void> {
    if (id <= 0) {
      throw new Error("Invalid ID: must be positive");
    }

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.name !== undefined) {
      fields.push("name = ?");
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push("description = ?");
      values.push(updates.description || null);
    }
    if (updates.usage !== undefined) {
      fields.push("usage = ?");
      values.push(updates.usage || null);
    }
    if (updates.tags !== undefined) {
      fields.push("tags = ?");
      values.push(JSON.stringify(updates.tags));
    }
    if (updates.dependencies !== undefined) {
      fields.push("dependencies = ?");
      values.push(JSON.stringify(updates.dependencies));
    }
    if (updates.embedding !== undefined) {
      fields.push("embedding = ?");
      values.push(JSON.stringify(updates.embedding));
    }
    if (updates.tokens !== undefined) {
      fields.push("tokens = ?");
      values.push(updates.tokens);
    }

    if (fields.length === 0) {
      return;
    }

    fields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    const sql = `UPDATE scripts SET ${fields.join(", ")} WHERE id = ?`;
    await this.client.execute(sql, values);
  }

  /**
   * Delete script by ID
   */
  async delete(id: number): Promise<void> {
    if (id <= 0) {
      throw new Error("Invalid ID: must be positive");
    }

    await this.client.execute("DELETE FROM scripts WHERE id = ?", [id]);
  }

  /**
   * List scripts with pagination
   */
  async list(options: ListOptions): Promise<ScriptRecord[]> {
    const { limit, offset, category } = options;

    let sql = "SELECT * FROM scripts";
    const params: (string | number)[] = [];

    if (category) {
      sql += " WHERE category = ?";
      params.push(category);
    }

    sql += " ORDER BY id ASC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const results = await this.client.query<DbScriptRecord>(sql, params);
    return results.map((r) => this.mapDbRecord(r));
  }

  /**
   * Count total scripts
   */
  async count(category?: string): Promise<number> {
    let sql = "SELECT COUNT(*) as count FROM scripts";
    const params: string[] = [];

    if (category) {
      sql += " WHERE category = ?";
      params.push(category);
    }

    const results = await this.client.query<{ count: number }>(sql, params);
    return results[0]?.count || 0;
  }

  /**
   * List all unique categories
   */
  async listCategories(): Promise<string[]> {
    const results = await this.client.query<{ category: string }>(
      "SELECT DISTINCT category FROM scripts ORDER BY category"
    );

    return results.map((r) => r.category);
  }

  /**
   * Map database record to ScriptRecord
   */
  private mapDbRecord(db: DbScriptRecord): ScriptRecord {
    const record: ScriptRecord = {
      id: db.id,
      name: db.name,
      path: db.path,
      category: db.category,
      created_at: db.created_at,
      updated_at: db.updated_at,
    };

    if (db.description) record.description = db.description;
    if (db.usage) record.usage = db.usage;
    if (db.tags) record.tags = JSON.parse(db.tags);
    if (db.dependencies) record.dependencies = JSON.parse(db.dependencies);
    if (db.embedding_text) record.embedding_text = db.embedding_text;
    if (db.embedding) record.embedding = JSON.parse(db.embedding);
    if (db.tokens !== null) record.tokens = db.tokens;

    return record;
  }
}
