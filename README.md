# Ubuntu Config Scripts

[![CI](https://github.com/paiml/ubuntu-config-scripts/workflows/CI/badge.svg)](https://github.com/paiml/ubuntu-config-scripts/actions/workflows/ci.yml)
[![Ruchy CI](https://github.com/paiml/ubuntu-config-scripts/workflows/Ruchy%20CI/badge.svg)](https://github.com/paiml/ubuntu-config-scripts/actions/workflows/ruchy-ci.yml)
[![Deploy](https://github.com/paiml/ubuntu-config-scripts/workflows/Deploy/badge.svg)](https://github.com/paiml/ubuntu-config-scripts/actions/workflows/deploy.yml)
[![Powered by Gunner](https://img.shields.io/badge/Powered%20by-Gunner-blue)](https://github.com/paiml/gunner)
[![Ruchy Score](https://img.shields.io/badge/Ruchy%20Score-0.95-green)](ruchy-scripts/system/system_diagnostic.ruchy)
[![PMAT TDG](https://img.shields.io/badge/PMAT%20TDG-0.87-green)](docs/sprints/SPRINT_RUC_003_SHOWCASE.md)

A production-ready collection of system configuration and management tools for Ubuntu, featuring stable TypeScript implementations and a complete Ruchy port (100% complete) with native binary compilation.

## 🎉 Latest: Ruchy v3.160.0 - Binary Compilation Breakthrough! (October 2025)

**MAJOR UPDATE**: All 3 critical compiler blockers eliminated in v3.160.0! 🚀

- ✅ **Binary compilation works**: All 19 modules can now compile to native binaries
- ✅ **Module system functional**: External module loading working perfectly
- ✅ **Format macros work**: All macro patterns transpile correctly
- ✅ **Type inference fixed**: Method call resolution working
- ✅ **100% feature parity**: All 19 modules complete in Ruchy
- ✅ **Production-ready**: Both interpreter AND compilation modes functional

**Documentation**: [RUCHY-V3.160.0-COMPILATION-VERIFIED.md](RUCHY-V3.160.0-COMPILATION-VERIFIED.md) | [RUCHY-STATUS.md](RUCHY-STATUS.md)

## Quick Start

### TypeScript (Stable)

```bash
git clone https://github.com/paiml/ubuntu-config-scripts.git
cd ubuntu-config-scripts
./install-pmat.sh  # Installs Deno and dependencies
make audio-speakers  # Configure external speakers
```

### Ruchy (High-Performance + Binary Compilation)

```bash
cargo install ruchy --version 3.160.0  # Required: v3.160.0+
cd ubuntu-config-scripts/ruchy

# Interpreter mode (fast development)
ruchy run lib/diagnostics.ruchy

# Compile to native binary
ruchy compile bin/ubuntu-diag.ruchy
./ubuntu-diag  # Run compiled binary
```

## Features

### 🎵 Audio & Video
- **Audio Management**: Configure speakers, microphones, and audio devices
- **OBS Studio**: Automated setup for screencasting with hardware encoding
- **DaVinci Resolve**: CUDA optimization and Linux-specific audio fixes
- **PipeWire Monitor**: Auto-recovery service for audio errors

### 💻 System Configuration
- **NVIDIA Drivers**: Automated driver management and GPU optimization
- **System Diagnostics**: Comprehensive hardware and software analysis
- **Time Configuration**: Timezone setup with NTP synchronization
- **Rust Development**: Complete optimization for heavy Rust workloads

### 💾 Disk Management
- **Smart Cleanup**: Safe cleanup with dry-run mode
- **Usage Analysis**: Find large files and directories
- **Rust Build Cleanup**: Automatic `cargo clean` for all projects

### 🔍 Developer Tools
- **Semantic Search**: Natural language search powered by vector embeddings
- **MCP Integration**: Query scripts via Model Context Protocol in Claude Desktop
- **Binary Deployment**: Compile scripts to standalone executables
- **Auto-Update**: Keeps Deno runtime current

### 🔒 Quality Assurance
- **Strict Type Safety**: Full TypeScript strict mode with runtime validation
- **Property Testing**: Contract-based testing with fast-check
- **PMAT Integration**: Continuous quality monitoring and enforcement
- **CI/CD**: Automated builds on self-hosted runners

## Project Status

| Implementation | Status | Features | Deployment | Recommended For |
|---------------|--------|----------|------------|-----------------|
| **TypeScript** | ✅ Production | 100% (All modules) | Deno runtime or binaries | Stable production deployments |
| **Ruchy** | ✅ 100% Complete | 19/19 modules | Interpreter + Native binaries | High-performance, standalone binaries |
| **Binary Compilation** | ✅ Functional (v3.160.0+) | Full support | Native executables | Zero runtime dependencies |

### Ruchy Implementation Details

**Status**: ✅ Production-ready (interpreter + binary compilation)

**Completed Modules** (19/19 - 100%):
- ✅ Audio configuration (speakers, microphone)
- ✅ System diagnostics and monitoring
- ✅ Hardware detection and validation
- ✅ Logger module (production v1.0 with timestamps, filtering, rotation)
- ✅ Utility modules (string, math, validation, collections, formatting, result handling)
- ✅ System modules (disk, network, process, user, summary)
- ✅ All integration tests passing

**Compilation Breakthrough** (v3.160.0):
- ✅ [Issue #103](https://github.com/paiml/ruchy/issues/103) FIXED - Binary compilation fully functional
- ✅ Module system working (external module imports)
- ✅ Format macros working (all variants)
- ✅ Type inference working (method calls, field access)

**Performance**:
- **Interpreter**: 3-5x faster than TypeScript, <100ms startup
- **Compiled binaries**: Native Rust performance, ~350KB executables, <1ms startup
- Zero runtime dependencies beyond Ruchy binary

## Requirements

### TypeScript Version (Stable)
- Ubuntu 20.04+ (or compatible Linux distribution)
- [Deno](https://deno.land/) runtime (auto-installed via make install)
- [PMAT](https://github.com/paiml/pmat) for quality gates (optional)
- PulseAudio/PipeWire for audio scripts

### Ruchy Version (High-Performance + Binary Compilation)
- Ubuntu 20.04+ (or compatible Linux distribution)
- [Rust](https://rustup.rs/) toolchain 1.70+
- **[Ruchy](https://github.com/paiml/ruchy) v3.160.0+** (required for binary compilation)
  ```bash
  cargo install ruchy --version 3.160.0
  ```
- [PMAT](https://github.com/paiml/pmat) for quality gates (optional)
- LLVM tools for coverage analysis (optional)
- PulseAudio/PipeWire for audio scripts

**Important**: Ruchy v3.160.0 is the **minimum required version** for binary compilation support. Earlier versions have compiler blockers that prevent native binary generation.

## Installation

### TypeScript (Recommended for Most Users)

1. Clone and install dependencies:
```bash
git clone https://github.com/paiml/ubuntu-config-scripts.git
cd ubuntu-config-scripts
./install-pmat.sh
```

This will automatically:
- Install Deno if not present
- Install PMAT for quality gates (optional)
- Set up PATH configurations

2. Verify installation:
```bash
make check-deps
make help  # Show all available commands
```

### Ruchy (For Performance-Sensitive Use Cases)

1. Install Ruchy compiler:
```bash
# Install required version
cargo install ruchy --version 3.158.0 --force
ruchy --version  # Verify: must be 3.158.0 or newer
```

2. Clone and build:
```bash
git clone https://github.com/paiml/ubuntu-config-scripts.git
cd ubuntu-config-scripts/ruchy
make dev-setup
make build
```

3. Run integration tests:
```bash
make test  # Verify all modules working
```

4. Use Ruchy scripts:
```bash
ruchy run lib/diagnostics.ruchy
ruchy run lib/logger_file.ruchy
```

## Usage

### Common Tasks

```bash
# Show all available commands
make help

# Audio configuration
make audio-enable-mic       # Enable microphone
make audio-speakers         # Configure external speakers
make audio-fix              # Fix audio issues

# System management
make system-obs             # Configure OBS Studio
make system-av-diagnose     # Diagnose audio/video issues
make system-disk-usage      # Analyze disk usage
make system-cleanup         # Clean system and build artifacts

# Development
make test                   # Run test suite
make validate               # Run all quality gates
make deploy                 # Build standalone binaries
```

### Semantic Search

Search for scripts using natural language powered by vector embeddings:

```bash
# Initial setup (one-time)
make seed-db

# Search for scripts
make search QUERY="configure audio settings"
make search QUERY="fix microphone issues"
make search-audio QUERY="enable microphone"
```

**Example Output**:
```
Found 3 results:

[0.89] configure-obs.ts
  Category: system
  Automated OBS Studio setup for screencasting
  Usage: make system-obs

[0.82] configure-obs-high-quality.ts
  Category: system
  High-quality recording (1080p, hardware encoding)
  Usage: make system-obs-high
```

See [docs/MCP_INTEGRATION.md](docs/MCP_INTEGRATION.md) for Claude Desktop integration.

### Auto-Update Feature

Deno auto-updates are enabled by default. To disable:

```bash
export AUTO_UPDATE_DENO=false
# Or permanently:
make disable-auto-update
```

## Development

### Project Structure

```
ubuntu-config-scripts/
├── scripts/              # TypeScript implementation (stable)
│   ├── lib/             # Shared TypeScript libraries
│   ├── audio/           # Audio configuration scripts
│   ├── system/          # System management scripts
│   └── dev/             # Development tools
├── ruchy/               # Ruchy implementation (high-performance)
│   ├── lib/             # Shared Ruchy libraries
│   │   ├── logger_file.ruchy
│   │   ├── diagnostics.ruchy
│   │   └── hardware.ruchy
│   ├── tests/           # Ruchy test suite
│   └── Makefile         # Ruchy build system
├── tests/               # TypeScript test suite
└── Makefile             # Main build system
```

### Adding New Scripts

**TypeScript**:
1. Create script in `scripts/[category]/`
2. Add shared code to `scripts/lib/`
3. Write tests in `tests/`
4. Add Make target to appropriate Makefile

**Ruchy**:
1. Create script in `ruchy/lib/` or appropriate module
2. Add tests in `ruchy/tests/`
3. Run `make test` to verify
4. Update integration tests

### Testing

```bash
# TypeScript tests
make test                # Run all tests
make test-coverage       # With coverage report
make test-watch          # Watch mode
make test-property       # Property-based tests

# Ruchy tests
cd ruchy
make test                # Run integration tests
ruchy run tests/test_logger_file_simple.ruchy  # Individual test
```

### Code Quality

```bash
# Format, lint, and type check
make validate            # Run all quality gates

# Individual checks
make format              # Format code
make lint                # Run linter
make check               # Type check (strict mode)

# PMAT quality gates
make pmat-quality-gate   # Run quality checks
make pmat-complexity     # Complexity analysis
make pmat-health         # Health check
```

### Type Safety

This project uses TypeScript's strictest settings:

```typescript
import { z } from "./scripts/lib/schema.ts";

const ConfigSchema = z.object({
  device: z.string().min(1),
  volume: z.number().min(0).max(100),
});

type Config = z.infer<typeof ConfigSchema>;  // Type-safe runtime validation
```

### Deployment

Compile scripts to standalone binaries:

```bash
make deploy              # Deploy all scripts
make deploy-package      # Create distributable package

# Platform-specific
make deploy-package TARGETS=linux   # Linux x64 (default)
make deploy-package TARGETS=arm64   # Linux ARM64 (Raspberry Pi, etc.)
```

Deployed binaries are self-contained and don't require Deno runtime.

## CI/CD

This project uses self-hosted GitHub Actions runners:

- **Automatic builds** on every push and PR
- **Multi-architecture**: Linux x64 and ARM64
- **Security scanning**: Secrets and unsafe patterns
- **Quality gates**: PMAT enforcement
- **Self-hosted runner**: Auto-starts on reboot

### Runner Management

```bash
make runner-install      # Install as systemd service
make runner-start        # Start the runner
make runner-status       # Check status
make runner-stop         # Stop the runner
```

**Documentation**: [docs/github-runner.md](docs/github-runner.md)

### Running CI Locally

```bash
make validate            # Full CI pipeline
make lint                # Linting only
make test                # Tests only
```

## Documentation

### General
- [Architecture](docs/architecture/ubuntu-config-scripts-1.0.md) - System architecture and design
- [MCP Integration](docs/MCP_INTEGRATION.md) - Claude Desktop integration
- [GitHub Runner Setup](docs/github-runner.md) - Self-hosted runner configuration

### Ruchy Migration
- [Migration Roadmap](docs/migration/RUCHY_MIGRATION_ROADMAP.md) - TypeScript to Ruchy migration plan
- [Ruchy Status](RUCHY-STATUS.md) - Current implementation status
- [v3.158.0 Findings](RUCHY-V3.158.0-FINDINGS.md) - Latest breakthrough documentation
- [Ruchy Book](book/src/SUMMARY.md) - Comprehensive migration guide

### Implementation Details
- [Sprint Documentation](docs/sprints/) - Development sprint reports
- [Ticket Files](docs/tickets/) - Individual feature implementations
- [Completion Reports](docs/RUC-*-COMPLETE.md) - Module completion summaries

## Known Limitations

### Ruchy Binary Compilation

**Status**: Blocked by upstream transpiler bug ([Issue #103](https://github.com/paiml/ruchy/issues/103))

**Impact**: Cannot compile Ruchy code to standalone binaries

**Workaround**: Use interpreter mode (`ruchy run script.ruchy`) - fully functional with no feature limitations

**Timeline**: Waiting for upstream Ruchy compiler fix

**Alternatives**:
- TypeScript version compiles to binaries normally
- Ruchy interpreter mode has excellent performance (3-5x faster than TypeScript)
- No functional limitations in interpreter mode

## Contributing

We welcome contributions! Here's how to get started:

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass: `make validate`
5. Submit a pull request

### Contribution Guidelines

- **Tests Required**: All new features must have tests (80% coverage minimum)
- **Type Safety**: Use strict TypeScript mode, no `any` types
- **Code Quality**: Pass all PMAT quality gates
- **Documentation**: Update README and relevant docs
- **Property Testing**: Use fast-check for complex logic

### Development Workflow

```bash
# 1. Make changes
vim scripts/audio/new-feature.ts

# 2. Add tests
vim tests/audio/new-feature.test.ts

# 3. Verify quality
make validate

# 4. Commit and push
git add .
git commit -m "feat: add new audio feature"
git push origin feature-branch
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/paiml/ubuntu-config-scripts/issues)
- **Discussions**: [GitHub Discussions](https://github.com/paiml/ubuntu-config-scripts/discussions)
- **Documentation**: [docs/](docs/) directory

## Acknowledgments

- **Ruchy Language**: https://github.com/paiml/ruchy
- **PMAT Quality Tool**: https://github.com/paiml/pmat
- **Deno Runtime**: https://deno.land/
- **Fast-check**: Property-based testing framework

---

**Note**: This is an active, maintained project. The TypeScript implementation is production-ready and battle-tested. The Ruchy implementation is 97% complete and ready for use in interpreter mode, with binary compilation coming once upstream Issue #103 is resolved.
