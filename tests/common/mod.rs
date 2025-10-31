// Common test utilities and helpers
//
// This module provides shared testing utilities used across all test modules

use std::process::Command;
use tempfile::TempDir;
use std::path::Path;

pub struct TestEnvironment {
    pub temp_dir: TempDir,
    pub mock_env_vars: std::collections::HashMap<String, String>,
}

impl TestEnvironment {
    pub fn new() -> Self {
        let temp_dir = TempDir::new().expect("Failed to create temp directory for tests");
        let mock_env_vars = std::collections::HashMap::new();
        
        Self {
            temp_dir,
            mock_env_vars,
        }
    }
    
    pub fn temp_path(&self) -> &Path {
        self.temp_dir.path()
    }
    
    pub fn add_env_var(&mut self, key: String, value: String) {
        self.mock_env_vars.insert(key, value);
    }
    
    pub fn create_test_file(&self, name: &str, content: &str) -> std::path::PathBuf {
        let file_path = self.temp_path().join(name);
        std::fs::write(&file_path, content).expect("Failed to write test file");
        file_path
    }
}

pub struct MockCommand {
    pub command: String,
    pub args: Vec<String>,
    pub expected_success: bool,
    pub expected_stdout: String,
    pub expected_stderr: String,
}

impl MockCommand {
    pub fn new(command: &str) -> Self {
        Self {
            command: command.to_string(),
            args: Vec::new(),
            expected_success: true,
            expected_stdout: String::new(),
            expected_stderr: String::new(),
        }
    }
    
    pub fn with_args(mut self, args: Vec<&str>) -> Self {
        self.args = args.iter().map(|s| s.to_string()).collect();
        self
    }
    
    pub fn expecting_success(mut self, success: bool) -> Self {
        self.expected_success = success;
        self
    }
    
    pub fn expecting_stdout(mut self, stdout: &str) -> Self {
        self.expected_stdout = stdout.to_string();
        self
    }
    
    pub fn expecting_stderr(mut self, stderr: &str) -> Self {
        self.expected_stderr = stderr.to_string();
        self
    }
}

pub fn assert_command_output(mock: &MockCommand) {
    let mut command = Command::new(&mock.command);
    command.args(&mock.args);
    
    let output = command.output().expect("Failed to execute command");
    
    assert_eq!(
        output.status.success(),
        mock.expected_success,
        "Command {} success mismatch. Expected: {}, Got: {}",
        mock.command,
        mock.expected_success,
        output.status.success()
    );
    
    if !mock.expected_stdout.is_empty() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        assert!(
            stdout.contains(&mock.expected_stdout),
            "Command {} stdout mismatch. Expected to contain: '{}', Got: '{}'",
            mock.command,
            mock.expected_stdout,
            stdout
        );
    }
    
    if !mock.expected_stderr.is_empty() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        assert!(
            stderr.contains(&mock.expected_stderr),
            "Command {} stderr mismatch. Expected to contain: '{}', Got: '{}'",
            mock.command,
            mock.expected_stderr,
            stderr
        );
    }
}

// Test data generators for property-based testing
pub mod generators {
    use proptest::prelude::*;
    
    pub fn valid_log_levels() -> impl Strategy<Value = String> {
        prop_oneof![
            Just("debug".to_string()),
            Just("info".to_string()),
            Just("warn".to_string()),
            Just("error".to_string()),
        ]
    }
    
    pub fn valid_build_modes() -> impl Strategy<Value = String> {
        prop_oneof![
            Just("debug".to_string()),
            Just("release".to_string()),
        ]
    }
    
    pub fn valid_volume_levels() -> impl Strategy<Value = u8> {
        0u8..=100
    }
    
    pub fn valid_optimization_levels() -> impl Strategy<Value = u8> {
        0u8..=3
    }
    
    pub fn safe_file_names() -> impl Strategy<Value = String> {
        "[a-zA-Z0-9_-]{1,50}\\.[a-zA-Z0-9]{1,10}"
    }
    
    pub fn valid_component_names() -> impl Strategy<Value = String> {
        "[A-Z][A-Z0-9_]{1,20}"
    }
    
    pub fn safe_command_names() -> impl Strategy<Value = String> {
        "[a-zA-Z0-9_-]{1,30}"
    }
}

// Assertion helpers
pub fn assert_within_range<T>(value: T, min: T, max: T, name: &str)
where
    T: PartialOrd + std::fmt::Debug,
{
    assert!(
        value >= min && value <= max,
        "{} should be within range [{:?}, {:?}], got {:?}",
        name, min, max, value
    );
}

pub fn assert_contains_all(haystack: &str, needles: &[&str]) {
    for needle in needles {
        assert!(
            haystack.contains(needle),
            "String should contain '{}', but got: '{}'",
            needle, haystack
        );
    }
}

pub fn assert_file_exists(path: &Path) {
    assert!(
        path.exists(),
        "File should exist at path: {}",
        path.display()
    );
}

pub fn assert_file_not_exists(path: &Path) {
    assert!(
        !path.exists(),
        "File should not exist at path: {}",
        path.display()
    );
}

// Mock system utilities
pub struct MockSystemInfo {
    pub is_root: bool,
    pub home_dir: String,
    pub user: String,
    pub available_commands: Vec<String>,
}

impl Default for MockSystemInfo {
    fn default() -> Self {
        Self {
            is_root: false,
            home_dir: "/home/testuser".to_string(),
            user: "testuser".to_string(),
            available_commands: vec![
                "echo".to_string(),
                "cat".to_string(),
                "ls".to_string(),
                "mkdir".to_string(),
                "rm".to_string(),
            ],
        }
    }
}

// Test fixtures
pub mod fixtures {
    use super::*;
    
    pub fn sample_system_config() -> ubuntu_config_scripts::SystemConfig {
        ubuntu_config_scripts::SystemConfig {
            auto_update: false,
            backup_enabled: true,
            log_level: "debug".to_string(),
            temp_dir: Some("/tmp/test".to_string()),
        }
    }
    
    pub fn sample_audio_config() -> ubuntu_config_scripts::AudioConfig {
        ubuntu_config_scripts::AudioConfig {
            default_sink: Some("test_sink".to_string()),
            default_source: Some("test_source".to_string()),
            volume_level: Some(75),
            enable_echo_cancellation: false,
        }
    }
    
    pub fn sample_dev_config() -> ubuntu_config_scripts::DevConfig {
        ubuntu_config_scripts::DevConfig {
            build_mode: "debug".to_string(),
            target_arch: vec!["x86_64".to_string(), "aarch64".to_string()],
            optimization_level: 1,
            include_debug_symbols: true,
        }
    }
    
    pub fn sample_full_config() -> ubuntu_config_scripts::Config {
        ubuntu_config_scripts::Config {
            system: sample_system_config(),
            audio: sample_audio_config(),
            dev: sample_dev_config(),
            extra: std::collections::HashMap::new(),
        }
    }
}