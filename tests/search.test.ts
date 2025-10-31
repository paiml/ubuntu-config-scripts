import { assertEquals, assertExists } from "../deps.ts";
import { formatResults, loadConfig, parseArgs } from "../scripts/search.ts";
import type { SearchResult } from "../scripts/lib/vector-search.ts";

// Unit tests for search CLI
// RED phase - these tests should FAIL initially

Deno.test("parseArgs - parses query from args", () => {
  const args = ["configure audio"];
  const result = parseArgs(args);

  assertEquals(result.query, "configure audio");
  assertEquals(result.options.topN, 10); // Default
});

Deno.test("parseArgs - parses --category flag", () => {
  const args = ["fix audio", "--category=audio"];
  const result = parseArgs(args);

  assertEquals(result.query, "fix audio");
  assertEquals(result.options.category, "audio");
});

Deno.test("parseArgs - parses --limit flag", () => {
  const args = ["gpu setup", "--limit=5"];
  const result = parseArgs(args);

  assertEquals(result.query, "gpu setup");
  assertEquals(result.options.topN, 5);
});

Deno.test("parseArgs - parses --min-similarity flag", () => {
  const args = ["davinci resolve", "--min-similarity=0.7"];
  const result = parseArgs(args);

  assertEquals(result.query, "davinci resolve");
  assertEquals(result.options.minSimilarity, 0.7);
});

Deno.test("parseArgs - handles multiple flags", () => {
  const args = [
    "audio fix",
    "--category=audio",
    "--limit=3",
    "--min-similarity=0.8",
  ];
  const result = parseArgs(args);

  assertEquals(result.query, "audio fix");
  assertEquals(result.options.category, "audio");
  assertEquals(result.options.topN, 3);
  assertEquals(result.options.minSimilarity, 0.8);
});

Deno.test("parseArgs - throws on missing query", () => {
  let error: Error | null = null;
  try {
    parseArgs([]);
  } catch (e) {
    error = e as Error;
  }

  assertExists(error);
  assertEquals(error?.message.includes("query"), true);
});

Deno.test("parseArgs - detects --help flag", () => {
  const args = ["--help"];
  const result = parseArgs(args);

  assertEquals(result.showHelp, true);
});

Deno.test("loadConfig - loads from environment", () => {
  // Mock environment
  const originalEnv = Deno.env.toObject();

  try {
    Deno.env.set("TURSO_URL", "libsql://test.turso.io");
    Deno.env.set("TURSO_AUTH_TOKEN", "test-token");
    Deno.env.set("OPENAI_API_KEY", "sk-test-key");

    const config = loadConfig();

    assertEquals(config.tursoUrl, "libsql://test.turso.io");
    assertEquals(config.tursoAuthToken, "test-token");
    assertEquals(config.openaiApiKey, "sk-test-key");
  } finally {
    // Restore environment
    for (const key of Object.keys(Deno.env.toObject())) {
      if (!originalEnv[key]) {
        Deno.env.delete(key);
      }
    }
    for (const [key, value] of Object.entries(originalEnv)) {
      Deno.env.set(key, value);
    }
  }
});

Deno.test("loadConfig - uses defaults for optional fields", () => {
  const originalEnv = Deno.env.toObject();

  try {
    Deno.env.set("TURSO_URL", "libsql://test.turso.io");
    Deno.env.set("TURSO_AUTH_TOKEN", "test-token");
    Deno.env.set("OPENAI_API_KEY", "sk-test-key");
    Deno.env.delete("EMBEDDING_MODEL");
    Deno.env.delete("EMBEDDING_DIMENSIONS");

    const config = loadConfig();

    assertEquals(config.embeddingModel, "text-embedding-3-small");
    assertEquals(config.embeddingDimensions, 1536);
  } finally {
    for (const key of Object.keys(Deno.env.toObject())) {
      if (!originalEnv[key]) {
        Deno.env.delete(key);
      }
    }
    for (const [key, value] of Object.entries(originalEnv)) {
      Deno.env.set(key, value);
    }
  }
});

Deno.test("loadConfig - throws on missing required fields", () => {
  const originalEnv = Deno.env.toObject();

  try {
    Deno.env.delete("TURSO_URL");
    Deno.env.delete("TURSO_AUTH_TOKEN");
    Deno.env.delete("OPENAI_API_KEY");

    let error: Error | null = null;
    try {
      loadConfig();
    } catch (e) {
      error = e as Error;
    }

    assertExists(error);
    assertEquals(error?.message.includes("TURSO_URL"), true);
  } finally {
    for (const key of Object.keys(Deno.env.toObject())) {
      if (!originalEnv[key]) {
        Deno.env.delete(key);
      }
    }
    for (const [key, value] of Object.entries(originalEnv)) {
      Deno.env.set(key, value);
    }
  }
});

Deno.test("formatResults - formats search results", () => {
  const results: SearchResult[] = [
    {
      script: {
        id: 1,
        name: "configure-speakers",
        path: "/scripts/audio/configure-speakers.ts",
        category: "audio",
        description: "Configure external speaker settings",
        usage: "deno run scripts/audio/configure-speakers.ts",
      },
      similarity: 0.95,
    },
    {
      script: {
        id: 2,
        name: "enable-mic",
        path: "/scripts/audio/enable-mic.ts",
        category: "audio",
        description: "Enable and configure microphone",
        usage: "deno run scripts/audio/enable-mic.ts",
      },
      similarity: 0.87,
    },
  ];

  const output = formatResults(results);

  assertEquals(output.includes("configure-speakers"), true);
  assertEquals(output.includes("0.95"), true);
  assertEquals(output.includes("enable-mic"), true);
  assertEquals(output.includes("0.87"), true);
  assertEquals(output.includes("Category: audio"), true);
});

Deno.test("formatResults - handles empty results", () => {
  const results: SearchResult[] = [];
  const output = formatResults(results);

  assertEquals(output.includes("No results found"), true);
});

Deno.test("formatResults - handles missing optional fields", () => {
  const results: SearchResult[] = [
    {
      script: {
        name: "test-script",
        path: "/test.ts",
        category: "test",
      },
      similarity: 0.8,
    },
  ];

  const output = formatResults(results);

  assertEquals(output.includes("test-script"), true);
  assertEquals(output.includes("0.80"), true);
});

Deno.test("formatResults - shows result count", () => {
  const results: SearchResult[] = [
    {
      script: {
        name: "script1",
        path: "/s1.ts",
        category: "test",
      },
      similarity: 0.9,
    },
    {
      script: {
        name: "script2",
        path: "/s2.ts",
        category: "test",
      },
      similarity: 0.8,
    },
    {
      script: {
        name: "script3",
        path: "/s3.ts",
        category: "test",
      },
      similarity: 0.7,
    },
  ];

  const output = formatResults(results);

  assertEquals(output.includes("Found 3 results"), true);
});
