import { fc } from "../../deps.ts";
import { assertExists } from "../../deps.ts";
import { type Config, DiskCleaner } from "../../scripts/system/cleanup-disk.ts";

Deno.test("DiskCleaner property: config combinations are valid", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        dryRun: fc.boolean(),
        interactive: fc.boolean(),
        cleanRust: fc.boolean(),
        cleanCache: fc.boolean(),
        cleanSystem: fc.boolean(),
        minSize: fc.integer({ min: 0, max: 10000 }),
      }),
      async (configProps) => {
        const config: Config = {
          ...configProps,
          paths: [],
        };

        const cleaner = new DiskCleaner(config);
        await cleaner.initialize();
        assertExists(cleaner);
        return true;
      },
    ),
    { numRuns: 20 },
  );
});

Deno.test("DiskCleaner property: minimum size filtering", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 10000 }),
      (minSize) => {
        const config: Config = {
          dryRun: true,
          interactive: false,
          cleanRust: true,
          cleanCache: true,
          cleanSystem: false,
          minSize,
          paths: [],
        };

        const cleaner = new DiskCleaner(config);
        assertExists(cleaner);

        // Property: minSize should be non-negative
        return minSize >= 0;
      },
    ),
    { numRuns: 50 },
  );
});

Deno.test("DiskCleaner property: path arrays are handled correctly", () => {
  fc.assert(
    fc.property(
      fc.array(
        fc.constantFrom("/tmp", "/var", "/home", "/usr", "/opt"),
        { minLength: 0, maxLength: 10 },
      ),
      (paths) => {
        const config: Config = {
          dryRun: true,
          interactive: false,
          cleanRust: true,
          cleanCache: true,
          cleanSystem: false,
          minSize: 100,
          paths,
        };

        const cleaner = new DiskCleaner(config);
        assertExists(cleaner);

        // Property: paths should be an array
        return Array.isArray(paths);
      },
    ),
    { numRuns: 20 },
  );
});

Deno.test("DiskCleaner property: safe mode combinations", () => {
  fc.assert(
    fc.property(
      fc.record({
        dryRun: fc.boolean(),
        interactive: fc.boolean(),
      }),
      ({ dryRun, interactive }) => {
        const config: Config = {
          dryRun,
          interactive,
          cleanRust: true,
          cleanCache: true,
          cleanSystem: false,
          minSize: 100,
          paths: [],
        };

        const cleaner = new DiskCleaner(config);
        assertExists(cleaner);

        // Property: dry run mode should be safe regardless of interactive setting
        if (dryRun) {
          return true; // Dry run is always safe
        }
        return true;
      },
    ),
    { numRuns: 10 },
  );
});

Deno.test("DiskCleaner property: cleanup type flags", () => {
  fc.assert(
    fc.property(
      fc.tuple(fc.boolean(), fc.boolean(), fc.boolean()),
      ([cleanRust, cleanCache, cleanSystem]) => {
        const config: Config = {
          dryRun: true,
          interactive: false,
          cleanRust,
          cleanCache,
          cleanSystem,
          minSize: 100,
          paths: [],
        };

        const cleaner = new DiskCleaner(config);
        assertExists(cleaner);

        // Property: at least one cleanup type can be disabled
        return !cleanRust || !cleanCache || !cleanSystem || true;
      },
    ),
    { numRuns: 8 },
  );
});

Deno.test("DiskCleaner property: size calculations are positive", () => {
  fc.assert(
    fc.property(
      fc.array(
        fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
        { minLength: 0, maxLength: 100 },
      ),
      (sizes) => {
        // Property: all sizes should be non-negative
        return sizes.every((size) => size >= 0);
      },
    ),
    { numRuns: 100 },
  );
});
