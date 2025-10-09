import {
  assertEquals,
  assertExists,
  assertRejects,
  assertThrows,
} from "../../deps.ts";
import {
  EmbeddingGenerator,
  EmbeddingConfig,
} from "../../scripts/lib/embedding-generator.ts";

// Unit tests for EmbeddingGenerator
// RED phase - these tests should FAIL initially

Deno.test("EmbeddingGenerator - constructor creates instance", () => {
  const config: EmbeddingConfig = {
    apiKey: "sk-test-key",
    model: "text-embedding-3-small",
  };

  const generator = new EmbeddingGenerator(config);
  assertExists(generator);
});

Deno.test("EmbeddingGenerator - constructor throws on empty API key", () => {
  assertThrows(
    () => {
      new EmbeddingGenerator({
        apiKey: "",
        model: "text-embedding-3-small",
      });
    },
    Error,
    "Invalid API key"
  );
});

Deno.test("EmbeddingGenerator - constructor throws on empty model", () => {
  assertThrows(
    () => {
      new EmbeddingGenerator({
        apiKey: "sk-test-key",
        model: "",
      });
    },
    Error,
    "Invalid model"
  );
});

Deno.test("EmbeddingGenerator - constructor accepts custom dimensions", () => {
  const config: EmbeddingConfig = {
    apiKey: "sk-test-key",
    model: "text-embedding-3-small",
    dimensions: 512,
  };

  const generator = new EmbeddingGenerator(config);
  assertExists(generator);
});

Deno.test("EmbeddingGenerator - constructor throws on invalid dimensions", () => {
  assertThrows(
    () => {
      new EmbeddingGenerator({
        apiKey: "sk-test-key",
        model: "text-embedding-3-small",
        dimensions: 0,
      });
    },
    Error,
    "Invalid dimensions"
  );
});

Deno.test(
  "EmbeddingGenerator - generateEmbedding returns result structure",
  async () => {
    const config: EmbeddingConfig = {
      apiKey: "sk-test-key",
      model: "text-embedding-3-small",
    };

    const generator = new EmbeddingGenerator(config);

    // Mock the API call
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          data: [
            {
              embedding: new Array(1536).fill(0.1),
            },
          ],
          usage: { total_tokens: 10 },
        }),
        { status: 200 }
      );
    };

    try {
      const result = await generator.generateEmbedding("test text");

      assertExists(result.embedding);
      assertEquals(result.embedding.length, 1536);
      assertEquals(result.tokens, 10);
      assertEquals(result.model, "text-embedding-3-small");
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
);

Deno.test(
  "EmbeddingGenerator - generateEmbedding throws on empty text",
  async () => {
    const config: EmbeddingConfig = {
      apiKey: "sk-test-key",
      model: "text-embedding-3-small",
    };

    const generator = new EmbeddingGenerator(config);

    await assertRejects(
      async () => await generator.generateEmbedding(""),
      Error,
      "Empty text"
    );
  }
);

Deno.test(
  "EmbeddingGenerator - generateEmbedding handles API errors",
  async () => {
    const config: EmbeddingConfig = {
      apiKey: "sk-test-key",
      model: "text-embedding-3-small",
    };

    const generator = new EmbeddingGenerator(config);

    // Mock API error
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({ error: { message: "Rate limit exceeded" } }),
        { status: 429 }
      );
    };

    try {
      await assertRejects(
        async () => await generator.generateEmbedding("test"),
        Error,
        "Rate limit"
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
);

Deno.test(
  "EmbeddingGenerator - generateBatch processes multiple texts",
  async () => {
    const config: EmbeddingConfig = {
      apiKey: "sk-test-key",
      model: "text-embedding-3-small",
    };

    const generator = new EmbeddingGenerator(config);

    // Mock batch API call
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          data: [
            { embedding: new Array(1536).fill(0.1) },
            { embedding: new Array(1536).fill(0.2) },
          ],
          usage: { total_tokens: 20 },
        }),
        { status: 200 }
      );
    };

    try {
      const results = await generator.generateBatch(["text1", "text2"]);

      assertEquals(results.length, 2);
      assertEquals(results[0]?.embedding.length, 1536);
      assertEquals(results[1]?.embedding.length, 1536);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
);

Deno.test(
  "EmbeddingGenerator - generateBatch handles empty array",
  async () => {
    const config: EmbeddingConfig = {
      apiKey: "sk-test-key",
      model: "text-embedding-3-small",
    };

    const generator = new EmbeddingGenerator(config);

    const results = await generator.generateBatch([]);
    assertEquals(results, []);
  }
);

Deno.test(
  "EmbeddingGenerator - retries on transient failures",
  async () => {
    const config: EmbeddingConfig = {
      apiKey: "sk-test-key",
      model: "text-embedding-3-small",
    };

    const generator = new EmbeddingGenerator(config);

    let attemptCount = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      attemptCount++;
      if (attemptCount < 3) {
        return new Response("Internal Server Error", { status: 500 });
      }
      return new Response(
        JSON.stringify({
          data: [{ embedding: new Array(1536).fill(0.1) }],
          usage: { total_tokens: 10 },
        }),
        { status: 200 }
      );
    };

    try {
      const result = await generator.generateEmbedding("test");
      assertExists(result.embedding);
      assertEquals(attemptCount, 3); // Should have retried twice
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
);

Deno.test(
  "EmbeddingGenerator - gives up after max retries",
  async () => {
    const config: EmbeddingConfig = {
      apiKey: "sk-test-key",
      model: "text-embedding-3-small",
    };

    const generator = new EmbeddingGenerator(config);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response("Internal Server Error", { status: 500 });
    };

    try {
      await assertRejects(
        async () => await generator.generateEmbedding("test"),
        Error
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
);

Deno.test(
  "EmbeddingGenerator - tracks token usage",
  async () => {
    const config: EmbeddingConfig = {
      apiKey: "sk-test-key",
      model: "text-embedding-3-small",
    };

    const generator = new EmbeddingGenerator(config);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          data: [{ embedding: new Array(1536).fill(0.1) }],
          usage: { total_tokens: 42 },
        }),
        { status: 200 }
      );
    };

    try {
      const result = await generator.generateEmbedding("test text");
      assertEquals(result.tokens, 42);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
);

Deno.test(
  "EmbeddingGenerator - handles network errors",
  async () => {
    const config: EmbeddingConfig = {
      apiKey: "sk-test-key",
      model: "text-embedding-3-small",
    };

    const generator = new EmbeddingGenerator(config);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error("Network error");
    };

    try {
      await assertRejects(
        async () => await generator.generateEmbedding("test"),
        Error,
        "Network error"
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
);

Deno.test(
  "EmbeddingGenerator - respects custom dimensions",
  async () => {
    const config: EmbeddingConfig = {
      apiKey: "sk-test-key",
      model: "text-embedding-3-small",
      dimensions: 512,
    };

    const generator = new EmbeddingGenerator(config);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          data: [{ embedding: new Array(512).fill(0.1) }],
          usage: { total_tokens: 10 },
        }),
        { status: 200 }
      );
    };

    try {
      const result = await generator.generateEmbedding("test");
      assertEquals(result.embedding.length, 512);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
);

Deno.test(
  "EmbeddingGenerator - batch respects order",
  async () => {
    const config: EmbeddingConfig = {
      apiKey: "sk-test-key",
      model: "text-embedding-3-small",
    };

    const generator = new EmbeddingGenerator(config);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          data: [
            { embedding: new Array(1536).fill(0.1) },
            { embedding: new Array(1536).fill(0.2) },
            { embedding: new Array(1536).fill(0.3) },
          ],
          usage: { total_tokens: 30 },
        }),
        { status: 200 }
      );
    };

    try {
      const results = await generator.generateBatch(["a", "b", "c"]);

      assertEquals(results.length, 3);
      assertEquals(results[0]?.embedding[0], 0.1);
      assertEquals(results[1]?.embedding[0], 0.2);
      assertEquals(results[2]?.embedding[0], 0.3);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
);
