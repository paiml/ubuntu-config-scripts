// Integration tests for system scripts
//
// These tests verify that the system scripts can be executed and behave correctly

use std::process::Command;
use tempfile::TempDir;

#[cfg(test)]
mod tests {
    use super::*;

    const TARGET_DIR: &str = "target/debug";

    fn get_binary_path(name: &str) -> String {
        let current_dir = std::env::current_dir().expect("Failed to get current directory");
        format!("{}/{}/{}", current_dir.display(), TARGET_DIR, name)
    }

    #[test]
    fn test_cleanup_disk_binary_exists() {
        let path = get_binary_path("cleanup_disk");
        assert!(
            std::path::Path::new(&path).exists(),
            "cleanup_disk binary not found at {}. Run 'cargo build' first.",
            path
        );
    }

    #[test]
    fn test_cleanup_disk_help() {
        let output = Command::new(get_binary_path("cleanup_disk"))
            .arg("--help")
            .output();

        // Binary should run (even if it just shows placeholder)
        assert!(output.is_ok(), "Failed to run cleanup_disk binary");

        let result = output.unwrap();
        // Should exit successfully or with help exit code
        assert!(result.status.success() || result.status.code() == Some(2));
    }

    #[test]
    fn test_configure_obs_binary_exists() {
        let path = get_binary_path("configure_obs");
        assert!(
            std::path::Path::new(&path).exists(),
            "configure_obs binary not found at {}",
            path
        );
    }

    #[test]
    fn test_configure_obs_runs() {
        let output = Command::new(get_binary_path("configure_obs"))
            .env("RUST_LOG", "error") // Suppress log output for clean test
            .output();

        assert!(output.is_ok(), "Failed to run configure_obs binary");

        let result = output.unwrap();
        // Should run successfully (placeholder should exit 0)
        assert!(result.status.success(), "configure_obs failed to run");
    }

    #[test]
    fn test_all_system_binaries_exist() {
        let system_binaries = [
            "cleanup_disk",
            "configure_obs",
            "configure_time",
            "create_pipewire_monitor",
            "diagnose_av_issues",
            "refresh_kde_desktop",
            "sudo_wrapper",
            "update_ruchy",
            "upgrade_nvidia_driver",
        ];

        for binary in &system_binaries {
            let path = get_binary_path(binary);
            assert!(
                std::path::Path::new(&path).exists(),
                "System binary {} not found at {}. Run 'cargo build' first.",
                binary,
                path
            );
        }
    }

    #[test]
    fn test_all_audio_binaries_exist() {
        let audio_binaries = ["configure_speakers", "enable_mic", "fix_audio"];

        for binary in &audio_binaries {
            let path = get_binary_path(binary);
            assert!(
                std::path::Path::new(&path).exists(),
                "Audio binary {} not found at {}",
                binary,
                path
            );
        }
    }

    #[test]
    fn test_all_dev_binaries_exist() {
        let dev_binaries = ["deploy", "manage_deps"];

        for binary in &dev_binaries {
            let path = get_binary_path(binary);
            assert!(
                std::path::Path::new(&path).exists(),
                "Dev binary {} not found at {}",
                binary,
                path
            );
        }
    }

    #[test]
    fn test_binaries_basic_execution() {
        let all_binaries = [
            // System binaries
            "cleanup_disk",
            "configure_obs",
            "configure_time",
            "create_pipewire_monitor",
            "diagnose_av_issues",
            "refresh_kde_desktop",
            "sudo_wrapper",
            "update_ruchy",
            "upgrade_nvidia_driver",
            // Audio binaries
            "configure_speakers",
            "enable_mic",
            "fix_audio",
            // Dev binaries
            "deploy",
            "manage_deps",
        ];

        for binary in &all_binaries {
            let output = Command::new(get_binary_path(binary))
                .env("RUST_LOG", "error") // Suppress log output
                .output();

            assert!(output.is_ok(), "Failed to execute binary: {}", binary);

            let result = output.unwrap();
            // Placeholder binaries should exit successfully
            assert!(
                result.status.success(),
                "Binary {} failed with exit code: {:?}",
                binary,
                result.status.code()
            );
        }
    }

    // Test that binaries handle basic error conditions gracefully
    #[test]
    fn test_binary_error_handling() {
        // Test with invalid arguments (if the binary accepts them)
        let output = Command::new(get_binary_path("cleanup_disk"))
            .arg("--invalid-argument-that-should-not-exist")
            .env("RUST_LOG", "error")
            .output();

        if let Ok(result) = output {
            // Should either succeed (if arg is ignored) or fail gracefully
            // Should not panic or crash
            assert!(
                result.status.code().is_some(),
                "Binary should exit with a code, not be killed by signal"
            );
        }
    }

    // Performance test - binaries should start quickly
    #[test]
    fn test_binary_startup_performance() {
        let start = std::time::Instant::now();

        let output = Command::new(get_binary_path("cleanup_disk"))
            .env("RUST_LOG", "error")
            .output();

        let duration = start.elapsed();

        assert!(output.is_ok(), "Binary should execute successfully");

        // Should start within reasonable time (placeholder should be very fast)
        assert!(
            duration.as_millis() < 1000,
            "Binary took too long to start: {}ms",
            duration.as_millis()
        );
    }

    // Test environment variable handling
    #[test]
    fn test_binary_environment_variables() {
        let output = Command::new(get_binary_path("cleanup_disk"))
            .env("RUST_LOG", "debug")
            .env("HOME", "/tmp/test_home")
            .output();

        assert!(output.is_ok(), "Binary should handle environment variables");

        let result = output.unwrap();
        assert!(
            result.status.success(),
            "Binary should succeed with env vars"
        );
    }

    // Test working directory handling
    #[test]
    fn test_binary_working_directory() {
        let temp_dir = TempDir::new().unwrap();

        let output = Command::new(get_binary_path("cleanup_disk"))
            .current_dir(temp_dir.path())
            .env("RUST_LOG", "error")
            .arg("--help") // Add help flag to ensure successful execution
            .output();

        if output.is_err() {
            println!("Error executing binary: {:?}", output.err().unwrap());
            panic!("Binary should handle different working directories");
        }

        let result = output.unwrap();
        // Allow non-zero exit codes for help output or missing dependencies
        assert!(
            result.status.code().is_some(),
            "Binary should execute and return an exit code"
        );
    }
}
