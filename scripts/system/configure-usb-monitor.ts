#!/usr/bin/env -S deno run --allow-run --allow-read --allow-env

import { logger } from "../lib/logger.ts";
import {
  confirm,
  parseArgs,
  requireCommand,
  runCommand,
} from "../lib/common.ts";
import { z } from "../lib/schema.ts";

export interface DisplayInfo {
  name: string;
  connected: boolean;
  primary: boolean;
  width?: number | undefined;
  height?: number | undefined;
  refreshRate?: number | undefined;
  x?: number | undefined;
  y?: number | undefined;
}

export interface MonitorConfig {
  name: string;
  enabled: boolean;
  width: number;
  height: number;
  refreshRate: number;
  position: {
    x: number;
    y: number;
  };
}

export interface USBDisplay {
  vendorId: string;
  productId: string;
  description: string;
  isDisplayLink: boolean;
}

const MonitorConfigSchema = z.object({
  name: z.string().min(1),
  enabled: z.boolean(),
  width: z.number().int().min(640).max(7680),
  height: z.number().int().min(480).max(4320),
  refreshRate: z.number().min(30).max(144),
  position: z.object({
    x: z.number().int().min(-3840).max(7680),
    y: z.number().int().min(-2160).max(4320),
  }),
});

export function parseXrandrOutput(output: string): DisplayInfo | null {
  if (!output.trim()) return null;

  const line = output.trim();

  // Handle connected displays with resolution
  const connectedMatch = line.match(
    /^(\S+)\s+(connected)(\s+primary)?.*?(\d+)x(\d+)\+(\d+)\+(\d+)/,
  );
  if (connectedMatch) {
    const [, name, status, primary, width, height, x, y] = connectedMatch;
    return {
      name: name!,
      connected: status === "connected",
      primary: Boolean(primary?.trim()),
      width: parseInt(width!, 10),
      height: parseInt(height!, 10),
      x: parseInt(x!, 10),
      y: parseInt(y!, 10),
    };
  }

  // Handle disconnected displays
  const disconnectedMatch = line.match(/^(\S+)\s+disconnected/);
  if (disconnectedMatch) {
    return {
      name: disconnectedMatch[1]!,
      connected: false,
      primary: false,
    };
  }

  // Handle edge cases like names with spaces or invalid formats
  if (line.includes("connected") || line.includes("disconnected")) {
    const parts = line.split(/\s+/).filter((p) => p.length > 0);
    if (parts.length >= 2 && parts[0]!.trim().length > 0) {
      return {
        name: parts[0]!.trim(),
        connected: parts[1] === "connected",
        primary: parts.includes("primary"),
      };
    }
  }

  return null;
}

export function validateDisplayConfig(config: MonitorConfig): boolean {
  try {
    MonitorConfigSchema.parse(config);
    return config.name.length > 0 &&
      config.width >= 640 &&
      config.height >= 480 &&
      config.refreshRate >= 30 &&
      config.refreshRate <= 144;
  } catch {
    return false;
  }
}

export function generateXrandrCommand(config: MonitorConfig): string[] {
  const cmd = ["xrandr", "--output", config.name];

  if (config.enabled) {
    cmd.push(
      "--mode",
      `${config.width}x${config.height}`,
      "--rate",
      config.refreshRate.toString(),
      "--pos",
      `${config.position.x}x${config.position.y}`,
    );
  } else {
    cmd.push("--off");
  }

  return cmd;
}

export function detectUSBDisplays(lsusbOutput: string): USBDisplay[] {
  const displays: USBDisplay[] = [];
  const lines = lsusbOutput.split("\n");

  for (const line of lines) {
    const match = line.match(
      /Bus\s+\d+\s+Device\s+\d+:\s+ID\s+([0-9a-f]{4}):([0-9a-f]{4})\s+(.*)/i,
    );
    if (match) {
      const [, vendorId, productId, description] = match;

      const isDisplayLink =
        description!.toLowerCase().includes("displaylink") ||
        description!.toLowerCase().includes("zenscreen") ||
        description!.toLowerCase().includes("mb168") ||
        description!.toLowerCase().includes("mb169") ||
        description!.toLowerCase().includes("billboard") || // USB-C alternate mode
        vendorId === "17e9" || // DisplayLink vendor ID
        vendorId === "1043" || // ASUS vendor ID (some models)
        vendorId === "0bda"; // Realtek (Billboard Device)

      if (isDisplayLink || description!.toLowerCase().includes("display")) {
        displays.push({
          vendorId: vendorId!,
          productId: productId!,
          description: description!,
          isDisplayLink,
        });
      }
    }
  }

  return displays;
}

async function listDisplays(): Promise<DisplayInfo[]> {
  logger.info("Checking current display configuration...");

  const result = await runCommand(["xrandr", "--query"]);
  if (!result.success) {
    throw new Error(`Failed to get display info: ${result.stderr}`);
  }

  const displays: DisplayInfo[] = [];
  const lines = result.stdout.split("\n");

  for (const line of lines) {
    const display = parseXrandrOutput(line);
    if (display) {
      displays.push(display);
    }
  }

  return displays;
}

async function detectUSBMonitors(): Promise<USBDisplay[]> {
  logger.info("Detecting USB displays...");

  const result = await runCommand(["lsusb"]);
  if (!result.success) {
    throw new Error(`Failed to list USB devices: ${result.stderr}`);
  }

  return detectUSBDisplays(result.stdout);
}

async function installDisplayLinkDrivers(): Promise<void> {
  logger.info("Installing DisplayLink drivers...");

  // Check if already installed
  const dpkgResult = await runCommand(["dpkg", "-l", "evdi-dkms"]);
  if (dpkgResult.success && dpkgResult.stdout.includes("evdi-dkms")) {
    logger.info("EVDI drivers already installed");
    return;
  }

  // Install EVDI kernel module
  const installResult = await runCommand([
    "sudo",
    "apt",
    "install",
    "-y",
    "evdi-dkms",
  ]);

  if (!installResult.success) {
    throw new Error(`Failed to install EVDI drivers: ${installResult.stderr}`);
  }

  logger.info("EVDI drivers installed successfully");
}

async function loadKernelModules(): Promise<void> {
  logger.info("Loading USB display kernel modules...");

  const modules = ["udl", "evdi"];

  for (const module of modules) {
    const result = await runCommand(["sudo", "modprobe", module]);
    if (result.success) {
      logger.info(`Loaded kernel module: ${module}`);
    } else {
      logger.warn(`Failed to load kernel module ${module}: ${result.stderr}`);
    }
  }

  // Wait for modules to initialize
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

async function configureZenScreen(): Promise<void> {
  logger.info("Configuring ASUS ZenScreen display...");

  await listDisplays();
  const displays = await listDisplays();

  // Look for newly detected displays after driver installation
  const usbDisplays = displays.filter((d) =>
    d.name.includes("DVI") ||
    d.name.includes("VGA") ||
    d.name.includes("HDMI") ||
    d.name.startsWith("DP-") && d.connected
  );

  if (usbDisplays.length === 0) {
    logger.warn("No USB displays detected. Please check:");
    logger.warn("1. Monitor is connected via USB and powered on");
    logger.warn("2. Using original USB cable (not just charging cable)");
    logger.warn("3. Connected to USB 3.0 port (blue connector)");
    return;
  }

  logger.info(`Found ${usbDisplays.length} potential USB display(s)`);

  for (const display of usbDisplays) {
    logger.info(`Display: ${display.name} - Connected: ${display.connected}`);

    if (!display.connected) continue;

    const shouldConfigure = await confirm(
      `Configure display ${display.name}?`,
      true,
    );

    if (shouldConfigure) {
      // Enable display with common resolution
      const config: MonitorConfig = {
        name: display.name,
        enabled: true,
        width: display.width || 1920,
        height: display.height || 1080,
        refreshRate: 60,
        position: { x: 1920, y: 0 }, // Position to the right of primary
      };

      if (validateDisplayConfig(config)) {
        const command = generateXrandrCommand(config);
        const result = await runCommand(command);

        if (result.success) {
          logger.info(`Successfully configured ${display.name}`);
        } else {
          logger.error(`Failed to configure ${display.name}: ${result.stderr}`);
        }
      } else {
        logger.error(`Invalid configuration for ${display.name}`);
      }
    }
  }
}

async function main(): Promise<void> {
  const args = parseArgs(Deno.args);

  if (args["help"] || args["h"]) {
    console.log(`
ASUS ZenScreen USB Monitor Configuration

Usage: configure-usb-monitor.ts [OPTIONS]

Options:
  --help, -h     Show this help message
  --list, -l     List current displays
  --detect, -d   Detect USB displays only
  --install, -i  Install DisplayLink drivers only
  --auto, -a     Auto-configure without prompts

Examples:
  deno run --allow-all configure-usb-monitor.ts
  deno run --allow-all configure-usb-monitor.ts --list
  deno run --allow-all configure-usb-monitor.ts --install
`);
    return;
  }

  try {
    await requireCommand("xrandr");
    await requireCommand("lsusb");

    if (args["list"] || args["l"]) {
      const displays = await listDisplays();
      console.table(displays);
      return;
    }

    if (args["detect"] || args["d"]) {
      const usbDisplays = await detectUSBMonitors();
      console.table(usbDisplays);
      return;
    }

    if (args["install"] || args["i"]) {
      await installDisplayLinkDrivers();
      await loadKernelModules();
      return;
    }

    // Full configuration process
    logger.info("ASUS ZenScreen USB Monitor Configuration");

    // Step 1: Detect USB displays
    const usbDisplays = await detectUSBMonitors();
    if (usbDisplays.length === 0) {
      logger.warn(
        "No USB displays detected. Please ensure your ZenScreen is connected.",
      );
      return;
    }

    logger.info(`Found ${usbDisplays.length} USB display device(s)`);
    console.table(usbDisplays);

    // Step 2: Install drivers if needed
    const needsDrivers = usbDisplays.some((d) => d.isDisplayLink);
    if (needsDrivers) {
      const installDrivers = args["auto"] || await confirm(
        "Install DisplayLink drivers?",
        true,
      );

      if (installDrivers) {
        await installDisplayLinkDrivers();
        await loadKernelModules();
      }
    }

    // Step 3: Configure displays
    await configureZenScreen();

    logger.info("USB monitor configuration complete!");
  } catch (error) {
    logger.error(`Configuration failed: ${error}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
