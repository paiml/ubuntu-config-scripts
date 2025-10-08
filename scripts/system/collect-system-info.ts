#!/usr/bin/env -S deno run --allow-all

/**
 * System Information Collector
 * Refactored to comply with PMAT quality standards (max 500 lines)
 *
 * Collects and stores comprehensive system information in SQLite database
 */

import { DB as Database } from "https://deno.land/x/sqlite@v3.8/mod.ts";
import { logger } from "../lib/logger.ts";
import { z } from "../../deps.ts";

// Configuration schema
const ConfigSchema = z.object({
  dbPath: z.string().default("~/.local/share/system-info/system.db"),
  collectInterval: z.number().int().min(60).default(3600),
  retentionDays: z.number().int().min(1).default(90),
});

type Config = z.infer<typeof ConfigSchema>;

// Import specialized collectors
import { collectSystemInfo } from "./system-info-collectors/system.ts";
import { collectCpuInfo } from "./system-info-collectors/cpu.ts";
import { collectMemoryInfo } from "./system-info-collectors/memory.ts";
import { collectDiskInfo } from "./system-info-collectors/disk.ts";
import { collectNetworkInfo } from "./system-info-collectors/network.ts";
import { collectGpuInfo } from "./system-info-collectors/gpu.ts";
import { collectServiceInfo } from "./system-info-collectors/services.ts";
import { initDatabase } from "./system-info-collectors/database.ts";

/**
 * Main system information collector
 */
class SystemInfoCollector {
  private db: Database;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    const dbPath = this.expandPath(config.dbPath);
    this.ensureDbDirectory(dbPath);
    this.db = new Database(dbPath);
    initDatabase(this.db);
  }

  private expandPath(path: string): string {
    if (path.startsWith("~")) {
      const home = Deno.env.get("HOME") || "";
      return path.replace("~", home);
    }
    return path;
  }

  private ensureDbDirectory(dbPath: string): void {
    const dir = dbPath.substring(0, dbPath.lastIndexOf("/"));
    try {
      Deno.mkdirSync(dir, { recursive: true });
    } catch (error) {
      if (!(error instanceof Deno.errors.AlreadyExists)) {
        throw error;
      }
    }
  }

  /**
   * Collect all system information
   */
  async collectAll(): Promise<void> {
    logger.info("📊 Collecting system information...");

    try {
      // Collect all information
      const sysInfo = await collectSystemInfo();
      const cpuInfo = await collectCpuInfo();
      const memInfo = await collectMemoryInfo();
      const diskInfo = await collectDiskInfo();
      const networkInfo = await collectNetworkInfo();
      const gpuInfo = await collectGpuInfo();
      const serviceInfo = await collectServiceInfo();

      // Store in database
      this.storeSystemInfo(sysInfo);
      this.storeCpuInfo(cpuInfo);
      this.storeMemoryInfo(memInfo);
      this.storeDiskInfo(diskInfo);
      this.storeNetworkInfo(networkInfo);
      this.storeGpuInfo(gpuInfo);
      this.storeServiceInfo(serviceInfo);

      logger.info("✅ System information collected successfully");
    } catch (error) {
      logger.error("Failed to collect system information", {
        error: String(error),
      });
      throw error;
    }
  }

  private storeSystemInfo(info: Record<string, unknown>): void {
    this.db.query(
      `INSERT INTO system_info (hostname, kernel, os_name, os_version,
       architecture, uptime_seconds, boot_time, timezone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        info["hostname"],
        info["kernel"],
        info["osName"],
        info["osVersion"],
        info["architecture"],
        info["uptimeSeconds"],
        info["bootTime"],
        info["timezone"],
      ]
    );
  }

  private storeCpuInfo(info: Record<string, unknown>): void {
    this.db.query(
      `INSERT INTO cpu_info (model, cores, threads, current_freq_mhz,
       max_freq_mhz, usage_percent)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        info["model"],
        info["cores"],
        info["threads"],
        info["currentFreqMhz"],
        info["maxFreqMhz"],
        info["usagePercent"],
      ]
    );
  }

  private storeMemoryInfo(info: Record<string, unknown>): void {
    this.db.query(
      `INSERT INTO memory_info (total_mb, available_mb, used_mb,
       usage_percent, swap_total_mb, swap_used_mb)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        info["totalMb"],
        info["availableMb"],
        info["usedMb"],
        info["usagePercent"],
        info["swapTotalMb"],
        info["swapUsedMb"],
      ]
    );
  }

  private storeDiskInfo(disks: Array<Record<string, unknown>>): void {
    for (const disk of disks) {
      this.db.query(
        `INSERT INTO disk_info (device, mount_point, filesystem,
         size_gb, used_gb, available_gb, usage_percent)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          disk["device"],
          disk["mountPoint"],
          disk["filesystem"],
          disk["sizeGb"],
          disk["usedGb"],
          disk["availableGb"],
          disk["usagePercent"],
        ]
      );
    }
  }

  private storeNetworkInfo(interfaces: Array<Record<string, unknown>>): void {
    for (const iface of interfaces) {
      this.db.query(
        `INSERT INTO network_info (interface_name, ip_address,
         mac_address, state, speed_mbps, rx_bytes, tx_bytes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          iface["name"],
          iface["ipAddress"],
          iface["macAddress"],
          iface["state"],
          iface["speedMbps"],
          iface["rxBytes"],
          iface["txBytes"],
        ]
      );
    }
  }

  private storeGpuInfo(gpus: Array<Record<string, unknown>>): void {
    for (const gpu of gpus) {
      this.db.query(
        `INSERT INTO gpu_info (vendor, model, driver_version,
         memory_total_mb, memory_used_mb, temperature_c, utilization_percent)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          gpu["vendor"],
          gpu["model"],
          gpu["driverVersion"],
          gpu["memoryTotalMb"],
          gpu["memoryUsedMb"],
          gpu["temperatureC"],
          gpu["utilizationPercent"],
        ]
      );
    }
  }

  private storeServiceInfo(services: Array<Record<string, unknown>>): void {
    for (const service of services) {
      this.db.query(
        `INSERT INTO service_info (service_name, state, enabled,
         load_state, active_state, sub_state)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          service["name"],
          service["state"],
          service["enabled"],
          service["loadState"],
          service["activeState"],
          service["subState"],
        ]
      );
    }
  }

  /**
   * Clean up old data
   */
  cleanupOldData(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
    const cutoffStr = cutoffDate.toISOString();

    const tables = [
      "system_info",
      "cpu_info",
      "memory_info",
      "disk_info",
      "network_info",
      "gpu_info",
      "service_info",
    ];

    for (const table of tables) {
      this.db.query(`DELETE FROM ${table} WHERE timestamp < ?`, [cutoffStr]);
    }

    logger.info(
      `Cleaned up data older than ${this.config.retentionDays} days`
    );
  }

  /**
   * Generate summary report
   */
  generateReport(): void {
    logger.info("\n" + "=".repeat(80));
    logger.info("📊 SYSTEM INFORMATION SUMMARY");
    logger.info("=".repeat(80) + "\n");

    // Get latest system info
    const sysInfo = this.db.query(
      "SELECT * FROM system_info ORDER BY timestamp DESC LIMIT 1"
    );

    if (sysInfo.length > 0) {
      const row = sysInfo[0];
      logger.info(`Hostname: ${row[2]}`);
      logger.info(`OS: ${row[4]} ${row[5]}`);
      logger.info(`Kernel: ${row[3]}`);
      logger.info(`Architecture: ${row[6]}`);
    }

    // Get latest CPU info
    const cpuInfo = this.db.query(
      "SELECT * FROM cpu_info ORDER BY timestamp DESC LIMIT 1"
    );

    if (cpuInfo.length > 0) {
      const row = cpuInfo[0];
      logger.info(`\nCPU: ${row[2]}`);
      logger.info(`Cores/Threads: ${row[3]}/${row[4]}`);
      logger.info(`Usage: ${row[7]}%`);
    }

    // Get latest memory info
    const memInfo = this.db.query(
      "SELECT * FROM memory_info ORDER BY timestamp DESC LIMIT 1"
    );

    if (memInfo.length > 0) {
      const row = memInfo[0];
      logger.info(`\nMemory: ${row[3]}MB / ${row[2]}MB (${row[5]}%)`);
      logger.info(`Swap: ${row[7]}MB / ${row[6]}MB`);
    }

    logger.info("\n" + "=".repeat(80));
  }

  close(): void {
    this.db.close();
  }
}

// CLI entry point
async function main() {
  const args = Deno.args;
  const config = ConfigSchema.parse({});

  const collector = new SystemInfoCollector(config);

  try {
    if (args.includes("--cleanup")) {
      collector.cleanupOldData();
    } else if (args.includes("--report")) {
      collector.generateReport();
    } else {
      await collector.collectAll();

      if (args.includes("--show")) {
        collector.generateReport();
      }
    }
  } finally {
    collector.close();
  }
}

if (import.meta.main) {
  await main();
}

export { ConfigSchema, SystemInfoCollector };
