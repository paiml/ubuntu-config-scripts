#!/usr/bin/env -S deno run --allow-run --allow-read --allow-write --allow-env

import { logger } from "../lib/logger.ts";
import { requireRoot, runCommand } from "../lib/common.ts";

async function enableMicrodiaWebcam() {
  logger.info("Enabling Microdia FC750R webcam...");

  // Ensure running with sudo
  requireRoot();

  // Install required packages
  logger.info("Installing video utilities and drivers...");
  await runCommand(["apt-get", "update"]);
  await runCommand([
    "apt-get",
    "install",
    "-y",
    "v4l-utils",
    "uvcdynctrl",
    "cheese",
    "guvcview",
    "linux-modules-extra-" + (await runCommand(["uname", "-r"])).stdout.trim(),
  ]);

  // Load USB Video Class driver
  logger.info("Loading UVC video driver...");
  await runCommand(["modprobe", "uvcvideo"]);

  // Reset USB device to force re-enumeration
  logger.info("Resetting Microdia webcam USB device...");

  // Find the device path
  const devicesResult = await runCommand([
    "ls",
    "-la",
    "/sys/bus/usb/devices/",
  ]);
  if (devicesResult.success) {
    const lines = devicesResult.stdout.split("\n");
    for (const line of lines) {
      if (line.includes("0c45:1a0d") || line.includes("5-6")) { // Bus 5 Device 6
        const match = line.match(/\/([0-9]+-[0-9.]+)$/);
        if (match) {
          const devicePath = match[1];
          logger.info(`Found device at ${devicePath}, resetting...`);

          // Unbind and rebind the device
          try {
            await Deno.writeTextFile(
              `/sys/bus/usb/drivers/usb/unbind`,
              devicePath,
            );
            await new Promise((resolve) => setTimeout(resolve, 1000));
            await Deno.writeTextFile(
              `/sys/bus/usb/drivers/usb/bind`,
              devicePath,
            );
          } catch (error) {
            logger.warn(`Could not reset device: ${error}`);
          }
        }
      }
    }
  }

  // Force reload of uvcvideo with quirks for Microdia
  logger.info("Reloading UVC driver with Microdia quirks...");
  await runCommand(["modprobe", "-r", "uvcvideo"]);
  await runCommand(["modprobe", "uvcvideo", "quirks=128"]);

  // Wait a moment for device to initialize
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Check for video devices
  logger.info("Checking for video devices...");
  const v4lResult = await runCommand(["v4l2-ctl", "--list-devices"]);
  if (v4lResult.success && v4lResult.stdout) {
    logger.success("Video devices found:");
    console.log(v4lResult.stdout);
  }

  // Check device capabilities
  const videoFiles = [];
  try {
    for await (const entry of Deno.readDir("/dev")) {
      if (entry.name.startsWith("video")) {
        videoFiles.push(`/dev/${entry.name}`);
      }
    }
  } catch {
    // Ignore errors
  }

  if (videoFiles.length > 0) {
    logger.success("Found video device nodes:");
    for (const device of videoFiles) {
      console.log(`  - ${device}`);

      // Check device info
      const infoResult = await runCommand(["v4l2-ctl", "-d", device, "--info"]);
      if (infoResult.success) {
        console.log(infoResult.stdout);
      }
    }

    // Add user to video group
    const username = Deno.env.get("SUDO_USER") || Deno.env.get("USER");
    if (username) {
      logger.info(`Adding ${username} to video group...`);
      await runCommand(["usermod", "-a", "-G", "video", username]);
    }

    // Set permissions
    for (const device of videoFiles) {
      await runCommand(["chmod", "666", device]);
    }

    logger.success("Webcam enabled successfully!");
    logger.info("Test your webcam with:");
    logger.info("  - cheese (simple webcam app)");
    logger.info("  - guvcview (advanced webcam app)");
    logger.info("  - Or in your browser at https://webcamtests.com");
  } else {
    logger.error("No video devices created. Troubleshooting steps:");

    // Check dmesg for errors
    const dmesgResult = await runCommand(["dmesg"]);
    if (dmesgResult.success) {
      const relevantLines = dmesgResult.stdout.split("\n").filter((line) =>
        line.toLowerCase().includes("0c45:1a0d") ||
        line.toLowerCase().includes("microdia") ||
        line.toLowerCase().includes("uvcvideo") ||
        line.toLowerCase().includes("video")
      ).slice(-20);

      if (relevantLines.length > 0) {
        logger.info("Recent kernel messages:");
        relevantLines.forEach((line) => console.log(line));
      }
    }

    logger.info("\nTry these steps:");
    logger.info("1. Unplug and replug the webcam");
    logger.info("2. Try a different USB port (preferably USB 2.0)");
    logger.info("3. Run: sudo modprobe uvcvideo nodrop=1 timeout=5000");
    logger.info("4. Reboot and run this script again");
  }
}

if (import.meta.main) {
  await enableMicrodiaWebcam();
}
