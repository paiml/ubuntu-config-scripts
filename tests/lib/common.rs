// Tests for common utilities module
//
// This module tests all the utility functions in the common library
// using both unit tests and property-based testing

use proptest::prelude::*;
use tempfile::TempDir;
use ubuntu_config_scripts::*;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_args_empty() {
        let args: Vec<String> = vec![];
        let result = parse_args_from_vec(&args);
        assert!(result.is_empty());
    }

    #[test]
    fn test_parse_args_single_flag() {
        let args = vec!["--verbose".to_string()];
        let result = parse_args_from_vec(&args);
        assert_eq!(result.get("verbose"), Some(&"true".to_string()));
    }

    #[test]
    fn test_parse_args_key_value() {
        let args = vec!["--output".to_string(), "/tmp/test".to_string()];
        let result = parse_args_from_vec(&args);
        assert_eq!(result.get("output"), Some(&"/tmp/test".to_string()));
    }

    #[test]
    fn test_parse_args_key_equals_value() {
        let args = vec!["--config=/etc/test.conf".to_string()];
        let result = parse_args_from_vec(&args);
        assert_eq!(result.get("config"), Some(&"/etc/test.conf".to_string()));
    }

    #[test]
    fn test_parse_args_short_flag() {
        let args = vec!["-v".to_string()];
        let result = parse_args_from_vec(&args);
        assert_eq!(result.get("v"), Some(&"true".to_string()));
    }

    #[test]
    fn test_parse_args_mixed() {
        let args = vec![
            "--verbose".to_string(),
            "--output".to_string(),
            "/tmp/test".to_string(),
            "-f".to_string(),
            "--config=test.conf".to_string(),
        ];
        let result = parse_args_from_vec(&args);

        assert_eq!(result.get("verbose"), Some(&"true".to_string()));
        assert_eq!(result.get("output"), Some(&"/tmp/test".to_string()));
        assert_eq!(result.get("f"), Some(&"true".to_string()));
        assert_eq!(result.get("config"), Some(&"test.conf".to_string()));
    }

    #[test]
    fn test_file_exists() {
        // Test with a file that should exist
        assert!(file_exists("/etc/passwd"));

        // Test with a file that shouldn't exist
        assert!(!file_exists("/nonexistent/file/path"));
    }

    #[test]
    fn test_get_env_or_default() {
        // Test with existing environment variable
        std::env::set_var("TEST_VAR", "test_value");
        assert_eq!(get_env_or_default("TEST_VAR", "default"), "test_value");

        // Test with non-existing environment variable
        assert_eq!(get_env_or_default("NONEXISTENT_VAR", "default"), "default");

        // Cleanup
        std::env::remove_var("TEST_VAR");
    }

    #[tokio::test]
    async fn test_command_exists() {
        // Test with a command that should exist
        assert!(command_exists("echo").await);

        // Test with a command that shouldn't exist
        assert!(!command_exists("nonexistent_command_12345").await);
    }

    #[tokio::test]
    async fn test_run_command_success() {
        let result = run_command(&["echo", "hello", "world"], None)
            .await
            .unwrap();

        assert!(result.success);
        assert_eq!(result.code, 0);
        assert_eq!(result.stdout.trim(), "hello world");
        assert!(result.stderr.is_empty());
    }

    #[tokio::test]
    async fn test_run_command_failure() {
        let result = run_command(&["false"], None).await.unwrap();

        assert!(!result.success);
        assert_eq!(result.code, 1);
    }

    #[tokio::test]
    async fn test_run_command_empty() {
        let result = run_command(&[], None).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_with_temp_dir() {
        let temp_path = with_temp_dir(|path| async move {
            assert!(std::path::Path::new(&path).exists());
            Ok(path.clone())
        })
        .await
        .unwrap();

        // Directory should be cleaned up after the closure
        assert!(!std::path::Path::new(&temp_path).exists());
    }

    #[test]
    fn test_ensure_dir() {
        let temp_dir = TempDir::new().unwrap();
        let test_path = temp_dir.path().join("test_dir").join("subdir");
        let test_path_str = test_path.to_str().unwrap();

        // Directory shouldn't exist initially
        assert!(!test_path.exists());

        // Create directory
        ensure_dir(test_path_str).unwrap();

        // Directory should now exist
        assert!(test_path.exists());
    }

    // Property-based tests
    proptest! {
        #[test]
        fn test_parse_args_property_empty_input_produces_empty_output(
            args in prop::collection::vec(prop::string::string_regex("[a-zA-Z0-9_-]*").unwrap(), 0..=0)
        ) {
            let result = parse_args_from_vec(&args);
            prop_assert!(result.is_empty());
        }

        #[test]
        fn test_parse_args_property_flag_args_become_true(
            flag_name in "[a-zA-Z][a-zA-Z0-9_-]*"
        ) {
            let args = vec![format!("--{}", flag_name)];
            let result = parse_args_from_vec(&args);
            prop_assert_eq!(result.get(&flag_name), Some(&"true".to_string()));
        }

        #[test]
        fn test_parse_args_property_key_value_preservation(
            key in "[a-zA-Z][a-zA-Z0-9_-]*",
            value in "[a-zA-Z0-9_./]+[a-zA-Z0-9_./]*"  // Ensure it doesn't start with -
        ) {
            prop_assume!(!value.starts_with('-')); // Avoid values that look like flags
            let args = vec![format!("--{}", key), value.clone()];
            let result = parse_args_from_vec(&args);
            prop_assert_eq!(result.get(&key), Some(&value));
        }

        #[test]
        fn test_parse_args_property_equals_format(
            key in "[a-zA-Z][a-zA-Z0-9_-]*",
            value in "[a-zA-Z0-9_./]+[a-zA-Z0-9_./:]*"
        ) {
            let args = vec![format!("--{}={}", key, value)];
            let result = parse_args_from_vec(&args);
            prop_assert_eq!(result.get(&key), Some(&value));
        }

        #[test]
        fn test_get_env_or_default_property_always_returns_string(
            key in "[A-Z][A-Z0-9_]*",
            default_val in ".*"
        ) {
            let result = get_env_or_default(&key, &default_val);
            prop_assert!(!result.is_empty() || default_val.is_empty());
        }

        #[test]
        fn test_file_exists_property_nonexistent_paths(
            path in "/nonexistent/[a-z0-9/]+"
        ) {
            prop_assume!(!std::path::Path::new(&path).exists());
            prop_assert!(!file_exists(&path));
        }
    }

    // Contract tests
    #[test]
    fn test_parse_args_contract_output_keys_match_input() {
        let test_cases = vec![
            (vec!["--foo".to_string()], vec!["foo"]),
            (vec!["--bar=baz".to_string()], vec!["bar"]),
            (vec!["-x".to_string()], vec!["x"]),
            (
                vec!["--a".to_string(), "b".to_string(), "--c=d".to_string()],
                vec!["a", "c"],
            ),
        ];

        for (input, expected_keys) in test_cases {
            let result = parse_args_from_vec(&input);
            for key in expected_keys {
                assert!(result.contains_key(key), "Missing key: {}", key);
            }
        }
    }

    #[test]
    fn test_command_result_contract() {
        // CommandResult should always have consistent success/code relationship
        tokio_test::block_on(async {
            let success_result = run_command(&["true"], None).await.unwrap();
            assert_eq!(success_result.success, success_result.code == 0);

            let failure_result = run_command(&["false"], None).await.unwrap();
            assert_eq!(failure_result.success, failure_result.code == 0);
        });
    }

    // Additional tests for new utilities
    #[test]
    fn test_expand_tilde() {
        let expanded = expand_tilde("~/test").unwrap();
        assert!(!expanded.starts_with('~'));
        
        let no_tilde = expand_tilde("/absolute/path").unwrap();
        assert_eq!(no_tilde, "/absolute/path");
    }

    #[test]
    fn test_get_username() {
        let username = get_username();
        assert!(!username.is_empty());
    }

    #[test]
    fn test_is_directory_and_is_file() {
        assert!(is_directory("/tmp"));
        assert!(!is_file("/tmp"));
        
        assert!(is_file("/etc/passwd"));
        assert!(!is_directory("/etc/passwd"));
    }

    #[tokio::test]
    async fn test_read_write_file() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");
        let file_path_str = file_path.to_str().unwrap();
        
        // Write file
        write_file(file_path_str, "test content").await.unwrap();
        
        // Read file
        let content = read_file(file_path_str).await.unwrap();
        assert_eq!(content, "test content");
    }

    #[tokio::test]
    async fn test_copy_file() {
        let temp_dir = TempDir::new().unwrap();
        let src = temp_dir.path().join("source.txt");
        let dst = temp_dir.path().join("dest.txt");
        
        // Create source file
        std::fs::write(&src, "test data").unwrap();
        
        // Copy file
        copy_file(src.to_str().unwrap(), dst.to_str().unwrap()).await.unwrap();
        
        // Verify destination
        let content = std::fs::read_to_string(&dst).unwrap();
        assert_eq!(content, "test data");
    }

    #[tokio::test]
    async fn test_list_directory() {
        let temp_dir = TempDir::new().unwrap();
        let temp_path = temp_dir.path();
        
        // Create some files
        std::fs::write(temp_path.join("file1.txt"), "").unwrap();
        std::fs::write(temp_path.join("file2.txt"), "").unwrap();
        std::fs::create_dir(temp_path.join("subdir")).unwrap();
        
        // List directory
        let entries = list_directory(temp_path.to_str().unwrap()).await.unwrap();
        
        assert!(entries.contains(&"file1.txt".to_string()));
        assert!(entries.contains(&"file2.txt".to_string()));
        assert!(entries.contains(&"subdir".to_string()));
    }

    #[tokio::test]
    async fn test_remove_path() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");
        let dir_path = temp_dir.path().join("testdir");
        
        // Create file and directory
        std::fs::write(&file_path, "test").unwrap();
        std::fs::create_dir(&dir_path).unwrap();
        
        // Remove file
        remove_path(file_path.to_str().unwrap()).await.unwrap();
        assert!(!file_path.exists());
        
        // Remove directory
        remove_path(dir_path.to_str().unwrap()).await.unwrap();
        assert!(!dir_path.exists());
    }

    #[tokio::test]
    async fn test_sleep_ms() {
        let start = std::time::Instant::now();
        sleep_ms(100).await;
        let elapsed = start.elapsed();
        
        assert!(elapsed.as_millis() >= 100);
        assert!(elapsed.as_millis() < 200); // Allow some margin
    }
}
