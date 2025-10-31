#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run

/**
 * Schema-Based Test Runner for Ruchy Bug Variants
 *
 * Implements comprehensive testing per RuchyRuchy Whack-A-Mole Guide
 * Generates and runs test variants from YAML schemas using ruchydbg
 *
 * Uses ruchydbg run for proper timeout detection and standardized exit codes:
 * - Exit 0: Test passed
 * - Exit 124: Test timed out
 * - Exit 1+: Test failed or error
 */

import { parse as parseYaml } from "https://deno.land/std@0.224.0/yaml/mod.ts";

interface TestSchema {
  name: string;
  description: string;
  issue_url?: string;
  ruchy_version: string;
  enum_definition: string;
  struct_definition: string;
  variants: TestVariant[];
  stats?: {
    total_variants: number;
    verified_pass: number;
    verified_fail: number;
    untested: number;
    coverage_percent: number;
  };
  test_config?: {
    default_timeout_ms: number;
    parallel_execution: boolean;
    stop_on_first_failure: boolean;
    generate_minimal_reproductions: boolean;
  };
}

interface TestVariant {
  id: string;
  name: string;
  status: "verified_pass" | "verified_fail" | "untested";
  ruchy_version_fixed?: string;
  ruchy_version_tested?: string;
  enabled: boolean;
  expected: "pass" | "fail" | "timeout" | "unknown";
  timeout_ms: number;
  dependencies?: string[];
  impl_method: string;
  test_code: string;
  notes?: string;
}

enum TestResult {
  Pass = "pass",
  Fail = "fail",
  Timeout = "timeout",
  Error = "error",
}

interface TestRun {
  variant_id: string;
  variant_name: string;
  result: TestResult;
  duration_ms: number;
  expected: string;
  matched_expectation: boolean;
  output?: string;
  error?: string;
}

function generateTestFile(schema: TestSchema, variant: TestVariant): string {
  const parts: string[] = [];

  // Add dependencies
  if (variant.dependencies) {
    parts.push(...variant.dependencies);
    parts.push("");
  }

  // Add enum definition
  parts.push(schema.enum_definition.trim());
  parts.push("");

  // Add struct definition
  parts.push(schema.struct_definition.trim());
  parts.push("");

  // Add impl block
  parts.push("impl Logger {");
  parts.push(variant.impl_method.trim());
  parts.push("}");
  parts.push("");

  // Add main function
  parts.push("fun main() {");
  parts.push(variant.test_code.trim());
  parts.push("}");

  return parts.join("\n");
}

async function runTest(
  code: string,
  timeout_ms: number,
): Promise<{ result: TestResult; duration_ms: number; output?: string; error?: string }> {
  const start = Date.now();

  try {
    // Write code to temporary file
    const tempFile = await Deno.makeTempFile({ suffix: ".ruchy" });
    await Deno.writeTextFile(tempFile, code);

    try {
      // Use ruchydbg run with built-in timeout detection
      // Exit codes: 0=success, 124=timeout, 1+=error
      const command = new Deno.Command("ruchydbg", {
        args: ["run", tempFile, "--timeout", timeout_ms.toString()],
        stdout: "piped",
        stderr: "piped",
      });

      const process = command.spawn();
      const { code: exitCode, stdout, stderr } = await process.output();

      const duration_ms = Date.now() - start;
      const output = new TextDecoder().decode(stdout);
      const error = new TextDecoder().decode(stderr);

      // Handle exit codes per ruchydbg spec
      if (exitCode === 0) {
        return { result: TestResult.Pass, duration_ms, output };
      } else if (exitCode === 124) {
        return { result: TestResult.Timeout, duration_ms };
      } else {
        return { result: TestResult.Fail, duration_ms, output, error };
      }
    } catch (error) {
      const duration_ms = Date.now() - start;
      return { result: TestResult.Error, duration_ms, error: error.toString() };
    } finally {
      try {
        await Deno.remove(tempFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  } catch (error) {
    return { result: TestResult.Error, duration_ms: Date.now() - start, error: error.toString() };
  }
}

function matchesExpectation(result: TestResult, expected: string): boolean {
  switch (expected) {
    case "pass":
      return result === TestResult.Pass;
    case "fail":
      return result === TestResult.Fail;
    case "timeout":
      return result === TestResult.Timeout;
    case "unknown":
      return true; // Any result is acceptable for unknown
    default:
      return false;
  }
}

function getStatusEmoji(result: TestResult, matched: boolean): string {
  if (matched) {
    return "✅";
  }

  switch (result) {
    case TestResult.Pass:
      return "⚠️ ";
    case TestResult.Fail:
      return "❌";
    case TestResult.Timeout:
      return "⏱️ ";
    case TestResult.Error:
      return "💥";
    default:
      return "❓";
  }
}

async function main() {
  const args = Deno.args;
  if (args.length === 0) {
    console.error("Usage: schema-test-runner.ts <schema-file.yaml>");
    console.error("Example: schema-test-runner.ts schemas/issue79_comprehensive.yaml");
    Deno.exit(1);
  }

  const schemaFile = args[0];

  // Load schema
  console.log("Loading schema:", schemaFile);
  const schemaYaml = await Deno.readTextFile(schemaFile);
  const schema = parseYaml(schemaYaml) as TestSchema;

  console.log("");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📋 ${schema.name}`);
  console.log(`   ${schema.description}`);
  if (schema.issue_url) {
    console.log(`   Issue: ${schema.issue_url}`);
  }
  console.log(`   Ruchy Version: ${schema.ruchy_version}`);
  console.log(`   Total Variants: ${schema.variants.length}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");

  const results: TestRun[] = [];
  const enabledVariants = schema.variants.filter((v) => v.enabled);

  console.log(`Running ${enabledVariants.length} enabled variants...\n`);

  for (const variant of enabledVariants) {
    const statusText = `[${variant.status}]`.padEnd(20);
    process.stdout.write(`🧪 ${statusText} ${variant.name}... `);

    // Generate test code
    const code = generateTestFile(schema, variant);

    // Run test
    const { result, duration_ms, output, error } = await runTest(code, variant.timeout_ms);

    // Check expectation
    const matched = matchesExpectation(result, variant.expected);
    const emoji = getStatusEmoji(result, matched);

    const testRun: TestRun = {
      variant_id: variant.id,
      variant_name: variant.name,
      result,
      duration_ms,
      expected: variant.expected,
      matched_expectation: matched,
      output,
      error,
    };

    results.push(testRun);

    // Print result
    console.log(`${emoji} ${result.toUpperCase()} (${duration_ms}ms)`);

    // Print unexpected results
    if (!matched && variant.expected !== "unknown") {
      console.log(`   ⚠️  Expected: ${variant.expected}, Got: ${result}`);
    }

    // Print error details for failures
    if (result === TestResult.Error && error) {
      console.log(`   Error: ${error.split("\n")[0]}`);
    }
  }

  // Summary
  console.log("");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 Summary");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const passed = results.filter((r) => r.result === TestResult.Pass).length;
  const failed = results.filter((r) => r.result === TestResult.Fail).length;
  const timeout = results.filter((r) => r.result === TestResult.Timeout).length;
  const error = results.filter((r) => r.result === TestResult.Error).length;
  const total = results.length;

  const matchedExpectations = results.filter((r) => r.matched_expectation).length;

  console.log(`  ✅ Passed:              ${passed}`);
  console.log(`  ❌ Failed:              ${failed}`);
  console.log(`  ⏱️  Timeout:             ${timeout}`);
  console.log(`  💥 Error:               ${error}`);
  console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  📈 Total Tested:        ${total}`);
  console.log(`  🎯 Matched Expected:    ${matchedExpectations}/${total}`);
  console.log(`  📊 Pass Rate:           ${((passed / total) * 100).toFixed(1)}%`);

  // Status-based breakdown
  console.log("");
  console.log("By Status:");
  const byStatus = {
    verified_pass: results.filter((r) =>
      schema.variants.find((v) => v.id === r.variant_id)?.status === "verified_pass"
    ),
    verified_fail: results.filter((r) =>
      schema.variants.find((v) => v.id === r.variant_id)?.status === "verified_fail"
    ),
    untested: results.filter((r) =>
      schema.variants.find((v) => v.id === r.variant_id)?.status === "untested"
    ),
  };

  console.log(`  Previously Verified Pass: ${byStatus.verified_pass.length}`);
  console.log(`  Previously Verified Fail: ${byStatus.verified_fail.length}`);
  console.log(`  Previously Untested:      ${byStatus.untested.length}`);

  // New discoveries
  const newFailures = byStatus.verified_pass.filter((r) => r.result !== TestResult.Pass);
  const newPasses = byStatus.untested.filter((r) => r.result === TestResult.Pass);

  if (newFailures.length > 0) {
    console.log("");
    console.log(`🚨 REGRESSIONS DETECTED: ${newFailures.length} previously passing variants now fail!`);
    newFailures.forEach((r) => {
      console.log(`   - ${r.variant_name} (${r.result})`);
    });
  }

  if (newPasses.length > 0) {
    console.log("");
    console.log(`🎉 NEW FIXES: ${newPasses.length} previously untested variants now pass!`);
    newPasses.forEach((r) => {
      console.log(`   - ${r.variant_name}`);
    });
  }

  // Final verdict
  console.log("");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  if (passed === total) {
    console.log("🎉 ALL VARIANTS PASS!");
    console.log("✅ Issue can be closed - 100% coverage verified");
  } else {
    const broken = total - passed;
    console.log(`🚨 ${broken} variant${broken > 1 ? "s" : ""} still broken`);
    console.log(`⚠️  DO NOT CLOSE ISSUE - Only ${((passed / total) * 100).toFixed(1)}% verified`);
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Exit code: 0 if all pass, 1 if any fail
  Deno.exit(passed === total ? 0 : 1);
}

if (import.meta.main) {
  main();
}
