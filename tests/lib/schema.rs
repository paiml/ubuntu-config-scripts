// Tests for schema validation module
//
// This module tests configuration validation and type safety

use tempfile::NamedTempFile;
use ubuntu_config_scripts::*;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_system_config_default() {
        let config = SystemConfig::default();
        assert!(config.auto_update);
        assert!(config.backup_enabled);
        assert_eq!(config.log_level, "info");
        assert_eq!(config.temp_dir, None);
    }

    #[test]
    fn test_audio_config_default() {
        let config = AudioConfig::default();
        assert_eq!(config.default_sink, None);
        assert_eq!(config.default_source, None);
        assert_eq!(config.volume_level, Some(70));
        assert!(config.enable_echo_cancellation);
    }

    #[test]
    fn test_dev_config_default() {
        let config = DevConfig::default();
        assert_eq!(config.build_mode, "release");
        assert_eq!(config.target_arch, vec!["x86_64".to_string()]);
        assert_eq!(config.optimization_level, 3);
        assert!(!config.include_debug_symbols);
    }

    #[test]
    fn test_config_default() {
        let config = Config::default();
        assert!(config.system.auto_update);
        assert_eq!(config.audio.volume_level, Some(70));
        assert_eq!(config.dev.build_mode, "release");
        assert!(config.extra.is_empty());
    }

    #[test]
    fn test_config_from_json_valid() {
        let json = r#"
        {
            "system": {
                "auto_update": false,
                "backup_enabled": true,
                "log_level": "debug",
                "temp_dir": "/tmp/custom"
            },
            "audio": {
                "default_sink": "alsa_output.pci-0000_00_1b.0.analog-stereo",
                "volume_level": 80,
                "enable_echo_cancellation": false
            },
            "dev": {
                "build_mode": "debug",
                "target_arch": ["x86_64", "aarch64"],
                "optimization_level": 0,
                "include_debug_symbols": true
            },
            "custom_field": "custom_value"
        }
        "#;

        let config = Config::from_json(json).unwrap();

        assert!(!config.system.auto_update);
        assert_eq!(config.system.log_level, "debug");
        assert_eq!(config.system.temp_dir, Some("/tmp/custom".to_string()));

        assert_eq!(
            config.audio.default_sink,
            Some("alsa_output.pci-0000_00_1b.0.analog-stereo".to_string())
        );
        assert_eq!(config.audio.volume_level, Some(80));
        assert!(!config.audio.enable_echo_cancellation);

        assert_eq!(config.dev.build_mode, "debug");
        assert_eq!(
            config.dev.target_arch,
            vec!["x86_64".to_string(), "aarch64".to_string()]
        );
        assert_eq!(config.dev.optimization_level, 0);
        assert!(config.dev.include_debug_symbols);

        assert_eq!(
            config.extra.get("custom_field"),
            Some(&serde_json::Value::String("custom_value".to_string()))
        );
    }

    #[test]
    fn test_config_from_json_invalid() {
        let invalid_json = "{ invalid json }";
        let result = Config::from_json(invalid_json);
        assert!(result.is_err());
    }

    #[test]
    fn test_config_to_json() {
        let config = Config::default();
        let json = config.to_json().unwrap();

        // Should be valid JSON
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert!(parsed.is_object());

        // Should contain expected fields
        assert!(parsed["system"].is_object());
        assert!(parsed["audio"].is_object());
        assert!(parsed["dev"].is_object());
    }

    #[test]
    fn test_config_file_operations() {
        let config = Config::default();

        // Create a temporary file
        let temp_file = NamedTempFile::new().unwrap();
        let temp_path = temp_file.path().to_str().unwrap();

        // Write config to file
        config.to_file(temp_path).unwrap();

        // Read config from file
        let loaded_config = Config::from_file(temp_path).unwrap();

        // Configs should be equivalent
        assert_eq!(config.system.auto_update, loaded_config.system.auto_update);
        assert_eq!(config.audio.volume_level, loaded_config.audio.volume_level);
        assert_eq!(config.dev.build_mode, loaded_config.dev.build_mode);
    }

    #[test]
    fn test_config_validation_valid() {
        let config = Config::default();
        assert!(config.validate().is_ok());

        let mut valid_config = Config::default();
        valid_config.system.log_level = "debug".to_string();
        valid_config.audio.volume_level = Some(100);
        valid_config.dev.build_mode = "debug".to_string();
        valid_config.dev.optimization_level = 0;
        assert!(valid_config.validate().is_ok());
    }

    #[test]
    fn test_config_validation_invalid_log_level() {
        let mut config = Config::default();
        config.system.log_level = "invalid_level".to_string();
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_config_validation_invalid_volume() {
        let mut config = Config::default();
        config.audio.volume_level = Some(150); // Over 100
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_config_validation_invalid_build_mode() {
        let mut config = Config::default();
        config.dev.build_mode = "invalid_mode".to_string();
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_config_validation_invalid_optimization_level() {
        let mut config = Config::default();
        config.dev.optimization_level = 10; // Over 3
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_args_from_hashmap() {
        let mut map = std::collections::HashMap::new();
        map.insert("verbose".to_string(), "true".to_string());
        map.insert("dry-run".to_string(), "true".to_string());
        map.insert("config".to_string(), "/path/to/config".to_string());
        map.insert("log-level".to_string(), "debug".to_string());
        map.insert("extra".to_string(), "value".to_string());

        let args = Args::from_hashmap(map.clone());

        assert!(args.verbose);
        assert!(args.dry_run);
        assert_eq!(args.config_file, Some("/path/to/config".to_string()));
        assert_eq!(args.log_level, Some("debug".to_string()));
        assert_eq!(args.extra, map);
    }

    #[test]
    fn test_args_validation_valid() {
        let mut map = std::collections::HashMap::new();
        map.insert("log-level".to_string(), "info".to_string());

        let args = Args::from_hashmap(map);
        assert!(args.validate().is_ok());
    }

    #[test]
    fn test_args_validation_invalid_log_level() {
        let mut map = std::collections::HashMap::new();
        map.insert("log-level".to_string(), "invalid".to_string());

        let args = Args::from_hashmap(map);
        assert!(args.validate().is_err());
    }

    // Property-based tests
    #[cfg(test)]
    use proptest::prelude::*;

    proptest! {
        #[test]
        fn test_config_serialization_roundtrip(
            auto_update: bool,
            backup_enabled: bool,
            log_level in "(debug|info|warn|error)",
            volume in 0u8..=100,
            echo_cancellation: bool,
            build_mode in "(debug|release)",
            opt_level in 0u8..=3
        ) {
            let mut config = Config::default();
            config.system.auto_update = auto_update;
            config.system.backup_enabled = backup_enabled;
            config.system.log_level = log_level.clone();
            config.audio.volume_level = Some(volume);
            config.audio.enable_echo_cancellation = echo_cancellation;
            config.dev.build_mode = build_mode.clone();
            config.dev.optimization_level = opt_level;

            // Should validate successfully with valid inputs
            prop_assert!(config.validate().is_ok());

            // Should serialize and deserialize successfully
            let json = config.to_json().unwrap();
            let deserialized = Config::from_json(&json).unwrap();

            prop_assert_eq!(deserialized.system.auto_update, auto_update);
            prop_assert_eq!(deserialized.system.backup_enabled, backup_enabled);
            prop_assert_eq!(deserialized.system.log_level, log_level);
            prop_assert_eq!(deserialized.audio.volume_level, Some(volume));
            prop_assert_eq!(deserialized.audio.enable_echo_cancellation, echo_cancellation);
            prop_assert_eq!(deserialized.dev.build_mode, build_mode);
            prop_assert_eq!(deserialized.dev.optimization_level, opt_level);
        }

        #[test]
        fn test_args_from_hashmap_property(
            verbose: bool,
            dry_run: bool,
            config_present: bool,
            log_level in proptest::option::of("(debug|info|warn|error)")
        ) {
            let mut map = std::collections::HashMap::new();

            if verbose {
                map.insert("verbose".to_string(), "true".to_string());
            }
            if dry_run {
                map.insert("dry-run".to_string(), "true".to_string());
            }
            if config_present {
                map.insert("config".to_string(), "/test/config".to_string());
            }
            if let Some(ref level) = log_level {
                map.insert("log-level".to_string(), level.clone());
            }

            let args = Args::from_hashmap(map);

            prop_assert_eq!(args.verbose, verbose);
            prop_assert_eq!(args.dry_run, dry_run);
            prop_assert_eq!(args.config_file.is_some(), config_present);
            prop_assert_eq!(args.log_level.as_ref(), log_level.as_ref());

            // Should validate successfully with valid log levels
            prop_assert!(args.validate().is_ok());
        }
    }
}
