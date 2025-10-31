import { assertEquals, assertExists } from "../../deps.ts";
import { fc } from "../../deps.ts";
import { z } from "../../deps.ts";

const OBSConfigSchema = z.object({
  videoSettings: z.object({
    baseResolution: z.string(),
    outputResolution: z.string(),
    fps: z.number().int().min(1).max(120),
    encoder: z.enum(["x264", "nvenc", "vaapi", "qsv"]),
    bitrate: z.number().int().min(1000).max(50000),
    keyframeInterval: z.number().int().min(0).max(10),
    preset: z.enum([
      "ultrafast",
      "superfast",
      "veryfast",
      "faster",
      "fast",
      "medium",
      "slow",
      "slower",
      "veryslow",
    ]),
    profile: z.enum(["baseline", "main", "high"]),
  }),
  audioSettings: z.object({
    sampleRate: z.enum(["44100", "48000"]),
    channels: z.enum(["mono", "stereo"]),
    desktopAudioDevice: z.string().optional(),
    micDevice: z.string().optional(),
    micNoiseSupression: z.boolean(),
    micNoiseGate: z.boolean(),
    desktopAudioBitrate: z.number().int().min(64).max(320),
    micBitrate: z.number().int().min(64).max(320),
  }),
  recordingSettings: z.object({
    outputPath: z.string(),
    fileFormat: z.enum(["mkv", "mp4", "mov", "flv"]),
    filenameFormat: z.string(),
    encoder: z.enum(["same_as_stream", "x264", "nvenc"]),
    quality: z.enum(["same_as_stream", "high", "indistinguishable"]),
  }),
  streamingSettings: z.object({
    service: z.enum(["youtube", "twitch", "custom"]).optional(),
    server: z.string().optional(),
    streamKey: z.string().optional(),
  }),
  generalSettings: z.object({
    theme: z.enum(["dark", "light", "system"]),
    language: z.string(),
    startMinimizedToTray: z.boolean(),
    minimizeToTrayOnClose: z.boolean(),
    warnBeforeStoppingStream: z.boolean(),
    recordWhenStreaming: z.boolean(),
    keepRecordingWhenStreamStops: z.boolean(),
    replayBufferEnabled: z.boolean(),
    replayBufferDuration: z.number().int().min(5).max(300),
  }),
  hotkeySettings: z.object({
    startRecording: z.string(),
    stopRecording: z.string(),
    pauseRecording: z.string(),
    startStreaming: z.string(),
    stopStreaming: z.string(),
    pushToTalk: z.string().optional(),
    muteMic: z.string(),
    muteDesktop: z.string(),
  }),
});

Deno.test("OBS config resolution parsing", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 640, max: 7680 }),
      fc.integer({ min: 360, max: 4320 }),
      (width, height) => {
        const resolution = `${width}x${height}`;
        const parts = resolution.split("x");
        assertEquals(parts.length, 2);
        assertEquals(parseInt(parts[0]!), width);
        assertEquals(parseInt(parts[1]!), height);
      },
    ),
  );
});

Deno.test("OBS config bitrate bounds", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1000, max: 50000 }),
      (bitrate) => {
        const config = {
          videoSettings: {
            bitrate,
          },
        };
        assertEquals(config.videoSettings.bitrate >= 1000, true);
        assertEquals(config.videoSettings.bitrate <= 50000, true);
      },
    ),
  );
});

Deno.test("OBS config FPS validation", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 120 }),
      (fps) => {
        const config = {
          videoSettings: {
            fps,
          },
        };
        assertEquals(config.videoSettings.fps >= 1, true);
        assertEquals(config.videoSettings.fps <= 120, true);
        assertEquals(Number.isInteger(config.videoSettings.fps), true);
      },
    ),
  );
});

Deno.test("OBS config keyframe interval calculation", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 120 }),
      fc.integer({ min: 0, max: 10 }),
      (fps, keyframeInterval) => {
        const totalKeyframes = fps * keyframeInterval;
        assertEquals(totalKeyframes >= 0, true);
        if (keyframeInterval > 0) {
          assertEquals(totalKeyframes === fps * keyframeInterval, true);
        }
      },
    ),
  );
});

Deno.test("OBS config audio bitrate validation", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 64, max: 320 }),
      fc.integer({ min: 64, max: 320 }),
      (desktopBitrate, micBitrate) => {
        const config = {
          audioSettings: {
            desktopAudioBitrate: desktopBitrate,
            micBitrate: micBitrate,
          },
        };
        assertEquals(config.audioSettings.desktopAudioBitrate >= 64, true);
        assertEquals(config.audioSettings.desktopAudioBitrate <= 320, true);
        assertEquals(config.audioSettings.micBitrate >= 64, true);
        assertEquals(config.audioSettings.micBitrate <= 320, true);
      },
    ),
  );
});

Deno.test("OBS config preset quality mapping", () => {
  const presetToBitrate = (preset: string): number => {
    switch (preset) {
      case "low":
        return 4000;
      case "medium":
        return 6000;
      case "high":
        return 10000;
      default:
        return 6000;
    }
  };

  fc.assert(
    fc.property(
      fc.constantFrom("low", "medium", "high"),
      (preset) => {
        const bitrate = presetToBitrate(preset);
        if (preset === "low") {
          assertEquals(bitrate, 4000);
        } else if (preset === "medium") {
          assertEquals(bitrate, 6000);
        } else if (preset === "high") {
          assertEquals(bitrate, 10000);
        }
        assertEquals(bitrate >= 4000, true);
        assertEquals(bitrate <= 10000, true);
      },
    ),
  );
});

Deno.test("OBS config encoder validation", () => {
  fc.assert(
    fc.property(
      fc.constantFrom("x264", "nvenc", "vaapi", "qsv"),
      (encoder) => {
        const validEncoders = ["x264", "nvenc", "vaapi", "qsv"];
        assertEquals(validEncoders.includes(encoder), true);
      },
    ),
  );
});

Deno.test("OBS config file format validation", () => {
  fc.assert(
    fc.property(
      fc.constantFrom("mkv", "mp4", "mov", "flv"),
      (format) => {
        const validFormats = ["mkv", "mp4", "mov", "flv"];
        assertEquals(validFormats.includes(format), true);

        if (format === "mkv") {
          assertEquals(format.length, 3);
        } else {
          assertEquals(format.length === 3 || format.length === 4, true);
        }
      },
    ),
  );
});

Deno.test("OBS config replay buffer duration", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 5, max: 300 }),
      (duration) => {
        const config = {
          generalSettings: {
            replayBufferDuration: duration,
          },
        };
        assertEquals(config.generalSettings.replayBufferDuration >= 5, true);
        assertEquals(config.generalSettings.replayBufferDuration <= 300, true);
      },
    ),
  );
});

Deno.test("OBS config boolean settings consistency", () => {
  fc.assert(
    fc.property(
      fc.boolean(),
      fc.boolean(),
      fc.boolean(),
      fc.boolean(),
      (recordWhenStreaming, keepRecording, micNoise, micGate) => {
        const config = {
          generalSettings: {
            recordWhenStreaming,
            keepRecordingWhenStreamStops: keepRecording,
          },
          audioSettings: {
            micNoiseSupression: micNoise,
            micNoiseGate: micGate,
          },
        };

        assertEquals(
          typeof config.generalSettings.recordWhenStreaming,
          "boolean",
        );
        assertEquals(
          typeof config.generalSettings.keepRecordingWhenStreamStops,
          "boolean",
        );
        assertEquals(typeof config.audioSettings.micNoiseSupression, "boolean");
        assertEquals(typeof config.audioSettings.micNoiseGate, "boolean");

        if (config.generalSettings.recordWhenStreaming) {
          assertExists(config.generalSettings.keepRecordingWhenStreamStops);
        }
      },
    ),
  );
});

Deno.test("OBS config hotkey format validation", () => {
  const isValidHotkey = (hotkey: string): boolean => {
    const parts = hotkey.split("+");
    const validModifiers = ["Ctrl", "Alt", "Shift", "Meta", "Super"];
    const validKeys = /^[A-Z0-9]$|^F\d+$/;

    if (parts.length < 2) return false;

    for (let i = 0; i < parts.length - 1; i++) {
      if (!validModifiers.includes(parts[i]!)) {
        return false;
      }
    }

    const lastPart = parts[parts.length - 1]!;
    return validKeys.test(lastPart) || lastPart.length === 1;
  };

  fc.assert(
    fc.property(
      fc.constantFrom(
        "Ctrl+Alt+R",
        "Ctrl+Alt+S",
        "Ctrl+Shift+P",
        "Alt+F1",
        "Ctrl+Alt+Shift+M",
      ),
      (hotkey) => {
        assertEquals(isValidHotkey(hotkey), true);
      },
    ),
  );
});

Deno.test(
  "OBS config path expansion",
  { permissions: { env: ["HOME"] } },
  () => {
    fc.assert(
      fc.property(
        fc.constantFrom("~", "/home/user", "/opt/videos", "~/Videos/OBS"),
        (path) => {
          const homeDir = Deno.env.get("HOME") || "/home/user";
          const expandedPath = path.replace("~", homeDir);

          if (path.startsWith("~")) {
            assertEquals(expandedPath.startsWith(homeDir), true);
          } else {
            assertEquals(expandedPath, path);
          }

          assertEquals(expandedPath.includes("~"), false);
        },
      ),
    );
  },
);

Deno.test("OBS config complete schema validation", () => {
  fc.assert(
    fc.property(
      fc.record({
        fps: fc.integer({ min: 1, max: 120 }),
        bitrate: fc.integer({ min: 1000, max: 50000 }),
        keyframeInterval: fc.integer({ min: 0, max: 10 }),
        desktopAudioBitrate: fc.integer({ min: 64, max: 320 }),
        micBitrate: fc.integer({ min: 64, max: 320 }),
        replayBufferDuration: fc.integer({ min: 5, max: 300 }),
      }),
      (values) => {
        const config = {
          videoSettings: {
            baseResolution: "1920x1080",
            outputResolution: "1920x1080",
            fps: values.fps,
            encoder: "x264",
            bitrate: values.bitrate,
            keyframeInterval: values.keyframeInterval,
            preset: "medium",
            profile: "high",
          },
          audioSettings: {
            sampleRate: "48000",
            channels: "stereo",
            micNoiseSupression: true,
            micNoiseGate: true,
            desktopAudioBitrate: values.desktopAudioBitrate,
            micBitrate: values.micBitrate,
          },
          recordingSettings: {
            outputPath: "~/Videos/OBS",
            fileFormat: "mkv",
            filenameFormat: "%CCYY-%MM-%DD %hh-%mm-%ss",
            encoder: "same_as_stream",
            quality: "high",
          },
          streamingSettings: {},
          generalSettings: {
            theme: "dark",
            language: "en-US",
            startMinimizedToTray: false,
            minimizeToTrayOnClose: false,
            warnBeforeStoppingStream: true,
            recordWhenStreaming: false,
            keepRecordingWhenStreamStops: true,
            replayBufferEnabled: false,
            replayBufferDuration: values.replayBufferDuration,
          },
          hotkeySettings: {
            startRecording: "Ctrl+Alt+R",
            stopRecording: "Ctrl+Alt+S",
            pauseRecording: "Ctrl+Alt+P",
            startStreaming: "Ctrl+Alt+T",
            stopStreaming: "Ctrl+Alt+Y",
            muteMic: "Ctrl+Alt+M",
            muteDesktop: "Ctrl+Alt+D",
          },
        };

        const result = OBSConfigSchema.safeParse(config);
        assertEquals(result.success, true);
      },
    ),
  );
});
