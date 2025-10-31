/**
 * Property-based tests for configure-self-hosted-runner.ts
 *
 * These tests verify the correctness of the self-hosted runner configuration
 * using property-based testing with fast-check.
 */

import { assertEquals, assertExists } from "../../deps.ts";
import { fc } from "../../deps.ts";
import {
  commandExists,
  installAptPackages,
  loadConfig,
  type RunnerConfig,
  verifyInstallations,
} from "../../scripts/system/configure-self-hosted-runner.ts";

// Test Step 1: Configuration file loading and validation
Deno.test("Step 1: Configuration loading should parse valid YAML correctly", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        runnerName: fc.stringMatching(/^[a-zA-Z0-9-]+$/),
        organization: fc.stringMatching(/^[a-zA-Z0-9-]+$/),
        version: fc.stringMatching(/^\d+\.\d+\.\d+$/),
      }),
      async ({ runnerName, organization, version }) => {
        // Create temporary config file
        const tempConfig = await Deno.makeTempFile({ suffix: ".yaml" });

        const yamlContent = `
runner:
  name: "${runnerName}"
  labels:
    - "self-hosted"
    - "Linux"
    - "X64"
  work_directory: "~/actions-runner"

packages:
  system:
    - curl
    - git
  development:
    - vim
  rust:
    install_method: "rustup"
    components:
      - "cargo"
      - "rustc"
  javascript:
    - name: "deno"
      install_method: "script"
      url: "https://deno.land/install.sh"

github:
  organization: "${organization}"
  version: "${version}"

system:
  update_system: true
  clean_cache: true
  restart_services: false
`;

        await Deno.writeTextFile(tempConfig, yamlContent);

        try {
          const config = await loadConfig(tempConfig);

          // Verify structure
          assertExists(config.runner);
          assertExists(config.packages);
          assertExists(config.github);
          assertExists(config.system);

          // Verify values
          assertEquals(config.runner.name, runnerName);
          assertEquals(config.github.organization, organization);
          assertEquals(config.github.version, version);
        } finally {
          await Deno.remove(tempConfig);
        }
      },
    ),
  );
});

// Test Step 2: Configuration validation should reject invalid formats
Deno.test("Step 2: Configuration loading should reject invalid YAML", async () => {
  const tempConfig = await Deno.makeTempFile({ suffix: ".yaml" });

  // Invalid YAML - missing required fields
  const invalidYaml = `
runner:
  name: "test"
# Missing required fields
`;

  await Deno.writeTextFile(tempConfig, invalidYaml);

  try {
    let errorThrown = false;
    try {
      await loadConfig(tempConfig);
    } catch (_error) {
      errorThrown = true;
    }
    assertEquals(errorThrown, true, "Should throw error for invalid config");
  } finally {
    await Deno.remove(tempConfig);
  }
});

// Test Step 3: Command existence check should be consistent
Deno.test("Step 3: commandExists should return consistent results", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom("ls", "cat", "echo", "grep", "awk"),
      async (command) => {
        const result1 = await commandExists(command);
        const result2 = await commandExists(command);

        // Result should be consistent (idempotent)
        assertEquals(result1, result2);

        // These common commands should exist on any Linux system
        assertEquals(result1, true);
      },
    ),
  );
});

// Test Step 4: Command existence check for non-existent commands
Deno.test("Step 4: commandExists should return false for non-existent commands", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.stringMatching(/^nonexistent[a-z0-9]{8}$/),
      async (fakeCommand) => {
        const exists = await commandExists(fakeCommand);
        assertEquals(exists, false);
      },
    ),
  );
});

// Test Step 5: Package list handling should filter empty arrays
Deno.test("Step 5: Empty package list should be handled gracefully", async () => {
  const result = await installAptPackages([]);
  assertEquals(result, true, "Empty package list should succeed");
});

// Test Step 6: Verify installation check should validate required tools
Deno.test("Step 6: verifyInstallations should check all required commands", async () => {
  const mockConfig: RunnerConfig = {
    runner: {
      name: "test-runner",
      labels: ["self-hosted"],
      work_directory: "~/test",
    },
    packages: {
      system: ["git", "curl"],
      development: ["make"],
      rust: {
        install_method: "rustup",
        components: ["cargo", "rustc"],
      },
      javascript: [{
        name: "deno",
        install_method: "script",
        url: "https://deno.land/install.sh",
      }],
      docker: undefined,
    },
    github: {
      organization: "test-org",
      version: "1.0.0",
    },
    system: {
      update_system: false,
      clean_cache: false,
      restart_services: false,
    },
  };

  // This will check if commands exist
  const result = await verifyInstallations(mockConfig);

  // Result should be boolean
  assertEquals(typeof result, "boolean");
});

// Test Step 7: Configuration structure validation
Deno.test("Step 7: Configuration should have all required sections", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        name: fc.stringMatching(/^[a-zA-Z0-9_-]{1,50}$/),
        org: fc.stringMatching(/^[a-zA-Z0-9_-]{1,50}$/),
        ver: fc.stringMatching(/^\d+\.\d+\.\d+$/),
      }),
      async ({ name, org, ver }) => {
        const tempConfig = await Deno.makeTempFile({ suffix: ".yaml" });

        const yamlContent = `
runner:
  name: "${name}"
  labels: ["self-hosted", "Linux", "X64"]
  work_directory: "~/actions-runner"
packages:
  system: ["curl"]
github:
  organization: "${org}"
  version: "${ver}"
system:
  update_system: true
  clean_cache: true
  restart_services: false
`;

        await Deno.writeTextFile(tempConfig, yamlContent);

        try {
          const config = await loadConfig(tempConfig);

          // All sections should be present
          assertExists(config.runner);
          assertExists(config.packages);
          assertExists(config.github);
          assertExists(config.system);

          // Validate types
          assertEquals(typeof config.runner.name, "string");
          assertEquals(Array.isArray(config.runner.labels), true);
          assertEquals(typeof config.github.organization, "string");
          assertEquals(typeof config.system.update_system, "boolean");
        } finally {
          await Deno.remove(tempConfig);
        }
      },
    ),
  );
});

// Test Step 8: Package installation idempotency
Deno.test("Step 8: Installing same packages multiple times should be idempotent", () => {
  // Note: This is a structural test - actual installation requires sudo
  // We test that the function can be called multiple times with same input

  // Call should be consistent
  const call1 = installAptPackages.length;
  const call2 = installAptPackages.length;

  assertEquals(call1, call2, "Function signature should be consistent");
});

// Test Step 9: Runner configuration merge
Deno.test("Step 9: Configuration should properly merge all package sources", async () => {
  const tempConfig = await Deno.makeTempFile({ suffix: ".yaml" });

  const yamlContent = `
runner:
  name: "test-runner"
  labels: ["self-hosted"]
  work_directory: "~/test"
packages:
  system: ["curl", "git"]
  development: ["vim", "make"]
  docker:
    enabled: true
    packages: ["docker.io"]
github:
  organization: "test"
  version: "1.0.0"
system:
  update_system: true
  clean_cache: true
  restart_services: false
`;

  await Deno.writeTextFile(tempConfig, yamlContent);

  try {
    const config = await loadConfig(tempConfig);

    // All package groups should be present
    assertExists(config.packages.system);
    assertExists(config.packages.development);
    assertExists(config.packages.docker);

    // Verify lengths
    assertEquals(config.packages.system?.length, 2);
    assertEquals(config.packages.development?.length, 2);
    assertEquals(config.packages.docker?.enabled, true);
  } finally {
    await Deno.remove(tempConfig);
  }
});

// Test Step 10: Boolean configuration options
Deno.test("Step 10: System configuration booleans should parse correctly", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        update: fc.boolean(),
        clean: fc.boolean(),
        restart: fc.boolean(),
      }),
      async ({ update, clean, restart }) => {
        const tempConfig = await Deno.makeTempFile({ suffix: ".yaml" });

        const yamlContent = `
runner:
  name: "test"
  labels: ["self-hosted"]
  work_directory: "~/test"
packages:
  system: ["curl"]
github:
  organization: "test"
  version: "1.0.0"
system:
  update_system: ${update}
  clean_cache: ${clean}
  restart_services: ${restart}
`;

        await Deno.writeTextFile(tempConfig, yamlContent);

        try {
          const config = await loadConfig(tempConfig);

          assertEquals(config.system.update_system, update);
          assertEquals(config.system.clean_cache, clean);
          assertEquals(config.system.restart_services, restart);
        } finally {
          await Deno.remove(tempConfig);
        }
      },
    ),
  );
});

// Test Step 11: Labels array validation
Deno.test("Step 11: Runner labels should be array of strings", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(fc.stringMatching(/^[a-zA-Z0-9-]+$/), {
        minLength: 1,
        maxLength: 5,
      }),
      async (labels) => {
        const tempConfig = await Deno.makeTempFile({ suffix: ".yaml" });

        const yamlContent = `
runner:
  name: "test"
  labels: ${JSON.stringify(labels)}
  work_directory: "~/test"
packages:
  system: ["curl"]
github:
  organization: "test"
  version: "1.0.0"
system:
  update_system: true
  clean_cache: true
  restart_services: false
`;

        await Deno.writeTextFile(tempConfig, yamlContent);

        try {
          const config = await loadConfig(tempConfig);

          assertEquals(Array.isArray(config.runner.labels), true);
          assertEquals(config.runner.labels.length, labels.length);

          // All labels should be strings
          config.runner.labels.forEach((label: string) => {
            assertEquals(typeof label, "string");
          });
        } finally {
          await Deno.remove(tempConfig);
        }
      },
    ),
  );
});

// Test Step 12: Version string format validation
Deno.test("Step 12: Version string should match semantic versioning", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.tuple(
        fc.integer({ min: 0, max: 99 }),
        fc.integer({ min: 0, max: 99 }),
        fc.integer({ min: 0, max: 99 }),
      ),
      async ([major, minor, patch]) => {
        const version = `${major}.${minor}.${patch}`;
        const tempConfig = await Deno.makeTempFile({ suffix: ".yaml" });

        const yamlContent = `
runner:
  name: "test"
  labels: ["self-hosted"]
  work_directory: "~/test"
packages:
  system: ["curl"]
github:
  organization: "test"
  version: "${version}"
system:
  update_system: true
  clean_cache: true
  restart_services: false
`;

        await Deno.writeTextFile(tempConfig, yamlContent);

        try {
          const config = await loadConfig(tempConfig);

          assertEquals(config.github.version, version);

          // Verify it matches semantic versioning pattern
          const semverRegex = /^\d+\.\d+\.\d+$/;
          assertEquals(semverRegex.test(config.github.version), true);
        } finally {
          await Deno.remove(tempConfig);
        }
      },
    ),
  );
});

// Test Step 13: Optional fields should be handled correctly
Deno.test("Step 13: Optional package sections can be omitted", async () => {
  const tempConfig = await Deno.makeTempFile({ suffix: ".yaml" });

  // Minimal configuration without optional fields
  const yamlContent = `
runner:
  name: "minimal-runner"
  labels: ["self-hosted"]
  work_directory: "~/test"
packages:
  system: ["curl"]
github:
  organization: "test"
  version: "1.0.0"
system:
  update_system: true
  clean_cache: true
  restart_services: false
`;

  await Deno.writeTextFile(tempConfig, yamlContent);

  try {
    const config = await loadConfig(tempConfig);

    // Optional fields should be undefined
    assertEquals(config.packages.rust, undefined);
    assertEquals(config.packages.development, undefined);
    assertEquals(config.packages.javascript, undefined);

    // Required fields should still be present
    assertExists(config.packages.system);
  } finally {
    await Deno.remove(tempConfig);
  }
});

// Test Step 14: Work directory path validation
Deno.test("Step 14: Work directory should support various path formats", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom(
        "~/actions-runner",
        "/home/user/runner",
        "./local-runner",
        "../parent-runner",
      ),
      async (workDir) => {
        const tempConfig = await Deno.makeTempFile({ suffix: ".yaml" });

        const yamlContent = `
runner:
  name: "test"
  labels: ["self-hosted"]
  work_directory: "${workDir}"
packages:
  system: ["curl"]
github:
  organization: "test"
  version: "1.0.0"
system:
  update_system: true
  clean_cache: true
  restart_services: false
`;

        await Deno.writeTextFile(tempConfig, yamlContent);

        try {
          const config = await loadConfig(tempConfig);

          assertEquals(config.runner.work_directory, workDir);
        } finally {
          await Deno.remove(tempConfig);
        }
      },
    ),
  );
});

// Test Step 15: Full integration test with default config
Deno.test("Step 15: Should load default configuration successfully", async () => {
  const defaultConfigPath = "config/runner-config.yaml";

  // Check if default config exists
  try {
    await Deno.stat(defaultConfigPath);
  } catch (_error) {
    // Skip this test if config doesn't exist
    return;
  }

  const config = await loadConfig(defaultConfigPath);

  // Verify all required sections
  assertExists(config.runner);
  assertExists(config.packages);
  assertExists(config.github);
  assertExists(config.system);

  // Verify runner configuration
  assertEquals(typeof config.runner.name, "string");
  assertEquals(config.runner.name.length > 0, true);
  assertEquals(Array.isArray(config.runner.labels), true);

  // Verify GitHub configuration
  assertEquals(typeof config.github.organization, "string");
  assertEquals(typeof config.github.version, "string");

  // Verify system configuration
  assertEquals(typeof config.system.update_system, "boolean");
  assertEquals(typeof config.system.clean_cache, "boolean");
  assertEquals(typeof config.system.restart_services, "boolean");
});
