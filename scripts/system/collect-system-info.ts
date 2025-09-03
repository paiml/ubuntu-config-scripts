#!/usr/bin/env -S deno run --allow-run --allow-read --allow-write --allow-env --allow-sys

import { z } from "../../deps.ts";
import { logger } from "../lib/logger.ts";
import { commandExists, runCommand } from "../lib/common.ts";
import { Database } from "https://deno.land/x/sqlite3@0.12.0/mod.ts";

// Configuration schema
const ConfigSchema = z.object({
  dbPath: z.string().default("~/.local/share/ubuntu-config/system-info.db"),
  outputFormat: z.enum(["json", "table", "markdown"]).default("table"),
  collectAll: z.boolean().default(true),
  categories: z.array(z.enum([
    "system",
    "cpu",
    "memory",
    "disk",
    "network",
    "gpu",
    "services",
    "packages",
    "containers",
  ])).optional(),
  verbose: z.boolean().default(false),
});

type Config = z.infer<typeof ConfigSchema>;

// Data schemas for SQLite storage
const SystemInfoSchema = z.object({
  hostname: z.string(),
  kernel: z.string(),
  os_name: z.string(),
  os_version: z.string(),
  architecture: z.string(),
  uptime_seconds: z.number(),
  boot_time: z.string(),
  timezone: z.string(),
});

const CpuInfoSchema = z.object({
  model: z.string(),
  cores: z.number(),
  threads: z.number(),
  frequency_mhz: z.number(),
  cache_size_kb: z.number().optional(),
  vendor: z.string(),
  flags: z.array(z.string()),
});

const MemoryInfoSchema = z.object({
  total_mb: z.number(),
  used_mb: z.number(),
  free_mb: z.number(),
  available_mb: z.number(),
  swap_total_mb: z.number(),
  swap_used_mb: z.number(),
  swap_free_mb: z.number(),
});

const DiskInfoSchema = z.object({
  device: z.string(),
  mount_point: z.string(),
  filesystem: z.string(),
  total_gb: z.number(),
  used_gb: z.number(),
  free_gb: z.number(),
  use_percent: z.number(),
});

const NetworkInterfaceSchema = z.object({
  name: z.string(),
  ip_address: z.string().optional(),
  mac_address: z.string().optional(),
  state: z.string(),
  speed_mbps: z.number().optional(),
  type: z.string(), // ethernet, wifi, loopback, etc
});

const ServiceInfoSchema = z.object({
  name: z.string(),
  status: z.string(),
  enabled: z.boolean(),
  description: z.string().optional(),
});

class SystemInfoCollector {
  private db: Database;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    const dbPath = this.expandPath(config.dbPath);
    this.ensureDbDirectory(dbPath);
    this.db = new Database(dbPath);
    this.initDatabase();
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
      // Directory might already exist, that's ok
      if (!(error instanceof Deno.errors.AlreadyExists)) {
        throw error;
      }
    }
  }

  private initDatabase(): void {
    // Create tables if they don't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS system_info (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        hostname TEXT,
        kernel TEXT,
        os_name TEXT,
        os_version TEXT,
        architecture TEXT,
        uptime_seconds INTEGER,
        boot_time TEXT,
        timezone TEXT
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cpu_info (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        model TEXT,
        cores INTEGER,
        threads INTEGER,
        frequency_mhz REAL,
        cache_size_kb INTEGER,
        vendor TEXT,
        flags TEXT
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_info (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        total_mb INTEGER,
        used_mb INTEGER,
        free_mb INTEGER,
        available_mb INTEGER,
        swap_total_mb INTEGER,
        swap_used_mb INTEGER,
        swap_free_mb INTEGER
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS disk_info (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        device TEXT,
        mount_point TEXT,
        filesystem TEXT,
        total_gb REAL,
        used_gb REAL,
        free_gb REAL,
        use_percent REAL
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS network_interfaces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        name TEXT,
        ip_address TEXT,
        mac_address TEXT,
        state TEXT,
        speed_mbps INTEGER,
        type TEXT
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        name TEXT,
        status TEXT,
        enabled BOOLEAN,
        description TEXT
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS gpu_info (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        vendor TEXT,
        model TEXT,
        driver_version TEXT,
        vram_mb INTEGER,
        cuda_version TEXT
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS packages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        name TEXT,
        version TEXT,
        source TEXT,
        size_kb INTEGER
      )
    `);
  }

  async collectSystemInfo(): Promise<typeof SystemInfoSchema._type> {
    logger.info("Collecting system information...");

    const hostname = (await runCommand(["hostname"])).stdout.trim();
    const kernel = (await runCommand(["uname", "-r"])).stdout.trim();
    const osInfo = await this.getOsInfo();
    const arch = (await runCommand(["uname", "-m"])).stdout.trim();
    const uptimeResult = await runCommand(["cat", "/proc/uptime"]);
    const uptimeValue = uptimeResult.stdout.split(" ")[0];
    const uptime = Math.floor(parseFloat(uptimeValue || "0"));
    const bootTime = new Date(Date.now() - uptime * 1000).toISOString();
    const timezone = (await runCommand([
      "timedatectl",
      "show",
      "--property=Timezone",
      "--value",
    ])).stdout.trim();

    const data = {
      hostname,
      kernel,
      os_name: osInfo.name,
      os_version: osInfo.version,
      architecture: arch,
      uptime_seconds: uptime,
      boot_time: bootTime,
      timezone,
    };

    // Store in database
    this.db.prepare(
      `INSERT INTO system_info (hostname, kernel, os_name, os_version, architecture, uptime_seconds, boot_time, timezone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      hostname,
      kernel,
      osInfo.name,
      osInfo.version,
      arch,
      uptime,
      bootTime,
      timezone,
    );

    return SystemInfoSchema.parse(data);
  }

  private async getOsInfo(): Promise<{ name: string; version: string }> {
    try {
      const result = await runCommand(["lsb_release", "-a"]);
      const lines = result.stdout.split("\n");
      const nameLine = lines.find((l) => l.startsWith("Description:"));
      const name = nameLine
        ? nameLine.split(":")[1]?.trim() || "Unknown"
        : "Unknown";
      const versionLine = lines.find((l) => l.startsWith("Release:"));
      const version = versionLine
        ? versionLine.split(":")[1]?.trim() || "Unknown"
        : "Unknown";
      return { name, version };
    } catch {
      // Fallback to /etc/os-release
      const content = await Deno.readTextFile("/etc/os-release");
      const lines = content.split("\n");
      const nameLine = lines.find((l) => l.startsWith("NAME="));
      const name = nameLine
        ? nameLine.split("=")[1]?.replace(/"/g, "") || "Unknown"
        : "Unknown";
      const versionLine = lines.find((l) => l.startsWith("VERSION="));
      const version = versionLine
        ? versionLine.split("=")[1]?.replace(/"/g, "") || "Unknown"
        : "Unknown";
      return { name, version };
    }
  }

  async collectCpuInfo(): Promise<typeof CpuInfoSchema._type> {
    logger.info("Collecting CPU information...");

    const cpuinfo = await Deno.readTextFile("/proc/cpuinfo");
    const lines = cpuinfo.split("\n");

    const modelLine = lines.find((l) => l.startsWith("model name"));
    const model = modelLine
      ? modelLine.split(":")[1]?.trim() || "Unknown"
      : "Unknown";
    const vendorLine = lines.find((l) => l.startsWith("vendor_id"));
    const vendor = vendorLine
      ? vendorLine.split(":")[1]?.trim() || "Unknown"
      : "Unknown";
    const cores = lines.filter((l) => l.startsWith("processor")).length;

    // Get thread count
    const threadsResult = await runCommand(["nproc", "--all"]);
    const threads = parseInt(threadsResult.stdout.trim());

    // Get CPU frequency
    const freqResult = await runCommand(["lscpu"]);
    const freqLine = freqResult.stdout.split("\n").find((l) =>
      l.includes("CPU MHz")
    );
    const freqValue = freqLine ? freqLine.split(":")[1]?.trim() || "0" : "0";
    const frequency = parseFloat(freqValue);

    // Get cache size
    const cacheLine = lines.find((l) => l.startsWith("cache size"));
    const cacheValue = cacheLine
      ? cacheLine.split(":")[1]?.replace("KB", "").trim()
      : undefined;
    const cacheSize = cacheValue ? parseInt(cacheValue) : 0;

    // Get CPU flags
    const flagsLine = lines.find((l) => l.startsWith("flags"));
    const flagsValue = flagsLine ? flagsLine.split(":")[1]?.trim() : undefined;
    const flags = flagsValue ? flagsValue.split(" ") : [];

    const data = {
      model,
      cores,
      threads,
      frequency_mhz: frequency,
      cache_size_kb: cacheSize || undefined,
      vendor,
      flags,
    };

    // Store in database
    this.db.prepare(
      `INSERT INTO cpu_info (model, cores, threads, frequency_mhz, cache_size_kb, vendor, flags)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      model,
      cores,
      threads,
      frequency,
      cacheSize,
      vendor,
      JSON.stringify(flags),
    );

    return CpuInfoSchema.parse(data);
  }

  async collectMemoryInfo(): Promise<typeof MemoryInfoSchema._type> {
    logger.info("Collecting memory information...");

    const meminfo = await Deno.readTextFile("/proc/meminfo");
    const lines = meminfo.split("\n");

    const getValue = (key: string): number => {
      const line = lines.find((l) => l.startsWith(key));
      if (line) {
        const parts = line.split(/\s+/);
        const value = parts[1];
        if (value) {
          return Math.floor(parseInt(value) / 1024); // Convert KB to MB
        }
      }
      return 0;
    };

    const total = getValue("MemTotal:");
    const free = getValue("MemFree:");
    const available = getValue("MemAvailable:");
    const used = total - available;
    const swapTotal = getValue("SwapTotal:");
    const swapFree = getValue("SwapFree:");
    const swapUsed = swapTotal - swapFree;

    const data = {
      total_mb: total,
      used_mb: used,
      free_mb: free,
      available_mb: available,
      swap_total_mb: swapTotal,
      swap_used_mb: swapUsed,
      swap_free_mb: swapFree,
    };

    // Store in database
    this.db.prepare(
      `INSERT INTO memory_info (total_mb, used_mb, free_mb, available_mb, swap_total_mb, swap_used_mb, swap_free_mb)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(total, used, free, available, swapTotal, swapUsed, swapFree);

    return MemoryInfoSchema.parse(data);
  }

  async collectDiskInfo(): Promise<Array<typeof DiskInfoSchema._type>> {
    logger.info("Collecting disk information...");

    const result = await runCommand(["df", "-BG"]);
    const lines = result.stdout.split("\n").slice(1); // Skip header
    const disks: Array<typeof DiskInfoSchema._type> = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      const parts = line.split(/\s+/);
      if (parts.length < 6) continue;

      // Skip virtual filesystems
      const deviceName = parts[0];
      if (!deviceName) continue;
      if (
        deviceName.startsWith("/dev/loop") ||
        deviceName === "tmpfs" ||
        deviceName === "devtmpfs" ||
        deviceName === "udev"
      ) continue;

      const device = deviceName;
      const totalStr = parts[1]?.replace("G", "") || "0";
      const usedStr = parts[2]?.replace("G", "") || "0";
      const freeStr = parts[3]?.replace("G", "") || "0";
      const percentStr = parts[4]?.replace("%", "") || "0";
      const mountPoint = parts[5] || "/";

      const disk = {
        device,
        mount_point: mountPoint,
        filesystem: await this.getFilesystemType(device || ""),
        total_gb: parseFloat(totalStr),
        used_gb: parseFloat(usedStr),
        free_gb: parseFloat(freeStr),
        use_percent: parseFloat(percentStr),
      };

      disks.push(DiskInfoSchema.parse(disk));

      // Store in database
      this.db.prepare(
        `INSERT INTO disk_info (device, mount_point, filesystem, total_gb, used_gb, free_gb, use_percent)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        device,
        mountPoint,
        disk.filesystem,
        disk.total_gb,
        disk.used_gb,
        disk.free_gb,
        disk.use_percent,
      );
    }

    return disks;
  }

  private async getFilesystemType(device: string): Promise<string> {
    try {
      const result = await runCommand([
        "blkid",
        "-o",
        "value",
        "-s",
        "TYPE",
        device,
      ]);
      return result.stdout.trim() || "unknown";
    } catch {
      return "unknown";
    }
  }

  async collectNetworkInfo(): Promise<
    Array<typeof NetworkInterfaceSchema._type>
  > {
    logger.info("Collecting network information...");

    const interfaces: Array<typeof NetworkInterfaceSchema._type> = [];
    const result = await runCommand(["ip", "-j", "addr", "show"]);

    try {
      const data = JSON.parse(result.stdout);

      for (const iface of data) {
        const name = iface.ifname;
        const state = iface.operstate?.toLowerCase() || "unknown";
        const mac = iface.address || undefined;

        // Get IPv4 address
        let ipAddress: string | undefined;
        if (iface.addr_info) {
          const ipv4 = iface.addr_info.find((a: { family?: string }) =>
            a.family === "inet"
          );
          ipAddress = ipv4?.local;
        }

        // Determine interface type
        let type = "unknown";
        if (name === "lo") type = "loopback";
        else if (name.startsWith("eth") || name.startsWith("enp")) {
          type = "ethernet";
        } else if (name.startsWith("wl")) type = "wifi";
        else if (name.startsWith("docker") || name.startsWith("br")) {
          type = "bridge";
        } else if (name.startsWith("tun") || name.startsWith("tap")) {
          type = "virtual";
        }

        const networkInterface = {
          name,
          ip_address: ipAddress,
          mac_address: mac,
          state,
          speed_mbps: await this.getInterfaceSpeed(name),
          type,
        };

        interfaces.push(NetworkInterfaceSchema.parse(networkInterface));

        // Store in database
        this.db.prepare(
          `INSERT INTO network_interfaces (name, ip_address, mac_address, state, speed_mbps, type)
           VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(
          name,
          ipAddress || null,
          mac || null,
          state,
          networkInterface.speed_mbps || null,
          type,
        );
      }
    } catch (error) {
      logger.error("Failed to parse network interfaces", { error });
    }

    return interfaces;
  }

  private async getInterfaceSpeed(name: string): Promise<number | undefined> {
    try {
      const speedFile = `/sys/class/net/${name}/speed`;
      const speed = await Deno.readTextFile(speedFile);
      return parseInt(speed.trim());
    } catch {
      return undefined;
    }
  }

  async collectGpuInfo(): Promise<void> {
    logger.info("Collecting GPU information...");

    // Check for NVIDIA GPU
    if (await commandExists("nvidia-smi")) {
      try {
        const result = await runCommand([
          "nvidia-smi",
          "--query-gpu=name,driver_version,memory.total",
          "--format=csv,noheader,nounits",
        ]);
        const parts = result.stdout.trim().split(", ");
        const model = parts[0] || "Unknown";
        const driver = parts[1] || "Unknown";
        const vram = parts[2] || "0";

        // Get CUDA version
        const cudaResult = await runCommand(["nvidia-smi"]);
        const cudaMatch = cudaResult.stdout.match(/CUDA Version:\s+(\d+\.\d+)/);
        const cudaVersion = cudaMatch ? cudaMatch[1] : null;

        this.db.prepare(
          `INSERT INTO gpu_info (vendor, model, driver_version, vram_mb, cuda_version)
           VALUES (?, ?, ?, ?, ?)`,
        ).run("NVIDIA", model, driver, parseInt(vram || "0"), cudaVersion);
      } catch (error) {
        logger.error("Failed to collect NVIDIA GPU info", { error });
      }
    }

    // Check for AMD GPU
    if (await commandExists("rocm-smi")) {
      try {
        const result = await runCommand(["rocm-smi", "--showproductname"]);
        const model = result.stdout.trim();

        this.db.prepare(
          `INSERT INTO gpu_info (vendor, model, driver_version, vram_mb, cuda_version)
           VALUES (?, ?, ?, ?, ?)`,
        ).run("AMD", model, null, null, null);
      } catch (error) {
        logger.error("Failed to collect AMD GPU info", { error });
      }
    }

    // Check for Intel GPU
    try {
      const result = await runCommand(["lspci"]);
      const intelGpu = result.stdout.split("\n").find((line) =>
        line.includes("VGA") && line.includes("Intel")
      );

      if (intelGpu) {
        const model = intelGpu.split(":")[2]?.trim() || "Intel GPU";

        this.db.prepare(
          `INSERT INTO gpu_info (vendor, model, driver_version, vram_mb, cuda_version)
           VALUES (?, ?, ?, ?, ?)`,
        ).run("Intel", model, null, null, null);
      }
    } catch (error) {
      logger.error("Failed to collect Intel GPU info", { error });
    }
  }

  async collectServiceInfo(): Promise<Array<typeof ServiceInfoSchema._type>> {
    logger.info("Collecting service information...");

    const services: Array<typeof ServiceInfoSchema._type> = [];

    // Get list of important services
    const importantServices = [
      "ssh",
      "nginx",
      "apache2",
      "mysql",
      "postgresql",
      "docker",
      "NetworkManager",
      "bluetooth",
      "cups",
      "cron",
      "systemd-resolved",
      "snapd",
      "ufw",
      "fail2ban",
      "redis",
      "mongodb",
    ];

    for (const serviceName of importantServices) {
      try {
        const result = await runCommand([
          "systemctl",
          "show",
          serviceName,
          "--no-pager",
        ]);
        const lines = result.stdout.split("\n");

        const getProperty = (prop: string): string => {
          const line = lines.find((l) => l.startsWith(prop + "="));
          return line ? line.split("=")[1] || "" : "";
        };

        const activeState = getProperty("ActiveState");
        if (
          activeState === "inactive" &&
          !getProperty("LoadState").includes("loaded")
        ) {
          continue; // Service doesn't exist
        }

        const service = {
          name: serviceName,
          status: activeState,
          enabled: getProperty("UnitFileState") === "enabled",
          description: getProperty("Description") || undefined,
        };

        services.push(ServiceInfoSchema.parse(service));

        // Store in database
        this.db.prepare(
          `INSERT INTO services (name, status, enabled, description)
           VALUES (?, ?, ?, ?)`,
        ).run(
          serviceName,
          activeState,
          service.enabled ? 1 : 0,
          service.description || null,
        );
      } catch {
        // Service doesn't exist, skip
      }
    }

    return services;
  }

  async collectAll(): Promise<void> {
    const categories = this.config.categories || [
      "system",
      "cpu",
      "memory",
      "disk",
      "network",
      "gpu",
      "services",
    ];

    if (categories.includes("system")) {
      const systemInfo = await this.collectSystemInfo();
      if (this.config.verbose) {
        logger.info("System info collected", systemInfo);
      }
    }

    if (categories.includes("cpu")) {
      const cpuInfo = await this.collectCpuInfo();
      if (this.config.verbose) {
        logger.info("CPU info collected", cpuInfo);
      }
    }

    if (categories.includes("memory")) {
      const memoryInfo = await this.collectMemoryInfo();
      if (this.config.verbose) {
        logger.info("Memory info collected", memoryInfo);
      }
    }

    if (categories.includes("disk")) {
      const diskInfo = await this.collectDiskInfo();
      if (this.config.verbose) {
        logger.info("Disk info collected", { disks: diskInfo.length });
      }
    }

    if (categories.includes("network")) {
      const networkInfo = await this.collectNetworkInfo();
      if (this.config.verbose) {
        logger.info("Network info collected", {
          interfaces: networkInfo.length,
        });
      }
    }

    if (categories.includes("gpu")) {
      await this.collectGpuInfo();
      if (this.config.verbose) {
        logger.info("GPU info collected");
      }
    }

    if (categories.includes("services")) {
      const services = await this.collectServiceInfo();
      if (this.config.verbose) {
        logger.info("Services collected", { count: services.length });
      }
    }
  }

  displaySummary(): void {
    console.log("\n📊 System Information Summary");
    console.log("=".repeat(60));

    // Get latest system info
    const systemInfo = this.db.prepare(
      "SELECT * FROM system_info ORDER BY timestamp DESC LIMIT 1",
    ).all();

    if (systemInfo.length > 0) {
      const sys = systemInfo[0] as {
        hostname: string;
        os_name: string;
        os_version: string;
        kernel: string;
        architecture: string;
        timezone: string;
        uptime_seconds: number;
      };
      console.log("\n🖥️  System:");
      console.log(`  Hostname: ${sys.hostname}`);
      console.log(`  OS: ${sys.os_name} ${sys.os_version}`);
      console.log(`  Kernel: ${sys.kernel}`);
      console.log(`  Architecture: ${sys.architecture}`);
      console.log(`  Timezone: ${sys.timezone}`);
      console.log(`  Uptime: ${Math.floor(sys.uptime_seconds / 3600)} hours`);
    }

    // Get latest CPU info
    const cpuInfo = this.db.prepare(
      "SELECT * FROM cpu_info ORDER BY timestamp DESC LIMIT 1",
    ).all();

    if (cpuInfo.length > 0) {
      const cpu = cpuInfo[0] as {
        model: string;
        cores: number;
        threads: number;
        frequency_mhz: number;
        vendor: string;
      };
      console.log("\n⚙️  CPU:");
      console.log(`  Model: ${cpu.model}`);
      console.log(`  Cores: ${cpu.cores} / Threads: ${cpu.threads}`);
      console.log(`  Frequency: ${cpu.frequency_mhz} MHz`);
      console.log(`  Vendor: ${cpu.vendor}`);
    }

    // Get latest memory info
    const memInfo = this.db.prepare(
      "SELECT * FROM memory_info ORDER BY timestamp DESC LIMIT 1",
    ).all();

    if (memInfo.length > 0) {
      const mem = memInfo[0] as {
        total_mb: number;
        used_mb: number;
        available_mb: number;
        swap_total_mb: number;
        swap_used_mb: number;
      };
      console.log("\n💾 Memory:");
      console.log(`  Total: ${(mem.total_mb / 1024).toFixed(1)} GB`);
      console.log(`  Used: ${(mem.used_mb / 1024).toFixed(1)} GB`);
      console.log(`  Available: ${(mem.available_mb / 1024).toFixed(1)} GB`);
      console.log(
        `  Swap: ${(mem.swap_total_mb / 1024).toFixed(1)} GB total, ${
          (mem.swap_used_mb / 1024).toFixed(1)
        } GB used`,
      );
    }

    // Get disk info
    const diskInfo = this.db.prepare(
      "SELECT * FROM disk_info WHERE timestamp = (SELECT MAX(timestamp) FROM disk_info)",
    ).all();

    if (diskInfo.length > 0) {
      console.log("\n💿 Disks:");
      for (const disk of diskInfo) {
        const d = disk as {
          mount_point: string;
          used_gb: number;
          total_gb: number;
          use_percent: number;
        };
        if (d.mount_point === "/" || d.mount_point === "/home") {
          console.log(
            `  ${d.mount_point}: ${d.used_gb.toFixed(1)} GB used of ${
              d.total_gb.toFixed(1)
            } GB (${d.use_percent.toFixed(0)}%)`,
          );
        }
      }
    }

    // Get network interfaces
    const netInfo = this.db.prepare(
      "SELECT * FROM network_interfaces WHERE timestamp = (SELECT MAX(timestamp) FROM network_interfaces) AND state = 'up'",
    ).all();

    if (netInfo.length > 0) {
      console.log("\n🌐 Network:");
      for (const net of netInfo) {
        const n = net as {
          name: string;
          ip_address?: string;
          type: string;
        };
        if (n.name !== "lo") {
          console.log(`  ${n.name}: ${n.ip_address || "no IP"} (${n.type})`);
        }
      }
    }

    // Get GPU info
    const gpuInfo = this.db.prepare(
      "SELECT * FROM gpu_info ORDER BY timestamp DESC LIMIT 1",
    ).all();

    if (gpuInfo.length > 0) {
      const gpu = gpuInfo[0] as {
        vendor: string;
        model: string;
        driver_version?: string;
        vram_mb?: number;
        cuda_version?: string;
      };
      console.log("\n🎮 GPU:");
      console.log(`  ${gpu.vendor} ${gpu.model}`);
      if (gpu.driver_version) console.log(`  Driver: ${gpu.driver_version}`);
      if (gpu.vram_mb) console.log(`  VRAM: ${gpu.vram_mb} MB`);
      if (gpu.cuda_version) console.log(`  CUDA: ${gpu.cuda_version}`);
    }

    // Get active services count
    const services = this.db.prepare(
      "SELECT COUNT(*) as count FROM services WHERE timestamp = (SELECT MAX(timestamp) FROM services) AND status = 'active'",
    ).all();

    if (services.length > 0) {
      const svc = services[0] as {
        count?: number;
        "COUNT(*)"?: number;
      };
      console.log("\n🔧 Services:");
      console.log(`  Active services: ${svc.count || svc["COUNT(*)"] || 0}`);
    }

    console.log("\n" + "=".repeat(60));
    console.log(`📁 Database: ${this.config.dbPath}`);
  }

  exportToJson(): string {
    const data: Record<string, unknown> = {};

    const tables = [
      "system_info",
      "cpu_info",
      "memory_info",
      "disk_info",
      "network_interfaces",
      "gpu_info",
      "services",
    ];

    for (const table of tables) {
      const result = this.db.prepare(
        `SELECT * FROM ${table} WHERE timestamp = (SELECT MAX(timestamp) FROM ${table})`,
      ).all();
      data[table] = result;
    }

    return JSON.stringify(data, null, 2);
  }

  close(): void {
    this.db.close();
  }
}

async function main() {
  const args = Deno.args;
  const config: Config = {
    dbPath: "~/.local/share/ubuntu-config/system-info.db",
    outputFormat: "table",
    collectAll: true,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--db":
      case "-d":
        config.dbPath = args[++i] || config.dbPath;
        break;
      case "--output":
      case "-o":
        config.outputFormat = args[++i] as "json" | "table" | "markdown";
        break;
      case "--category":
      case "-c":
        if (!config.categories) config.categories = [];
        config.categories.push(
          args[++i] as (
            | "system"
            | "cpu"
            | "memory"
            | "disk"
            | "network"
            | "gpu"
            | "services"
            | "packages"
            | "containers"
          ),
        );
        config.collectAll = false;
        break;
      case "--verbose":
      case "-v":
        config.verbose = true;
        break;
      case "--export-json":
        config.outputFormat = "json";
        break;
      case "--help":
      case "-h":
        console.log(`
System Information Collector

Collects comprehensive system information and stores it in SQLite database.

Usage: deno run --allow-all collect-system-info.ts [options]

Options:
  --db, -d <path>      Database path (default: ~/.local/share/ubuntu-config/system-info.db)
  --output, -o <fmt>   Output format: table, json, markdown (default: table)
  --category, -c <cat> Collect specific category (can be used multiple times)
                       Categories: system, cpu, memory, disk, network, gpu, services, packages
  --verbose, -v        Show verbose output
  --export-json        Export all data as JSON
  --help, -h           Show this help message

Examples:
  # Collect all information
  deno run --allow-all collect-system-info.ts

  # Collect only CPU and memory info
  deno run --allow-all collect-system-info.ts -c cpu -c memory

  # Export to JSON
  deno run --allow-all collect-system-info.ts --export-json > system-info.json

  # Use custom database
  deno run --allow-all collect-system-info.ts --db /tmp/test.db
`);
        Deno.exit(0);
    }
  }

  try {
    const validConfig = ConfigSchema.parse(config);
    logger.info("Starting system information collection", {
      dbPath: validConfig.dbPath,
      categories: validConfig.categories || "all",
    });

    const collector = new SystemInfoCollector(validConfig);
    await collector.collectAll();

    if (validConfig.outputFormat === "json") {
      console.log(collector.exportToJson());
    } else {
      collector.displaySummary();
    }

    collector.close();
    logger.success("System information collection completed");
  } catch (error) {
    logger.error("Failed to collect system information", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}

export { ConfigSchema, SystemInfoCollector };
