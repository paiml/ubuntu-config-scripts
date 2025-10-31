#!/usr/bin/env -S deno run --allow-run --allow-read --allow-write --allow-env

import { logger } from "../lib/logger.ts";
import { requireRoot, runCommand } from "../lib/common.ts";

async function forceEnableWebcam() {
  logger.info("Force enabling USB webcam with multiple approaches...");

  // Ensure running with sudo
  requireRoot();

  // Step 1: Remove and reload all video modules
  logger.info("Removing all video kernel modules...");
  const modules = ["uvcvideo", "videobuf2_vmalloc", "videobuf2_memops", "videobuf2_v4l2", "videobuf2_common", "videodev"];
  for (const mod of modules) {
    await runCommand(["rmmod", mod]);
  }

  // Step 2: Reset USB subsystem
  logger.info("Resetting USB subsystem...");

  // Find the Microdia device
  const lsusbResult = await runCommand(["lsusb", "-d", "0c45:1a0d"]);
  if (lsusbResult.success && lsusbResult.stdout) {
    const match = lsusbResult.stdout.match(/Bus (\d+) Device (\d+)/);
    if (match) {
      const bus = match[1].padStart(3, '0');
      const device = match[2].padStart(3, '0');

      logger.info(`Found Microdia webcam at Bus ${bus} Device ${device}`);

      // Try usbreset if available
      const usbresetResult = await runCommand(["which", "usbreset"]);
      if (usbresetResult.success) {
        await runCommand(["usbreset", "0c45:1a0d"]);
      } else {
        // Install usbreset
        await runCommand(["apt-get", "install", "-y", "usbutils"]);
      }
    }
  }

  // Step 3: Load modules with various quirks
  logger.info("Loading UVC driver with various quirks...");

  const quirksToTry = [
    [""], // No quirks
    ["quirks=128"], // Microdia quirk
    ["nodrop=1", "timeout=5000"], // Timeout quirks
    ["quirks=2"], // Fix bandwidth
    ["quirks=0x100"], // UVC 1.5 force
  ];

  for (const quirks of quirksToTry) {
    logger.info(`Trying with quirks: ${quirks.join(" ") || "none"}`);

    // Unload first
    await runCommand(["rmmod", "uvcvideo"]);
    await new Promise(resolve => setTimeout(resolve, 500));

    // Load with quirks
    const args = ["modprobe", "uvcvideo", ...quirks];
    await runCommand(args);
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Check if device appeared
    const checkResult = await runCommand(["ls", "/dev/video*"]);
    if (checkResult.success && checkResult.stdout) {
      logger.success(`Success! Video devices found with quirks: ${quirks.join(" ")}`);
      console.log(checkResult.stdout);

      // Make permanent
      if (quirks.length > 0) {
        const modprobeConf = `/etc/modprobe.d/uvcvideo.conf`;
        const content = `options uvcvideo ${quirks.join(" ")}\n`;
        await Deno.writeTextFile(modprobeConf, content);
        logger.info(`Saved configuration to ${modprobeConf}`);
      }

      // Set permissions
      await runCommand(["chmod", "666", "/dev/video0"]);

      // Add user to video group
      const username = Deno.env.get("SUDO_USER") || Deno.env.get("USER");
      if (username) {
        await runCommand(["usermod", "-a", "-G", "video", username]);
      }

      // Test device
      const v4lResult = await runCommand(["v4l2-ctl", "--list-devices"]);
      if (v4lResult.success) {
        console.log(v4lResult.stdout);
      }

      logger.success("Webcam enabled successfully!");
      logger.info("Test with: cheese or guvcview");
      return;
    }
  }

  // Step 4: Try USB autosuspend disable
  logger.warn("Standard approaches failed. Trying USB power management fix...");

  // Disable USB autosuspend for this device
  try {
    const usbDevices = await runCommand(["find", "/sys/bus/usb/devices/", "-name", "idVendor"]);
    if (usbDevices.success) {
      for (const vendorFile of usbDevices.stdout.split('\n').filter(Boolean)) {
        const vendor = await Deno.readTextFile(vendorFile).catch(() => "");
        if (vendor.trim() === "0c45") {
          const devicePath = vendorFile.replace("/idVendor", "");
          const productFile = `${devicePath}/idProduct`;
          const product = await Deno.readTextFile(productFile).catch(() => "");

          if (product.trim() === "1a0d") {
            logger.info(`Found device at ${devicePath}`);

            // Disable autosuspend
            const powerControl = `${devicePath}/power/control`;
            await Deno.writeTextFile(powerControl, "on").catch(() => {});

            // Reset device
            const authorizedFile = `${devicePath}/authorized`;
            await Deno.writeTextFile(authorizedFile, "0");
            await new Promise(resolve => setTimeout(resolve, 1000));
            await Deno.writeTextFile(authorizedFile, "1");

            logger.info("USB power management disabled and device reset");
          }
        }
      }
    }
  } catch (error) {
    logger.warn(`Could not modify USB power settings: ${error}`);
  }

  // Final attempt with all modules
  await runCommand(["modprobe", "uvcvideo", "nodrop=1", "timeout=5000", "quirks=128"]);
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Final check
  const finalCheck = await runCommand(["ls", "/dev/video*"]);
  if (finalCheck.success && finalCheck.stdout) {
    logger.success("Video device found after power management fix!");
    console.log(finalCheck.stdout);
  } else {
    logger.error("Could not enable webcam. Manual intervention needed.");
    logger.info("\nManual steps to try:");
    logger.info("1. Physically disconnect and reconnect the webcam");
    logger.info("2. Try a different USB port (USB 2.0 preferred)");
    logger.info("3. Check if webcam works on another system");
    logger.info("4. Update system firmware: sudo fwupdmgr update");
    logger.info("5. Check BIOS for USB legacy support options");

    // Show detailed USB info
    const usbInfoResult = await runCommand(["lsusb", "-v", "-d", "0c45:1a0d"]);
    if (usbInfoResult.success && usbInfoResult.stdout) {
      logger.info("\nDetailed USB information:");
      const lines = usbInfoResult.stdout.split('\n').slice(0, 50);
      lines.forEach(line => console.log(line));
    }
  }
}

if (import.meta.main) {
  await forceEnableWebcam();
}