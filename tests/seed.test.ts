import {
  assertEquals,
} from "../deps.ts";
import {
  parseArgs,
  formatStatistics,
} from "../scripts/seed.ts";

// Unit tests for seed CLI
// RED phase - these tests should FAIL initially

Deno.test("parseArgs - parses default args", () => {
  const args: string[] = [];
  const result = parseArgs(args);

  assertEquals(result.directory, "./scripts");
  assertEquals(result.force, false);
  assertEquals(result.showHelp, false);
});

Deno.test("parseArgs - parses --directory flag", () => {
  const args = ["--directory=./scripts/audio"];
  const result = parseArgs(args);

  assertEquals(result.directory, "./scripts/audio");
});

Deno.test("parseArgs - parses --force flag", () => {
  const args = ["--force"];
  const result = parseArgs(args);

  assertEquals(result.force, true);
});

Deno.test("parseArgs - handles multiple flags", () => {
  const args = ["--directory=./custom", "--force"];
  const result = parseArgs(args);

  assertEquals(result.directory, "./custom");
  assertEquals(result.force, true);
});

Deno.test("parseArgs - detects --help flag", () => {
  const args = ["--help"];
  const result = parseArgs(args);

  assertEquals(result.showHelp, true);
});

Deno.test("parseArgs - detects -h flag", () => {
  const args = ["-h"];
  const result = parseArgs(args);

  assertEquals(result.showHelp, true);
});

Deno.test("formatStatistics - formats seeding results", () => {
  const stats = {
    processed: 42,
    inserted: 42,
    updated: 0,
    failed: 0,
    totalTokens: 4250,
    categories: {
      audio: 15,
      system: 18,
      dev: 9,
    },
    durationMs: 45200,
  };

  const output = formatStatistics(stats);

  assertEquals(output.includes("42"), true);
  assertEquals(output.includes("audio: 15"), true);
  assertEquals(output.includes("system: 18"), true);
  assertEquals(output.includes("dev: 9"), true);
  assertEquals(output.includes("4,250"), true);
  assertEquals(output.includes("45.2s"), true);
});

Deno.test("formatStatistics - handles errors", () => {
  const stats = {
    processed: 50,
    inserted: 45,
    updated: 0,
    failed: 5,
    totalTokens: 5000,
    categories: {
      audio: 20,
      system: 25,
    },
    durationMs: 60000,
  };

  const output = formatStatistics(stats);

  assertEquals(output.includes("50"), true);
  assertEquals(output.includes("45"), true);
  assertEquals(output.includes("5"), true);
});

Deno.test("formatStatistics - formats time correctly", () => {
  const stats1 = {
    processed: 10,
    inserted: 10,
    updated: 0,
    failed: 0,
    totalTokens: 100,
    categories: { test: 10 },
    durationMs: 1500,
  };

  const output1 = formatStatistics(stats1);
  assertEquals(output1.includes("1.5s"), true);

  const stats2 = {
    processed: 10,
    inserted: 10,
    updated: 0,
    failed: 0,
    totalTokens: 100,
    categories: { test: 10 },
    durationMs: 500,
  };

  const output2 = formatStatistics(stats2);
  assertEquals(output2.includes("0.5s"), true);
});

Deno.test("formatStatistics - shows updated count", () => {
  const stats = {
    processed: 20,
    inserted: 15,
    updated: 5,
    failed: 0,
    totalTokens: 2000,
    categories: { audio: 10, system: 10 },
    durationMs: 30000,
  };

  const output = formatStatistics(stats);

  assertEquals(output.includes("15"), true); // inserted
  assertEquals(output.includes("5"), true); // updated
});

Deno.test("formatStatistics - formats token count with comma", () => {
  const stats = {
    processed: 100,
    inserted: 100,
    updated: 0,
    failed: 0,
    totalTokens: 12345,
    categories: { test: 100 },
    durationMs: 60000,
  };

  const output = formatStatistics(stats);

  assertEquals(output.includes("12,345"), true);
});
