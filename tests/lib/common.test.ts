import { assertEquals, assertRejects } from "@std/testing/asserts.ts";
import { describe, it } from "@std/testing/bdd.ts";
import { stub } from "@std/testing/mock.ts";
import {
  commandExists,
  ensureDir,
  fileExists,
  getEnvOrDefault,
  isRoot,
  parseArgs,
  requireCommand,
  requireEnv,
  requireRoot,
  runCommand,
  withTempDir,
} from "../../scripts/lib/common.ts";

describe("common utilities", () => {
  describe("runCommand", () => {
    it("should execute command successfully", async () => {
      const result = await runCommand(["echo", "hello"]);
      assertEquals(result.success, true);
      assertEquals(result.stdout.trim(), "hello");
      assertEquals(result.stderr, "");
      assertEquals(result.code, 0);
    });

    it("should handle command failure", async () => {
      const result = await runCommand(["false"]);
      assertEquals(result.success, false);
      assertEquals(result.code, 1);
    });

    it("should handle non-existent command", async () => {
      const result = await runCommand(["nonexistentcommand123"]);
      assertEquals(result.success, false);
      assertEquals(result.code, -1);
    });
  });

  describe("commandExists", () => {
    it("should return true for existing command", async () => {
      const exists = await commandExists("echo");
      assertEquals(exists, true);
    });

    it("should return false for non-existent command", async () => {
      const exists = await commandExists("nonexistentcommand123");
      assertEquals(exists, false);
    });
  });

  describe("requireCommand", () => {
    it("should not throw for existing command", async () => {
      await requireCommand("echo");
    });

    it("should throw for non-existent command", async () => {
      await assertRejects(
        () => requireCommand("nonexistentcommand123"),
        Error,
        "Required command 'nonexistentcommand123' not found in PATH",
      );
    });
  });

  describe("parseArgs", () => {
    it("should parse long arguments", () => {
      const args = parseArgs(["--name", "value", "--flag"]);
      assertEquals(args, { name: "value", flag: true });
    });

    it("should parse short arguments", () => {
      const args = parseArgs(["-n", "value", "-f"]);
      assertEquals(args, { n: "value", f: true });
    });

    it("should parse equals-style arguments", () => {
      const args = parseArgs(["--name=value", "--count=10"]);
      assertEquals(args, { name: "value", count: "10" });
    });

    it("should handle mixed argument styles", () => {
      const args = parseArgs([
        "--name=John",
        "-v",
        "--age",
        "30",
        "--active",
      ]);
      assertEquals(args, {
        name: "John",
        v: true,
        age: "30",
        active: true,
      });
    });

    it("should ignore non-flag arguments", () => {
      const args = parseArgs(["command", "--flag", "file.txt"]);
      assertEquals(args, { flag: "file.txt" });
    });
  });

  describe("fileExists", () => {
    it.ignore("should return true for existing file", async () => {
      const tempDir = await Deno.makeTempDir();
      const tempFile = `${tempDir}/test.txt`;
      await Deno.writeTextFile(tempFile, "test");

      try {
        const exists = await fileExists(tempFile);
        assertEquals(exists, true);
      } finally {
        await Deno.remove(tempDir, { recursive: true });
      }
    });

    it("should return false for non-existent file", async () => {
      const exists = await fileExists("/nonexistent/file.txt");
      assertEquals(exists, false);
    });
  });

  describe("ensureDir", () => {
    it.ignore("should create directory if it doesn't exist", async () => {
      const tempDir = await Deno.makeTempDir();
      const newDir = `${tempDir}/new/nested/dir`;

      try {
        await ensureDir(newDir);
        const stat = await Deno.stat(newDir);
        assertEquals(stat.isDirectory, true);
      } finally {
        await Deno.remove(tempDir, { recursive: true });
      }
    });

    it.ignore("should not throw if directory already exists", async () => {
      const tempDir = await Deno.makeTempDir();
      await ensureDir(tempDir);
    });
  });

  describe("environment variables", () => {
    it("getEnvOrDefault should return env value when set", () => {
      const originalValue = Deno.env.get("TEST_VAR");
      Deno.env.set("TEST_VAR", "test_value");

      try {
        const value = getEnvOrDefault("TEST_VAR", "default");
        assertEquals(value, "test_value");
      } finally {
        if (originalValue !== undefined) {
          Deno.env.set("TEST_VAR", originalValue);
        } else {
          Deno.env.delete("TEST_VAR");
        }
      }
    });

    it("getEnvOrDefault should return default when not set", () => {
      Deno.env.delete("NONEXISTENT_VAR");
      const value = getEnvOrDefault("NONEXISTENT_VAR", "default");
      assertEquals(value, "default");
    });

    it("requireEnv should return value when set", () => {
      const originalValue = Deno.env.get("TEST_VAR");
      Deno.env.set("TEST_VAR", "required_value");

      try {
        const value = requireEnv("TEST_VAR");
        assertEquals(value, "required_value");
      } finally {
        if (originalValue !== undefined) {
          Deno.env.set("TEST_VAR", originalValue);
        } else {
          Deno.env.delete("TEST_VAR");
        }
      }
    });

    it("requireEnv should throw when not set", () => {
      Deno.env.delete("NONEXISTENT_VAR");
      try {
        requireEnv("NONEXISTENT_VAR");
        throw new Error("Should have thrown");
      } catch (error) {
        assertEquals(
          (error as Error).message,
          "Required environment variable 'NONEXISTENT_VAR' not set",
        );
      }
    });
  });

  describe("withTempDir", () => {
    it.ignore("should create temp dir and clean up", async () => {
      let tempDirPath = "";

      const result = await withTempDir(async (tempDir) => {
        tempDirPath = tempDir;
        const stat = await Deno.stat(tempDir);
        assertEquals(stat.isDirectory, true);
        return "test_result";
      });

      assertEquals(result, "test_result");

      try {
        await Deno.stat(tempDirPath);
        throw new Error("Temp dir should have been deleted");
      } catch (error) {
        assertEquals(error instanceof Deno.errors.NotFound, true);
      }
    });

    it.ignore("should clean up even on error", async () => {
      let tempDirPath = "";

      try {
        await withTempDir((tempDir) => {
          tempDirPath = tempDir;
          throw new Error("Test error");
        });
      } catch (error) {
        assertEquals((error as Error).message, "Test error");
      }

      try {
        await Deno.stat(tempDirPath);
        throw new Error("Temp dir should have been deleted");
      } catch (error) {
        assertEquals(error instanceof Deno.errors.NotFound, true);
      }
    });
  });

  describe("root checks", () => {
    it("isRoot should return boolean", () => {
      const result = isRoot();
      assertEquals(typeof result, "boolean");
    });

    it("requireRoot should throw when not root", () => {
      const uidStub = stub(Deno, "uid", () => 1000);

      try {
        try {
          requireRoot();
          throw new Error("Should have thrown");
        } catch (error) {
          assertEquals(
            (error as Error).message,
            "This script must be run as root (use sudo)",
          );
        }
      } finally {
        uidStub.restore();
      }
    });

    it("requireRoot should not throw when root", () => {
      const uidStub = stub(Deno, "uid", () => 0);

      try {
        requireRoot();
      } finally {
        uidStub.restore();
      }
    });
  });
});
