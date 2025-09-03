import { assertEquals } from "@std/testing/asserts.ts";
import { describe, it } from "@std/testing/bdd.ts";
import { spy } from "@std/testing/mock.ts";
import { Logger, LogLevel } from "../../scripts/lib/logger.ts";

describe("Logger", () => {
  describe("log levels", () => {
    it("should only log messages at or above the set level", () => {
      const logger = new Logger({ level: LogLevel.WARN, useColors: false });
      const consoleSpy = spy(console, "log");
      const warnSpy = spy(console, "warn");
      const errorSpy = spy(console, "error");

      try {
        logger.debug("debug message");
        logger.info("info message");
        logger.warn("warn message");
        logger.error("error message");

        assertEquals(consoleSpy.calls.length, 0);
        assertEquals(warnSpy.calls.length, 1);
        assertEquals(errorSpy.calls.length, 1);
      } finally {
        consoleSpy.restore();
        warnSpy.restore();
        errorSpy.restore();
      }
    });
  });

  describe("formatting", () => {
    it("should format messages with timestamp and level", () => {
      const logger = new Logger({ useColors: false });
      const consoleSpy = spy(console, "log");
      const originalDate = globalThis.Date;
      globalThis.Date = class extends originalDate {
        override toISOString(): string {
          return "2024-01-01T00:00:00.000Z";
        }
      } as DateConstructor;

      try {
        logger.info("test message");

        const call = consoleSpy.calls[0];
        const output = call?.args[0] as string;

        assertEquals(output.includes("2024-01-01T00:00:00.000Z"), true);
        assertEquals(output.includes("[INFO]"), true);
        assertEquals(output.includes("test message"), true);
      } finally {
        consoleSpy.restore();
        globalThis.Date = originalDate;
      }
    });

    it("should include prefix when provided", () => {
      const logger = new Logger({ prefix: "TestModule", useColors: false });
      const consoleSpy = spy(console, "log");

      try {
        logger.info("test message");

        const call = consoleSpy.calls[0];
        const output = call?.args[0] as string;

        assertEquals(output.includes("[TestModule]"), true);
      } finally {
        consoleSpy.restore();
      }
    });

    it("should format additional arguments", () => {
      const logger = new Logger({ useColors: false });
      const consoleSpy = spy(console, "log");

      try {
        logger.info("test", { key: "value" }, 123);

        const call = consoleSpy.calls[0];
        const output = call?.args[0] as string;

        assertEquals(output.includes('"key": "value"'), true);
        assertEquals(output.includes("123"), true);
      } finally {
        consoleSpy.restore();
      }
    });
  });

  describe("child loggers", () => {
    it("should create child logger with combined prefix", () => {
      const parent = new Logger({ prefix: "Parent", useColors: false });
      const child = parent.child("Child");
      const consoleSpy = spy(console, "log");

      try {
        child.info("test message");

        const call = consoleSpy.calls[0];
        const output = call?.args[0] as string;

        assertEquals(output.includes("[Parent:Child]"), true);
      } finally {
        consoleSpy.restore();
      }
    });

    it("should inherit parent log level", () => {
      const parent = new Logger({ level: LogLevel.ERROR });
      const child = parent.child("Child");
      const consoleSpy = spy(console, "log");
      const errorSpy = spy(console, "error");

      try {
        child.info("should not appear");
        child.error("should appear");

        assertEquals(consoleSpy.calls.length, 0);
        assertEquals(errorSpy.calls.length, 1);
      } finally {
        consoleSpy.restore();
        errorSpy.restore();
      }
    });
  });

  describe("success method", () => {
    it("should log success messages at info level", () => {
      const logger = new Logger({ level: LogLevel.INFO, useColors: false });
      const consoleSpy = spy(console, "log");

      try {
        logger.success("operation completed");

        assertEquals(consoleSpy.calls.length, 1);
        const output = consoleSpy.calls[0]?.args[0] as string;
        assertEquals(output.includes("[SUCCESS]"), true);
        assertEquals(output.includes("operation completed"), true);
      } finally {
        consoleSpy.restore();
      }
    });
  });

  describe("setLevel", () => {
    it("should change log level dynamically", () => {
      const logger = new Logger({ level: LogLevel.ERROR });
      const consoleSpy = spy(console, "log");

      try {
        logger.info("should not appear");
        assertEquals(consoleSpy.calls.length, 0);

        logger.setLevel(LogLevel.INFO);
        logger.info("should appear");
        assertEquals(consoleSpy.calls.length, 1);
      } finally {
        consoleSpy.restore();
      }
    });
  });
});
