#!/usr/bin/env -S deno test --allow-run --allow-read --allow-write --allow-env

import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { describe, it } from "https://deno.land/std@0.208.0/testing/bdd.ts";
import fc from "https://cdn.skypack.dev/fast-check@3.14.0";
import { PebbleSpeakerConfigurator } from "../../scripts/audio/configure-pebble-speakers.ts";
import { Logger } from "../../scripts/lib/logger.ts";
import { SystemCommand } from "../../scripts/lib/system-command.ts";
import { stub } from "https://deno.land/std@0.208.0/testing/mock.ts";

describe("PebbleSpeakerConfigurator Property Tests", () => {
  const logger = new Logger({ prefix: "test" });
  const cmd = new SystemCommand(logger);
  const configurator = new PebbleSpeakerConfigurator(logger, cmd);

  describe("detectPebbleDevice parsing", () => {
    it("should handle various card and device numbers", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 99 }),
          fc.integer({ min: 0, max: 99 }),
          fc.string({ minLength: 1, maxLength: 20 }).filter((s: string) => !s.includes("[") && !s.includes("]")),
          async (cardNum: number, deviceNum: number, deviceName: string) => {
            const cmdStub = stub(cmd, "run", () => Promise.resolve({
              stdout: `card ${cardNum}: Pebble [${deviceName}], device ${deviceNum}: USB Audio [USB Audio]`,
              stderr: "",
              code: 0,
              success: true,
            }));

            try {
              const device = await configurator.detectPebbleDevice();
              assertExists(device);
              assertEquals(device?.card, cardNum);
              assertEquals(device?.device, deviceNum);
            } finally {
              cmdStub.restore();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should handle various Pebble model names", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("Pebble", "PEBBLE", "pebble", "PeBbLe"),
          fc.constantFrom("V1", "V2", "V3", "Pro", "Mini", "Max"),
          async (brand: string, model: string) => {
            const fullName = `${brand} ${model}`;
            const cmdStub = stub(cmd, "run", () => Promise.resolve({
              stdout: `card 1: ${fullName} [${fullName}], device 0: USB Audio [USB Audio]`,
              stderr: "",
              code: 0,
              success: true,
            }));

            try {
              const device = await configurator.detectPebbleDevice();
              assertExists(device);
              assertEquals(device?.card, 1);
            } finally {
              cmdStub.restore();
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe("findPebbleSink parsing", () => {
    it("should parse sink IDs correctly", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 999 }),
          fc.constantFrom("RUNNING", "SUSPENDED", "IDLE"),
          async (sinkId: number, state: string) => {
            const sinkName = `pebble_sink_${sinkId}`;
            const cmdStub = stub(cmd, "run", () => Promise.resolve({
              stdout: `${sinkId}\t${sinkName}\tmodule-alsa-card.c\ts16le 2ch 48000Hz\t${state}`,
              stderr: "",
              code: 0,
              success: true,
            }));

            try {
              const sink = await configurator.findPebbleSink();
              assertExists(sink);
              assertEquals(sink?.id, sinkId);
              assertEquals(sink?.state, state);
            } finally {
              cmdStub.restore();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should handle various audio formats", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("s16le", "s24le", "s32le", "float32le"),
          fc.constantFrom("1ch", "2ch", "4ch", "6ch", "8ch"),
          fc.constantFrom("44100Hz", "48000Hz", "96000Hz", "192000Hz"),
          async (format: string, channels: string, rate: string) => {
            const audioFormat = `${format} ${channels} ${rate}`;
            const cmdStub = stub(cmd, "run", () => Promise.resolve({
              stdout: `5\tpebble_v3\tmodule-alsa-card.c\t${audioFormat}\tRUNNING`,
              stderr: "",
              code: 0,
              success: true,
            }));

            try {
              const sink = await configurator.findPebbleSink();
              assertExists(sink);
              assertEquals(sink?.format, audioFormat);
            } finally {
              cmdStub.restore();
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe("sink name generation", () => {
    it("should create consistent sink names", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 99 }),
          fc.integer({ min: 0, max: 99 }),
          async (card: number, device: number) => {
            const expectedName = `pebble_v3_${card}`;
            const deviceStr = `hw:${card},${device}`;

            let capturedArgs: string[] = [];
            const cmdStub = stub(cmd, "run", (_cmd: string, args: string[]) => {
              capturedArgs = args;
              return Promise.resolve({
                stdout: "",
                stderr: "",
                code: 0,
                success: true,
              });
            });

            try {
              await configurator.createPebbleSink({
                card,
                device,
                name: "Test",
                description: "Test Device",
              });

              const sinkNameArg = capturedArgs.find(arg => arg.startsWith("sink_name="));
              assertEquals(sinkNameArg, `sink_name=${expectedName}`);

              const deviceArg = capturedArgs.find(arg => arg.startsWith("device="));
              assertEquals(deviceArg, `device=${deviceStr}`);
            } finally {
              cmdStub.restore();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe("edge cases", () => {
    it("should handle empty and whitespace-only output", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("", " ", "\n", "\t", "   \n\t  "),
          async (output: string) => {
            const cmdStub = stub(cmd, "run", () => Promise.resolve({
              stdout: output,
              stderr: "",
              code: 0,
              success: true,
            }));

            try {
              const device = await configurator.detectPebbleDevice();
              assertEquals(device, null);

              const sink = await configurator.findPebbleSink();
              assertEquals(sink, null);
            } finally {
              cmdStub.restore();
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it("should handle very long device names", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 50, maxLength: 200 }).filter((s: string) => !s.includes("\n") && !s.includes("[") && !s.includes("]")),
          async (longName: string) => {
            const shortName = `Pebble_${longName.substring(0, 10)}`;
            const cmdStub = stub(cmd, "run", () => Promise.resolve({
              stdout: `card 1: ${shortName} [${longName}], device 0: USB Audio [USB Audio]`,
              stderr: "",
              code: 0,
              success: true,
            }));

            try {
              const device = await configurator.detectPebbleDevice();
              assertExists(device);
              // Should handle long names without crashing
              assertExists(device?.name);
              assertExists(device?.description);
            } finally {
              cmdStub.restore();
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it("should handle multiple Pebble devices in output", () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 0, max: 10 }), { minLength: 2, maxLength: 5 }),
          async (cardNumbers: number[]) => {
            const lines = cardNumbers.map((num: number) =>
              `card ${num}: Pebble_${num} [Pebble V${num}], device 0: USB Audio [USB Audio]`
            );

            const cmdStub = stub(cmd, "run", () => Promise.resolve({
              stdout: lines.join("\n"),
              stderr: "",
              code: 0,
              success: true,
            }));

            try {
              const device = await configurator.detectPebbleDevice();
              assertExists(device);
              // Should return the first Pebble device found
              assertEquals(device?.card, cardNumbers[0]);
            } finally {
              cmdStub.restore();
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe("invariants", () => {
    it("should maintain card and device number relationships", () => {
      fc.assert(
        fc.property(
          fc.record({
            card: fc.integer({ min: 0, max: 99 }),
            device: fc.integer({ min: 0, max: 99 }),
            name: fc.string({ minLength: 1, maxLength: 20 }).filter((s: string) => !s.includes("[") && !s.includes("]")),
            description: fc.string({ minLength: 1, maxLength: 50 }).filter((s: string) => !s.includes("[") && !s.includes("]")),
          }),
          async (deviceInfo: any) => {
            const cmdStub = stub(cmd, "run", () => Promise.resolve({
              stdout: `card ${deviceInfo.card}: Pebble [${deviceInfo.name}], device ${deviceInfo.device}: USB Audio [${deviceInfo.description}]`,
              stderr: "",
              code: 0,
              success: true,
            }));

            try {
              const device = await configurator.detectPebbleDevice();
              assertExists(device);

              // Invariants
              assertEquals(device.card >= 0, true);
              assertEquals(device.device >= 0, true);
              assertEquals(typeof device.name, "string");
              assertEquals(typeof device.description, "string");
              assertEquals(device.name.length > 0, true);
            } finally {
              cmdStub.restore();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});