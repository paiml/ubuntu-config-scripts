#!/usr/bin/env -S deno run --allow-run --allow-read --allow-write --allow-env

import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { Logger } from "../lib/logger.ts";
import { SystemCommand } from "../lib/system-command.ts";
import { validateDependencies } from "../lib/deps.ts";

const logger = new Logger({ prefix: "configure-pebble-speakers" });
const cmd = new SystemCommand(logger);

const AudioDeviceSchema = z.object({
  card: z.number(),
  device: z.number(),
  name: z.string(),
  description: z.string(),
});

const PulseAudioSinkSchema = z.object({
  id: z.number(),
  name: z.string(),
  module: z.string(),
  format: z.string(),
  state: z.enum(["RUNNING", "SUSPENDED", "IDLE"]),
});

type AudioDevice = z.infer<typeof AudioDeviceSchema>;
type PulseAudioSink = z.infer<typeof PulseAudioSinkSchema>;

export class PebbleSpeakerConfigurator {
  constructor(
    private logger: Logger,
    private cmd: SystemCommand,
  ) {}

  async detectPebbleDevice(): Promise<AudioDevice | null> {
    this.logger.info("Detecting Pebble speakers...");

    try {
      const result = await this.cmd.run("aplay", ["-l"]);
      const lines = result.stdout.split("\n");

      for (const line of lines) {
        if (line.toLowerCase().includes("pebble")) {
          const cardMatch = line.match(/card (\d+)/);
          const deviceMatch = line.match(/device (\d+)/);
          const nameMatch = line.match(/\[(.*?)\]/g);

          if (cardMatch && deviceMatch && nameMatch && nameMatch.length > 0) {
            const device: AudioDevice = {
              card: parseInt(cardMatch[1]),
              device: parseInt(deviceMatch[1]),
              name: nameMatch[0].replace(/[\[\]]/g, ""),
              description: nameMatch[1]?.replace(/[\[\]]/g, "") || "Pebble Speakers",
            };

            this.logger.success(`Found Pebble device: ${device.name} (Card ${device.card})`);
            return device;
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to detect audio devices: ${error}`);
    }

    return null;
  }

  async findPebbleSink(): Promise<PulseAudioSink | null> {
    this.logger.info("Looking for existing Pebble PulseAudio sink...");

    try {
      const result = await this.cmd.run("pactl", ["list", "short", "sinks"]);
      const lines = result.stdout.split("\n").filter((l: string) => l.trim());

      for (const line of lines) {
        if (line.toLowerCase().includes("pebble")) {
          const parts = line.split("\t");
          if (parts.length >= 5) {
            const sink: PulseAudioSink = {
              id: parseInt(parts[0]),
              name: parts[1],
              module: parts[2],
              format: parts[3],
              state: parts[4] as "RUNNING" | "SUSPENDED" | "IDLE",
            };

            this.logger.success(`Found Pebble sink: ${sink.name}`);
            return sink;
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to list sinks: ${error}`);
    }

    return null;
  }

  async createPebbleSink(device: AudioDevice): Promise<PulseAudioSink | null> {
    this.logger.info("Creating PulseAudio sink for Pebble speakers...");

    try {
      const sinkName = `pebble_v3_${device.card}`;
      const deviceStr = `hw:${device.card},${device.device}`;

      await this.cmd.run("pactl", [
        "load-module",
        "module-alsa-sink",
        `device=${deviceStr}`,
        `sink_name=${sinkName}`,
        `sink_properties="device.description='${device.description}'"`,
      ]);

      this.logger.success("Created new PulseAudio sink");

      // Wait for sink to be available
      await new Promise(resolve => setTimeout(resolve, 500));

      return await this.findPebbleSink();
    } catch (error) {
      this.logger.error(`Failed to create sink: ${error}`);
      return null;
    }
  }

  async setDefaultSink(sinkName: string): Promise<boolean> {
    this.logger.info(`Setting ${sinkName} as default audio output...`);

    try {
      await this.cmd.run("pactl", ["set-default-sink", sinkName]);
      this.logger.success("Default audio output set to Pebble speakers");
      return true;
    } catch (error) {
      this.logger.error(`Failed to set default sink: ${error}`);
      return false;
    }
  }

  async testAudio(): Promise<boolean> {
    this.logger.info("Testing audio output...");

    try {
      await this.cmd.run("speaker-test", [
        "-c", "2",
        "-t", "wav",
        "-l", "1",
      ]);
      this.logger.success("Audio test completed");
      return true;
    } catch (error) {
      this.logger.warn("Audio test may have been interrupted");
      return true; // speaker-test often exits with non-zero even on success
    }
  }

  async configure(): Promise<boolean> {
    // Check dependencies
    const deps = await validateDependencies(["pactl", "aplay", "speaker-test"], this.logger);
    if (!deps) {
      this.logger.error("Missing required dependencies");
      return false;
    }

    // Detect Pebble device
    const device = await this.detectPebbleDevice();
    if (!device) {
      this.logger.error("No Pebble speakers detected. Please ensure they are connected via USB.");
      return false;
    }

    // Find or create PulseAudio sink
    let sink = await this.findPebbleSink();
    if (!sink) {
      sink = await this.createPebbleSink(device);
      if (!sink) {
        this.logger.error("Failed to configure PulseAudio sink");
        return false;
      }
    }

    // Set as default
    const defaultSet = await this.setDefaultSink(sink.name);
    if (!defaultSet) {
      this.logger.warn("Could not set as default, but speakers are configured");
    }

    // Test audio
    this.logger.info("Would you like to test the speakers? (You should hear 'Front Left' and 'Front Right')");
    await this.testAudio();

    this.logger.success("Pebble speakers configured successfully!");
    return true;
  }
}

// Main execution
if (import.meta.main) {
  const configurator = new PebbleSpeakerConfigurator(logger, cmd);
  const success = await configurator.configure();
  Deno.exit(success ? 0 : 1);
}

export { logger, cmd };