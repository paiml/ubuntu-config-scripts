import {
  assertEquals,
  assertExists,
  assertRejects,
} from "../../deps.ts";
import { VectorSearch } from "../../scripts/lib/vector-search.ts";
import { ScriptRepository } from "../../scripts/lib/script-repository.ts";
import { EmbeddingGenerator } from "../../scripts/lib/embedding-generator.ts";
import { TursoClient } from "../../scripts/lib/turso-client.ts";

// Unit tests for VectorSearch
// RED phase - these tests should FAIL initially

Deno.test("VectorSearch - constructor creates instance", () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });
  const repo = new ScriptRepository(client);
  const embedder = new EmbeddingGenerator({
    apiKey: "sk-test-key",
    model: "text-embedding-3-small",
  });

  const search = new VectorSearch({ repository: repo, embedder });
  assertExists(search);
});

Deno.test("VectorSearch - constructor throws on missing repository", () => {
  const embedder = new EmbeddingGenerator({
    apiKey: "sk-test-key",
    model: "text-embedding-3-small",
  });

  assertRejects(
    async () => {
      new VectorSearch({
        repository: null as unknown as ScriptRepository,
        embedder,
      });
    },
    Error,
    "repository is required"
  );
});

Deno.test("VectorSearch - constructor throws on missing embedder", () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });
  const repo = new ScriptRepository(client);

  assertRejects(
    async () => {
      new VectorSearch({
        repository: repo,
        embedder: null as unknown as EmbeddingGenerator,
      });
    },
    Error,
    "embedder is required"
  );
});

Deno.test("VectorSearch - cosineSimilarity calculates correctly", () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });
  const repo = new ScriptRepository(client);
  const embedder = new EmbeddingGenerator({
    apiKey: "sk-test-key",
    model: "text-embedding-3-small",
  });

  const search = new VectorSearch({ repository: repo, embedder });

  // Identical vectors should have similarity of 1.0
  const similarity1 = search.cosineSimilarity([1, 0, 0], [1, 0, 0]);
  assertEquals(Math.abs(similarity1 - 1.0) < 0.0001, true);

  // Orthogonal vectors should have similarity of 0.0
  const similarity2 = search.cosineSimilarity([1, 0, 0], [0, 1, 0]);
  assertEquals(Math.abs(similarity2 - 0.0) < 0.0001, true);

  // Opposite vectors should have similarity of -1.0
  const similarity3 = search.cosineSimilarity([1, 0, 0], [-1, 0, 0]);
  assertEquals(Math.abs(similarity3 - (-1.0)) < 0.0001, true);
});

Deno.test("VectorSearch - cosineSimilarity handles normalized vectors", () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });
  const repo = new ScriptRepository(client);
  const embedder = new EmbeddingGenerator({
    apiKey: "sk-test-key",
    model: "text-embedding-3-small",
  });

  const search = new VectorSearch({ repository: repo, embedder });

  // Scaled vectors should have same similarity as unit vectors
  const similarity1 = search.cosineSimilarity([2, 0, 0], [2, 0, 0]);
  assertEquals(Math.abs(similarity1 - 1.0) < 0.0001, true);

  const similarity2 = search.cosineSimilarity([0.5, 0.5, 0], [0.5, 0.5, 0]);
  assertEquals(Math.abs(similarity2 - 1.0) < 0.0001, true);
});

Deno.test("VectorSearch - cosineSimilarity handles zero vectors", () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });
  const repo = new ScriptRepository(client);
  const embedder = new EmbeddingGenerator({
    apiKey: "sk-test-key",
    model: "text-embedding-3-small",
  });

  const search = new VectorSearch({ repository: repo, embedder });

  // Zero vector should return 0 similarity
  const similarity = search.cosineSimilarity([0, 0, 0], [1, 2, 3]);
  assertEquals(similarity, 0);
});

Deno.test("VectorSearch - search finds similar scripts", async () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });
  const repo = new ScriptRepository(client);
  const embedder = new EmbeddingGenerator({
    apiKey: "sk-test-key",
    model: "text-embedding-3-small",
  });

  const search = new VectorSearch({ repository: repo, embedder });

  // Mock embedder
  embedder.generateEmbedding = async () => ({
    embedding: [1, 0, 0],
    tokens: 5,
    model: "test",
  });

  // Mock repository
  repo.list = async () => [
    {
      id: 1,
      name: "script1",
      path: "/s1.ts",
      category: "test",
      embedding: [1, 0, 0], // Perfect match
    },
    {
      id: 2,
      name: "script2",
      path: "/s2.ts",
      category: "test",
      embedding: [0.7, 0.7, 0], // Partial match
    },
    {
      id: 3,
      name: "script3",
      path: "/s3.ts",
      category: "test",
      embedding: [0, 1, 0], // Orthogonal
    },
  ];

  const results = await search.search("test query", { topN: 10 });

  assertEquals(results.length, 3);
  // Results should be sorted by similarity descending
  assertEquals(results[0]?.script.id, 1); // Perfect match first
  assertEquals(Math.abs((results[0]?.similarity || 0) - 1.0) < 0.0001, true);
});

Deno.test("VectorSearch - search filters by topN", async () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });
  const repo = new ScriptRepository(client);
  const embedder = new EmbeddingGenerator({
    apiKey: "sk-test-key",
    model: "text-embedding-3-small",
  });

  const search = new VectorSearch({ repository: repo, embedder });

  // Mock embedder
  embedder.generateEmbedding = async () => ({
    embedding: [1, 0, 0],
    tokens: 5,
    model: "test",
  });

  // Mock repository with 5 scripts
  repo.list = async () => [
    { id: 1, name: "s1", path: "/s1.ts", category: "test", embedding: [1, 0, 0] },
    { id: 2, name: "s2", path: "/s2.ts", category: "test", embedding: [0.9, 0.1, 0] },
    { id: 3, name: "s3", path: "/s3.ts", category: "test", embedding: [0.8, 0.2, 0] },
    { id: 4, name: "s4", path: "/s4.ts", category: "test", embedding: [0.7, 0.3, 0] },
    { id: 5, name: "s5", path: "/s5.ts", category: "test", embedding: [0.6, 0.4, 0] },
  ];

  const results = await search.search("test query", { topN: 3 });

  assertEquals(results.length, 3); // Only top 3
});

Deno.test("VectorSearch - search filters by category", async () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });
  const repo = new ScriptRepository(client);
  const embedder = new EmbeddingGenerator({
    apiKey: "sk-test-key",
    model: "text-embedding-3-small",
  });

  const search = new VectorSearch({ repository: repo, embedder });

  // Mock embedder
  embedder.generateEmbedding = async () => ({
    embedding: [1, 0, 0],
    tokens: 5,
    model: "test",
  });

  // Track list call
  let listCategory: string | undefined;
  repo.list = async (options) => {
    listCategory = options.category;
    return [];
  };

  await search.search("test query", { category: "audio", topN: 10 });

  assertEquals(listCategory, "audio");
});

Deno.test("VectorSearch - search filters by minSimilarity", async () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });
  const repo = new ScriptRepository(client);
  const embedder = new EmbeddingGenerator({
    apiKey: "sk-test-key",
    model: "text-embedding-3-small",
  });

  const search = new VectorSearch({ repository: repo, embedder });

  // Mock embedder
  embedder.generateEmbedding = async () => ({
    embedding: [1, 0, 0],
    tokens: 5,
    model: "test",
  });

  // Mock repository
  repo.list = async () => [
    { id: 1, name: "s1", path: "/s1.ts", category: "test", embedding: [1, 0, 0] }, // sim = 1.0
    { id: 2, name: "s2", path: "/s2.ts", category: "test", embedding: [0.7, 0.7, 0] }, // sim ≈ 0.7
    { id: 3, name: "s3", path: "/s3.ts", category: "test", embedding: [0, 1, 0] }, // sim = 0.0
  ];

  const results = await search.search("test query", {
    topN: 10,
    minSimilarity: 0.5,
  });

  // Should only include scripts with similarity >= 0.5
  assertEquals(results.length, 2); // s1 and s2, not s3
  assertEquals(results.every((r) => r.similarity >= 0.5), true);
});

Deno.test("VectorSearch - search returns empty for no matches", async () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });
  const repo = new ScriptRepository(client);
  const embedder = new EmbeddingGenerator({
    apiKey: "sk-test-key",
    model: "text-embedding-3-small",
  });

  const search = new VectorSearch({ repository: repo, embedder });

  // Mock embedder
  embedder.generateEmbedding = async () => ({
    embedding: [1, 0, 0],
    tokens: 5,
    model: "test",
  });

  // Mock repository with no scripts
  repo.list = async () => [];

  const results = await search.search("test query", { topN: 10 });

  assertEquals(results.length, 0);
});

Deno.test("VectorSearch - search skips scripts without embeddings", async () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });
  const repo = new ScriptRepository(client);
  const embedder = new EmbeddingGenerator({
    apiKey: "sk-test-key",
    model: "text-embedding-3-small",
  });

  const search = new VectorSearch({ repository: repo, embedder });

  // Mock embedder
  embedder.generateEmbedding = async () => ({
    embedding: [1, 0, 0],
    tokens: 5,
    model: "test",
  });

  // Mock repository with script without embedding
  repo.list = async () => [
    { id: 1, name: "s1", path: "/s1.ts", category: "test" }, // No embedding
    { id: 2, name: "s2", path: "/s2.ts", category: "test", embedding: [1, 0, 0] },
  ];

  const results = await search.search("test query", { topN: 10 });

  assertEquals(results.length, 1); // Only s2
  assertEquals(results[0]?.script.id, 2);
});

Deno.test("VectorSearch - search validates query", async () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });
  const repo = new ScriptRepository(client);
  const embedder = new EmbeddingGenerator({
    apiKey: "sk-test-key",
    model: "text-embedding-3-small",
  });

  const search = new VectorSearch({ repository: repo, embedder });

  await assertRejects(
    async () => await search.search("", { topN: 10 }),
    Error,
    "query cannot be empty"
  );
});

Deno.test("VectorSearch - search validates topN", async () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });
  const repo = new ScriptRepository(client);
  const embedder = new EmbeddingGenerator({
    apiKey: "sk-test-key",
    model: "text-embedding-3-small",
  });

  const search = new VectorSearch({ repository: repo, embedder });

  await assertRejects(
    async () => await search.search("test", { topN: 0 }),
    Error,
    "topN must be positive"
  );

  await assertRejects(
    async () => await search.search("test", { topN: -5 }),
    Error,
    "topN must be positive"
  );
});
