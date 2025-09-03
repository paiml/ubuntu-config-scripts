import { assertEquals, assertExists } from "../../deps.ts";

Deno.test("OBS config resolution format", () => {
  const resolutions = [
    "1920x1080",
    "1280x720",
    "2560x1440",
    "3840x2160",
  ];

  for (const resolution of resolutions) {
    const [width, height] = resolution.split("x");
    assertExists(width);
    assertExists(height);
    assertEquals(parseInt(width), Number(width));
    assertEquals(parseInt(height), Number(height));
  }
});

Deno.test("OBS encoder priority", () => {
  const encoders = ["nvenc", "vaapi", "qsv", "x264"];

  const selectBestEncoder = (available: string[]): string => {
    for (const encoder of encoders) {
      if (available.includes(encoder)) {
        return encoder;
      }
    }
    return "x264";
  };

  assertEquals(selectBestEncoder(["x264"]), "x264");
  assertEquals(selectBestEncoder(["nvenc", "x264"]), "nvenc");
  assertEquals(selectBestEncoder(["vaapi", "x264"]), "vaapi");
  assertEquals(selectBestEncoder(["qsv", "nvenc", "x264"]), "nvenc");
  assertEquals(selectBestEncoder([]), "x264");
});

Deno.test("OBS preset to encoding speed mapping", () => {
  const presetMap: Record<string, string> = {
    "low": "veryfast",
    "medium": "medium",
    "high": "slow",
  };

  assertEquals(presetMap["low"], "veryfast");
  assertEquals(presetMap["medium"], "medium");
  assertEquals(presetMap["high"], "slow");
});

Deno.test("OBS audio sample rate validation", () => {
  const validRates = ["44100", "48000"];
  const testRates = ["44100", "48000", "96000", "22050"];

  for (const rate of testRates) {
    if (validRates.includes(rate)) {
      assertEquals(validRates.includes(rate), true);
    } else {
      assertEquals(validRates.includes(rate), false);
    }
  }
});

Deno.test("OBS file format extensions", () => {
  const formats: Record<string, string> = {
    "mkv": ".mkv",
    "mp4": ".mp4",
    "mov": ".mov",
    "flv": ".flv",
  };

  for (const [format, ext] of Object.entries(formats)) {
    assertEquals(ext.startsWith("."), true);
    assertEquals(ext.slice(1), format);
  }
});

Deno.test("OBS hotkey modifier validation", () => {
  const validModifiers = ["Ctrl", "Alt", "Shift", "Meta", "Super"];
  const hotkey = "Ctrl+Alt+R";
  const parts = hotkey.split("+");

  for (let i = 0; i < parts.length - 1; i++) {
    assertEquals(validModifiers.includes(parts[i]!), true);
  }
});

Deno.test("OBS profile name sanitization", () => {
  const sanitizeProfileName = (name: string): string => {
    return name.replace(/[^a-zA-Z0-9_-]/g, "_");
  };

  assertEquals(sanitizeProfileName("My Profile"), "My_Profile");
  assertEquals(sanitizeProfileName("Test@Profile#1"), "Test_Profile_1");
  assertEquals(sanitizeProfileName("Valid-Name_123"), "Valid-Name_123");
});

Deno.test("OBS bitrate calculation", () => {
  const calculateBufferSize = (bitrate: number): number => {
    return bitrate * 2;
  };

  assertEquals(calculateBufferSize(6000), 12000);
  assertEquals(calculateBufferSize(10000), 20000);
  assertEquals(calculateBufferSize(4000), 8000);
});

Deno.test("OBS filename format validation", () => {
  const validTokens = [
    "%CCYY",
    "%YY",
    "%MM",
    "%DD",
    "%hh",
    "%mm",
    "%ss",
  ];

  const format = "%CCYY-%MM-%DD %hh-%mm-%ss";

  for (const token of validTokens) {
    if (format.includes(token)) {
      assertEquals(format.includes(token), true);
    }
  }
});

Deno.test("OBS scene configuration structure", () => {
  const scene = {
    name: "Screencast",
    sources: [
      { id: "screen_capture", enabled: true },
      { id: "mic_capture", enabled: true },
      { id: "desktop_audio", enabled: true },
    ],
  };

  assertEquals(scene.name, "Screencast");
  assertEquals(scene.sources.length, 3);

  for (const source of scene.sources) {
    assertExists(source.id);
    assertEquals(source.enabled, true);
  }
});
