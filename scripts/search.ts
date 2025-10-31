#!/usr/bin/env -S deno run --allow-env --allow-net --allow-read
/**
 * Semantic Script Search CLI
 *
 * Search for scripts using natural language queries
 * Uses vector embeddings and cosine similarity
 *
 * Usage:
 *   deno run scripts/search.ts "configure audio settings"
 *   deno run scripts/search.ts "fix microphone" --category=audio --limit=5
 */

import { TursoClient } from "./lib/turso-client.ts";
import { ScriptRepository } from "./lib/script-repository.ts";
import { EmbeddingGenerator } from "./lib/embedding-generator.ts";
import { SearchResult, VectorSearch } from "./lib/vector-search.ts";
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";

export interface ParsedArgs {
  query: string;
  options: {
    topN: number;
    category?: string;
    minSimilarity?: number;
  };
  showHelp: boolean;
}

export interface Config {
  tursoUrl: string;
  tursoAuthToken: string;
  openaiApiKey: string;
  embeddingModel: string;
  embeddingDimensions: number;
}

const HELP_TEXT = `
Semantic Script Search

Search for scripts using natural language queries.

USAGE:
  deno run scripts/search.ts [OPTIONS] <query>

ARGUMENTS:
  <query>              Natural language search query

OPTIONS:
  --category=<name>    Filter by category (audio, system, dev)
  --limit=<n>          Maximum number of results (default: 10)
  --min-similarity=<n> Minimum similarity score 0-1 (default: none)
  --help               Show this help message

EXAMPLES:
  deno run scripts/search.ts "configure audio settings"
  deno run scripts/search.ts "fix microphone" --category=audio
  deno run scripts/search.ts "gpu setup" --limit=5
  deno run scripts/search.ts "davinci resolve" --min-similarity=0.7

CONFIGURATION:
  Set these environment variables in .env:
    TURSO_URL           - Turso database URL
    TURSO_AUTH_TOKEN    - Turso authentication token
    OPENAI_API_KEY      - OpenAI API key for embeddings
`;

/**
 * Parse command-line arguments
 */
export function parseArgs(args: string[]): ParsedArgs {
  // Check for help flag
  if (args.includes("--help") || args.includes("-h")) {
    return {
      query: "",
      options: { topN: 10 },
      showHelp: true,
    };
  }

  const options: ParsedArgs["options"] = {
    topN: 10,
  };

  let query = "";

  for (const arg of args) {
    if (arg.startsWith("--category=")) {
      const category = arg.split("=")[1];
      if (category) {
        options.category = category;
      }
    } else if (arg.startsWith("--limit=")) {
      const limit = parseInt(arg.split("=")[1] || "10", 10);
      options.topN = limit;
    } else if (arg.startsWith("--min-similarity=")) {
      const similarity = parseFloat(arg.split("=")[1] || "0");
      options.minSimilarity = similarity;
    } else if (!arg.startsWith("--")) {
      // Accumulate query parts
      query += (query ? " " : "") + arg;
    }
  }

  if (!query.trim()) {
    throw new Error("Missing required argument: query");
  }

  return {
    query: query.trim(),
    options,
    showHelp: false,
  };
}

/**
 * Load configuration from environment
 */
export function loadConfig(): Config {
  const tursoUrl = Deno.env.get("TURSO_URL");
  const tursoAuthToken = Deno.env.get("TURSO_AUTH_TOKEN");
  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

  if (!tursoUrl) {
    throw new Error("Missing required environment variable: TURSO_URL");
  }
  if (!tursoAuthToken) {
    throw new Error("Missing required environment variable: TURSO_AUTH_TOKEN");
  }
  if (!openaiApiKey) {
    throw new Error("Missing required environment variable: OPENAI_API_KEY");
  }

  const embeddingModel = Deno.env.get("EMBEDDING_MODEL") ||
    "text-embedding-3-small";
  const embeddingDimensions = parseInt(
    Deno.env.get("EMBEDDING_DIMENSIONS") || "1536",
    10,
  );

  return {
    tursoUrl,
    tursoAuthToken,
    openaiApiKey,
    embeddingModel,
    embeddingDimensions,
  };
}

/**
 * Format search results for display
 */
export function formatResults(results: SearchResult[]): string {
  if (results.length === 0) {
    return "No results found.\n";
  }

  let output = `\nFound ${results.length} result${
    results.length === 1 ? "" : "s"
  }:\n\n`;

  for (const result of results) {
    const { script, similarity } = result;

    output += `[${similarity.toFixed(2)}] ${script.name}\n`;
    output += `  Category: ${script.category}\n`;

    if (script.description) {
      output += `  ${script.description}\n`;
    }

    if (script.usage) {
      output += `  Usage: ${script.usage}\n`;
    }

    output += "\n";
  }

  return output;
}

/**
 * Main function
 */
async function main() {
  try {
    // Load .env file if present
    await load({ export: true });

    // Parse arguments
    const parsed = parseArgs(Deno.args);

    if (parsed.showHelp) {
      console.log(HELP_TEXT);
      Deno.exit(0);
    }

    // Load configuration
    const config = loadConfig();

    // Initialize components
    const tursoClient = new TursoClient({
      url: config.tursoUrl,
      authToken: config.tursoAuthToken,
    });

    const repository = new ScriptRepository(tursoClient);

    const embedder = new EmbeddingGenerator({
      apiKey: config.openaiApiKey,
      model: config.embeddingModel,
      dimensions: config.embeddingDimensions,
    });

    const search = new VectorSearch({
      repository,
      embedder,
    });

    // Execute search
    console.log(`Searching for: "${parsed.query}"`);
    if (parsed.options.category) {
      console.log(`Category: ${parsed.options.category}`);
    }

    const results = await search.search(parsed.query, parsed.options);

    // Display results
    console.log(formatResults(results));
  } catch (error) {
    const err = error as Error;
    console.error(`Error: ${err.message}`);
    Deno.exit(1);
  }
}

// Run main if this is the main module
if (import.meta.main) {
  await main();
}
