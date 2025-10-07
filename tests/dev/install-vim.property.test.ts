import { assertEquals } from "../../deps.ts";
import { fc } from "../../deps.ts";
import {
  getVimVersion,
  isVimInstalled,
} from "../../scripts/dev/install-vim.ts";

Deno.test("vim installation property tests", async (t) => {
  await t.step("isVimInstalled should return boolean", async () => {
    const result = await isVimInstalled();
    assertEquals(typeof result, "boolean");
  });

  await t.step("isVimInstalled is idempotent", async () => {
    const result1 = await isVimInstalled();
    const result2 = await isVimInstalled();
    assertEquals(result1, result2);
  });

  await t.step("getVimVersion should return string or null", async () => {
    const version = await getVimVersion();
    assertEquals(
      version === null || typeof version === "string",
      true,
      "Version should be null or string",
    );
  });

  await t.step("getVimVersion is idempotent", async () => {
    const version1 = await getVimVersion();
    const version2 = await getVimVersion();
    assertEquals(version1, version2);
  });

  await t.step("version format is valid if present", async () => {
    const version = await getVimVersion();
    if (version !== null) {
      // Version should be in format X.Y
      const versionRegex = /^\d+\.\d+$/;
      assertEquals(
        versionRegex.test(version),
        true,
        `Version ${version} should match X.Y format`,
      );
    }
  });

  await t.step(
    "if vim is installed, version should not be null",
    async () => {
      const installed = await isVimInstalled();
      const version = await getVimVersion();

      if (installed) {
        assertEquals(
          version !== null,
          true,
          "If vim is installed, version should not be null",
        );
      }
    },
  );

  await t.step(
    "if vim is not installed, version should be null",
    async () => {
      const installed = await isVimInstalled();
      const version = await getVimVersion();

      if (!installed) {
        assertEquals(
          version,
          null,
          "If vim is not installed, version should be null",
        );
      }
    },
  );
});

// Property tests for version parsing
Deno.test("vim version parsing property tests", async (t) => {
  await t.step("version parsing is consistent", () => {
    fc.assert(
      fc.property(
        fc.tuple(fc.nat({ max: 99 }), fc.nat({ max: 99 })),
        ([major, minor]) => {
          const versionString = `${major}.${minor}`;
          const parsed = versionString.match(/^(\d+)\.(\d+)$/);

          if (parsed) {
            assertEquals(parseInt(parsed[1]!), major);
            assertEquals(parseInt(parsed[2]!), minor);
          }
        },
      ),
    );
  });

  await t.step("version comparison properties", () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.nat({ max: 99 }),
          fc.nat({ max: 99 }),
        ),
        fc.tuple(
          fc.nat({ max: 99 }),
          fc.nat({ max: 99 }),
        ),
        ([major1, minor1], [major2, minor2]) => {
          const v1 = `${major1}.${minor1}`;
          const v2 = `${major2}.${minor2}`;

          // Reflexive: version equals itself
          assertEquals(v1 === v1, true);

          // If major versions differ, comparison is determined by major
          if (major1 !== major2) {
            const cmp = major1 > major2;
            assertEquals(v1 > v2, cmp);
          } else if (minor1 !== minor2) {
            // If major same, compare minor
            const cmp = minor1 > minor2;
            assertEquals(v1 > v2, cmp);
          }
        },
      ),
    );
  });
});

// Property tests for installation invariants
Deno.test("vim installation invariants", async (t) => {
  await t.step(
    "installation state should be consistent across checks",
    async () => {
      // Check multiple times to ensure consistency
      const checks = await Promise.all([
        isVimInstalled(),
        isVimInstalled(),
        isVimInstalled(),
      ]);

      const allSame = checks.every((check) => check === checks[0]);
      assertEquals(
        allSame,
        true,
        "Multiple checks should return the same result",
      );
    },
  );

  await t.step(
    "version retrieval should be consistent across calls",
    async () => {
      const versions = await Promise.all([
        getVimVersion(),
        getVimVersion(),
        getVimVersion(),
      ]);

      const allSame = versions.every((v) => v === versions[0]);
      assertEquals(
        allSame,
        true,
        "Multiple version checks should return the same result",
      );
    },
  );
});
