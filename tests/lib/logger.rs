// Tests for logger module
//
// This module tests the structured logging functionality

use std::collections::HashMap;
use std::time::Duration;
use ubuntu_config_scripts::*;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_performance_timer_creation() {
        let timer = PerformanceTimer::new("test operation");
        // Timer should be created successfully
        // We can't easily test the internal state without exposing it
        // This test mainly ensures the constructor doesn't panic
        std::mem::drop(timer);
    }

    #[test]
    fn test_performance_timer_finish() {
        let timer = PerformanceTimer::new("test finish");
        // Should not panic when finished
        timer.finish();
    }

    #[test]
    fn test_performance_timer_fail() {
        let timer = PerformanceTimer::new("test fail");
        // Should not panic when failed
        timer.fail("test error message");
    }

    #[test]
    fn test_log_functions_dont_panic() {
        // Use std::sync::Once to ensure logger is only initialized once per test process
        use std::sync::Once;
        static INIT: Once = Once::new();

        INIT.call_once(|| {
            let _ = init_logger();
        });

        // Test all log functions don't panic
        log_debug("Test debug message", "TEST");
        log_info("Test info message", "TEST");
        log_warn("Test warning message", "TEST");
        log_error("Test error message", "TEST");

        log_command(&["echo", "test"], "TEST");
        log_file_op("read", "/tmp/test", "TEST");
        log_status("running", "TEST");

        log_script_start("test_script");
        log_script_complete("test_script");
        log_script_error("test_script", "test error");
    }

    #[test]
    fn test_logger_levels() {
        // Don't test actual initialization since logger can only be init once
        // Just test that the enum values exist and are different
        assert_ne!(LogLevel::Debug, LogLevel::Info);
        assert_ne!(LogLevel::Info, LogLevel::Warn);
        assert_ne!(LogLevel::Warn, LogLevel::Error);
    }

    #[test]
    fn test_log_level_enum() {
        // Test LogLevel enum behavior
        assert_eq!(LogLevel::Debug, LogLevel::Debug);
        assert_ne!(LogLevel::Debug, LogLevel::Info);

        // Test Debug trait
        let debug_str = format!("{:?}", LogLevel::Debug);
        assert!(debug_str.contains("Debug"));
    }

    // Integration test with actual timing
    #[test]
    fn test_performance_timer_actually_measures_time() {
        let timer = PerformanceTimer::new("sleep test");

        // Sleep for a small amount
        std::thread::sleep(Duration::from_millis(10));

        // This should log the elapsed time
        timer.finish();

        // We can't easily assert the exact timing without capturing logs,
        // but we can ensure it doesn't panic and completes successfully
    }

    // Test logger initialization edge cases
    #[test]
    fn test_logger_multiple_initialization() {
        // Test that logger initialization function exists and can be called
        // Note: We can't actually test multiple initialization because env_logger
        // panics on second init attempt in test environment
        // This test just verifies the function interface exists
        let _ = LogLevel::Info; // Just verify enum works
    }

    // Tests for new logger features
    #[test]
    fn test_log_entry_creation() {
        let entry = LogEntry::new("INFO", "TEST", "Test message");
        assert_eq!(entry.level, "INFO");
        assert_eq!(entry.component, "TEST");
        assert_eq!(entry.message, "Test message");
        assert!(entry.metadata.is_none());
        assert!(!entry.timestamp.is_empty());
    }

    #[test]
    fn test_log_entry_with_metadata() {
        let mut metadata = HashMap::new();
        metadata.insert("key1".to_string(), "value1".to_string());
        metadata.insert("key2".to_string(), "value2".to_string());
        
        let entry = LogEntry::new("DEBUG", "TEST", "Test with metadata")
            .with_metadata(metadata.clone());
        
        assert_eq!(entry.metadata, Some(metadata));
    }

    #[test]
    fn test_log_entry_log_method() {
        // Just ensure it doesn't panic
        let entry = LogEntry::new("INFO", "TEST", "Test log");
        entry.log();
        
        let entry = LogEntry::new("DEBUG", "TEST", "Debug log");
        entry.log();
        
        let entry = LogEntry::new("WARN", "TEST", "Warn log");
        entry.log();
        
        let entry = LogEntry::new("ERROR", "TEST", "Error log");
        entry.log();
        
        let entry = LogEntry::new("UNKNOWN", "TEST", "Unknown log");
        entry.log(); // Should default to info
    }

    #[test]
    fn test_progress_tracker_creation() {
        let tracker = ProgressTracker::new(100, "Processing items");
        // Should not panic
        std::mem::drop(tracker);
    }

    #[test]
    fn test_progress_tracker_update() {
        let mut tracker = ProgressTracker::new(10, "Test progress");
        tracker.update(5);
        tracker.update(10);
        // Should not panic
    }

    #[test]
    fn test_progress_tracker_increment() {
        let mut tracker = ProgressTracker::new(5, "Incremental progress");
        tracker.increment();
        tracker.increment();
        tracker.increment();
        // Should not panic
    }

    #[test]
    fn test_progress_tracker_finish() {
        let tracker = ProgressTracker::new(50, "Finishing progress");
        tracker.finish();
        // Should not panic
    }

    #[test]
    fn test_log_context_creation() {
        let context = LogContext::new("TestContext");
        // Should not panic
        std::mem::drop(context);
    }

    #[test]
    fn test_log_context_logging() {
        let context = LogContext::new("TestContext");
        context.log(LogLevel::Debug, "Debug message");
        context.log(LogLevel::Info, "Info message");
        context.log(LogLevel::Warn, "Warning message");
        context.log(LogLevel::Error, "Error message");
        // Should not panic
    }

    #[test]
    fn test_log_context_drop() {
        {
            let _context = LogContext::new("ScopedContext");
            // Context will be dropped here
        }
        // Should log exit message on drop
    }

    #[test]
    fn test_metrics_collector_creation() {
        let collector = MetricsCollector::new();
        assert!(collector.get_all().is_empty());
    }

    #[test]
    fn test_metrics_collector_record() {
        let collector = MetricsCollector::new();
        collector.record("cpu_usage", 45.5);
        collector.record("memory_usage", 78.2);
        
        assert_eq!(collector.get("cpu_usage"), Some(45.5));
        assert_eq!(collector.get("memory_usage"), Some(78.2));
    }

    #[test]
    fn test_metrics_collector_increment() {
        let collector = MetricsCollector::new();
        collector.increment("counter");
        assert_eq!(collector.get("counter"), Some(1.0));
        
        collector.increment("counter");
        assert_eq!(collector.get("counter"), Some(2.0));
        
        collector.increment("counter");
        assert_eq!(collector.get("counter"), Some(3.0));
    }

    #[test]
    fn test_metrics_collector_get_all() {
        let collector = MetricsCollector::new();
        collector.record("metric1", 10.0);
        collector.record("metric2", 20.0);
        collector.increment("counter");
        
        let all_metrics = collector.get_all();
        assert_eq!(all_metrics.len(), 3);
        assert_eq!(all_metrics.get("metric1"), Some(&10.0));
        assert_eq!(all_metrics.get("metric2"), Some(&20.0));
        assert_eq!(all_metrics.get("counter"), Some(&1.0));
    }

    #[test]
    fn test_metrics_collector_log_summary() {
        let collector = MetricsCollector::new();
        collector.record("test_metric", 42.0);
        collector.increment("test_counter");
        
        // Should not panic
        collector.log_summary();
    }

    #[test]
    fn test_metrics_collector_default() {
        let collector = MetricsCollector::default();
        assert!(collector.get_all().is_empty());
    }

    #[test]
    fn test_log_result_success() {
        let result: Result<i32, String> = Ok(42);
        log_result(&result, "Operation succeeded", "TEST");
        // Should log info message
    }

    #[test]
    fn test_log_result_failure() {
        let result: Result<i32, String> = Err("Test error".to_string());
        log_result(&result, "Operation succeeded", "TEST");
        // Should log error message
    }

    #[test]
    fn test_format_table_empty() {
        let headers = vec!["Col1", "Col2"];
        let rows: Vec<Vec<String>> = vec![];
        let table = format_table(headers, rows);
        
        // Should have headers and borders but no data rows
        assert!(table.contains("Col1"));
        assert!(table.contains("Col2"));
        assert!(table.contains("┌"));
        assert!(table.contains("└"));
    }

    #[test]
    fn test_format_table_with_data() {
        let headers = vec!["Name", "Value"];
        let rows = vec![
            vec!["Item1".to_string(), "100".to_string()],
            vec!["Item2".to_string(), "200".to_string()],
        ];
        let table = format_table(headers, rows);
        
        assert!(table.contains("Name"));
        assert!(table.contains("Value"));
        assert!(table.contains("Item1"));
        assert!(table.contains("100"));
        assert!(table.contains("Item2"));
        assert!(table.contains("200"));
    }

    #[test]
    fn test_format_table_varying_widths() {
        let headers = vec!["Short", "Very Long Header"];
        let rows = vec![
            vec!["A".to_string(), "B".to_string()],
            vec!["This is a long cell".to_string(), "X".to_string()],
        ];
        let table = format_table(headers, rows);
        
        // Should handle different column widths correctly
        assert!(table.contains("Short"));
        assert!(table.contains("Very Long Header"));
        assert!(table.contains("This is a long cell"));
    }

    // Property-based test for log message formatting
    #[cfg(test)]
    use proptest::prelude::*;

    proptest! {
        #[test]
        fn test_log_functions_with_arbitrary_strings(
            message in ".*",
            component in "[A-Z][A-Z0-9_]*"
        ) {
            // These should never panic regardless of input
            // (logger may or may not be initialized, but log functions should be safe)
            log_debug(&message, &component);
            log_info(&message, &component);
            log_warn(&message, &component);
            log_error(&message, &component);
        }

        #[test]
        fn test_performance_timer_with_arbitrary_operation_names(
            operation in ".*"
        ) {
            let timer = PerformanceTimer::new(&operation);
            timer.finish(); // Should never panic
        }

        #[test]
        fn test_log_script_functions_with_arbitrary_names(
            script_name in "[a-zA-Z0-9_-]+",
            error_message in ".*"
        ) {
            // These should never panic regardless of input
            log_script_start(&script_name);
            log_script_complete(&script_name);
            log_script_error(&script_name, &error_message);
        }

        #[test]
        fn test_log_entry_with_arbitrary_data(
            level in "[A-Z]+",
            component in "[A-Z][A-Z0-9_]*",
            message in ".*"
        ) {
            let entry = LogEntry::new(&level, &component, &message);
            assert_eq!(entry.level, level);
            assert_eq!(entry.component, component);
            assert_eq!(entry.message, message);
            entry.log(); // Should not panic
        }

        #[test]
        fn test_progress_tracker_with_arbitrary_values(
            total in 1usize..10000,
            message in ".*",
            updates in proptest::collection::vec(0usize..10000, 0..10)
        ) {
            let mut tracker = ProgressTracker::new(total, &message);
            for update in updates {
                tracker.update(update);
            }
            tracker.finish(); // Should not panic
        }

        #[test]
        fn test_log_context_with_arbitrary_context(
            context_name in ".*",
            messages in proptest::collection::vec(".*", 0..5)
        ) {
            let context = LogContext::new(&context_name);
            for message in messages {
                context.log(LogLevel::Info, &message);
            }
            // Context will be dropped and should not panic
        }

        #[test]
        fn test_metrics_collector_with_arbitrary_metrics(
            metrics in proptest::collection::hash_map(
                "[a-zA-Z][a-zA-Z0-9_]*",
                proptest::num::f64::ANY,
                0..10
            )
        ) {
            let collector = MetricsCollector::new();
            for (key, value) in &metrics {
                if value.is_finite() {
                    collector.record(key, *value);
                }
            }
            
            let all = collector.get_all();
            for (key, value) in metrics {
                if value.is_finite() {
                    assert_eq!(all.get(&key), Some(&value));
                }
            }
        }

        #[test]
        fn test_format_table_with_arbitrary_data(
            headers in proptest::collection::vec("[a-zA-Z0-9 ]+", 1..5),
            row_count in 0usize..10
        ) {
            let headers_refs: Vec<&str> = headers.iter().map(|s| s.as_str()).collect();
            let mut rows = Vec::new();
            
            for _ in 0..row_count {
                let row: Vec<String> = (0..headers.len())
                    .map(|_| "test".to_string())
                    .collect();
                rows.push(row);
            }
            
            let table = format_table(headers_refs, rows);
            
            // Table should contain all headers
            for header in &headers {
                assert!(table.contains(header));
            }
            
            // Table should have proper borders
            assert!(table.contains("┌"));
            assert!(table.contains("└"));
        }
    }
}
