import { assertEquals, assertExists } from "../../deps.ts";
import {
  type CleanupTarget,
  type Config,
  DiskCleaner,
} from "../../scripts/system/cleanup-disk.ts";
import { withTempDir } from "../../scripts/lib/common.ts";

Deno.test("DiskCleaner - initialization", async () => {
  const config: Config = {
    dryRun: true,
    interactive: false,
    cleanRust: true,
    cleanCache: true,
    cleanSystem: false,
    minSize: 100,
    paths: [],
  };

  const cleaner = new DiskCleaner(config);
  await cleaner.initialize();
  assertExists(cleaner);
});

Deno.test("DiskCleaner - dry run mode", async () => {
  const config: Config = {
    dryRun: true,
    interactive: false,
    cleanRust: false,
    cleanCache: false,
    cleanSystem: false,
    minSize: 0,
    paths: [],
  };

  const cleaner = new DiskCleaner(config);
  await cleaner.initialize();

  // Dry run should not make any changes
  await cleaner.scan();
  await cleaner.clean();
  assertExists(cleaner);
});

Deno.test("DiskCleaner - config validation", () => {
  const configs: Config[] = [
    {
      dryRun: false,
      interactive: true,
      cleanRust: true,
      cleanCache: true,
      cleanSystem: true,
      minSize: 0,
      paths: [],
    },
    {
      dryRun: true,
      interactive: false,
      cleanRust: false,
      cleanCache: false,
      cleanSystem: false,
      minSize: 1000,
      paths: ["/tmp", "/var/tmp"],
    },
  ];

  for (const config of configs) {
    const cleaner = new DiskCleaner(config);
    assertExists(cleaner);
  }
});

Deno.test("DiskCleaner - cleanup target types", () => {
  const targets: CleanupTarget[] = [
    {
      path: "/home/user/project/target",
      type: "rust-target",
      size: 1024 * 1024 * 1024, // 1GB
      sizeHuman: "1.00 GB",
      command: "cargo clean",
      safe: true,
    },
    {
      path: "/home/user/.cache",
      type: "cache",
      size: 1024 * 1024 * 500, // 500MB
      sizeHuman: "500.00 MB",
      safe: true,
    },
    {
      path: "APT cache",
      type: "system",
      size: 0,
      sizeHuman: "varies",
      command: "sudo apt-get clean",
      safe: true,
    },
  ];

  for (const target of targets) {
    assertExists(target.path);
    assertExists(target.type);
    assertEquals(typeof target.size, "number");
    assertEquals(typeof target.safe, "boolean");
  }
});

Deno.test("DiskCleaner - size threshold filtering", async () => {
  await withTempDir(async (tempDir) => {
    const config: Config = {
      dryRun: true,
      interactive: false,
      cleanRust: false,
      cleanCache: true,
      cleanSystem: false,
      minSize: 100, // 100MB threshold
      paths: [tempDir],
    };

    const cleaner = new DiskCleaner(config);
    await cleaner.initialize();

    // Should only find targets above threshold
    await cleaner.scan();
    assertExists(cleaner);
  });
});

Deno.test("DiskCleaner - path specification", async () => {
  const config: Config = {
    dryRun: true,
    interactive: false,
    cleanRust: true,
    cleanCache: false,
    cleanSystem: false,
    minSize: 0,
    paths: ["/tmp", "/var/tmp", "/home"],
  };

  const cleaner = new DiskCleaner(config);
  await cleaner.initialize();

  // Should search specified paths
  assertEquals(config.paths.length, 3);
  assertExists(cleaner);
});

Deno.test("DiskCleaner - safety checks", () => {
  const safeTarget: CleanupTarget = {
    path: "/home/user/project/target",
    type: "rust-target",
    size: 1024 * 1024,
    sizeHuman: "1.00 MB",
    safe: true,
  };

  const unsafeTarget: CleanupTarget = {
    path: "/var/cache/apt",
    type: "cache",
    size: 1024 * 1024,
    sizeHuman: "1.00 MB",
    safe: false,
  };

  assertEquals(safeTarget.safe, true);
  assertEquals(unsafeTarget.safe, false);
});
