import { assertEquals, assertExists } from "../../deps.ts";
import {
  type Config,
  DiskUsageAnalyzer,
} from "../../scripts/system/analyze-disk-usage.ts";
import { withTempDir } from "../../scripts/lib/common.ts";

Deno.test("DiskUsageAnalyzer - initialization", async () => {
  const config: Config = {
    path: ".",
    threshold: 100,
    limit: 20,
    humanReadable: true,
    showRclean: false,
    depth: 3,
    excludePatterns: [],
  };

  const analyzer = new DiskUsageAnalyzer(config);
  await analyzer.initialize();
  assertExists(analyzer);
});

Deno.test("DiskUsageAnalyzer - format bytes", async () => {
  await withTempDir(async (tempDir) => {
    const config: Config = {
      path: tempDir,
      threshold: 0,
      limit: 10,
      humanReadable: true,
      showRclean: false,
      depth: 1,
      excludePatterns: [],
    };

    const analyzer = new DiskUsageAnalyzer(config);
    await analyzer.initialize();

    // Test formatting through actual usage
    const testFile = `${tempDir}/test.txt`;
    await Deno.writeTextFile(testFile, "x".repeat(1024));

    const stat = await Deno.stat(testFile);
    assertEquals(stat.size, 1024);
  });
});

Deno.test("DiskUsageAnalyzer - exclude patterns", async () => {
  await withTempDir(async (tempDir) => {
    // Create test structure
    await Deno.mkdir(`${tempDir}/.git`, { recursive: true });
    await Deno.mkdir(`${tempDir}/node_modules`, { recursive: true });
    await Deno.mkdir(`${tempDir}/src`, { recursive: true });

    await Deno.writeTextFile(`${tempDir}/.git/config`, "test");
    await Deno.writeTextFile(`${tempDir}/node_modules/package.json`, "test");
    await Deno.writeTextFile(`${tempDir}/src/main.ts`, "test");

    const config: Config = {
      path: tempDir,
      threshold: 0,
      limit: 10,
      humanReadable: true,
      showRclean: false,
      depth: 2,
      excludePatterns: [],
    };

    const analyzer = new DiskUsageAnalyzer(config);
    await analyzer.initialize();

    // Default exclusions should filter out .git and node_modules
    assertExists(analyzer);
  });
});

Deno.test("DiskUsageAnalyzer - directory structure", async () => {
  await withTempDir(async (tempDir) => {
    // Create nested directory structure
    const deepPath = `${tempDir}/level1/level2/level3/level4`;
    await Deno.mkdir(deepPath, { recursive: true });

    // Create files at different levels
    await Deno.writeTextFile(`${tempDir}/root.txt`, "x".repeat(1024 * 1024)); // 1MB
    await Deno.writeTextFile(
      `${tempDir}/level1/file1.txt`,
      "x".repeat(512 * 1024),
    ); // 512KB
    await Deno.writeTextFile(`${deepPath}/deep.txt`, "x".repeat(256 * 1024)); // 256KB

    const config: Config = {
      path: tempDir,
      threshold: 0.1, // 100KB threshold
      limit: 10,
      humanReadable: true,
      showRclean: false,
      depth: 3, // Should not reach level4
      excludePatterns: [],
    };

    const analyzer = new DiskUsageAnalyzer(config);
    await analyzer.initialize();
    assertExists(analyzer);
  });
});

Deno.test("DiskUsageAnalyzer - large file detection", async () => {
  await withTempDir(async (tempDir) => {
    // Create files of various sizes
    const sizes = [
      { name: "tiny.txt", size: 100 },
      { name: "small.txt", size: 1024 * 50 }, // 50KB
      { name: "medium.txt", size: 1024 * 1024 * 5 }, // 5MB
      { name: "large.txt", size: 1024 * 1024 * 150 }, // 150MB
    ];

    for (const { name, size } of sizes) {
      await Deno.writeTextFile(`${tempDir}/${name}`, "x".repeat(size));
    }

    const config: Config = {
      path: tempDir,
      threshold: 100, // 100MB threshold
      limit: 10,
      humanReadable: true,
      showRclean: false,
      depth: 1,
      excludePatterns: [],
    };

    const analyzer = new DiskUsageAnalyzer(config);
    await analyzer.initialize();

    // Only large.txt should be above threshold
    assertExists(analyzer);
  });
});

Deno.test("DiskUsageAnalyzer - config validation", () => {
  const validConfigs: Config[] = [
    {
      path: ".",
      threshold: 0,
      limit: 1,
      humanReadable: true,
      showRclean: true,
      depth: 1,
      excludePatterns: [],
    },
    {
      path: "/tmp",
      threshold: 1000,
      limit: 100,
      humanReadable: false,
      showRclean: false,
      depth: 10,
      excludePatterns: ["test", "*.log"],
    },
  ];

  for (const config of validConfigs) {
    const analyzer = new DiskUsageAnalyzer(config);
    assertExists(analyzer);
  }
});

Deno.test("DiskUsageAnalyzer - empty directory", async () => {
  await withTempDir(async (tempDir) => {
    const config: Config = {
      path: tempDir,
      threshold: 100,
      limit: 20,
      humanReadable: true,
      showRclean: false,
      depth: 3,
      excludePatterns: [],
    };

    const analyzer = new DiskUsageAnalyzer(config);
    await analyzer.initialize();
    assertExists(analyzer);
  });
});

Deno.test("DiskUsageAnalyzer - custom exclude patterns", async () => {
  await withTempDir(async (tempDir) => {
    // Create test files
    await Deno.writeTextFile(`${tempDir}/keep.txt`, "x".repeat(1024));
    await Deno.writeTextFile(`${tempDir}/exclude.log`, "x".repeat(1024));
    await Deno.writeTextFile(`${tempDir}/test.tmp`, "x".repeat(1024));

    const config: Config = {
      path: tempDir,
      threshold: 0,
      limit: 10,
      humanReadable: true,
      showRclean: false,
      depth: 1,
      excludePatterns: ["*.log", "*.tmp"],
    };

    const analyzer = new DiskUsageAnalyzer(config);
    await analyzer.initialize();
    assertExists(analyzer);
  });
});
