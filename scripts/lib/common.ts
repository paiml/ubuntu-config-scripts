import { logger } from "./logger.ts";

export interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  code: number;
}

export async function runCommand(
  cmd: string[],
  options?: Deno.CommandOptions,
): Promise<CommandResult> {
  logger.debug(`Running command: ${cmd.join(" ")}`);

  const command = new Deno.Command(cmd[0]!, {
    args: cmd.slice(1),
    stdout: "piped",
    stderr: "piped",
    ...options,
  });

  try {
    const process = command.spawn();
    const { success, stdout, stderr, code } = await process.output();

    const result: CommandResult = {
      success,
      stdout: new TextDecoder().decode(stdout),
      stderr: new TextDecoder().decode(stderr),
      code,
    };

    if (!success) {
      logger.debug(`Command failed with code ${code}: ${result.stderr}`);
    }

    return result;
  } catch (error) {
    logger.error(`Failed to run command: ${error}`);
    return {
      success: false,
      stdout: "",
      stderr: String(error),
      code: -1,
    };
  }
}

export async function commandExists(command: string): Promise<boolean> {
  try {
    const result = await runCommand(["which", command]);
    return result.success;
  } catch {
    return false;
  }
}

export async function requireCommand(command: string): Promise<void> {
  if (!await commandExists(command)) {
    throw new Error(`Required command '${command}' not found in PATH`);
  }
}

export function parseArgs(args: string[]): Record<string, string | boolean> {
  const parsed: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const equalIndex = key.indexOf("=");

      if (equalIndex > -1) {
        const name = key.slice(0, equalIndex);
        const value = key.slice(equalIndex + 1);
        parsed[name] = value;
      } else if (
        i + 1 < args.length && args[i + 1] !== undefined &&
        !args[i + 1]!.startsWith("-")
      ) {
        parsed[key] = args[++i]!;
      } else {
        parsed[key] = true;
      }
    } else if (arg.startsWith("-") && arg.length === 2) {
      const key = arg.slice(1);
      if (i + 1 < args.length && args[i + 1] && !args[i + 1]!.startsWith("-")) {
        parsed[key] = args[++i]!;
      } else {
        parsed[key] = true;
      }
    }
  }

  return parsed;
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(path: string): Promise<void> {
  await Deno.mkdir(path, { recursive: true });
}

export function getEnvOrDefault(
  key: string,
  defaultValue: string,
): string {
  return Deno.env.get(key) || defaultValue;
}

export function requireEnv(key: string): string {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Required environment variable '${key}' not set`);
  }
  return value;
}

export async function withTempDir<T>(
  fn: (tempDir: string) => Promise<T>,
): Promise<T> {
  const tempDir = await Deno.makeTempDir();
  try {
    return await fn(tempDir);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
}

export function isRoot(): boolean {
  return Deno.uid() === 0;
}

export function requireRoot(): void {
  if (!isRoot()) {
    throw new Error("This script must be run as root (use sudo)");
  }
}

export async function confirm(
  message: string,
  defaultValue = false,
): Promise<boolean> {
  const defaultText = defaultValue ? "[Y/n]" : "[y/N]";
  console.log(`${message} ${defaultText}: `);

  const buf = new Uint8Array(1024);
  const n = await Deno.stdin.read(buf);

  if (n === null) return defaultValue;

  const answer = new TextDecoder().decode(buf.subarray(0, n)).trim()
    .toLowerCase();

  if (answer === "") return defaultValue;
  return answer === "y" || answer === "yes";
}
