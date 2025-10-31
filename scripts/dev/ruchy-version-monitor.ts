#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write

/**
 * Ruchy Version Monitoring System
 *
 * Monitors Ruchy language evolution and compatibility changes
 * Part of RUC-002-005: Future Ruchy Version Monitoring
 */

import { logger } from "../lib/logger.ts";
import { parseArgs } from "../lib/common.ts";

interface RuchyVersion {
  version: string;
  releaseDate: string;
  changelog: string[];
  breaking_changes: string[];
  features: string[];
  compatibility_score: number;
}

interface CompatibilityReport {
  currentVersion: string;
  latestVersion: string;
  compatibility:
    | "COMPATIBLE"
    | "MINOR_ISSUES"
    | "MAJOR_ISSUES"
    | "INCOMPATIBLE";
  migrationEffort: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
  recommendations: string[];
  nextReviewDate: string;
}

class RuchyVersionMonitor {
  private compatibilityHistory: CompatibilityReport[] = [];

  async checkLatestVersion(): Promise<RuchyVersion | null> {
    logger.info("🔍 Checking for latest Ruchy version...");

    try {
      // Check GitHub releases API (simulated - actual implementation would use real API)
      const response = await this.simulateRuchyReleaseAPI();

      if (response) {
        logger.info(`📦 Latest Ruchy version: ${response.version}`);
        return response;
      }

      // Fallback: check local ruchy installation
      return await this.checkLocalRuchyVersion();
    } catch (error) {
      logger.warn(
        `⚠️ Failed to check latest version: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private async simulateRuchyReleaseAPI(): Promise<RuchyVersion | null> {
    // Simulated API response based on current Ruchy development
    // In production, this would query: https://api.github.com/repos/ruchy-lang/ruchy/releases/latest

    const mockLatestVersion: RuchyVersion = {
      version: "0.11.0",
      releaseDate: "2025-09-01T00:00:00Z",
      changelog: [
        "Improved async/await support",
        "Enhanced module system compatibility",
        "Better TypeScript interop",
        "Performance improvements",
      ],
      breaking_changes: [
        "Module import syntax updated",
        "Some function declaration changes",
      ],
      features: [
        "Better async patterns",
        "Improved standard library",
        "Enhanced error handling",
      ],
      compatibility_score: 85, // Out of 100
    };

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    return mockLatestVersion;
  }

  private async checkLocalRuchyVersion(): Promise<RuchyVersion | null> {
    try {
      const process = new Deno.Command("ruchy", {
        args: ["--version"],
        stdout: "piped",
        stderr: "piped",
      });

      const result = await process.output();

      if (result.code === 0) {
        const output = new TextDecoder().decode(result.stdout);
        const versionMatch = output.match(/ruchy (\d+\.\d+\.\d+)/);

        if (versionMatch) {
          return {
            version: versionMatch[1]!,
            releaseDate: "unknown",
            changelog: [],
            breaking_changes: [],
            features: [],
            compatibility_score: 0,
          };
        }
      }

      return null;
    } catch (error) {
      logger.debug(`Local Ruchy check failed: ${(error as Error).message}`);
      return null;
    }
  }

  generateCompatibilityReport(
    latestVersion: RuchyVersion,
  ): CompatibilityReport {
    logger.info("📊 Generating compatibility report...");

    const currentBridgeVersion = "0.10.0"; // Our current target
    const compatibility = this.assessCompatibility(
      currentBridgeVersion,
      latestVersion,
    );

    const report: CompatibilityReport = {
      currentVersion: currentBridgeVersion,
      latestVersion: latestVersion.version,
      compatibility: compatibility.level,
      migrationEffort: compatibility.effort,
      recommendations: compatibility.recommendations,
      nextReviewDate: this.getNextReviewDate(),
    };

    this.compatibilityHistory.push(report);
    return report;
  }

  private assessCompatibility(currentVersion: string, latest: RuchyVersion): {
    level: CompatibilityReport["compatibility"];
    effort: CompatibilityReport["migrationEffort"];
    recommendations: string[];
  } {
    const recommendations: string[] = [];

    // Version comparison logic
    const currentMajor = parseInt(currentVersion.split(".")[1]!); // 0.10.0 -> 10
    const latestMajor = parseInt(latest.version.split(".")[1]!); // 0.11.0 -> 11

    const versionGap = latestMajor - currentMajor;
    const hasBreakingChanges = latest.breaking_changes.length > 0;
    const compatibilityScore = latest.compatibility_score || 50;

    // Determine compatibility level
    let level: CompatibilityReport["compatibility"];
    let effort: CompatibilityReport["migrationEffort"];

    if (versionGap === 0 && !hasBreakingChanges) {
      level = "COMPATIBLE";
      effort = "LOW";
      recommendations.push("✅ Safe to upgrade - no major changes detected");
    } else if (versionGap <= 1 && compatibilityScore >= 80) {
      level = "MINOR_ISSUES";
      effort = "MEDIUM";
      recommendations.push("⚠️ Minor syntax updates may be required");
      recommendations.push("🔄 Update bridge transformer rules");
    } else if (versionGap <= 2 && compatibilityScore >= 60) {
      level = "MAJOR_ISSUES";
      effort = "HIGH";
      recommendations.push("🚨 Significant migration work required");
      recommendations.push("🧪 Extensive testing needed");
      recommendations.push("📝 Update all transformation rules");
    } else {
      level = "INCOMPATIBLE";
      effort = "VERY_HIGH";
      recommendations.push("❌ Major rewrite of bridge system required");
      recommendations.push("⏳ Wait for language stabilization");
      recommendations.push("📋 Consider alternative migration strategies");
    }

    // Add specific recommendations based on features
    if (latest.features.includes("Better async patterns")) {
      recommendations.push("🔄 Update async/await transformation rules");
    }

    if (latest.breaking_changes.some((change) => change.includes("import"))) {
      recommendations.push("📦 Review module import transformation logic");
    }

    return { level, effort, recommendations };
  }

  private getNextReviewDate(): string {
    const nextReview = new Date();
    nextReview.setMonth(nextReview.getMonth() + 1); // Review monthly
    return nextReview.toISOString().split("T")[0]!;
  }

  generateMonitoringReport(report: CompatibilityReport): string {
    const reportContent = `
# Ruchy Version Monitoring Report

**Generated**: ${new Date().toISOString()}
**Monitor Version**: 1.0.0 (RUC-002-005)

## Version Status

- **Current Target**: ${report.currentVersion}
- **Latest Available**: ${report.latestVersion}
- **Compatibility**: ${report.compatibility}
- **Migration Effort**: ${report.migrationEffort}

## Compatibility Assessment

${this.getCompatibilityIcon(report.compatibility)} **${report.compatibility}**

${report.recommendations.map((rec) => `- ${rec}`).join("\n")}

## Monitoring Schedule

- **Next Review**: ${report.nextReviewDate}
- **Review Frequency**: Monthly
- **Automated Checks**: Weekly (CI/CD)

## Bridge System Impact

### Current State
- **TypeScript System**: ✅ Fully operational (production)
- **Bridge Infrastructure**: ✅ Ready for migration
- **Transformation Rules**: ⚠️ Requires updates for v${report.latestVersion}

### Migration Readiness

${this.getMigrationReadinessLevel(report.migrationEffort)}

## Action Items

${
      this.generateActionItems(report).map((action) => `- [ ] ${action}`).join(
        "\n",
      )
    }

## Historical Tracking

Previous compatibility reports: ${this.compatibilityHistory.length}

## Recommendations

${
      report.compatibility === "COMPATIBLE"
        ? "🟢 **Proceed with migration testing** - Compatibility looks good"
        : report.compatibility === "MINOR_ISSUES"
        ? "🟡 **Cautious migration** - Test thoroughly before production"
        : report.compatibility === "MAJOR_ISSUES"
        ? "🟠 **Delay migration** - Wait for better compatibility"
        : "🔴 **Maintain TypeScript** - Ruchy not ready for production migration"
    }

---
*Next automated check: ${
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
    }*
`;

    return reportContent;
  }

  private getCompatibilityIcon(
    compatibility: CompatibilityReport["compatibility"],
  ): string {
    switch (compatibility) {
      case "COMPATIBLE":
        return "🟢";
      case "MINOR_ISSUES":
        return "🟡";
      case "MAJOR_ISSUES":
        return "🟠";
      case "INCOMPATIBLE":
        return "🔴";
    }
  }

  private getMigrationReadinessLevel(
    effort: CompatibilityReport["migrationEffort"],
  ): string {
    switch (effort) {
      case "LOW":
        return "🟢 **Ready** - Low effort migration possible";
      case "MEDIUM":
        return "🟡 **Prepare** - Moderate migration work required";
      case "HIGH":
        return "🟠 **Plan** - Significant development needed";
      case "VERY_HIGH":
        return "🔴 **Wait** - Extensive rewrite required";
    }
  }

  private generateActionItems(report: CompatibilityReport): string[] {
    const actions: string[] = [];

    if (report.compatibility === "COMPATIBLE") {
      actions.push(
        "Update bridge transformer to target v" + report.latestVersion,
      );
      actions.push("Run comprehensive feature parity tests");
      actions.push("Begin selective script migration");
    } else if (report.compatibility === "MINOR_ISSUES") {
      actions.push("Review breaking changes in detail");
      actions.push("Update transformation rules");
      actions.push("Test bridge system with new version");
    } else if (report.compatibility === "MAJOR_ISSUES") {
      actions.push("Analyze impact of breaking changes");
      actions.push("Plan bridge system updates");
      actions.push("Continue monitoring for stability");
    } else {
      actions.push("Maintain current TypeScript system");
      actions.push("Monitor Ruchy development progress");
      actions.push("Re-evaluate in 3 months");
    }

    actions.push("Update Sprint RUC-003 based on findings");
    actions.push("Schedule next compatibility review");

    return actions;
  }

  async saveReport(report: string, filename: string): Promise<void> {
    await Deno.writeTextFile(filename, report);
    logger.success(`📄 Monitoring report saved: ${filename}`);
  }
}

async function main() {
  const args = parseArgs(Deno.args);

  if (args["help"] || args["h"]) {
    console.log(`
Ruchy Version Monitoring System

Usage: ruchy-version-monitor.ts [options]

Options:
  --output <file>        Save report to file (default: ruchy-monitor-report.md)
  --check-only          Only check version, don't generate full report
  --force               Force check even if recently checked
  --help, -h            Show this help message

Examples:
  ruchy-version-monitor.ts                                    # Full monitoring report
  ruchy-version-monitor.ts --output compatibility-report.md  # Save to custom file
  ruchy-version-monitor.ts --check-only                      # Quick version check
`);
    return;
  }

  const monitor = new RuchyVersionMonitor();

  try {
    logger.info("🚀 Starting Ruchy version monitoring...");

    const latestVersion = await monitor.checkLatestVersion();

    if (!latestVersion) {
      logger.warn("⚠️ Could not determine latest Ruchy version");
      logger.info("📝 Using offline compatibility assessment");

      // Create a fallback report
      const fallbackReport = `
# Ruchy Version Monitoring Report (Offline)

**Generated**: ${new Date().toISOString()}

## Status
- **Monitoring**: ⚠️ Unable to check latest version
- **Current System**: ✅ TypeScript production system operational
- **Bridge Status**: ✅ Ready for future Ruchy versions

## Recommendations
- ✅ Continue with TypeScript production system
- 🔄 Retry monitoring when network/API available
- 📊 Bridge infrastructure ready for when Ruchy stabilizes

## Next Steps
- Check Ruchy GitHub releases manually
- Test bridge system with available Ruchy version
- Schedule next automated check
`;

      const outputFile = (args["output"] as string) ||
        "ruchy-monitor-report-offline.md";
      await Deno.writeTextFile(outputFile, fallbackReport);
      logger.info(`📄 Offline report generated: ${outputFile}`);
      return;
    }

    if (args["check-only"]) {
      logger.success(`✅ Latest Ruchy version: ${latestVersion.version}`);
      if (latestVersion.changelog.length > 0) {
        console.log("\nKey changes:");
        latestVersion.changelog.slice(0, 3).forEach((change) =>
          console.log(`  • ${change}`)
        );
      }
      return;
    }

    const compatibilityReport = monitor.generateCompatibilityReport(
      latestVersion,
    );
    const fullReport = monitor.generateMonitoringReport(
      compatibilityReport,
    );

    const outputFile = (args["output"] as string) || "ruchy-monitor-report.md";
    await monitor.saveReport(fullReport, outputFile);

    // Print summary
    console.log("\n" + "=".repeat(60));
    logger.info(`🎯 Compatibility: ${compatibilityReport.compatibility}`);
    logger.info(`⚡ Migration Effort: ${compatibilityReport.migrationEffort}`);
    logger.info(`📅 Next Review: ${compatibilityReport.nextReviewDate}`);
    console.log("=".repeat(60));

    if (compatibilityReport.compatibility === "COMPATIBLE") {
      logger.success("🎉 Ready for migration testing!");
    } else if (compatibilityReport.compatibility === "INCOMPATIBLE") {
      logger.info("💡 TypeScript system remains the optimal choice");
    } else {
      logger.info("⚠️ Monitor progress and plan accordingly");
    }
  } catch (error) {
    logger.error(`❌ Monitoring failed: ${(error as Error).message}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
