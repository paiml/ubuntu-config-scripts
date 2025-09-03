import { logger } from "./logger.ts";
import { runCommand } from "./common.ts";

export interface DenoVersion {
  current: string;
  latest: string;
  needsUpdate: boolean;
}

export async function getCurrentDenoVersion(): Promise<string | null> {
  const result = await runCommand(["deno", "--version"]);
  if (!result.success) {
    return null;
  }

  const match = result.stdout.match(/deno (\d+\.\d+\.\d+)/);
  return match?.[1] ?? null;
}

export async function getLatestDenoVersion(): Promise<string | null> {
  try {
    const response = await fetch(
      "https://api.github.com/repos/denoland/deno/releases/latest",
    );
    if (!response.ok) {
      logger.warn(`Failed to fetch latest Deno version: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const tagName = data.tag_name;

    // Remove 'v' prefix if present
    return tagName.startsWith("v") ? tagName.slice(1) : tagName;
  } catch (error) {
    logger.error("Failed to check latest Deno version:", error);
    return null;
  }
}

export async function checkDenoVersion(): Promise<DenoVersion | null> {
  const current = await getCurrentDenoVersion();
  if (!current) {
    logger.error("Could not determine current Deno version");
    return null;
  }

  const latest = await getLatestDenoVersion();
  if (!latest) {
    logger.warn("Could not determine latest Deno version");
    return {
      current,
      latest: current,
      needsUpdate: false,
    };
  }

  const needsUpdate = compareVersions(current, latest) < 0;

  return {
    current,
    latest,
    needsUpdate,
  };
}

export function compareVersions(a: string, b: string): number {
  const partsA = a.split(".").map(Number);
  const partsB = b.split(".").map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const partA = partsA[i] || 0;
    const partB = partsB[i] || 0;

    if (partA < partB) return -1;
    if (partA > partB) return 1;
  }

  return 0;
}

export async function updateDeno(): Promise<boolean> {
  logger.info("Updating Deno to the latest version...");

  // Try to update using deno upgrade
  const upgradeResult = await runCommand(["deno", "upgrade"]);
  if (upgradeResult.success) {
    logger.success("Deno updated successfully");
    return true;
  }

  // If deno upgrade fails, try the install script
  logger.info("Trying alternative update method...");
  const curlResult = await runCommand([
    "sh",
    "-c",
    "curl -fsSL https://deno.land/x/install/install.sh | sh",
  ]);

  if (curlResult.success) {
    logger.success("Deno updated successfully via install script");
    logger.warn(
      "You may need to restart your terminal or run 'source ~/.bashrc'",
    );
    return true;
  }

  logger.error("Failed to update Deno");
  return false;
}

export async function ensureLatestDeno(): Promise<void> {
  const versionInfo = await checkDenoVersion();

  if (!versionInfo) {
    logger.warn("Could not check Deno version, continuing anyway");
    return;
  }

  if (!versionInfo.needsUpdate) {
    logger.debug(`Deno is up to date (v${versionInfo.current})`);
    return;
  }

  logger.info(
    `Deno update available: v${versionInfo.current} → v${versionInfo.latest}`,
  );

  // Auto-update is enabled
  const updated = await updateDeno();

  if (updated) {
    // Verify the update
    const newVersion = await getCurrentDenoVersion();
    if (newVersion) {
      logger.success(`Deno updated to v${newVersion}`);
    }
  } else {
    logger.warn("Could not update Deno automatically. Please update manually:");
    logger.warn("  deno upgrade");
    logger.warn("  or");
    logger.warn("  curl -fsSL https://deno.land/x/install/install.sh | sh");
  }
}
