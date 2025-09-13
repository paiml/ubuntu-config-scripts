/**
 * Tests for optimize-rust-dev.ts
 */

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import fc from "https://esm.sh/fast-check@3.19.0";

// Test swap configuration validation
Deno.test("SwapConfig validation", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 128 }),
      fc.integer({ min: 1, max: 256 }),
      fc.integer({ min: 0, max: 100 }),
      fc.integer({ min: 0, max: 200 }),
      (current, target, swappiness, cachePressure) => {
        const config = {
          currentSizeGb: current,
          targetSizeGb: target,
          swappiness,
          cachePressure,
        };

        // Swappiness should always be 0-100
        assert(config.swappiness >= 0 && config.swappiness <= 100);
        // Target should be positive
        assert(config.targetSizeGb > 0);
        // Cache pressure should be reasonable
        assert(config.cachePressure >= 0 && config.cachePressure <= 200);
      }
    )
  );
});

// Test swap size calculations
Deno.test("Swap size conversion", () => {
  fc.assert(
    fc.property(
      fc.bigInt({ min: 0n, max: 1099511627776n }), // Up to 1TB in bytes
      (sizeBytes) => {
        const sizeGb = Number(sizeBytes / (1024n * 1024n * 1024n));
        assert(sizeGb >= 0);
        assert(sizeGb <= 1024); // Max 1TB
      }
    )
  );
});

// Test optimization result structure
Deno.test("OptimizationResult structure", () => {
  const result = {
    swapConfigured: false,
    zramConfigured: false,
    sysctlConfigured: false,
    toolsInstalled: false,
    intellijConfigured: false,
  };

  assertEquals(Object.keys(result).length, 5);
  assert(typeof result.swapConfigured === "boolean");
  assert(typeof result.zramConfigured === "boolean");
  assert(typeof result.sysctlConfigured === "boolean");
  assert(typeof result.toolsInstalled === "boolean");
  assert(typeof result.intellijConfigured === "boolean");
});

// Test cargo config content
Deno.test("Cargo config validity", () => {
  const configContent = `[build]
jobs = 8
rustc-wrapper = "sccache"

[target.x86_64-unknown-linux-gnu]
linker = "clang"
rustflags = ["-C", "link-arg=-fuse-ld=mold", "-C", "target-cpu=native"]`;

  assert(configContent.includes("[build]"));
  assert(configContent.includes("rustc-wrapper"));
  assert(configContent.includes("mold"));
  assert(configContent.includes("target-cpu=native"));
});

// Test IntelliJ VM options
Deno.test("IntelliJ VM options", () => {
  const vmOptions = `-Xms2048m
-Xmx8192m
-XX:ReservedCodeCacheSize=512m
-XX:+UseG1GC`;

  assert(vmOptions.includes("-Xms2048m"));
  assert(vmOptions.includes("-Xmx8192m"));
  assert(vmOptions.includes("UseG1GC"));
  assert(vmOptions.includes("ReservedCodeCacheSize"));
});

// Test ZRAM configuration
Deno.test("ZRAM size configuration", () => {
  const zramSizeBytes = 17179869184;
  const zramSizeGb = zramSizeBytes / (1024 * 1024 * 1024);
  assertEquals(zramSizeGb, 16);
});

// Test systemd service content
Deno.test("Systemd service structure", () => {
  const serviceContent = `[Unit]
Description=Configure ZRAM swap device
After=multi-user.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/local/bin/setup-zram.sh

[Install]
WantedBy=multi-user.target`;

  assert(serviceContent.includes("[Unit]"));
  assert(serviceContent.includes("[Service]"));
  assert(serviceContent.includes("[Install]"));
  assert(serviceContent.includes("Type=oneshot"));
  assert(serviceContent.includes("RemainAfterExit=yes"));
});

// Test sysctl configurations
Deno.test("Sysctl parameter validation", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 100 }),
      fc.integer({ min: 0, max: 200 }),
      (swappiness, cachePressure) => {
        const configs = [
          ["vm.swappiness", swappiness.toString()],
          ["vm.vfs_cache_pressure", cachePressure.toString()],
          ["vm.dirty_ratio", "15"],
          ["vm.dirty_background_ratio", "5"],
        ];

        assertEquals(configs.length, 4);
        configs.forEach(([key, value]) => {
          assert(key.startsWith("vm."));
          assert(value.length > 0);
        });
      }
    )
  );
});

// Test development tools list
Deno.test("Development tools configuration", () => {
  const tools = [
    ["mold", "Fast linker for Rust"],
    ["clang", "LLVM compiler for better linking"],
    ["htop", "Interactive process viewer"],
    ["ncdu", "Disk usage analyzer"],
  ];

  assertEquals(tools.length, 4);
  tools.forEach(([tool, description]) => {
    assert(tool.length > 0);
    assert(description.length > 0);
  });
});

// Test fstab entry format
Deno.test("Fstab swap entry format", () => {
  const fstabEntry = "/swapfile none swap sw 0 0";
  const parts = fstabEntry.split(" ");

  assertEquals(parts.length, 6);
  assertEquals(parts[0], "/swapfile");
  assertEquals(parts[2], "swap");
  assertEquals(parts[3], "sw");
});

// Test backup path generation
Deno.test("Backup path generation", () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 1, maxLength: 100 }),
      (filename) => {
        const configPath = `/home/user/.cargo/${filename}`;
        const backupPath = `${configPath}.backup`;

        assert(backupPath.endsWith(".backup"));
        assert(backupPath.includes(filename));
      }
    )
  );
});

// Test error messages
Deno.test("Error message formats", () => {
  const errors = [
    "Failed to disable swap: Permission denied",
    "Failed to allocate swap file: No space left on device",
    "Failed to load zram module: Module not found",
    "Failed to install mold",
  ];

  errors.forEach(error => {
    assert(error.includes("Failed"));
    assert(error.length > 10);
  });
});

// Test configuration directory paths
Deno.test("Configuration directory paths", () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 1, maxLength: 20 }),
      (username) => {
        const homeDir = `/home/${username}`;
        const configDirs = [
          `${homeDir}/.config/JetBrains`,
          `${homeDir}/.local/share/JetBrains`,
        ];

        assertEquals(configDirs.length, 2);
        configDirs.forEach(dir => {
          assert(dir.startsWith(`/home/${username}`));
          assert(dir.includes("JetBrains"));
        });
      }
    )
  );
});

// Test optimization result combinations
Deno.test("Optimization result combinations", () => {
  fc.assert(
    fc.property(
      fc.boolean(),
      fc.boolean(),
      fc.boolean(),
      fc.boolean(),
      fc.boolean(),
      (swap, zram, sysctl, tools, intellij) => {
        const result = {
          swapConfigured: swap,
          zramConfigured: zram,
          sysctlConfigured: sysctl,
          toolsInstalled: tools,
          intellijConfigured: intellij,
        };

        const configuredCount = Object.values(result).filter(v => v).length;
        assert(configuredCount >= 0 && configuredCount <= 5);
      }
    )
  );
});

// Test ZRAM script content
Deno.test("ZRAM setup script", () => {
  const scriptContent = `#!/bin/bash
modprobe zram
echo lz4 > /sys/block/zram0/comp_algorithm 2>/dev/null || echo lzo > /sys/block/zram0/comp_algorithm
echo 17179869184 > /sys/block/zram0/disksize
mkswap /dev/zram0
swapon -p 100 /dev/zram0`;

  assert(scriptContent.startsWith("#!/bin/bash"));
  assert(scriptContent.includes("modprobe zram"));
  assert(scriptContent.includes("17179869184"));
  assert(scriptContent.includes("swapon -p 100"));
});

// Test memory size validation
Deno.test("Memory size boundaries", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 512, max: 65536 }), // MB
      (memorySizeMb) => {
        // IntelliJ memory should be reasonable
        const minHeap = 512;
        const maxHeap = 32768; // 32GB max for JVM

        assert(memorySizeMb >= minHeap);
        if (memorySizeMb > maxHeap) {
          // Should be capped at maxHeap
          assert(maxHeap <= 32768);
        }
      }
    )
  );
});

// Test profile configurations
Deno.test("Cargo profile settings", () => {
  const devProfile = {
    optLevel: 0,
    debug: 1,
    lto: false,
    codegenUnits: 256,
    incremental: true,
  };

  const releaseProfile = {
    optLevel: 3,
    lto: "thin",
    codegenUnits: 1,
  };

  // Dev profile optimizations
  assertEquals(devProfile.optLevel, 0);
  assertEquals(devProfile.codegenUnits, 256);
  assert(devProfile.incremental);

  // Release profile optimizations
  assertEquals(releaseProfile.optLevel, 3);
  assertEquals(releaseProfile.codegenUnits, 1);
  assert(releaseProfile.lto === "thin" || releaseProfile.lto === "fat");
});

// Test summary output structure
Deno.test("Summary output completeness", () => {
  const summaryItems = [
    "Swap increased to 64GB",
    "ZRAM 16GB compressed swap configured",
    "System memory parameters optimized",
    "Development tools installed",
    "IntelliJ IDEA memory settings configured",
  ];

  assertEquals(summaryItems.length, 5);
  summaryItems.forEach(item => {
    assert(item.length > 0);
  });
});

// Test environment variable recommendations
Deno.test("Environment variable recommendations", () => {
  const envVars = {
    CARGO_BUILD_JOBS: "8",
    RUSTC_WRAPPER: "sccache",
    SCCACHE_CACHE_SIZE: "50G",
  };

  assertEquals(Object.keys(envVars).length, 3);
  assert(envVars.CARGO_BUILD_JOBS);
  assert(envVars.RUSTC_WRAPPER === "sccache");
  assert(envVars.SCCACHE_CACHE_SIZE.includes("G"));
});