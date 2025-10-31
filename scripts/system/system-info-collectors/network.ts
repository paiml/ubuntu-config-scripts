/**
 * Network information collector
 */

import { runCommand } from "../../lib/common.ts";

export async function collectNetworkInfo(): Promise<
  Array<Record<string, unknown>>
> {
  const interfaces: Array<Record<string, unknown>> = [];

  // Get interface list
  const ipResult = await runCommand(["ip", "-brief", "addr"]);

  if (ipResult.success) {
    const lines = ipResult.stdout.trim().split("\n");

    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length >= 3) {
        const name = parts[0] ?? "";
        const state = parts[1] ?? "";
        const ipAddress = parts[2] ?? "";

        // Get MAC address
        const macResult = await runCommand([
          "cat",
          `/sys/class/net/${name}/address`,
        ]);
        const macAddress = macResult.success ? macResult.stdout.trim() : "";

        // Get stats
        const rxResult = await runCommand([
          "cat",
          `/sys/class/net/${name}/statistics/rx_bytes`,
        ]);
        const txResult = await runCommand([
          "cat",
          `/sys/class/net/${name}/statistics/tx_bytes`,
        ]);

        const rxBytes = rxResult.success ? parseInt(rxResult.stdout.trim()) : 0;
        const txBytes = txResult.success ? parseInt(txResult.stdout.trim()) : 0;

        interfaces.push({
          name,
          ipAddress: ipAddress.split("/")[0] ?? "",
          macAddress,
          state,
          speedMbps: 0, // Placeholder
          rxBytes,
          txBytes,
        });
      }
    }
  }

  return interfaces;
}
