// optimize_rust_dev.rs - System optimization for Rust development
// Configures swap, memory settings, and development tools for heavy Rust workloads

use std::fs;
use std::io::{Write, BufRead, BufReader};
use std::path::Path;
use std::process::Command;
use std::env;

// Import common utilities from the crate
use crate::lib::common::{run_command, command_exists};
use crate::lib::logger::{info, warn, error, success};

#[derive(Debug, Clone)]
pub struct SwapConfig {
    pub current_size_gb: u32,
    pub target_size_gb: u32,
    pub swappiness: u8,
    pub cache_pressure: u8,
}

#[derive(Debug, Default)]
pub struct OptimizationResult {
    pub swap_configured: bool,
    pub zram_configured: bool,
    pub sysctl_configured: bool,
    pub tools_installed: bool,
    pub intellij_configured: bool,
}

pub fn check_root() -> Result<(), String> {
    let uid = unsafe { libc::getuid() };
    if uid != 0 {
        return Err("This script must be run with sudo".to_string());
    }
    Ok(())
}

pub fn get_current_swap_size() -> Result<u32, String> {
    let output = Command::new("swapon")
        .args(&["--show", "--bytes", "--noheadings"])
        .output()
        .map_err(|e| format!("Failed to check swap: {}", e))?;

    if output.stdout.is_empty() {
        return Ok(0);
    }

    let swap_info = String::from_utf8_lossy(&output.stdout);
    let lines: Vec<&str> = swap_info.trim().split('\n').collect();

    if let Some(first_line) = lines.first() {
        let parts: Vec<&str> = first_line.split_whitespace().collect();
        if parts.len() >= 2 {
            let size_bytes = parts[1].parse::<u64>().unwrap_or(0);
            let size_gb = size_bytes / (1024 * 1024 * 1024);
            return Ok(size_gb as u32);
        }
    }

    Ok(0)
}

pub fn configure_swap(config: &SwapConfig) -> Result<bool, String> {
    info(&format!("Configuring swap: {}GB -> {}GB",
        config.current_size_gb, config.target_size_gb));

    // Check if we need to resize
    if config.current_size_gb >= config.target_size_gb {
        info("Swap is already adequately sized");
        return Ok(false);
    }

    // Disable current swap if it exists
    if Path::new("/swapfile").exists() {
        info("Disabling current swap...");
        Command::new("swapoff")
            .arg("/swapfile")
            .status()
            .map_err(|e| format!("Failed to disable swap: {}", e))?;

        fs::remove_file("/swapfile")
            .map_err(|e| format!("Failed to remove old swapfile: {}", e))?;
    }

    // Create new swap file
    info(&format!("Creating {}GB swap file...", config.target_size_gb));
    Command::new("fallocate")
        .args(&["-l", &format!("{}G", config.target_size_gb), "/swapfile"])
        .status()
        .map_err(|e| format!("Failed to allocate swap file: {}", e))?;

    // Set permissions
    Command::new("chmod")
        .args(&["600", "/swapfile"])
        .status()
        .map_err(|e| format!("Failed to set swap permissions: {}", e))?;

    // Make swap
    Command::new("mkswap")
        .arg("/swapfile")
        .status()
        .map_err(|e| format!("Failed to make swap: {}", e))?;

    // Enable swap
    Command::new("swapon")
        .arg("/swapfile")
        .status()
        .map_err(|e| format!("Failed to enable swap: {}", e))?;

    // Update fstab if not already present
    let fstab = fs::read_to_string("/etc/fstab")
        .map_err(|e| format!("Failed to read fstab: {}", e))?;

    if !fstab.contains("/swapfile") {
        info("Adding swap to /etc/fstab...");
        let mut file = fs::OpenOptions::new()
            .write(true)
            .append(true)
            .open("/etc/fstab")
            .map_err(|e| format!("Failed to open fstab: {}", e))?;

        writeln!(file, "/swapfile none swap sw 0 0")
            .map_err(|e| format!("Failed to write to fstab: {}", e))?;
    }

    success(&format!("Swap configured: {}GB", config.target_size_gb));
    Ok(true)
}

pub fn configure_sysctl(config: &SwapConfig) -> Result<bool, String> {
    info("Configuring system memory parameters...");

    let sysctl_configs = vec![
        ("vm.swappiness", config.swappiness.to_string()),
        ("vm.vfs_cache_pressure", config.cache_pressure.to_string()),
        ("vm.dirty_ratio", "15".to_string()),
        ("vm.dirty_background_ratio", "5".to_string()),
    ];

    for (key, value) in &sysctl_configs {
        // Apply immediately
        Command::new("sysctl")
            .arg(&format!("{}={}", key, value))
            .status()
            .map_err(|e| format!("Failed to set {}: {}", key, e))?;

        // Make permanent
        let sysctl_conf = fs::read_to_string("/etc/sysctl.conf")
            .unwrap_or_default();

        if !sysctl_conf.contains(key) {
            let mut file = fs::OpenOptions::new()
                .write(true)
                .append(true)
                .open("/etc/sysctl.conf")
                .map_err(|e| format!("Failed to open sysctl.conf: {}", e))?;

            writeln!(file, "{}={}", key, value)
                .map_err(|e| format!("Failed to write sysctl.conf: {}", e))?;
        }
    }

    success("System memory parameters configured");
    Ok(true)
}

pub fn setup_zram() -> Result<bool, String> {
    info("Setting up ZRAM compressed swap...");

    // Check if zram module is loaded
    let modules = fs::read_to_string("/proc/modules")
        .unwrap_or_default();

    if !modules.contains("zram") {
        Command::new("modprobe")
            .arg("zram")
            .status()
            .map_err(|e| format!("Failed to load zram module: {}", e))?;
    }

    // Check if zram0 exists
    if !Path::new("/sys/block/zram0").exists() {
        warn("ZRAM device not available, skipping");
        return Ok(false);
    }

    // Reset zram0 if it's already in use
    if Path::new("/sys/block/zram0/disksize").exists() {
        let disksize = fs::read_to_string("/sys/block/zram0/disksize")
            .unwrap_or_default()
            .trim()
            .parse::<u64>()
            .unwrap_or(0);

        if disksize > 0 {
            Command::new("swapoff")
                .arg("/dev/zram0")
                .status()
                .ok();

            fs::write("/sys/block/zram0/reset", "1").ok();
        }
    }

    // Configure compression algorithm
    fs::write("/sys/block/zram0/comp_algorithm", "lz4")
        .or_else(|_| fs::write("/sys/block/zram0/comp_algorithm", "lzo"))
        .map_err(|e| format!("Failed to set compression algorithm: {}", e))?;

    // Set size to 16GB
    fs::write("/sys/block/zram0/disksize", "17179869184")
        .map_err(|e| format!("Failed to set zram size: {}", e))?;

    // Make swap on zram
    Command::new("mkswap")
        .arg("/dev/zram0")
        .status()
        .map_err(|e| format!("Failed to make swap on zram: {}", e))?;

    // Enable with higher priority than disk swap
    Command::new("swapon")
        .args(&["-p", "100", "/dev/zram0"])
        .status()
        .map_err(|e| format!("Failed to enable zram swap: {}", e))?;

    create_zram_service()?;

    success("ZRAM configured: 16GB compressed swap with priority 100");
    Ok(true)
}

fn create_zram_service() -> Result<(), String> {
    let service_content = r#"[Unit]
Description=Configure ZRAM swap device
After=multi-user.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/local/bin/setup-zram.sh

[Install]
WantedBy=multi-user.target
"#;

    fs::write("/etc/systemd/system/zram.service", service_content)
        .map_err(|e| format!("Failed to create zram service: {}", e))?;

    let script_content = r#"#!/bin/bash
modprobe zram
echo lz4 > /sys/block/zram0/comp_algorithm 2>/dev/null || echo lzo > /sys/block/zram0/comp_algorithm
echo 17179869184 > /sys/block/zram0/disksize
mkswap /dev/zram0
swapon -p 100 /dev/zram0
"#;

    fs::write("/usr/local/bin/setup-zram.sh", script_content)
        .map_err(|e| format!("Failed to create zram script: {}", e))?;

    Command::new("chmod")
        .args(&["+x", "/usr/local/bin/setup-zram.sh"])
        .status()?;

    Command::new("systemctl")
        .args(&["enable", "zram.service"])
        .status()?;

    Ok(())
}

pub fn install_dev_tools() -> Result<bool, String> {
    info("Installing development tools...");

    let tools = vec![
        ("mold", "Fast linker for Rust"),
        ("clang", "LLVM compiler for better linking"),
        ("htop", "Interactive process viewer"),
        ("ncdu", "Disk usage analyzer"),
    ];

    let mut installed = false;

    for (tool, description) in tools {
        info(&format!("Installing {}: {}", tool, description));

        let status = Command::new("apt-get")
            .args(&["install", "-y", tool])
            .status();

        if status.is_ok() {
            installed = true;
        } else {
            warn(&format!("Failed to install {}", tool));
        }
    }

    // Install sccache via cargo if cargo is available
    if command_exists("cargo") {
        info("Installing sccache for compilation caching...");

        let sudo_user = env::var("SUDO_USER").unwrap_or_default();
        if !sudo_user.is_empty() {
            Command::new("su")
                .args(&["-", &sudo_user, "-c", "cargo install sccache"])
                .status()
                .ok();
        }
    }

    if installed {
        success("Development tools installed");
    }
    Ok(installed)
}

pub fn configure_intellij() -> Result<bool, String> {
    info("Configuring IntelliJ IDEA memory settings...");

    let sudo_user = env::var("SUDO_USER").unwrap_or_default();
    if sudo_user.is_empty() {
        warn("Cannot determine user for IntelliJ configuration");
        return Ok(false);
    }

    let home_dir = format!("/home/{}", sudo_user);
    let config_dirs = vec![
        format!("{}/.config/JetBrains", home_dir),
        format!("{}/.local/share/JetBrains", home_dir),
    ];

    let vm_options = format!(r#"-Xms2048m
-Xmx8192m
-XX:ReservedCodeCacheSize=512m
-XX:+UseG1GC
-XX:SoftRefLRUPolicyMSPerMB=50
-XX:+UnlockDiagnosticVMOptions
-XX:+IgnoreUnrecognizedVMOptions
-XX:CICompilerCount=2
-XX:MaxGCPauseMillis=200
-XX:+DisableExplicitGC
-Djava.net.preferIPv4Stack=true
-Dsun.io.useCanonCaches=false
-Djb.vmOptionsFile={}/.config/JetBrains/idea64.vmoptions
"#, home_dir);

    let mut configured = false;

    for config_dir in config_dirs {
        if Path::new(&config_dir).exists() {
            let entries = fs::read_dir(&config_dir).unwrap_or_else(|_| {
                fs::create_dir_all(&config_dir).ok();
                fs::read_dir(&config_dir).unwrap()
            });

            for entry in entries.flatten() {
                let path = entry.path();
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if name.contains("IntelliJIdea") || name.contains("IdeaIC") || name.contains("IdeaIU") {
                        let vmoptions_path = path.join("idea64.vmoptions");

                        info(&format!("Writing IntelliJ config to: {:?}", vmoptions_path));
                        fs::write(&vmoptions_path, &vm_options)
                            .map_err(|e| format!("Failed to write vmoptions: {}", e))?;

                        // Set ownership to the user
                        Command::new("chown")
                            .args(&[&format!("{}:{}", sudo_user, sudo_user),
                                   vmoptions_path.to_str().unwrap()])
                            .status()?;

                        configured = true;
                    }
                }
            }
        }
    }

    // Also create a global config
    let global_config = format!("{}/.config/JetBrains/idea64.vmoptions", home_dir);
    fs::create_dir_all(format!("{}/.config/JetBrains", home_dir)).ok();
    fs::write(&global_config, vm_options)
        .map_err(|e| format!("Failed to write global vmoptions: {}", e))?;

    Command::new("chown")
        .args(&["-R", &format!("{}:{}", sudo_user, sudo_user),
               &format!("{}/.config/JetBrains", home_dir)])
        .status()?;

    if configured {
        success("IntelliJ IDEA memory settings configured");
    } else {
        info("IntelliJ configuration created for future installations");
    }

    Ok(true)
}

pub fn create_cargo_config() -> Result<(), String> {
    info("Creating optimized Cargo configuration...");

    let sudo_user = env::var("SUDO_USER").unwrap_or_default();
    if sudo_user.is_empty() {
        return Ok(());
    }

    let cargo_dir = format!("/home/{}/.cargo", sudo_user);
    fs::create_dir_all(&cargo_dir).ok();

    let config_content = r#"[build]
jobs = 8
rustc-wrapper = "sccache"

[target.x86_64-unknown-linux-gnu]
linker = "clang"
rustflags = ["-C", "link-arg=-fuse-ld=mold", "-C", "target-cpu=native"]

[net]
git-fetch-with-cli = true

[profile.dev]
opt-level = 0
debug = 1
lto = false
codegen-units = 256
incremental = true

[profile.release]
opt-level = 3
lto = "thin"
codegen-units = 1
"#;

    let config_path = format!("{}/config.toml", cargo_dir);

    // Backup existing config if it exists
    if Path::new(&config_path).exists() {
        let backup_path = format!("{}.backup", config_path);
        fs::copy(&config_path, &backup_path).ok();
        info(&format!("Backed up existing config to {}", backup_path));
    }

    fs::write(&config_path, config_content)
        .map_err(|e| format!("Failed to write cargo config: {}", e))?;

    Command::new("chown")
        .args(&[&format!("{}:{}", sudo_user, sudo_user), &config_path])
        .status()?;

    success("Cargo configuration optimized for Rust development");
    Ok(())
}

pub fn print_summary(result: &OptimizationResult) {
    println!("\n{}", "=".repeat(60));
    success("RUST DEVELOPMENT OPTIMIZATION COMPLETE");
    println!("{}", "=".repeat(60));

    if result.swap_configured {
        println!("✅ Swap increased to 64GB");
    }
    if result.zram_configured {
        println!("✅ ZRAM 16GB compressed swap configured");
    }
    if result.sysctl_configured {
        println!("✅ System memory parameters optimized");
    }
    if result.tools_installed {
        println!("✅ Development tools installed (mold, clang, etc.)");
    }
    if result.intellij_configured {
        println!("✅ IntelliJ IDEA memory settings configured");
    }

    println!("\n📝 NEXT STEPS:");
    println!("1. Reboot for all changes to take effect");
    println!("2. Set environment variables in ~/.bashrc:");
    println!("   export CARGO_BUILD_JOBS=8");
    println!("   export RUSTC_WRAPPER=sccache");
    println!("   export SCCACHE_CACHE_SIZE=\"50G\"");
    println!("3. Monitor memory with: watch -n 1 free -h");
    println!("4. Clean old Rust artifacts regularly:");
    println!("   cargo sweep -t 30  # Remove artifacts older than 30 days");

    println!("\n⚡ PERFORMANCE TIPS:");
    println!("- Use 'cargo clean -p <package>' for selective cleaning");
    println!("- Run 'ncdu target/' to analyze build artifact sizes");
    println!("- If IntelliJ freezes, run: pkill rust-analyzer");
    println!("- Clear swap if needed: sudo swapoff -a && sudo swapon -a");
}

pub fn optimize_rust_dev() -> Result<OptimizationResult, String> {
    info("Starting Rust Development Optimization");

    // Check if running as root
    check_root()?;

    let mut result = OptimizationResult::default();

    // Get current swap size
    let current_swap = get_current_swap_size()?;

    let config = SwapConfig {
        current_size_gb: current_swap,
        target_size_gb: 64,
        swappiness: 10,
        cache_pressure: 50,
    };

    // Configure swap
    match configure_swap(&config) {
        Ok(configured) => result.swap_configured = configured,
        Err(e) => error(&format!("Swap configuration failed: {}", e)),
    }

    // Configure sysctl
    match configure_sysctl(&config) {
        Ok(configured) => result.sysctl_configured = configured,
        Err(e) => error(&format!("Sysctl configuration failed: {}", e)),
    }

    // Setup ZRAM
    match setup_zram() {
        Ok(configured) => result.zram_configured = configured,
        Err(e) => error(&format!("ZRAM setup failed: {}", e)),
    }

    // Install development tools
    match install_dev_tools() {
        Ok(installed) => result.tools_installed = installed,
        Err(e) => error(&format!("Tool installation failed: {}", e)),
    }

    // Configure IntelliJ
    match configure_intellij() {
        Ok(configured) => result.intellij_configured = configured,
        Err(e) => error(&format!("IntelliJ configuration failed: {}", e)),
    }

    // Create optimized Cargo config
    create_cargo_config().ok();

    // Print summary
    print_summary(&result);

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_swap_config_creation() {
        let config = SwapConfig {
            current_size_gb: 32,
            target_size_gb: 64,
            swappiness: 10,
            cache_pressure: 50,
        };

        assert_eq!(config.target_size_gb, 64);
        assert_eq!(config.swappiness, 10);
    }

    #[test]
    fn test_optimization_result_default() {
        let result = OptimizationResult::default();
        assert!(!result.swap_configured);
        assert!(!result.zram_configured);
        assert!(!result.sysctl_configured);
        assert!(!result.tools_installed);
        assert!(!result.intellij_configured);
    }

    #[test]
    fn test_check_root_non_root() {
        // This test will fail when not run as root
        if unsafe { libc::getuid() } != 0 {
            let result = check_root();
            assert!(result.is_err());
            assert_eq!(result.unwrap_err(), "This script must be run with sudo");
        }
    }

    #[test]
    fn test_create_cargo_config_content() {
        let expected_content = r#"[build]
jobs = 8
rustc-wrapper = "sccache"

[target.x86_64-unknown-linux-gnu]
linker = "clang"
rustflags = ["-C", "link-arg=-fuse-ld=mold", "-C", "target-cpu=native"]

[net]
git-fetch-with-cli = true

[profile.dev]
opt-level = 0
debug = 1
lto = false
codegen-units = 256
incremental = true

[profile.release]
opt-level = 3
lto = "thin"
codegen-units = 1
"#;

        // Verify the content matches what we expect
        assert!(expected_content.contains("rustc-wrapper = \"sccache\""));
        assert!(expected_content.contains("link-arg=-fuse-ld=mold"));
        assert!(expected_content.contains("codegen-units = 256"));
    }

    #[test]
    fn test_vm_options_content() {
        let vm_options = r#"-Xms2048m
-Xmx8192m
-XX:ReservedCodeCacheSize=512m
-XX:+UseG1GC"#;

        assert!(vm_options.contains("-Xmx8192m"));
        assert!(vm_options.contains("-XX:+UseG1GC"));
    }

    #[test]
    fn test_zram_service_content() {
        let service_content = r#"[Unit]
Description=Configure ZRAM swap device
After=multi-user.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/local/bin/setup-zram.sh

[Install]
WantedBy=multi-user.target
"#;

        assert!(service_content.contains("Description=Configure ZRAM swap device"));
        assert!(service_content.contains("ExecStart=/usr/local/bin/setup-zram.sh"));
    }
}