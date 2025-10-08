/**
 * CPU information collector
 */

import { runCommand } from "../../lib/common.ts";

export async function collectCpuInfo(): Promise<Record<string, unknown>> {
  // Get CPU model
  const cpuInfoResult = await runCommand(["cat", "/proc/cpuinfo"]);
  let model = "Unknown";

  if (cpuInfoResult.success) {
    const modelLine = cpuInfoResult.stdout.split("\n").find((line) =>
      line.startsWith("model name")
    );
    if (modelLine) {
      model = modelLine.split(":")[1]?.trim() ?? "Unknown";
    }
  }

  // Get core count
  const coresResult = await runCommand(["nproc", "--all"]);
  const cores = coresResult.success ? parseInt(coresResult.stdout.trim()) : 0;

  // Get thread count (same as cores for now)
  const threads = cores;

  // Get CPU frequency
  const freqResult = await runCommand(["cat", "/proc/cpuinfo"]);
  let currentFreqMhz = 0;
  let maxFreqMhz = 0;

  if (freqResult.success) {
    const freqLine = freqResult.stdout.split("\n").find((line) =>
      line.startsWith("cpu MHz")
    );
    if (freqLine) {
      currentFreqMhz = parseFloat(freqLine.split(":")[1]?.trim() ?? "0");
    }
  }

  // Get max frequency
  const maxFreqResult = await runCommand([
    "cat",
    "/sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_max_freq",
  ]);
  if (maxFreqResult.success) {
    maxFreqMhz = parseInt(maxFreqResult.stdout.trim()) / 1000;
  }

  // Get CPU usage (simplified)
  const usagePercent = 0; // Placeholder - would need more complex calculation

  return {
    model,
    cores,
    threads,
    currentFreqMhz,
    maxFreqMhz,
    usagePercent,
  };
}
