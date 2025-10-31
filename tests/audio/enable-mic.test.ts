import { assertEquals } from "@std/testing/asserts.ts";
import { describe, it } from "@std/testing/bdd.ts";

describe("enable-mic", () => {
  describe("basic functionality", () => {
    it("should export required functions", () => {
      const module = import("../../scripts/audio/enable-mic.ts");
      assertEquals(typeof module.then, "function");
    });
  });
});
