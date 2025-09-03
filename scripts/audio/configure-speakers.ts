#!/usr/bin/env -S deno run --allow-all

import { logger } from "../lib/logger.ts";
import {
  commandExists,
  confirm,
  parseArgs,
  runCommand,
} from "../lib/common.ts";
import { z } from "../../deps.ts";

const SpeakerDeviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  card: z.string(),
  device: z.string(),
  isMuted: z.boolean(),
  volume: z.number().min(0).max(100),
  isDefault: z.boolean(),
  profileName: z.string().optional(),
});

type SpeakerDevice = z.infer<typeof SpeakerDeviceSchema>;

const AudioProfileSchema = z.object({
  name: z.string(),
  description: z.string(),
  available: z.boolean(),
  active: z.boolean(),
});

type AudioProfile = z.infer<typeof AudioProfileSchema>;

export async function getPulseAudioSinks(): Promise<SpeakerDevice[]> {
  const devices: SpeakerDevice[] = [];

  const sinksResult = await runCommand(["pactl", "list", "sinks"]);
  if (!sinksResult.success) {
    throw new Error(`Failed to list audio sinks: ${sinksResult.stderr}`);
  }

  const defaultSinkResult = await runCommand(["pactl", "get-default-sink"]);
  const defaultSink = defaultSinkResult.success
    ? defaultSinkResult.stdout.trim()
    : "";

  const sinks = sinksResult.stdout.split("\n\n");

  for (const sink of sinks) {
    if (!sink.includes("Sink #")) continue;

    const idMatch = sink.match(/Sink #(\d+)/);
    const nameMatch = sink.match(/Name: (.+)/);
    const descMatch = sink.match(/Description: (.+)/);
    const muteMatch = sink.match(/Mute: (.+)/);
    const volumeMatch = sink.match(/Volume:.*?(\d+)%/);
    const cardMatch = sink.match(/alsa\.card = "(\d+)"/);
    const deviceMatch = sink.match(/alsa\.device = "(\d+)"/);
    const profileMatch = sink.match(/device\.profile\.name = "(.+)"/);

    if (idMatch && nameMatch) {
      const sinkName = nameMatch[1]!;
      devices.push({
        id: idMatch[1]!,
        name: descMatch?.[1] || sinkName,
        card: cardMatch?.[1] || "unknown",
        device: deviceMatch?.[1] || "unknown",
        isMuted: muteMatch?.[1] === "yes",
        volume: parseInt(volumeMatch?.[1] || "0"),
        isDefault: sinkName === defaultSink,
        profileName: profileMatch?.[1],
      });
    }
  }

  return devices;
}

export async function getCardProfiles(cardId: string): Promise<AudioProfile[]> {
  const profiles: AudioProfile[] = [];

  const result = await runCommand(["pactl", "list", "cards"]);
  if (!result.success) {
    return profiles;
  }

  const cards = result.stdout.split("\n\n");
  for (const card of cards) {
    if (!card.includes(`Card #${cardId}`)) continue;

    const profileSection = card.match(/Profiles:\n([\s\S]*?)(?:\n\t[A-Z]|$)/);
    if (!profileSection) continue;

    const profileLines = profileSection[1]!.split("\n");
    for (const line of profileLines) {
      const profileMatch = line.match(
        /\t\t(.+?):\s+(.+?)\s+\(.*?priority[^)]*\)(\s+\(available:[^)]+\))?/,
      );
      if (profileMatch) {
        const isAvailable = line.includes("available: yes") ||
          line.includes("available: unknown");
        profiles.push({
          name: profileMatch[1]!.trim(),
          description: profileMatch[2]!.trim(),
          available: isAvailable,
          active: false,
        });
      }
    }

    const activeProfileMatch = card.match(/Active Profile: (.+)/);
    if (activeProfileMatch) {
      const activeProfile = profiles.find((p) =>
        p.name === activeProfileMatch[1]!.trim()
      );
      if (activeProfile) {
        activeProfile.active = true;
      }
    }

    break;
  }

  return profiles;
}

export async function setCardProfile(
  cardId: string,
  profileName: string,
): Promise<void> {
  const result = await runCommand([
    "pactl",
    "set-card-profile",
    cardId,
    profileName,
  ]);

  if (!result.success) {
    throw new Error(`Failed to set card profile: ${result.stderr}`);
  }
}

export async function testSpeakers(_device: SpeakerDevice): Promise<boolean> {
  logger.info("Testing speakers with audio test signal...");

  const testCommands = [
    ["speaker-test", "-t", "sine", "-f", "440", "-l", "1", "-P", "2"],
    ["speaker-test", "-t", "wav", "-c", "2", "-l", "1"],
  ];

  for (const cmd of testCommands) {
    const result = await runCommand(cmd);
    if (result.success) {
      logger.success("Speaker test completed");
      return true;
    }
  }

  const pacmdExists = await commandExists("paplay");
  if (pacmdExists) {
    const wavFiles = [
      "/usr/share/sounds/freedesktop/stereo/audio-volume-change.oga",
      "/usr/share/sounds/freedesktop/stereo/bell.oga",
      "/usr/share/sounds/ubuntu/stereo/desktop-login.ogg",
    ];

    for (const file of wavFiles) {
      try {
        const fileInfo = await Deno.stat(file);
        if (fileInfo.isFile) {
          logger.info(`Playing test sound: ${file}`);
          const result = await runCommand(["paplay", file]);
          if (result.success) {
            logger.success("Test sound played successfully");
            return true;
          }
        }
      } catch {
        // File doesn't exist, try next
      }
    }
  }

  logger.warn("Could not play test sound. Please test speakers manually.");
  return false;
}

export async function configureSpeakers(
  deviceId?: string,
  options?: {
    volume?: number;
    testAudio?: boolean;
    profile?: string;
  },
): Promise<void> {
  const usePulseAudio = await commandExists("pactl");

  if (!usePulseAudio) {
    throw new Error(
      "PulseAudio not found. Please install pulseaudio-utils",
    );
  }

  logger.info("Detecting external speakers...");

  const devices = await getPulseAudioSinks();

  if (devices.length === 0) {
    throw new Error("No audio output devices found");
  }

  let selectedDevice: SpeakerDevice;

  if (deviceId) {
    const found = devices.find((d) =>
      d.id === deviceId ||
      d.name.toLowerCase().includes(deviceId.toLowerCase()) ||
      d.card === deviceId
    );

    if (!found) {
      logger.error(`Device '${deviceId}' not found. Available devices:`);
      devices.forEach((d) => {
        const defaultMarker = d.isDefault ? " [DEFAULT]" : "";
        logger.info(
          `  ${d.id}: ${d.name} (Card: ${d.card})${defaultMarker}`,
        );
      });
      throw new Error(`Device '${deviceId}' not found`);
    }

    selectedDevice = found;
  } else {
    const externalDevices = devices.filter((d) =>
      d.name.toLowerCase().includes("usb") ||
      d.name.toLowerCase().includes("hdmi") ||
      d.name.toLowerCase().includes("displayport") ||
      d.name.toLowerCase().includes("bluetooth") ||
      d.name.toLowerCase().includes("external") ||
      (d.name.toLowerCase().includes("audio") &&
        !d.name.toLowerCase().includes("built-in") &&
        !d.name.toLowerCase().includes("internal"))
    );

    if (externalDevices.length > 0) {
      logger.info("External speakers detected:");
      externalDevices.forEach((d, i) => {
        const status = d.isMuted ? "🔇 MUTED" : `🔊 ${d.volume}%`;
        const defaultMarker = d.isDefault ? " [CURRENT DEFAULT]" : "";
        logger.info(`  ${i + 1}. ${d.name} ${status}${defaultMarker}`);
        logger.info(`     ID: ${d.id}, Card: ${d.card}`);
      });

      if (externalDevices.length === 1) {
        selectedDevice = externalDevices[0]!;
        logger.info(`Selecting: ${selectedDevice.name}`);
      } else {
        const defaultExternal = externalDevices[0];
        if (!defaultExternal) {
          throw new Error("No external devices available");
        }
        if (
          !await confirm(
            `Use "${defaultExternal.name}"?`,
            true,
          )
        ) {
          throw new Error("No device selected");
        }
        selectedDevice = defaultExternal;
      }
    } else {
      logger.warn("No external speakers detected. Showing all output devices:");
      devices.forEach((d, i) => {
        const status = d.isMuted ? "🔇 MUTED" : `🔊 ${d.volume}%`;
        const defaultMarker = d.isDefault ? " [DEFAULT]" : "";
        logger.info(`  ${i + 1}. ${d.name} ${status}${defaultMarker}`);
      });

      const defaultDevice = devices.find((d) => d.isDefault) || devices[0];
      if (!defaultDevice) {
        throw new Error("No devices available");
      }

      if (!await confirm(`Use "${defaultDevice.name}"?`, true)) {
        throw new Error("No device selected");
      }
      selectedDevice = defaultDevice;
    }
  }

  logger.info(`Configuring speakers: ${selectedDevice.name}`);

  if (options?.profile && selectedDevice.card !== "unknown") {
    logger.info(`Setting audio profile: ${options.profile}`);
    try {
      await setCardProfile(selectedDevice.card, options.profile);
      logger.success(`Profile set to: ${options.profile}`);
    } catch (error) {
      logger.warn(`Failed to set profile: ${error}`);
    }
  } else if (selectedDevice.card !== "unknown" && !options?.profile) {
    const profiles = await getCardProfiles(selectedDevice.card);
    const outputProfiles = profiles.filter((p) =>
      p.available &&
      (p.name.includes("output") ||
        p.name.includes("stereo") ||
        p.name.includes("surround") ||
        p.name.includes("hdmi") ||
        p.name.includes("analog"))
    );

    if (outputProfiles.length > 0) {
      logger.info("Available audio profiles:");
      outputProfiles.forEach((p) => {
        const activeMarker = p.active ? " [ACTIVE]" : "";
        logger.info(`  - ${p.name}: ${p.description}${activeMarker}`);
      });

      const stereoProfile = outputProfiles.find((p) =>
        p.name.includes("stereo") && !p.name.includes("input")
      );
      if (stereoProfile && !stereoProfile.active) {
        if (
          await confirm(
            `Switch to stereo output profile?`,
            true,
          )
        ) {
          try {
            await setCardProfile(selectedDevice.card, stereoProfile.name);
            logger.success("Switched to stereo output profile");
          } catch (error) {
            logger.warn(`Failed to set profile: ${error}`);
          }
        }
      }
    }
  }

  const unmuteResult = await runCommand([
    "pactl",
    "set-sink-mute",
    selectedDevice.id,
    "0",
  ]);

  if (!unmuteResult.success) {
    logger.warn(`Failed to unmute device: ${unmuteResult.stderr}`);
  }

  const targetVolume = options?.volume ?? 70;
  logger.info(`Setting speaker volume to ${targetVolume}%`);
  const volumeResult = await runCommand([
    "pactl",
    "set-sink-volume",
    selectedDevice.id,
    `${targetVolume}%`,
  ]);

  if (!volumeResult.success) {
    logger.warn(`Failed to set volume: ${volumeResult.stderr}`);
  }

  if (!selectedDevice.isDefault) {
    logger.info("Setting as default audio output device");
    const setDefaultResult = await runCommand([
      "pactl",
      "set-default-sink",
      selectedDevice.id,
    ]);

    if (!setDefaultResult.success) {
      logger.warn(
        `Failed to set as default sink: ${setDefaultResult.stderr}`,
      );
    }
  }

  const moveStreamsResult = await runCommand([
    "bash",
    "-c",
    `pactl list short sink-inputs | cut -f1 | xargs -I {} pactl move-sink-input {} ${selectedDevice.id}`,
  ]);

  if (moveStreamsResult.success) {
    logger.info("Moved all audio streams to the selected device");
  }

  logger.success(`Speakers configured successfully: ${selectedDevice.name}`);

  if (options?.testAudio !== false) {
    if (
      await confirm("Would you like to test the speakers?", true)
    ) {
      await testSpeakers(selectedDevice);
    }
  }
}

export async function listAudioDevices(): Promise<void> {
  const devices = await getPulseAudioSinks();

  logger.info("Available audio output devices:");
  logger.info("");

  for (const device of devices) {
    const status = device.isMuted ? "🔇 MUTED" : `🔊 ${device.volume}%`;
    const defaultMarker = device.isDefault ? " ⭐ DEFAULT" : "";
    const typeHint = device.name.toLowerCase().includes("hdmi")
      ? " [HDMI]"
      : device.name.toLowerCase().includes("usb")
      ? " [USB]"
      : device.name.toLowerCase().includes("bluetooth")
      ? " [Bluetooth]"
      : device.name.toLowerCase().includes("built-in")
      ? " [Built-in]"
      : "";

    logger.info(`${device.name}${typeHint}${defaultMarker}`);
    logger.info(`  Status: ${status}`);
    logger.info(`  ID: ${device.id}, Card: ${device.card}`);
    if (device.profileName) {
      logger.info(`  Profile: ${device.profileName}`);
    }
    logger.info("");
  }
}

async function main(): Promise<void> {
  const args = parseArgs(Deno.args);

  if (args["help"] || args["h"]) {
    console.log(`
Usage: configure-speakers.ts [OPTIONS]

Configure and test external speakers on Ubuntu system using PulseAudio.

Options:
  --device <id|name>  Specify device ID, name, or card number
  --volume <0-100>    Set volume level (default: 70)
  --profile <name>    Set specific audio profile
  --list              List all available audio devices
  --no-test           Skip audio test
  --help, -h          Show this help message
  --verbose, -v       Enable verbose logging

Examples:
  configure-speakers.ts                    # Auto-detect and configure external speakers
  configure-speakers.ts --list             # List all audio devices
  configure-speakers.ts --device hdmi      # Use HDMI audio output
  configure-speakers.ts --volume 50        # Set volume to 50%
  configure-speakers.ts --profile stereo   # Use stereo output profile
`);
    Deno.exit(0);
  }

  if (args["verbose"] || args["v"]) {
    logger.setLevel(0);
  }

  try {
    if (args["list"]) {
      await listAudioDevices();
    } else {
      const options: {
        volume?: number;
        testAudio?: boolean;
        profile?: string;
      } = {
        testAudio: !args["no-test"],
      };
      if (args["volume"]) {
        options.volume = parseInt(args["volume"] as string);
      }
      if (args["profile"]) {
        options.profile = args["profile"] as string;
      }
      await configureSpeakers(args["device"] as string | undefined, options);
    }
  } catch (error) {
    logger.error(`Failed to configure speakers: ${error}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
