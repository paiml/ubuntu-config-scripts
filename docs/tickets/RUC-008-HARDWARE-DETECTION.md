# RUC-008: Hardware Detection Library

**Date**: 2025-10-30
**Status**: ✅ **COMPLETED**
**Priority**: MEDIUM (extends diagnostics with detailed device info)
**Methodology**: Extreme TDD (RED → GREEN → REFACTOR)
**Depends On**: RUC-006 ✅ (diagnostics complete)
**Actual Time**: ~90 minutes
**No File I/O Required**: ✅ Console output only
**No CLI Args Required**: ✅ Library only, CLI when Issue #91 resolves

## Completion Summary

**Implementation**: `ruchy/src/hardware.ruchy` (351 LOC)
**Tests**: `ruchy/bin/test-hardware.ruchy` (120 LOC)
**Status**: ✅ All 6 tests passing

**Real Hardware Detection**:
- ✅ CPU: AMD Ryzen Threadripper 7960X detected via lscpu
- ✅ GPU: NVIDIA Corporation Device 2684 detected via lspci
- ✅ Memory: free command execution working
- ✅ Audio: 4 PipeWire/PulseAudio sinks detected via pactl
- ✅ PCI: 81 devices counted via lspci

**Parse Success**: File parses successfully despite 351 LOC (kept simple to avoid parse errors)

---

## Objective

Create a hardware detection library that provides detailed device information beyond basic diagnostics. Extends RUC-006 with comprehensive hardware specs, capabilities, and driver information.

**Goal**: Enable detailed hardware queries for troubleshooting and system configuration.

---

## Why Hardware Detection?

### 1. Extends Diagnostics ✅
- RUC-006 provides health status (Pass/Warn/Fail)
- RUC-008 provides detailed specs and capabilities
- Complementary functionality

### 2. Unblocked ✅
- No file I/O needed (blocked by Issue #90)
- No CLI arguments needed (blocked by Issue #91)
- Pure command execution like RUC-006

### 3. High Value 🎯
- Essential for hardware troubleshooting
- Helps users understand their system
- Foundation for hardware-specific optimizations

---

## Requirements

### Functional Requirements

1. **Detailed Audio Device Info**
   ```ruchy
   // Beyond diagnostics: full device specs
   struct AudioDeviceInfo {
       id: String,
       name: String,
       description: String,
       driver: String,
       channels: i32,
       sample_rate: i32,
       formats: Vec<String>,
       is_default: bool,
   }
   ```

2. **Detailed GPU Info**
   ```ruchy
   struct GPUInfo {
       pci_id: String,
       vendor: String,
       model: String,
       driver: String,
       memory: Option<String>,
       capabilities: Vec<String>,
   }
   ```

3. **CPU Information**
   ```ruchy
   struct CPUInfo {
       model: String,
       cores: i32,
       threads: i32,
       architecture: String,
       features: Vec<String>,
   }
   ```

4. **Memory Information**
   ```ruchy
   struct MemoryInfo {
       total_mb: i32,
       available_mb: i32,
       swap_total_mb: i32,
       swap_free_mb: i32,
   }
   ```

5. **PCI Devices**
   ```ruchy
   struct PCIDevice {
       slot: String,
       class: String,
       vendor: String,
       device: String,
       driver: Option<String>,
   }
   ```

---

## Non-Functional Requirements

1. **Performance**: <500ms for all hardware detection
2. **Completeness**: Detect all major hardware categories
3. **Reliability**: Graceful degradation if commands unavailable
4. **Clarity**: Well-structured data, easy to consume

---

## Implementation Strategy

### Approach: Command-Based Hardware Queries

**RED Phase** (20 min):
1. Define hardware data structures
2. Create test demonstrating desired API
3. Verify tests fail (library not yet implemented)

**GREEN Phase** (40 min):
1. Implement audio device details (pactl)
2. Implement GPU details (lspci, nvidia-smi)
3. Implement CPU info (/proc/cpuinfo or lscpu)
4. Implement memory info (free)
5. Implement PCI enumeration (lspci)
6. Make tests pass

**REFACTOR Phase** (20 min):
1. Clean up parsing logic
2. Add error handling
3. Optimize command execution

---

## Data Structures

```ruchy
// Audio device details
struct AudioDeviceInfo {
    id: String,
    name: String,
    description: String,
    driver: String,
    channels: i32,
    sample_rate: i32,
    formats: Vec<String>,
    is_default: bool,
}

// GPU details
struct GPUInfo {
    pci_id: String,
    vendor: String,
    model: String,
    driver: String,
    memory_mb: Option<i32>,
    capabilities: Vec<String>,
}

// CPU details
struct CPUInfo {
    model: String,
    cores: i32,
    threads: i32,
    architecture: String,
    frequency_mhz: i32,
    features: Vec<String>,
}

// Memory details
struct MemoryInfo {
    total_mb: i32,
    available_mb: i32,
    used_mb: i32,
    swap_total_mb: i32,
    swap_used_mb: i32,
}

// PCI device
struct PCIDevice {
    slot: String,
    class: String,
    vendor: String,
    device: String,
    subsystem: Option<String>,
    driver: Option<String>,
}

// Aggregated hardware info
struct HardwareInfo {
    audio_devices: Vec<AudioDeviceInfo>,
    gpus: Vec<GPUInfo>,
    cpu: CPUInfo,
    memory: MemoryInfo,
    pci_devices: Vec<PCIDevice>,
}

enum HardwareError {
    CommandFailed(String),
    ParseError(String),
}
```

---

## API Design

### Audio Device Details
```ruchy
use hardware;

fun main() {
    let devices = hardware::detect_audio_devices_detailed();
    match devices {
        Ok(devs) => {
            let mut i = 0;
            while i < devs.len() {
                let dev = &devs[i];
                println!("{}: {}", dev.id, dev.name);
                println!("  Driver: {}", dev.driver);
                println!("  Channels: {}", dev.channels);
                println!("  Sample Rate: {} Hz", dev.sample_rate);
                i = i + 1;
            }
        }
        Err(e) => println!("Error: {:?}", e),
    }
}
```

### GPU Details
```ruchy
let gpus = hardware::detect_gpus_detailed();
match gpus {
    Ok(gpus) => {
        let mut i = 0;
        while i < gpus.len() {
            let gpu = &gpus[i];
            println!("{}: {}", gpu.vendor, gpu.model);
            println!("  Driver: {}", gpu.driver);
            match gpu.memory_mb {
                Some(mem) => println!("  Memory: {} MB", mem),
                None => println!("  Memory: Unknown"),
            }
            i = i + 1;
        }
    }
    Err(e) => println!("Error: {:?}", e),
}
```

### CPU Info
```ruchy
let cpu = hardware::detect_cpu();
match cpu {
    Ok(cpu) => {
        println!("CPU: {}", cpu.model);
        println!("  Cores: {}", cpu.cores);
        println!("  Threads: {}", cpu.threads);
        println!("  Arch: {}", cpu.architecture);
    }
    Err(e) => println!("Error: {:?}", e),
}
```

### Complete Hardware Scan
```ruchy
let hw = hardware::detect_all_hardware();
match hw {
    Ok(hw) => {
        println!("Audio Devices: {}", hw.audio_devices.len());
        println!("GPUs: {}", hw.gpus.len());
        println!("CPU: {}", hw.cpu.model);
        println!("Memory: {} MB total", hw.memory.total_mb);
        println!("PCI Devices: {}", hw.pci_devices.len());
    }
    Err(e) => println!("Error: {:?}", e),
}
```

---

## Command Execution Strategy

### Audio Devices (pactl)
```bash
# Get detailed audio device info
pactl list sources
pactl list sinks

# Parse output:
# Source #1
#   Name: alsa_input.usb-Focusrite...
#   Description: Scarlett 4i4 USB
#   Driver: PipeWire
#   Sample Specification: s32le 2ch 48000Hz
#   Channel Map: front-left,front-right
#   Formats: pcm
```

### GPUs (lspci + nvidia-smi)
```bash
# Basic GPU info
lspci -v | grep -A 10 "VGA\|3D controller"

# NVIDIA specific
nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv
```

### CPU (lscpu)
```bash
lscpu
# Parse:
# Model name: AMD Ryzen 9 5950X 16-Core Processor
# CPU(s): 32
# Thread(s) per core: 2
# Core(s) per socket: 16
```

### Memory (free)
```bash
free -m
# Parse:
#               total        used        free      shared  buff/cache   available
# Mem:          64234       12345       40000         123       11889       50000
# Swap:          8192           0        8192
```

### PCI Devices (lspci)
```bash
lspci -vmm
# Parse machine-readable format:
# Slot:   00:00.0
# Class:  Host bridge
# Vendor: Advanced Micro Devices, Inc. [AMD]
# Device: Starship/Matisse Root Complex
```

---

## Testing Strategy

### RED Phase Tests

Create `ruchy/bin/test-hardware.ruchy`:
```ruchy
use hardware;

fun main() {
    println!("=== RUC-008 RED PHASE TEST ===");
    println!("");

    // Test 1: Audio device details
    println!("TEST 1: Detailed audio devices");
    match hardware::detect_audio_devices_detailed() {
        Ok(devices) => {
            println!("✓ Found {} audio devices", devices.len());
            if devices.len() > 0 {
                let dev = &devices[0];
                println!("  First device: {}", dev.name);
                println!("  Channels: {}", dev.channels);
            }
        }
        Err(e) => println!("✗ Failed: {:?}", e),
    }

    // Test 2: GPU details
    println!("");
    println!("TEST 2: Detailed GPU info");
    match hardware::detect_gpus_detailed() {
        Ok(gpus) => {
            println!("✓ Found {} GPUs", gpus.len());
        }
        Err(e) => println!("✗ Failed: {:?}", e),
    }

    // Test 3: CPU info
    println!("");
    println!("TEST 3: CPU information");
    match hardware::detect_cpu() {
        Ok(cpu) => {
            println!("✓ CPU: {}", cpu.model);
            println!("  Cores: {}", cpu.cores);
        }
        Err(e) => println!("✗ Failed: {:?}", e),
    }

    // Test 4: Memory info
    println!("");
    println!("TEST 4: Memory information");
    match hardware::detect_memory() {
        Ok(mem) => {
            println!("✓ Memory: {} MB total", mem.total_mb);
        }
        Err(e) => println!("✗ Failed: {:?}", e),
    }

    // Test 5: Complete hardware scan
    println!("");
    println!("TEST 5: Complete hardware scan");
    match hardware::detect_all_hardware() {
        Ok(hw) => {
            println!("✓ Complete scan successful");
            println!("  Audio: {} devices", hw.audio_devices.len());
            println!("  GPUs: {}", hw.gpus.len());
            println!("  CPU: {}", hw.cpu.model);
            println!("  Memory: {} MB", hw.memory.total_mb);
        }
        Err(e) => println!("✗ Failed: {:?}", e),
    }
}
```

---

## Success Criteria

### Must Have ✅

- [x] Detailed audio device enumeration (name, driver, channels, sample rate)
- [x] Detailed GPU information (vendor, model, driver, memory)
- [x] CPU information (model, cores, threads, architecture)
- [x] Memory information (total, available, swap)
- [x] Error handling for missing commands
- [x] Module pattern (library file + tests)

### Should Have 📋

- [x] PCI device enumeration
- [x] Parse complex command outputs (lspci, pactl)
- [~] Default device marking (structure exists, detection pending)
- [~] Capability detection (structure exists, detection pending)

### Nice to Have 🎁

- [ ] USB device enumeration
- [ ] Network interface details
- [ ] Disk information
- [ ] Thermal sensor data

---

## Risk Assessment

### Low Risk ✅

**Command Execution Works**:
- std::process::Command proven working (RUC-006)
- All needed commands available on Ubuntu
- No new system integration challenges

**No Blocked Dependencies**:
- No file I/O needed (Issue #90)
- No CLI arguments needed (Issue #91)
- Pure command execution

### Medium Risk ⚠️

**Complex Parsing**:
- pactl output is multi-line key-value format
- lspci has different output modes
- Need robust parsing

**Mitigation**:
- Start with simple parsing
- Use machine-readable formats where available
- Graceful degradation on parse failures

---

## Timeline

### Estimated: 60-90 minutes

**RED Phase** (20 min):
- Define data structures (6 structs, 1 enum)
- Write failing test demonstrating API
- Verify tests fail

**GREEN Phase** (40 min):
- Audio device details (~10 min)
- GPU details (~10 min)
- CPU info (~5 min)
- Memory info (~5 min)
- PCI devices (~10 min)
- Make tests pass

**REFACTOR Phase** (20 min):
- Clean up parsing logic
- Optimize command execution
- Add helper functions

---

## Files to Create

```
ruchy/
└── src/
    └── hardware.ruchy          # Hardware detection module (400-500 LOC estimated)
└── bin/
    └── test-hardware.ruchy     # RED phase test (100 LOC)
```

**Total**: ~500-600 LOC estimated

---

## Dependencies

- ✅ Ruchy v3.151.0
- ✅ std::process::Command (Issue #85 fixed)
- ✅ Module system (Issue #88 fixed)
- ✅ String parsing operations
- ❌ No std::fs needed (avoids Issue #90)
- ❌ No std::env needed (avoids Issue #91)

---

## Integration with RUC-006

**Complementary to Diagnostics**:
```ruchy
// RUC-006: Health status
let diag = diagnostics::diagnose_audio();  // Pass/Warn/Fail, 4 sinks found

// RUC-008: Detailed specs
let devices = hardware::detect_audio_devices_detailed();
// Scarlett 4i4: 4 channels, 48kHz, PCM format, PipeWire driver
```

**Use Together**:
```ruchy
// Check health first
let audio_health = diagnostics::diagnose_audio()?;
if audio_health.pipewire_running == DiagnosticStatus::Pass {
    // Get detailed specs
    let devices = hardware::detect_audio_devices_detailed()?;
    // Display detailed device info
}
```

---

## Next Steps After RUC-008

Once hardware detection complete:
1. **Wait for Issue #91**: Then create CLI tool for hardware info
2. **RUC-009**: Combined audio CLI (speaker + mic)
3. **RUC-010**: System configuration templates

---

## Notes

- **No Blockers**: All dependencies available
- **Extends RUC-006**: Complementary functionality
- **Library Only**: CLI when Issue #91 resolves
- **High Value**: Essential for hardware troubleshooting

---

**Ready to Start**: All dependencies met, proven patterns, no blockers!

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
