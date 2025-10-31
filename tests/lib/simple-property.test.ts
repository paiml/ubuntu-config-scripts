import { assertEquals } from "../../deps.ts";
import { fc } from "../../deps.ts";
import { parseArgs } from "../../scripts/lib/common.ts";
import { compareVersions } from "../../scripts/lib/deno-updater.ts";

Deno.test("parseArgs property tests", () => {
  // Property: parseArgs always returns an object
  fc.assert(
    fc.property(fc.array(fc.string()), (args: string[]) => {
      const result = parseArgs(args);
      assertEquals(typeof result, "object");
      assertEquals(result !== null, true);
    }),
  );

  // Property: boolean flags are always true
  fc.assert(
    fc.property(fc.stringMatching(/^--[a-z]+$/), (flag: string) => {
      const result = parseArgs([flag]);
      const key = flag.slice(2);
      assertEquals(result[key], true);
    }),
  );

  // Property: parseArgs is idempotent
  fc.assert(
    fc.property(fc.array(fc.string()), (args: string[]) => {
      const result1 = parseArgs(args);
      const result2 = parseArgs(args);
      assertEquals(result1, result2);
    }),
  );
});

Deno.test("version comparison properties", () => {
  const versionArbitrary = fc.tuple(
    fc.nat({ max: 99 }),
    fc.nat({ max: 99 }),
    fc.nat({ max: 99 }),
  ).map(([major, minor, patch]) => `${major}.${minor}.${patch}`);

  // Property: version comparison is reflexive
  fc.assert(
    fc.property(versionArbitrary, (version: string) => {
      assertEquals(compareVersions(version, version), 0);
    }),
  );

  // Property: version comparison is antisymmetric
  fc.assert(
    fc.property(
      versionArbitrary,
      versionArbitrary,
      (v1: string, v2: string) => {
        const cmp1 = compareVersions(v1, v2);
        const cmp2 = compareVersions(v2, v1);
        assertEquals(cmp1, -cmp2);
      },
    ),
  );

  // Property: major version differences dominate
  fc.assert(
    fc.property(
      fc.nat({ max: 99 }),
      fc.nat({ max: 99 }),
      fc.nat({ max: 99 }),
      fc.nat({ max: 99 }),
      (major1: number, major2: number, minor: number, patch: number) => {
        if (major1 < major2) {
          const v1 = `${major1}.${minor}.${patch}`;
          const v2 = `${major2}.0.0`;
          assertEquals(compareVersions(v1, v2) < 0, true);
        }
      },
    ),
  );
});

Deno.test("array operation properties", () => {
  // Property: array length is preserved after sort
  fc.assert(
    fc.property(fc.array(fc.integer()), (arr: number[]) => {
      const sorted = [...arr].sort((a, b) => a - b);
      assertEquals(sorted.length, arr.length);
    }),
  );

  // Property: sorted array is ordered
  fc.assert(
    fc.property(fc.array(fc.integer()), (arr: number[]) => {
      const sorted = [...arr].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        if (prev !== undefined && curr !== undefined) {
          assertEquals(prev <= curr, true);
        }
      }
    }),
  );
});

Deno.test("string operation properties", () => {
  // Property: trim is idempotent
  fc.assert(
    fc.property(fc.string(), (str: string) => {
      assertEquals(str.trim().trim(), str.trim());
    }),
  );

  // Property: trimmed string is shorter or equal
  fc.assert(
    fc.property(fc.string(), (str: string) => {
      assertEquals(str.trim().length <= str.length, true);
    }),
  );
});
