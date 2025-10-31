import { assertEquals, assertExists, assertRejects } from "../../deps.ts";
import { DatabaseSeeder } from "../../scripts/lib/database-seeder.ts";
import { TursoClient } from "../../scripts/lib/turso-client.ts";
import { ScriptAnalyzer } from "../../scripts/lib/script-analyzer.ts";
import { EmbeddingGenerator } from "../../scripts/lib/embedding-generator.ts";

// Unit tests for DatabaseSeeder
// RED phase - these tests should FAIL initially

Deno.test("DatabaseSeeder - constructor creates instance", () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });
  const analyzer = new ScriptAnalyzer();
  const embedder = new EmbeddingGenerator({
    apiKey: "sk-test-key",
    model: "text-embedding-3-small",
  });

  const seeder = new DatabaseSeeder({
    client,
    analyzer,
    embedder,
  });

  assertExists(seeder);
});

Deno.test("DatabaseSeeder - constructor throws on missing client", () => {
  assertRejects(
    async () => {
      const analyzer = new ScriptAnalyzer();
      const embedder = new EmbeddingGenerator({
        apiKey: "sk-test-key",
        model: "text-embedding-3-small",
      });

      new DatabaseSeeder({
        client: null as unknown as TursoClient,
        analyzer,
        embedder,
      });
    },
    Error,
    "client is required",
  );
});

Deno.test("DatabaseSeeder - constructor throws on missing analyzer", () => {
  assertRejects(
    async () => {
      const client = new TursoClient({
        url: "libsql://test.turso.io",
        authToken: "test-token",
      });
      const embedder = new EmbeddingGenerator({
        apiKey: "sk-test-key",
        model: "text-embedding-3-small",
      });

      new DatabaseSeeder({
        client,
        analyzer: null as unknown as ScriptAnalyzer,
        embedder,
      });
    },
    Error,
    "analyzer is required",
  );
});

Deno.test("DatabaseSeeder - constructor throws on missing embedder", () => {
  assertRejects(
    async () => {
      const client = new TursoClient({
        url: "libsql://test.turso.io",
        authToken: "test-token",
      });
      const analyzer = new ScriptAnalyzer();

      new DatabaseSeeder({
        client,
        analyzer,
        embedder: null as unknown as EmbeddingGenerator,
      });
    },
    Error,
    "embedder is required",
  );
});

Deno.test("DatabaseSeeder - initializeSchema creates tables", async () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });
  const analyzer = new ScriptAnalyzer();
  const embedder = new EmbeddingGenerator({
    apiKey: "sk-test-key",
    model: "text-embedding-3-small",
  });

  const seeder = new DatabaseSeeder({ client, analyzer, embedder });

  // Mock the execute method
  let schemaExecuted = false;
  client.execute = async (sql: string) => {
    if (sql.includes("CREATE TABLE")) {
      schemaExecuted = true;
    }
  };

  await seeder.initializeSchema();
  assertEquals(schemaExecuted, true);
});

Deno.test("DatabaseSeeder - discoverScripts finds TypeScript files", async () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });
  const analyzer = new ScriptAnalyzer();
  const embedder = new EmbeddingGenerator({
    apiKey: "sk-test-key",
    model: "text-embedding-3-small",
  });

  const seeder = new DatabaseSeeder({ client, analyzer, embedder });

  // Create temp directory with test files
  const tempDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${tempDir}/test1.ts`, "// test script 1");
  await Deno.writeTextFile(`${tempDir}/test2.ts`, "// test script 2");
  await Deno.writeTextFile(`${tempDir}/test.txt`, "// not a ts file");

  try {
    const scripts = await seeder.discoverScripts(tempDir);
    assertEquals(scripts.length, 2);
    assertEquals(scripts.every((s: string) => s.endsWith(".ts")), true);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("DatabaseSeeder - discoverScripts recursively searches subdirs", async () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });
  const analyzer = new ScriptAnalyzer();
  const embedder = new EmbeddingGenerator({
    apiKey: "sk-test-key",
    model: "text-embedding-3-small",
  });

  const seeder = new DatabaseSeeder({ client, analyzer, embedder });

  // Create nested directory structure
  const tempDir = await Deno.makeTempDir();
  await Deno.mkdir(`${tempDir}/subdir`);
  await Deno.writeTextFile(`${tempDir}/test1.ts`, "// root script");
  await Deno.writeTextFile(`${tempDir}/subdir/test2.ts`, "// subdir script");

  try {
    const scripts = await seeder.discoverScripts(tempDir);
    assertEquals(scripts.length, 2);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("DatabaseSeeder - seedScripts processes and inserts scripts", async () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });
  const analyzer = new ScriptAnalyzer();
  const embedder = new EmbeddingGenerator({
    apiKey: "sk-test-key",
    model: "text-embedding-3-small",
  });

  const seeder = new DatabaseSeeder({ client, analyzer, embedder });

  // Mock embedder
  const originalGenerate = embedder.generateBatch.bind(embedder);
  embedder.generateBatch = async (texts: string[]) => {
    return texts.map(() => ({
      embedding: new Array(1536).fill(0.1),
      tokens: 10,
      model: "text-embedding-3-small",
    }));
  };

  // Mock client execute
  let insertCount = 0;
  client.execute = async (sql: string) => {
    if (sql.includes("INSERT") || sql.includes("REPLACE")) {
      insertCount++;
    }
  };

  // Create test script
  const tempDir = await Deno.makeTempDir();
  await Deno.writeTextFile(
    `${tempDir}/test.ts`,
    `/**
     * Test script
     *
     * Usage:
     * deno run test.ts
     */
    import { foo } from "./lib.ts";
    `,
  );

  try {
    const result = await seeder.seedScripts(tempDir);
    assertEquals(result.processed, 1);
    assertEquals(result.inserted, 1);
    assertEquals(insertCount, 1);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
    embedder.generateBatch = originalGenerate;
  }
});

Deno.test("DatabaseSeeder - seedScripts skips non-ts files", async () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });
  const analyzer = new ScriptAnalyzer();
  const embedder = new EmbeddingGenerator({
    apiKey: "sk-test-key",
    model: "text-embedding-3-small",
  });

  const seeder = new DatabaseSeeder({ client, analyzer, embedder });

  // Create test files
  const tempDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${tempDir}/test.txt`, "not a script");
  await Deno.writeTextFile(`${tempDir}/README.md`, "documentation");

  try {
    const result = await seeder.seedScripts(tempDir);
    assertEquals(result.processed, 0);
    assertEquals(result.inserted, 0);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("DatabaseSeeder - seedScripts handles empty descriptions", async () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });
  const analyzer = new ScriptAnalyzer();
  const embedder = new EmbeddingGenerator({
    apiKey: "sk-test-key",
    model: "text-embedding-3-small",
  });

  const seeder = new DatabaseSeeder({ client, analyzer, embedder });

  // Mock embedder to track calls
  let embedCalls = 0;
  const originalGenerate = embedder.generateBatch.bind(embedder);
  embedder.generateBatch = async (texts: string[]) => {
    embedCalls++;
    return texts.map(() => ({
      embedding: new Array(1536).fill(0.1),
      tokens: 10,
      model: "text-embedding-3-small",
    }));
  };

  // Create script without description
  const tempDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${tempDir}/test.ts`, "console.log('test');");

  try {
    const result = await seeder.seedScripts(tempDir);
    assertEquals(result.processed, 1);
    // Should use filename as fallback for embedding
    assertEquals(embedCalls >= 1, true);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
    embedder.generateBatch = originalGenerate;
  }
});

Deno.test("DatabaseSeeder - seedScripts batches embeddings", async () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });
  const analyzer = new ScriptAnalyzer();
  const embedder = new EmbeddingGenerator({
    apiKey: "sk-test-key",
    model: "text-embedding-3-small",
  });

  const seeder = new DatabaseSeeder({ client, analyzer, embedder });

  // Track batch calls
  let batchCalls = 0;
  const originalGenerate = embedder.generateBatch.bind(embedder);
  embedder.generateBatch = async (texts: string[]) => {
    batchCalls++;
    return texts.map(() => ({
      embedding: new Array(1536).fill(0.1),
      tokens: 10,
      model: "text-embedding-3-small",
    }));
  };

  // Create multiple scripts
  const tempDir = await Deno.makeTempDir();
  for (let i = 0; i < 5; i++) {
    await Deno.writeTextFile(
      `${tempDir}/test${i}.ts`,
      `/** Script ${i} */\nconsole.log(${i});`,
    );
  }

  try {
    const result = await seeder.seedScripts(tempDir);
    assertEquals(result.processed, 5);
    // Should batch multiple scripts in fewer API calls
    assertEquals(batchCalls >= 1, true);
    assertEquals(batchCalls <= 5, true);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
    embedder.generateBatch = originalGenerate;
  }
});

Deno.test("DatabaseSeeder - seedScripts handles embedding errors", async () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });
  const analyzer = new ScriptAnalyzer();
  const embedder = new EmbeddingGenerator({
    apiKey: "sk-test-key",
    model: "text-embedding-3-small",
  });

  const seeder = new DatabaseSeeder({ client, analyzer, embedder });

  // Mock embedder to throw error
  const originalGenerate = embedder.generateBatch.bind(embedder);
  embedder.generateBatch = async () => {
    throw new Error("API error");
  };

  // Create test script
  const tempDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${tempDir}/test.ts`, "/** Test */\n");

  try {
    const result = await seeder.seedScripts(tempDir);
    assertEquals(result.processed, 1);
    assertEquals(result.failed, 1);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
    embedder.generateBatch = originalGenerate;
  }
});

Deno.test("DatabaseSeeder - getStats returns seeding statistics", async () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });
  const analyzer = new ScriptAnalyzer();
  const embedder = new EmbeddingGenerator({
    apiKey: "sk-test-key",
    model: "text-embedding-3-small",
  });

  const seeder = new DatabaseSeeder({ client, analyzer, embedder });

  // Mock query to return stats
  const originalQuery = client.query.bind(client);
  client.query = async <T>(): Promise<T[]> => {
    return [
      {
        total_scripts: 42,
        total_categories: 3,
        avg_tokens: 150,
      },
    ] as T[];
  };

  try {
    const stats = await seeder.getStats();
    assertEquals(stats.total_scripts, 42);
    assertEquals(stats.total_categories, 3);
    assertEquals(stats.avg_tokens, 150);
  } finally {
    client.query = originalQuery;
  }
});

Deno.test("DatabaseSeeder - seedScripts reports progress", async () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });
  const analyzer = new ScriptAnalyzer();
  const embedder = new EmbeddingGenerator({
    apiKey: "sk-test-key",
    model: "text-embedding-3-small",
  });

  // Track progress callbacks
  let progressCalls = 0;
  const onProgress = (current: number, total: number) => {
    progressCalls++;
    assertEquals(current <= total, true);
  };

  const seeder = new DatabaseSeeder({
    client,
    analyzer,
    embedder,
    onProgress,
  });

  // Mock embedder
  const originalGenerate = embedder.generateBatch.bind(embedder);
  embedder.generateBatch = async (texts: string[]) => {
    return texts.map(() => ({
      embedding: new Array(1536).fill(0.1),
      tokens: 10,
      model: "text-embedding-3-small",
    }));
  };

  // Mock client execute
  client.execute = async () => {};

  // Create test scripts
  const tempDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${tempDir}/test1.ts`, "/** Test 1 */\n");
  await Deno.writeTextFile(`${tempDir}/test2.ts`, "/** Test 2 */\n");

  try {
    await seeder.seedScripts(tempDir);
    assertEquals(progressCalls > 0, true);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
    embedder.generateBatch = originalGenerate;
  }
});
