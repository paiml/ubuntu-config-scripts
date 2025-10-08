#!/usr/bin/env -S deno run --allow-all

/**
 * OBS Studio Configuration Script
 * Refactored to comply with PMAT quality standards (max 500 lines)
 *
 * Automated setup for screencasting and course recording
 */

import { logger } from "../lib/logger.ts";
import {
  commandExists,
  ensureDir,
  runCommand,
} from "../lib/common.ts";
import { parseArgs } from "jsr:@std/cli@^1.0.0";

// Import configuration modules
import { OBSConfigSchema, type OBSConfig } from "./obs-config/types.ts";
import {
  checkNvidiaSupport,
  checkVaapiSupport,
  detectBestEncoder,
} from "./obs-config/encoder-detection.ts";
import { getAudioDevices } from "./obs-config/audio-devices.ts";
import { createOBSProfile } from "./obs-config/profile.ts";

const HOME = Deno.env.get("HOME") || "";
const OBS_CONFIG_DIR = `${HOME}/.config/obs-studio`;

/**
 * Install OBS Studio
 */
async function installOBS(): Promise<void> {
  logger.info("📦 Installing OBS Studio...");

  // Check if already installed
  if (await commandExists("obs")) {
    logger.info("✅ OBS Studio already installed");
    return;
  }

  // Add PPA for latest version
  await runCommand(["sudo", "add-apt-repository", "-y", "ppa:obsproject/obs-studio"]);
  await runCommand(["sudo", "apt", "update"]);

  // Install OBS and plugins
  const packages = [
    "obs-studio",
    "obs-plugins",
    "v4l2loopback-dkms",
  ];

  const result = await runCommand(["sudo", "apt", "install", "-y", ...packages]);

  if (result.success) {
    logger.info("✅ OBS Studio installed successfully");
  } else {
    throw new Error("Failed to install OBS Studio");
  }
}

/**
 * Create a screencast scene
 */
async function createScreencastScene(
  sceneName: string,
  _config: OBSConfig
): Promise<void> {
  logger.info(`🎬 Creating scene: ${sceneName}`);

  const sceneCollectionPath = `${OBS_CONFIG_DIR}/basic/scenes`;
  await ensureDir(sceneCollectionPath);

  // Create scene collection JSON
  const sceneCollection = {
    name: sceneName,
    current_scene: "Main Scene",
    sources: [
      {
        id: "xshm_input",
        name: "Screen Capture",
        settings: {
          capture_cursor: true,
        },
      },
    ],
    scenes: [
      {
        name: "Main Scene",
        sources: [
          {
            name: "Screen Capture",
            render: true,
          },
        ],
      },
    ],
  };

  await Deno.writeTextFile(
    `${sceneCollectionPath}/${sceneName}.json`,
    JSON.stringify(sceneCollection, null, 2)
  );

  logger.info(`✅ Scene ${sceneName} created`);
}

/**
 * Configure hotkeys
 */
async function configureHotkeys(config: OBSConfig): Promise<void> {
  logger.info("⌨️  Configuring hotkeys...");

  const hotkeyPath = `${OBS_CONFIG_DIR}/basic.json`;
  let basicConfig = {};

  // Load existing config if it exists
  try {
    const content = await Deno.readTextFile(hotkeyPath);
    basicConfig = JSON.parse(content);
  } catch {
    // File doesn't exist, create new
  }

  // Add hotkeys
  const hotkeys = {
    OBSBasic: {
      hotkeys: {
        "OBSBasic.StartRecording": [{ key: config.hotkeys.startRecording }],
        "OBSBasic.StopRecording": [{ key: config.hotkeys.stopRecording }],
        "OBSBasic.PauseRecording": [{ key: config.hotkeys.pauseRecording }],
        "OBSBasic.ToggleMute": [{ key: config.hotkeys.toggleMute }],
      },
    },
  };

  await Deno.writeTextFile(
    hotkeyPath,
    JSON.stringify({ ...basicConfig, ...hotkeys }, null, 2)
  );

  logger.info("✅ Hotkeys configured");
}

/**
 * Optimize for screencasting
 */
async function optimizeForScreencasting(
  config: OBSConfig
): Promise<void> {
  logger.info("⚙️  Optimizing for screencasting...");

  // Ensure output directory exists
  const outputPath = config.recordingSettings.outputPath.replace("~", HOME);
  await ensureDir(outputPath);

  // Set optimal encoder settings for screen recording
  const isHardwareAccelerated = config.videoSettings.encoder !== "obs_x264";

  if (isHardwareAccelerated) {
    logger.info("✅ Using hardware acceleration");
  } else {
    logger.info("ℹ️  Using software encoding (slower but compatible)");
  }

  // Create optimized profile
  await createOBSProfile("Screencasting", config);

  // Create main scene
  await createScreencastScene("Main", config);

  // Configure hotkeys
  await configureHotkeys(config);

  logger.info("✅ Optimization complete");
}

/**
 * Main configuration function
 */
export async function configureOBS(options?: {
  skipInstall?: boolean;
  interactive?: boolean;
}): Promise<void> {
  logger.info("🎥 Configuring OBS Studio for screencasting...\n");

  // Install OBS if needed
  if (!options?.skipInstall) {
    await installOBS();
  }

  // Detect best encoder
  const encoder = await detectBestEncoder();

  // Detect audio devices
  const audioDevices = await getAudioDevices();

  // Build configuration
  const config: OBSConfig = OBSConfigSchema.parse({
    videoSettings: {
      baseResolution: "1920x1080",
      outputResolution: "1920x1080",
      fps: 30,
      encoder,
      bitrate: 6000,
      keyframeInterval: 2,
      preset: encoder === "obs_x264" ? "veryfast" : "medium",
      profile: "high",
    },
    audioSettings: {
      sampleRate: "48000",
      channels: "stereo",
      micDevice: audioDevices.sources[0]?.id,
      desktopAudioDevice: audioDevices.sinks[0]?.id,
      micNoiseSupression: true,
      micNoiseGate: true,
      desktopAudioBitrate: 160,
      micBitrate: 160,
    },
    recordingSettings: {
      outputPath: "~/Videos/OBS",
      fileFormat: "mov",
      filenameFormat: "%CCYY-%MM-%DD %hh-%mm-%ss",
      encoder: "ffmpeg_nvenc",
      quality: "high",
      crf: 16,
    },
    hotkeys: {
      startRecording: "Super_L+Ctrl_L+R",
      stopRecording: "Super_L+Ctrl_L+S",
      pauseRecording: "Super_L+Ctrl_L+P",
      toggleMute: "Super_L+M",
    },
    features: {
      replayBuffer: false,
      autosave: true,
      autostart: false,
    },
  });

  // Apply optimizations
  await optimizeForScreencasting(config);

  logger.info("\n✅ OBS Studio configuration complete!");
  logger.info("\nNext steps:");
  logger.info("1. Launch OBS Studio");
  logger.info("2. Select 'Screencasting' profile");
  logger.info("3. Review and adjust settings as needed");
  logger.info(`4. Recordings will be saved to: ${config.recordingSettings.outputPath}`);
}

// CLI entry point
async function main(): Promise<void> {
  const args = parseArgs(Deno.args, {
    boolean: ["skip-install", "interactive", "help"],
    alias: { h: "help", i: "interactive" },
  });

  if (args.help) {
    console.log(`
OBS Studio Configuration Tool

Usage:
  configure-obs.ts [OPTIONS]

Options:
  --skip-install      Skip OBS installation
  --interactive, -i   Interactive configuration
  -h, --help          Show this help message

Examples:
  # Full configuration with installation
  configure-obs.ts

  # Configure only (skip installation)
  configure-obs.ts --skip-install

  # Interactive mode
  configure-obs.ts --interactive
    `);
    Deno.exit(0);
  }

  await configureOBS({
    skipInstall: args["skip-install"],
    interactive: args.interactive,
  });
}

if (import.meta.main) {
  await main();
}

export {
  checkNvidiaSupport,
  checkVaapiSupport,
  configureHotkeys,
  createOBSProfile,
  createScreencastScene,
  detectBestEncoder,
  getAudioDevices,
  installOBS,
  optimizeForScreencasting,
};
