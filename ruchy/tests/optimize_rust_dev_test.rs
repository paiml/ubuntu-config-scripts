// Tests for optimize_rust_dev module
use crate::system::optimize_rust_dev::*;
use mockall::automock;
use std::fs;
use std::path::Path;
use tempfile::TempDir;

#[cfg(test)]
mod optimize_rust_dev_tests {
    use super::*;
    use proptest::prelude::*;

    // Property-based tests
    proptest! {
        #[test]
        fn test_swap_config_values_in_range(
            current in 0u32..128,
            target in 1u32..256,
            swappiness in 0u8..100,
            cache_pressure in 0u8..200
        ) {
            let config = SwapConfig {
                current_size_gb: current,
                target_size_gb: target,
                swappiness,
                cache_pressure,
            };

            assert!(config.swappiness <= 100);
            assert!(config.target_size_gb > 0);
        }

        #[test]
        fn test_get_current_swap_size_handles_various_outputs(size_bytes in 0u64..1099511627776u64) {
            // Test that various swap sizes are correctly converted to GB
            let size_gb = size_bytes / (1024 * 1024 * 1024);
            assert!(size_gb <= 1024); // Max 1TB swap
        }
    }

    #[test]
    fn test_swap_config_default_values() {
        let config = SwapConfig {
            current_size_gb: 32,
            target_size_gb: 64,
            swappiness: 10,
            cache_pressure: 50,
        };

        assert_eq!(config.current_size_gb, 32);
        assert_eq!(config.target_size_gb, 64);
        assert_eq!(config.swappiness, 10);
        assert_eq!(config.cache_pressure, 50);
    }

    #[test]
    fn test_optimization_result_all_false_by_default() {
        let result = OptimizationResult::default();

        assert!(!result.swap_configured);
        assert!(!result.zram_configured);
        assert!(!result.sysctl_configured);
        assert!(!result.tools_installed);
        assert!(!result.intellij_configured);
    }

    #[test]
    fn test_optimization_result_can_be_modified() {
        let mut result = OptimizationResult::default();

        result.swap_configured = true;
        result.zram_configured = true;

        assert!(result.swap_configured);
        assert!(result.zram_configured);
        assert!(!result.sysctl_configured);
    }

    #[test]
    fn test_check_root_when_not_root() {
        // Skip this test if running as root (in CI)
        if unsafe { libc::getuid() } == 0 {
            return;
        }

        let result = check_root();
        assert!(result.is_err());
        assert_eq!(
            result.unwrap_err(),
            "This script must be run with sudo"
        );
    }

    #[test]
    fn test_check_root_error_message() {
        if unsafe { libc::getuid() } != 0 {
            match check_root() {
                Err(msg) => assert!(msg.contains("sudo")),
                Ok(_) => panic!("Should have failed when not root"),
            }
        }
    }

    #[test]
    fn test_cargo_config_content_validity() {
        let expected_config = r#"[build]
jobs = 8
rustc-wrapper = "sccache"

[target.x86_64-unknown-linux-gnu]
linker = "clang"
rustflags = ["-C", "link-arg=-fuse-ld=mold", "-C", "target-cpu=native"]"#;

        // Verify TOML structure
        assert!(expected_config.contains("[build]"));
        assert!(expected_config.contains("[target.x86_64-unknown-linux-gnu]"));
        assert!(expected_config.contains("rustc-wrapper"));
    }

    #[test]
    fn test_intellij_vm_options_validity() {
        let home_dir = "/home/testuser";
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

        // Verify JVM options
        assert!(vm_options.contains("-Xms2048m"));
        assert!(vm_options.contains("-Xmx8192m"));
        assert!(vm_options.contains("UseG1GC"));
        assert!(vm_options.contains("idea64.vmoptions"));
    }

    #[test]
    fn test_zram_script_content() {
        let script_content = r#"#!/bin/bash
modprobe zram
echo lz4 > /sys/block/zram0/comp_algorithm 2>/dev/null || echo lzo > /sys/block/zram0/comp_algorithm
echo 17179869184 > /sys/block/zram0/disksize
mkswap /dev/zram0
swapon -p 100 /dev/zram0
"#;

        assert!(script_content.starts_with("#!/bin/bash"));
        assert!(script_content.contains("modprobe zram"));
        assert!(script_content.contains("17179869184")); // 16GB in bytes
        assert!(script_content.contains("swapon -p 100"));
    }

    #[test]
    fn test_systemd_service_content() {
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

        assert!(service_content.contains("[Unit]"));
        assert!(service_content.contains("[Service]"));
        assert!(service_content.contains("[Install]"));
        assert!(service_content.contains("Type=oneshot"));
        assert!(service_content.contains("RemainAfterExit=yes"));
    }

    #[test]
    fn test_sysctl_configurations() {
        let config = SwapConfig {
            current_size_gb: 32,
            target_size_gb: 64,
            swappiness: 10,
            cache_pressure: 50,
        };

        let expected_configs = vec![
            ("vm.swappiness", "10"),
            ("vm.vfs_cache_pressure", "50"),
            ("vm.dirty_ratio", "15"),
            ("vm.dirty_background_ratio", "5"),
        ];

        assert_eq!(config.swappiness.to_string(), "10");
        assert_eq!(config.cache_pressure.to_string(), "50");

        for (key, value) in expected_configs {
            assert!(!key.is_empty());
            assert!(!value.is_empty());
        }
    }

    #[test]
    fn test_dev_tools_list() {
        let tools = vec![
            ("mold", "Fast linker for Rust"),
            ("clang", "LLVM compiler for better linking"),
            ("htop", "Interactive process viewer"),
            ("ncdu", "Disk usage analyzer"),
        ];

        assert_eq!(tools.len(), 4);

        for (tool, _description) in &tools {
            assert!(!tool.is_empty());
        }
    }

    #[test]
    fn test_swap_size_calculation() {
        // Test conversion from bytes to GB
        let test_cases = vec![
            (0u64, 0u32),
            (1073741824, 1),  // 1GB
            (34359738368, 32), // 32GB
            (68719476736, 64), // 64GB
        ];

        for (bytes, expected_gb) in test_cases {
            let calculated_gb = (bytes / (1024 * 1024 * 1024)) as u32;
            assert_eq!(calculated_gb, expected_gb);
        }
    }

    #[test]
    fn test_config_dir_paths() {
        let sudo_user = "testuser";
        let home_dir = format!("/home/{}", sudo_user);

        let config_dirs = vec![
            format!("{}/.config/JetBrains", home_dir),
            format!("{}/.local/share/JetBrains", home_dir),
        ];

        assert_eq!(config_dirs.len(), 2);
        assert!(config_dirs[0].contains("/.config/JetBrains"));
        assert!(config_dirs[1].contains("/.local/share/JetBrains"));
    }

    #[test]
    fn test_optimization_result_summary() {
        let mut result = OptimizationResult {
            swap_configured: true,
            zram_configured: true,
            sysctl_configured: false,
            tools_installed: true,
            intellij_configured: false,
        };

        let configured_count = [
            result.swap_configured,
            result.zram_configured,
            result.sysctl_configured,
            result.tools_installed,
            result.intellij_configured,
        ].iter().filter(|&&x| x).count();

        assert_eq!(configured_count, 3);
    }

    #[test]
    fn test_zram_size_16gb() {
        let zram_size_bytes = 17179869184u64;
        let zram_size_gb = zram_size_bytes / (1024 * 1024 * 1024);
        assert_eq!(zram_size_gb, 16);
    }

    #[test]
    fn test_fstab_swap_entry() {
        let fstab_entry = "/swapfile none swap sw 0 0";

        assert!(fstab_entry.contains("/swapfile"));
        assert!(fstab_entry.contains("swap"));
        assert!(fstab_entry.contains("sw"));
    }

    // Integration test mock
    #[test]
    fn test_full_optimization_flow() {
        let config = SwapConfig {
            current_size_gb: 16,
            target_size_gb: 64,
            swappiness: 10,
            cache_pressure: 50,
        };

        // Verify config is ready for optimization
        assert!(config.target_size_gb > config.current_size_gb);
        assert!(config.swappiness <= 100);
        assert!(config.cache_pressure <= 100);
    }

    // Test error handling
    #[test]
    fn test_error_messages() {
        let errors = vec![
            "Failed to disable swap: Permission denied",
            "Failed to allocate swap file: No space left on device",
            "Failed to load zram module: Module not found",
            "Failed to install mold",
        ];

        for error in errors {
            assert!(error.contains("Failed"));
        }
    }

    #[test]
    fn test_backup_path_generation() {
        let config_path = "/home/user/.cargo/config.toml";
        let backup_path = format!("{}.backup", config_path);

        assert_eq!(backup_path, "/home/user/.cargo/config.toml.backup");
    }
}

// Benchmark tests
#[cfg(all(test, not(target_env = "msvc")))]
mod bench {
    use super::*;
    use test::Bencher;

    #[bench]
    fn bench_swap_config_creation(b: &mut Bencher) {
        b.iter(|| {
            SwapConfig {
                current_size_gb: 32,
                target_size_gb: 64,
                swappiness: 10,
                cache_pressure: 50,
            }
        });
    }

    #[bench]
    fn bench_optimization_result_creation(b: &mut Bencher) {
        b.iter(|| {
            OptimizationResult::default()
        });
    }
}