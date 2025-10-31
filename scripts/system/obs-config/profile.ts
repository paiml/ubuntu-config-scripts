/**
 * OBS profile configuration
 */

import { logger } from "../../lib/logger.ts";
import { ensureDir } from "../../lib/common.ts";
import type { OBSConfig } from "./types.ts";

const HOME = Deno.env.get("HOME") || "";
const OBS_CONFIG_DIR = `${HOME}/.config/obs-studio`;

export async function createOBSProfile(
  profileName: string,
  config: OBSConfig,
): Promise<void> {
  logger.info(`📝 Creating OBS profile: ${profileName}`);

  const profilePath = `${OBS_CONFIG_DIR}/basic/profiles/${profileName}`;
  await ensureDir(profilePath);

  // Create basic.ini
  const basicConfig = generateBasicConfig(config);
  await Deno.writeTextFile(`${profilePath}/basic.ini`, basicConfig);

  // Create streamEncoder.json
  const streamEncoder = generateStreamEncoderConfig(config);
  await Deno.writeTextFile(
    `${profilePath}/streamEncoder.json`,
    JSON.stringify(streamEncoder, null, 2),
  );

  // Create recordEncoder.json
  const recordEncoder = generateRecordEncoderConfig(config);
  await Deno.writeTextFile(
    `${profilePath}/recordEncoder.json`,
    JSON.stringify(recordEncoder, null, 2),
  );

  logger.info(`✅ Profile ${profileName} created`);
}

function generateBasicConfig(config: OBSConfig): string {
  const video = config.videoSettings;
  const audio = config.audioSettings;
  const recording = config.recordingSettings;

  return `[Video]
BaseCX=${video.baseResolution.split("x")[0]}
BaseCY=${video.baseResolution.split("x")[1]}
OutputCX=${video.outputResolution.split("x")[0]}
OutputCY=${video.outputResolution.split("x")[1]}
FPSType=0
FPSCommon=${video.fps}

[Output]
Mode=Advanced
RecFilePath=${recording.outputPath}
RecFormat=${recording.fileFormat}
RecEncoder=${recording.encoder}

[Audio]
SampleRate=${audio.sampleRate}
ChannelSetup=${audio.channels}
`;
}

function generateStreamEncoderConfig(
  config: OBSConfig,
): Record<string, unknown> {
  const video = config.videoSettings;

  return {
    type: video.encoder,
    settings: {
      bitrate: video.bitrate,
      keyint_sec: video.keyframeInterval,
      preset: video.preset,
      profile: video.profile,
      rate_control: "CBR",
    },
  };
}

function generateRecordEncoderConfig(
  config: OBSConfig,
): Record<string, unknown> {
  const recording = config.recordingSettings;

  return {
    type: recording.encoder === "same_as_stream"
      ? config.videoSettings.encoder
      : recording.encoder,
    settings: {
      crf: recording.crf,
      preset: config.videoSettings.preset,
      profile: config.videoSettings.profile,
    },
  };
}
