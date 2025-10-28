#!/usr/bin/env -S deno run --allow-run --allow-read --allow-write --allow-env

import { logger } from "../lib/logger.ts";
import { runCommand } from "../lib/common.ts";

async function diagnoseWebcam() {
  logger.info("Running webcam diagnostics...");

  // Check for camera in various ways
  logger.info("Checking for camera devices...");

  // 1. Check lspci for camera controllers
  const lspciResult = await runCommand(["lspci"]);
  if (lspciResult.success) {
    const cameraLines = lspciResult.stdout.split('\n').filter(line =>
      line.toLowerCase().includes('camera') ||
      line.toLowerCase().includes('multimedia') ||
      line.toLowerCase().includes('video')
    );
    if (cameraLines.length > 0) {
      logger.info("Found potential camera controllers in PCI:");
      cameraLines.forEach(line => console.log(`  - ${line}`));
    }
  }

  // 2. Check for camera in USB devices with more detail
  logger.info("\nChecking USB devices in detail...");
  const lsusbVerbose = await runCommand(["lsusb", "-v"]);
  if (lsusbVerbose.success) {
    const lines = lsusbVerbose.stdout.split('\n');
    let inVideoDevice = false;
    let deviceInfo = "";

    for (const line of lines) {
      if (line.includes("Bus ") && line.includes("Device ")) {
        if (inVideoDevice && deviceInfo) {
          logger.info("Found video device:");
          console.log(deviceInfo);
        }
        deviceInfo = line + "\n";
        inVideoDevice = false;
      } else if (line.toLowerCase().includes("video") ||
                 line.toLowerCase().includes("camera") ||
                 line.toLowerCase().includes("webcam")) {
        inVideoDevice = true;
        deviceInfo += line + "\n";
      } else if (inVideoDevice) {
        deviceInfo += line + "\n";
      }
    }
  }

  // 3. Check kernel modules
  logger.info("\nChecking loaded kernel modules...");
  const lsmodResult = await runCommand(["lsmod"]);
  if (lsmodResult.success) {
    const videoModules = lsmodResult.stdout.split('\n').filter(line =>
      line.includes('video') || line.includes('uvc') || line.includes('camera')
    );
    if (videoModules.length > 0) {
      logger.info("Video-related kernel modules:");
      videoModules.forEach(module => console.log(`  - ${module}`));
    }
  }

  // 4. Check if laptop has built-in camera disabled in BIOS
  logger.info("\nChecking ACPI devices...");
  const acpiResult = await runCommand(["ls", "-la", "/sys/bus/acpi/devices/"]);
  if (acpiResult.success) {
    const cameraDevices = acpiResult.stdout.split('\n').filter(line =>
      line.toLowerCase().includes('cam') || line.toLowerCase().includes('video')
    );
    if (cameraDevices.length > 0) {
      logger.info("Found ACPI camera devices:");
      cameraDevices.forEach(device => console.log(`  - ${device}`));
    }
  }

  // 5. Check for v4l devices
  logger.info("\nChecking Video4Linux devices...");
  const v4lDir = "/sys/class/video4linux/";
  try {
    const entries = [];
    for await (const entry of Deno.readDir(v4lDir)) {
      entries.push(entry.name);
    }
    if (entries.length > 0) {
      logger.success("Found V4L devices:");
      entries.forEach(entry => console.log(`  - ${entry}`));
    } else {
      logger.warn("No V4L devices found");
    }
  } catch {
    logger.warn("V4L directory not found");
  }

  // 6. Check privacy switches or function keys
  logger.info("\nChecking for privacy switches...");
  const rfkillResult = await runCommand(["rfkill", "list"]);
  if (rfkillResult.success) {
    console.log(rfkillResult.stdout);
  }

  // 7. Suggest manual checks
  logger.info("\n" + "=".repeat(60));
  logger.info("Manual checks to perform:");
  logger.info("1. Physical privacy switch/shutter:");
  logger.info("   - Check for a physical switch or slider near the camera");
  logger.info("   - Some laptops have a camera cover or privacy shutter");
  logger.info("\n2. Function keys:");
  logger.info("   - Try Fn + F6, F7, F8, or F10 (varies by laptop)");
  logger.info("   - Look for a camera icon on function keys");
  logger.info("\n3. BIOS/UEFI settings:");
  logger.info("   - Restart and enter BIOS (usually F2, F12, or Del at startup)");
  logger.info("   - Look for 'Camera', 'Webcam', or 'Integrated Peripherals'");
  logger.info("   - Ensure camera is enabled");
  logger.info("\n4. Laptop model:");
  logger.info("   - What's your laptop model? Some have specific quirks");

  // Check system info
  const dmidecodeResult = await runCommand(["sudo", "dmidecode", "-t", "system"]);
  if (dmidecodeResult.success) {
    const lines = dmidecodeResult.stdout.split('\n');
    const manufacturer = lines.find(l => l.includes("Manufacturer:"));
    const product = lines.find(l => l.includes("Product Name:"));
    if (manufacturer || product) {
      logger.info("\nSystem information:");
      if (manufacturer) console.log(`  ${manufacturer.trim()}`);
      if (product) console.log(`  ${product.trim()}`);
    }
  }
}

if (import.meta.main) {
  await diagnoseWebcam();
}