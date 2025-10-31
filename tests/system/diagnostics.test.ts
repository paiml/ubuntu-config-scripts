import { assertEquals, assertExists } from "../../deps.ts";
import {
  detectAudioServer,
  diagnoseAudioSubsystem,
  type DiagnosticResult,
} from "../../scripts/system/diagnostics/audio.ts";
import { diagnoseVideoSubsystem } from "../../scripts/system/diagnostics/video.ts";
import { diagnoseGPU } from "../../scripts/system/diagnostics/gpu.ts";
import {
  collectSystemInfo,
  SystemInfoSchema,
} from "../../scripts/system/diagnostics/system-info.ts";
import {
  generateReport,
  applyFixes,
  exportFixes,
} from "../../scripts/system/diagnostics/reporting.ts";

Deno.test("detectAudioServer - should detect audio server", async () => {
  const server = await detectAudioServer();

  assertExists(server);
  assertEquals(
    ["PipeWire", "PulseAudio", "Unknown"].includes(server),
    true,
  );
});

Deno.test("diagnoseAudioSubsystem - should return diagnostic results", async () => {
  const server = await detectAudioServer();
  const results = await diagnoseAudioSubsystem(server);

  assertExists(results);
  assertEquals(Array.isArray(results), true);

  for (const result of results) {
    assertExists(result.category);
    assertExists(result.severity);
    assertExists(result.message);
    assertEquals(
      ["audio", "video", "system", "gpu", "network"].includes(result.category),
      true,
    );
    assertEquals(
      ["critical", "warning", "info", "success"].includes(result.severity),
      true,
    );
  }
});

Deno.test("diagnoseVideoSubsystem - should return video diagnostic results", async () => {
  const results = await diagnoseVideoSubsystem();

  assertExists(results);
  assertEquals(Array.isArray(results), true);

  for (const result of results) {
    assertExists(result.category);
    assertExists(result.severity);
    assertExists(result.message);
  }
});

Deno.test("diagnoseGPU - should return GPU diagnostic results", async () => {
  const results = await diagnoseGPU();

  assertExists(results);
  assertEquals(Array.isArray(results), true);

  for (const result of results) {
    assertExists(result.category);
    assertExists(result.severity);
    assertExists(result.message);
  }
});

Deno.test("collectSystemInfo - should return valid system info", async () => {
  const info = await collectSystemInfo();

  assertExists(info);

  // Validate against schema
  const validated = SystemInfoSchema.parse(info);
  assertExists(validated.kernel);
  assertExists(validated.distro);
  assertExists(validated.desktop);
  assertExists(validated.audioServer);
});

Deno.test("SystemInfoSchema - should validate correct data", () => {
  const validInfo = {
    kernel: "6.5.0-15-generic",
    distro: "Ubuntu 24.04 LTS",
    desktop: "GNOME",
    audioServer: "PipeWire",
    gpuDriver: "NVIDIA 550.120",
  };

  const result = SystemInfoSchema.safeParse(validInfo);
  assertEquals(result.success, true);

  if (result.success) {
    assertEquals(result.data.kernel, "6.5.0-15-generic");
    assertEquals(result.data.audioServer, "PipeWire");
  }
});

Deno.test("SystemInfoSchema - should allow optional gpuDriver", () => {
  const infoWithoutGpu = {
    kernel: "6.5.0-15-generic",
    distro: "Ubuntu 24.04 LTS",
    desktop: "GNOME",
    audioServer: "PulseAudio",
  };

  const result = SystemInfoSchema.safeParse(infoWithoutGpu);
  assertEquals(result.success, true);

  if (result.success) {
    assertEquals(result.data.gpuDriver, undefined);
  }
});

Deno.test("generateReport - should not crash with empty results", () => {
  const emptyResults: DiagnosticResult[] = [];

  // Should not throw
  generateReport(emptyResults);
});

Deno.test("generateReport - should handle various result types", () => {
  const results: DiagnosticResult[] = [
    {
      category: "audio",
      severity: "critical",
      message: "Audio service not running",
      fix: "Restart audio service",
      command: "systemctl --user restart pipewire",
    },
    {
      category: "video",
      severity: "warning",
      message: "Low framerate detected",
    },
    {
      category: "gpu",
      severity: "info",
      message: "GPU driver up to date",
    },
    {
      category: "system",
      severity: "success",
      message: "All checks passed",
    },
  ];

  // Should not throw
  generateReport(results);
});

Deno.test("applyFixes - should handle empty results", async () => {
  const emptyResults: DiagnosticResult[] = [];

  // Should not throw
  await applyFixes(emptyResults);
});

Deno.test("applyFixes - should handle results without fixes", async () => {
  const results: DiagnosticResult[] = [
    {
      category: "audio",
      severity: "info",
      message: "Audio working fine",
    },
  ];

  // Should not throw
  await applyFixes(results);
});

Deno.test(
  "exportFixes - should create fix script",
  { permissions: { write: ["/tmp"], read: ["/tmp"] } },
  async () => {
    const results: DiagnosticResult[] = [
      {
        category: "audio",
        severity: "critical",
        message: "Audio muted",
        fix: "Unmute audio",
        command: "pactl set-sink-mute @DEFAULT_SINK@ 0",
      },
    ];

    await exportFixes(results);

    // Verify file was created
    const fixFile = "/tmp/av-fixes.sh";
    const stat = await Deno.stat(fixFile);
    assertExists(stat);
    assertEquals(stat.isFile, true);

    // Read and verify content
    const content = await Deno.readTextFile(fixFile);
    assertEquals(content.includes("#!/bin/bash"), true);
    assertEquals(content.includes("pactl"), true);

    // Clean up
    await Deno.remove(fixFile);
  },
);

Deno.test("exportFixes - should handle empty results", async () => {
  const emptyResults: DiagnosticResult[] = [];

  // Should not throw and should not create file
  await exportFixes(emptyResults);
});

Deno.test("diagnostic results - severity levels should be distinct", async () => {
  const audioServer = await detectAudioServer();
  const audioResults = await diagnoseAudioSubsystem(audioServer);
  const videoResults = await diagnoseVideoSubsystem();
  const gpuResults = await diagnoseGPU();

  const allResults = [...audioResults, ...videoResults, ...gpuResults];

  // At least some results should exist
  assertEquals(allResults.length > 0, true);

  // Verify all severity levels are valid
  for (const result of allResults) {
    assertEquals(
      ["critical", "warning", "info", "success"].includes(result.severity),
      true,
    );
  }
});

Deno.test("diagnostic results - categories should match their source", async () => {
  const videoResults = await diagnoseVideoSubsystem();

  // Video diagnostics should return video or system categories
  for (const result of videoResults) {
    assertEquals(
      ["video", "system", "gpu"].includes(result.category),
      true,
    );
  }
});

Deno.test("diagnostic results - messages should be non-empty", async () => {
  const audioServer = await detectAudioServer();
  const results = await diagnoseAudioSubsystem(audioServer);

  for (const result of results) {
    assertEquals(result.message.length > 0, true);
    assertEquals(typeof result.message, "string");
  }
});

Deno.test("diagnostic results - fixes should have commands when present", async () => {
  const audioServer = await detectAudioServer();
  const results = await diagnoseAudioSubsystem(audioServer);

  for (const result of results) {
    // If a result has a fix, it should ideally have a command
    // (though this is not strictly required)
    if (result.fix && result.command) {
      assertEquals(result.command.length > 0, true);
    }
  }
});
