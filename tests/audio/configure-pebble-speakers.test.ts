#!/usr/bin/env -S deno test --allow-run --allow-read --allow-write --allow-env

import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { describe, it, beforeEach, afterEach } from "https://deno.land/std@0.208.0/testing/bdd.ts";
import { stub, assertSpyCalls } from "https://deno.land/std@0.208.0/testing/mock.ts";
import { PebbleSpeakerConfigurator } from "../../scripts/audio/configure-pebble-speakers.ts";
import { Logger } from "../../scripts/lib/logger.ts";
import { SystemCommand } from "../../scripts/lib/system-command.ts";

describe("PebbleSpeakerConfigurator", () => {
  let configurator: PebbleSpeakerConfigurator;
  let logger: Logger;
  let cmd: SystemCommand;
  let cmdStub: any;

  beforeEach(() => {
    logger = new Logger({ prefix: "test" });
    cmd = new SystemCommand(logger);
    configurator = new PebbleSpeakerConfigurator(logger, cmd);
  });

  afterEach(() => {
    if (cmdStub) {
      cmdStub.restore();
    }
  });

  describe("detectPebbleDevice", () => {
    it("should detect Pebble device from aplay output", async () => {
      cmdStub = stub(cmd, "run", () => Promise.resolve({
        stdout: "card 3: V3 [Pebble V3], device 0: USB Audio [USB Audio]\n  Subdevices: 1/1",
        stderr: "",
        code: 0,
        success: true,
      }));

      const device = await configurator.detectPebbleDevice();
      assertExists(device);
      assertEquals(device?.card, 3);
      assertEquals(device?.device, 0);
      assertEquals(device?.name, "Pebble V3");
      assertSpyCalls(cmdStub, 1);
    });

    it("should return null when no Pebble device found", async () => {
      cmdStub = stub(cmd, "run", () => Promise.resolve({
        stdout: "card 0: PCH [HDA Intel PCH], device 0: ALC892 Analog [ALC892 Analog]",
        stderr: "",
        code: 0,
        success: true,
      }));

      const device = await configurator.detectPebbleDevice();
      assertEquals(device, null);
    });

    it("should handle aplay command failure", async () => {
      cmdStub = stub(cmd, "run", () => Promise.reject(new Error("Command failed")));

      const device = await configurator.detectPebbleDevice();
      assertEquals(device, null);
    });

    it("should parse multiple bracket groups correctly", async () => {
      cmdStub = stub(cmd, "run", () => Promise.resolve({
        stdout: "card 2: Pebble [Pebble V2], device 1: USB Audio [USB Audio Device]",
        stderr: "",
        code: 0,
        success: true,
      }));

      const device = await configurator.detectPebbleDevice();
      assertExists(device);
      assertEquals(device?.description, "Pebble V2");
    });
  });

  describe("findPebbleSink", () => {
    it("should find existing Pebble sink", async () => {
      cmdStub = stub(cmd, "run", () => Promise.resolve({
        stdout: "5\talsa_output.usb-ACTIONS_Pebble_V3-00.analog-stereo\tmodule-alsa-card.c\ts16le 2ch 48000Hz\tRUNNING",
        stderr: "",
        code: 0,
        success: true,
      }));

      const sink = await configurator.findPebbleSink();
      assertExists(sink);
      assertEquals(sink?.id, 5);
      assertEquals(sink?.state, "RUNNING");
    });

    it("should return null when no Pebble sink exists", async () => {
      cmdStub = stub(cmd, "run", () => Promise.resolve({
        stdout: "1\talsa_output.pci-0000_00_1f.3.analog-stereo\tmodule-alsa-card.c\ts16le 2ch 44100Hz\tSUSPENDED",
        stderr: "",
        code: 0,
        success: true,
      }));

      const sink = await configurator.findPebbleSink();
      assertEquals(sink, null);
    });

    it("should handle empty output", async () => {
      cmdStub = stub(cmd, "run", () => Promise.resolve({
        stdout: "",
        stderr: "",
        code: 0,
        success: true,
      }));

      const sink = await configurator.findPebbleSink();
      assertEquals(sink, null);
    });

    it("should handle malformed lines", async () => {
      cmdStub = stub(cmd, "run", () => Promise.resolve({
        stdout: "invalid line format pebble",
        stderr: "",
        code: 0,
        success: true,
      }));

      const sink = await configurator.findPebbleSink();
      assertEquals(sink, null);
    });
  });

  describe("createPebbleSink", () => {
    it("should create new sink for device", async () => {
      let callCount = 0;
      cmdStub = stub(cmd, "run", () => {
        callCount++;
        if (callCount === 1) {
          // load-module call
          return Promise.resolve({
            stdout: "25",
            stderr: "",
            code: 0,
            success: true,
          });
        } else {
          // findPebbleSink call
          return Promise.resolve({
            stdout: "5\tpebble_v3_3\tmodule-alsa-sink\ts16le 2ch 48000Hz\tRUNNING",
            stderr: "",
            code: 0,
            success: true,
          });
        }
      });

      const device = {
        card: 3,
        device: 0,
        name: "Pebble V3",
        description: "Pebble V3 Speakers",
      };

      const sink = await configurator.createPebbleSink(device);
      assertExists(sink);
      assertEquals(sink?.name, "pebble_v3_3");
      assertSpyCalls(cmdStub, 2);
    });

    it("should handle module load failure", async () => {
      cmdStub = stub(cmd, "run", () => Promise.reject(new Error("Module load failed")));

      const device = {
        card: 3,
        device: 0,
        name: "Pebble V3",
        description: "Pebble V3 Speakers",
      };

      const sink = await configurator.createPebbleSink(device);
      assertEquals(sink, null);
    });
  });

  describe("setDefaultSink", () => {
    it("should set default sink successfully", async () => {
      cmdStub = stub(cmd, "run", () => Promise.resolve({
        stdout: "",
        stderr: "",
        code: 0,
        success: true,
      }));

      const result = await configurator.setDefaultSink("pebble_sink");
      assertEquals(result, true);
      assertSpyCalls(cmdStub, 1);
    });

    it("should handle set-default-sink failure", async () => {
      cmdStub = stub(cmd, "run", () => Promise.reject(new Error("Failed")));

      const result = await configurator.setDefaultSink("invalid_sink");
      assertEquals(result, false);
    });
  });

  describe("testAudio", () => {
    it("should run speaker test successfully", async () => {
      cmdStub = stub(cmd, "run", () => Promise.resolve({
        stdout: "Front Left\nFront Right",
        stderr: "",
        code: 0,
        success: true,
      }));

      const result = await configurator.testAudio();
      assertEquals(result, true);
    });

    it("should handle speaker-test interruption gracefully", async () => {
      cmdStub = stub(cmd, "run", () => Promise.reject(new Error("Interrupted")));

      const result = await configurator.testAudio();
      assertEquals(result, true); // Returns true even on error
    });
  });

  describe("configure", () => {
    it("should configure Pebble speakers end-to-end", async () => {
      let callIndex = 0;
      const calls = [
        // validateDependencies calls
        { stdout: "/usr/bin/pactl", stderr: "", code: 0, success: true },
        { stdout: "/usr/bin/aplay", stderr: "", code: 0, success: true },
        { stdout: "/usr/bin/speaker-test", stderr: "", code: 0, success: true },
        // detectPebbleDevice
        { stdout: "card 3: V3 [Pebble V3], device 0: USB Audio [USB Audio]", stderr: "", code: 0, success: true },
        // findPebbleSink (not found)
        { stdout: "", stderr: "", code: 0, success: true },
        // createPebbleSink - load-module
        { stdout: "25", stderr: "", code: 0, success: true },
        // createPebbleSink - findPebbleSink
        { stdout: "5\tpebble_v3_3\tmodule-alsa-sink\ts16le 2ch 48000Hz\tRUNNING", stderr: "", code: 0, success: true },
        // setDefaultSink
        { stdout: "", stderr: "", code: 0, success: true },
        // testAudio
        { stdout: "Front Left\nFront Right", stderr: "", code: 0, success: true },
      ];

      cmdStub = stub(cmd, "run", () => {
        const result = calls[callIndex];
        callIndex++;
        return Promise.resolve(result);
      });

      const result = await configurator.configure();
      assertEquals(result, true);
      assertSpyCalls(cmdStub, 9);
    });

    it("should fail when no device detected", async () => {
      let callIndex = 0;
      const calls = [
        // validateDependencies calls
        { stdout: "/usr/bin/pactl", stderr: "", code: 0, success: true },
        { stdout: "/usr/bin/aplay", stderr: "", code: 0, success: true },
        { stdout: "/usr/bin/speaker-test", stderr: "", code: 0, success: true },
        // detectPebbleDevice (no pebble found)
        { stdout: "card 0: PCH [HDA Intel PCH], device 0: ALC892 Analog", stderr: "", code: 0, success: true },
      ];

      cmdStub = stub(cmd, "run", () => {
        const result = calls[callIndex];
        callIndex++;
        return Promise.resolve(result);
      });

      const result = await configurator.configure();
      assertEquals(result, false);
    });

    it("should use existing sink if found", async () => {
      let callIndex = 0;
      const calls = [
        // validateDependencies calls
        { stdout: "/usr/bin/pactl", stderr: "", code: 0, success: true },
        { stdout: "/usr/bin/aplay", stderr: "", code: 0, success: true },
        { stdout: "/usr/bin/speaker-test", stderr: "", code: 0, success: true },
        // detectPebbleDevice
        { stdout: "card 3: V3 [Pebble V3], device 0: USB Audio [USB Audio]", stderr: "", code: 0, success: true },
        // findPebbleSink (found existing)
        { stdout: "5\talsa_output.usb-ACTIONS_Pebble_V3-00.analog-stereo\tmodule-alsa-card.c\ts16le 2ch 48000Hz\tRUNNING", stderr: "", code: 0, success: true },
        // setDefaultSink
        { stdout: "", stderr: "", code: 0, success: true },
        // testAudio
        { stdout: "Front Left\nFront Right", stderr: "", code: 0, success: true },
      ];

      cmdStub = stub(cmd, "run", () => {
        const result = calls[callIndex];
        callIndex++;
        return Promise.resolve(result);
      });

      const result = await configurator.configure();
      assertEquals(result, true);
      assertSpyCalls(cmdStub, 7); // Fewer calls since we skip createPebbleSink
    });
  });
});