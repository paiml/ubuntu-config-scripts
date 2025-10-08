/**
 * Five-Why Analysis for DaVinci Resolve crashes
 */

import { logger } from "../../lib/logger.ts";

export class FiveWhyAnalyzer {
  private whys: string[] = [];
  private rootCause: string | null = null;

  addWhy(question: string, answer: string): void {
    this.whys.push(`Q${this.whys.length + 1}: ${question}\nA: ${answer}`);
  }

  setRootCause(cause: string): void {
    this.rootCause = cause;
  }

  generateReport(): string {
    let report = "\n" + "=".repeat(80) + "\n";
    report += "🔍 FIVE-WHY ANALYSIS\n";
    report += "=".repeat(80) + "\n\n";

    this.whys.forEach((why) => {
      report += why + "\n\n";
    });

    if (this.rootCause) {
      report += "🎯 ROOT CAUSE IDENTIFIED:\n";
      report += this.rootCause + "\n";
    }

    report += "=".repeat(80) + "\n";
    return report;
  }

  print(): void {
    logger.info(this.generateReport());
  }
}
