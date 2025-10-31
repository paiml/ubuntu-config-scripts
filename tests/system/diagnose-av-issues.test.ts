import { assertEquals, assertExists } from "../../deps.ts";
import {
  AVDiagnostics,
  DiagnosticResultSchema,
  SystemInfoSchema,
} from "../../scripts/system/diagnose-av-issues.ts";

Deno.test("DiagnosticResultSchema - should validate correct diagnostic results", () => {
  const validResult = {
    category: "audio" as const,
    severity: "critical" as const,
    message: "Audio service not running",
    fix: "Start audio service",
    command: "systemctl --user restart pipewire",
  };

  const result = DiagnosticResultSchema.parse(validResult);
  assertEquals(result.category, "audio");
  assertEquals(result.severity, "critical");
  assertEquals(result.message, "Audio service not running");
});

Deno.test("DiagnosticResultSchema - should validate results without optional fields", () => {
  const minimalResult = {
    category: "video" as const,
    severity: "info" as const,
    message: "Hardware acceleration available",
  };

  const result = DiagnosticResultSchema.parse(minimalResult);
  assertEquals(result.category, "video");
  assertEquals(result.fix, undefined);
  assertEquals(result.command, undefined);
});

Deno.test("DiagnosticResultSchema - should reject invalid category", () => {
  const invalidResult = {
    category: "invalid" as unknown,
    severity: "critical" as const,
    message: "Test message",
  };

  let error: Error | null = null;
  try {
    DiagnosticResultSchema.parse(invalidResult);
  } catch (e) {
    error = e as Error;
  }
  assertExists(error);
});

Deno.test("DiagnosticResultSchema - should reject invalid severity", () => {
  const invalidResult = {
    category: "audio" as const,
    severity: "invalid" as unknown,
    message: "Test message",
  };

  let error: Error | null = null;
  try {
    DiagnosticResultSchema.parse(invalidResult);
  } catch (e) {
    error = e as Error;
  }
  assertExists(error);
});

Deno.test("SystemInfoSchema - should validate complete system info", () => {
  const systemInfo = {
    kernel: "6.8.0-71-generic",
    distro: "Ubuntu 24.04 LTS",
    desktop: "GNOME",
    gpuDriver: "NVIDIA 550.120",
    audioServer: "PipeWire",
  };

  const result = SystemInfoSchema.parse(systemInfo);
  assertEquals(result.kernel, "6.8.0-71-generic");
  assertEquals(result.gpuDriver, "NVIDIA 550.120");
});

Deno.test("SystemInfoSchema - should validate system info without optional GPU driver", () => {
  const systemInfo = {
    kernel: "6.8.0-71-generic",
    distro: "Ubuntu 24.04 LTS",
    desktop: "GNOME",
    audioServer: "PulseAudio",
  };

  const result = SystemInfoSchema.parse(systemInfo);
  assertEquals(result.audioServer, "PulseAudio");
  assertEquals(result.gpuDriver, undefined);
});

Deno.test("SystemInfoSchema - should reject missing required fields", () => {
  const invalidInfo = {
    kernel: "6.8.0-71-generic",
    distro: "Ubuntu 24.04 LTS",
    // missing desktop and audioServer
  };

  let error: Error | null = null;
  try {
    SystemInfoSchema.parse(invalidInfo);
  } catch (e) {
    error = e as Error;
  }
  assertExists(error);
});

Deno.test("AVDiagnostics class - should create instance", () => {
  const diagnostics = new AVDiagnostics();
  assertExists(diagnostics);
});

Deno.test("AVDiagnostics class - should have required methods", () => {
  const diagnostics = new AVDiagnostics();
  assertEquals(typeof diagnostics.run, "function");
  assertEquals(typeof diagnostics.exportFixes, "function");
});

Deno.test("Category emoji mapping - should return correct emojis for categories", () => {
  const diagnostics = new AVDiagnostics();
  // Using type assertion to test private method
  // Access private method for testing
  // deno-lint-ignore no-explicit-any
  const getCategoryEmoji = (diagnostics as any).getCategoryEmoji.bind(
    diagnostics,
  );

  assertEquals(getCategoryEmoji("audio"), "🔊");
  assertEquals(getCategoryEmoji("video"), "🎬");
  assertEquals(getCategoryEmoji("gpu"), "🎮");
  assertEquals(getCategoryEmoji("system"), "💻");
  assertEquals(getCategoryEmoji("network"), "🌐");
  assertEquals(getCategoryEmoji("unknown"), "📌");
});

Deno.test("Severity icon mapping - should return correct icons for severity levels", () => {
  const diagnostics = new AVDiagnostics();
  // Using type assertion to test private method
  // Access private method for testing
  // deno-lint-ignore no-explicit-any
  const getSeverityIcon = (diagnostics as any).getSeverityIcon.bind(
    diagnostics,
  );

  assertEquals(getSeverityIcon("critical"), "❌");
  assertEquals(getSeverityIcon("warning"), "⚠️ ");
  assertEquals(getSeverityIcon("info"), "ℹ️ ");
  assertEquals(getSeverityIcon("success"), "✅");
  assertEquals(getSeverityIcon("unknown"), "•");
});

Deno.test("Result validation - should add valid results", () => {
  const diagnostics = new AVDiagnostics();
  // Access private methods for testing
  // deno-lint-ignore no-explicit-any
  const addResult = (diagnostics as any).addResult.bind(diagnostics);
  // deno-lint-ignore no-explicit-any
  const results = (diagnostics as any).results;

  addResult({
    category: "audio",
    severity: "critical",
    message: "Test message",
  });

  assertEquals(results.length, 1);
  assertEquals(results[0].category, "audio");
});

Deno.test("Result validation - should validate all category types", () => {
  const categories = ["audio", "video", "system", "gpu", "network"] as const;

  for (const category of categories) {
    const result = DiagnosticResultSchema.parse({
      category,
      severity: "info",
      message: `Test ${category}`,
    });
    assertEquals(result.category, category);
  }
});

Deno.test("Result validation - should validate all severity types", () => {
  const severities = ["critical", "warning", "info", "success"] as const;

  for (const severity of severities) {
    const result = DiagnosticResultSchema.parse({
      category: "audio",
      severity,
      message: `Test ${severity}`,
    });
    assertEquals(result.severity, severity);
  }
});

Deno.test(
  "Export fixes functionality - should create fix script file",
  { permissions: { write: ["/tmp"], read: ["/tmp"] } },
  async () => {
    const diagnostics = new AVDiagnostics();
    // Add some test results with fixes
    // deno-lint-ignore no-explicit-any
    const addResult = (diagnostics as any).addResult.bind(diagnostics);

    addResult({
      category: "audio",
      severity: "critical",
      message: "Audio muted",
      fix: "Unmute audio",
      command: "pactl set-sink-mute @DEFAULT_SINK@ 0",
    });

    addResult({
      category: "video",
      severity: "warning",
      message: "Missing codec",
      fix: "Install codec",
      command: "sudo apt install libavcodec-extra",
    });

    // Test export (will write to /tmp)
    await diagnostics.exportFixes();

    // Verify file was created
    const fixFile = "/tmp/av-fixes.sh";
    const stat = await Deno.stat(fixFile);
    assertExists(stat);
    assertEquals(stat.isFile, true);

    // Clean up
    await Deno.remove(fixFile);
  },
);
