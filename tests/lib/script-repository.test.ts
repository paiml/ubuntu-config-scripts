import {
  assertEquals,
  assertExists,
  assertRejects,
} from "../../deps.ts";
import { ScriptRepository } from "../../scripts/lib/script-repository.ts";
import { TursoClient } from "../../scripts/lib/turso-client.ts";

// Unit tests for ScriptRepository (CRUD operations)
// RED phase - these tests should FAIL initially

const testScript = {
  name: "test-script",
  path: "/test/path/test-script.ts",
  category: "test",
  description: "Test script description",
  usage: "deno run test-script.ts",
  tags: ["test", "example"],
  dependencies: ["./lib.ts"],
  embedding_text: "Test script description",
  embedding: new Array(1536).fill(0.1),
  tokens: 10,
};

Deno.test("ScriptRepository - constructor creates instance", () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });

  const repo = new ScriptRepository(client);
  assertExists(repo);
});

Deno.test("ScriptRepository - constructor throws on missing client", () => {
  assertRejects(
    async () => {
      new ScriptRepository(null as unknown as TursoClient);
    },
    Error,
    "client is required"
  );
});

Deno.test("ScriptRepository - create inserts script", async () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });

  const repo = new ScriptRepository(client);

  // Mock execute
  let executeCalled = false;
  client.execute = async (sql: string) => {
    if (sql.includes("INSERT")) {
      executeCalled = true;
    }
  };

  // Mock query to return ID
  client.query = async <T>(): Promise<T[]> => {
    return [{ id: 1 }] as T[];
  };

  const id = await repo.create(testScript);
  assertEquals(executeCalled, true);
  assertEquals(id, 1);
});

Deno.test("ScriptRepository - create validates required fields", async () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });

  const repo = new ScriptRepository(client);

  await assertRejects(
    async () => await repo.create({ ...testScript, name: "" }),
    Error,
    "name is required"
  );

  await assertRejects(
    async () => await repo.create({ ...testScript, path: "" }),
    Error,
    "path is required"
  );

  await assertRejects(
    async () => await repo.create({ ...testScript, category: "" }),
    Error,
    "category is required"
  );
});

Deno.test("ScriptRepository - getById retrieves script", async () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });

  const repo = new ScriptRepository(client);

  // Mock query
  client.query = async <T>(): Promise<T[]> => {
    return [{
      id: 1,
      name: "test-script",
      path: "/test/path/test-script.ts",
      category: "test",
      description: "Test script",
      usage: "deno run test.ts",
      tags: JSON.stringify(["test"]),
      dependencies: JSON.stringify(["./lib.ts"]),
      embedding_text: "Test script",
      embedding: JSON.stringify(new Array(1536).fill(0.1)),
      tokens: 10,
    }] as T[];
  };

  const script = await repo.getById(1);
  assertExists(script);
  assertEquals(script?.id, 1);
  assertEquals(script?.name, "test-script");
  assertEquals(Array.isArray(script?.tags), true);
  assertEquals(Array.isArray(script?.dependencies), true);
  assertEquals(Array.isArray(script?.embedding), true);
});

Deno.test("ScriptRepository - getById returns null for not found", async () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });

  const repo = new ScriptRepository(client);

  // Mock query returning empty
  client.query = async <T>(): Promise<T[]> => {
    return [] as T[];
  };

  const script = await repo.getById(999);
  assertEquals(script, null);
});

Deno.test("ScriptRepository - getByPath retrieves script", async () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });

  const repo = new ScriptRepository(client);

  // Mock query
  client.query = async <T>(): Promise<T[]> => {
    return [{
      id: 1,
      name: "test-script",
      path: "/test/path/test-script.ts",
      category: "test",
      description: "Test script",
      usage: "",
      tags: "[]",
      dependencies: "[]",
      embedding_text: "",
      embedding: JSON.stringify([]),
      tokens: 0,
    }] as T[];
  };

  const script = await repo.getByPath("/test/path/test-script.ts");
  assertExists(script);
  assertEquals(script?.path, "/test/path/test-script.ts");
});

Deno.test("ScriptRepository - update modifies script", async () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });

  const repo = new ScriptRepository(client);

  // Mock execute
  let updateCalled = false;
  client.execute = async (sql: string) => {
    if (sql.includes("UPDATE")) {
      updateCalled = true;
    }
  };

  await repo.update(1, { description: "Updated description" });
  assertEquals(updateCalled, true);
});

Deno.test("ScriptRepository - update validates ID", async () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });

  const repo = new ScriptRepository(client);

  await assertRejects(
    async () => await repo.update(0, { description: "test" }),
    Error,
    "Invalid ID"
  );

  await assertRejects(
    async () => await repo.update(-1, { description: "test" }),
    Error,
    "Invalid ID"
  );
});

Deno.test("ScriptRepository - delete removes script", async () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });

  const repo = new ScriptRepository(client);

  // Mock execute
  let deleteCalled = false;
  client.execute = async (sql: string) => {
    if (sql.includes("DELETE")) {
      deleteCalled = true;
    }
  };

  await repo.delete(1);
  assertEquals(deleteCalled, true);
});

Deno.test("ScriptRepository - delete validates ID", async () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });

  const repo = new ScriptRepository(client);

  await assertRejects(
    async () => await repo.delete(0),
    Error,
    "Invalid ID"
  );
});

Deno.test("ScriptRepository - list returns paginated results", async () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });

  const repo = new ScriptRepository(client);

  // Mock query
  client.query = async <T>(): Promise<T[]> => {
    return [
      { id: 1, name: "script1", path: "/s1.ts", category: "test", description: "", usage: "", tags: "[]", dependencies: "[]", embedding_text: "", embedding: "[]", tokens: 0 },
      { id: 2, name: "script2", path: "/s2.ts", category: "test", description: "", usage: "", tags: "[]", dependencies: "[]", embedding_text: "", embedding: "[]", tokens: 0 },
    ] as T[];
  };

  const scripts = await repo.list({ limit: 10, offset: 0 });
  assertEquals(scripts.length, 2);
  assertEquals(scripts[0]?.name, "script1");
  assertEquals(scripts[1]?.name, "script2");
});

Deno.test("ScriptRepository - list filters by category", async () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });

  const repo = new ScriptRepository(client);

  // Track SQL query
  let querySql = "";
  client.query = async <T>(sql: string): Promise<T[]> => {
    querySql = sql;
    return [] as T[];
  };

  await repo.list({ category: "audio", limit: 10, offset: 0 });
  assertEquals(querySql.includes("WHERE category = ?"), true);
});

Deno.test("ScriptRepository - list applies pagination", async () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });

  const repo = new ScriptRepository(client);

  // Track SQL query
  let querySql = "";
  client.query = async <T>(sql: string): Promise<T[]> => {
    querySql = sql;
    return [] as T[];
  };

  await repo.list({ limit: 5, offset: 10 });
  assertEquals(querySql.includes("LIMIT"), true);
  assertEquals(querySql.includes("OFFSET"), true);
});

Deno.test("ScriptRepository - count returns total", async () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });

  const repo = new ScriptRepository(client);

  // Mock query
  client.query = async <T>(): Promise<T[]> => {
    return [{ count: 42 }] as T[];
  };

  const total = await repo.count();
  assertEquals(total, 42);
});

Deno.test("ScriptRepository - count filters by category", async () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });

  const repo = new ScriptRepository(client);

  // Track SQL query
  let querySql = "";
  client.query = async <T>(sql: string): Promise<T[]> => {
    querySql = sql;
    return [{ count: 10 }] as T[];
  };

  await repo.count("audio");
  assertEquals(querySql.includes("WHERE category = ?"), true);
});

Deno.test("ScriptRepository - listCategories returns unique categories", async () => {
  const client = new TursoClient({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });

  const repo = new ScriptRepository(client);

  // Mock query
  client.query = async <T>(): Promise<T[]> => {
    return [
      { category: "audio" },
      { category: "system" },
      { category: "dev" },
    ] as T[];
  };

  const categories = await repo.listCategories();
  assertEquals(categories.length, 3);
  assertEquals(categories.includes("audio"), true);
  assertEquals(categories.includes("system"), true);
  assertEquals(categories.includes("dev"), true);
});
