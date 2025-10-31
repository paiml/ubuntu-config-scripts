import { fileExists } from "./common.ts";
import { logger } from "./logger.ts";

export interface Config {
  [key: string]: unknown;
}

export class ConfigManager {
  private config: Config = {};
  private configPath: string | undefined;

  constructor(configPath?: string) {
    this.configPath = configPath;
  }

  async load(): Promise<void> {
    if (!this.configPath) {
      logger.debug("No config path specified, using empty config");
      return;
    }

    if (!await fileExists(this.configPath)) {
      logger.debug(
        `Config file not found at ${this.configPath}, using defaults`,
      );
      return;
    }

    try {
      const content = await Deno.readTextFile(this.configPath);
      this.config = JSON.parse(content);
      logger.info(`Loaded config from ${this.configPath}`);
    } catch (error) {
      logger.error(`Failed to load config from ${this.configPath}:`, error);
      throw error;
    }
  }

  async save(): Promise<void> {
    if (!this.configPath) {
      throw new Error("No config path specified");
    }

    try {
      const content = JSON.stringify(this.config, null, 2);
      await Deno.writeTextFile(this.configPath, content);
      logger.info(`Saved config to ${this.configPath}`);
    } catch (error) {
      logger.error(`Failed to save config to ${this.configPath}:`, error);
      throw error;
    }
  }

  get<T>(key: string, defaultValue?: T): T {
    const keys = key.split(".");
    let value: unknown = this.config;

    for (const k of keys) {
      if (typeof value === "object" && value !== null && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        return defaultValue as T;
      }
    }

    return value as T;
  }

  set(key: string, value: unknown): void {
    const keys = key.split(".");
    let obj: Record<string, unknown> = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!k) continue;

      if (!(k in obj) || typeof obj[k] !== "object" || obj[k] === null) {
        obj[k] = {};
      }
      obj = obj[k] as Record<string, unknown>;
    }

    const lastKey = keys[keys.length - 1];
    if (lastKey) {
      obj[lastKey] = value;
    }
  }

  has(key: string): boolean {
    const keys = key.split(".");
    let obj: unknown = this.config;

    for (const k of keys) {
      if (typeof obj === "object" && obj !== null && k in obj) {
        obj = (obj as Record<string, unknown>)[k];
      } else {
        return false;
      }
    }

    return true;
  }

  delete(key: string): void {
    const keys = key.split(".");
    let obj: Record<string, unknown> = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!k) continue;

      if (!(k in obj) || typeof obj[k] !== "object" || obj[k] === null) {
        return;
      }
      obj = obj[k] as Record<string, unknown>;
    }

    const lastKey = keys[keys.length - 1];
    if (lastKey && lastKey in obj) {
      delete obj[lastKey];
    }
  }

  merge(other: Config): void {
    this.config = this.deepMerge(this.config, other);
  }

  private deepMerge(target: Config, source: Config): Config {
    const result = { ...target };

    for (const key in source) {
      if (key in source) {
        const sourceValue = source[key];
        const targetValue = result[key];

        if (
          typeof sourceValue === "object" &&
          sourceValue !== null &&
          !Array.isArray(sourceValue) &&
          typeof targetValue === "object" &&
          targetValue !== null &&
          !Array.isArray(targetValue)
        ) {
          result[key] = this.deepMerge(
            targetValue as Config,
            sourceValue as Config,
          );
        } else {
          result[key] = sourceValue;
        }
      }
    }

    return result;
  }

  toJSON(): Config {
    return { ...this.config };
  }
}

export async function loadConfig(path?: string): Promise<ConfigManager> {
  const manager = new ConfigManager(path);
  await manager.load();
  return manager;
}
