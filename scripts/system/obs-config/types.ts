/**
 * OBS configuration types and schemas
 */

import { z } from "../../../deps.ts";

export const OBSConfigSchema = z.object({
  videoSettings: z.object({
    baseResolution: z.string().default("1920x1080"),
    outputResolution: z.string().default("1920x1080"),
    fps: z.number().int().min(1).max(120).default(30),
    encoder: z.enum(["obs_x264", "ffmpeg_nvenc", "ffmpeg_vaapi", "ffmpeg_qsv"])
      .default("obs_x264"),
    bitrate: z.number().int().min(1000).max(50000).default(6000),
    keyframeInterval: z.number().int().min(0).max(10).default(2),
    preset: z.enum([
      "ultrafast",
      "superfast",
      "veryfast",
      "faster",
      "fast",
      "medium",
      "slow",
      "slower",
      "veryslow",
    ]).default("medium"),
    profile: z.enum(["baseline", "main", "high"]).default("high"),
  }),
  audioSettings: z.object({
    sampleRate: z.enum(["44100", "48000"]).default("48000"),
    channels: z.enum(["mono", "stereo"]).default("stereo"),
    desktopAudioDevice: z.string().optional(),
    micDevice: z.string().optional(),
    micNoiseSupression: z.boolean().default(true),
    micNoiseGate: z.boolean().default(true),
    desktopAudioBitrate: z.number().int().min(64).max(320).default(160),
    micBitrate: z.number().int().min(64).max(320).default(160),
  }),
  recordingSettings: z.object({
    outputPath: z.string().default("~/Videos/OBS"),
    fileFormat: z.enum(["mkv", "mp4", "mov", "flv"]).default("mov"),
    filenameFormat: z.string().default("%CCYY-%MM-%DD %hh-%mm-%ss"),
    encoder: z.enum(["same_as_stream", "obs_x264", "ffmpeg_nvenc"]).default(
      "ffmpeg_nvenc"
    ),
    quality: z.enum(["lossless", "high", "medium", "low"]).default("high"),
    crf: z.number().int().min(0).max(51).default(16),
  }),
  hotkeys: z.object({
    startRecording: z.string().default("Super_L+Ctrl_L+R"),
    stopRecording: z.string().default("Super_L+Ctrl_L+S"),
    pauseRecording: z.string().default("Super_L+Ctrl_L+P"),
    toggleMute: z.string().default("Super_L+M"),
  }),
  features: z.object({
    replayBuffer: z.boolean().default(false),
    autosave: z.boolean().default(true),
    autostart: z.boolean().default(false),
  }),
});

export type OBSConfig = z.infer<typeof OBSConfigSchema>;
