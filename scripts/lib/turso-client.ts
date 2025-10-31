/**
 * Turso Database Client
 *
 * Minimal wrapper around @libsql/client for Deno
 * Provides connection management and query execution
 */

import { createClient, Client, Config } from "../../deps.ts";

export interface TursoConfig {
  url: string;
  authToken: string;
}

export class TursoClient {
  private client: Client | null = null;
  private config: TursoConfig;

  constructor(config: TursoConfig) {
    // Validate configuration
    if (!config.url || config.url.trim() === "") {
      throw new Error("Invalid URL: URL cannot be empty");
    }

    if (!config.authToken || config.authToken.trim() === "") {
      throw new Error("Invalid auth token: auth token cannot be empty");
    }

    this.config = config;
  }

  /**
   * Establish connection to Turso database
   */
  async connect(): Promise<void> {
    const clientConfig: Config = {
      url: this.config.url,
      authToken: this.config.authToken,
    };

    try {
      this.client = createClient(clientConfig);
    } catch (error) {
      const err = error as Error;
      throw new Error(`Failed to connect to database: ${err.message}`);
    }
  }

  /**
   * Close database connection
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.close();
      this.client = null;
    }
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.client !== null;
  }

  /**
   * Execute a SELECT query and return results
   */
  async query<T = unknown>(
    sql: string,
    params?: (string | number | boolean | null)[]
  ): Promise<T[]> {
    if (!this.client) {
      throw new Error("Not connected to database");
    }

    try {
      const result = await this.client.execute({
        sql,
        args: params || [],
      });

      // Convert rows to typed objects
      const rows: T[] = [];
      for (const row of result.rows) {
        const obj: Record<string, unknown> = {};
        for (let i = 0; i < result.columns.length; i++) {
          const column = result.columns[i];
          if (column) {
            obj[column] = row[i];
          }
        }
        rows.push(obj as T);
      }

      return rows;
    } catch (error) {
      const err = error as Error;
      throw new Error(`Query failed: ${err.message}`);
    }
  }

  /**
   * Execute a statement (INSERT, UPDATE, DELETE, CREATE, etc.)
   */
  async execute(
    sql: string,
    params?: (string | number | boolean | null)[]
  ): Promise<void> {
    if (!this.client) {
      throw new Error("Not connected to database");
    }

    try {
      await this.client.execute({
        sql,
        args: params || [],
      });
    } catch (error) {
      const err = error as Error;
      throw new Error(`Execute failed: ${err.message}`);
    }
  }
}
