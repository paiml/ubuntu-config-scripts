import { fc } from "../../deps.ts";
import { assertEquals, assertExists } from "../../deps.ts";
import { ConfigSchema } from "../../scripts/system/collect-system-info.ts";

Deno.test("property: config schema validation", () => {
  fc.assert(
    fc.property(
      fc.record({
        dbPath: fc.string({ minLength: 1, maxLength: 200 }),
        collectInterval: fc.integer({ min: 60, max: 86400 }),
        retentionDays: fc.integer({ min: 1, max: 365 }),
      }),
      (config) => {
        const result = ConfigSchema.safeParse(config);
        assertEquals(result.success, true);

        if (result.success) {
          assertExists(result.data.dbPath);
          assertEquals(typeof result.data.collectInterval, "number");
          assertEquals(result.data.collectInterval >= 60, true);
          assertEquals(typeof result.data.retentionDays, "number");
          assertEquals(result.data.retentionDays >= 1, true);
        }
      },
    ),
    { numRuns: 50 },
  );
});

Deno.test("property: config schema with default values", () => {
  fc.assert(
    fc.property(
      fc.record({
        dbPath: fc.option(fc.string({ minLength: 1, maxLength: 200 })),
        collectInterval: fc.option(fc.integer({ min: 60, max: 86400 })),
        retentionDays: fc.option(fc.integer({ min: 1, max: 365 })),
      }),
      (partialConfig) => {
        const config = Object.fromEntries(
          Object.entries(partialConfig).filter(([_, v]) => v !== null),
        );

        const result = ConfigSchema.safeParse(config);
        assertEquals(result.success, true);

        if (result.success) {
          // Defaults should be applied
          assertExists(result.data.dbPath);
          assertExists(result.data.collectInterval);
          assertExists(result.data.retentionDays);
        }
      },
    ),
    { numRuns: 30 },
  );
});

Deno.test("property: config interval boundaries", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 60, max: 86400 }),
      (interval) => {
        const config = {
          dbPath: "/tmp/test.db",
          collectInterval: interval,
          retentionDays: 90,
        };

        const result = ConfigSchema.safeParse(config);
        assertEquals(result.success, true);

        if (result.success) {
          assertEquals(result.data.collectInterval, interval);
          assertEquals(result.data.collectInterval >= 60, true);
        }
      },
    ),
    { numRuns: 50 },
  );
});

Deno.test("property: config retention boundaries", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 365 }),
      (days) => {
        const config = {
          dbPath: "/tmp/test.db",
          collectInterval: 3600,
          retentionDays: days,
        };

        const result = ConfigSchema.safeParse(config);
        assertEquals(result.success, true);

        if (result.success) {
          assertEquals(result.data.retentionDays, days);
          assertEquals(result.data.retentionDays >= 1, true);
        }
      },
    ),
    { numRuns: 50 },
  );
});

Deno.test("property: config validation rejects invalid intervals", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: -1000, max: 59 }),
      (invalidInterval) => {
        const config = {
          dbPath: "/tmp/test.db",
          collectInterval: invalidInterval,
          retentionDays: 90,
        };

        const result = ConfigSchema.safeParse(config);
        assertEquals(result.success, false);
      },
    ),
    { numRuns: 30 },
  );
});

Deno.test("property: config validation rejects invalid retention", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: -1000, max: 0 }),
      (invalidDays) => {
        const config = {
          dbPath: "/tmp/test.db",
          collectInterval: 3600,
          retentionDays: invalidDays,
        };

        const result = ConfigSchema.safeParse(config);
        assertEquals(result.success, false);
      },
    ),
    { numRuns: 30 },
  );
});

Deno.test("property: db path validation", () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 1, maxLength: 300 }),
      (dbPath) => {
        const config = {
          dbPath,
          collectInterval: 3600,
          retentionDays: 90,
        };

        const result = ConfigSchema.safeParse(config);
        assertEquals(result.success, true);

        if (result.success) {
          assertEquals(result.data.dbPath, dbPath);
        }
      },
    ),
    { numRuns: 50 },
  );
});
