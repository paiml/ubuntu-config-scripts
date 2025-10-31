#!/usr/bin/env -S deno run --allow-env --allow-net --allow-read

/**
 * MCP Server for Ubuntu Config Scripts
 *
 * Exposes semantic search and script discovery via Model Context Protocol (MCP).
 *
 * Usage in Claude Desktop config:
 * {
 *   "mcpServers": {
 *     "ubuntu-scripts": {
 *       "command": "deno",
 *       "args": ["run", "--allow-env", "--allow-net", "--allow-read", "/path/to/scripts/mcp-server.ts"]
 *     }
 *   }
 * }
 */

import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";
import { TursoClient } from "./lib/turso-client.ts";
import { ScriptRepository } from "./lib/script-repository.ts";
import { EmbeddingGenerator } from "./lib/embedding-generator.ts";
import { VectorSearch } from "./lib/vector-search.ts";

// MCP Protocol Types
interface MCPRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// Server state
let tursoClient: TursoClient;
let repository: ScriptRepository;
let embedder: EmbeddingGenerator;
let search: VectorSearch;
let isInitialized = false;

/**
 * Initialize the server with database connections
 */
async function initialize(): Promise<void> {
  if (isInitialized) return;

  // Load environment variables
  await load({ export: true });

  const tursoUrl = Deno.env.get("TURSO_URL");
  const tursoToken = Deno.env.get("TURSO_AUTH_TOKEN");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");

  if (!tursoUrl || !tursoToken || !openaiKey) {
    throw new Error(
      "Missing required environment variables: TURSO_URL, TURSO_AUTH_TOKEN, OPENAI_API_KEY"
    );
  }

  // Initialize components
  tursoClient = new TursoClient({
    url: tursoUrl,
    authToken: tursoToken,
  });

  await tursoClient.connect();

  repository = new ScriptRepository({ client: tursoClient });

  embedder = new EmbeddingGenerator({
    apiKey: openaiKey,
    model: Deno.env.get("EMBEDDING_MODEL") || "text-embedding-3-small",
    dimensions: parseInt(Deno.env.get("EMBEDDING_DIMENSIONS") || "1536", 10),
  });

  search = new VectorSearch({
    repository,
    embedder,
  });

  isInitialized = true;
}

/**
 * List available MCP tools
 */
function listTools(): MCPTool[] {
  return [
    {
      name: "search_scripts",
      description:
        "Search for Ubuntu configuration scripts using natural language queries. Returns relevant scripts ranked by semantic similarity.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Natural language search query (e.g., 'configure audio settings')",
          },
          category: {
            type: "string",
            description: "Optional category filter: 'audio', 'system', or 'dev'",
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return (default: 5)",
          },
          minSimilarity: {
            type: "number",
            description: "Minimum similarity score 0.0-1.0 (default: 0.0)",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "list_scripts",
      description:
        "List all available Ubuntu configuration scripts, optionally filtered by category.",
      inputSchema: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description: "Optional category filter: 'audio', 'system', or 'dev'",
          },
          limit: {
            type: "number",
            description: "Maximum number of scripts to return (default: 50)",
          },
        },
        required: [],
      },
    },
    {
      name: "get_script",
      description: "Get detailed information about a specific script by name or path.",
      inputSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Script name (e.g., 'configure-speakers.ts')",
          },
        },
        required: ["name"],
      },
    },
  ];
}

/**
 * Execute a tool call
 */
async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  await initialize();

  switch (name) {
    case "search_scripts": {
      const query = args.query as string;
      const category = args.category as string | undefined;
      const limit = (args.limit as number) || 5;
      const minSimilarity = (args.minSimilarity as number) || 0.0;

      const results = await search.search(query, {
        category,
        topN: limit,
        minSimilarity,
      });

      return {
        found: results.length,
        results: results.map((r) => ({
          name: r.script.name,
          path: r.script.path,
          category: r.script.category,
          description: r.script.description,
          usage: r.script.usage,
          tags: r.script.tags,
          similarity: r.similarity.toFixed(3),
        })),
      };
    }

    case "list_scripts": {
      const category = args.category as string | undefined;
      const limit = (args.limit as number) || 50;

      const listOptions: { limit: number; offset: number; category?: string } = {
        limit,
        offset: 0,
      };
      if (category) {
        listOptions.category = category;
      }

      const scripts = await repository.list(listOptions);

      return {
        count: scripts.length,
        scripts: scripts.map((s) => ({
          name: s.name,
          path: s.path,
          category: s.category,
          description: s.description,
          usage: s.usage,
          tags: s.tags,
        })),
      };
    }

    case "get_script": {
      const name = args.name as string;

      // Search by name or path
      const allScripts = await repository.list({ limit: 1000, offset: 0 });
      const script = allScripts.find(
        (s) => s.name === name || s.path.includes(name)
      );

      if (!script) {
        throw new Error(`Script not found: ${name}`);
      }

      return {
        name: script.name,
        path: script.path,
        category: script.category,
        description: script.description,
        usage: script.usage,
        tags: script.tags,
        dependencies: script.dependencies,
        created_at: script.created_at,
        updated_at: script.updated_at,
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

/**
 * Handle an MCP request
 */
async function handleRequest(request: MCPRequest): Promise<MCPResponse> {
  try {
    switch (request.method) {
      case "initialize":
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: "ubuntu-scripts",
              version: "0.1.0",
            },
          },
        };

      case "tools/list":
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: {
            tools: listTools(),
          },
        };

      case "tools/call": {
        const params = request.params as {
          name: string;
          arguments: Record<string, unknown>;
        };
        const result = await executeTool(params.name, params.arguments);
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          },
        };
      }

      default:
        throw new Error(`Unknown method: ${request.method}`);
    }
  } catch (error) {
    return {
      jsonrpc: "2.0",
      id: request.id,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Main server loop - read requests from stdin, write responses to stdout
 */
async function main(): Promise<void> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  // Write server greeting to stderr for debugging
  await Deno.stderr.write(
    encoder.encode("Ubuntu Config Scripts MCP Server v0.1.0 started\n")
  );

  const reader = Deno.stdin.readable.getReader();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete JSON objects (one per line)
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.substring(0, newlineIndex).trim();
        buffer = buffer.substring(newlineIndex + 1);

        if (line.length === 0) continue;

        try {
          const request = JSON.parse(line) as MCPRequest;
          const response = await handleRequest(request);

          // Write response to stdout
          await Deno.stdout.write(
            encoder.encode(JSON.stringify(response) + "\n")
          );
        } catch (error) {
          // Log parse errors to stderr
          await Deno.stderr.write(
            encoder.encode(`Error parsing request: ${error}\n`)
          );
        }
      }
    }
  } finally {
    reader.releaseLock();
    if (isInitialized && tursoClient) {
      await tursoClient.disconnect();
    }
  }
}

// Run the server
if (import.meta.main) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    Deno.exit(1);
  });
}
