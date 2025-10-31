import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import fc from "https://cdn.skypack.dev/fast-check@3.13.2";
import {
  detectUSBDisplays,
  generateXrandrCommand,
  MonitorConfig,
  parseXrandrOutput,
  validateDisplayConfig,
} from "../../scripts/system/configure-usb-monitor.ts";

Deno.test("parseXrandrOutput should extract display information", () => {
  fc.assert(
    fc.property(
      fc.record({
        name: fc.string({ minLength: 1, maxLength: 20 }).filter((s: string) =>
          s.trim().length > 0 && !/\s/.test(s.trim())
        ),
        connected: fc.boolean(),
        primary: fc.boolean(),
        width: fc.integer({ min: 640, max: 3840 }),
        height: fc.integer({ min: 480, max: 2160 }),
        refreshRate: fc.float({ min: 30, max: 144, noNaN: true }),
      }),
      (display: any) => {
        const xrandrLine = `${display.name} ${
          display.connected ? "connected" : "disconnected"
        } ${
          display.primary ? "primary" : ""
        } ${display.width}x${display.height}+0+0`;

        const parsed = parseXrandrOutput(xrandrLine);

        if (display.connected) {
          assertExists(parsed);
          assertEquals(parsed.name, display.name);
          assertEquals(parsed.connected, display.connected);
          assertEquals(parsed.primary, display.primary);
        }
      },
    ),
    { numRuns: 100 },
  );
});

Deno.test("validateDisplayConfig should validate monitor configurations", () => {
  fc.assert(
    fc.property(
      fc.record({
        name: fc.string({ minLength: 1, maxLength: 20 }).filter((s: string) =>
          s.trim().length > 0 && !/\s/.test(s.trim())
        ),
        enabled: fc.boolean(),
        width: fc.integer({ min: 640, max: 3840 }),
        height: fc.integer({ min: 480, max: 2160 }),
        refreshRate: fc.float({ min: 30, max: 144, noNaN: true }),
        position: fc.record({
          x: fc.integer({ min: -1920, max: 3840 }),
          y: fc.integer({ min: -1080, max: 2160 }),
        }),
      }),
      (config: any) => {
        const isValid = validateDisplayConfig(config);

        const hasValidDimensions = config.width >= 640 && config.height >= 480;
        const hasValidRefreshRate = config.refreshRate >= 30 &&
          config.refreshRate <= 144;
        const hasValidName = config.name.length > 0;

        if (hasValidDimensions && hasValidRefreshRate && hasValidName) {
          assertEquals(isValid, true);
        }
      },
    ),
    { numRuns: 100 },
  );
});

Deno.test("generateXrandrCommand should create valid xrandr commands", () => {
  fc.assert(
    fc.property(
      fc.record({
        name: fc.string({ minLength: 1, maxLength: 20 }).filter((s: string) =>
          !/\s/.test(s)
        ),
        enabled: fc.boolean(),
        width: fc.integer({ min: 640, max: 3840 }),
        height: fc.integer({ min: 480, max: 2160 }),
        refreshRate: fc.float({ min: 30, max: 144, noNaN: true }),
        position: fc.record({
          x: fc.integer({ min: 0, max: 3840 }),
          y: fc.integer({ min: 0, max: 2160 }),
        }),
      }),
      (config: any) => {
        const command = generateXrandrCommand(config);

        assertEquals(command[0], "xrandr");

        const hasDisplayName = command.some((arg) => arg.includes(config.name));
        assertEquals(hasDisplayName, true);

        if (config.enabled) {
          const hasModeArg = command.includes("--mode");
          const hasPosArg = command.includes("--pos");
          assertEquals(hasModeArg, true);
          assertEquals(hasPosArg, true);
        } else {
          const hasOffArg = command.includes("--off");
          assertEquals(hasOffArg, true);
        }
      },
    ),
    { numRuns: 100 },
  );
});

Deno.test("detectUSBDisplays should identify DisplayLink devices", () => {
  fc.assert(
    fc.property(
      fc.array(
        fc.record({
          vendorId: fc.hexaString({ minLength: 4, maxLength: 4 }),
          productId: fc.hexaString({ minLength: 4, maxLength: 4 }),
          description: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        { minLength: 0, maxLength: 5 },
      ),
      (usbDevices: any) => {
        const lsusbOutput = usbDevices.map((device: any) =>
          `Bus 001 Device 001: ID ${device.vendorId}:${device.productId} ${device.description}`
        ).join("\n");

        const displays = detectUSBDisplays(lsusbOutput);

        assertEquals(Array.isArray(displays), true);

        const displayLinkDevices = usbDevices.filter((device: any) =>
          device.description.toLowerCase().includes("displaylink") ||
          device.description.toLowerCase().includes("zenscreen")
        );

        assertEquals(displays.length >= displayLinkDevices.length, true);
      },
    ),
    { numRuns: 100 },
  );
});

Deno.test("monitor configuration should handle edge cases", () => {
  const emptyParsed = parseXrandrOutput("");
  assertEquals(emptyParsed, null);

  const invalidConfig: MonitorConfig = {
    name: "",
    enabled: true,
    width: 0,
    height: 0,
    refreshRate: 0,
    position: { x: 0, y: 0 },
  };

  assertEquals(validateDisplayConfig(invalidConfig), false);

  const disconnectedDisplay = parseXrandrOutput(
    "DP-1 disconnected (normal left inverted right x axis y axis)",
  );
  assertExists(disconnectedDisplay);
  assertEquals(disconnectedDisplay.connected, false);

  // Test valid configuration
  const validConfig: MonitorConfig = {
    name: "DP-1",
    enabled: true,
    width: 1920,
    height: 1080,
    refreshRate: 60,
    position: { x: 1920, y: 0 },
  };
  assertEquals(validateDisplayConfig(validConfig), true);

  // Test disabled monitor command
  const disabledConfig: MonitorConfig = {
    name: "DP-2",
    enabled: false,
    width: 1920,
    height: 1080,
    refreshRate: 60,
    position: { x: 0, y: 0 },
  };
  const disabledCommand = generateXrandrCommand(disabledConfig);
  assertEquals(disabledCommand.includes("--off"), true);

  // Test connected display with primary
  const primaryDisplay = parseXrandrOutput(
    "DP-2 connected primary 1920x1080+0+0",
  );
  assertExists(primaryDisplay);
  assertEquals(primaryDisplay.primary, true);

  // Test USB display detection with no DisplayLink devices
  const noDisplaysOutput =
    "Bus 001 Device 001: ID 1234:5678 Some Random Device";
  const noDisplays = detectUSBDisplays(noDisplaysOutput);
  assertEquals(noDisplays.length, 0);

  // Test USB display detection with DisplayLink device
  const displayLinkOutput =
    "Bus 001 Device 001: ID 17e9:1234 DisplayLink Device";
  const displayLinkDevices = detectUSBDisplays(displayLinkOutput);
  assertEquals(displayLinkDevices.length, 1);
  assertEquals(displayLinkDevices[0]?.isDisplayLink, true);
});
