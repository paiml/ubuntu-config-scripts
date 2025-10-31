// RUC-001: Audio Speaker Configuration Module - GREEN Phase
//
// Minimal implementation to make property tests pass
// Strategy: Use pactl commands to interact with PulseAudio/PipeWire

use std::process::Command;

// ============================================================================
// Data Types (Contract from RED phase)
// ============================================================================

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AudioDevice {
    pub id: String,
    pub name: String,
    pub description: String,
    pub is_default: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpeakerConfig {
    pub device_id: String,
    pub volume: i32,
    pub muted: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConfigError {
    DeviceNotFound(String),
    CommandFailed(String),
    InvalidState(String),
    PermissionDenied,
}

impl std::fmt::Display for ConfigError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ConfigError::DeviceNotFound(id) => write!(f, "Device not found: {}", id),
            ConfigError::CommandFailed(msg) => write!(f, "Command failed: {}", msg),
            ConfigError::InvalidState(msg) => write!(f, "Invalid state: {}", msg),
            ConfigError::PermissionDenied => write!(f, "Permission denied"),
        }
    }
}

impl std::error::Error for ConfigError {}

// ============================================================================
// GREEN Phase Implementation
// ============================================================================

/// Detect all available audio output devices
///
/// Uses pactl to query PulseAudio/PipeWire sinks
/// Returns list of devices with metadata
pub fn detect_audio_devices() -> Result<Vec<AudioDevice>, ConfigError> {
    // Run pactl list sinks
    let output = Command::new("pactl")
        .args(["list", "sinks"])
        .output()
        .map_err(|e| ConfigError::CommandFailed(e.to_string()))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(ConfigError::CommandFailed(stderr.to_string()));
    }

    // Get default sink
    let default_output = Command::new("pactl")
        .args(["get-default-sink"])
        .output()
        .map_err(|e| ConfigError::CommandFailed(e.to_string()))?;

    let default_sink = if default_output.status.success() {
        String::from_utf8_lossy(&default_output.stdout).trim().to_string()
    } else {
        String::new()
    };

    // Parse output
    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut devices = Vec::new();

    for sink_block in stdout.split("Sink #") {
        if sink_block.trim().is_empty() {
            continue;
        }

        // Extract device ID (first line after "Sink #")
        let id = sink_block
            .lines()
            .next()
            .and_then(|line| line.split_whitespace().next())
            .unwrap_or("")
            .to_string();

        // Extract Name
        let name = extract_field(sink_block, "Name:")
            .unwrap_or_else(|| format!("sink-{}", id));

        // Extract Description
        let description = extract_field(sink_block, "Description:")
            .unwrap_or_else(|| name.clone());

        // Check if default
        let is_default = name == default_sink;

        if !id.is_empty() {
            devices.push(AudioDevice {
                id,
                name,
                description,
                is_default,
            });
        }
    }

    Ok(devices)
}

/// Configure speaker as default audio output device
///
/// Uses pactl to set default sink
/// Validates device exists before applying
/// Accepts either device ID or device name
pub fn configure_speaker(device_id: &str) -> Result<(), ConfigError> {
    // Validate device ID format (basic validation only)
    if device_id.is_empty() {
        return Err(ConfigError::InvalidState(
            "Device ID cannot be empty".to_string(),
        ));
    }

    // Check for obvious security issues
    if device_id.contains('\0') || device_id.contains("..") {
        return Err(ConfigError::InvalidState(format!(
            "Invalid device ID format: {}",
            device_id
        )));
    }

    // Get current config to restore on error
    let original_config = get_current_speaker_config()?;

    // Verify device exists
    let devices = detect_audio_devices()?;
    let device = devices
        .iter()
        .find(|d| d.id == device_id || d.name == device_id)
        .ok_or_else(|| ConfigError::DeviceNotFound(device_id.to_string()))?;

    // Use device name (not ID) for pactl set-default-sink
    let output = Command::new("pactl")
        .args(["set-default-sink", &device.name])
        .output()
        .map_err(|e| {
            // Restore original config on command failure
            let _ = Command::new("pactl")
                .args(["set-default-sink", &original_config.device_id])
                .output();
            ConfigError::CommandFailed(e.to_string())
        })?;

    if !output.status.success() {
        // Restore original config on failure
        let _ = Command::new("pactl")
            .args(["set-default-sink", &original_config.device_id])
            .output();

        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(ConfigError::CommandFailed(stderr.to_string()));
    }

    // Verify configuration was applied
    let config = get_current_speaker_config()?;
    if config.device_id != device.name {
        // Restore original config if verification fails
        let _ = Command::new("pactl")
            .args(["set-default-sink", &original_config.device_id])
            .output();

        return Err(ConfigError::InvalidState(
            "Configuration not applied correctly".to_string(),
        ));
    }

    Ok(())
}

/// Get current speaker configuration
///
/// Queries default sink and its properties
/// Returns volume, mute status, and device ID
pub fn get_current_speaker_config() -> Result<SpeakerConfig, ConfigError> {
    // Get default sink name
    let output = Command::new("pactl")
        .args(["get-default-sink"])
        .output()
        .map_err(|e| ConfigError::CommandFailed(e.to_string()))?;

    if !output.status.success() {
        return Err(ConfigError::InvalidState("No default sink configured".to_string()));
    }

    let device_id = String::from_utf8_lossy(&output.stdout).trim().to_string();

    // Get sink info for volume and mute status
    let info_output = Command::new("pactl")
        .args(["list", "sinks"])
        .output()
        .map_err(|e| ConfigError::CommandFailed(e.to_string()))?;

    let info_stdout = String::from_utf8_lossy(&info_output.stdout);

    // Find the sink block for our device
    let sink_block = info_stdout
        .split("Sink #")
        .find(|block| {
            extract_field(block, "Name:")
                .map(|name| name == device_id)
                .unwrap_or(false)
        })
        .ok_or_else(|| ConfigError::DeviceNotFound(device_id.clone()))?;

    // Extract volume (percentage)
    let volume = extract_field(sink_block, "Volume:")
        .and_then(|vol_line| {
            // Look for first percentage value
            vol_line.split('%').next().and_then(|s| {
                s.split_whitespace()
                    .last()
                    .and_then(|v| v.parse::<i32>().ok())
            })
        })
        .unwrap_or(100); // Default to 100% if not found

    // Clamp volume to valid range (0-100 percentage)
    let volume = volume.clamp(0, 100);

    // Extract mute status
    let muted = extract_field(sink_block, "Mute:")
        .map(|mute_val| mute_val.trim() == "yes")
        .unwrap_or(false);

    Ok(SpeakerConfig {
        device_id,
        volume,
        muted,
    })
}

/// Validate device ID format
///
/// Checks for:
/// - Non-empty string
/// - No path traversal attempts
/// - No null bytes
/// - No spaces (device IDs should not have spaces, names might)
pub fn validate_device_id(device_id: &str) -> bool {
    // Empty string is invalid
    if device_id.is_empty() {
        return false;
    }

    // Check for null bytes (security)
    if device_id.contains('\0') {
        return false;
    }

    // Check for path traversal attempts
    if device_id.contains("..") || device_id.contains('/') || device_id.contains('\\') {
        return false;
    }

    // Device IDs should not contain spaces (but device names might)
    // For strict validation, reject spaces
    if device_id.contains(' ') {
        return false;
    }

    true
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Extract value after field label in pactl output
///
/// Example: "Name: my-device" -> Some("my-device")
fn extract_field(text: &str, field: &str) -> Option<String> {
    text.lines()
        .find(|line| line.trim().starts_with(field))
        .map(|line| {
            line.split_once(':')
                .map(|(_, value)| value.trim().to_string())
                .unwrap_or_default()
        })
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_device_id_valid() {
        assert!(validate_device_id("device-123"));
        assert!(validate_device_id("valid-device"));
        assert!(validate_device_id("device123"));
    }

    #[test]
    fn test_validate_device_id_invalid() {
        assert!(!validate_device_id("")); // Empty
        assert!(!validate_device_id("../etc/passwd")); // Path traversal
        assert!(!validate_device_id("device\0null")); // Null byte
        assert!(!validate_device_id("/path/to/device")); // Absolute path
    }

    #[test]
    fn test_extract_field() {
        let text = "Name: my-device\nDescription: My Device\n";
        assert_eq!(extract_field(text, "Name:"), Some("my-device".to_string()));
        assert_eq!(
            extract_field(text, "Description:"),
            Some("My Device".to_string())
        );
        assert_eq!(extract_field(text, "NotFound:"), None);
    }
}
