import {
  assertEquals,
  assertExists,
  assertRejects,
  assertThrows,
} from "../../deps.ts";
import { TursoClient, TursoConfig } from "../../scripts/lib/turso-client.ts";

// Unit tests for Turso database client
// Following EXTREME TDD: RED phase - these tests should FAIL initially

Deno.test("TursoClient - constructor creates instance", () => {
  const config: TursoConfig = {
    url: "libsql://test.turso.io",
    authToken: "test-token",
  };

  const client = new TursoClient(config);
  assertExists(client);
});

Deno.test("TursoClient - constructor throws on invalid URL", () => {
  assertThrows(
    () => {
      new TursoClient({
        url: "",
        authToken: "test-token",
      });
    },
    Error,
    "Invalid URL"
  );
});

Deno.test("TursoClient - constructor throws on missing auth token", () => {
  assertThrows(
    () => {
      new TursoClient({
        url: "libsql://test.turso.io",
        authToken: "",
      });
    },
    Error,
    "Invalid auth token"
  );
});

Deno.test(
  "TursoClient - connect establishes connection",
  async () => {
    const config: TursoConfig = {
      url: ":memory:",
      authToken: "test-token",
    };

    const client = new TursoClient(config);
    await client.connect();

    // Connection should be established
    assertEquals(client.isConnected(), true);
  }
);

Deno.test(
  "TursoClient - disconnect closes connection",
  async () => {
    const config: TursoConfig = {
      url: ":memory:",
      authToken: "test-token",
    };

    const client = new TursoClient(config);
    await client.connect();
    await client.disconnect();

    assertEquals(client.isConnected(), false);
  }
);

Deno.test(
  "TursoClient - query throws when not connected",
  async () => {
    const config: TursoConfig = {
      url: ":memory:",
      authToken: "test-token",
    };

    const client = new TursoClient(config);

    await assertRejects(
      async () => await client.query("SELECT 1"),
      Error,
      "Not connected"
    );
  }
);

Deno.test(
  "TursoClient - query executes simple SELECT",
  async () => {
    const config: TursoConfig = {
      url: ":memory:",
      authToken: "test-token",
    };

    const client = new TursoClient(config);
    await client.connect();

    try {
      const result = await client.query<{ value: number }>(
        "SELECT 1 as value"
      );

      assertEquals(result.length, 1);
      assertEquals(result[0]?.value, 1);
    } finally {
      await client.disconnect();
    }
  }
);

Deno.test(
  "TursoClient - query with parameters",
  async () => {
    const config: TursoConfig = {
      url: ":memory:",
      authToken: "test-token",
    };

    const client = new TursoClient(config);
    await client.connect();

    try {
      const result = await client.query<{ sum: number }>(
        "SELECT ? + ? as sum",
        [1, 2]
      );

      assertEquals(result.length, 1);
      assertEquals(result[0]?.sum, 3);
    } finally {
      await client.disconnect();
    }
  }
);

Deno.test(
  "TursoClient - execute creates table",
  async () => {
    const config: TursoConfig = {
      url: ":memory:",
      authToken: "test-token",
    };

    const client = new TursoClient(config);
    await client.connect();

    try {
      await client.execute(`
        CREATE TABLE test_table (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        )
      `);

      // Verify table exists
      const result = await client.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'"
      );

      assertEquals(result.length, 1);
      assertEquals(result[0]?.name, "test_table");
    } finally {
      await client.disconnect();
    }
  }
);

Deno.test(
  "TursoClient - execute with parameters inserts data",
  async () => {
    const config: TursoConfig = {
      url: ":memory:",
      authToken: "test-token",
    };

    const client = new TursoClient(config);
    await client.connect();

    try {
      await client.execute(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL
        )
      `);

      await client.execute(
        "INSERT INTO users (name) VALUES (?)",
        ["Alice"]
      );

      const result = await client.query<{ name: string }>(
        "SELECT name FROM users WHERE name = ?",
        ["Alice"]
      );

      assertEquals(result.length, 1);
      assertEquals(result[0]?.name, "Alice");
    } finally {
      await client.disconnect();
    }
  }
);

Deno.test(
  "TursoClient - handles connection timeout",
  async () => {
    const config: TursoConfig = {
      url: "libsql://nonexistent-server-that-does-not-exist.turso.io",
      authToken: "test-token",
    };

    const client = new TursoClient(config);

    await assertRejects(
      async () => await client.connect(),
      Error
    );
  }
);

Deno.test(
  "TursoClient - handles invalid SQL syntax",
  async () => {
    const config: TursoConfig = {
      url: ":memory:",
      authToken: "test-token",
    };

    const client = new TursoClient(config);
    await client.connect();

    try {
      await assertRejects(
        async () => await client.query("INVALID SQL SYNTAX"),
        Error,
        "syntax error"
      );
    } finally {
      await client.disconnect();
    }
  }
);

Deno.test(
  "TursoClient - query returns empty array for no results",
  async () => {
    const config: TursoConfig = {
      url: ":memory:",
      authToken: "test-token",
    };

    const client = new TursoClient(config);
    await client.connect();

    try {
      await client.execute(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        )
      `);

      const result = await client.query<{ name: string }>(
        "SELECT * FROM users WHERE name = ?",
        ["NonExistent"]
      );

      assertEquals(result.length, 0);
    } finally {
      await client.disconnect();
    }
  }
);

Deno.test(
  "TursoClient - multiple queries in sequence",
  async () => {
    const config: TursoConfig = {
      url: ":memory:",
      authToken: "test-token",
    };

    const client = new TursoClient(config);
    await client.connect();

    try {
      await client.execute(`
        CREATE TABLE items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          value INTEGER NOT NULL
        )
      `);

      await client.execute("INSERT INTO items (value) VALUES (?)", [10]);
      await client.execute("INSERT INTO items (value) VALUES (?)", [20]);
      await client.execute("INSERT INTO items (value) VALUES (?)", [30]);

      const result = await client.query<{ total: number }>(
        "SELECT SUM(value) as total FROM items"
      );

      assertEquals(result[0]?.total, 60);
    } finally {
      await client.disconnect();
    }
  }
);

Deno.test(
  "TursoClient - can reconnect after disconnect",
  async () => {
    const config: TursoConfig = {
      url: ":memory:",
      authToken: "test-token",
    };

    const client = new TursoClient(config);
    await client.connect();
    await client.disconnect();
    await client.connect();

    assertEquals(client.isConnected(), true);

    await client.disconnect();
  }
);
