// Common utilities for Ubuntu Config Scripts
//
// This module provides shared functionality across all scripts including:
// - Command execution with proper error handling
// - File system operations
// - Environment variable management
// - User interaction utilities

use anyhow::{Context, Result};
use log::debug;
use std::collections::HashMap;
use std::env;
use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use tokio::fs as async_fs;
use tokio::process::Command;

/// Result of a command execution with detailed information
#[derive(Debug, Clone)]
pub struct CommandResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub code: i32,
}

/// Options for command execution
#[derive(Debug, Default)]
pub struct CommandOptions {
    pub cwd: Option<String>,
    pub env: Option<HashMap<String, String>>,
}

/// Execute a command with proper error handling and logging
pub async fn run_command(cmd: &[&str], options: Option<CommandOptions>) -> Result<CommandResult> {
    debug!("Running command: {}", cmd.join(" "));

    if cmd.is_empty() {
        return Err(anyhow::anyhow!("Command cannot be empty"));
    }

    let mut command = Command::new(cmd[0]);
    if cmd.len() > 1 {
        command.args(&cmd[1..]);
    }

    // Apply options if provided
    if let Some(opts) = options {
        if let Some(cwd) = opts.cwd {
            command.current_dir(cwd);
        }
        if let Some(env_vars) = opts.env {
            command.envs(env_vars);
        }
    }

    let output = command
        .output()
        .await
        .with_context(|| format!("Failed to execute command: {}", cmd[0]))?;

    let success = output.status.success();
    let code = output.status.code().unwrap_or(-1);
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !success {
        debug!("Command failed with code {}: {}", code, stderr);
    }

    Ok(CommandResult {
        success,
        stdout,
        stderr,
        code,
    })
}

/// Check if a command exists in PATH
pub async fn command_exists(command: &str) -> bool {
    which::which(command).is_ok()
}

/// Require a command to exist, error if not found
pub async fn require_command(command: &str) -> Result<()> {
    if !command_exists(command).await {
        return Err(anyhow::anyhow!(
            "Required command '{}' not found in PATH",
            command
        ));
    }
    Ok(())
}

/// Parse command line arguments into a HashMap
pub fn parse_args() -> HashMap<String, String> {
    let args: Vec<String> = env::args().collect();
    parse_args_from_vec(&args[1..])
}

/// Parse arguments from a vector of strings
pub fn parse_args_from_vec(args: &[String]) -> HashMap<String, String> {
    let mut parsed = HashMap::new();
    let mut i = 0;

    while i < args.len() {
        let arg = &args[i];

        if let Some(key_part) = arg.strip_prefix("--") {
            if let Some(eq_pos) = key_part.find('=') {
                let name = &key_part[..eq_pos];
                let value = &key_part[eq_pos + 1..];
                parsed.insert(name.to_string(), value.to_string());
            } else if i + 1 < args.len() && !args[i + 1].starts_with('-') {
                parsed.insert(key_part.to_string(), args[i + 1].clone());
                i += 1;
            } else {
                parsed.insert(key_part.to_string(), "true".to_string());
            }
        } else if arg.starts_with('-') && arg.len() == 2 {
            let key = &arg[1..];
            if i + 1 < args.len() && !args[i + 1].starts_with('-') {
                parsed.insert(key.to_string(), args[i + 1].clone());
                i += 1;
            } else {
                parsed.insert(key.to_string(), "true".to_string());
            }
        }

        i += 1;
    }

    parsed
}

/// Check if a file exists
pub fn file_exists(path: &str) -> bool {
    Path::new(path).exists()
}

/// Ensure a directory exists, creating it if necessary
pub fn ensure_dir(path: &str) -> Result<()> {
    fs::create_dir_all(path).with_context(|| format!("Failed to create directory {}", path))
}

/// Get environment variable or return default value
pub fn get_env_or_default(key: &str, default_value: &str) -> String {
    env::var(key).unwrap_or_else(|_| default_value.to_string())
}

/// Require environment variable to be set
pub fn require_env(key: &str) -> Result<String> {
    env::var(key).with_context(|| format!("Required environment variable '{}' not set", key))
}

/// Execute function with temporary directory
pub async fn with_temp_dir<T, F, Fut>(f: F) -> Result<T>
where
    F: FnOnce(String) -> Fut,
    Fut: std::future::Future<Output = Result<T>>,
{
    let temp_dir = tempfile::tempdir().context("Failed to create temporary directory")?;
    let temp_path = temp_dir.path().to_string_lossy().to_string();

    let result = f(temp_path).await;

    // temp_dir is automatically cleaned up when dropped
    result
}

/// Check if running as root
pub fn is_root() -> bool {
    match env::var("USER") {
        Ok(user) => user == "root",
        Err(_) => false,
    }
}

/// Require running as root
pub fn require_root() -> Result<()> {
    if !is_root() {
        return Err(anyhow::anyhow!(
            "This script must be run as root (use sudo)"
        ));
    }
    Ok(())
}

/// Get user confirmation with default value
pub fn confirm(message: &str, default_value: bool) -> Result<bool> {
    let default_text = if default_value { "[Y/n]" } else { "[y/N]" };
    print!("{} {}: ", message, default_text);

    io::stdout().flush().context("Failed to flush stdout")?;

    let mut line = String::new();
    io::stdin()
        .read_line(&mut line)
        .context("Failed to read input")?;

    let answer = line.trim().to_lowercase();
    if answer.is_empty() {
        Ok(default_value)
    } else {
        Ok(answer == "y" || answer == "yes")
    }
}

/// Read file contents as string
pub async fn read_file(path: &str) -> Result<String> {
    async_fs::read_to_string(path)
        .await
        .with_context(|| format!("Failed to read file: {}", path))
}

/// Write string to file
pub async fn write_file(path: &str, content: &str) -> Result<()> {
    async_fs::write(path, content)
        .await
        .with_context(|| format!("Failed to write file: {}", path))
}

/// Copy file from source to destination
pub async fn copy_file(src: &str, dst: &str) -> Result<()> {
    async_fs::copy(src, dst)
        .await
        .with_context(|| format!("Failed to copy {} to {}", src, dst))
        .map(|_| ())
}

/// Remove file or directory
pub async fn remove_path(path: &str) -> Result<()> {
    let path_obj = Path::new(path);
    if path_obj.is_dir() {
        async_fs::remove_dir_all(path)
            .await
            .with_context(|| format!("Failed to remove directory: {}", path))
    } else {
        async_fs::remove_file(path)
            .await
            .with_context(|| format!("Failed to remove file: {}", path))
    }
}

/// Get home directory
pub fn get_home_dir() -> Result<PathBuf> {
    env::var("HOME")
        .map(PathBuf::from)
        .or_else(|_| {
            home::home_dir().ok_or_else(|| anyhow::anyhow!("Could not determine home directory"))
        })
}

/// Expand tilde in path
pub fn expand_tilde(path: &str) -> Result<String> {
    if path.starts_with("~/") {
        let home = get_home_dir()?;
        Ok(path.replacen("~", &home.to_string_lossy(), 1))
    } else {
        Ok(path.to_string())
    }
}

/// Get absolute path
pub fn get_absolute_path(path: &str) -> Result<PathBuf> {
    let expanded = expand_tilde(path)?;
    let path = Path::new(&expanded);
    
    if path.is_absolute() {
        Ok(path.to_path_buf())
    } else {
        env::current_dir()
            .context("Failed to get current directory")?
            .join(path)
            .canonicalize()
            .with_context(|| format!("Failed to get absolute path for: {}", expanded))
    }
}

/// Check if path is a directory
pub fn is_directory(path: &str) -> bool {
    Path::new(path).is_dir()
}

/// Check if path is a file
pub fn is_file(path: &str) -> bool {
    Path::new(path).is_file()
}

/// List directory contents
pub async fn list_directory(path: &str) -> Result<Vec<String>> {
    let mut entries = Vec::new();
    let mut dir = async_fs::read_dir(path)
        .await
        .with_context(|| format!("Failed to read directory: {}", path))?;
    
    while let Some(entry) = dir.next_entry().await? {
        if let Some(name) = entry.file_name().to_str() {
            entries.push(name.to_string());
        }
    }
    
    Ok(entries)
}

/// Run command with sudo
pub async fn run_sudo_command(cmd: &[&str]) -> Result<CommandResult> {
    let mut sudo_cmd = vec!["sudo"];
    sudo_cmd.extend_from_slice(cmd);
    run_command(&sudo_cmd, None).await
}

/// Get current username
pub fn get_username() -> String {
    env::var("USER").unwrap_or_else(|_| "unknown".to_string())
}

/// Check if running in CI environment
pub fn is_ci() -> bool {
    env::var("CI").is_ok() || env::var("GITHUB_ACTIONS").is_ok()
}

/// Sleep for specified milliseconds
pub async fn sleep_ms(ms: u64) {
    tokio::time::sleep(tokio::time::Duration::from_millis(ms)).await;
}
