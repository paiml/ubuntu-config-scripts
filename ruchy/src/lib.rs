// Ubuntu Config Scripts - Ruchy Port
// Library module for audio configuration

pub mod audio_speakers;

// Re-export main types for convenience
pub use audio_speakers::{AudioDevice, ConfigError, SpeakerConfig};
pub use audio_speakers::{configure_speaker, detect_audio_devices, get_current_speaker_config};
