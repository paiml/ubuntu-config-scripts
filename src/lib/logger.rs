// Structured logging for Ubuntu Config Scripts
//
// This module provides comprehensive logging functionality including:
// - Structured logging with context
// - Multiple log levels
// - Component-based logging
// - Performance monitoring

use anyhow::Result;
use log::{debug, error, info, warn};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::RwLock;
use std::time::Instant;

/// Log levels for different types of messages
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
}

/// Performance timer for measuring execution time
pub struct PerformanceTimer {
    start: Instant,
    operation: String,
}

impl PerformanceTimer {
    pub fn new(operation: &str) -> Self {
        info!("⏱️  Starting: {}", operation);
        Self {
            start: Instant::now(),
            operation: operation.to_string(),
        }
    }

    pub fn finish(self) {
        let duration = self.start.elapsed();
        info!("✅ Completed: {} (took {:?})", self.operation, duration);
    }

    pub fn fail(self, reason: &str) {
        let duration = self.start.elapsed();
        error!(
            "❌ Failed: {} after {:?} - {}",
            self.operation, duration, reason
        );
    }
}

/// Log debug message with component context
pub fn log_debug(message: &str, component: &str) {
    debug!("[{}] {}", component, message);
}

/// Log info message with component context
pub fn log_info(message: &str, component: &str) {
    info!("[{}] {}", component, message);
}

/// Log warning message with component context
pub fn log_warn(message: &str, component: &str) {
    warn!("[{}] {}", component, message);
}

/// Log error message with component context
pub fn log_error(message: &str, component: &str) {
    error!("[{}] {}", component, message);
}

/// Log command execution
pub fn log_command(cmd: &[&str], component: &str) {
    log_debug(&format!("Executing: {}", cmd.join(" ")), component);
}

/// Log file operation
pub fn log_file_op(operation: &str, path: &str, component: &str) {
    log_debug(&format!("{}: {}", operation, path), component);
}

/// Log system status
pub fn log_status(status: &str, component: &str) {
    log_info(&format!("Status: {}", status), component);
}

/// Log script start
pub fn log_script_start(script_name: &str) {
    info!("🚀 Starting script: {}", script_name);
}

/// Log script completion
pub fn log_script_complete(script_name: &str) {
    info!("✅ Script completed: {}", script_name);
}

/// Log success message with component context
pub fn log_success(message: &str, component: &str) {
    info!("✅ [{}] {}", component, message);
}

/// Log script failure
pub fn log_script_error(script_name: &str, error: &str) {
    error!("❌ Script failed: {} - {}", script_name, error);
}

/// Initialize logging with appropriate level
pub fn init_logger() -> Result<(), log::SetLoggerError> {
    env_logger::Builder::from_default_env()
        .filter_level(log::LevelFilter::Info)
        .init();
    Ok(())
}

/// Initialize logger with specific level
pub fn init_logger_with_level(level: LogLevel) -> Result<(), log::SetLoggerError> {
    let log_level = match level {
        LogLevel::Debug => log::LevelFilter::Debug,
        LogLevel::Info => log::LevelFilter::Info,
        LogLevel::Warn => log::LevelFilter::Warn,
        LogLevel::Error => log::LevelFilter::Error,
    };

    env_logger::Builder::from_default_env()
        .filter_level(log_level)
        .init();
    Ok(())
}

/// Structured log entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: String,
    pub level: String,
    pub component: String,
    pub message: String,
    pub metadata: Option<HashMap<String, String>>,
}

impl LogEntry {
    pub fn new(level: &str, component: &str, message: &str) -> Self {
        Self {
            timestamp: chrono::Local::now().to_rfc3339(),
            level: level.to_string(),
            component: component.to_string(),
            message: message.to_string(),
            metadata: None,
        }
    }

    pub fn with_metadata(mut self, metadata: HashMap<String, String>) -> Self {
        self.metadata = Some(metadata);
        self
    }

    pub fn log(&self) {
        match self.level.as_str() {
            "DEBUG" => debug!("[{}] {}", self.component, self.message),
            "INFO" => info!("[{}] {}", self.component, self.message),
            "WARN" => warn!("[{}] {}", self.component, self.message),
            "ERROR" => error!("[{}] {}", self.component, self.message),
            _ => info!("[{}] {}", self.component, self.message),
        }
    }
}

/// Progress tracker for long-running operations
pub struct ProgressTracker {
    total: usize,
    current: usize,
    message: String,
    start: Instant,
}

impl ProgressTracker {
    pub fn new(total: usize, message: &str) -> Self {
        info!("📊 Starting: {} (0/{})", message, total);
        Self {
            total,
            current: 0,
            message: message.to_string(),
            start: Instant::now(),
        }
    }

    pub fn update(&mut self, current: usize) {
        self.current = current;
        let percent = (current as f64 / self.total as f64 * 100.0) as u32;
        info!(
            "📊 Progress: {} ({}/{}) - {}%",
            self.message, self.current, self.total, percent
        );
    }

    pub fn increment(&mut self) {
        self.update(self.current + 1);
    }

    pub fn finish(self) {
        let duration = self.start.elapsed();
        info!(
            "✅ Completed: {} ({}/{}) in {:?}",
            self.message, self.total, self.total, duration
        );
    }
}

/// Context manager for nested logging contexts
pub struct LogContext {
    context: String,
    start: Instant,
}

impl LogContext {
    pub fn new(context: &str) -> Self {
        info!("➡️  Entering context: {}", context);
        Self {
            context: context.to_string(),
            start: Instant::now(),
        }
    }

    pub fn log(&self, level: LogLevel, message: &str) {
        let prefixed = format!("[{}] {}", self.context, message);
        match level {
            LogLevel::Debug => debug!("{}", prefixed),
            LogLevel::Info => info!("{}", prefixed),
            LogLevel::Warn => warn!("{}", prefixed),
            LogLevel::Error => error!("{}", prefixed),
        }
    }
}

impl Drop for LogContext {
    fn drop(&mut self) {
        let duration = self.start.elapsed();
        info!("⬅️  Leaving context: {} (took {:?})", self.context, duration);
    }
}

/// Metrics collector for runtime statistics
pub struct MetricsCollector {
    metrics: RwLock<HashMap<String, f64>>,
}

impl MetricsCollector {
    pub fn new() -> Self {
        Self {
            metrics: RwLock::new(HashMap::new()),
        }
    }

    pub fn record(&self, key: &str, value: f64) {
        if let Ok(mut metrics) = self.metrics.write() {
            metrics.insert(key.to_string(), value);
        }
    }

    pub fn increment(&self, key: &str) {
        if let Ok(mut metrics) = self.metrics.write() {
            let current = metrics.get(key).copied().unwrap_or(0.0);
            metrics.insert(key.to_string(), current + 1.0);
        }
    }

    pub fn get(&self, key: &str) -> Option<f64> {
        self.metrics.read().ok()?.get(key).copied()
    }

    pub fn get_all(&self) -> HashMap<String, f64> {
        self.metrics.read().unwrap().clone()
    }

    pub fn log_summary(&self) {
        if let Ok(metrics) = self.metrics.read() {
            info!("📈 Metrics Summary:");
            for (key, value) in metrics.iter() {
                info!("  {} = {}", key, value);
            }
        }
    }
}

impl Default for MetricsCollector {
    fn default() -> Self {
        Self::new()
    }
}

/// Log a result with appropriate level
pub fn log_result<T, E: std::fmt::Display>(
    result: &std::result::Result<T, E>,
    success_msg: &str,
    component: &str,
) {
    match result {
        Ok(_) => log_info(success_msg, component),
        Err(e) => log_error(&format!("Failed: {}", e), component),
    }
}

/// Create a formatted table for logging
pub fn format_table(headers: Vec<&str>, rows: Vec<Vec<String>>) -> String {
    let mut output = String::new();
    
    // Calculate column widths
    let mut widths = headers.iter().map(|h| h.len()).collect::<Vec<_>>();
    for row in &rows {
        for (i, cell) in row.iter().enumerate() {
            if i < widths.len() {
                widths[i] = widths[i].max(cell.len());
            }
        }
    }
    
    // Print headers
    output.push_str("┌");
    for (i, width) in widths.iter().enumerate() {
        output.push_str(&"─".repeat(width + 2));
        if i < widths.len() - 1 {
            output.push_str("┬");
        }
    }
    output.push_str("┐\n");
    
    output.push_str("│");
    for (i, header) in headers.iter().enumerate() {
        output.push_str(&format!(" {:width$} ", header, width = widths[i]));
        output.push('│');
    }
    output.push('\n');
    
    // Print separator
    output.push_str("├");
    for (i, width) in widths.iter().enumerate() {
        output.push_str(&"─".repeat(width + 2));
        if i < widths.len() - 1 {
            output.push_str("┼");
        }
    }
    output.push_str("┤\n");
    
    // Print rows
    for row in rows {
        output.push('│');
        for (i, cell) in row.iter().enumerate() {
            if i < widths.len() {
                output.push_str(&format!(" {:width$} ", cell, width = widths[i]));
                output.push('│');
            }
        }
        output.push('\n');
    }
    
    // Print bottom border
    output.push_str("└");
    for (i, width) in widths.iter().enumerate() {
        output.push_str(&"─".repeat(width + 2));
        if i < widths.len() - 1 {
            output.push_str("┴");
        }
    }
    output.push_str("┘");
    
    output
}
