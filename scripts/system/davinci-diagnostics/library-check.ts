/**
 * DaVinci Resolve library dependencies check
 */

import { logger } from "../../lib/logger.ts";
import { runCommand } from "../../lib/common.ts";
import type { DiagnosticResult } from "./types.ts";

const DAVINCI_PATH = "/opt/resolve";
const REQUIRED_LIBS = [
  "libglib-2.0.so.0",
  "libgio-2.0.so.0",
  "libpango-1.0.so.0",
  "libpangocairo-1.0.so.0",
  "libcairo.so.2",
];

export async function checkLibraries(): Promise<DiagnosticResult[]> {
  logger.info("📚 Checking library dependencies...");
  const results: DiagnosticResult[] = [];

  // Check if DaVinci is installed
  const resolveExists = await Deno.stat(`${DAVINCI_PATH}/bin/resolve`).catch(
    () => null,
  );

  if (!resolveExists) {
    results.push({
      category: "libs",
      severity: "critical",
      message: "DaVinci Resolve not found at /opt/resolve",
      fix: "Install DaVinci Resolve",
    });
    return results;
  }

  // Check for library conflicts
  for (const lib of REQUIRED_LIBS) {
    const systemLib = await runCommand(["ldconfig", "-p"]);
    if (!systemLib.stdout.includes(lib)) {
      results.push({
        category: "libs",
        severity: "warning",
        message: `Required library not in system path: ${lib}`,
      });
    }
  }

  // Check for conflicting libraries in DaVinci's libs directory
  const davinciLibs = `${DAVINCI_PATH}/libs`;
  const libsExist = await Deno.stat(davinciLibs).catch(() => null);

  if (libsExist) {
    // Check for problematic bundled libraries
    const problematicLibs = [
      "libglib-2.0.so.0",
      "libgio-2.0.so.0",
    ];

    for (const lib of problematicLibs) {
      const libPath = `${davinciLibs}/${lib}`;
      const exists = await Deno.stat(libPath).catch(() => null);

      if (exists) {
        results.push({
          category: "libs",
          severity: "critical",
          message: `Conflicting bundled library found: ${lib}`,
          fix: `Remove or rename ${libPath}`,
          details: {
            path: libPath,
            solution: "Use system libraries instead",
          },
        });
      }
    }
  }

  // Check LD_LIBRARY_PATH
  const ldLibPath = Deno.env.get("LD_LIBRARY_PATH") || "";
  if (ldLibPath.includes(davinciLibs)) {
    results.push({
      category: "libs",
      severity: "warning",
      message: "LD_LIBRARY_PATH includes DaVinci libs (may cause conflicts)",
    });
  }

  return results;
}
