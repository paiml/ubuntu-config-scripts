#!/usr/bin/env python3
"""
DaVinci Resolve Audio Control
Python API interface for audio diagnostics and control
"""

import sys
import json

def get_resolve():
    """Connect to DaVinci Resolve"""
    try:
        import DaVinciResolveScript as dvr
        resolve = dvr.scriptapp("Resolve")
        if resolve is None:
            print("Error: Could not connect to DaVinci Resolve")
            print("Make sure DaVinci Resolve is running and scripting is enabled")
            sys.exit(1)
        return resolve
    except ImportError as e:
        print(f"Error importing DaVinci Resolve Script: {e}")
        print("Check PYTHONPATH and RESOLVE_SCRIPT_LIB environment variables")
        sys.exit(1)

def get_project_and_timeline(resolve):
    """Get current project and timeline"""
    pm = resolve.GetProjectManager()
    if pm is None:
        print("Error: Could not get Project Manager")
        sys.exit(1)

    project = pm.GetCurrentProject()
    if project is None:
        print("Error: No project open")
        sys.exit(1)

    timeline = project.GetCurrentTimeline()
    return project, timeline

def cmd_status(resolve):
    """Show overall audio status"""
    project, timeline = get_project_and_timeline(resolve)

    print("=" * 60)
    print("DAVINCI RESOLVE AUDIO STATUS")
    print("=" * 60)

    # Project info
    print(f"\nProject: {project.GetName()}")

    # Get audio-related project settings
    settings_to_check = [
        "timelineFrameRate",
        "audioCaptureNumChannels",
        "audioPlayoutNumChannels",
    ]

    print("\nProject Settings:")
    all_settings = project.GetSetting("")
    if all_settings:
        for key, value in sorted(all_settings.items()):
            if "audio" in key.lower() or "sample" in key.lower():
                print(f"  {key}: {value}")

    # Timeline info
    if timeline:
        print(f"\nTimeline: {timeline.GetName()}")
        audio_track_count = timeline.GetTrackCount("audio")
        print(f"Audio Tracks: {audio_track_count}")

        # Timeline settings
        tl_settings = timeline.GetSetting("")
        if tl_settings:
            print("\nTimeline Audio Settings:")
            for key, value in sorted(tl_settings.items()):
                if "audio" in key.lower() or "sample" in key.lower():
                    print(f"  {key}: {value}")

        # Check each track
        print("\nAudio Track Status:")
        for i in range(1, audio_track_count + 1):
            enabled = timeline.GetIsTrackEnabled("audio", i)
            locked = timeline.GetIsTrackLocked("audio", i)
            name = timeline.GetTrackName("audio", i)
            subtype = timeline.GetTrackSubType("audio", i)
            status = "ENABLED" if enabled else "DISABLED"
            lock_status = " [LOCKED]" if locked else ""
            print(f"  Track {i}: {name} ({subtype}) - {status}{lock_status}")
    else:
        print("\nNo timeline selected")

    print("=" * 60)

def cmd_tracks(resolve):
    """List all audio tracks with details"""
    project, timeline = get_project_and_timeline(resolve)

    if not timeline:
        print("No timeline selected")
        return

    print(f"Audio Tracks in '{timeline.GetName()}':")
    print("-" * 50)

    audio_track_count = timeline.GetTrackCount("audio")

    for i in range(1, audio_track_count + 1):
        enabled = timeline.GetIsTrackEnabled("audio", i)
        locked = timeline.GetIsTrackLocked("audio", i)
        name = timeline.GetTrackName("audio", i)
        subtype = timeline.GetTrackSubType("audio", i)

        # Get items on track
        items = timeline.GetItemListInTrack("audio", i)
        item_count = len(items) if items else 0

        status_icon = "+" if enabled else "-"
        lock_icon = "L" if locked else " "

        print(f"[{status_icon}][{lock_icon}] Track {i}: {name}")
        print(f"      Type: {subtype}, Clips: {item_count}")

        # Show clip details
        if items:
            for item in items[:3]:  # Show first 3 clips
                clip_name = item.GetName()
                print(f"      - {clip_name}")
            if len(items) > 3:
                print(f"      ... and {len(items) - 3} more")
        print()

def cmd_project(resolve):
    """Show project audio settings"""
    project, _ = get_project_and_timeline(resolve)

    print(f"Project Audio Settings: {project.GetName()}")
    print("=" * 50)

    all_settings = project.GetSetting("")
    if all_settings:
        audio_settings = {k: v for k, v in sorted(all_settings.items())
                         if "audio" in k.lower() or "sample" in k.lower()}

        if audio_settings:
            for key, value in audio_settings.items():
                print(f"  {key}: {value}")
        else:
            print("  No audio-specific settings found in project")
            print("\n  All settings containing numbers (may include audio):")
            for key, value in sorted(all_settings.items()):
                if isinstance(value, (int, float)) and value > 0:
                    print(f"    {key}: {value}")

    # Fairlight presets
    fairlight_presets = resolve.GetFairlightPresets()
    if fairlight_presets:
        print(f"\nFairlight Presets ({len(fairlight_presets)}):")
        for preset in fairlight_presets[:10]:
            print(f"  - {preset}")
        if len(fairlight_presets) > 10:
            print(f"  ... and {len(fairlight_presets) - 10} more")

def cmd_clip(resolve):
    """Show current clip audio info"""
    project, timeline = get_project_and_timeline(resolve)

    if not timeline:
        print("No timeline selected")
        return

    current_item = timeline.GetCurrentVideoItem()
    if not current_item:
        print("No clip selected")
        return

    print(f"Current Clip: {current_item.GetName()}")
    print("=" * 50)

    # Get media pool item
    mp_item = current_item.GetMediaPoolItem()
    if mp_item:
        # Get audio mapping
        audio_mapping = mp_item.GetAudioMapping()
        if audio_mapping:
            print("\nAudio Mapping:")
            try:
                mapping_data = json.loads(audio_mapping)
                print(json.dumps(mapping_data, indent=2))
            except:
                print(f"  {audio_mapping}")

        # Get clip properties
        props = mp_item.GetClipProperty("")
        if props:
            print("\nClip Audio Properties:")
            for key, value in sorted(props.items()):
                if "audio" in key.lower() or "sample" in key.lower() or "channel" in key.lower():
                    print(f"  {key}: {value}")

    # Source audio channel mapping from timeline item
    source_mapping = current_item.GetSourceAudioChannelMapping()
    if source_mapping:
        print("\nSource Audio Channel Mapping:")
        try:
            mapping_data = json.loads(source_mapping)
            print(json.dumps(mapping_data, indent=2))
        except:
            print(f"  {source_mapping}")

def cmd_enable(resolve, track_index):
    """Enable an audio track"""
    _, timeline = get_project_and_timeline(resolve)

    if not timeline:
        print("No timeline selected")
        return

    try:
        idx = int(track_index)
    except ValueError:
        print(f"Invalid track index: {track_index}")
        return

    audio_track_count = timeline.GetTrackCount("audio")
    if idx < 1 or idx > audio_track_count:
        print(f"Track index out of range (1-{audio_track_count})")
        return

    result = timeline.SetTrackEnable("audio", idx, True)
    if result:
        name = timeline.GetTrackName("audio", idx)
        print(f"Enabled audio track {idx}: {name}")
    else:
        print(f"Failed to enable track {idx}")

def cmd_disable(resolve, track_index):
    """Disable an audio track"""
    _, timeline = get_project_and_timeline(resolve)

    if not timeline:
        print("No timeline selected")
        return

    try:
        idx = int(track_index)
    except ValueError:
        print(f"Invalid track index: {track_index}")
        return

    audio_track_count = timeline.GetTrackCount("audio")
    if idx < 1 or idx > audio_track_count:
        print(f"Track index out of range (1-{audio_track_count})")
        return

    result = timeline.SetTrackEnable("audio", idx, False)
    if result:
        name = timeline.GetTrackName("audio", idx)
        print(f"Disabled audio track {idx}: {name}")
    else:
        print(f"Failed to disable track {idx}")

def cmd_fairlight(resolve):
    """List Fairlight presets"""
    presets = resolve.GetFairlightPresets()

    print("Fairlight Presets:")
    print("-" * 40)

    if presets:
        for i, preset in enumerate(presets, 1):
            print(f"  {i}. {preset}")
    else:
        print("  No Fairlight presets found")

def main():
    if len(sys.argv) < 2:
        print("Usage: davinci-audio.py <command> [args]")
        sys.exit(1)

    cmd = sys.argv[1]
    resolve = get_resolve()

    if cmd == "status":
        cmd_status(resolve)
    elif cmd == "tracks":
        cmd_tracks(resolve)
    elif cmd == "project":
        cmd_project(resolve)
    elif cmd == "clip":
        cmd_clip(resolve)
    elif cmd == "fairlight":
        cmd_fairlight(resolve)
    elif cmd == "enable":
        if len(sys.argv) < 3:
            print("Usage: davinci-audio.py enable <track_index>")
            sys.exit(1)
        cmd_enable(resolve, sys.argv[2])
    elif cmd == "disable":
        if len(sys.argv) < 3:
            print("Usage: davinci-audio.py disable <track_index>")
            sys.exit(1)
        cmd_disable(resolve, sys.argv[2])
    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)

if __name__ == "__main__":
    main()
