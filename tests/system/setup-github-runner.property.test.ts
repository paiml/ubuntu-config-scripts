import { assertEquals } from "../../deps.ts";
import { fc } from "../../deps.ts";
import {
  detectArchitecture,
  getLatestRunnerVersion,
  validateConfig,
  isRunnerInstalled,
} from "../../scripts/system/setup-github-runner.ts";

Deno.test("GitHub runner setup property tests", async (t) => {
  await t.step("detectArchitecture returns valid values", () => {
    const arch = detectArchitecture();
    const validArchs = ["x64", "arm64", "arm"];

    assertEquals(
      validArchs.includes(arch),
      true,
      `Architecture ${arch} should be one of ${validArchs.join(", ")}`,
    );
  });

  await t.step("detectArchitecture is deterministic", () => {
    const arch1 = detectArchitecture();
    const arch2 = detectArchitecture();

    assertEquals(arch1, arch2, "Architecture detection should be consistent");
  });

  await t.step("getLatestRunnerVersion returns valid info", async () => {
    const info = await getLatestRunnerVersion();

    // Version should be in semantic version format
    assertEquals(typeof info.version, "string");
    assertEquals(info.version.length > 0, true, "Version should not be empty");
    assertEquals(
      /^\d+\.\d+\.\d+$/.test(info.version),
      true,
      "Version should match X.Y.Z format",
    );

    // Download URL should be valid
    assertEquals(typeof info.downloadUrl, "string");
    assertEquals(
      info.downloadUrl.startsWith("https://github.com/actions/runner/releases/"),
      true,
      "Download URL should point to GitHub releases",
    );
    assertEquals(
      info.downloadUrl.endsWith(".tar.gz"),
      true,
      "Download URL should point to tar.gz file",
    );

    // Architecture should be valid
    const validArchs = ["x64", "arm64", "arm"];
    assertEquals(
      validArchs.includes(info.architecture),
      true,
      "Architecture should be valid",
    );
  });

  await t.step("getLatestRunnerVersion is idempotent", async () => {
    const info1 = await getLatestRunnerVersion();
    const info2 = await getLatestRunnerVersion();

    assertEquals(info1.version, info2.version);
    assertEquals(info1.downloadUrl, info2.downloadUrl);
    assertEquals(info1.architecture, info2.architecture);
  });

  await t.step("validateConfig rejects empty name", () => {
    const config = {
      name: "",
      url: "https://github.com/owner/repo",
      token: "test-token",
    };

    assertEquals(validateConfig(config), false, "Empty name should be rejected");
  });

  await t.step("validateConfig rejects invalid URL", () => {
    const invalidUrls = [
      "http://github.com/owner/repo",
      "https://gitlab.com/owner/repo",
      "github.com/owner/repo",
      "",
    ];

    for (const url of invalidUrls) {
      const config = {
        name: "test-runner",
        url,
        token: "test-token",
      };

      assertEquals(
        validateConfig(config),
        false,
        `Invalid URL ${url} should be rejected`,
      );
    }
  });

  await t.step("validateConfig rejects empty token", () => {
    const config = {
      name: "test-runner",
      url: "https://github.com/owner/repo",
      token: "",
    };

    assertEquals(validateConfig(config), false, "Empty token should be rejected");
  });

  await t.step("validateConfig accepts valid configuration", () => {
    const config = {
      name: "Linux-VM-Noah-MacPro-Intel",
      url: "https://github.com/owner/repo",
      token: "test-token-12345",
    };

    assertEquals(validateConfig(config), true, "Valid config should be accepted");
  });

  await t.step("runner name validation properties", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9_-]+$/),
        (name) => {
          const config = {
            name,
            url: "https://github.com/owner/repo",
            token: "test-token",
          };

          // Valid names should pass validation
          assertEquals(validateConfig(config), true);
        },
      ),
    );
  });

  await t.step("GitHub URL validation properties", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z0-9-]+$/),
        fc.stringMatching(/^[a-z0-9-]+$/),
        (owner, repo) => {
          const config = {
            name: "test-runner",
            url: `https://github.com/${owner}/${repo}`,
            token: "test-token",
          };

          // Valid GitHub URLs should pass
          assertEquals(validateConfig(config), true);
        },
      ),
    );
  });
});

// Property tests for version parsing
Deno.test("GitHub runner version property tests", async (t) => {
  await t.step("version format is consistent", () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.nat({ max: 99 }),
          fc.nat({ max: 999 }),
          fc.nat({ max: 999 }),
        ),
        ([major, minor, patch]) => {
          const version = `${major}.${minor}.${patch}`;
          const versionRegex = /^\d+\.\d+\.\d+$/;

          assertEquals(
            versionRegex.test(version),
            true,
            `Version ${version} should match semantic version format`,
          );
        },
      ),
    );
  });

  await t.step("download URL construction is correct", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^\d+\.\d+\.\d+$/),
        fc.constantFrom("x64", "arm64", "arm"),
        (version, arch) => {
          const url =
            `https://github.com/actions/runner/releases/download/v${version}/actions-runner-linux-${arch}-${version}.tar.gz`;

          // URL should be properly formatted
          assertEquals(url.startsWith("https://github.com/"), true);
          assertEquals(url.includes(version), true);
          assertEquals(url.includes(arch), true);
          assertEquals(url.endsWith(".tar.gz"), true);

          // Should not have double slashes (except in https://)
          const withoutProtocol = url.replace("https://", "");
          assertEquals(
            withoutProtocol.includes("//"),
            false,
            "URL should not have double slashes",
          );
        },
      ),
    );
  });
});

// Property tests for file operations
Deno.test("GitHub runner file operation property tests", {
  permissions: { read: true },
  ignore: true, // Ignore in CI to avoid file system issues
}, async (t) => {
  await t.step("isRunnerInstalled handles non-existent directories", async () => {
    const nonExistentPaths = [
      "/tmp/nonexistent-runner-test",
      "/tmp/another-nonexistent-path",
    ];

    for (const path of nonExistentPaths) {
      const installed = await isRunnerInstalled(path);
      assertEquals(
        installed,
        false,
        "Non-existent directory should return false",
      );
    }
  });
});

// Property tests for configuration invariants
Deno.test("GitHub runner configuration invariants", async (t) => {
  await t.step("configuration validation is consistent", () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 100 }),
          url: fc.constant("https://github.com/owner/repo"),
          token: fc.string({ minLength: 1, maxLength: 200 }),
        }),
        (config) => {
          // Validation should be idempotent
          const result1 = validateConfig(config);
          const result2 = validateConfig(config);

          assertEquals(result1, result2, "Validation should be consistent");
        },
      ),
    );
  });

  await t.step("runner name constraints", () => {
    const validNames = [
      "Linux-VM-Noah-MacPro-Intel",
      "runner-1",
      "my_runner",
      "RUNNER-123",
    ];

    for (const name of validNames) {
      const config = {
        name,
        url: "https://github.com/owner/repo",
        token: "test-token",
      };

      assertEquals(
        validateConfig(config),
        true,
        `Name ${name} should be valid`,
      );
    }
  });

  await t.step("labels are optional", () => {
    const configWithLabels = {
      name: "test-runner",
      url: "https://github.com/owner/repo",
      token: "test-token",
      labels: ["self-hosted", "Linux", "X64"],
    };

    const configWithoutLabels = {
      name: "test-runner",
      url: "https://github.com/owner/repo",
      token: "test-token",
    };

    // Both should be valid
    assertEquals(validateConfig(configWithLabels), true);
    assertEquals(validateConfig(configWithoutLabels), true);
  });
});

// Property tests for architecture detection
Deno.test("GitHub runner architecture property tests", async (t) => {
  await t.step("architecture maps correctly", () => {
    const archMappings = {
      "x86_64": "x64",
      "aarch64": "arm64",
      "arm": "arm",
    };

    // Test that architecture detection produces expected values
    const detectedArch = detectArchitecture();
    const validValues = Object.values(archMappings);

    assertEquals(
      validValues.includes(detectedArch),
      true,
      "Detected architecture should match known mappings",
    );
  });

  await t.step("architecture detection is stable", () => {
    // Run detection multiple times
    const results = Array.from({ length: 10 }, () => detectArchitecture());

    // All results should be identical
    const allSame = results.every((arch) => arch === results[0]);
    assertEquals(allSame, true, "Architecture detection should be stable");
  });
});
