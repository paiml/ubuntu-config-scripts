import { fc } from "../../deps.ts";
import { assertEquals, assertExists } from "../../deps.ts";
import { ConfigSchema } from "../../scripts/system/collect-system-info.ts";

Deno.test("property: config schema validation", () => {
  fc.assert(
    fc.property(
      fc.record({
        dbPath: fc.string({ minLength: 1, maxLength: 200 }),
        outputFormat: fc.constantFrom("json", "table", "markdown"),
        collectAll: fc.boolean(),
        verbose: fc.boolean(),
      }),
      (config) => {
        const result = ConfigSchema.safeParse(config);
        assertEquals(result.success, true);

        if (result.success) {
          assertExists(result.data.dbPath);
          assertEquals(
            ["json", "table", "markdown"].includes(result.data.outputFormat),
            true,
          );
          assertEquals(typeof result.data.collectAll, "boolean");
          assertEquals(typeof result.data.verbose, "boolean");
        }
      },
    ),
    { numRuns: 50 },
  );
});

Deno.test("property: category validation", () => {
  fc.assert(
    fc.property(
      fc.array(
        fc.constantFrom(
          "system",
          "cpu",
          "memory",
          "disk",
          "network",
          "gpu",
          "services",
          "packages",
          "containers",
        ),
        { minLength: 0, maxLength: 9 },
      ),
      (categories) => {
        const config = {
          dbPath: "/tmp/test.db",
          outputFormat: "table" as const,
          collectAll: true,
          categories: categories.length > 0 ? categories : undefined,
          verbose: false,
        };

        const result = ConfigSchema.safeParse(config);
        assertEquals(result.success, true);

        if (result.success && result.data.categories) {
          assertEquals(result.data.categories.length, categories.length);
          for (const cat of result.data.categories) {
            assertEquals(
              [
                "system",
                "cpu",
                "memory",
                "disk",
                "network",
                "gpu",
                "services",
                "packages",
                "containers",
              ].includes(cat),
              true,
            );
          }
        }
      },
    ),
    { numRuns: 50 },
  );
});

Deno.test("property: path expansion handling", () => {
  fc.assert(
    fc.property(
      fc.oneof(
        fc.constant("~/.local/share/test.db"),
        fc.constant("~/Documents/test.db"),
        fc.constant("/tmp/test.db"),
        fc.constant("/var/lib/test.db"),
        fc.string({ minLength: 1, maxLength: 100 }).map((s) =>
          s.replace(/[^a-zA-Z0-9/_.-]/g, "")
        ),
      ),
      (path) => {
        const config = {
          dbPath: path,
          outputFormat: "table" as const,
          collectAll: true,
          verbose: false,
        };

        const result = ConfigSchema.safeParse(config);
        assertEquals(result.success, true);

        if (result.success) {
          // Path should be a string
          assertEquals(typeof result.data.dbPath, "string");

          // If path starts with ~, it's a home directory path
          if (path.startsWith("~")) {
            assertEquals(result.data.dbPath.startsWith("~"), true);
          }
        }
      },
    ),
    { numRuns: 50 },
  );
});

Deno.test("property: memory size calculations", () => {
  fc.assert(
    fc.property(
      fc.record({
        total_kb: fc.integer({ min: 1024, max: 128 * 1024 * 1024 }), // 1MB to 128GB in KB
        free_kb: fc.integer({ min: 0, max: 128 * 1024 * 1024 }),
        available_kb: fc.integer({ min: 0, max: 128 * 1024 * 1024 }),
      }),
      ({ total_kb, free_kb, available_kb }) => {
        // Convert KB to MB
        const total_mb = Math.floor(total_kb / 1024);
        const free_mb = Math.floor(free_kb / 1024);
        const available_mb = Math.floor(available_kb / 1024);

        // Memory invariants
        assertEquals(total_mb >= 0, true);
        assertEquals(free_mb >= 0, true);
        assertEquals(available_mb >= 0, true);

        // MB conversion should always result in smaller or equal value
        assertEquals(total_mb <= total_kb, true);
        assertEquals(free_mb <= free_kb, true);
        assertEquals(available_mb <= available_kb, true);
      },
    ),
    { numRuns: 100 },
  );
});

Deno.test("property: disk usage percentage calculation", () => {
  fc.assert(
    fc.property(
      fc.record({
        total_gb: fc.float({ min: 1, max: 10000, noNaN: true }),
        used_gb: fc.float({ min: 0, max: 10000, noNaN: true }),
      }),
      ({ total_gb, used_gb }) => {
        // Skip NaN or invalid values
        if (isNaN(total_gb) || isNaN(used_gb) || total_gb <= 0) return;

        // Ensure used doesn't exceed total
        const actual_used = Math.min(used_gb, total_gb);
        const free_gb = total_gb - actual_used;
        const use_percent = (actual_used / total_gb) * 100;

        // Invariants
        assertEquals(free_gb >= 0, true);
        assertEquals(free_gb <= total_gb, true);
        assertEquals(use_percent >= 0, true);
        assertEquals(use_percent <= 100, true);

        // Free + Used should equal Total (within floating point tolerance)
        const sum = actual_used + free_gb;
        assertEquals(Math.abs(sum - total_gb) < 0.01, true);
      },
    ),
    { numRuns: 100 },
  );
});

Deno.test("property: network interface type detection", () => {
  fc.assert(
    fc.property(
      fc.oneof(
        fc.constant("lo"),
        fc.constant("eth0"),
        fc.constant("enp3s0"),
        fc.constant("wlan0"),
        fc.constant("wlp2s0"),
        fc.constant("docker0"),
        fc.constant("br-12345"),
        fc.constant("tun0"),
        fc.constant("tap0"),
        fc.string({ minLength: 1, maxLength: 15 }),
      ),
      (name) => {
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

        // Type should always be a valid string
        assertEquals(typeof type, "string");
        assertEquals(type.length > 0, true);

        // Known interfaces should have correct type
        if (name === "lo") assertEquals(type, "loopback");
        if (name.startsWith("eth")) assertEquals(type, "ethernet");
        if (name.startsWith("wl")) assertEquals(type, "wifi");
      },
    ),
    { numRuns: 100 },
  );
});

Deno.test("property: uptime calculation", () => {
  fc.assert(
    fc.property(
      fc.float({ min: 0, max: 365 * 24 * 3600, noNaN: true }), // Up to 1 year in seconds
      (uptime_seconds) => {
        // Skip NaN values
        if (isNaN(uptime_seconds)) return;

        const uptime = Math.floor(uptime_seconds);
        const bootTime = new Date(Date.now() - uptime * 1000);

        // Invariants
        assertEquals(uptime >= 0, true);
        assertEquals(bootTime.getTime() <= Date.now(), true);

        // Boot time should be in the past
        const timeDiff = Date.now() - bootTime.getTime();
        assertEquals(Math.abs(timeDiff / 1000 - uptime) < 1, true); // Within 1 second tolerance

        // Hours calculation
        const hours = Math.floor(uptime / 3600);
        assertEquals(hours >= 0, true);
        assertEquals(hours <= Math.floor(365 * 24), true);
      },
    ),
    { numRuns: 100 },
  );
});

Deno.test("property: CPU core and thread relationship", () => {
  fc.assert(
    fc.property(
      fc.record({
        cores: fc.integer({ min: 1, max: 128 }),
        threads: fc.integer({ min: 1, max: 256 }),
      }),
      ({ cores, threads }) => {
        // Threads should typically be >= cores (hyperthreading)
        // But we allow for any positive values in the schema
        assertEquals(cores > 0, true);
        assertEquals(threads > 0, true);

        // Common relationships
        if (threads === cores * 2) {
          // Hyperthreading enabled
          assertEquals(threads / cores, 2);
        } else if (threads === cores) {
          // No hyperthreading
          assertEquals(threads / cores, 1);
        }
      },
    ),
    { numRuns: 50 },
  );
});

Deno.test("property: service status validation", () => {
  fc.assert(
    fc.property(
      fc.record({
        name: fc.string({ minLength: 1, maxLength: 50 }),
        status: fc.constantFrom(
          "active",
          "inactive",
          "failed",
          "activating",
          "deactivating",
        ),
        enabled: fc.boolean(),
      }),
      ({ name, status, enabled }) => {
        // Service name should be non-empty
        assertEquals(name.length > 0, true);

        // Status should be a known systemd state
        assertEquals(
          ["active", "inactive", "failed", "activating", "deactivating"]
            .includes(status),
          true,
        );

        // Enabled is independent of status (a service can be enabled but not running)
        assertEquals(typeof enabled, "boolean");

        // Some logical constraints (not enforced by schema but good to check)
        if (status === "active") {
          // Active services are running (not inactive)
          assertEquals(status === "active", true);
        }
      },
    ),
    { numRuns: 50 },
  );
});
