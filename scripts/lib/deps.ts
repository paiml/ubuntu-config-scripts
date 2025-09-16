#!/usr/bin/env -S deno run --allow-run

import { Logger } from "./logger.ts";

export async function checkCommand(command: string): Promise<boolean> {
  try {
    const cmd = new Deno.Command("which", {
      args: [command],
      stdout: "piped",
      stderr: "null",
    });
    const output = await cmd.output();
    return output.success;
  } catch {
    return false;
  }
}

export async function validateDependencies(
  deps: string[],
  logger: Logger,
): Promise<boolean> {
  let allPresent = true;

  for (const dep of deps) {
    const exists = await checkCommand(dep);
    if (!exists) {
      logger.error(`Missing dependency: ${dep}`);
      allPresent = false;
    } else {
      logger.debug(`Found dependency: ${dep}`);
    }
  }

  return allPresent;
}