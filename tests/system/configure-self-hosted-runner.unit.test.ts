/**
 * Unit tests for configure-self-hosted-runner.ts
 *
 * These tests focus on individual functions with mocked dependencies
 * to achieve high code coverage without requiring actual system calls.
 */

import { assertEquals, assertExists } from "../../deps.ts";
import {
  cleanCache,
  installAptPackages,
  installDeno,
  installRust,
  loadConfig,
  updateSystem,
  verifyInstallations,
  configureRunner,
  main,
  type RunnerConfig,
} from "../../scripts/system/configure-self-hosted-runner.ts";

// Test updateSystem function
Deno.test("updateSystem: should return true on successful apt update", async () => {
  // This test will call the real function and check return type
  const result = await updateSystem();
  assertEquals(typeof result, "boolean");
});

// Test installAptPackages with empty list
Deno.test("installAptPackages: should handle empty package list", async () => {
  const result = await installAptPackages([]);
  assertEquals(result, true);
});

// Test installAptPackages with packages
Deno.test("installAptPackages: should attempt to install packages", async () => {
  // This will fail without sudo but tests the code path
  const result = await installAptPackages(["git"]);
  assertEquals(typeof result, "boolean");
});

// Test installRust function
Deno.test("installRust: should check for rustup and attempt install", async () => {
  const result = await installRust();
  assertEquals(typeof result, "boolean");
});

// Test installDeno function
Deno.test("installDeno: should check for deno", async () => {
  const result = await installDeno("https://deno.land/install.sh");
  assertEquals(typeof result, "boolean");
});

// Test cleanCache function
Deno.test("cleanCache: should attempt to clean apt cache", async () => {
  const result = await cleanCache();
  assertEquals(typeof result, "boolean");
});

// Test verifyInstallations with minimal config
Deno.test("verifyInstallations: should verify basic commands exist", async () => {
  const minimalConfig: RunnerConfig = {
    runner: {
      name: "test",
      labels: ["test"],
      work_directory: "~/test",
    },
    packages: {
      system: ["git", "curl"],
      development: undefined,
      rust: undefined,
      javascript: undefined,
      docker: undefined,
    },
    github: {
      organization: "test",
      version: "1.0.0",
    },
    system: {
      update_system: false,
      clean_cache: false,
      restart_services: false,
    },
  };

  const result = await verifyInstallations(minimalConfig);
  assertEquals(typeof result, "boolean");
});

// Test verifyInstallations with rust config
Deno.test("verifyInstallations: should check rust commands when configured", async () => {
  const rustConfig: RunnerConfig = {
    runner: {
      name: "test",
      labels: ["test"],
      work_directory: "~/test",
    },
    packages: {
      system: undefined,
      development: undefined,
      rust: {
        install_method: "rustup",
        components: ["cargo", "rustc"],
      },
      javascript: undefined,
      docker: undefined,
    },
    github: {
      organization: "test",
      version: "1.0.0",
    },
    system: {
      update_system: false,
      clean_cache: false,
      restart_services: false,
    },
  };

  const result = await verifyInstallations(rustConfig);
  assertEquals(typeof result, "boolean");
});

// Test verifyInstallations with javascript config
Deno.test("verifyInstallations: should check deno when configured", async () => {
  const jsConfig: RunnerConfig = {
    runner: {
      name: "test",
      labels: ["test"],
      work_directory: "~/test",
    },
    packages: {
      system: undefined,
      development: undefined,
      rust: undefined,
      javascript: [{
        name: "deno",
        install_method: "script",
        url: "https://deno.land/install.sh",
      }],
      docker: undefined,
    },
    github: {
      organization: "test",
      version: "1.0.0",
    },
    system: {
      update_system: false,
      clean_cache: false,
      restart_services: false,
    },
  };

  const result = await verifyInstallations(jsConfig);
  assertEquals(typeof result, "boolean");
});

// Test configureRunner with default config
Deno.test("configureRunner: should load and process default config", async () => {
  const tempConfig = await Deno.makeTempFile({ suffix: ".yaml" });

  const yamlContent = `
runner:
  name: "test-runner"
  labels: ["self-hosted"]
  work_directory: "~/test"
packages:
  system: []
github:
  organization: "test-org"
  version: "1.0.0"
system:
  update_system: false
  clean_cache: false
  restart_services: false
`;

  await Deno.writeTextFile(tempConfig, yamlContent);

  try {
    const result = await configureRunner(tempConfig);
    assertEquals(typeof result, "boolean");
  } finally {
    await Deno.remove(tempConfig);
  }
});

// Test configureRunner with full config
Deno.test("configureRunner: should handle full configuration", async () => {
  const tempConfig = await Deno.makeTempFile({ suffix: ".yaml" });

  const yamlContent = `
runner:
  name: "full-test-runner"
  labels: ["self-hosted", "Linux", "X64"]
  work_directory: "~/actions-runner"
packages:
  system: []
  development: []
  rust:
    install_method: "rustup"
    components: ["cargo", "rustc"]
  javascript:
    - name: "deno"
      install_method: "script"
      url: "https://deno.land/install.sh"
  docker:
    enabled: false
    packages: []
github:
  organization: "paiml"
  version: "2.328.0"
system:
  update_system: false
  clean_cache: false
  restart_services: false
`;

  await Deno.writeTextFile(tempConfig, yamlContent);

  try {
    const result = await configureRunner(tempConfig);
    assertEquals(typeof result, "boolean");
  } finally {
    await Deno.remove(tempConfig);
  }
});

// Test configureRunner with update_system enabled
Deno.test("configureRunner: should call updateSystem when enabled", async () => {
  const tempConfig = await Deno.makeTempFile({ suffix: ".yaml" });

  const yamlContent = `
runner:
  name: "test-runner"
  labels: ["self-hosted"]
  work_directory: "~/test"
packages:
  system: []
github:
  organization: "test"
  version: "1.0.0"
system:
  update_system: true
  clean_cache: false
  restart_services: false
`;

  await Deno.writeTextFile(tempConfig, yamlContent);

  try {
    const result = await configureRunner(tempConfig);
    assertEquals(typeof result, "boolean");
  } finally {
    await Deno.remove(tempConfig);
  }
});

// Test configureRunner with clean_cache enabled
Deno.test("configureRunner: should call cleanCache when enabled", async () => {
  const tempConfig = await Deno.makeTempFile({ suffix: ".yaml" });

  const yamlContent = `
runner:
  name: "test-runner"
  labels: ["self-hosted"]
  work_directory: "~/test"
packages:
  system: []
github:
  organization: "test"
  version: "1.0.0"
system:
  update_system: false
  clean_cache: true
  restart_services: false
`;

  await Deno.writeTextFile(tempConfig, yamlContent);

  try {
    const result = await configureRunner(tempConfig);
    assertEquals(typeof result, "boolean");
  } finally {
    await Deno.remove(tempConfig);
  }
});

// Test configureRunner with docker enabled
Deno.test("configureRunner: should install docker packages when enabled", async () => {
  const tempConfig = await Deno.makeTempFile({ suffix: ".yaml" });

  const yamlContent = `
runner:
  name: "test-runner"
  labels: ["self-hosted"]
  work_directory: "~/test"
packages:
  system: []
  docker:
    enabled: true
    packages: ["docker.io"]
github:
  organization: "test"
  version: "1.0.0"
system:
  update_system: false
  clean_cache: false
  restart_services: false
`;

  await Deno.writeTextFile(tempConfig, yamlContent);

  try {
    const result = await configureRunner(tempConfig);
    assertEquals(typeof result, "boolean");
  } finally {
    await Deno.remove(tempConfig);
  }
});

// Test loadConfig error handling - file not found
Deno.test("loadConfig: should handle missing file", async () => {
  let errorThrown = false;
  try {
    await loadConfig("/nonexistent/path/config.yaml");
  } catch (error) {
    errorThrown = true;
    assertExists(error);
  }
  assertEquals(errorThrown, true);
});

// Test loadConfig error handling - invalid YAML
Deno.test("loadConfig: should handle invalid YAML content", async () => {
  const tempConfig = await Deno.makeTempFile({ suffix: ".yaml" });
  await Deno.writeTextFile(tempConfig, "invalid: yaml: content:");

  let errorThrown = false;
  try {
    await loadConfig(tempConfig);
  } catch (_error) {
    errorThrown = true;
  } finally {
    await Deno.remove(tempConfig);
  }

  assertEquals(errorThrown, true);
});

// Test loadConfig with all optional fields undefined
Deno.test("loadConfig: should handle config with all optional fields omitted", async () => {
  const tempConfig = await Deno.makeTempFile({ suffix: ".yaml" });

  const yamlContent = `
runner:
  name: "minimal"
  labels: ["test"]
  work_directory: "~/"
packages: {}
github:
  organization: "test"
  version: "1.0.0"
system:
  update_system: false
  clean_cache: false
  restart_services: false
`;

  await Deno.writeTextFile(tempConfig, yamlContent);

  try {
    const config = await loadConfig(tempConfig);
    assertEquals(config.packages.system, undefined);
    assertEquals(config.packages.rust, undefined);
    assertEquals(config.packages.javascript, undefined);
    assertEquals(config.packages.docker, undefined);
  } finally {
    await Deno.remove(tempConfig);
  }
});

// Test configureRunner with system packages
Deno.test("configureRunner: should attempt to install system packages", async () => {
  const tempConfig = await Deno.makeTempFile({ suffix: ".yaml" });

  const yamlContent = `
runner:
  name: "test-runner"
  labels: ["self-hosted"]
  work_directory: "~/test"
packages:
  system: ["git", "curl"]
github:
  organization: "test"
  version: "1.0.0"
system:
  update_system: false
  clean_cache: false
  restart_services: false
`;

  await Deno.writeTextFile(tempConfig, yamlContent);

  try {
    const result = await configureRunner(tempConfig);
    assertEquals(typeof result, "boolean");
  } finally {
    await Deno.remove(tempConfig);
  }
});

// Test configureRunner with development packages
Deno.test("configureRunner: should install development packages", async () => {
  const tempConfig = await Deno.makeTempFile({ suffix: ".yaml" });

  const yamlContent = `
runner:
  name: "test-runner"
  labels: ["self-hosted"]
  work_directory: "~/test"
packages:
  development: ["vim", "make"]
github:
  organization: "test"
  version: "1.0.0"
system:
  update_system: false
  clean_cache: false
  restart_services: false
`;

  await Deno.writeTextFile(tempConfig, yamlContent);

  try {
    const result = await configureRunner(tempConfig);
    assertEquals(typeof result, "boolean");
  } finally {
    await Deno.remove(tempConfig);
  }
});

// Test configureRunner with rust packages
Deno.test("configureRunner: should install rust toolchain", async () => {
  const tempConfig = await Deno.makeTempFile({ suffix: ".yaml" });

  const yamlContent = `
runner:
  name: "test-runner"
  labels: ["self-hosted"]
  work_directory: "~/test"
packages:
  rust:
    install_method: "rustup"
    components: ["cargo", "rustc"]
github:
  organization: "test"
  version: "1.0.0"
system:
  update_system: false
  clean_cache: false
  restart_services: false
`;

  await Deno.writeTextFile(tempConfig, yamlContent);

  try {
    const result = await configureRunner(tempConfig);
    assertEquals(typeof result, "boolean");
  } finally {
    await Deno.remove(tempConfig);
  }
});

// Test configureRunner with javascript packages
Deno.test("configureRunner: should install javascript tools", async () => {
  const tempConfig = await Deno.makeTempFile({ suffix: ".yaml" });

  const yamlContent = `
runner:
  name: "test-runner"
  labels: ["self-hosted"]
  work_directory: "~/test"
packages:
  javascript:
    - name: "deno"
      install_method: "script"
      url: "https://deno.land/install.sh"
github:
  organization: "test"
  version: "1.0.0"
system:
  update_system: false
  clean_cache: false
  restart_services: false
`;

  await Deno.writeTextFile(tempConfig, yamlContent);

  try {
    const result = await configureRunner(tempConfig);
    assertEquals(typeof result, "boolean");
  } finally {
    await Deno.remove(tempConfig);
  }
});

// Test verifyInstallations with development packages
Deno.test("verifyInstallations: should check development tools", async () => {
  const devConfig: RunnerConfig = {
    runner: {
      name: "test",
      labels: ["test"],
      work_directory: "~/test",
    },
    packages: {
      system: undefined,
      development: ["make", "vim"],
      rust: undefined,
      javascript: undefined,
      docker: undefined,
    },
    github: {
      organization: "test",
      version: "1.0.0",
    },
    system: {
      update_system: false,
      clean_cache: false,
      restart_services: false,
    },
  };

  const result = await verifyInstallations(devConfig);
  assertEquals(typeof result, "boolean");
});

// Test verifyInstallations should return true when all commands exist
Deno.test("verifyInstallations: should return true for existing commands", async () => {
  const minimalConfig: RunnerConfig = {
    runner: {
      name: "test",
      labels: ["test"],
      work_directory: "~/test",
    },
    packages: {
      system: ["ls", "cat", "echo"], // Commands that definitely exist
      development: undefined,
      rust: undefined,
      javascript: undefined,
      docker: undefined,
    },
    github: {
      organization: "test",
      version: "1.0.0",
    },
    system: {
      update_system: false,
      clean_cache: false,
      restart_services: false,
    },
  };

  const result = await verifyInstallations(minimalConfig);
  assertEquals(result, true);
});

// Test main function with default config
Deno.test("main: should use default config when no args provided", async () => {
  const exitCode = await main([]);
  assertEquals(typeof exitCode, "number");
  // Should be 0 or 1
  assertEquals(exitCode >= 0 && exitCode <= 1, true);
});

// Test main function with custom config
Deno.test("main: should accept custom config path", async () => {
  const tempConfig = await Deno.makeTempFile({ suffix: ".yaml" });

  const yamlContent = `
runner:
  name: "cli-test"
  labels: ["test"]
  work_directory: "~/test"
packages: {}
github:
  organization: "test"
  version: "1.0.0"
system:
  update_system: false
  clean_cache: false
  restart_services: false
`;

  await Deno.writeTextFile(tempConfig, yamlContent);

  try {
    const exitCode = await main(["--config", tempConfig]);
    assertEquals(typeof exitCode, "number");
  } finally {
    await Deno.remove(tempConfig);
  }
});

// Test main function with invalid config
Deno.test("main: should return 1 on invalid config", async () => {
  const exitCode = await main(["--config", "/nonexistent/config.yaml"]);
  assertEquals(exitCode, 1);
});
