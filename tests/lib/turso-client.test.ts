import { assertEquals, assertThrows } from "../../deps.ts";
import { TursoClient, TursoConfig } from "../../scripts/lib/turso-client.ts";

// Unit tests for Turso database client
// These tests focus on logic validation without requiring a real database

Deno.test("TursoClient - constructor accepts valid config", () => {
  const config: TursoConfig = {
    url: "libsql://test.turso.io",
    authToken: "test-token-12345",
  };

  const client = new TursoClient(config);
  assertEquals(typeof client, "object");
});

Deno.test("TursoClient - constructor accepts http URL", () => {
  const config: TursoConfig = {
    url: "http://localhost:8080",
    authToken: "test-token",
  };

  const client = new TursoClient(config);
  assertEquals(typeof client, "object");
});

Deno.test("TursoClient - constructor accepts https URL", () => {
  const config: TursoConfig = {
    url: "https://example.turso.io",
    authToken: "test-token",
  };

  const client = new TursoClient(config);
  assertEquals(typeof client, "object");
});

Deno.test("TursoClient - constructor throws on empty URL", () => {
  assertThrows(
    () => {
      new TursoClient({
        url: "",
        authToken: "test-token",
      });
    },
    Error,
    "Invalid URL",
  );
});

Deno.test("TursoClient - constructor throws on whitespace-only URL", () => {
  assertThrows(
    () => {
      new TursoClient({
        url: "   ",
        authToken: "test-token",
      });
    },
    Error,
    "Invalid URL",
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
    "Invalid auth token",
  );
});

Deno.test("TursoClient - constructor throws on whitespace-only token", () => {
  assertThrows(
    () => {
      new TursoClient({
        url: "libsql://test.turso.io",
        authToken: "   ",
      });
    },
    Error,
    "Invalid auth token",
  );
});

Deno.test("TursoClient - isConnected returns false before connect", () => {
  const config: TursoConfig = {
    url: "libsql://test.turso.io",
    authToken: "test-token",
  };

  const client = new TursoClient(config);
  assertEquals(client.isConnected(), false);
});

Deno.test("TursoClient - isConnected returns false after disconnect", async () => {
  const config: TursoConfig = {
    url: "libsql://test.turso.io",
    authToken: "test-token",
  };

  const client = new TursoClient(config);
  await client.disconnect(); // Should be safe even if not connected
  assertEquals(client.isConnected(), false);
});

Deno.test("TursoClient - validates auth token is non-empty string", () => {
  const validTokens = [
    "simple-token",
    "token-with-dashes",
    "token_with_underscores",
    "tokenWith123Numbers",
    "very-long-token-that-is-still-valid-12345678",
  ];

  for (const token of validTokens) {
    const client = new TursoClient({
      url: "libsql://test.turso.io",
      authToken: token,
    });
    assertEquals(typeof client, "object");
  }
});

Deno.test("TursoClient - validates URL is non-empty string", () => {
  const validUrls = [
    "libsql://test.turso.io",
    "https://api.turso.tech",
    "http://localhost:8080",
    "wss://example.com",
  ];

  for (const url of validUrls) {
    const client = new TursoClient({
      url,
      authToken: "test-token",
    });
    assertEquals(typeof client, "object");
  }
});

Deno.test("TursoClient - constructor validates both URL and token", () => {
  // Test that validation happens for both fields
  const invalidConfigs = [
    { url: "", authToken: "" },
    { url: "   ", authToken: "   " },
    { url: "", authToken: "valid-token" },
    { url: "valid-url", authToken: "" },
  ];

  for (const config of invalidConfigs) {
    assertThrows(
      () => {
        new TursoClient(config);
      },
      Error,
    );
  }
});
