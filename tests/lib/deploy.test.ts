import { assertEquals } from "@std/testing/asserts.ts";
import { describe, it } from "@std/testing/bdd.ts";

describe("deploy", () => {
  describe("basic functionality", () => {
    it("should export required functions", async () => {
      const module = await import("../../scripts/lib/deploy.ts");
      assertEquals(typeof module.compileScript, "function");
      assertEquals(typeof module.deployBinaries, "function");
      assertEquals(typeof module.createDeploymentPackage, "function");
    });
  });
});
