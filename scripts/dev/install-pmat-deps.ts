#!/usr/bin/env -S deno run --allow-run --allow-read

import { logger } from "../lib/logger.ts";
import { commandExists, runCommand } from "../lib/common.ts";

async function checkDependencies(): Promise<{
  missing: string[];
  commands: string[];
}> {
  const missing: string[] = [];
  const commands: string[] = [];

  // Check for cargo
  if (!(await commandExists("cargo"))) {
    missing.push("Rust/Cargo");
    commands.push(
      "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh",
    );
  }

  // Check for pkg-config
  if (!(await commandExists("pkg-config"))) {
    missing.push("pkg-config");
    commands.push("sudo apt install -y pkg-config");
  }

  // Check for OpenSSL dev libraries
  try {
    const result = await runCommand(["pkg-config", "--exists", "openssl"]);
    if (result.code !== 0) {
      missing.push("OpenSSL development libraries");
      commands.push("sudo apt install -y libssl-dev");
    }
  } catch {
    // If pkg-config is missing, we can't check for OpenSSL
    if (await commandExists("pkg-config")) {
      missing.push("OpenSSL development libraries");
      commands.push("sudo apt install -y libssl-dev");
    }
  }

  return { missing, commands };
}

async function main() {
  logger.info("Checking PMAT installation dependencies...");

  const { missing, commands } = await checkDependencies();

  if (missing.length === 0) {
    logger.success("All dependencies are installed!");
    logger.info("You can now install PMAT with: cargo install pmat");
    return;
  }

  logger.warn("Missing dependencies:", { missing });
  console.log("");
  console.log("To install missing dependencies, run these commands:");
  console.log("");
  console.log("  # Install system dependencies");
  for (const cmd of commands) {
    console.log(`  ${cmd}`);
  }
  console.log("");
  console.log("  # Then install PMAT");
  console.log("  cargo install pmat");
  console.log("");
  console.log("Or run all at once:");
  console.log(`  ${commands.join(" && ")} && cargo install pmat`);

  // Exit with error code to indicate missing dependencies
  Deno.exit(1);
}

if (import.meta.main) {
  main();
}
