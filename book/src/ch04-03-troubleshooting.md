# Audio Troubleshooting

This chapter covers common audio issues on Ubuntu systems, with special focus on DaVinci Resolve and OBS Studio workflows.

## DaVinci Resolve Audio Issues on Linux

### The Problem: No Audio Playback

**Symptom**: Video plays in DaVinci Resolve but audio is completely silent, even though the audio waveform is visible on the timeline.

**Root Cause**: DaVinci Resolve on Linux **cannot decode AAC audio**. This is a codec limitation in the Linux version.

**Log Evidence**:
```
IO.Audio | ERROR | Failed to decode clip <file.mp4> - Failed to decode the audio samples
```

This error repeats continuously while playing back AAC-encoded media.

### The Solution: Use PCM Audio

DaVinci Resolve on Linux requires uncompressed PCM audio. Compatible codecs:

| Codec | Description | Recommended |
|-------|-------------|-------------|
| pcm_s24le | PCM 24-bit signed little-endian | **Yes** |
| pcm_s16le | PCM 16-bit signed little-endian | Yes |
| pcm_s32le | PCM 32-bit signed little-endian | Yes |
| flac | Free Lossless Audio Codec | Yes |
| aac | Advanced Audio Coding | **NO** |
| mp3 | MPEG Audio Layer 3 | **NO** |
| opus | Opus codec | **NO** |

### Converting Existing Files

Use ffmpeg to convert AAC audio to PCM:

```bash
# Basic conversion (keeps video, converts audio to PCM)
ffmpeg -i input.mp4 -c:v copy -c:a pcm_s24le output.mov

# Convert stereo to mono (if one channel is empty)
ffmpeg -i input.mp4 -c:v copy -ac 1 -c:a pcm_s24le output-mono.mov

# Batch convert all MP4 files in current directory
for f in *.mp4; do
  ffmpeg -i "$f" -c:v copy -c:a pcm_s24le "${f%.mp4}-pcm.mov" -y
done
```

### Using the Workflow Tool

The `examples/davinci-obs-workflow.ts` script automates diagnosis and conversion:

```bash
# Check if a file is DaVinci-compatible
./examples/davinci-obs-workflow.ts --diagnose recording.mp4

# Convert a single file
./examples/davinci-obs-workflow.ts --convert recording.mp4

# Convert to mono
./examples/davinci-obs-workflow.ts --convert recording.mp4 --mono

# Batch convert entire folder
./examples/davinci-obs-workflow.ts --batch ~/Videos/OBS

# Show OBS configuration guide
./examples/davinci-obs-workflow.ts --guide
```

## OBS Studio Configuration for DaVinci

### Required Settings

**Critical**: You must use **Advanced Output Mode** to access PCM audio encoding.

1. **Settings → Output**
   - Output Mode: **Advanced**

2. **Recording Tab**
   - Recording Format: **QuickTime (.mov)**
   - Video Encoder: **NVIDIA NVENC H.264 (FFmpeg)**
   - Audio Encoder: **FFmpeg PCM (24-bit)**
   - Rate Control: **CBR**

### Why Simple Mode Doesn't Work

OBS Simple output mode only offers AAC for MOV containers. Since DaVinci on Linux cannot decode AAC, you **must** use Advanced mode to select PCM audio.

### Video Codec Considerations

| Codec | DaVinci Free | DaVinci Studio | Recommendation |
|-------|--------------|----------------|----------------|
| H.264 | ✓ Full support | ✓ Full support | **Use this** |
| HEVC/H.265 | ⚠️ Limited | ✓ Full support | Only with Studio |

Stick with **H.264** for maximum compatibility with DaVinci Resolve Free.

## DaVinci Cloud Storage Issues

### Symptom: Upload Errors

```
BMDBackup | ERROR | Sync operation failed: NotEnoughSpace: volume full
```

### Solution: Disable Media Sync

1. File → Project Settings → **Blackmagic Cloud**
2. Under "Blackmagic Cloud Storage Syncing"
3. Select **"Don't sync media"**

This ensures only project data (edit lists, timelines) sync to the cloud, not large media files or proxies.

## DaVinci Audio Diagnostics

### Using the davinci-audio.sh Tool

The `scripts/system/davinci-audio.sh` script provides real-time diagnostics via DaVinci's Python API:

```bash
# Show overall audio status
./scripts/system/davinci-audio.sh status

# List all audio tracks with details
./scripts/system/davinci-audio.sh tracks

# Show project audio settings
./scripts/system/davinci-audio.sh project

# Show current clip audio info
./scripts/system/davinci-audio.sh clip

# Enable/disable audio track
./scripts/system/davinci-audio.sh enable 1
./scripts/system/davinci-audio.sh disable 1
```

**Note**: DaVinci Resolve must be running for the API to work.

### Interpreting the Output

```
Project: MyProject
Timeline: Timeline 1
Audio Tracks: 1

Audio Track Status:
  Track 1: Audio 1 (stereo) - ENABLED

Clip: recording.mp4
├── Audio Codec: AAC        ← PROBLEM!
├── Sample Rate: 48000
├── Channels: 2 (stereo)
└── Mute: false
```

If the audio codec shows "AAC", that's why audio isn't playing.

## PipeWire/PulseAudio Issues

### Audio Stops Working After Reboot

**Symptom**: Audio sinks show "(null)" status, "Broken pipe" errors in logs.

**Quick Fix**:
```bash
systemctl --user restart pipewire pipewire-pulse
```

**Permanent Fix**: Install the PipeWire monitor service:
```bash
make system-pipewire-monitor
```

This creates a systemd service that monitors for audio errors and automatically restarts PipeWire when needed.

### No Audio Devices Detected

Check PipeWire status:
```bash
# List audio sinks
pactl list sinks short

# Check default sink
pactl info | grep "Default Sink"

# Check PipeWire service
systemctl --user status pipewire
```

## Common Pitfalls

1. **Recording in Simple Mode**: Always use Advanced output mode in OBS for PCM audio
2. **Using HEVC with Free Version**: DaVinci Resolve Free has limited HEVC support
3. **AAC in MKV/MP4**: These containers default to AAC which DaVinci can't decode
4. **Cloud Sync Enabled**: Large proxy files can fill up Blackmagic Cloud storage
5. **Wrong Audio Output Device**: DaVinci may default to a non-existent device

## Quick Reference

### File Compatibility Check
```bash
ffprobe -v error -select_streams a:0 -show_entries stream=codec_name input.mp4
```

### Convert to DaVinci-Compatible Format
```bash
ffmpeg -i input.mp4 -c:v copy -c:a pcm_s24le output.mov
```

### OBS Recording Settings
- Format: MOV
- Video: H.264 (NVENC)
- Audio: PCM (24-bit)
- Mode: Advanced

---

*Part of the Ubuntu Config Scripts Ruchy Migration Guide*
