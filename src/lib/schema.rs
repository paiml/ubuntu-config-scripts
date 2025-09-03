// Type-safe schema validation for Ubuntu Config Scripts
//
// This module provides validation and type safety for configuration data
// using serde and custom validation logic, with support for complex validation rules

use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt::Debug;

/// Configuration schema for system scripts
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemConfig {
    pub auto_update: bool,
    pub backup_enabled: bool,
    pub log_level: String,
    pub temp_dir: Option<String>,
}

impl Default for SystemConfig {
    fn default() -> Self {
        Self {
            auto_update: true,
            backup_enabled: true,
            log_level: "info".to_string(),
            temp_dir: None,
        }
    }
}

/// Configuration schema for audio scripts
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioConfig {
    pub default_sink: Option<String>,
    pub default_source: Option<String>,
    pub volume_level: Option<u8>,
    pub enable_echo_cancellation: bool,
}

impl Default for AudioConfig {
    fn default() -> Self {
        Self {
            default_sink: None,
            default_source: None,
            volume_level: Some(70),
            enable_echo_cancellation: true,
        }
    }
}

/// Configuration schema for development scripts
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DevConfig {
    pub build_mode: String,
    pub target_arch: Vec<String>,
    pub optimization_level: u8,
    pub include_debug_symbols: bool,
}

impl Default for DevConfig {
    fn default() -> Self {
        Self {
            build_mode: "release".to_string(),
            target_arch: vec!["x86_64".to_string()],
            optimization_level: 3,
            include_debug_symbols: false,
        }
    }
}

/// Main configuration container
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Config {
    pub system: SystemConfig,
    pub audio: AudioConfig,
    pub dev: DevConfig,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

impl Config {
    /// Load configuration from JSON string
    pub fn from_json(json: &str) -> Result<Self> {
        serde_json::from_str(json).context("Failed to parse JSON configuration")
    }

    /// Load configuration from JSON file
    pub fn from_file(path: &str) -> Result<Self> {
        let content = std::fs::read_to_string(path)
            .with_context(|| format!("Failed to read config file: {}", path))?;
        Self::from_json(&content)
    }

    /// Save configuration to JSON file
    pub fn to_file(&self, path: &str) -> Result<()> {
        let json =
            serde_json::to_string_pretty(self).context("Failed to serialize configuration")?;
        std::fs::write(path, json).with_context(|| format!("Failed to write config file: {}", path))
    }

    /// Convert to JSON string
    pub fn to_json(&self) -> Result<String> {
        serde_json::to_string_pretty(self).context("Failed to serialize configuration to JSON")
    }

    /// Validate configuration values
    pub fn validate(&self) -> Result<()> {
        // Validate system config
        if !["debug", "info", "warn", "error"].contains(&self.system.log_level.as_str()) {
            return Err(anyhow::anyhow!(
                "Invalid log level: {}",
                self.system.log_level
            ));
        }

        // Validate audio config
        if let Some(volume) = self.audio.volume_level {
            if volume > 100 {
                return Err(anyhow::anyhow!(
                    "Volume level cannot exceed 100: {}",
                    volume
                ));
            }
        }

        // Validate dev config
        if !["debug", "release"].contains(&self.dev.build_mode.as_str()) {
            return Err(anyhow::anyhow!(
                "Invalid build mode: {}",
                self.dev.build_mode
            ));
        }

        if self.dev.optimization_level > 3 {
            return Err(anyhow::anyhow!(
                "Optimization level cannot exceed 3: {}",
                self.dev.optimization_level
            ));
        }

        Ok(())
    }
}

/// Schema validation trait for custom types
pub trait Validate {
    type Error;

    fn validate(&self) -> Result<(), Self::Error>;
}

/// Generic validation result type
#[derive(Debug, Clone)]
pub enum ValidationResult<T> {
    Success(T),
    Failure(String),
}

impl<T> ValidationResult<T> {
    pub fn is_success(&self) -> bool {
        matches!(self, ValidationResult::Success(_))
    }

    pub fn to_result(self) -> Result<T> {
        match self {
            ValidationResult::Success(data) => Ok(data),
            ValidationResult::Failure(err) => Err(anyhow!(err)),
        }
    }
}

/// String validator with constraints
pub struct StringValidator {
    min_length: Option<usize>,
    max_length: Option<usize>,
    pattern: Option<regex::Regex>,
}

impl StringValidator {
    pub fn new() -> Self {
        Self {
            min_length: None,
            max_length: None,
            pattern: None,
        }
    }

    pub fn min(mut self, length: usize) -> Self {
        self.min_length = Some(length);
        self
    }

    pub fn max(mut self, length: usize) -> Self {
        self.max_length = Some(length);
        self
    }

    pub fn pattern(mut self, pattern: &str) -> Result<Self> {
        self.pattern = Some(regex::Regex::new(pattern)?);
        Ok(self)
    }

    pub fn validate(&self, value: &str) -> ValidationResult<String> {
        if let Some(min) = self.min_length {
            if value.len() < min {
                return ValidationResult::Failure(format!(
                    "String must be at least {} characters",
                    min
                ));
            }
        }

        if let Some(max) = self.max_length {
            if value.len() > max {
                return ValidationResult::Failure(format!(
                    "String must be at most {} characters",
                    max
                ));
            }
        }

        if let Some(ref re) = self.pattern {
            if !re.is_match(value) {
                return ValidationResult::Failure(format!(
                    "String does not match required pattern"
                ));
            }
        }

        ValidationResult::Success(value.to_string())
    }
}

/// Number validator with constraints
pub struct NumberValidator {
    minimum: Option<f64>,
    maximum: Option<f64>,
    is_integer: bool,
}

impl NumberValidator {
    pub fn new() -> Self {
        Self {
            minimum: None,
            maximum: None,
            is_integer: false,
        }
    }

    pub fn min(mut self, value: f64) -> Self {
        self.minimum = Some(value);
        self
    }

    pub fn max(mut self, value: f64) -> Self {
        self.maximum = Some(value);
        self
    }

    pub fn integer(mut self) -> Self {
        self.is_integer = true;
        self
    }

    pub fn validate(&self, value: f64) -> ValidationResult<f64> {
        if self.is_integer && value.fract() != 0.0 {
            return ValidationResult::Failure("Expected integer value".to_string());
        }

        if let Some(min) = self.minimum {
            if value < min {
                return ValidationResult::Failure(format!("Number must be at least {}", min));
            }
        }

        if let Some(max) = self.maximum {
            if value > max {
                return ValidationResult::Failure(format!("Number must be at most {}", max));
            }
        }

        ValidationResult::Success(value)
    }
}

/// Array validator with item validation
pub struct ArrayValidator<F> {
    min_length: Option<usize>,
    max_length: Option<usize>,
    item_validator: F,
}

impl<F> ArrayValidator<F> {
    pub fn new(item_validator: F) -> Self {
        Self {
            min_length: None,
            max_length: None,
            item_validator,
        }
    }

    pub fn min(mut self, length: usize) -> Self {
        self.min_length = Some(length);
        self
    }

    pub fn max(mut self, length: usize) -> Self {
        self.max_length = Some(length);
        self
    }
}

impl<F> ArrayValidator<F> {
    pub fn validate<T>(&self, values: &[T]) -> ValidationResult<Vec<T>>
    where
        F: Fn(&T) -> ValidationResult<T>,
        T: Clone,
    {
        if let Some(min) = self.min_length {
            if values.len() < min {
                return ValidationResult::Failure(format!(
                    "Array must have at least {} items",
                    min
                ));
            }
        }

        if let Some(max) = self.max_length {
            if values.len() > max {
                return ValidationResult::Failure(format!(
                    "Array must have at most {} items",
                    max
                ));
            }
        }

        let mut results = Vec::new();
        for (i, item) in values.iter().enumerate() {
            match (self.item_validator)(item) {
                ValidationResult::Success(data) => results.push(data),
                ValidationResult::Failure(err) => {
                    return ValidationResult::Failure(format!(
                        "Invalid item at index {}: {}",
                        i, err
                    ))
                }
            }
        }

        ValidationResult::Success(results)
    }
}

/// Command line argument schema
#[derive(Debug, Clone)]
pub struct Args {
    pub verbose: bool,
    pub dry_run: bool,
    pub config_file: Option<String>,
    pub log_level: Option<String>,
    pub extra: HashMap<String, String>,
}

impl Args {
    /// Parse arguments from HashMap (from common::parse_args)
    pub fn from_hashmap(args: HashMap<String, String>) -> Self {
        Self {
            verbose: args.get("verbose").map(|v| v == "true").unwrap_or(false),
            dry_run: args.get("dry-run").map(|v| v == "true").unwrap_or(false),
            config_file: args.get("config").cloned(),
            log_level: args.get("log-level").cloned(),
            extra: args,
        }
    }

    /// Validate argument values
    pub fn validate(&self) -> Result<()> {
        if let Some(ref level) = self.log_level {
            if !["debug", "info", "warn", "error"].contains(&level.as_str()) {
                return Err(anyhow::anyhow!("Invalid log level: {}", level));
            }
        }
        Ok(())
    }
}

/// JSON schema validation utilities
pub mod json {
    use super::*;
    use serde_json::Value;

    /// Validate JSON value as string
    pub fn validate_string(value: &Value) -> ValidationResult<String> {
        match value.as_str() {
            Some(s) => ValidationResult::Success(s.to_string()),
            None => ValidationResult::Failure("Expected string".to_string()),
        }
    }

    /// Validate JSON value as number
    pub fn validate_number(value: &Value) -> ValidationResult<f64> {
        match value.as_f64() {
            Some(n) => ValidationResult::Success(n),
            None => ValidationResult::Failure("Expected number".to_string()),
        }
    }

    /// Validate JSON value as boolean
    pub fn validate_bool(value: &Value) -> ValidationResult<bool> {
        match value.as_bool() {
            Some(b) => ValidationResult::Success(b),
            None => ValidationResult::Failure("Expected boolean".to_string()),
        }
    }

    /// Validate JSON value as array
    pub fn validate_array(value: &Value) -> ValidationResult<Vec<Value>> {
        match value.as_array() {
            Some(arr) => ValidationResult::Success(arr.clone()),
            None => ValidationResult::Failure("Expected array".to_string()),
        }
    }

    /// Validate JSON value as object
    pub fn validate_object(value: &Value) -> ValidationResult<serde_json::Map<String, Value>> {
        match value.as_object() {
            Some(obj) => ValidationResult::Success(obj.clone()),
            None => ValidationResult::Failure("Expected object".to_string()),
        }
    }

    /// Validate and parse JSON string
    pub fn parse_json(json_str: &str) -> Result<Value> {
        serde_json::from_str(json_str).context("Failed to parse JSON")
    }

    /// Validate JSON against a schema function
    pub fn validate_with<T, F>(value: &Value, validator: F) -> ValidationResult<T>
    where
        F: Fn(&Value) -> ValidationResult<T>,
    {
        validator(value)
    }
}

/// Path validation utilities
pub mod path {
    use super::*;
    use std::path::Path;

    /// Validate that a path exists
    pub fn validate_exists(path: &str) -> ValidationResult<String> {
        if Path::new(path).exists() {
            ValidationResult::Success(path.to_string())
        } else {
            ValidationResult::Failure(format!("Path does not exist: {}", path))
        }
    }

    /// Validate that a path is a file
    pub fn validate_file(path: &str) -> ValidationResult<String> {
        let p = Path::new(path);
        if !p.exists() {
            ValidationResult::Failure(format!("Path does not exist: {}", path))
        } else if !p.is_file() {
            ValidationResult::Failure(format!("Path is not a file: {}", path))
        } else {
            ValidationResult::Success(path.to_string())
        }
    }

    /// Validate that a path is a directory
    pub fn validate_directory(path: &str) -> ValidationResult<String> {
        let p = Path::new(path);
        if !p.exists() {
            ValidationResult::Failure(format!("Path does not exist: {}", path))
        } else if !p.is_dir() {
            ValidationResult::Failure(format!("Path is not a directory: {}", path))
        } else {
            ValidationResult::Success(path.to_string())
        }
    }

    /// Validate that a path is writable
    pub fn validate_writable(path: &str) -> ValidationResult<String> {
        let p = Path::new(path);
        let check_path = if p.exists() {
            p.to_path_buf()
        } else {
            p.parent()
                .map(|parent| parent.to_path_buf())
                .unwrap_or_else(|| Path::new(".").to_path_buf())
        };

        if check_path.exists() {
            // Try to check if we can write
            let metadata = std::fs::metadata(&check_path);
            if metadata.is_ok() {
                ValidationResult::Success(path.to_string())
            } else {
                ValidationResult::Failure(format!("Path is not accessible: {}", path))
            }
        } else {
            ValidationResult::Failure(format!("Parent directory does not exist: {}", path))
        }
    }
}

/// Environment variable validation
pub mod env {
    use super::*;
    use std::env;

    /// Validate that an environment variable exists
    pub fn validate_exists(var_name: &str) -> ValidationResult<String> {
        match env::var(var_name) {
            Ok(value) => ValidationResult::Success(value),
            Err(_) => ValidationResult::Failure(format!(
                "Environment variable not set: {}",
                var_name
            )),
        }
    }

    /// Validate environment variable with a custom validator
    pub fn validate_with<F>(var_name: &str, validator: F) -> ValidationResult<String>
    where
        F: Fn(&str) -> ValidationResult<String>,
    {
        match env::var(var_name) {
            Ok(value) => validator(&value),
            Err(_) => ValidationResult::Failure(format!(
                "Environment variable not set: {}",
                var_name
            )),
        }
    }
}

/// Command validation utilities
pub mod command {
    use super::*;

    /// Validate that a command exists in PATH
    pub fn validate_exists(cmd: &str) -> ValidationResult<String> {
        if which::which(cmd).is_ok() {
            ValidationResult::Success(cmd.to_string())
        } else {
            ValidationResult::Failure(format!("Command not found in PATH: {}", cmd))
        }
    }

    /// Validate a list of required commands
    pub fn validate_all_exist(commands: &[&str]) -> ValidationResult<Vec<String>> {
        let mut missing = Vec::new();
        let mut found = Vec::new();

        for cmd in commands {
            if which::which(cmd).is_ok() {
                found.push(cmd.to_string());
            } else {
                missing.push(cmd.to_string());
            }
        }

        if missing.is_empty() {
            ValidationResult::Success(found)
        } else {
            ValidationResult::Failure(format!(
                "Required commands not found: {}",
                missing.join(", ")
            ))
        }
    }
}
