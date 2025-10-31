#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run

/**
 * Automatically fix bashrs warnings in Makefiles
 *
 * Fixes:
 * - MAKE007: Add @ prefix to echo commands in conditionals
 * - MAKE004: Add missing targets to .PHONY
 * - MAKE013: Add .SUFFIXES: to disable built-in rules
 */

import { Logger } from "../lib/logger.ts";

const logger = new Logger({ prefix: "fix-makefiles" });

interface Fix {
  file: string;
  line: number;
  type: string;
  original: string;
  fixed: string;
}

async function getMakefiles(): Promise<string[]> {
  const makefiles: string[] = [];

  // Find all Makefiles
  for await (const entry of Deno.readDir(".")) {
    if (
      entry.isFile &&
      (entry.name === "Makefile" || entry.name.startsWith("Makefile."))
    ) {
      makefiles.push(entry.name);
    }
  }

  // Add nested Makefiles
  const nestedDirs = ["ruchy", "ruchy-scripts"];
  for (const dir of nestedDirs) {
    try {
      for await (const entry of Deno.readDir(dir)) {
        if (
          entry.isFile &&
          (entry.name === "Makefile" || entry.name.startsWith("Makefile."))
        ) {
          makefiles.push(`${dir}/${entry.name}`);
        }
      }
    } catch {
      // Directory doesn't exist, skip
    }
  }

  return makefiles;
}

async function fixMakefile(path: string): Promise<Fix[]> {
  logger.info(`Processing ${path}...`);

  const content = await Deno.readTextFile(path);
  const lines = content.split("\n");
  const fixes: Fix[] = [];
  let modified = false;

  // Fix 1: Add .SUFFIXES: at the top if missing
  if (!content.includes(".SUFFIXES:")) {
    const insertIndex = lines.findIndex((line) =>
      line.startsWith("#") || line.trim() === ""
    );
    if (insertIndex !== -1) {
      // Find the end of header comments
      let headerEnd = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i]!.startsWith("#") || lines[i]!.trim() === "") {
          headerEnd = i;
        } else {
          break;
        }
      }

      lines.splice(headerEnd + 1, 0, ".SUFFIXES:");
      fixes.push({
        file: path,
        line: headerEnd + 1,
        type: "MAKE013",
        original: "(missing)",
        fixed: ".SUFFIXES:",
      });
      modified = true;
    }
  }

  // Fix 2: Add @ prefix to echo commands in conditionals
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    // Match echo commands without @ in shell conditionals
    // Pattern: tabs/spaces + echo (without @)
    if (/^\s+echo\s/.test(line) && !/^\s+@echo/.test(line)) {
      // Only fix if it's inside a conditional (has more than one tab)
      if (/^\t\t+echo/.test(line) || /^\t\s+echo/.test(line)) {
        const fixed = line.replace(/^(\t+)echo/, "$1@echo");
        fixes.push({
          file: path,
          line: i + 1,
          type: "MAKE007",
          original: line,
          fixed: fixed,
        });
        lines[i] = fixed;
        modified = true;
      }
    }
  }

  // Fix 3: Collect all target names and update .PHONY
  const targets: string[] = [];
  for (const line of lines) {
    // Match target definitions: name: or name:: (but not variable assignments)
    const match = line.match(/^([a-zA-Z][a-zA-Z0-9_-]*)\s*:/);
    if (match && !line.includes("=") && !line.includes(".PHONY")) {
      const target = match[1]!;
      // Skip automatic variables and special targets
      if (!target.startsWith(".") && target !== "PHONY") {
        targets.push(target);
      }
    }
  }

  // Find .PHONY declaration and update it
  const phonyIndex = lines.findIndex((line) => line.startsWith(".PHONY:"));
  if (phonyIndex !== -1) {
    // Collect all existing phony targets
    let phonyTargets = new Set<string>();
    let currentIndex = phonyIndex;

    while (currentIndex < lines.length) {
      const line = lines[currentIndex]!;
      if (line.startsWith(".PHONY:") || line.match(/^\t/)) {
        const targetsInLine = line
          .replace(/^\.PHONY:\s*/, "")
          .replace(/^\t/, "")
          .replace(/\s*\\$/, "")
          .split(/\s+/)
          .filter((t) => t.length > 0);

        targetsInLine.forEach((t) => phonyTargets.add(t));

        if (!line.endsWith("\\")) {
          break;
        }
        currentIndex++;
      } else {
        break;
      }
    }

    // Add missing targets
    const missingTargets = targets.filter((t) => !phonyTargets.has(t));
    if (missingTargets.length > 0) {
      missingTargets.forEach((t) => phonyTargets.add(t));

      // Rebuild .PHONY declaration
      const allPhony = Array.from(phonyTargets).sort();
      const phonyLines = [".PHONY: " + allPhony.join(" \\\n\t")];

      // Replace old .PHONY block
      const endIndex = currentIndex;
      lines.splice(phonyIndex, endIndex - phonyIndex + 1, ...phonyLines);

      fixes.push({
        file: path,
        line: phonyIndex + 1,
        type: "MAKE004",
        original: `.PHONY: (${
          phonyTargets.size - missingTargets.length
        } targets)`,
        fixed:
          `.PHONY: (${phonyTargets.size} targets, added ${missingTargets.length})`,
      });
      modified = true;
    }
  }

  // Write back if modified
  if (modified) {
    await Deno.writeTextFile(path, lines.join("\n"));
    logger.success(`Fixed ${fixes.length} issues in ${path}`);
  } else {
    logger.info(`No fixes needed for ${path}`);
  }

  return fixes;
}

async function main(): Promise<void> {
  logger.info("Starting Makefile auto-fix...");

  const makefiles = await getMakefiles();
  logger.info(`Found ${makefiles.length} Makefiles`);

  const allFixes: Fix[] = [];

  for (const makefile of makefiles) {
    try {
      const fixes = await fixMakefile(makefile);
      allFixes.push(...fixes);
    } catch (error) {
      logger.error(`Failed to fix ${makefile}: ${error}`);
    }
  }

  logger.success(
    `Applied ${allFixes.length} fixes across ${makefiles.length} Makefiles`,
  );

  // Show summary
  const byType: Record<string, number> = {};
  for (const fix of allFixes) {
    byType[fix.type] = (byType[fix.type] || 0) + 1;
  }

  logger.info("Fixes by type:");
  for (const [type, count] of Object.entries(byType)) {
    logger.info(`  ${type}: ${count} fixes`);
  }

  logger.info(
    "\nRun 'bashrs make lint <makefile>' to verify remaining warnings",
  );
}

if (import.meta.main) {
  await main();
}
