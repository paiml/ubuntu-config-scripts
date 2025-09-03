// Tests for dependency management module
//
// This module tests dependency checking and management functionality

use std::collections::{HashMap, HashSet};
use ubuntu_config_scripts::*;

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_check_system_dependencies() {
        // This test will check for actual system commands
        // Some may be missing depending on the test environment
        let result = check_system_dependencies().await;
        
        // We expect either success (all deps found) or an error listing missing deps
        match result {
            Ok(deps) => {
                assert!(!deps.is_empty());
                // At minimum, we should find some basic commands
                assert!(deps.iter().any(|d| d == "ps"));
            }
            Err(e) => {
                // Error message should mention missing commands
                assert!(e.to_string().contains("Missing"));
            }
        }
    }

    #[test]
    fn test_scan_cargo_dependencies() {
        // Test with current project's Cargo.toml
        let result = scan_cargo_dependencies(".");
        
        match result {
            Ok(deps) => {
                // We should find at least some dependencies
                assert!(!deps.is_empty());
                
                // Check that we have both regular and dev dependencies
                let has_regular = deps.iter().any(|d| d.source == "dependencies");
                let has_dev = deps.iter().any(|d| d.source == "dev-dependencies");
                
                assert!(has_regular, "Should have regular dependencies");
                assert!(has_dev, "Should have dev dependencies");
                
                // Check specific known dependencies
                assert!(deps.iter().any(|d| d.name == "anyhow"));
                assert!(deps.iter().any(|d| d.name == "tokio"));
                assert!(deps.iter().any(|d| d.name == "serde"));
            }
            Err(e) => {
                panic!("Failed to scan dependencies: {}", e);
            }
        }
    }

    #[test]
    fn test_scan_cargo_dependencies_nonexistent() {
        // Test with non-existent directory
        let result = scan_cargo_dependencies("/nonexistent/path");
        
        // Should return empty vec when Cargo.toml doesn't exist
        match result {
            Ok(deps) => assert!(deps.is_empty()),
            Err(_) => {
                // Also acceptable if it returns an error
            }
        }
    }

    #[test]
    fn test_dependency_struct() {
        let dep = Dependency {
            name: "test-dep".to_string(),
            version: "1.0.0".to_string(),
            source: "dependencies".to_string(),
            required: true,
        };
        
        assert_eq!(dep.name, "test-dep");
        assert_eq!(dep.version, "1.0.0");
        assert_eq!(dep.source, "dependencies");
        assert!(dep.required);
    }

    #[test]
    fn test_update_result_struct() {
        let result = UpdateResult {
            name: "test-dep".to_string(),
            updated: true,
            from_version: "1.0.0".to_string(),
            to_version: Some("2.0.0".to_string()),
            error: None,
        };
        
        assert_eq!(result.name, "test-dep");
        assert!(result.updated);
        assert_eq!(result.from_version, "1.0.0");
        assert_eq!(result.to_version, Some("2.0.0".to_string()));
        assert!(result.error.is_none());
    }

    #[test]
    fn test_check_outdated_cargo() {
        // This test may or may not succeed depending on whether cargo-outdated is installed
        let result = check_outdated_cargo();
        
        match result {
            Ok(outdated) => {
                // If it succeeds, we should get a list (possibly empty)
                // The list format should be valid
                for dep in outdated {
                    assert!(!dep.name.is_empty());
                    assert!(!dep.version.is_empty());
                }
            }
            Err(_) => {
                // It's OK if this fails when cargo-outdated is not installed
            }
        }
    }

    #[test]
    fn test_update_cargo_dependencies_dry_run() {
        // Test dry run mode (should not actually update)
        let result = update_cargo_dependencies(true);
        
        assert!(result.is_ok());
        let results = result.unwrap();
        
        // In dry run, results should be empty or show what would be updated
        // but nothing should actually be updated
        for update in results {
            assert!(!update.updated || update.error.is_some());
        }
    }

    #[test]
    fn test_audit_dependencies() {
        // This test may or may not succeed depending on whether cargo-audit is installed
        let result = audit_dependencies();
        
        assert!(result.is_ok());
        // Result should be either true (audit passed) or false (issues found)
        // Both are valid outcomes
    }

    #[test]
    fn test_check_licenses() {
        // This test may or may not succeed depending on whether cargo-license is installed
        let result = check_licenses();
        
        match result {
            Ok(licenses) => {
                // If successful, we should get a map of licenses
                // Check that common licenses are reasonable
                for (_name, license) in licenses {
                    assert!(!license.is_empty());
                }
            }
            Err(_) => {
                // It's OK if this fails when cargo-license is not installed
            }
        }
    }

    #[test]
    fn test_dependency_tree() {
        // cargo tree should always be available
        let result = dependency_tree();
        
        match result {
            Ok(tree) => {
                assert!(!tree.is_empty());
                // Tree should contain the project name
                assert!(tree.contains("ubuntu-config-scripts"));
            }
            Err(e) => {
                panic!("cargo tree should be available: {}", e);
            }
        }
    }

    #[test]
    fn test_find_duplicate_dependencies() {
        // This should always work since cargo tree is built-in
        let result = find_duplicate_dependencies();
        
        assert!(result.is_ok());
        let duplicates = result.unwrap();
        
        // We may or may not have duplicates, both are valid
        // Just check that the result is a valid set
        for dup in duplicates {
            assert!(!dup.is_empty());
        }
    }

    #[test]
    fn test_verify_lockfile() {
        // This should work if Cargo.lock exists
        let result = verify_lockfile();
        
        assert!(result.is_ok());
        // Should return true or false depending on lockfile state
    }

    #[test]
    fn test_clean_dependency_cache() {
        // We don't actually want to clean the cache during tests
        // Just verify the function exists and returns a Result
        // This is more of a compilation test
        let _f: fn() -> Result<(), anyhow::Error> = clean_dependency_cache;
    }

    #[tokio::test]
    async fn test_install_system_dependencies_empty() {
        // Test with empty list
        let result = install_system_dependencies(&[]).await;
        
        assert!(result.is_ok());
    }

    #[test]
    fn test_install_cargo_tools_empty() {
        // Test with empty list
        let result = install_cargo_tools(&[]);
        
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_check_all_dependencies() {
        // This is a comprehensive check that should work
        let result = check_all_dependencies().await;
        
        // May succeed or fail depending on system state
        // Both are valid outcomes for this integration test
        match result {
            Ok(_) => {
                // Success means all deps are present
            }
            Err(e) => {
                // Error should be informative
                assert!(!e.to_string().is_empty());
            }
        }
    }

    // Property-based tests
    #[cfg(test)]
    use proptest::prelude::*;

    proptest! {
        #[test]
        fn test_dependency_creation(
            name in "[a-zA-Z][a-zA-Z0-9-_]*",
            version in "[0-9]+\\.[0-9]+\\.[0-9]+",
            required in any::<bool>()
        ) {
            let dep = Dependency {
                name: name.clone(),
                version: version.clone(),
                source: "test".to_string(),
                required,
            };
            
            prop_assert_eq!(dep.name, name);
            prop_assert_eq!(dep.version, version);
            prop_assert_eq!(dep.required, required);
        }

        #[test]
        fn test_update_result_creation(
            name in "[a-zA-Z][a-zA-Z0-9-_]*",
            updated in any::<bool>(),
            from_version in "[0-9]+\\.[0-9]+\\.[0-9]+",
            to_version in proptest::option::of("[0-9]+\\.[0-9]+\\.[0-9]+")
        ) {
            let result = UpdateResult {
                name: name.clone(),
                updated,
                from_version: from_version.clone(),
                to_version: to_version.clone(),
                error: if updated { None } else { Some("Test error".to_string()) },
            };
            
            prop_assert_eq!(result.name, name);
            prop_assert_eq!(result.updated, updated);
            prop_assert_eq!(result.from_version, from_version);
            prop_assert_eq!(result.to_version, to_version);
            
            if updated {
                prop_assert!(result.error.is_none());
            } else {
                prop_assert!(result.error.is_some());
            }
        }
    }
}