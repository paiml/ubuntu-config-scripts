import { assertEquals } from "@std/testing/asserts.ts";
import { describe, it } from "@std/testing/bdd.ts";

describe("update-deno", () => {
  describe("basic functionality", () => {
    it("should export as a module", () => {
      const module = import("../../scripts/system/update-deno.ts");
      assertEquals(typeof module.then, "function");
    });
  });
});
