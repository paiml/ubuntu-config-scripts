import { assertEquals } from "@std/testing/asserts.ts";
import { describe, it } from "@std/testing/bdd.ts";
import { compareVersions } from "../../scripts/lib/deno-updater.ts";

describe("deno-updater", () => {
  describe("compareVersions", () => {
    it("should correctly compare version strings", () => {
      // Equal versions
      assertEquals(compareVersions("1.0.0", "1.0.0"), 0);
      assertEquals(compareVersions("2.3.7", "2.3.7"), 0);

      // First version is older
      assertEquals(compareVersions("1.0.0", "2.0.0"), -1);
      assertEquals(compareVersions("2.3.7", "2.4.0"), -1);
      assertEquals(compareVersions("2.3.7", "2.3.8"), -1);
      assertEquals(compareVersions("2.3.7", "2.3.10"), -1);

      // First version is newer
      assertEquals(compareVersions("2.0.0", "1.0.0"), 1);
      assertEquals(compareVersions("2.4.0", "2.3.7"), 1);
      assertEquals(compareVersions("2.3.8", "2.3.7"), 1);
      assertEquals(compareVersions("2.3.10", "2.3.7"), 1);

      // Different version lengths
      assertEquals(compareVersions("1.0", "1.0.0"), 0);
      assertEquals(compareVersions("1.0.0", "1.0"), 0);
      assertEquals(compareVersions("1.0", "1.0.1"), -1);
      assertEquals(compareVersions("1.0.1", "1.0"), 1);
    });
  });
});
