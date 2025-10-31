#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run

/**
 * TypeScript-Ruchy Bridge Validator
 *
 * Validates feature parity between TypeScript and Ruchy implementations
 * Part of RUC-002-003: Ruchy-TypeScript Bridge Architecture
 */

import { parseArgs } from "../lib/common.ts";
import { logger } from "../lib/logger.ts";
import { runCommand } from "../lib/common.ts";

interface ValidationConfig {
  typescriptFile: string;
  ruchyFile: string;
  testCases: string[];
  timeout: number;
  verbose: boolean;
}

interface ValidationResult {
  testCase: string;
  typescriptResult: TestResult;
  ruchyResult: TestResult;
  passed: boolean;
  details: string;
}

interface TestResult {
  success: boolean;
  output: string;
  error?: string | undefined;
  executionTime: number;
}

class BridgeValidator {
  private config: ValidationConfig;
  private results: ValidationResult[] = [];

  constructor(config: ValidationConfig) {
    this.config = config;
  }

  async validateFeatureParity(): Promise<ValidationResult[]> {
    logger.info("🧪 Starting TypeScript-Ruchy bridge validation");
    logger.info(`📄 TypeScript: ${this.config.typescriptFile}`);
    logger.info(`🦀 Ruchy: ${this.config.ruchyFile}`);

    for (const testCase of this.config.testCases) {
      logger.info(`\n🔍 Testing: ${testCase}`);

      const result = await this.runValidationTest(testCase);
      this.results.push(result);

      const status = result.passed ? "✅ PASS" : "❌ FAIL";
      logger.info(`${status}: ${testCase}`);

      if (this.config.verbose && !result.passed) {
        logger.warn(`Details: ${result.details}`);
      }
    }

    return this.results;
  }

  private async runValidationTest(testCase: string): Promise<ValidationResult> {
    // const startTime = Date.now(); // Not used

    // Run TypeScript version
    const typescriptResult = await this.runTypeScript(testCase);

    // Run Ruchy version
    const ruchyResult = await this.runRuchy(testCase);

    // Compare results
    const passed = this.compareResults(typescriptResult, ruchyResult);
    const details = this.generateComparisonDetails(
      typescriptResult,
      ruchyResult,
    );

    return {
      testCase,
      typescriptResult,
      ruchyResult,
      passed,
      details,
    };
  }

  private async runTypeScript(testCase: string): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const result = await runCommand([
        "deno",
        "run",
        "--allow-all",
        this.config.typescriptFile,
        "--test-case",
        testCase,
      ], {
        cwd: ".",
      });

      return {
        success: result.success,
        output: result.stdout.trim(),
        error: result.success ? undefined : result.stderr.trim(),
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        output: "",
        error: `Execution failed: ${(error as Error).message}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async runRuchy(testCase: string): Promise<TestResult> {
    const startTime = Date.now();

    try {
      // First check if Ruchy file compiles
      const checkResult = await runCommand([
        "ruchy",
        "check",
        this.config.ruchyFile,
      ], {});

      if (!checkResult.success) {
        return {
          success: false,
          output: "",
          error: `Compilation failed: ${checkResult.stderr}`,
          executionTime: Date.now() - startTime,
        };
      }

      // Run the Ruchy script
      const result = await runCommand([
        "ruchy",
        "run",
        this.config.ruchyFile,
        "--test-case",
        testCase,
      ], {
        cwd: ".",
      });

      return {
        success: result.success,
        output: result.stdout.trim(),
        error: result.success ? undefined : result.stderr.trim(),
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        output: "",
        error: `Execution failed: ${(error as Error).message}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private compareResults(
    tsResult: TestResult,
    ruchyResult: TestResult,
  ): boolean {
    // Both should succeed or both should fail
    if (tsResult.success !== ruchyResult.success) {
      return false;
    }

    // If both failed, compare error patterns (simplified)
    if (!tsResult.success && !ruchyResult.success) {
      // Allow different error messages as long as both failed appropriately
      return true;
    }

    // If both succeeded, compare outputs
    if (tsResult.success && ruchyResult.success) {
      return this.normalizeOutput(tsResult.output) ===
        this.normalizeOutput(ruchyResult.output);
    }

    return false;
  }

  private normalizeOutput(output: string): string {
    return output
      .replace(/\r\n/g, "\n") // Normalize line endings
      .replace(/\s+$/gm, "") // Remove trailing whitespace
      .trim();
  }

  private generateComparisonDetails(
    tsResult: TestResult,
    ruchyResult: TestResult,
  ): string {
    const details = [];

    if (tsResult.success !== ruchyResult.success) {
      details.push(
        `Exit status mismatch: TS=${tsResult.success}, Ruchy=${ruchyResult.success}`,
      );
    }

    if (tsResult.success && ruchyResult.success) {
      const tsOut = this.normalizeOutput(tsResult.output);
      const ruchyOut = this.normalizeOutput(ruchyResult.output);

      if (tsOut !== ruchyOut) {
        details.push(`Output mismatch:`);
        details.push(`  TS: "${tsOut}"`);
        details.push(`  Ruchy: "${ruchyOut}"`);
      }
    }

    if (tsResult.error || ruchyResult.error) {
      details.push(`Errors:`);
      if (tsResult.error) details.push(`  TS: ${tsResult.error}`);
      if (ruchyResult.error) details.push(`  Ruchy: ${ruchyResult.error}`);
    }

    details.push(
      `Execution time: TS=${tsResult.executionTime}ms, Ruchy=${ruchyResult.executionTime}ms`,
    );

    return details.join("\n");
  }

  generateReport(): string {
    const passed = this.results.filter((r) => r.passed).length;
    const total = this.results.length;
    const percentage = total > 0 ? Math.round((passed / total) * 100) : 0;

    const status = percentage === 100
      ? "✅ COMPLETE PARITY"
      : percentage >= 80
      ? "⚠️ MOSTLY COMPATIBLE"
      : "❌ INCOMPATIBLE";

    let report = `
# TypeScript-Ruchy Bridge Validation Report

**Validation Date**: ${new Date().toISOString()}
**TypeScript File**: ${this.config.typescriptFile}
**Ruchy File**: ${this.config.ruchyFile}

## Summary

**Status**: ${status}
**Passed**: ${passed}/${total} tests (${percentage}%)

## Test Results

`;

    for (const result of this.results) {
      const status = result.passed ? "✅" : "❌";
      report += `### ${status} ${result.testCase}\n\n`;

      if (!result.passed) {
        report += `**Issue**: ${result.details}\n\n`;
      }

      report += `- **TypeScript**: ${
        result.typescriptResult.success ? "Success" : "Failed"
      } (${result.typescriptResult.executionTime}ms)\n`;
      report += `- **Ruchy**: ${
        result.ruchyResult.success ? "Success" : "Failed"
      } (${result.ruchyResult.executionTime}ms)\n\n`;
    }

    if (percentage < 100) {
      report += `
## Recommendations

1. **Fix failing tests** before production deployment
2. **Review error handling** patterns between implementations  
3. **Validate output formatting** consistency
4. **Performance tuning** if execution time differs significantly
5. **Manual testing** for edge cases not covered by automated tests

`;
    }

    report += `
## Next Steps

${
      percentage === 100
        ? "- ✅ Bridge validation passed - ready for production deployment"
        : "- ❌ Address failing tests before deployment"
    }
- 🔄 Run validation periodically as code evolves
- 📊 Add more test cases for comprehensive coverage
- 🔍 Monitor performance differences over time

`;

    return report;
  }

  async generateDetailedReport(outputPath: string): Promise<void> {
    const report = this.generateReport();
    await Deno.writeTextFile(outputPath, report);
    logger.success(`📊 Detailed validation report: ${outputPath}`);
  }
}

async function main() {
  const args = parseArgs(Deno.args);

  if (args["help"] || args["h"]) {
    console.log(`
TypeScript-Ruchy Bridge Validator

Usage: bridge-validator.ts --typescript <file> --ruchy <file> [options]

Options:
  --typescript <file>     TypeScript implementation file (required)
  --ruchy <file>         Ruchy implementation file (required)  
  --test-cases <cases>   Comma-separated test cases (default: basic tests)
  --timeout <ms>         Test timeout in milliseconds (default: 30000)
  --report <file>        Generate detailed report file
  --verbose, -v          Show detailed output for failures
  --help, -h             Show this help message

Examples:
  bridge-validator.ts --typescript common.ts --ruchy common.ruchy
  bridge-validator.ts --ts logger.ts --ruchy logger.ruchy --test-cases "basic,error,performance"
  bridge-validator.ts --typescript script.ts --ruchy script.ruchy --report validation.md --verbose
`);
    return;
  }

  const typescriptFile = args["typescript"] || args["ts"];
  const ruchyFile = args["ruchy"];

  if (!typescriptFile || !ruchyFile) {
    logger.error("❌ Both --typescript and --ruchy files are required");
    Deno.exit(1);
  }

  const testCasesStr = (args["test-cases"] as string) ||
    "basic,error,performance,edge-cases";
  const testCases = testCasesStr.split(",").map((s: string) => s.trim());

  const config: ValidationConfig = {
    typescriptFile: typescriptFile as string,
    ruchyFile: ruchyFile as string,
    testCases,
    timeout: parseInt((args["timeout"] as string) || "30000"),
    verbose: !!(args["verbose"] || args["v"]),
  };

  try {
    const validator = new BridgeValidator(config);
    const results = await validator.validateFeatureParity();

    // Print summary
    const passed = results.filter((r) => r.passed).length;
    const total = results.length;
    const percentage = Math.round((passed / total) * 100);

    console.log("\n" + "=".repeat(60));
    logger.info(
      `🎯 Validation Summary: ${passed}/${total} tests passed (${percentage}%)`,
    );

    if (percentage === 100) {
      logger.success("🎉 Complete feature parity achieved!");
    } else if (percentage >= 80) {
      logger.warn("⚠️ Mostly compatible - some issues to address");
    } else {
      logger.error("❌ Significant compatibility issues detected");
    }

    // Generate report if requested
    if (args["report"]) {
      await validator.generateDetailedReport(args["report"] as string);
    }

    // Exit with error if validation failed
    if (percentage < 100) {
      Deno.exit(1);
    }
  } catch (error) {
    logger.error(`❌ Validation failed: ${(error as Error).message}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
