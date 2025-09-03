import { assertEquals } from "../../deps.ts";
import { fc } from "../../deps.ts";
import { parseArgs } from "../../scripts/lib/common.ts";

Deno.test("parseArgs property tests", async (t) => {
  await t.step("should always return an object", () => {
    fc.assert(
      fc.property(fc.array(fc.string()), (args) => {
        const result = parseArgs(args);
        assertEquals(typeof result, "object");
        assertEquals(result !== null, true);
      }),
    );
  });

  await t.step("should handle boolean flags correctly", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^--[a-z]+$/), (flag) => {
        const result = parseArgs([flag]);
        const key = flag.slice(2);
        assertEquals(result[key], true);
      }),
    );
  });

  await t.step("should handle value flags correctly", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^--[a-z]+$/),
        fc.string().filter((s) => !s.startsWith("-")),
        (flag, value) => {
          const result = parseArgs([flag, value]);
          const key = flag.slice(2);
          assertEquals(result[key], value);
        },
      ),
    );
  });

  await t.step("should handle equals-style arguments", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z]+$/),
        fc.string(),
        (key, value) => {
          const result = parseArgs([`--${key}=${value}`]);
          assertEquals(result[key], value);
        },
      ),
    );
  });

  await t.step("should handle short flags", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]$/), (letter) => {
        const result = parseArgs([`-${letter}`]);
        assertEquals(result[letter], true);
      }),
    );
  });

  await t.step("should ignore non-flag arguments", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string().filter((s) => !s.startsWith("-"))),
        (args) => {
          const result = parseArgs(args);
          assertEquals(Object.keys(result).length, 0);
        },
      ),
    );
  });

  await t.step("parseArgs is idempotent for valid inputs", () => {
    fc.assert(
      fc.property(fc.array(fc.string()), (args) => {
        const result1 = parseArgs(args);
        const result2 = parseArgs(args);
        assertEquals(result1, result2);
      }),
    );
  });
});

// Property tests for version comparison
Deno.test("version comparison property tests", async (t) => {
  const versionArbitrary = fc.tuple(
    fc.nat({ max: 99 }),
    fc.nat({ max: 99 }),
    fc.nat({ max: 99 }),
  ).map(([major, minor, patch]) => `${major}.${minor}.${patch}`);

  await t.step("version comparison is reflexive", async () => {
    const { compareVersions } = await import(
      "../../scripts/lib/deno-updater.ts"
    );

    fc.assert(
      fc.property(versionArbitrary, (version) => {
        assertEquals(compareVersions(version, version), 0);
      }),
    );
  });

  await t.step("version comparison is antisymmetric", () => {
    fc.assert(
      fc.asyncProperty(
        versionArbitrary,
        versionArbitrary,
        async (v1, v2) => {
          const { compareVersions } = await import(
            "../../scripts/lib/deno-updater.ts"
          );
          const cmp1 = compareVersions(v1, v2);
          const cmp2 = compareVersions(v2, v1);
          assertEquals(cmp1, -cmp2);
        },
      ),
    );
  });

  await t.step("version comparison is transitive", () => {
    fc.assert(
      fc.asyncProperty(
        versionArbitrary,
        versionArbitrary,
        versionArbitrary,
        async (v1, v2, v3) => {
          const { compareVersions } = await import(
            "../../scripts/lib/deno-updater.ts"
          );
          const cmp12 = compareVersions(v1, v2);
          const cmp23 = compareVersions(v2, v3);
          const cmp13 = compareVersions(v1, v3);

          if (cmp12 <= 0 && cmp23 <= 0) {
            assertEquals(cmp13 <= 0, true);
          }
        },
      ),
    );
  });
});

// Property tests for string manipulation
Deno.test("string property tests", async (t) => {
  await t.step("logger format should never throw", () => {
    fc.assert(
      fc.asyncProperty(
        fc.string(),
        fc.array(fc.anything()),
        async (message, args) => {
          const { Logger } = await import("../../scripts/lib/logger.ts");
          const logger = new Logger({ prefix: "test" });

          // Should not throw
          try {
            // @ts-ignore - testing robustness
            logger.format("info", message, ...args);
            assertEquals(true, true); // If we get here, it didn't throw
          } catch {
            assertEquals(true, false, "Logger format should not throw");
          }
        },
      ),
    );
  });
});

// Property tests for file operations
Deno.test("file operation property tests", {
  permissions: { write: true, read: true },
  ignore: true, // Temporarily ignore due to permission issues in CI
}, async (t) => {
  await t.step("ensureDir should be idempotent", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^test-[a-z0-9]+$/),
        async (dirname) => {
          const { ensureDir } = await import("../../scripts/lib/common.ts");
          const tempDir = await Deno.makeTempDir();
          const path = `${tempDir}/${dirname}`;

          try {
            // First call
            await ensureDir(path);
            const exists1 = await Deno.stat(path).then(() => true).catch(() =>
              false
            );

            // Second call should not fail
            await ensureDir(path);
            const exists2 = await Deno.stat(path).then(() => true).catch(() =>
              false
            );

            assertEquals(exists1, true);
            assertEquals(exists2, true);
          } finally {
            // Cleanup
            try {
              await Deno.remove(tempDir, { recursive: true });
            } catch {
              // Ignore cleanup errors
            }
          }
        },
      ),
    );
  });
});
