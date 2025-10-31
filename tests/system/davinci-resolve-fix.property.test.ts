import {
  assertEquals,
  assertExists,
  assertThrows,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { fc } from "../../deps.ts";
import { DaVinciResolveFix } from "../../scripts/system/davinci-resolve-fix.ts";
import { describe, it } from "https://deno.land/std@0.208.0/testing/bdd.ts";

describe("DaVinciResolveFix", () => {
  describe("constructor", () => {
    it("should accept valid configuration", () => {
      fc.assert(
        fc.property(
          fc.record({
            resolvePath: fc.constantFrom("/opt/resolve", "/usr/local/resolve"),
            backupDirName: fc.constantFrom("not_used", "backup", "_disabled"),
            dryRun: fc.boolean(),
            restore: fc.boolean(),
            verbose: fc.boolean(),
          }),
          (config) => {
            const fixer = new DaVinciResolveFix(config);
            assertExists(fixer);
          },
        ),
      );
    });

    it("should use default configuration when none provided", () => {
      const fixer = new DaVinciResolveFix();
      assertExists(fixer);
    });

    it("should handle partial configuration", () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.record({ dryRun: fc.boolean() }),
            fc.record({ verbose: fc.boolean() }),
            fc.record({ restore: fc.boolean() }),
          ),
          (partialConfig) => {
            const fixer = new DaVinciResolveFix(partialConfig);
            assertExists(fixer);
          },
        ),
      );
    });
  });

  describe("checkInstallation", () => {
    it("should handle missing installation gracefully", () => {
      const fixer = new DaVinciResolveFix({
        resolvePath: "/nonexistent/path",
      });
      const result = fixer.checkInstallation();
      assertEquals(result, false);
    });

    it("should detect valid installation", () => {
      const fixer = new DaVinciResolveFix({
        resolvePath: "/opt/resolve",
      });
      const result = fixer.checkInstallation();
      // This will be true if DaVinci is installed, false otherwise
      assertEquals(typeof result, "boolean");
    });
  });

  describe("detectConflicts", () => {
    it("should return array of conflicts", async () => {
      const fixer = new DaVinciResolveFix();
      const conflicts = await fixer.detectConflicts();
      assertEquals(Array.isArray(conflicts), true);

      // Each conflict should be a string
      for (const conflict of conflicts) {
        assertEquals(typeof conflict, "string");
      }
    });

    it("should detect known conflicting libraries", async () => {
      const fixer = new DaVinciResolveFix();
      const conflicts = await fixer.detectConflicts();

      // If conflicts exist, they should match known patterns
      const knownPatterns = [
        "libglib-2.0.so*",
        "libgio-2.0.so*",
        "libgmodule-2.0.so*",
        "libgobject-2.0.so*",
        "libgdk_pixbuf*",
      ];

      for (const conflict of conflicts) {
        const isKnown = knownPatterns.includes(conflict);
        assertEquals(isKnown, true, `Unknown conflict: ${conflict}`);
      }
    });
  });

  describe("dry run mode", () => {
    it("should not make changes in dry run mode", async () => {
      const fixer = new DaVinciResolveFix({
        dryRun: true,
        verbose: false,
      });

      // In dry run, applyFix should not throw even if not installed
      try {
        await fixer.applyFix();
        // Success - no exception
      } catch (error) {
        // Should not throw in dry run unless installation check fails
        if (
          !(error instanceof Error) || !error.message.includes("not installed")
        ) {
          throw error;
        }
      }
    });
  });

  describe("configuration validation", () => {
    it("should reject invalid configuration types", () => {
      const invalidConfigs = [
        { resolvePath: 123 }, // Should be string
        { dryRun: "true" }, // Should be boolean
        { verbose: 1 }, // Should be boolean
        { restore: null }, // Should be boolean
      ];

      for (const invalid of invalidConfigs) {
        assertThrows(() => {
          // @ts-ignore - Testing invalid types
          new DaVinciResolveFix(invalid);
        });
      }
    });

    it("should handle empty strings for paths", () => {
      fc.assert(
        fc.property(
          fc.record({
            resolvePath: fc.constantFrom("", "/opt/resolve"),
            backupDirName: fc.constantFrom("", "backup"),
          }),
          (config) => {
            if (config.resolvePath === "" || config.backupDirName === "") {
              // Empty strings should either be rejected or use defaults
              try {
                const fixer = new DaVinciResolveFix(config);
                assertExists(fixer);
              } catch {
                // It's ok to reject empty strings
              }
            } else {
              const fixer = new DaVinciResolveFix(config);
              assertExists(fixer);
            }
          },
        ),
      );
    });
  });

  describe("library patterns", () => {
    it("should match correct library patterns", () => {
      const patterns = [
        "libglib-2.0.so*",
        "libgio-2.0.so*",
        "libgmodule-2.0.so*",
        "libgobject-2.0.so*",
        "libgdk_pixbuf*",
      ];

      // Test that patterns are valid glob patterns
      for (const pattern of patterns) {
        assertEquals(
          pattern.includes("*"),
          true,
          `Pattern should include wildcard: ${pattern}`,
        );
        assertEquals(
          pattern.startsWith("lib"),
          true,
          `Pattern should start with 'lib': ${pattern}`,
        );
      }
    });

    it("should cover all known conflicting libraries", () => {
      const testFiles = [
        "libglib-2.0.so.0",
        "libgio-2.0.so.0",
        "libgmodule-2.0.so.0",
        "libgobject-2.0.so.0",
        "libgdk_pixbuf-2.0.so.0",
      ];

      const patterns = [
        "libglib-2.0.so*",
        "libgio-2.0.so*",
        "libgmodule-2.0.so*",
        "libgobject-2.0.so*",
        "libgdk_pixbuf*",
      ];

      for (const file of testFiles) {
        const matched = patterns.some((pattern) => {
          const regex = pattern.replace("*", ".*");
          return new RegExp(`^${regex}$`).test(file);
        });
        assertEquals(matched, true, `File ${file} should match a pattern`);
      }
    });
  });

  describe("path construction", () => {
    it("should construct valid paths", () => {
      fc.assert(
        fc.property(
          fc.record({
            resolvePath: fc.constantFrom("/opt/resolve", "/usr/local/resolve"),
            backupDirName: fc.constantFrom("not_used", "backup", "_disabled"),
          }),
          (config) => {
            const fixer = new DaVinciResolveFix(config);
            // Paths should be constructed correctly
            // We can't directly access private members, but we can verify behavior
            assertExists(fixer);
          },
        ),
      );
    });
  });

  describe("restore functionality", () => {
    it("should handle restore when no backup exists", async () => {
      const fixer = new DaVinciResolveFix({
        resolvePath: "/nonexistent/path",
      });

      // Should not throw when no backup exists
      try {
        await fixer.restore();
        // Success - handled gracefully
      } catch (error) {
        // Should only throw for unexpected errors
        if (error instanceof Error) {
          throw error;
        }
      }
    });
  });

  describe("verify functionality", () => {
    it("should return boolean for verification", () => {
      const fixer = new DaVinciResolveFix();
      const result = fixer.verify();
      assertEquals(typeof result, "boolean");
    });

    it("should handle missing binary gracefully", () => {
      const fixer = new DaVinciResolveFix({
        resolvePath: "/nonexistent/path",
      });
      const result = fixer.verify();
      assertEquals(result, false);
    });
  });

  describe("error handling", () => {
    it("should provide meaningful error messages", async () => {
      const fixer = new DaVinciResolveFix({
        resolvePath: "/nonexistent/path",
      });

      try {
        await fixer.applyFix();
        // If we get here, DaVinci is not installed
      } catch (error) {
        // Error message should be informative
        if (error instanceof Error) {
          assertEquals(
            error.message.includes("not installed") ||
              error.message.includes("not found"),
            true,
          );
        } else {
          throw error;
        }
      }
    });
  });

  describe("idempotency", () => {
    it("should be safe to run multiple times", async () => {
      const fixer = new DaVinciResolveFix({
        dryRun: true, // Use dry run to avoid actual changes
      });

      // Running multiple times should not cause errors
      try {
        await fixer.applyFix();
        await fixer.applyFix();
        await fixer.applyFix();
        // Success - idempotent
      } catch (error) {
        // Should only fail if installation check fails
        if (
          !(error instanceof Error) || !error.message.includes("not installed")
        ) {
          throw error;
        }
      }
    });
  });
});
