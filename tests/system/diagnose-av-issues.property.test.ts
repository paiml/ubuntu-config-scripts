import { fc } from "../../deps.ts";
import { assertEquals, assertExists } from "../../deps.ts";
import {
  DiagnosticResultSchema,
  SystemInfoSchema,
} from "../../scripts/system/diagnose-av-issues.ts";

Deno.test("DiagnosticResult schema - should handle all valid category-severity combinations", () => {
  fc.assert(
    fc.property(
      fc.constantFrom("audio", "video", "system", "gpu", "network"),
      fc.constantFrom("critical", "warning", "info", "success"),
      fc.string({ minLength: 1, maxLength: 200 }),
      fc.option(fc.string({ minLength: 1, maxLength: 200 })),
      fc.option(fc.string({ minLength: 1, maxLength: 500 })),
      (category, severity, message, fix, command) => {
        const result = {
          category,
          severity,
          message,
          ...(fix !== null && { fix }),
          ...(command !== null && { command }),
        };

        const parsed = DiagnosticResultSchema.parse(result);
        assertEquals(parsed.category, category);
        assertEquals(parsed.severity, severity);
        assertEquals(parsed.message, message);

        if (fix !== null) {
          assertEquals(parsed.fix, fix);
        }
        if (command !== null) {
          assertEquals(parsed.command, command);
        }
      },
    ),
    { numRuns: 100 },
  );
});

Deno.test("DiagnosticResult schema - should preserve message content integrity", () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 1, maxLength: 1000 }),
      (message) => {
        const result = DiagnosticResultSchema.parse({
          category: "audio",
          severity: "info",
          message,
        });

        assertEquals(result.message, message);
        assertEquals(result.message.length, message.length);
      },
    ),
    { numRuns: 50 },
  );
});

Deno.test("DiagnosticResult schema - should handle optional fields consistently", () => {
  fc.assert(
    fc.property(
      fc.boolean(),
      fc.boolean(),
      (includeFix, includeCommand) => {
        const result: Record<string, string> = {
          category: "video",
          severity: "warning",
          message: "Test message",
        };

        if (includeFix) {
          result["fix"] = "Test fix";
        }
        if (includeCommand) {
          result["command"] = "test-command";
        }

        const parsed = DiagnosticResultSchema.parse(result);

        if (includeFix) {
          assertExists(parsed.fix);
          assertEquals(parsed.fix, "Test fix");
        } else {
          assertEquals(parsed.fix, undefined);
        }

        if (includeCommand) {
          assertExists(parsed.command);
          assertEquals(parsed.command, "test-command");
        } else {
          assertEquals(parsed.command, undefined);
        }
      },
    ),
    { numRuns: 20 },
  );
});

Deno.test("DiagnosticResult schema - should maintain category-severity relationship invariants", () => {
  fc.assert(
    fc.property(
      fc.constantFrom("audio", "video", "system", "gpu", "network"),
      fc.constantFrom("critical", "warning", "info", "success"),
      (category, severity) => {
        const result = DiagnosticResultSchema.parse({
          category,
          severity,
          message: `${category} ${severity} issue`,
        });

        // Invariant: category and severity should be preserved exactly
        assertEquals(result.category, category);
        assertEquals(result.severity, severity);

        // Invariant: these should be from the allowed sets
        const validCategories = [
          "audio",
          "video",
          "system",
          "gpu",
          "network",
        ];
        const validSeverities = ["critical", "warning", "info", "success"];

        assertEquals(validCategories.includes(result.category), true);
        assertEquals(validSeverities.includes(result.severity), true);
      },
    ),
    { numRuns: 100 },
  );
});

Deno.test("SystemInfo schema - should handle various kernel version formats", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 4, max: 6 }),
      fc.integer({ min: 0, max: 20 }),
      fc.integer({ min: 0, max: 100 }),
      fc.constantFrom("generic", "lowlatency", "cloud", "aws"),
      (major, minor, patch, variant) => {
        const kernel = `${major}.${minor}.${patch}-${variant}`;
        const systemInfo = {
          kernel,
          distro: "Ubuntu 24.04",
          desktop: "GNOME",
          audioServer: "PipeWire",
        };

        const parsed = SystemInfoSchema.parse(systemInfo);
        assertEquals(parsed.kernel, kernel);
      },
    ),
    { numRuns: 50 },
  );
});

Deno.test("SystemInfo schema - should handle various distro strings", () => {
  fc.assert(
    fc.property(
      fc.constantFrom("Ubuntu", "Debian", "Fedora", "Arch"),
      fc.integer({ min: 20, max: 30 }),
      fc.integer({ min: 1, max: 12 }),
      (distroName, year, month) => {
        const distro = `${distroName} ${year}.${
          month.toString().padStart(2, "0")
        }`;
        const systemInfo = {
          kernel: "6.8.0-generic",
          distro,
          desktop: "GNOME",
          audioServer: "PipeWire",
        };

        const parsed = SystemInfoSchema.parse(systemInfo);
        assertEquals(parsed.distro, distro);
      },
    ),
    { numRuns: 30 },
  );
});

Deno.test("SystemInfo schema - should handle optional GPU driver field", () => {
  fc.assert(
    fc.property(
      fc.option(fc.constantFrom(
        "NVIDIA 550.120",
        "NVIDIA 535.183",
        "Mesa 23.2.1",
        "AMDGPU 23.0.0",
        "Intel i915 2.14.0",
      )),
      (gpuDriver) => {
        const systemInfo: Record<string, string> = {
          kernel: "6.8.0-generic",
          distro: "Ubuntu 24.04",
          desktop: "GNOME",
          audioServer: "PipeWire",
        };

        if (gpuDriver !== null) {
          systemInfo["gpuDriver"] = gpuDriver;
        }

        const parsed = SystemInfoSchema.parse(systemInfo);

        if (gpuDriver !== null) {
          assertEquals(parsed.gpuDriver, gpuDriver);
        } else {
          assertEquals(parsed.gpuDriver, undefined);
        }
      },
    ),
    { numRuns: 50 },
  );
});

Deno.test("SystemInfo schema - should validate desktop environment variations", () => {
  fc.assert(
    fc.property(
      fc.constantFrom(
        "GNOME",
        "ubuntu:GNOME",
        "KDE",
        "XFCE",
        "MATE",
        "Cinnamon",
        "i3",
        "sway",
        "Unknown",
      ),
      (desktop) => {
        const systemInfo = {
          kernel: "6.8.0-generic",
          distro: "Ubuntu 24.04",
          desktop,
          audioServer: "PipeWire",
        };

        const parsed = SystemInfoSchema.parse(systemInfo);
        assertEquals(parsed.desktop, desktop);
      },
    ),
    { numRuns: 30 },
  );
});

Deno.test("SystemInfo schema - should validate audio server options", () => {
  fc.assert(
    fc.property(
      fc.constantFrom("PipeWire", "PulseAudio", "JACK", "ALSA", "Unknown"),
      (audioServer) => {
        const systemInfo = {
          kernel: "6.8.0-generic",
          distro: "Ubuntu 24.04",
          desktop: "GNOME",
          audioServer,
        };

        const parsed = SystemInfoSchema.parse(systemInfo);
        assertEquals(parsed.audioServer, audioServer);
      },
    ),
    { numRuns: 20 },
  );
});

Deno.test("Diagnostic result arrays - should handle arrays of diagnostic results", () => {
  fc.assert(
    fc.property(
      fc.array(
        fc.record({
          category: fc.constantFrom(
            "audio",
            "video",
            "system",
            "gpu",
            "network",
          ),
          severity: fc.constantFrom(
            "critical",
            "warning",
            "info",
            "success",
          ),
          message: fc.string({ minLength: 1, maxLength: 100 }),
        }),
        { minLength: 0, maxLength: 20 },
      ),
      (results) => {
        const validResults = results.map((r) =>
          DiagnosticResultSchema.parse(r)
        );

        assertEquals(validResults.length, results.length);

        for (let i = 0; i < results.length; i++) {
          const validResult = validResults[i];
          const result = results[i];
          if (validResult && result) {
            assertEquals(validResult.category, result.category);
            assertEquals(validResult.severity, result.severity);
            assertEquals(validResult.message, result.message);
          }
        }
      },
    ),
    { numRuns: 50 },
  );
});

Deno.test("Diagnostic result arrays - should maintain result ordering", () => {
  fc.assert(
    fc.property(
      fc.array(
        fc.constantFrom("critical", "warning", "info", "success"),
        { minLength: 2, maxLength: 10 },
      ),
      (severities) => {
        const results = severities.map((severity, index) => ({
          category: "audio" as const,
          severity,
          message: `Message ${index}`,
        }));

        const validResults = results.map((r) =>
          DiagnosticResultSchema.parse(r)
        );

        // Verify order is preserved
        for (let i = 0; i < severities.length; i++) {
          const validResult = validResults[i];
          const severity = severities[i];
          if (validResult && severity) {
            assertEquals(validResult.severity, severity);
            assertEquals(validResult.message, `Message ${i}`);
          }
        }
      },
    ),
    { numRuns: 30 },
  );
});

Deno.test("Command string properties - should handle various command formats", () => {
  fc.assert(
    fc.property(
      fc.constantFrom("pactl", "amixer", "systemctl", "sudo", "apt"),
      fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
        minLength: 0,
        maxLength: 5,
      }),
      (cmd, args) => {
        const command = [cmd, ...args].join(" ");
        const result = DiagnosticResultSchema.parse({
          category: "system",
          severity: "info",
          message: "Test",
          command,
        });

        assertEquals(result.command, command);
        assertEquals(result.command?.startsWith(cmd), true);
      },
    ),
    { numRuns: 50 },
  );
});

Deno.test("Command string properties - should preserve command special characters", () => {
  fc.assert(
    fc.property(
      fc.constantFrom(
        "pactl set-sink-mute @DEFAULT_SINK@ 0",
        "systemctl --user restart pipewire",
        "sudo apt install -y libavcodec-extra",
        "amixer set Master 80%",
        "gsettings set org.gnome.mutter experimental-features \"['scale-monitor-framebuffer']\"",
      ),
      (command) => {
        const result = DiagnosticResultSchema.parse({
          category: "system",
          severity: "warning",
          message: "Test",
          command,
        });

        assertEquals(result.command, command);
        // Command should be preserved exactly, including special chars
        assertEquals(result.command?.length, command.length);
      },
    ),
    { numRuns: 20 },
  );
});

Deno.test("Fix message properties - should handle fix messages of varying lengths", () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 1, maxLength: 500 }),
      (fix) => {
        const result = DiagnosticResultSchema.parse({
          category: "audio",
          severity: "warning",
          message: "Issue detected",
          fix,
        });

        assertEquals(result.fix, fix);
        assertEquals(result.fix?.length, fix.length);
      },
    ),
    { numRuns: 50 },
  );
});

Deno.test("Fix message properties - should maintain fix-command relationship", () => {
  fc.assert(
    fc.property(
      fc.boolean(),
      (hasCommand) => {
        const result: Record<string, string> = {
          category: "gpu",
          severity: "critical",
          message: "GPU issue",
          fix: "Update GPU driver",
        };

        if (hasCommand) {
          result["command"] = "sudo ubuntu-drivers autoinstall";
        }

        const parsed = DiagnosticResultSchema.parse(result);

        // Fix should always be present when defined
        assertEquals(parsed.fix, "Update GPU driver");

        // Command is optional even when fix is present
        if (hasCommand) {
          assertEquals(parsed.command, "sudo ubuntu-drivers autoinstall");
        } else {
          assertEquals(parsed.command, undefined);
        }
      },
    ),
    { numRuns: 20 },
  );
});
