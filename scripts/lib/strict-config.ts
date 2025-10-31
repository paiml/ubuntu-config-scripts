/**
 * Example of strict type checking with runtime validation
 * Shows how to create type-safe configurations with validation
 */

import { type InferType, z } from "./schema.ts";
import { Logger } from "./logger.ts";

const logger = new Logger({ prefix: "config" });

// Define a strict configuration schema
const AudioConfigSchema = z.object({
  device: z.union(
    z.string().min(1),
    z.number().int().min(0),
  ),
  volume: z.number().min(0).max(100),
  muted: z.boolean(),
  backend: z.union(
    z.string().regex(/^(pulseaudio|alsa)$/),
  ),
  advanced: z.optional(z.object({
    sampleRate: z.number().int().min(8000).max(192000),
    channels: z.number().int().min(1).max(8),
    bitDepth: z.number().int().min(8).max(32),
  })),
});

// Type is automatically inferred from schema
export type AudioConfig = InferType<typeof AudioConfigSchema>;

// Compile-time type checking example
// deno-lint-ignore no-unused-vars
// @ts-ignore - Example code for documentation
const _validConfig: AudioConfig = {
  device: "default",
  volume: 75,
  muted: false,
  backend: "pulseaudio",
  advanced: {
    sampleRate: 48000,
    channels: 2,
    bitDepth: 16,
  },
};

// This would cause a TypeScript error:
// const invalidConfig: AudioConfig = {
//   device: "default",
//   volume: 150, // Error: Type '150' is not assignable
//   muted: "no", // Error: Type 'string' is not assignable to type 'boolean'
//   backend: "oss", // Error: Type '"oss"' is not assignable
// };

/**
 * Load and validate configuration with strict type checking
 */
export async function loadAudioConfig(path: string): Promise<AudioConfig> {
  try {
    const text = await Deno.readTextFile(path);
    const data = JSON.parse(text);

    // Runtime validation with type safety
    const result = AudioConfigSchema.safeParse(data);

    if (!result.success) {
      throw new Error(`Invalid configuration: ${result.error}`);
    }

    // result.data is fully typed as AudioConfig
    logger.info(
      `Loaded audio config: device=${result.data.device}, volume=${result.data.volume}`,
    );
    return result.data;
  } catch (error) {
    logger.error("Failed to load configuration", error);
    throw error;
  }
}

/**
 * Example of a function with strict parameter validation
 */
export function setVolume(config: AudioConfig, newVolume: number): AudioConfig {
  // Runtime validation
  const volumeSchema = z.number().min(0).max(100);
  const validVolume = volumeSchema.parse(newVolume); // Throws if invalid

  // Type-safe update
  return {
    ...config,
    volume: validVolume,
    muted: false, // Unmute when setting volume
  };
}

/**
 * Example of exhaustive type checking with discriminated unions
 */
type AudioCommand =
  | { type: "set-volume"; volume: number }
  | { type: "mute" }
  | { type: "unmute" }
  | { type: "switch-device"; device: string | number }
  | { type: "configure"; config: Partial<AudioConfig> };

export function processAudioCommand(
  config: AudioConfig,
  command: AudioCommand,
): AudioConfig {
  // TypeScript ensures all cases are handled
  switch (command.type) {
    case "set-volume":
      return setVolume(config, command.volume);

    case "mute":
      return { ...config, muted: true };

    case "unmute":
      return { ...config, muted: false };

    case "switch-device":
      return { ...config, device: command.device };

    case "configure": {
      // Validate partial update
      const merged = { ...config, ...command.config };
      return AudioConfigSchema.parse(merged);
    }

      // No default case needed - TypeScript ensures exhaustiveness
  }
}

/**
 * Example of branded types for extra type safety
 */
export type DeviceId = string & { readonly __brand: "DeviceId" };
export type DeviceName = string & { readonly __brand: "DeviceName" };

export function createDeviceId(id: string): DeviceId {
  if (!id || id.length === 0) {
    throw new Error("Device ID cannot be empty");
  }
  return id as DeviceId;
}

export function createDeviceName(name: string): DeviceName {
  if (!name || name.length === 0) {
    throw new Error("Device name cannot be empty");
  }
  return name as DeviceName;
}

// These types are incompatible even though both are strings
// const id: DeviceId = createDeviceId("hw:0");
// const name: DeviceName = createDeviceName("Microphone");
// const error: DeviceId = name; // Type error!

/**
 * Example of const assertions for literal types
 */
export const AUDIO_BACKENDS = ["pulseaudio", "alsa"] as const;
export type AudioBackend = typeof AUDIO_BACKENDS[number]; // "pulseaudio" | "alsa"

export const SAMPLE_RATES = [8000, 16000, 44100, 48000, 96000, 192000] as const;
export type SampleRate = typeof SAMPLE_RATES[number];

// Function that only accepts valid sample rates
export function configureSampleRate(rate: SampleRate): void {
  logger.info(`Setting sample rate to ${rate}Hz`);
}

// configureSampleRate(22050); // Type error! Not a valid sample rate
configureSampleRate(48000); // OK

/**
 * Example of template literal types
 */
type LogLevel = "debug" | "info" | "warn" | "error";
type LogMessage<T extends LogLevel> = `[${Uppercase<T>}] ${string}`;

function logWithLevel<T extends LogLevel>(
  _level: T,
  message: LogMessage<T>,
): void {
  console.log(message);
}

// Type-safe logging
logWithLevel("info", "[INFO] Configuration loaded"); // OK
// logWithLevel("info", "[WARN] Wrong level"); // Type error!

/**
 * Example of conditional types for API responses
 */
type ApiResponse<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

export function fetchAudioDevices(): Promise<ApiResponse<string[]>> {
  // Simulated API call - in real code this would be async
  return Promise.resolve({ success: true, data: ["default", "hw:0", "hw:1"] });
}

// Type-safe response handling
export async function getFirstDevice(): Promise<string | null> {
  const response = await fetchAudioDevices();

  if (response.success) {
    // TypeScript knows response.data exists here
    return response.data[0] ?? null;
  } else {
    // TypeScript knows response.error exists here
    logger.error("Failed to fetch devices", response.error);
    return null;
  }
}
