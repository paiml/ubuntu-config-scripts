import { assertEquals, assertExists, assertRejects } from "../../deps.ts";
import { ScriptAnalyzer } from "../../scripts/lib/script-analyzer.ts";

// Unit tests for ScriptAnalyzer
// RED phase - these tests should FAIL initially

Deno.test("ScriptAnalyzer - constructor creates instance", () => {
  const analyzer = new ScriptAnalyzer();
  assertExists(analyzer);
});

Deno.test("ScriptAnalyzer - extractDescription finds JSDoc comment", () => {
  const analyzer = new ScriptAnalyzer();

  const content = `
/**
 * This is a test script that does something useful.
 * It has multiple lines of description.
 */

export function main() {
  // code here
}
`;

  const description = analyzer.extractDescription(content);
  assertEquals(
    description,
    "This is a test script that does something useful. It has multiple lines of description.",
  );
});

Deno.test("ScriptAnalyzer - extractDescription finds file header comment", () => {
  const analyzer = new ScriptAnalyzer();

  const content = `
// Script: Audio configuration tool
// Description: Configures audio settings for the system

export function configure() {
  // code
}
`;

  const description = analyzer.extractDescription(content);
  assertEquals(description, "Configures audio settings for the system");
});

Deno.test("ScriptAnalyzer - extractDescription returns empty for no comments", () => {
  const analyzer = new ScriptAnalyzer();

  const content = `
export function main() {
  console.log("no description");
}
`;

  const description = analyzer.extractDescription(content);
  assertEquals(description, "");
});

Deno.test("ScriptAnalyzer - extractUsage finds usage section", () => {
  const analyzer = new ScriptAnalyzer();

  const content = `
/**
 * Audio configuration script
 *
 * Usage:
 *   deno run --allow-all configure-audio.ts
 *   deno run --allow-all configure-audio.ts --device=default
 */

export function main() {}
`;

  const usage = analyzer.extractUsage(content);
  assertEquals(
    usage,
    "deno run --allow-all configure-audio.ts\ndeno run --allow-all configure-audio.ts --device=default",
  );
});

Deno.test("ScriptAnalyzer - extractUsage returns empty when no usage found", () => {
  const analyzer = new ScriptAnalyzer();

  const content = `
/**
 * Simple script
 */
export function main() {}
`;

  const usage = analyzer.extractUsage(content);
  assertEquals(usage, "");
});

Deno.test("ScriptAnalyzer - extractDependencies finds import statements", () => {
  const analyzer = new ScriptAnalyzer();

  const content = `
import { logger } from "../lib/logger.ts";
import { runCommand } from "../lib/common.ts";
import { z } from "../../deps.ts";

export function main() {}
`;

  const dependencies = analyzer.extractDependencies(content);
  assertEquals(dependencies, [
    "../lib/logger.ts",
    "../lib/common.ts",
    "../../deps.ts",
  ]);
});

Deno.test("ScriptAnalyzer - extractDependencies handles various import styles", () => {
  const analyzer = new ScriptAnalyzer();

  const content = `
import { foo } from "./foo.ts";
import * as bar from "./bar.ts";
import type { Baz } from "./baz.ts";
import "./side-effect.ts";

export function main() {}
`;

  const dependencies = analyzer.extractDependencies(content);
  assertEquals(dependencies, [
    "./foo.ts",
    "./bar.ts",
    "./baz.ts",
    "./side-effect.ts",
  ]);
});

Deno.test("ScriptAnalyzer - extractDependencies returns empty array for no imports", () => {
  const analyzer = new ScriptAnalyzer();

  const content = `
export function main() {
  console.log("no imports");
}
`;

  const dependencies = analyzer.extractDependencies(content);
  assertEquals(dependencies, []);
});

Deno.test("ScriptAnalyzer - generateTags extracts relevant keywords", () => {
  const analyzer = new ScriptAnalyzer();

  const content = `
/**
 * Audio configuration script
 * Configures PulseAudio and PipeWire settings
 */

export function configureAudio() {
  // Configure audio settings
}
`;

  const tags = analyzer.generateTags(content);
  assertEquals(tags.includes("audio"), true);
  assertEquals(tags.includes("configuration"), true);
});

Deno.test("ScriptAnalyzer - generateTags returns common terms", () => {
  const analyzer = new ScriptAnalyzer();

  const content = `
/**
 * GPU configuration for NVIDIA drivers
 */
export function configureGPU() {}
`;

  const tags = analyzer.generateTags(content);
  assertEquals(tags.includes("gpu"), true);
  assertEquals(tags.includes("nvidia"), true);
  assertEquals(tags.includes("drivers"), true);
});

Deno.test("ScriptAnalyzer - inferCategory from audio path", () => {
  const analyzer = new ScriptAnalyzer();

  const category = analyzer.inferCategory(
    "scripts/audio/configure-speakers.ts",
  );
  assertEquals(category, "audio");
});

Deno.test("ScriptAnalyzer - inferCategory from system path", () => {
  const analyzer = new ScriptAnalyzer();

  const category = analyzer.inferCategory(
    "scripts/system/configure-davinci.ts",
  );
  assertEquals(category, "system");
});

Deno.test("ScriptAnalyzer - inferCategory from dev path", () => {
  const analyzer = new ScriptAnalyzer();

  const category = analyzer.inferCategory("scripts/dev/deploy.ts");
  assertEquals(category, "dev");
});

Deno.test("ScriptAnalyzer - inferCategory defaults to 'other'", () => {
  const analyzer = new ScriptAnalyzer();

  const category = analyzer.inferCategory("scripts/unknown/something.ts");
  assertEquals(category, "other");
});

Deno.test(
  "ScriptAnalyzer - analyzeScript returns complete metadata",
  async () => {
    const analyzer = new ScriptAnalyzer();

    const tempFile = await Deno.makeTempFile({ suffix: ".ts" });

    try {
      const content = `
/**
 * Test audio configuration script
 * Configures audio settings
 *
 * Usage:
 *   deno run --allow-all test.ts
 */

import { logger } from "../lib/logger.ts";

export function main() {
  console.log("test");
}
`;

      await Deno.writeTextFile(tempFile, content);

      const metadata = await analyzer.analyzeScript(tempFile);

      assertExists(metadata.name);
      assertExists(metadata.path);
      assertEquals(metadata.description.length > 0, true);
      assertEquals(metadata.usage.length > 0, true);
      assertEquals(metadata.tags.length > 0, true);
      assertEquals(metadata.dependencies.length > 0, true);
    } finally {
      await Deno.remove(tempFile);
    }
  },
);

Deno.test(
  "ScriptAnalyzer - analyzeScript extracts name from filename",
  async () => {
    const analyzer = new ScriptAnalyzer();

    const tempFile = await Deno.makeTempFile({
      prefix: "configure-audio-",
      suffix: ".ts",
    });

    try {
      await Deno.writeTextFile(tempFile, "export function main() {}");

      const metadata = await analyzer.analyzeScript(tempFile);

      assertEquals(metadata.name.includes("configure-audio"), true);
    } finally {
      await Deno.remove(tempFile);
    }
  },
);

Deno.test(
  "ScriptAnalyzer - analyzeScript handles missing file gracefully",
  async () => {
    const analyzer = new ScriptAnalyzer();

    await assertRejects(
      async () => await analyzer.analyzeScript("/nonexistent/path.ts"),
      Error,
    );
  },
);

Deno.test(
  "ScriptAnalyzer - analyzeAllScripts finds multiple scripts",
  async () => {
    const analyzer = new ScriptAnalyzer();

    const tempDir = await Deno.makeTempDir();

    try {
      // Create test scripts
      await Deno.writeTextFile(
        `${tempDir}/script1.ts`,
        "export function main() {}",
      );
      await Deno.writeTextFile(
        `${tempDir}/script2.ts`,
        "export function run() {}",
      );

      const results = await analyzer.analyzeAllScripts(tempDir);

      assertEquals(results.length, 2);
      assertEquals(
        results.every((r: { name: string }) => r.name.length > 0),
        true,
      );
    } finally {
      await Deno.remove(tempDir, { recursive: true });
    }
  },
);

Deno.test(
  "ScriptAnalyzer - analyzeAllScripts filters non-TypeScript files",
  async () => {
    const analyzer = new ScriptAnalyzer();

    const tempDir = await Deno.makeTempDir();

    try {
      await Deno.writeTextFile(`${tempDir}/script.ts`, "export {}");
      await Deno.writeTextFile(`${tempDir}/readme.md`, "# Readme");
      await Deno.writeTextFile(`${tempDir}/data.json`, "{}");

      const results = await analyzer.analyzeAllScripts(tempDir);

      assertEquals(results.length, 1);
      assertEquals(results[0]?.name.includes("script"), true);
    } finally {
      await Deno.remove(tempDir, { recursive: true });
    }
  },
);

Deno.test(
  "ScriptAnalyzer - analyzeAllScripts handles empty directory",
  async () => {
    const analyzer = new ScriptAnalyzer();

    const tempDir = await Deno.makeTempDir();

    try {
      const results = await analyzer.analyzeAllScripts(tempDir);
      assertEquals(results, []);
    } finally {
      await Deno.remove(tempDir, { recursive: true });
    }
  },
);
