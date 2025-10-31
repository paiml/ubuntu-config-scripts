/**
 * Disk information collector
 */

import { runCommand } from "../../lib/common.ts";

export async function collectDiskInfo(): Promise<
  Array<Record<string, unknown>>
> {
  const disks: Array<Record<string, unknown>> = [];

  const dfResult = await runCommand(["df", "-h", "--output=source,fstype,size,used,avail,pcent,target"]);

  if (dfResult.success) {
    const lines = dfResult.stdout.trim().split("\n").slice(1); // Skip header

    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length >= 7) {
        const device = parts[0] ?? "";
        const filesystem = parts[1] ?? "";
        const sizeStr = parts[2] ?? "0";
        const usedStr = parts[3] ?? "0";
        const availStr = parts[4] ?? "0";
        const usageStr = parts[5] ?? "0%";
        const mountPoint = parts[6] ?? "";

        // Skip tmpfs and other virtual filesystems
        if (filesystem === "tmpfs" || device.startsWith("tmpfs")) {
          continue;
        }

        disks.push({
          device,
          mountPoint,
          filesystem,
          sizeGb: parseSize(sizeStr),
          usedGb: parseSize(usedStr),
          availableGb: parseSize(availStr),
          usagePercent: parseFloat(usageStr.replace("%", "")),
        });
      }
    }
  }

  return disks;
}

function parseSize(sizeStr: string): number {
  const num = parseFloat(sizeStr);
  if (sizeStr.endsWith("T")) return num * 1024;
  if (sizeStr.endsWith("G")) return num;
  if (sizeStr.endsWith("M")) return num / 1024;
  if (sizeStr.endsWith("K")) return num / (1024 * 1024);
  return num;
}
