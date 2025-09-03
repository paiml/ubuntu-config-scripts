#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run

/**
 * TypeScript to Ruchy Bridge Transformer
 *
 * Transforms TypeScript code to Ruchy-compatible syntax for gradual migration
 * Part of RUC-002-003: Ruchy-TypeScript Bridge Architecture
 */

import { parseArgs } from "../lib/common.ts";
import { logger } from "../lib/logger.ts";

interface TransformOptions {
  inputFile: string;
  outputFile?: string | undefined;
  ruchyVersion: string;
  validateSyntax: boolean;
  dryRun: boolean;
}

interface SyntaxRule {
  pattern: RegExp;
  replacement: string;
  description: string;
  ruchyVersion: string;
}

class TypeScriptToRuchyTransformer {
  private options: TransformOptions;
  private syntaxRules: SyntaxRule[];

  constructor(options: TransformOptions) {
    this.options = options;
    this.syntaxRules = this.initializeSyntaxRules();
  }

  private initializeSyntaxRules(): SyntaxRule[] {
    return [
      // Function declarations: fn -> fun (Ruchy v0.10.0+)
      {
        pattern: /\bfunction\s+(\w+)/g,
        replacement: "fun $1",
        description: "Convert function keyword to fun",
        ruchyVersion: "0.10.0",
      },
      {
        pattern: /\bconst\s+(\w+)\s*=\s*\(/g,
        replacement: "fun $1(",
        description: "Convert const arrow functions to fun",
        ruchyVersion: "0.10.0",
      },

      // Async functions
      {
        pattern: /\basync\s+function\s+(\w+)/g,
        replacement: "async fun $1",
        description: "Convert async function to async fun",
        ruchyVersion: "0.10.0",
      },

      // Variable declarations: const/let -> let (Ruchy style)
      {
        pattern: /\bconst\s+(\w+)(?!\s*=\s*\()/g,
        replacement: "let $1",
        description: "Convert const to let for variables",
        ruchyVersion: "0.10.0",
      },
      {
        pattern: /\blet\s+(\w+)/g,
        replacement: "let $1",
        description: "Keep let as is",
        ruchyVersion: "0.10.0",
      },

      // Type annotations: remove for now (Ruchy has different type system)
      {
        pattern: /:\s*[A-Za-z_][\w<>\[\]|&,\s]*(?=\s*[=;,)])/g,
        replacement: "",
        description: "Remove TypeScript type annotations",
        ruchyVersion: "0.10.0",
      },

      // Interface declarations: convert to struct (approximation)
      {
        pattern: /\binterface\s+(\w+)/g,
        replacement: "struct $1",
        description: "Convert interface to struct",
        ruchyVersion: "0.10.0",
      },

      // Import statements: adjust for Ruchy module system
      {
        pattern: /\bimport\s+{([^}]+)}\s+from\s+["']([^"']+)["']/g,
        replacement: "use $2::{$1}",
        description: "Convert ES6 imports to Ruchy use statements",
        ruchyVersion: "0.10.0",
      },
      {
        pattern: /\bimport\s+\*\s+as\s+(\w+)\s+from\s+["']([^"']+)["']/g,
        replacement: "use $2 as $1",
        description: "Convert namespace imports",
        ruchyVersion: "0.10.0",
      },

      // Export statements
      {
        pattern: /\bexport\s+\{([^}]+)\}/g,
        replacement: "// export: $1",
        description: "Mark exports for manual handling",
        ruchyVersion: "0.10.0",
      },
      {
        pattern: /\bexport\s+(fun|struct|let)\s+/g,
        replacement: "pub $1 ",
        description: "Convert exports to pub",
        ruchyVersion: "0.10.0",
      },

      // Console logging: println! macro
      {
        pattern: /\bconsole\.log\(/g,
        replacement: "println!(",
        description: "Convert console.log to println! macro",
        ruchyVersion: "0.10.0",
      },
      {
        pattern: /\bconsole\.error\(/g,
        replacement: "eprintln!(",
        description: "Convert console.error to eprintln! macro",
        ruchyVersion: "0.10.0",
      },

      // Template literals to format! macro (basic)
      {
        pattern: /`([^`]*\$\{[^}]+\}[^`]*)`/g,
        replacement: 'format!("/* template literal conversion needed */")',
        description: "Convert template literals to format! macro",
        ruchyVersion: "0.10.0",
      },

      // Arrow functions (simplified conversion)
      {
        pattern: /\(\s*([^)]*)\s*\)\s*=>\s*{/g,
        replacement: "|$1| {",
        description: "Convert arrow functions to closure syntax",
        ruchyVersion: "0.10.0",
      },

      // Array methods (basic mapping)
      {
        pattern: /\.map\(/g,
        replacement: ".iter().map(",
        description: "Convert array map to iterator map",
        ruchyVersion: "0.10.0",
      },
      {
        pattern: /\.filter\(/g,
        replacement: ".iter().filter(",
        description: "Convert array filter to iterator filter",
        ruchyVersion: "0.10.0",
      },

      // String interpolation markers
      {
        pattern: /\$\{([^}]+)\}/g,
        replacement: "{$1}",
        description: "Convert template literal variables",
        ruchyVersion: "0.10.0",
      },
    ];
  }

  async transform(): Promise<string> {
    logger.info(
      `🔄 Transforming TypeScript to Ruchy (v${this.options.ruchyVersion})`,
    );
    logger.info(`📄 Input: ${this.options.inputFile}`);

    let content: string;
    try {
      content = await Deno.readTextFile(this.options.inputFile);
    } catch (error) {
      throw new Error(`Failed to read input file: ${(error as Error).message}`);
    }

    let transformedContent = this.applyTransformations(content);

    // Add Ruchy-specific header
    transformedContent = this.addRuchyHeader() + transformedContent;

    if (this.options.validateSyntax) {
      await this.validateRuchySyntax(transformedContent);
    }

    if (!this.options.dryRun) {
      const outputPath = this.options.outputFile ||
        this.options.inputFile.replace(/\.ts$/, ".ruchy");

      await Deno.writeTextFile(outputPath, transformedContent);
      logger.success(`✅ Transformed file saved: ${outputPath}`);
    } else {
      logger.info("🔍 Dry run - no file written");
    }

    return transformedContent;
  }

  private applyTransformations(content: string): string {
    let result = content;
    let appliedRules = 0;

    for (const rule of this.syntaxRules) {
      const before = result;

      if (typeof rule.replacement === "function") {
        result = result.replace(rule.pattern, rule.replacement);
      } else {
        result = result.replace(rule.pattern, rule.replacement);
      }

      if (result !== before) {
        appliedRules++;
        logger.debug(`Applied: ${rule.description}`);
      }
    }

    logger.info(`📝 Applied ${appliedRules} transformation rules`);
    return result;
  }

  private addRuchyHeader(): string {
    return `// Generated by TypeScript-Ruchy Bridge Transformer
// Original TypeScript: ${this.options.inputFile}
// Target Ruchy version: ${this.options.ruchyVersion}
// Transformation date: ${new Date().toISOString()}
//
// Note: This is an automated transformation. Manual review required.

`;
  }

  private async validateRuchySyntax(content: string): Promise<void> {
    logger.info("🔍 Validating Ruchy syntax...");

    try {
      // Write temporary file for validation
      const tempFile = `/tmp/bridge-validate-${Date.now()}.ruchy`;
      await Deno.writeTextFile(tempFile, content);

      // Run ruchy check command
      const process = new Deno.Command("ruchy", {
        args: ["check", tempFile],
        stdout: "piped",
        stderr: "piped",
      });

      const result = await process.output();

      // Clean up temp file
      try {
        await Deno.remove(tempFile);
      } catch {
        // Ignore cleanup errors
      }

      if (result.code === 0) {
        logger.success("✅ Ruchy syntax validation passed");
      } else {
        const stderr = new TextDecoder().decode(result.stderr);
        logger.warn(`⚠️ Ruchy syntax issues detected:\n${stderr}`);
        logger.warn("Manual review and fixes required");
      }
    } catch (error) {
      logger.warn(
        `⚠️ Could not validate Ruchy syntax: ${(error as Error).message}`,
      );
      logger.info("Ensure 'ruchy' command is available for syntax validation");
    }
  }

  generateReport(): string {
    const report = `
# TypeScript to Ruchy Transformation Report

**Input File**: ${this.options.inputFile}
**Output File**: ${
      this.options.outputFile ||
      this.options.inputFile.replace(/\.ts$/, ".ruchy")
    }
**Ruchy Target Version**: ${this.options.ruchyVersion}
**Transformation Date**: ${new Date().toISOString()}

## Applied Transformations

${
      this.syntaxRules.map((rule) =>
        `- **${rule.description}** (v${rule.ruchyVersion})`
      ).join("\n")
    }

## Manual Review Required

1. **Type Annotations**: TypeScript types removed - add Ruchy type hints
2. **Template Literals**: Complex interpolation may need manual adjustment  
3. **Async/Await**: Verify async patterns work with target Ruchy version
4. **Module Imports**: Adjust paths for Ruchy module system
5. **Error Handling**: Convert try/catch to Ruchy error patterns
6. **Array Methods**: Iterator chains may need collect() calls

## Next Steps

1. Review generated Ruchy code
2. Run \`ruchy check <output-file>\` for syntax validation
3. Add proper type annotations for Ruchy
4. Test functionality against original TypeScript version
5. Update imports/exports for Ruchy module system

## Validation Status

${
      this.options.validateSyntax
        ? "✅ Syntax validation performed"
        : "⚠️ Syntax validation skipped"
    }
`;

    return report;
  }
}

async function main() {
  const args = parseArgs(Deno.args);

  if (args["help"] || args["h"]) {
    console.log(`
TypeScript to Ruchy Bridge Transformer

Usage: bridge-transformer.ts --input <file> [options]

Options:
  --input <file>          TypeScript file to transform (required)
  --output <file>         Output Ruchy file (default: input.ruchy)
  --ruchy-version <ver>   Target Ruchy version (default: 0.10.0)
  --validate              Validate Ruchy syntax after transformation
  --dry-run               Show transformation without writing file
  --report                Generate detailed transformation report
  --help, -h              Show this help message

Examples:
  bridge-transformer.ts --input common.ts --validate
  bridge-transformer.ts --input logger.ts --output logger.ruchy --report
  bridge-transformer.ts --input *.ts --dry-run --ruchy-version 0.11.0
`);
    return;
  }

  const inputFile = args["input"] as string;
  if (!inputFile) {
    logger.error("❌ --input file is required");
    Deno.exit(1);
  }

  const options: TransformOptions = {
    inputFile,
    outputFile: args["output"] ? (args["output"] as string) : undefined,
    ruchyVersion: (args["ruchy-version"] as string) || "0.10.0",
    validateSyntax: !!args["validate"],
    dryRun: !!args["dry-run"],
  };

  try {
    const transformer = new TypeScriptToRuchyTransformer(options);
    const result = await transformer.transform();

    if (args["report"]) {
      const report = transformer.generateReport();
      const reportFile = (inputFile as string).replace(
        /\.ts$/,
        ".transform-report.md",
      );
      await Deno.writeTextFile(reportFile, report);
      logger.info(`📊 Transformation report: ${reportFile}`);
    }

    if (options.dryRun) {
      logger.info("👀 Transformation preview:");
      console.log("─".repeat(60));
      console.log(result);
      console.log("─".repeat(60));
    }

    logger.success("🎉 TypeScript to Ruchy transformation complete!");
  } catch (error) {
    logger.error(`❌ Transformation failed: ${(error as Error).message}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
