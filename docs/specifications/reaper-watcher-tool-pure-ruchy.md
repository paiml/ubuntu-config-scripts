# Reaper/Watcher Tool Specification - Pure Ruchy Implementation

## Executive Summary

**Problem**: Development systems accumulate rogue background processes that consume excessive CPU/memory resources, often from:
- Infinite loop test binaries (`test_ch04_debug`, `test_interp_001_parser`)
- Hung test runners (cargo-nextest, property tests, mutation tests)
- Orphaned build processes from interrupted CI/CD runs
- Forgotten tail/monitoring commands

**Solution**: A pure Ruchy-based reaper/watcher daemon that automatically detects and terminates rogue processes based on configurable heuristics.

**Why Ruchy?**
- ✅ Single binary deployment (no Python/Node.js dependencies)
- ✅ Native system process interaction
- ✅ Low memory footprint (<10MB resident)
- ✅ Fast startup (<100ms cold start)
- ✅ Type-safe configuration
- ✅ Integrated with bashrs ecosystem

---

## Real-World Incident Report (2025-10-31)

### Discovered Rogue Processes

| PID | Command | CPU Time | Age | Status |
|-----|---------|----------|-----|--------|
| 2174710 | `/tmp/test_ch04_debug` | 292 min (99.9% CPU) | 5 hours | Infinite loop |
| 2215386 | `/tmp/test_ch04_debug` | 271 min (99.9% CPU) | 4.5 hours | Infinite loop |
| 2256525 | `/tmp/test_ch04_debug` | 268 min (99.9% CPU) | 4.5 hours | Infinite loop |
| 4179152 | `test_interp_001_parser` | 1370 min (99.9% CPU) | 24 hours | Infinite loop |
| 627250 | `cargo-nextest` | 82 min | 5 days | Hung test |
| 686678 | `pmat mutation test` | 10 min | 5 days | Hung test |
| 1393626 | `mutation_handler_unit_tests` | 76 min | 3 days | Hung test |
| 10252 | `tail -f /tmp/sprint43_ignored_tests_full.log` | 0 min | 12 days | Orphaned monitor |

**Impact**:
- System load: 9-10 (should be <2 for 16-core system)
- CPU idle: 5.7% (should be >80% when inactive)
- Development velocity: Severely degraded

**Manual Resolution**: Killed 17 processes with `kill -9`, system recovered to 94.3% idle.

---

## Requirements

### Functional Requirements

**FR-001: Process Discovery**
- MUST enumerate all processes accessible to the user
- MUST read process metadata: PID, command, CPU time, memory, age, parent PID
- MUST handle `/proc` filesystem parsing failures gracefully

**FR-002: Rogue Process Detection**
- MUST detect infinite loop processes (>90% CPU for >5 minutes)
- MUST detect hung test processes (age >4 hours, specific patterns)
- MUST detect orphaned monitoring processes (age >24 hours, zero CPU)
- MUST support configurable detection rules via TOML

**FR-003: Process Termination**
- MUST send SIGTERM first, wait 5 seconds, then SIGKILL if still alive
- MUST log all termination actions with timestamp, PID, command, reason
- MUST support dry-run mode (detection without termination)
- MUST respect process whitelist (never kill listed processes)

**FR-004: Safety Mechanisms**
- MUST NOT kill system processes (UID 0, PID <1000)
- MUST NOT kill current shell or ancestors
- MUST NOT kill processes in whitelist (e.g., IDE, browser, editors)
- MUST require explicit confirmation in interactive mode

**FR-005: Monitoring and Alerting**
- MUST log all detected rogue processes to structured log file
- MUST emit metrics (processes killed, CPU recovered, uptime)
- SHOULD integrate with system notification daemon (libnotify)
- SHOULD expose HTTP metrics endpoint (Prometheus format)

**FR-006: Configuration**
- MUST load configuration from `~/.config/reaper/reaper.toml`
- MUST support per-project overrides in `.reaper.toml`
- MUST validate configuration on startup
- MUST provide sensible defaults

### Non-Functional Requirements

**NFR-001: Performance**
- Process scan: <500ms for 1000 processes
- Memory footprint: <10MB resident
- CPU overhead: <1% during monitoring

**NFR-002: Reliability**
- Zero crashes: Handle all `/proc` parsing errors
- Restart on failure: Systemd integration
- Audit trail: All actions logged

**NFR-003: Usability**
- CLI: `reaper start|stop|status|scan|kill PID`
- Interactive: Colorized output, tables
- Documentation: `reaper --help` self-documenting

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────┐
│                 Reaper Daemon                   │
│  (Pure Ruchy - Single Binary)                   │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────────┐      ┌──────────────┐        │
│  │   Scanner    │─────▶│   Detector   │        │
│  │              │      │              │        │
│  │ /proc parser │      │ Rule engine  │        │
│  └──────────────┘      └──────┬───────┘        │
│                               │                 │
│                               ▼                 │
│  ┌──────────────┐      ┌──────────────┐        │
│  │   Logger     │◀─────│  Terminator  │        │
│  │              │      │              │        │
│  │ Audit trail  │      │ SIGTERM/KILL │        │
│  └──────────────┘      └──────────────┘        │
│                                                 │
├─────────────────────────────────────────────────┤
│            Configuration Loader                 │
│  ~/.config/reaper/reaper.toml                   │
│  .reaper.toml (project-specific)                │
└─────────────────────────────────────────────────┘
          │                      │
          ▼                      ▼
   ┌─────────────┐        ┌──────────────┐
   │   Systemd   │        │  Manual CLI  │
   │   Service   │        │  reaper scan │
   └─────────────┘        └──────────────┘
```

### Ruchy Implementation Modules

```ruchy
// src/reaper/main.ruchy
mod scanner;      // Process enumeration
mod detector;     // Rogue detection rules
mod terminator;   // Safe kill logic
mod config;       // TOML configuration
mod logger;       // Audit trail
mod cli;          // Command-line interface

fun main() -> Result<(), Error> {
    let config = Config::load("~/.config/reaper/reaper.toml")?;
    let mode = parse_cli_args()?;

    match mode {
        Mode::Daemon => run_daemon(config),
        Mode::Scan => run_scan(config),
        Mode::Kill(pid) => kill_process(pid, config),
        Mode::Status => show_status(),
    }
}
```

---

## Detection Rules

### Rule 1: Infinite Loop Detection

**Pattern**: Process consuming >90% CPU for >5 minutes

```toml
[[rules]]
name = "infinite_loop"
enabled = true
priority = "critical"

[rules.conditions]
cpu_percent_min = 90.0
duration_seconds = 300
exclude_patterns = [
    "^chrome$",        # Browser legitimately uses CPU
    "^rustc$",         # Compiler legitimately uses CPU
    "^cargo build$",   # Active build process
]

[rules.action]
type = "kill"
signal = "SIGKILL"  # Immediate termination for infinite loops
notify = true
log_level = "error"
```

**Ruchy Implementation**:
```ruchy
fun detect_infinite_loop(process: &Process, config: &Config) -> bool {
    let rule = config.rules.get("infinite_loop")?;

    // Check CPU threshold
    if process.cpu_percent < rule.cpu_percent_min {
        return false;
    }

    // Check duration
    if process.age_seconds < rule.duration_seconds {
        return false;
    }

    // Check exclusions
    for pattern in rule.exclude_patterns {
        if process.command.matches(pattern) {
            return false;
        }
    }

    true
}
```

### Rule 2: Hung Test Process Detection

**Pattern**: Test process older than 4 hours, <5% CPU

```toml
[[rules]]
name = "hung_test"
enabled = true
priority = "high"

[rules.conditions]
age_hours = 4
cpu_percent_max = 5.0
command_patterns = [
    "cargo-nextest",
    "cargo test",
    ".*_test.*",
    "test_.*",
    "proptest",
    "mutation.*test",
]

[rules.action]
type = "kill"
signal = "SIGTERM"  # Graceful shutdown first
timeout_seconds = 5
fallback_signal = "SIGKILL"
notify = true
log_level = "warning"
```

**Ruchy Implementation**:
```ruchy
fun detect_hung_test(process: &Process, config: &Config) -> bool {
    let rule = config.rules.get("hung_test")?;

    // Check age threshold
    if process.age_hours < rule.age_hours {
        return false;
    }

    // Check low CPU (process is stuck, not computing)
    if process.cpu_percent > rule.cpu_percent_max {
        return false;
    }

    // Check if command matches test patterns
    for pattern in rule.command_patterns {
        if process.command.matches(pattern) {
            return true;
        }
    }

    false
}
```

### Rule 3: Orphaned Monitor Detection

**Pattern**: Long-running `tail -f`, `watch`, or log monitoring commands

```toml
[[rules]]
name = "orphaned_monitor"
enabled = true
priority = "low"

[rules.conditions]
age_hours = 24
cpu_percent_max = 1.0
command_patterns = [
    "^tail -f",
    "^watch ",
    ".*\\.log$",
]

[rules.action]
type = "kill"
signal = "SIGTERM"
notify = false
log_level = "info"
```

### Rule 4: Zombie Test Binaries

**Pattern**: `/tmp/test_*` binaries running >1 hour

```toml
[[rules]]
name = "zombie_test_binary"
enabled = true
priority = "critical"

[rules.conditions]
age_hours = 1
command_patterns = [
    "^/tmp/test_",
    "^/tmp/.*_test$",
]
# No CPU check - even 0% CPU indicates hung state

[rules.action]
type = "kill"
signal = "SIGKILL"  # Test binaries can be force-killed
notify = true
log_level = "error"
```

### Rule Priority

Evaluation order (highest to lowest priority):
1. **Critical**: Infinite loops, zombie binaries
2. **High**: Hung tests
3. **Medium**: (Future: memory hogs)
4. **Low**: Orphaned monitors

---

## Configuration

### Default Configuration (`~/.config/reaper/reaper.toml`)

```toml
# Reaper Daemon Configuration
# Version: 1.0.0

[daemon]
enabled = true
scan_interval_seconds = 60
dry_run = false  # Set to true to detect without killing

[logging]
level = "info"
file = "~/.local/share/reaper/reaper.log"
max_size_mb = 100
rotate_count = 5

[notifications]
enabled = true
urgency = "normal"  # low, normal, critical
timeout_ms = 5000

[metrics]
enabled = true
http_port = 9090
path = "/metrics"

[safety]
whitelist_processes = [
    "systemd",
    "gnome-shell",
    "Xorg",
    "claude",
    "cursor",
    "code",
    "vim",
    "nvim",
    "emacs",
]
min_pid = 1000  # Never kill processes with PID < 1000
protect_shell_ancestors = true

# Rules defined above in "Detection Rules" section
[[rules]]
name = "infinite_loop"
enabled = true
# ... (see above)

[[rules]]
name = "hung_test"
enabled = true
# ... (see above)

[[rules]]
name = "orphaned_monitor"
enabled = true
# ... (see above)

[[rules]]
name = "zombie_test_binary"
enabled = true
# ... (see above)
```

### Project-Specific Override (`.reaper.toml`)

```toml
# Project: bashrs
# Override: Allow longer test runs for mutation testing

[[rules]]
name = "hung_test"
enabled = true

[rules.conditions]
age_hours = 12  # Override: 12 hours instead of 4
cpu_percent_max = 5.0
command_patterns = [
    "cargo mutants",  # Mutation testing takes longer
    "cargo-nextest",
]
```

---

## CLI Interface

### Commands

```bash
# Start daemon (background service)
$ reaper start
✅ Reaper daemon started (PID 12345)
📊 Monitoring 847 processes
🔍 Scan interval: 60 seconds

# Stop daemon
$ reaper stop
✅ Reaper daemon stopped

# Check status
$ reaper status
Reaper Daemon Status
────────────────────────────────────────
Status:          Running (PID 12345)
Uptime:          2d 4h 32m
Last scan:       5 seconds ago
Processes:       847 monitored
Rogue detected:  3 processes
Killed (total):  47 processes
CPU recovered:   387% (total)
Config:          ~/.config/reaper/reaper.toml
Dry run:         Disabled

Recent Actions:
  [2025-10-31 13:04:52] KILLED PID 2174710 (test_ch04_debug) - infinite_loop - CPU 99.9%
  [2025-10-31 13:04:52] KILLED PID 2215386 (test_ch04_debug) - infinite_loop - CPU 99.9%
  [2025-10-31 13:04:52] KILLED PID 4179152 (test_interp_001_parser) - infinite_loop - CPU 99.9%

# Scan for rogue processes (one-time, no kill)
$ reaper scan
Scanning for rogue processes...

🚨 Critical (3):
  PID 2174710  test_ch04_debug              CPU 99.9%  Age 5h 12m  Rule: infinite_loop
  PID 2215386  test_ch04_debug              CPU 99.9%  Age 4h 53m  Rule: infinite_loop
  PID 4179152  test_interp_001_parser       CPU 99.9%  Age 24h 1m  Rule: infinite_loop

⚠️  High (5):
  PID 627250   cargo-nextest                CPU  0.0%  Age 5d 2h   Rule: hung_test
  PID 686678   pmat mutation test           CPU  0.0%  Age 5d 2h   Rule: hung_test
  PID 1393626  mutation_handler_unit_tests  CPU  0.0%  Age 3d 8h   Rule: hung_test
  PID 3682039  cargo-nextest                CPU  0.0%  Age 5d 2h   Rule: hung_test
  PID 2493619  pmat test                    CPU  0.0%  Age 3d 8h   Rule: hung_test

ℹ️  Low (1):
  PID 10252    tail -f /tmp/sprint43...     CPU  0.0%  Age 12d 3h  Rule: orphaned_monitor

Total: 9 rogue processes detected
Estimated CPU recovery: 399%
Run 'reaper kill --all' to terminate

# Kill specific process
$ reaper kill 2174710
⚠️  About to kill PID 2174710 (test_ch04_debug)
    Reason: infinite_loop (CPU 99.9%, age 5h 12m)
    Proceed? [y/N] y
✅ Process 2174710 terminated (SIGKILL)

# Kill all rogue processes
$ reaper kill --all
⚠️  About to kill 9 rogue processes
    Critical: 3 processes
    High: 5 processes
    Low: 1 process

    Proceed? [y/N] y
✅ Killed 9 processes (0 failures)
📊 CPU recovered: 399%

# Dry run mode
$ reaper scan --dry-run
[Dry Run Mode - No processes will be killed]
... (same output as 'reaper scan')

# Show detected rules
$ reaper rules
Loaded Rules:
──────────────────────────────────────────────
✅ infinite_loop         Priority: Critical   Enabled
✅ hung_test             Priority: High       Enabled
✅ orphaned_monitor      Priority: Low        Enabled
✅ zombie_test_binary    Priority: Critical   Enabled

# Validate configuration
$ reaper config validate
✅ Configuration valid: ~/.config/reaper/reaper.toml
✅ Project override found: .reaper.toml
✅ All rules have valid syntax
✅ No conflicts detected

# Show metrics (Prometheus format)
$ reaper metrics
# HELP reaper_processes_monitored Total processes being monitored
# TYPE reaper_processes_monitored gauge
reaper_processes_monitored 847

# HELP reaper_rogue_processes_detected Current rogue processes
# TYPE reaper_rogue_processes_detected gauge
reaper_rogue_processes_detected{priority="critical"} 3
reaper_rogue_processes_detected{priority="high"} 5
reaper_rogue_processes_detected{priority="low"} 1

# HELP reaper_processes_killed_total Total processes killed since start
# TYPE reaper_processes_killed_total counter
reaper_processes_killed_total 47

# HELP reaper_cpu_recovered_percent Total CPU percentage recovered
# TYPE reaper_cpu_recovered_percent counter
reaper_cpu_recovered_percent 387.4
```

---

## Implementation Plan

### Phase 1: Core Scanner (Week 1)
- [ ] `/proc` filesystem parser in Ruchy
- [ ] Process metadata struct (PID, command, CPU, memory, age)
- [ ] Basic enumeration: list all user processes
- [ ] Unit tests: Parse `/proc/[pid]/stat`, `/proc/[pid]/cmdline`

### Phase 2: Detection Engine (Week 2)
- [ ] TOML configuration loader
- [ ] Rule evaluation engine
- [ ] Implement 4 core rules (infinite loop, hung test, orphaned monitor, zombie binary)
- [ ] Priority-based rule ordering
- [ ] Property tests: Rule evaluation correctness

### Phase 3: Terminator (Week 3)
- [ ] SIGTERM → SIGKILL escalation logic
- [ ] Safety checks (whitelist, PID range, shell ancestors)
- [ ] Dry-run mode
- [ ] Audit logging (structured JSON)

### Phase 4: CLI (Week 4)
- [ ] Argument parsing (clap-style in Ruchy)
- [ ] `start`, `stop`, `status`, `scan`, `kill` commands
- [ ] Colorized table output
- [ ] Interactive confirmation prompts

### Phase 5: Daemon (Week 5)
- [ ] Background daemon mode
- [ ] Signal handling (SIGTERM, SIGHUP for reload)
- [ ] PID file management
- [ ] Systemd service integration

### Phase 6: Monitoring (Week 6)
- [ ] Prometheus metrics endpoint (HTTP server in Ruchy)
- [ ] libnotify integration (desktop notifications)
- [ ] Log rotation
- [ ] Status dashboard (terminal UI)

### Phase 7: Testing & Hardening (Week 7)
- [ ] Integration tests: Spawn test processes, verify detection
- [ ] Fuzzing: Malformed `/proc` entries
- [ ] Mutation testing (>90% kill rate)
- [ ] Performance benchmarks (<500ms scans)

### Phase 8: Documentation & Release (Week 8)
- [ ] User guide (`docs/reaper-user-guide.md`)
- [ ] Configuration reference (`docs/reaper-config.md`)
- [ ] Troubleshooting guide
- [ ] Release v1.0.0

---

## Testing Strategy

### Unit Tests (EXTREME TDD)

```ruchy
// tests/test_scanner.ruchy
#[test]
fn test_parse_proc_stat_basic() {
    let stat = "1234 (test_process) R 1 1234 1234 0 -1 4194304 150 0 0 0 125 20 0 0 20 0 1 0 1234567 12345678 100 18446744073709551615";
    let process = Process::from_proc_stat(1234, stat)?;

    assert_eq!(process.pid, 1234);
    assert_eq!(process.command, "test_process");
    assert_eq!(process.state, ProcessState::Running);
}

#[test]
fn test_detect_infinite_loop_cpu_threshold() {
    let config = Config::default();
    let process = Process {
        pid: 1234,
        command: "test_ch04_debug",
        cpu_percent: 99.9,
        age_seconds: 600,  // 10 minutes
        ..Default::default()
    };

    assert!(detect_infinite_loop(&process, &config));
}

#[test]
fn test_detect_infinite_loop_excludes_compiler() {
    let config = Config::default();
    let process = Process {
        pid: 1234,
        command: "rustc",  // Excluded in config
        cpu_percent: 99.9,
        age_seconds: 600,
        ..Default::default()
    };

    assert!(!detect_infinite_loop(&process, &config));
}
```

### Property-Based Tests

```ruchy
#[proptest]
fn prop_scanner_never_panics(pid: u32, stat_data: String) {
    // Scanner should handle any malformed /proc data
    let _ = Process::from_proc_stat(pid, &stat_data);
    // No panic = success
}

#[proptest]
fn prop_whitelist_always_protected(
    process: Process,
    config: Config
) {
    if config.whitelist.contains(&process.command) {
        assert!(!should_kill(&process, &config));
    }
}
```

### Integration Tests

```ruchy
#[test]
fn test_integration_kill_infinite_loop() {
    // Spawn a real infinite loop process
    let child = spawn_process("sh", ["-c", "while true; do :; done"])?;
    let pid = child.pid();

    // Wait for CPU to ramp up
    sleep_seconds(10);

    // Run reaper scan
    let config = Config::default();
    let scanner = Scanner::new();
    let processes = scanner.scan()?;

    // Verify detection
    let rogue = processes.iter().find(|p| p.pid == pid).unwrap();
    assert!(detect_infinite_loop(rogue, &config));

    // Kill it
    let terminator = Terminator::new(config);
    terminator.kill(rogue)?;

    // Verify termination
    sleep_seconds(1);
    assert!(!is_process_alive(pid));
}
```

---

## Security Considerations

### Principle of Least Privilege
- Reaper runs as user (not root)
- Can only kill user's own processes
- Cannot affect system services

### Safety Checks
1. **PID validation**: Must be valid, positive integer
2. **UID check**: Only kill processes owned by current user
3. **Whitelist enforcement**: Never kill protected processes
4. **Ancestor protection**: Never kill current shell or ancestors
5. **Confirmation prompts**: Interactive mode requires explicit approval

### Audit Trail
All actions logged to `~/.local/share/reaper/reaper.log`:
```json
{
  "timestamp": "2025-10-31T13:04:52Z",
  "action": "kill",
  "pid": 2174710,
  "command": "test_ch04_debug",
  "rule": "infinite_loop",
  "reason": "CPU 99.9% for 5h 12m",
  "signal": "SIGKILL",
  "user": "noah",
  "hostname": "dev-machine",
  "config_file": "/home/noah/.config/reaper/reaper.toml"
}
```

---

## Performance Benchmarks

### Target Performance

| Operation | Target | Measured | Status |
|-----------|--------|----------|--------|
| Process enumeration | <200ms (1000 procs) | TBD | 🔄 |
| Rule evaluation | <50ms (1000 procs) | TBD | 🔄 |
| Single kill | <10ms | TBD | 🔄 |
| Full scan cycle | <500ms | TBD | 🔄 |
| Memory footprint | <10MB RSS | TBD | 🔄 |
| CPU overhead | <1% | TBD | 🔄 |

### Profiling

```bash
# CPU profiling
$ perf record -g reaper scan
$ perf report

# Memory profiling
$ valgrind --tool=massif reaper scan
$ ms_print massif.out.*

# Benchmark suite
$ reaper bench --iterations 1000
Process enumeration:  142ms avg (min: 120ms, max: 180ms)
Rule evaluation:       38ms avg (min: 30ms, max: 55ms)
Full scan cycle:      215ms avg (min: 180ms, max: 280ms)
Memory footprint:     6.2MB RSS
```

---

## Deployment

### Systemd Service

`~/.config/systemd/user/reaper.service`:
```ini
[Unit]
Description=Reaper Process Watcher
After=network.target

[Service]
Type=simple
ExecStart=%h/bin/reaper start --daemon
ExecStop=%h/bin/reaper stop
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
```

**Enable and start**:
```bash
$ systemctl --user enable reaper.service
$ systemctl --user start reaper.service
$ systemctl --user status reaper.service
```

### Installation

```bash
# Build from source (ruchyruchy project)
$ cd ~/src/ruchyruchy
$ cargo build --release --bin reaper

# Install binary
$ cp target/release/reaper ~/bin/reaper
$ chmod +x ~/bin/reaper

# Create default config
$ mkdir -p ~/.config/reaper
$ reaper config init

# Start daemon
$ reaper start

# Or enable systemd service
$ systemctl --user enable reaper.service
```

---

## Future Enhancements

### Phase 2 Features
- [ ] Memory hog detection (processes using >10GB RAM)
- [ ] Disk I/O hog detection (high iowait)
- [ ] Network connection monitoring (detect runaway network processes)
- [ ] Process tree visualization (show parent-child relationships)
- [ ] Historical analysis (detect patterns in killed processes)

### Phase 3 Features
- [ ] Machine learning: Learn user's process patterns, reduce false positives
- [ ] Integration with system monitoring (Grafana dashboards)
- [ ] Distributed mode: Manage processes across multiple machines
- [ ] Policy engine: Complex rules with AND/OR/NOT logic
- [ ] Auto-remediation: Restart critical services after killing

### Integration Points
- **bashrs**: Use bashrs linter to validate generated systemd service files
- **WOS**: Integrate reaper into Web Operating System for browser-based monitoring
- **interactive.paiml.com**: Educational dashboard showing rogue process detection

---

## Success Criteria

### MVP (v1.0.0)
- ✅ Detects and kills all 4 rule types (infinite loop, hung test, orphaned monitor, zombie binary)
- ✅ Zero false positives on protected processes (systemd, IDE, shell)
- ✅ <500ms scan cycle for 1000 processes
- ✅ Systemd integration working
- ✅ Audit logging complete
- ✅ CLI fully functional
- ✅ EXTREME TDD: >85% test coverage, >90% mutation score

### Production Ready (v1.1.0)
- ✅ 30-day uptime without crashes
- ✅ Successfully killed >100 rogue processes in production
- ✅ Zero manual `kill -9` interventions needed
- ✅ <5 false positive incidents
- ✅ User documentation complete
- ✅ Prometheus metrics exported

---

## References

- **Incident Report**: 2025-10-31 rogue process cleanup (17 processes killed)
- **Inspiration**: Unix `reaper` process (PID 1 for orphaned processes)
- **Similar Tools**:
  - `htop` (interactive process viewer, manual killing)
  - `pkill` (pattern-based killing, no intelligence)
  - `systemd-oomd` (OOM killer, memory-focused)
- **Ruchy Language**: https://github.com/paiml/ruchyruchy
- **bashrs Ecosystem**: https://github.com/paiml/bashrs

---

## Appendix A: Ruchy Language Features Used

### Process Management
```ruchy
use std::process::{Command, ProcessId};
use std::fs;

fun get_process_ids() -> Result<Vec<ProcessId>, Error> {
    let proc_dir = fs::read_dir("/proc")?;
    let pids = proc_dir
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| entry.file_name().to_str().parse::<u32>().ok())
        .collect();
    Ok(pids)
}

fun kill_process(pid: ProcessId, signal: Signal) -> Result<(), Error> {
    Command::new("kill")
        .arg(format!("-{}", signal.as_number()))
        .arg(pid.to_string())
        .output()?;
    Ok(())
}
```

### TOML Parsing
```ruchy
use std::toml;

fun load_config(path: &str) -> Result<Config, Error> {
    let content = fs::read_to_string(path)?;
    let config: Config = toml::from_str(&content)?;
    config.validate()?;
    Ok(config)
}
```

### HTTP Server (Metrics)
```ruchy
use std::http::{Server, Request, Response};

fun start_metrics_server(port: u16) -> Result<(), Error> {
    let server = Server::bind(format!("127.0.0.1:{}", port))?;

    server.handle(|req: Request| {
        if req.path == "/metrics" {
            Response::ok(generate_prometheus_metrics())
        } else {
            Response::not_found("Not Found")
        }
    })?;

    Ok(())
}
```

---

## Appendix B: Sample Audit Log

```json
[
  {
    "timestamp": "2025-10-31T13:04:52.123Z",
    "action": "kill",
    "pid": 2174710,
    "command": "/tmp/test_ch04_debug",
    "rule": "infinite_loop",
    "priority": "critical",
    "reason": "CPU 99.9% for 5h 12m",
    "signal": "SIGKILL",
    "cpu_percent": 99.9,
    "memory_mb": 3.35,
    "age_hours": 5.2,
    "user": "noah",
    "hostname": "dev-machine",
    "config_file": "/home/noah/.config/reaper/reaper.toml",
    "dry_run": false
  },
  {
    "timestamp": "2025-10-31T13:04:52.145Z",
    "action": "kill",
    "pid": 4179152,
    "command": "/home/noah/src/ruchyruchy/target/debug/deps/test_interp_001_parser-acfc7de6986835eb",
    "rule": "zombie_test_binary",
    "priority": "critical",
    "reason": "Zombie test binary running 24h 1m",
    "signal": "SIGKILL",
    "cpu_percent": 99.9,
    "memory_mb": 350.0,
    "age_hours": 24.02,
    "user": "noah",
    "hostname": "dev-machine",
    "config_file": "/home/noah/.config/reaper/reaper.toml",
    "dry_run": false
  },
  {
    "timestamp": "2025-10-31T13:04:52.167Z",
    "action": "kill",
    "pid": 627250,
    "command": "/home/noah/.cargo/bin/cargo-nextest nextest run --lib --status-level skip",
    "rule": "hung_test",
    "priority": "high",
    "reason": "Hung test process (age 5d 2h, CPU 0%)",
    "signal": "SIGTERM",
    "cpu_percent": 0.0,
    "memory_mb": 3.3,
    "age_hours": 122.5,
    "user": "noah",
    "hostname": "dev-machine",
    "config_file": "/home/noah/.config/reaper/reaper.toml",
    "dry_run": false
  }
]
```

---

**Document Version**: 1.0.0
**Author**: Noah Gift (via Claude Code)
**Date**: 2025-10-31
**Status**: Specification Draft
**Next Steps**: Begin Phase 1 implementation in ruchyruchy project
