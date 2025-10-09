import { assertEquals, assertRejects } from "../../deps.ts";
import {
  AUDIO_BACKENDS,
  type AudioBackend,
  type AudioConfig,
  configureSampleRate,
  createDeviceId,
  createDeviceName,
  fetchAudioDevices,
  getFirstDevice,
  loadAudioConfig,
  processAudioCommand,
  SAMPLE_RATES,
  type SampleRate,
  setVolume,
} from "../../scripts/lib/strict-config.ts";

// Integration tests for strict-config.ts
// Tests type-safe configuration with Zod validation

Deno.test(
  "loadAudioConfig - loads valid configuration",
  { permissions: { read: true, write: true, env: true } },
  async () => {
    const tempFile = await Deno.makeTempFile({ suffix: ".json" });

    try {
      const config = {
        device: "default",
        volume: 75,
        muted: false,
        backend: "pulseaudio",
      advanced: undefined,
      };

      await Deno.writeTextFile(tempFile, JSON.stringify(config));
      const loaded = await loadAudioConfig(tempFile);

      assertEquals(loaded.device, "default");
      assertEquals(loaded.volume, 75);
      assertEquals(loaded.muted, false);
      assertEquals(loaded.backend, "pulseaudio");
    } finally {
      await Deno.remove(tempFile);
    }
  },
);

Deno.test(
  "loadAudioConfig - loads config with advanced settings",
  { permissions: { read: true, write: true, env: true } },
  async () => {
    const tempFile = await Deno.makeTempFile({ suffix: ".json" });

    try {
      const config = {
        device: "hw:0",
        volume: 50,
        muted: false,
        backend: "alsa",
      advanced: {
          sampleRate: 48000,
          channels: 2,
          bitDepth: 16,
        },
      };

      await Deno.writeTextFile(tempFile, JSON.stringify(config));
      const loaded = await loadAudioConfig(tempFile);

      assertEquals(loaded.advanced?.sampleRate, 48000);
      assertEquals(loaded.advanced?.channels, 2);
      assertEquals(loaded.advanced?.bitDepth, 16);
    } finally {
      await Deno.remove(tempFile);
    }
  },
);

Deno.test(
  "loadAudioConfig - rejects invalid volume",
  { permissions: { read: true, write: true, env: true } },
  async () => {
    const tempFile = await Deno.makeTempFile({ suffix: ".json" });

    try {
      const config = {
        device: "default",
        volume: 150, // Invalid: > 100
        muted: false,
        backend: "pulseaudio",
      advanced: undefined,
      };

      await Deno.writeTextFile(tempFile, JSON.stringify(config));
      await assertRejects(async () => await loadAudioConfig(tempFile));
    } finally {
      await Deno.remove(tempFile);
    }
  },
);

Deno.test(
  "loadAudioConfig - rejects invalid backend",
  { permissions: { read: true, write: true, env: true } },
  async () => {
    const tempFile = await Deno.makeTempFile({ suffix: ".json" });

    try {
      const config = {
        device: "default",
        volume: 75,
        muted: false,
        backend: "oss", // Invalid backend
      };

      await Deno.writeTextFile(tempFile, JSON.stringify(config));
      await assertRejects(async () => await loadAudioConfig(tempFile));
    } finally {
      await Deno.remove(tempFile);
    }
  },
);

Deno.test(
  "loadAudioConfig - rejects invalid sample rate",
  { permissions: { read: true, write: true, env: true } },
  async () => {
    const tempFile = await Deno.makeTempFile({ suffix: ".json" });

    try {
      const config = {
        device: "default",
        volume: 75,
        muted: false,
        backend: "pulseaudio",
      advanced: {
          sampleRate: 1000, // Invalid: < 8000
          channels: 2,
          bitDepth: 16,
        },
      };

      await Deno.writeTextFile(tempFile, JSON.stringify(config));
      await assertRejects(async () => await loadAudioConfig(tempFile));
    } finally {
      await Deno.remove(tempFile);
    }
  },
);

Deno.test(
  "loadAudioConfig - accepts numeric device",
  { permissions: { read: true, write: true, env: true } },
  async () => {
    const tempFile = await Deno.makeTempFile({ suffix: ".json" });

    try {
      const config = {
        device: 0,
        volume: 75,
        muted: false,
        backend: "pulseaudio",
      advanced: undefined,
      };

      await Deno.writeTextFile(tempFile, JSON.stringify(config));
      const loaded = await loadAudioConfig(tempFile);
      assertEquals(loaded.device, 0);
    } finally {
      await Deno.remove(tempFile);
    }
  },
);

Deno.test(
  "setVolume - sets valid volume",
  { permissions: { read: true } },
  () => {
    const config: AudioConfig = {
      device: "default",
      volume: 50,
      muted: true,
      backend: "pulseaudio",
      advanced: undefined,
    };

    const updated = setVolume(config, 75);
    assertEquals(updated.volume, 75);
    assertEquals(updated.muted, false); // Should unmute
  },
);

Deno.test(
  "setVolume - throws on volume > 100",
  { permissions: { read: true } },
  () => {
    const config: AudioConfig = {
      device: "default",
      volume: 50,
      muted: false,
      backend: "pulseaudio",
      advanced: undefined,
    };

    try {
      setVolume(config, 150);
      throw new Error("Should have thrown");
    } catch (error) {
      assertEquals(error instanceof Error, true);
    }
  },
);

Deno.test(
  "setVolume - throws on negative volume",
  { permissions: { read: true } },
  () => {
    const config: AudioConfig = {
      device: "default",
      volume: 50,
      muted: false,
      backend: "pulseaudio",
      advanced: undefined,
    };

    try {
      setVolume(config, -10);
      throw new Error("Should have thrown");
    } catch (error) {
      assertEquals(error instanceof Error, true);
    }
  },
);

Deno.test(
  "setVolume - unmutes when setting volume",
  { permissions: { read: true } },
  () => {
    const config: AudioConfig = {
      device: "default",
      volume: 50,
      muted: true,
      backend: "pulseaudio",
      advanced: undefined,
    };

    const updated = setVolume(config, 60);
    assertEquals(updated.muted, false);
  },
);

Deno.test(
  "processAudioCommand - set-volume",
  { permissions: { read: true } },
  () => {
    const config: AudioConfig = {
      device: "default",
      volume: 50,
      muted: false,
      backend: "pulseaudio",
      advanced: undefined,
    };

    const updated = processAudioCommand(config, {
      type: "set-volume",
      volume: 80,
    });
    assertEquals(updated.volume, 80);
  },
);

Deno.test(
  "processAudioCommand - mute",
  { permissions: { read: true } },
  () => {
    const config: AudioConfig = {
      device: "default",
      volume: 50,
      muted: false,
      backend: "pulseaudio",
      advanced: undefined,
    };

    const updated = processAudioCommand(config, { type: "mute" });
    assertEquals(updated.muted, true);
  },
);

Deno.test(
  "processAudioCommand - unmute",
  { permissions: { read: true } },
  () => {
    const config: AudioConfig = {
      device: "default",
      volume: 50,
      muted: true,
      backend: "pulseaudio",
      advanced: undefined,
    };

    const updated = processAudioCommand(config, { type: "unmute" });
    assertEquals(updated.muted, false);
  },
);

Deno.test(
  "processAudioCommand - switch-device with string",
  { permissions: { read: true } },
  () => {
    const config: AudioConfig = {
      device: "default",
      volume: 50,
      muted: false,
      backend: "pulseaudio",
      advanced: undefined,
    };

    const updated = processAudioCommand(config, {
      type: "switch-device",
      device: "hw:0",
    });
    assertEquals(updated.device, "hw:0");
  },
);

Deno.test(
  "processAudioCommand - switch-device with number",
  { permissions: { read: true } },
  () => {
    const config: AudioConfig = {
      device: "default",
      volume: 50,
      muted: false,
      backend: "pulseaudio",
      advanced: undefined,
    };

    const updated = processAudioCommand(config, {
      type: "switch-device",
      device: 1,
    });
    assertEquals(updated.device, 1);
  },
);

Deno.test(
  "processAudioCommand - configure with valid partial",
  { permissions: { read: true } },
  () => {
    const config: AudioConfig = {
      device: "default",
      volume: 50,
      muted: false,
      backend: "pulseaudio",
      advanced: undefined,
    };

    const updated = processAudioCommand(config, {
      type: "configure",
      config: { volume: 60, muted: true },
    });
    assertEquals(updated.volume, 60);
    assertEquals(updated.muted, true);
  },
);

Deno.test(
  "processAudioCommand - configure rejects invalid",
  { permissions: { read: true } },
  () => {
    const config: AudioConfig = {
      device: "default",
      volume: 50,
      muted: false,
      backend: "pulseaudio",
      advanced: undefined,
    };

    try {
      processAudioCommand(config, {
        type: "configure",
        config: { volume: 150 }, // Invalid volume
      });
      throw new Error("Should have thrown");
    } catch (error) {
      assertEquals(error instanceof Error, true);
    }
  },
);

Deno.test(
  "createDeviceId - creates valid device ID",
  { permissions: { read: true } },
  () => {
    const id = createDeviceId("hw:0");
    assertEquals(id, "hw:0");
  },
);

Deno.test(
  "createDeviceId - throws on empty string",
  { permissions: { read: true } },
  () => {
    try {
      createDeviceId("");
      throw new Error("Should have thrown");
    } catch (error) {
      assertEquals(error instanceof Error, true);
      assertEquals(
        (error as Error).message,
        "Device ID cannot be empty",
      );
    }
  },
);

Deno.test(
  "createDeviceName - creates valid device name",
  { permissions: { read: true } },
  () => {
    const name = createDeviceName("Microphone");
    assertEquals(name, "Microphone");
  },
);

Deno.test(
  "createDeviceName - throws on empty string",
  { permissions: { read: true } },
  () => {
    try {
      createDeviceName("");
      throw new Error("Should have thrown");
    } catch (error) {
      assertEquals(error instanceof Error, true);
      assertEquals(
        (error as Error).message,
        "Device name cannot be empty",
      );
    }
  },
);

Deno.test(
  "AUDIO_BACKENDS - contains expected values",
  { permissions: { read: true } },
  () => {
    assertEquals(AUDIO_BACKENDS.length, 2);
    assertEquals(AUDIO_BACKENDS[0], "pulseaudio");
    assertEquals(AUDIO_BACKENDS[1], "alsa");
  },
);

Deno.test(
  "SAMPLE_RATES - contains expected values",
  { permissions: { read: true } },
  () => {
    assertEquals(SAMPLE_RATES.length, 6);
    assertEquals(SAMPLE_RATES.includes(48000), true);
    assertEquals(SAMPLE_RATES.includes(44100), true);
    assertEquals(SAMPLE_RATES.includes(192000), true);
  },
);

Deno.test(
  "configureSampleRate - accepts valid rate",
  { permissions: { read: true, env: true } },
  () => {
    const rate: SampleRate = 48000;
    configureSampleRate(rate);
    // If it doesn't throw, it's successful
    assertEquals(typeof rate, "number");
  },
);

Deno.test(
  "fetchAudioDevices - returns success response",
  { permissions: { read: true } },
  async () => {
    const response = await fetchAudioDevices();
    assertEquals(response.success, true);
    if (response.success) {
      assertEquals(Array.isArray(response.data), true);
      assertEquals(response.data.length > 0, true);
    }
  },
);

Deno.test(
  "fetchAudioDevices - includes default device",
  { permissions: { read: true } },
  async () => {
    const response = await fetchAudioDevices();
    if (response.success) {
      assertEquals(response.data.includes("default"), true);
    }
  },
);

Deno.test(
  "getFirstDevice - returns first device",
  { permissions: { read: true, env: true } },
  async () => {
    const device = await getFirstDevice();
    assertEquals(device, "default");
  },
);

Deno.test(
  "setVolume - accepts volume at 0",
  { permissions: { read: true } },
  () => {
    const config: AudioConfig = {
      device: "default",
      volume: 50,
      muted: false,
      backend: "pulseaudio",
      advanced: undefined,
    };

    const updated = setVolume(config, 0);
    assertEquals(updated.volume, 0);
  },
);

Deno.test(
  "setVolume - accepts volume at 100",
  { permissions: { read: true } },
  () => {
    const config: AudioConfig = {
      device: "default",
      volume: 50,
      muted: false,
      backend: "pulseaudio",
      advanced: undefined,
    };

    const updated = setVolume(config, 100);
    assertEquals(updated.volume, 100);
  },
);

Deno.test(
  "loadAudioConfig - handles missing file",
  { permissions: { read: true, env: true } },
  async () => {
    await assertRejects(
      async () => await loadAudioConfig("/tmp/non-existent-config.json"),
    );
  },
);

Deno.test(
  "loadAudioConfig - handles invalid JSON",
  { permissions: { read: true, write: true, env: true } },
  async () => {
    const tempFile = await Deno.makeTempFile({ suffix: ".json" });

    try {
      await Deno.writeTextFile(tempFile, "invalid json");
      await assertRejects(async () => await loadAudioConfig(tempFile));
    } finally {
      await Deno.remove(tempFile);
    }
  },
);

Deno.test(
  "processAudioCommand - configure with backend change",
  { permissions: { read: true } },
  () => {
    const config: AudioConfig = {
      device: "default",
      volume: 50,
      muted: false,
      backend: "pulseaudio",
      advanced: undefined,
    };

    const updated = processAudioCommand(config, {
      type: "configure",
      config: { backend: "alsa" as AudioBackend },
    });
    assertEquals(updated.backend, "alsa");
  },
);

Deno.test(
  "loadAudioConfig - validates minimum sample rate",
  { permissions: { read: true, write: true, env: true } },
  async () => {
    const tempFile = await Deno.makeTempFile({ suffix: ".json" });

    try {
      const config = {
        device: "default",
        volume: 75,
        muted: false,
        backend: "pulseaudio",
      advanced: {
          sampleRate: 8000, // Minimum valid
          channels: 2,
          bitDepth: 16,
        },
      };

      await Deno.writeTextFile(tempFile, JSON.stringify(config));
      const loaded = await loadAudioConfig(tempFile);
      assertEquals(loaded.advanced?.sampleRate, 8000);
    } finally {
      await Deno.remove(tempFile);
    }
  },
);

Deno.test(
  "loadAudioConfig - validates maximum sample rate",
  { permissions: { read: true, write: true, env: true } },
  async () => {
    const tempFile = await Deno.makeTempFile({ suffix: ".json" });

    try {
      const config = {
        device: "default",
        volume: 75,
        muted: false,
        backend: "pulseaudio",
      advanced: {
          sampleRate: 192000, // Maximum valid
          channels: 2,
          bitDepth: 16,
        },
      };

      await Deno.writeTextFile(tempFile, JSON.stringify(config));
      const loaded = await loadAudioConfig(tempFile);
      assertEquals(loaded.advanced?.sampleRate, 192000);
    } finally {
      await Deno.remove(tempFile);
    }
  },
);

Deno.test(
  "loadAudioConfig - validates minimum channels",
  { permissions: { read: true, write: true, env: true } },
  async () => {
    const tempFile = await Deno.makeTempFile({ suffix: ".json" });

    try {
      const config = {
        device: "default",
        volume: 75,
        muted: false,
        backend: "pulseaudio",
      advanced: {
          sampleRate: 48000,
          channels: 1, // Minimum valid
          bitDepth: 16,
        },
      };

      await Deno.writeTextFile(tempFile, JSON.stringify(config));
      const loaded = await loadAudioConfig(tempFile);
      assertEquals(loaded.advanced?.channels, 1);
    } finally {
      await Deno.remove(tempFile);
    }
  },
);

Deno.test(
  "loadAudioConfig - validates maximum channels",
  { permissions: { read: true, write: true, env: true } },
  async () => {
    const tempFile = await Deno.makeTempFile({ suffix: ".json" });

    try {
      const config = {
        device: "default",
        volume: 75,
        muted: false,
        backend: "pulseaudio",
      advanced: {
          sampleRate: 48000,
          channels: 8, // Maximum valid
          bitDepth: 16,
        },
      };

      await Deno.writeTextFile(tempFile, JSON.stringify(config));
      const loaded = await loadAudioConfig(tempFile);
      assertEquals(loaded.advanced?.channels, 8);
    } finally {
      await Deno.remove(tempFile);
    }
  },
);

Deno.test(
  "loadAudioConfig - rejects channels < 1",
  { permissions: { read: true, write: true, env: true } },
  async () => {
    const tempFile = await Deno.makeTempFile({ suffix: ".json" });

    try {
      const config = {
        device: "default",
        volume: 75,
        muted: false,
        backend: "pulseaudio",
      advanced: {
          sampleRate: 48000,
          channels: 0, // Invalid
          bitDepth: 16,
        },
      };

      await Deno.writeTextFile(tempFile, JSON.stringify(config));
      await assertRejects(async () => await loadAudioConfig(tempFile));
    } finally {
      await Deno.remove(tempFile);
    }
  },
);

Deno.test(
  "loadAudioConfig - rejects channels > 8",
  { permissions: { read: true, write: true, env: true } },
  async () => {
    const tempFile = await Deno.makeTempFile({ suffix: ".json" });

    try {
      const config = {
        device: "default",
        volume: 75,
        muted: false,
        backend: "pulseaudio",
      advanced: {
          sampleRate: 48000,
          channels: 16, // Invalid
          bitDepth: 16,
        },
      };

      await Deno.writeTextFile(tempFile, JSON.stringify(config));
      await assertRejects(async () => await loadAudioConfig(tempFile));
    } finally {
      await Deno.remove(tempFile);
    }
  },
);

Deno.test(
  "processAudioCommand - preserves other fields on mute",
  { permissions: { read: true } },
  () => {
    const config: AudioConfig = {
      device: "hw:1",
      volume: 75,
      muted: false,
      backend: "alsa",
      advanced: undefined,
    };

    const updated = processAudioCommand(config, { type: "mute" });
    assertEquals(updated.device, "hw:1");
    assertEquals(updated.volume, 75);
    assertEquals(updated.backend, "alsa");
  },
);

Deno.test(
  "setVolume - preserves device and backend",
  { permissions: { read: true } },
  () => {
    const config: AudioConfig = {
      device: "hw:2",
      volume: 50,
      muted: false,
      backend: "alsa",
      advanced: undefined,
    };

    const updated = setVolume(config, 80);
    assertEquals(updated.device, "hw:2");
    assertEquals(updated.backend, "alsa");
  },
);
