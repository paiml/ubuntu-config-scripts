#!/usr/bin/env -S deno run --allow-run

import { Logger } from "./logger.ts";

export interface CommandResult {
  stdout: string;
  stderr: string;
  code: number;
  success: boolean;
}

export class SystemCommand {
  constructor(private logger: Logger) {}

  async run(command: string, args: string[] = []): Promise<CommandResult> {
    this.logger.debug(`Running: ${command} ${args.join(" ")}`);

    const cmd = new Deno.Command(command, {
      args,
      stdout: "piped",
      stderr: "piped",
    });

    try {
      const output = await cmd.output();
      const decoder = new TextDecoder();

      const result: CommandResult = {
        stdout: decoder.decode(output.stdout),
        stderr: decoder.decode(output.stderr),
        code: output.code,
        success: output.success,
      };

      if (!result.success) {
        this.logger.debug(`Command failed with code ${result.code}`);
        if (result.stderr) {
          this.logger.debug(`stderr: ${result.stderr}`);
        }
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to run command: ${error}`);
      throw error;
    }
  }

  async runQuiet(command: string, args: string[] = []): Promise<CommandResult> {
    const cmd = new Deno.Command(command, {
      args,
      stdout: "piped",
      stderr: "piped",
    });

    const output = await cmd.output();
    const decoder = new TextDecoder();

    return {
      stdout: decoder.decode(output.stdout),
      stderr: decoder.decode(output.stderr),
      code: output.code,
      success: output.success,
    };
  }
}
