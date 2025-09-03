import { assertEquals } from "@std/testing/asserts.ts";
import { describe, it } from "@std/testing/bdd.ts";

describe("deploy script", () => {
  describe("basic functionality", () => {
    it("should export as a module", () => {
      const module = import("../../scripts/dev/deploy.ts");
      assertEquals(typeof module.then, "function");
    });
  });
});
