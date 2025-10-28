#!/usr/bin/env -S deno run --allow-run --allow-read --allow-write --allow-env

import { logger } from "../lib/logger.ts";
import { requireRoot, runCommand } from "../lib/common.ts";
import { exists } from "../../deps.ts";

async function enableWebcam() {
  logger.info("Starting webcam enablement process...");

  // Ensure running with sudo
  requireRoot();

  // Install required packages
  logger.info("Installing video4linux utilities...");
  await runCommand(["apt-get", "update"]);
  await runCommand(["apt-get", "install", "-y", "v4l-utils", "uvcdynctrl", "cheese"]);

  // Load kernel module for USB Video Class devices
  logger.info("Loading UVC video kernel module...");
  await runCommand(["modprobe", "uvcvideo"]);

  // Check for video devices
  logger.info("Checking for video devices...");
  const devicesResult = await runCommand(["v4l2-ctl", "--list-devices"]);

  if (devicesResult.success && devicesResult.stdout) {
    logger.success("Found video devices:");
    console.log(devicesResult.stdout);
  } else {
    logger.warn("No video devices detected yet.");

    // Check USB devices
    const usbResult = await runCommand(["lsusb"]);
    if (usbResult.success) {
      logger.info("USB devices:");
      console.log(usbResult.stdout);
    }

    // Check if camera module is blacklisted
    logger.info("Checking for blacklisted modules...");
    const blacklistFiles = [
      "/etc/modprobe.d/blacklist.conf",
      "/etc/modprobe.d/blacklist-rare-network.conf"
    ];

    for (const file of blacklistFiles) {
      if (await exists(file)) {
        try {
          const content = await Deno.readTextFile(file);
          if (content.includes("uvcvideo")) {
            logger.warn(`uvcvideo is blacklisted in ${file}`);
            logger.info("Removing blacklist entry...");
            const newContent = content.replace(/^blacklist uvcvideo.*$/gm, "# blacklist uvcvideo");
            await Deno.writeTextFile(file, newContent);
          }
        } catch (error) {
          logger.error(`Failed to check ${file}: ${error}`);
        }
      }
    }

    // Reload module
    logger.info("Reloading uvcvideo module...");
    await runCommand(["modprobe", "-r", "uvcvideo"]);
    await runCommand(["modprobe", "uvcvideo"]);

    // Check again
    const devicesAfterResult = await runCommand(["v4l2-ctl", "--list-devices"]);
    if (devicesAfterResult.success && devicesAfterResult.stdout) {
      logger.success("Video devices found after module reload:");
      console.log(devicesAfterResult.stdout);
    }
  }

  // Check device permissions
  logger.info("Checking device permissions...");
  const videoDevicesResult = await runCommand(["ls", "-la", "/dev/video*"]);

  if (videoDevicesResult.success && videoDevicesResult.stdout) {
    console.log(videoDevicesResult.stdout);

    // Add user to video group
    const username = Deno.env.get("SUDO_USER") || Deno.env.get("USER");
    if (username) {
      logger.info(`Adding ${username} to video group...`);
      await runCommand(["usermod", "-a", "-G", "video", username]);
      logger.success(`User ${username} added to video group. You may need to log out and back in for changes to take effect.`);
    }
  }

  // Check for existing video devices
  try {
    const videoFiles = [];
    for await (const entry of Deno.readDir("/dev")) {
      if (entry.name.startsWith("video")) {
        videoFiles.push(`/dev/${entry.name}`);
      }
    }

    if (videoFiles.length > 0) {
      logger.success("Available video devices:");
      for (const device of videoFiles) {
        console.log(`  - ${device}`);
      }

      // Test with cheese
      logger.info("Testing camera with Cheese (webcam application)...");
      logger.info("Run 'cheese' to test your webcam");
      logger.success("Webcam enablement process complete!");
    } else {
      logger.warn("No video devices found. Please check:");
      logger.info("1. Is your webcam physically connected (for external webcams)?");
      logger.info("2. Is the webcam enabled in BIOS/UEFI?");
      logger.info("3. Check dmesg for hardware errors: sudo dmesg | grep -i camera");
      logger.info("4. Try rebooting after running this script");
    }
  } catch (error) {
    logger.error(`Failed to check /dev for video devices: ${error}`);
  }
}

if (import.meta.main) {
  await enableWebcam();
}