export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
  useColors?: boolean;
}

export class Logger {
  private level: LogLevel;
  private prefix: string;
  private useColors: boolean;

  private colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    gray: "\x1b[90m",
  };

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.prefix = options.prefix ?? "";
    this.useColors = options.useColors ?? true;
  }

  private format(level: string, message: string, ...args: unknown[]): string {
    const timestamp = new Date().toISOString();
    const prefix = this.prefix ? `[${this.prefix}] ` : "";
    const formattedArgs = args.length > 0
      ? " " +
        args.map((arg) =>
          typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(" ")
      : "";
    return `${timestamp} ${prefix}[${level}] ${message}${formattedArgs}`;
  }

  private log(
    level: LogLevel,
    levelName: string,
    color: string,
    message: string,
    ...args: unknown[]
  ): void {
    if (level >= this.level) {
      const formatted = this.format(levelName, message, ...args);
      const output = this.useColors
        ? `${color}${formatted}${this.colors.reset}`
        : formatted;

      if (level >= LogLevel.ERROR) {
        console.error(output);
      } else if (level >= LogLevel.WARN) {
        console.warn(output);
      } else {
        console.log(output);
      }
    }
  }

  debug(message: string, ...args: unknown[]): void {
    this.log(LogLevel.DEBUG, "DEBUG", this.colors.gray, message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.log(LogLevel.INFO, "INFO", this.colors.blue, message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log(LogLevel.WARN, "WARN", this.colors.yellow, message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    this.log(LogLevel.ERROR, "ERROR", this.colors.red, message, ...args);
  }

  success(message: string, ...args: unknown[]): void {
    this.log(LogLevel.INFO, "SUCCESS", this.colors.green, message, ...args);
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  child(prefix: string): Logger {
    return new Logger({
      level: this.level,
      prefix: this.prefix ? `${this.prefix}:${prefix}` : prefix,
      useColors: this.useColors,
    });
  }
}

export const logger = new Logger();
