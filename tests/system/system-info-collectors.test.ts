import { assertEquals, assertExists } from "../../deps.ts";
import { collectCpuInfo } from "../../scripts/system/system-info-collectors/cpu.ts";
import { collectMemoryInfo } from "../../scripts/system/system-info-collectors/memory.ts";
import { collectDiskInfo } from "../../scripts/system/system-info-collectors/disk.ts";
import { collectNetworkInfo } from "../../scripts/system/system-info-collectors/network.ts";
import { collectGpuInfo } from "../../scripts/system/system-info-collectors/gpu.ts";
import { collectServiceInfo } from "../../scripts/system/system-info-collectors/services.ts";
import { collectSystemInfo } from "../../scripts/system/system-info-collectors/system.ts";
import { initDatabase } from "../../scripts/system/system-info-collectors/database.ts";
import { DB } from "https://deno.land/x/sqlite@v3.8/mod.ts";

Deno.test("collectSystemInfo - should return system information", async () => {
  const info = await collectSystemInfo();

  assertExists(info);
  assertExists(info["hostname"]);
  assertExists(info["kernel"]);
  assertExists(info["osName"]);
  assertExists(info["osVersion"]);
  assertExists(info["architecture"]);
  assertEquals(typeof info["uptimeSeconds"], "number");
  assertExists(info["timezone"]);
});

Deno.test("collectCpuInfo - should return CPU information", async () => {
  const info = await collectCpuInfo();

  assertExists(info);
  assertExists(info["model"]);
  assertEquals(typeof info["cores"], "number");
  assertEquals(typeof info["threads"], "number");
  assertEquals(typeof info["usagePercent"], "number");

  // Validate ranges
  assertEquals((info["cores"] as number) > 0, true);
  assertEquals((info["usagePercent"] as number) >= 0, true);
  assertEquals((info["usagePercent"] as number) <= 100, true);
});

Deno.test("collectMemoryInfo - should return memory information", async () => {
  const info = await collectMemoryInfo();

  assertExists(info);
  assertEquals(typeof info["totalMb"], "number");
  assertEquals(typeof info["availableMb"], "number");
  assertEquals(typeof info["usedMb"], "number");
  assertEquals(typeof info["usagePercent"], "number");

  // Validate memory values
  const totalMb = info["totalMb"] as number;
  const availableMb = info["availableMb"] as number;
  const usedMb = info["usedMb"] as number;

  assertEquals(totalMb > 0, true);
  assertEquals(availableMb >= 0, true);
  assertEquals(usedMb >= 0, true);
  assertEquals(availableMb <= totalMb, true);
});

Deno.test("collectDiskInfo - should return disk information", async () => {
  const disks = await collectDiskInfo();

  assertExists(disks);
  assertEquals(Array.isArray(disks), true);

  if (disks.length > 0) {
    const disk = disks[0];
    assertExists(disk);
    assertExists(disk["device"]);
    assertExists(disk["mountPoint"]);
    assertExists(disk["filesystem"]);
    assertEquals(typeof disk["sizeGb"], "number");
    assertEquals(typeof disk["usedGb"], "number");
    assertEquals(typeof disk["availableGb"], "number");
    assertEquals(typeof disk["usagePercent"], "number");
  }
});

Deno.test("collectNetworkInfo - should return network information", async () => {
  const interfaces = await collectNetworkInfo();

  assertExists(interfaces);
  assertEquals(Array.isArray(interfaces), true);

  if (interfaces.length > 0) {
    const iface = interfaces[0];
    assertExists(iface);
    assertExists(iface["name"]);
    assertExists(iface["state"]);
  }
});

Deno.test("collectGpuInfo - should return GPU information array", async () => {
  const gpus = await collectGpuInfo();

  assertExists(gpus);
  assertEquals(Array.isArray(gpus), true);

  // GPU info may be empty on systems without discrete GPUs
  if (gpus.length > 0) {
    const gpu = gpus[0];
    assertExists(gpu);
    assertExists(gpu["vendor"]);
    assertExists(gpu["model"]);
  }
});

Deno.test("collectServiceInfo - should return service information", async () => {
  const services = await collectServiceInfo();

  assertExists(services);
  assertEquals(Array.isArray(services), true);
  assertEquals(services.length > 0, true);

  const service = services[0];
  assertExists(service);
  assertExists(service["name"]);
  assertExists(service["state"]);
  assertEquals(typeof service["enabled"], "number");
});

Deno.test("initDatabase - should create all required tables", () => {
  const db = new DB(":memory:");

  // Should not throw
  initDatabase(db);

  // Verify tables exist
  const tables = db.query<[string]>(
    "SELECT name FROM sqlite_master WHERE type='table'",
  );

  const tableNames = tables.map((row) => row[0]);

  assertEquals(tableNames.includes("system_info"), true);
  assertEquals(tableNames.includes("cpu_info"), true);
  assertEquals(tableNames.includes("memory_info"), true);
  assertEquals(tableNames.includes("disk_info"), true);
  assertEquals(tableNames.includes("network_info"), true);
  assertEquals(tableNames.includes("gpu_info"), true);
  assertEquals(tableNames.includes("service_info"), true);

  db.close();
});

Deno.test("initDatabase - should be idempotent", () => {
  const db = new DB(":memory:");

  // Should not throw when called multiple times
  initDatabase(db);
  initDatabase(db);
  initDatabase(db);

  // Tables should still exist and be queryable
  const tables = db.query<[string]>(
    "SELECT name FROM sqlite_master WHERE type='table'",
  );

  assertEquals(tables.length >= 7, true);

  db.close();
});

Deno.test("memory info - swap information should be valid", async () => {
  const info = await collectMemoryInfo();

  if (info["swapTotalMb"]) {
    const swapTotal = info["swapTotalMb"] as number;
    const swapUsed = info["swapUsedMb"] as number;

    assertEquals(swapTotal >= 0, true);
    assertEquals(swapUsed >= 0, true);
    assertEquals(swapUsed <= swapTotal, true);
  }
});

Deno.test("disk info - usage percentages should be valid", async () => {
  const disks = await collectDiskInfo();

  for (const disk of disks) {
    const usagePercent = disk["usagePercent"] as number;
    assertEquals(usagePercent >= 0, true);
    assertEquals(usagePercent <= 100, true);
  }
});

Deno.test("cpu info - frequency values should be reasonable", async () => {
  const info = await collectCpuInfo();

  if (info["currentFreqMhz"]) {
    const freq = info["currentFreqMhz"] as number;
    assertEquals(freq > 0, true);
    assertEquals(freq < 10000, true); // Less than 10GHz is reasonable
  }

  if (info["maxFreqMhz"]) {
    const maxFreq = info["maxFreqMhz"] as number;
    assertEquals(maxFreq > 0, true);
    assertEquals(maxFreq < 10000, true);
  }
});
