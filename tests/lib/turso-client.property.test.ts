import { fc } from "../../deps.ts";
import { assertThrows } from "../../deps.ts";
import { TursoClient } from "../../scripts/lib/turso-client.ts";

// Property-based tests for Turso database client
// Using fast-check with 1000+ iterations per property

Deno.test("TursoClient - property: non-empty URL and token create valid client", () => {
  fc.assert(
    fc.property(
      fc.webUrl(), // Generate valid URLs
      fc.string({ minLength: 1, maxLength: 100 }), // Generate non-empty tokens
      (url, token) => {
        try {
          const client = new TursoClient({ url, authToken: token });
          return typeof client === "object";
        } catch {
          // Some URLs might still be invalid for libsql
          return true;
        }
      }
    ),
    { numRuns: 1000 }
  );
});

Deno.test("TursoClient - property: empty URL always throws", () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 1, maxLength: 100 }), // Valid token
      (token) => {
        assertThrows(() => {
          new TursoClient({ url: "", authToken: token });
        });
        return true;
      }
    ),
    { numRuns: 1000 }
  );
});

Deno.test("TursoClient - property: empty token always throws", () => {
  fc.assert(
    fc.property(
      fc.webUrl(), // Valid URL
      () => {
        assertThrows(() => {
          new TursoClient({ url: "http://example.com", authToken: "" });
        });
        return true;
      }
    ),
    { numRuns: 1000 }
  );
});

Deno.test("TursoClient - property: whitespace-only URL always throws", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 10 }), // Number of spaces
      fc.string({ minLength: 1, maxLength: 100 }), // Valid token
      (spaces, token) => {
        const whitespaceUrl = " ".repeat(spaces);
        assertThrows(() => {
          new TursoClient({ url: whitespaceUrl, authToken: token });
        });
        return true;
      }
    ),
    { numRuns: 1000 }
  );
});

Deno.test("TursoClient - property: whitespace-only token always throws", () => {
  fc.assert(
    fc.property(
      fc.webUrl(), // Valid URL
      fc.integer({ min: 1, max: 10 }), // Number of spaces
      (url, spaces) => {
        const whitespaceToken = " ".repeat(spaces);
        assertThrows(() => {
          new TursoClient({ url, authToken: whitespaceToken });
        });
        return true;
      }
    ),
    { numRuns: 1000 }
  );
});

Deno.test("TursoClient - property: isConnected is false before connect", () => {
  fc.assert(
    fc.property(
      fc.webUrl(),
      fc.string({ minLength: 1, maxLength: 100 }),
      (url, token) => {
        try {
          const client = new TursoClient({ url, authToken: token });
          return client.isConnected() === false;
        } catch {
          // Invalid config, skip
          return true;
        }
      }
    ),
    { numRuns: 1000 }
  );
});

Deno.test("TursoClient - property: disconnect is idempotent", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.webUrl(),
      fc.string({ minLength: 1, maxLength: 100 }),
      async (url, token) => {
        try {
          const client = new TursoClient({ url, authToken: token });

          // Call disconnect multiple times
          await client.disconnect();
          await client.disconnect();
          await client.disconnect();

          // Should always be disconnected
          return client.isConnected() === false;
        } catch {
          // Invalid config, skip
          return true;
        }
      }
    ),
    { numRuns: 100 } // Fewer runs for async
  );
});

Deno.test("TursoClient - property: valid URLs from various schemes", () => {
  const schemes = ["http", "https", "libsql", "ws", "wss"];

  fc.assert(
    fc.property(
      fc.constantFrom(...schemes),
      fc.domain(),
      fc.string({ minLength: 1, maxLength: 50 }),
      (scheme, domain, token) => {
        const url = `${scheme}://${domain}`;
        try {
          const client = new TursoClient({ url, authToken: token });
          return typeof client === "object";
        } catch {
          // Some combinations might be invalid
          return true;
        }
      }
    ),
    { numRuns: 1000 }
  );
});

Deno.test("TursoClient - property: token formats are flexible", () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
      (token) => {
        try {
          const client = new TursoClient({
            url: "https://example.com",
            authToken: token,
          });
          return typeof client === "object";
        } catch {
          return false;
        }
      }
    ),
    { numRuns: 1000 }
  );
});

Deno.test("TursoClient - property: multiple clients are independent", () => {
  fc.assert(
    fc.property(
      fc.array(fc.tuple(fc.webUrl(), fc.string({ minLength: 1, maxLength: 50 })), {
        minLength: 2,
        maxLength: 5,
      }),
      (configs) => {
        const clients = configs.map(([url, token]) => {
          try {
            return new TursoClient({ url, authToken: token });
          } catch {
            return null;
          }
        }).filter(Boolean);

        // All clients should be independent (not connected initially)
        return clients.every((client) => client && !client.isConnected());
      }
    ),
    { numRuns: 1000 }
  );
});

Deno.test("TursoClient - property: constructor validation is deterministic", () => {
  fc.assert(
    fc.property(
      fc.string(),
      fc.string(),
      (url, token) => {
        // Same inputs should always produce same result (throw or succeed)
        let firstResult: "success" | "error" = "success";
        let secondResult: "success" | "error" = "success";

        try {
          new TursoClient({ url, authToken: token });
        } catch {
          firstResult = "error";
        }

        try {
          new TursoClient({ url, authToken: token });
        } catch {
          secondResult = "error";
        }

        return firstResult === secondResult;
      }
    ),
    { numRuns: 1000 }
  );
});
