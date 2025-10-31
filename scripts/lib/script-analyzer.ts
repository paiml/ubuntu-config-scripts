/**
 * Script Metadata Analyzer
 *
 * Extracts metadata from TypeScript scripts including:
 * - Description (from JSDoc or comments)
 * - Usage instructions
 * - Import dependencies
 * - Generated tags
 * - Category inference
 */

import { join, resolve } from "../../deps.ts";

export interface ScriptMetadata {
  name: string;
  path: string;
  category: string;
  description: string;
  usage: string;
  tags: string[];
  dependencies: string[];
}

export class ScriptAnalyzer {
  /**
   * Extract description from JSDoc comment or file header
   */
  extractDescription(content: string): string {
    // Try JSDoc comment first
    const jsdocMatch = content.match(/\/\*\*\s*\n([^*]|\*(?!\/))*\*\//);
    if (jsdocMatch) {
      const jsdoc = jsdocMatch[0];
      // Extract description lines (lines that start with *)
      const lines = jsdoc
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("*") && !line.startsWith("*/"))
        .map((line) => line.replace(/^\*\s?/, ""))
        .filter((line) => line.length > 0 && !line.toLowerCase().startsWith("usage"));

      return lines.join(" ").trim();
    }

    // Try single-line comment with "Description:"
    const descMatch = content.match(/\/\/\s*Description:\s*(.+)/i);
    if (descMatch && descMatch[1]) {
      return descMatch[1].trim();
    }

    return "";
  }

  /**
   * Extract usage instructions from comments
   */
  extractUsage(content: string): string {
    // Look for "Usage:" section in JSDoc
    const usageMatch = content.match(/Usage:\s*\n([^*]|\*(?!\/))*(?=\*\/|\n\s*\*\s*$)/s);
    if (usageMatch) {
      const usageSection = usageMatch[0];
      const lines = usageSection
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("*"))
        .map((line) => line.replace(/^\*\s*/, ""))
        .filter((line) => line.length > 0 && !line.toLowerCase().startsWith("usage:"));

      return lines.join("\n").trim();
    }

    return "";
  }

  /**
   * Extract import dependencies from TypeScript code
   */
  extractDependencies(content: string): string[] {
    const dependencies: string[] = [];

    // Match various import statement styles
    const importRegex = /import\s+(?:[\w*{}\s,]+\s+from\s+)?["']([^"']+)["']/g;

    let match;
    while ((match = importRegex.exec(content)) !== null) {
      if (match[1]) {
        dependencies.push(match[1]);
      }
    }

    return dependencies;
  }

  /**
   * Generate tags from script content
   */
  generateTags(content: string): string[] {
    const tags = new Set<string>();

    // Convert to lowercase for matching
    const lowerContent = content.toLowerCase();

    // Common keywords to look for
    const keywords = [
      "audio",
      "video",
      "gpu",
      "nvidia",
      "amd",
      "drivers",
      "configuration",
      "config",
      "setup",
      "install",
      "pulseaudio",
      "pipewire",
      "alsa",
      "davinci",
      "obs",
      "system",
      "network",
      "disk",
      "diagnostic",
      "monitor",
      "service",
      "docker",
      "deployment",
      "build",
      "test",
      "database",
      "api",
    ];

    for (const keyword of keywords) {
      if (lowerContent.includes(keyword)) {
        tags.add(keyword);
      }
    }

    return Array.from(tags).sort();
  }

  /**
   * Infer category from file path
   */
  inferCategory(filePath: string): string {
    const normalized = filePath.toLowerCase();

    if (normalized.includes("/audio/") || normalized.includes("\\audio\\")) {
      return "audio";
    }

    if (normalized.includes("/system/") || normalized.includes("\\system\\")) {
      return "system";
    }

    if (normalized.includes("/dev/") || normalized.includes("\\dev\\")) {
      return "dev";
    }

    return "other";
  }

  /**
   * Analyze a single TypeScript script
   */
  async analyzeScript(filePath: string): Promise<ScriptMetadata> {
    const content = await Deno.readTextFile(filePath);
    const absolutePath = resolve(filePath);
    const fileName = absolutePath.split(/[/\\]/).pop() || "";
    const name = fileName.replace(/\.ts$/, "");

    return {
      name,
      path: absolutePath,
      category: this.inferCategory(absolutePath),
      description: this.extractDescription(content),
      usage: this.extractUsage(content),
      tags: this.generateTags(content),
      dependencies: this.extractDependencies(content),
    };
  }

  /**
   * Analyze all TypeScript scripts in a directory
   */
  async analyzeAllScripts(rootDir: string): Promise<ScriptMetadata[]> {
    const scripts: ScriptMetadata[] = [];

    for await (const entry of Deno.readDir(rootDir)) {
      if (entry.isFile && entry.name.endsWith(".ts")) {
        const filePath = join(rootDir, entry.name);
        const metadata = await this.analyzeScript(filePath);
        scripts.push(metadata);
      }
    }

    return scripts;
  }
}
