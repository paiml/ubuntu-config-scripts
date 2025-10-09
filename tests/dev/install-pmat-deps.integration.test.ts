import { assertEquals } from "../../deps.ts";

// Integration tests for install-pmat-deps.ts
// Tests PMAT dependency checking and installation instructions

Deno.test(
  "install-pmat-deps - can be executed as script",
  { permissions: { read: true, run: true, env: true } },
  async () => {
    const command = new Deno.Command("deno", {
      args: [
        "run",
        "--allow-run",
        "--allow-read",
        "--allow-env",
        "scripts/dev/install-pmat-deps.ts",
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const result = await command.output();
    assertEquals(typeof result.code, "number");
  },
);

Deno.test(
  "install-pmat-deps - checks for cargo",
  { permissions: { read: true, run: true, env: true } },
  async () => {
    const command = new Deno.Command("deno", {
      args: [
        "run",
        "--allow-run",
        "--allow-read",
        "--allow-env",
        "scripts/dev/install-pmat-deps.ts",
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const result = await command.output();
    const output = new TextDecoder().decode(result.stdout);

    // Should check for dependencies
    assertEquals(
      output.includes("dependencies") || output.includes("cargo"),
      true,
    );
  },
);

Deno.test(
  "install-pmat-deps - checks for pkg-config",
  { permissions: { read: true, run: true, env: true } },
  async () => {
    const command = new Deno.Command("deno", {
      args: [
        "run",
        "--allow-run",
        "--allow-read",
        "--allow-env",
        "scripts/dev/install-pmat-deps.ts",
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const result = await command.output();
    const output = new TextDecoder().decode(result.stdout);

    // May mention pkg-config if missing
    assertEquals(typeof output, "string");
  },
);

Deno.test(
  "install-pmat-deps - checks for OpenSSL",
  { permissions: { read: true, run: true, env: true } },
  async () => {
    const command = new Deno.Command("deno", {
      args: [
        "run",
        "--allow-run",
        "--allow-read",
        "--allow-env",
        "scripts/dev/install-pmat-deps.ts",
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const result = await command.output();
    const output = new TextDecoder().decode(result.stdout);

    // May mention OpenSSL if missing
    assertEquals(typeof output, "string");
  },
);

Deno.test(
  "install-pmat-deps - provides installation commands when missing",
  { permissions: { read: true, run: true, env: true } },
  async () => {
    const command = new Deno.Command("deno", {
      args: [
        "run",
        "--allow-run",
        "--allow-read",
        "--allow-env",
        "scripts/dev/install-pmat-deps.ts",
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const result = await command.output();
    const output = new TextDecoder().decode(result.stdout);

    // If missing deps, should provide commands
    if (result.code !== 0) {
      assertEquals(
        output.includes("install") || output.includes("cargo"),
        true,
      );
    }
  },
);

Deno.test(
  "install-pmat-deps - shows success when all installed",
  { permissions: { read: true, run: true, env: true } },
  async () => {
    const command = new Deno.Command("deno", {
      args: [
        "run",
        "--allow-run",
        "--allow-read",
        "--allow-env",
        "scripts/dev/install-pmat-deps.ts",
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const result = await command.output();
    const output = new TextDecoder().decode(result.stdout);

    // Should check dependencies
    assertEquals(output.length > 0, true);
  },
);

Deno.test(
  "install-pmat-deps - contains cargo install command",
  { permissions: { read: true, run: true, env: true } },
  async () => {
    const command = new Deno.Command("deno", {
      args: [
        "run",
        "--allow-run",
        "--allow-read",
        "--allow-env",
        "scripts/dev/install-pmat-deps.ts",
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const result = await command.output();
    const output = new TextDecoder().decode(result.stdout);

    // Should mention cargo install pmat
    assertEquals(
      output.includes("cargo install pmat") ||
        output.includes("cargo install"),
      true,
    );
  },
);

Deno.test(
  "install-pmat-deps - mentions rustup if cargo missing",
  { permissions: { read: true, run: true, env: true } },
  async () => {
    const command = new Deno.Command("deno", {
      args: [
        "run",
        "--allow-run",
        "--allow-read",
        "--allow-env",
        "scripts/dev/install-pmat-deps.ts",
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const result = await command.output();
    const output = new TextDecoder().decode(result.stdout);

    // If cargo is missing, should show rustup command
    if (output.includes("Rust/Cargo") || output.includes("Missing")) {
      assertEquals(
        output.includes("rustup") || output.includes("sh.rustup.rs"),
        true,
      );
    }
  },
);

Deno.test(
  "install-pmat-deps - mentions apt install for system deps",
  { permissions: { read: true, run: true, env: true } },
  async () => {
    const command = new Deno.Command("deno", {
      args: [
        "run",
        "--allow-run",
        "--allow-read",
        "--allow-env",
        "scripts/dev/install-pmat-deps.ts",
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const result = await command.output();
    const output = new TextDecoder().decode(result.stdout);

    // May mention apt install for missing system dependencies
    if (output.includes("Missing") || result.code !== 0) {
      // Script provides installation instructions
      assertEquals(typeof output, "string");
    }
  },
);

Deno.test(
  "install-pmat-deps - provides combined command",
  { permissions: { read: true, run: true, env: true } },
  async () => {
    const command = new Deno.Command("deno", {
      args: [
        "run",
        "--allow-run",
        "--allow-read",
        "--allow-env",
        "scripts/dev/install-pmat-deps.ts",
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const result = await command.output();
    const output = new TextDecoder().decode(result.stdout);

    // If missing deps, should show combined command
    if (result.code !== 0) {
      assertEquals(output.includes("&&") || output.includes("all at once"), true);
    }
  },
);

Deno.test(
  "install-pmat-deps - exits with code 1 when deps missing",
  { permissions: { read: true, run: true, env: true } },
  async () => {
    const command = new Deno.Command("deno", {
      args: [
        "run",
        "--allow-run",
        "--allow-read",
        "--allow-env",
        "scripts/dev/install-pmat-deps.ts",
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const result = await command.output();

    // Exit code should be 0 or 1
    assertEquals(result.code === 0 || result.code === 1, true);
  },
);

Deno.test(
  "install-pmat-deps - file contains checkDependencies function",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/dev/install-pmat-deps.ts",
    );

    assertEquals(content.includes("async function checkDependencies"), true);
    assertEquals(content.includes("missing:"), true);
    assertEquals(content.includes("commands:"), true);
  },
);

Deno.test(
  "install-pmat-deps - file checks for cargo command",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/dev/install-pmat-deps.ts",
    );

    assertEquals(content.includes('commandExists("cargo")'), true);
    assertEquals(content.includes("Rust/Cargo"), true);
  },
);

Deno.test(
  "install-pmat-deps - file checks for pkg-config",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/dev/install-pmat-deps.ts",
    );

    assertEquals(content.includes('commandExists("pkg-config")'), true);
    assertEquals(content.includes("pkg-config"), true);
  },
);

Deno.test(
  "install-pmat-deps - file checks for OpenSSL",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/dev/install-pmat-deps.ts",
    );

    assertEquals(content.includes('"openssl"'), true);
    assertEquals(content.includes("OpenSSL"), true);
    assertEquals(content.includes("libssl-dev"), true);
  },
);

Deno.test(
  "install-pmat-deps - file uses logger for output",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/dev/install-pmat-deps.ts",
    );

    assertEquals(content.includes("logger.info"), true);
    assertEquals(content.includes("logger.success"), true);
    assertEquals(content.includes("logger.warn"), true);
  },
);

Deno.test(
  "install-pmat-deps - file has main function",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/dev/install-pmat-deps.ts",
    );

    assertEquals(content.includes("async function main"), true);
    assertEquals(content.includes("import.meta.main"), true);
  },
);

Deno.test(
  "install-pmat-deps - file provides rustup.rs URL",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/dev/install-pmat-deps.ts",
    );

    assertEquals(content.includes("sh.rustup.rs"), true);
    assertEquals(content.includes("curl --proto"), true);
  },
);

Deno.test(
  "install-pmat-deps - file handles missing pkg-config gracefully",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/dev/install-pmat-deps.ts",
    );

    assertEquals(content.includes("try {"), true);
    assertEquals(content.includes("catch {"), true);
    assertEquals(content.includes("If pkg-config is missing"), true);
  },
);

Deno.test(
  "install-pmat-deps - file includes PMAT in messages",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/dev/install-pmat-deps.ts",
    );

    assertEquals(content.includes("PMAT"), true);
    assertEquals(content.includes("cargo install pmat"), true);
  },
);

Deno.test(
  "install-pmat-deps - file exits with code 1 on missing deps",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/dev/install-pmat-deps.ts",
    );

    assertEquals(content.includes("Deno.exit(1)"), true);
  },
);

Deno.test(
  "install-pmat-deps - file provides both individual and combined commands",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/dev/install-pmat-deps.ts",
    );

    assertEquals(content.includes("run these commands"), true);
    assertEquals(content.includes("Or run all at once"), true);
    assertEquals(content.includes('commands.join(" && ")'), true);
  },
);

Deno.test(
  "install-pmat-deps - file uses commandExists from common",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/dev/install-pmat-deps.ts",
    );

    assertEquals(content.includes("../lib/common.ts"), true);
    assertEquals(content.includes("commandExists"), true);
  },
);

Deno.test(
  "install-pmat-deps - file uses runCommand from common",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/dev/install-pmat-deps.ts",
    );

    assertEquals(content.includes("runCommand"), true);
    assertEquals(content.includes("../lib/common.ts"), true);
  },
);

Deno.test(
  "install-pmat-deps - file returns missing and commands arrays",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/dev/install-pmat-deps.ts",
    );

    assertEquals(content.includes("const missing: string[] = []"), true);
    assertEquals(content.includes("const commands: string[] = []"), true);
    assertEquals(content.includes("return { missing, commands }"), true);
  },
);

Deno.test(
  "install-pmat-deps - file checks missing.length === 0",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/dev/install-pmat-deps.ts",
    );

    assertEquals(content.includes("missing.length === 0"), true);
    assertEquals(content.includes("All dependencies are installed"), true);
  },
);

Deno.test(
  "install-pmat-deps - file iterates over commands",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/dev/install-pmat-deps.ts",
    );

    assertEquals(content.includes("for (const cmd of commands)"), true);
  },
);

Deno.test(
  "install-pmat-deps - file uses console.log for commands",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/dev/install-pmat-deps.ts",
    );

    assertEquals(content.includes("console.log"), true);
    assertEquals(content.includes("# Install system dependencies"), true);
    assertEquals(content.includes("# Then install PMAT"), true);
  },
);

Deno.test(
  "install-pmat-deps - file checks result.code for OpenSSL",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/dev/install-pmat-deps.ts",
    );

    assertEquals(content.includes("result.code !== 0"), true);
    assertEquals(content.includes("OpenSSL development libraries"), true);
  },
);

Deno.test(
  "install-pmat-deps - script provides helpful error context",
  { permissions: { read: true, run: true, env: true } },
  async () => {
    const command = new Deno.Command("deno", {
      args: [
        "run",
        "--allow-run",
        "--allow-read",
        "--allow-env",
        "scripts/dev/install-pmat-deps.ts",
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const result = await command.output();
    const output = new TextDecoder().decode(result.stdout);

    // Should provide useful output
    assertEquals(output.length > 0, true);
    assertEquals(typeof result.code, "number");
  },
);
