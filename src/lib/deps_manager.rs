// Dependency management for Ubuntu Config Scripts
//
// This module handles dependency checking and management for the scripts,
// including Cargo dependencies, system dependencies, and build tools

use crate::lib::common::*;
use crate::lib::logger::*;
use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use std::process::Command as StdCommand;

/// Dependency information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Dependency {
    pub name: String,
    pub version: String,
    pub source: String,
    pub required: bool,
}

/// Update result for a dependency
#[derive(Debug, Clone)]
pub struct UpdateResult {
    pub name: String,
    pub updated: bool,
    pub from_version: String,
    pub to_version: Option<String>,
    pub error: Option<String>,
}

/// Check if all required system dependencies are available
pub async fn check_system_dependencies() -> Result<Vec<String>> {
    let timer = PerformanceTimer::new("system dependency check");
    let mut missing = Vec::new();

    // Core system dependencies
    let required_commands = vec![
        "systemctl",
        "ps",
        "git",
        "make",
        "cargo",
        "rustc",
    ];

    for cmd in &required_commands {
        if !command_exists(cmd).await {
            missing.push(cmd.to_string());
            log_warn(&format!("Missing required command: {}", cmd), "DEPS");
        } else {
            log_debug(&format!("Found command: {}", cmd), "DEPS");
        }
    }

    timer.finish();
    
    if !missing.is_empty() {
        return Err(anyhow!(
            "Missing required commands: {}",
            missing.join(", ")
        ));
    }
    
    Ok(required_commands.into_iter().map(String::from).collect())
}

/// Scan Cargo dependencies from Cargo.toml
pub fn scan_cargo_dependencies(project_root: &str) -> Result<Vec<Dependency>> {
    let cargo_path = Path::new(project_root).join("Cargo.toml");
    
    if !cargo_path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&cargo_path)
        .with_context(|| format!("Failed to read {}", cargo_path.display()))?;

    // Parse TOML to extract dependencies
    let toml_value: toml::Value = toml::from_str(&content)
        .context("Failed to parse Cargo.toml")?;

    let mut deps = Vec::new();

    // Extract regular dependencies
    if let Some(dependencies) = toml_value.get("dependencies").and_then(|d| d.as_table()) {
        for (name, value) in dependencies {
            let version = extract_version(value);
            deps.push(Dependency {
                name: name.clone(),
                version,
                source: "dependencies".to_string(),
                required: true,
            });
        }
    }

    // Extract dev dependencies
    if let Some(dev_deps) = toml_value.get("dev-dependencies").and_then(|d| d.as_table()) {
        for (name, value) in dev_deps {
            let version = extract_version(value);
            deps.push(Dependency {
                name: name.clone(),
                version,
                source: "dev-dependencies".to_string(),
                required: false,
            });
        }
    }

    log_info(&format!("Found {} Cargo dependencies", deps.len()), "DEPS");
    Ok(deps)
}

/// Extract version from TOML dependency value
fn extract_version(value: &toml::Value) -> String {
    match value {
        toml::Value::String(s) => s.clone(),
        toml::Value::Table(t) => {
            t.get("version")
                .and_then(|v| v.as_str())
                .unwrap_or("*")
                .to_string()
        }
        _ => "*".to_string(),
    }
}

/// Check for outdated Cargo dependencies
pub fn check_outdated_cargo() -> Result<Vec<Dependency>> {
    log_info("Checking for outdated Cargo dependencies...", "DEPS");

    // Run cargo outdated if available
    let output = StdCommand::new("cargo")
        .args(&["outdated", "--format", "json"])
        .output();

    match output {
        Ok(output) if output.status.success() => {
            // Parse JSON output
            let json_str = String::from_utf8_lossy(&output.stdout);
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&json_str) {
                let mut outdated = Vec::new();
                
                if let Some(deps) = json["dependencies"].as_array() {
                    for dep in deps {
                        if let (Some(name), Some(project), Some(latest)) = (
                            dep["name"].as_str(),
                            dep["project"].as_str(),
                            dep["latest"].as_str(),
                        ) {
                            outdated.push(Dependency {
                                name: name.to_string(),
                                version: format!("{} -> {}", project, latest),
                                source: "outdated".to_string(),
                                required: true,
                            });
                        }
                    }
                }
                
                log_info(&format!("Found {} outdated dependencies", outdated.len()), "DEPS");
                return Ok(outdated);
            }
        }
        _ => {
            log_warn("cargo-outdated not available, skipping outdated check", "DEPS");
        }
    }

    Ok(Vec::new())
}

/// Update Cargo dependencies
pub fn update_cargo_dependencies(dry_run: bool) -> Result<Vec<UpdateResult>> {
    let results = Vec::new();
    
    log_info("Updating Cargo dependencies...", "DEPS");

    if dry_run {
        log_info("[DRY RUN] Would run: cargo update", "DEPS");
        return Ok(results);
    }

    let output = StdCommand::new("cargo")
        .arg("update")
        .output()
        .context("Failed to run cargo update")?;

    if output.status.success() {
        log_success("Cargo dependencies updated successfully", "DEPS");
        
        // Parse output to determine what was updated
        let output_str = String::from_utf8_lossy(&output.stderr);
        for line in output_str.lines() {
            if line.contains("Updating") {
                log_info(line, "DEPS");
            }
        }
    } else {
        let error = String::from_utf8_lossy(&output.stderr);
        log_error(&format!("Failed to update dependencies: {}", error), "DEPS");
    }

    Ok(results)
}

/// Run security audit on dependencies
pub fn audit_dependencies() -> Result<bool> {
    log_info("Running security audit...", "DEPS");

    // Check if cargo-audit is installed
    let output = StdCommand::new("cargo")
        .args(&["audit", "--version"])
        .output();

    if output.is_err() || !output.unwrap().status.success() {
        log_warn("cargo-audit not installed, skipping security audit", "DEPS");
        log_info("Install with: cargo install cargo-audit", "DEPS");
        return Ok(true);
    }

    // Run the audit
    let output = StdCommand::new("cargo")
        .arg("audit")
        .output()
        .context("Failed to run cargo audit")?;

    if output.status.success() {
        log_success("Security audit passed", "DEPS");
        Ok(true)
    } else {
        let output_str = String::from_utf8_lossy(&output.stdout);
        log_error(&format!("Security audit found issues:\n{}", output_str), "DEPS");
        Ok(false)
    }
}

/// Check license compatibility
pub fn check_licenses() -> Result<HashMap<String, String>> {
    log_info("Checking dependency licenses...", "DEPS");
    let mut licenses = HashMap::new();

    // Use cargo-license if available
    let output = StdCommand::new("cargo")
        .args(&["license", "--json"])
        .output();

    match output {
        Ok(output) if output.status.success() => {
            let json_str = String::from_utf8_lossy(&output.stdout);
            if let Ok(json) = serde_json::from_str::<Vec<serde_json::Value>>(&json_str) {
                for item in json {
                    if let (Some(name), Some(license)) = (
                        item["name"].as_str(),
                        item["license"].as_str(),
                    ) {
                        licenses.insert(name.to_string(), license.to_string());
                    }
                }
            }
        }
        _ => {
            log_warn("cargo-license not available, skipping license check", "DEPS");
            log_info("Install with: cargo install cargo-license", "DEPS");
        }
    }

    // Check for problematic licenses
    let problematic = ["GPL", "AGPL", "LGPL"];
    for (name, license) in &licenses {
        for prob in &problematic {
            if license.contains(prob) {
                log_warn(
                    &format!("{} uses {} license which may have compatibility issues", name, license),
                    "DEPS",
                );
            }
        }
    }

    Ok(licenses)
}

/// Generate dependency tree
pub fn dependency_tree() -> Result<String> {
    log_info("Generating dependency tree...", "DEPS");

    let output = StdCommand::new("cargo")
        .args(&["tree"])
        .output()
        .context("Failed to run cargo tree")?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(anyhow!(
            "Failed to generate dependency tree: {}",
            String::from_utf8_lossy(&output.stderr)
        ))
    }
}

/// Find duplicate dependencies
pub fn find_duplicate_dependencies() -> Result<HashSet<String>> {
    log_info("Finding duplicate dependencies...", "DEPS");
    let mut duplicates = HashSet::new();

    let output = StdCommand::new("cargo")
        .args(&["tree", "--duplicates"])
        .output()
        .context("Failed to run cargo tree")?;

    if output.status.success() {
        let output_str = String::from_utf8_lossy(&output.stdout);
        for line in output_str.lines() {
            if line.contains(" v") && !line.starts_with(' ') {
                if let Some(name) = line.split_whitespace().next() {
                    duplicates.insert(name.to_string());
                }
            }
        }
        
        if duplicates.is_empty() {
            log_success("No duplicate dependencies found", "DEPS");
        } else {
            log_warn(&format!("Found {} duplicate dependencies", duplicates.len()), "DEPS");
        }
    }

    Ok(duplicates)
}

/// Clean dependency cache
pub fn clean_dependency_cache() -> Result<()> {
    log_info("Cleaning dependency cache...", "DEPS");

    let output = StdCommand::new("cargo")
        .arg("clean")
        .output()
        .context("Failed to run cargo clean")?;

    if output.status.success() {
        log_success("Dependency cache cleaned", "DEPS");
        Ok(())
    } else {
        Err(anyhow!(
            "Failed to clean cache: {}",
            String::from_utf8_lossy(&output.stderr)
        ))
    }
}

/// Verify Cargo.lock integrity
pub fn verify_lockfile() -> Result<bool> {
    log_info("Verifying Cargo.lock...", "DEPS");

    let output = StdCommand::new("cargo")
        .args(&["verify-project"])
        .output()
        .context("Failed to run cargo verify-project")?;

    if output.status.success() {
        log_success("Cargo.lock verified successfully", "DEPS");
        Ok(true)
    } else {
        log_error("Cargo.lock verification failed", "DEPS");
        Ok(false)
    }
}

/// Install missing system dependencies if possible
pub async fn install_system_dependencies(deps: &[String]) -> Result<()> {
    if deps.is_empty() {
        log_info("No dependencies to install", "DEPS");
        return Ok(());
    }

    log_info(&format!("Installing {} dependencies...", deps.len()), "DEPS");

    // Detect package manager
    let package_manager = if command_exists("apt").await {
        "apt"
    } else if command_exists("dnf").await {
        "dnf"
    } else if command_exists("yum").await {
        "yum"
    } else if command_exists("pacman").await {
        "pacman"
    } else {
        return Err(anyhow!("No supported package manager found"));
    };

    log_info(&format!("Using package manager: {}", package_manager), "DEPS");

    // Map commands to package names
    let package_map: HashMap<&str, &str> = [
        ("git", "git"),
        ("make", "make"),
        ("cargo", "cargo"),
        ("rustc", "rustc"),
    ]
    .iter()
    .cloned()
    .collect();

    for dep in deps {
        let package_name = package_map
            .get(dep.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| dep.clone());
        
        let install_cmd = match package_manager {
            "apt" => vec!["sudo", "apt", "install", "-y", &package_name],
            "dnf" | "yum" => vec!["sudo", package_manager, "install", "-y", &package_name],
            "pacman" => vec!["sudo", "pacman", "-S", "--noconfirm", &package_name],
            _ => continue,
        };

        log_info(&format!("Installing {}...", package_name), "DEPS");
        let result = run_command(&install_cmd, None).await?;
        
        if result.success {
            log_success(&format!("Installed {}", package_name), "DEPS");
        } else {
            log_error(&format!("Failed to install {}: {}", package_name, result.stderr), "DEPS");
        }
    }

    Ok(())
}

/// Install Cargo extension tools
pub fn install_cargo_tools(tools: &[&str]) -> Result<()> {
    for tool in tools {
        log_info(&format!("Installing cargo-{}...", tool), "DEPS");
        
        let output = StdCommand::new("cargo")
            .args(&["install", &format!("cargo-{}", tool)])
            .output()
            .context(format!("Failed to install cargo-{}", tool))?;

        if output.status.success() {
            log_success(&format!("Installed cargo-{}", tool), "DEPS");
        } else {
            log_error(
                &format!(
                    "Failed to install cargo-{}: {}",
                    tool,
                    String::from_utf8_lossy(&output.stderr)
                ),
                "DEPS",
            );
        }
    }

    Ok(())
}

/// Check all dependencies (system and Cargo)
pub async fn check_all_dependencies() -> Result<()> {
    let timer = PerformanceTimer::new("full dependency check");

    // Check system dependencies
    check_system_dependencies().await?;

    // Check Cargo dependencies
    if Path::new("Cargo.toml").exists() {
        scan_cargo_dependencies(".")?;
        check_outdated_cargo().ok();
        audit_dependencies().ok();
        verify_lockfile().ok();
    }

    timer.finish();
    Ok(())
}
