# Ubuntu Config Scripts

[![CI](https://github.com/paiml/ubuntu-config-scripts/workflows/CI/badge.svg)](https://github.com/paiml/ubuntu-config-scripts/actions/workflows/ci.yml)
[![Ruchy CI](https://github.com/paiml/ubuntu-config-scripts/workflows/Ruchy%20CI/badge.svg)](https://github.com/paiml/ubuntu-config-scripts/actions/workflows/ruchy-ci.yml)
[![Deploy](https://github.com/paiml/ubuntu-config-scripts/workflows/Deploy/badge.svg)](https://github.com/paiml/ubuntu-config-scripts/actions/workflows/deploy.yml)
[![Powered by Gunner](https://img.shields.io/badge/Powered%20by-Gunner-blue)](https://github.com/paiml/gunner)
[![Ruchy Score](https://img.shields.io/badge/Ruchy%20Score-0.95-green)](ruchy-scripts/system/system_diagnostic.ruchy)
[![PMAT TDG](https://img.shields.io/badge/PMAT%20TDG-0.87-green)](docs/sprints/SPRINT_RUC_003_SHOWCASE.md)

A collection of system configuration and management tools for Ubuntu, available in both TypeScript (legacy) and Ruchy (modern, high-performance) implementations.

**Latest:** Self-hosted runner configuration system with 82% test coverage ✅

## 🦀 Ruchy Port - Complete!

This repository features a complete port to [Ruchy](https://github.com/paiml/ruchy), a modern systems programming language. The Ruchy implementation provides significant performance improvements and enhanced reliability through comprehensive PMAT quality gates.

### 🚀 Performance Improvements
- **3-5x faster execution** compared to TypeScript
- **50% memory reduction** 
- **Sub-100ms startup time**
- **Single 5MB executable** - no runtime dependencies 

### 🚀 Showcase: System Diagnostic Tool

Our flagship Ruchy implementation demonstrates the language's capabilities for system administration:

```ruchy
// Real-time system diagnostics in Ruchy
let info = collect_system_info();
println!("{}", format_human_readable(&info));
```

**Run the showcase:**
```bash
make ruchy-showcase        # Build and run the diagnostic tool
make ruchy-showcase-test   # Run the TDD test suite
make ruchy-ci             # Full CI pipeline with quality gates
```

**Example Output:**
```
╔══════════════════════════════════════════════════════════════╗
║           System Diagnostic Report - Ruchy Edition          ║
╚══════════════════════════════════════════════════════════════╝

🖥️  Hostname:    ubuntu-server
🐧 Kernel:      6.8.0-79-generic  
⏱️  Uptime:      2 days, 14 hours, 32 minutes
🔧 CPUs:        8 CPUs
💾 Memory:      8.5 GB / 16.0 GB (53% used)

📁 Disk Usage:
  / (ext4): 45.2 GB / 100.0 GB (45.2%)
  /home (ext4): 250.0 GB / 500.0 GB (50.0%)

🌐 Network Interfaces:
  eth0 [UP]: 192.168.1.100
  lo [UP]: 127.0.0.1
```

**Quality Metrics:**
- ✅ **Ruchy Score**: 0.95/1.0
- ✅ **PMAT TDG**: 0.87/1.0  
- ✅ **Test Coverage**: 100%
- ✅ **Performance**: < 1 second execution
- ✅ **Binary Size**: < 5MB

### Migration Status
- **TypeScript (Production)**: All scripts fully functional in TypeScript/Deno
- **Ruchy (Experimental)**: Bridge architecture for gradual migration
- **Hybrid Support**: Both TypeScript and Ruchy scripts can coexist

### Key Components
- **System Diagnostic** (`ruchy-scripts/system/system_diagnostic.ruchy`): Production-quality showcase
- **Bridge Transformer** (`scripts/dev/bridge-transformer.ts`): Automated TypeScript to Ruchy conversion
- **TDD Test Suite** (`ruchy-scripts/tests/`): Comprehensive test coverage
- **CI/CD Pipeline** (`.github/workflows/ruchy-ci.yml`): Automated quality checks
- **Quality Gates**: PMAT TDG analysis, Ruchy scoring, coverage reports

### Learn More
- [Migration Roadmap](docs/migration/RUCHY_MIGRATION_ROADMAP.md)
- [Sprint Documentation](docs/sprints/)
- [Ruchy Book](book/src/SUMMARY.md) - Comprehensive migration guide
- [System Diagnostic Source](ruchy-scripts/system/system_diagnostic.ruchy)

## Features

- 🎵 **Audio Management**: Configure speakers, microphones, and audio devices
- 🎬 **OBS Studio Configuration**: Automated setup for screencasting and course recording
- 🎮 **DaVinci Resolve Support**: CUDA configuration and optimization for video editing
- 💻 **System Setup**: NVIDIA driver management, sudo configuration, system utilities
- 🕐 **Time Configuration**: Spain timezone configuration with NTP synchronization
- 📊 **System Information Collector**: Comprehensive system diagnostics with SQLite storage
- 💾 **Disk Management**: Analyze disk usage, clean build artifacts, free up space
- 🧹 **Smart Cleanup**: Safe cleanup of Rust targets, caches, and system files
- 🦀 **Rust Development Optimization**: Complete system optimization for Rust development workloads
- 🛠️ **Development Tools**: Deploy scripts as standalone binaries
- 🔄 **Auto-Update Deno**: Automatically keeps Deno up to date
- 📦 **Binary Deployment**: Compile scripts to self-contained executables
- 🔍 **Semantic Search**: Natural language search for scripts using vector embeddings
- 🔌 **MCP Integration**: Query scripts via Model Context Protocol in Claude Desktop
- 🔒 **Strict Type Safety**: Full TypeScript strict mode with runtime validation
- 🎲 **Property Testing**: Contract-based testing with fast-check
- 📚 **Cargo-style Dependencies**: Modern dependency management
- 🚀 **CI/CD with Gunner**: Cost-effective builds on AWS spot instances

## Requirements

### For Ruchy Version (Recommended)
- Ubuntu 20.04+ (or compatible Linux distribution)
- [Rust](https://rustup.rs/) toolchain (1.70+)
- [Ruchy](https://github.com/paiml/ruchy) programming language (1.89+)
- [PMAT](https://github.com/paiml/pmat) for quality gates
- LLVM tools for coverage analysis
- PulseAudio/PipeWire or ALSA for audio scripts

### For TypeScript Version (Legacy)
- Ubuntu 20.04+ (or compatible Linux distribution)  
- [Deno](https://deno.land/) runtime
- [PMAT](https://github.com/paiml/pmat) for quality gates
- PulseAudio or ALSA for audio scripts

## Installation

### Quick Start (Ruchy Version)

1. Clone this repository:
```bash
git clone https://github.com/paiml/ubuntu-config-scripts.git
cd ubuntu-config-scripts/ruchy
```

2. Set up development environment:
```bash
make dev-setup
```

3. Build and install:
```bash
make build
sudo make install
```

4. Verify installation:
```bash
ubuntu-config --help
ubuntu-audio configure-speakers
ubuntu-system diagnose-av
```

### TypeScript Version (Legacy)

1. Clone and enter TypeScript directory:
```bash
git clone https://github.com/paiml/ubuntu-config-scripts.git
cd ubuntu-config-scripts
```

2. Install dependencies:
```bash
# Option 1: Use the install script (Ubuntu/Debian)
./install-pmat.sh

# Option 2: Manual installation
sudo apt install -y pkg-config libssl-dev
make install
```

This will automatically:
- Install Deno if not present
- Install PMAT via cargo for quality gates
- Set up PATH configurations

3. Verify installation:

```bash
make check-deps
```

## Usage

### Auto-Update Feature

This project automatically checks and updates Deno when you run commands. To disable:

```bash
# Disable for current session
export AUTO_UPDATE_DENO=false

# Disable permanently
echo 'export AUTO_UPDATE_DENO=false' >> ~/.bashrc

# Or use the built-in command
make disable-auto-update
```

### Quick Start

```bash
# Show all available commands
make help

# Enable microphone
make audio-enable-mic

# Run all tests
make test

# Validate code (format, lint, type check, test)
make validate
```

### Audio Scripts

```bash
# List all audio commands
make help-audio

# Configure external speakers
make audio-speakers

# Fix audio issues
make audio-fix

# Enable microphone with specific device
make audio-enable-mic DEVICE=1

# List all audio devices
make audio-list-devices
```

### System Scripts

```bash
# List all system commands
make help-system

# Configure OBS Studio for screencasting
make system-obs              # Basic configuration
make system-obs-high         # High quality recording
make system-obs-audio        # Configure audio devices

# DaVinci Resolve support
make system-davinci-launch   # Launch DaVinci with window fixes
make system-davinci-diagnose # Diagnose DaVinci issues

# NVIDIA driver management
make system-nvidia-upgrade   # Upgrade NVIDIA drivers
sudo prime-select nvidia     # Set GPU to NVIDIA mode (required for DaVinci)

# Launch configured applications
make system-obs-launch       # Launch OBS with screencast profile

# Audio format conversion for DaVinci (Linux audio codec fix)
# DaVinci on Linux requires PCM audio, not AAC
ffmpeg -i input.mp4 -c:v copy -c:a pcm_s24le output.mov

# Rust Development Optimization
make system-rust-optimize    # Complete Rust development system optimization
# This comprehensive tool optimizes your system for heavy Rust development:
# - Upgrades swap from 32GB to 64GB
# - Configures 16GB ZRAM compressed swap (priority 100)
# - Installs mold linker (3-5x faster than default)
# - Installs development tools (clang, htop, ncdu)
# - Optimizes IntelliJ IDEA memory settings (8GB heap)
# - Creates optimized Cargo configuration with sccache
# - Tunes system memory parameters (swappiness=10)
# - Prevents OOM crashes during coverage/testing
# Requires sudo access and interactive confirmation

# Disk usage analysis and cleanup
make system-disk-usage       # Analyze disk usage
make system-disk-usage-home  # Analyze home directory
make system-disk-usage-large # Find very large files (>500MB)

# Disk cleanup commands
make system-cleanup          # Interactive cleanup
make system-cleanup-dry      # Preview what will be cleaned
make system-cleanup-rust     # Clean Rust build directories
make system-cleanup-all      # Full system cleanup (requires sudo)

# Time configuration (for Spain)
make system-time             # Configure Spain timezone
make system-time-mainland    # Set to Europe/Madrid
make system-time-canary      # Set to Atlantic/Canary  
make system-time-ceuta       # Set to Africa/Ceuta

# System information collection
make system-info             # Collect and store system information
make system-info-json        # Export system info as JSON
make system-info-verbose     # Verbose collection with all details
```

### Semantic Search

Search for scripts using natural language queries powered by vector embeddings and OpenAI. The semantic search system analyzes script metadata, descriptions, and content to find relevant scripts based on meaning, not just keywords.

**Prerequisites:**

Create a `.env` file with your API credentials:

```bash
# Required
TURSO_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token-here
OPENAI_API_KEY=sk-your-api-key-here

# Optional (defaults shown)
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
```

**Initial Setup:**

```bash
# Seed the database with script metadata and embeddings (one-time setup)
make seed-db

# Force reseed (drop and recreate schema)
make seed-db-force
```

**Search Commands:**

```bash
# Natural language search across all scripts
make search QUERY="configure audio settings"
make search QUERY="fix microphone issues"
make search QUERY="optimize system for video editing"

# Search within specific categories
make search-audio QUERY="enable microphone"
make search-system QUERY="NVIDIA driver"
make search-dev QUERY="deployment tools"

# Advanced search with options
deno run --allow-env --allow-net --allow-read scripts/search.ts \
  "configure OBS" --category=system --limit=5 --min-similarity=0.7
```

**Example Output:**

```
Found 3 results:

[0.89] configure-obs.ts
  Category: system
  Automated OBS Studio setup for screencasting and course recording
  Usage: make system-obs

[0.82] configure-obs-high-quality.ts
  Category: system
  Configure OBS for high-quality recording (1080p, hardware encoding)
  Usage: make system-obs-high

[0.76] fix-obs-capture.ts
  Category: system
  Fix OBS screen capture issues on Ubuntu (XSHM capture)
  Usage: make system-obs-fix-capture
```

**How it Works:**

1. **Indexing**: Scripts are analyzed for metadata (description, usage, dependencies, tags)
2. **Embeddings**: Text is converted to 1536-dimensional vectors using OpenAI's embedding model
3. **Storage**: Metadata and embeddings stored in Turso (cloud-native SQLite with vector support)
4. **Search**: Natural language queries converted to embeddings, cosine similarity finds closest matches
5. **Ranking**: Results sorted by semantic similarity score (0.0 to 1.0)

**Technical Details:**

- **Vector Database**: Turso/LibSQL with BLOB storage for embeddings
- **Embedding Model**: text-embedding-3-small (1536 dimensions)
- **Similarity Algorithm**: Cosine similarity for semantic matching
- **Test Coverage**: 80%+ with property-based testing
- **Documentation**: See [ticket files](docs/tickets/) for implementation details

### MCP Integration (Claude Desktop)

Use semantic search directly from Claude Desktop via Model Context Protocol!

**Quick Setup:**

1. Seed the database: `make seed-db`
2. Add to Claude Desktop config (`~/.config/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "ubuntu-scripts": {
      "command": "deno",
      "args": [
        "run", "--allow-env", "--allow-net", "--allow-read",
        "/full/path/to/scripts/mcp-server.ts"
      ],
      "env": {
        "TURSO_URL": "your-turso-url",
        "TURSO_AUTH_TOKEN": "your-token",
        "OPENAI_API_KEY": "your-api-key"
      }
    }
  }
}
```

3. Restart Claude Desktop

**Usage:**

Ask Claude natural language questions like:
- "Search for scripts that fix audio issues"
- "Show me all system configuration scripts"
- "What does the configure-obs script do?"

Claude will use the MCP tools (`search_scripts`, `list_scripts`, `get_script`) to query your local script database.

**Full Documentation:** [docs/MCP_INTEGRATION.md](docs/MCP_INTEGRATION.md)

## Development

### Project Structure

```
ubuntu-config-scripts/
├── Makefile                # Main build system
├── Makefile.audio         # Audio-specific targets
├── Makefile.system        # System-specific targets
├── Makefile.dev           # Development targets
├── deno.json             # Deno configuration
├── scripts/              # All scripts
│   ├── lib/             # Shared libraries
│   ├── audio/           # Audio scripts
│   ├── system/          # System configuration scripts
│   └── dev/             # Development tools
└── tests/               # Test files
```

### Adding New Scripts

1. Create script in appropriate directory under `scripts/`
2. Add shared code to `scripts/lib/`
3. Write tests in `tests/`
4. Add Make target to appropriate Makefile

### Testing

```bash
# Run all tests
make test

# Run tests with coverage
make test-coverage

# Run tests in watch mode
make test-watch
```

### Code Quality

```bash
# Format code
make format

# Run linter
make lint

# Type check (strict mode)
make check

# Run all validations
make validate

# Show PMAT MCP setup instructions
make pmat-info

# Run property-based tests
make test-property
```

### PMAT Quality Gates

This project is fully integrated with PMAT for continuous quality monitoring:

#### Installation

PMAT is automatically installed with project dependencies:
```bash
make install  # Installs Deno, Rust, and PMAT
```

Or install manually:
```bash
cargo install pmat
```

#### Quality Gate Configuration

The project includes `.pmat-gates.toml` with enforced standards:
- **Coverage**: Minimum 80%
- **Complexity**: Maximum 10 cyclomatic per function
- **Tests**: All tests must pass
- **Clippy**: Strict mode enabled

#### Make Commands

```bash
# Run all PMAT analyses
make pmat-all

# Individual analyses
make pmat-quality-gate    # Run quality gate checks (blocking)
make pmat-complexity      # Analyze code complexity
make pmat-debt           # Check technical debt
make pmat-dead-code      # Detect unused code
make pmat-context        # Generate project context
make pmat-health         # Run health check

# Git hooks
make pmat-hooks-install  # Install pre-commit hooks
make pmat-hooks-status   # Check hooks status
```

#### Git Hooks (Automatic Quality Gates)

Pre-commit hooks are automatically installed and enforce quality gates before every commit:
```bash
# Hooks run automatically on git commit
# To bypass (NOT RECOMMENDED): git commit --no-verify
```

#### CI Integration

Quality gates run automatically in GitHub Actions:
- Complexity analysis (reports violations)
- Technical debt scanning
- Quality gate enforcement (currently non-blocking)

#### MCP Integration (Optional)

For Claude Desktop users, PMAT can also be used via MCP:
```json
{
  "mcpServers": {
    "pmat": {
      "command": "pmat",
      "args": ["serve", "--mode", "mcp"]
    }
  }
}
```

MCP tools available:
- `mcp_pmat_quality_gate` - Run quality checks
- `mcp_pmat_analyze` - Code analysis
- `mcp_pmat_context` - Context generation
- `mcp_pmat_refactor` - Refactoring tools

### Type Safety

This project uses TypeScript's strictest settings:
- No implicit `any` types
- Strict null checks
- Exhaustive switch statements
- Runtime validation with type inference

Example:
```typescript
import { z } from "./scripts/lib/schema.ts";

const ConfigSchema = z.object({
  device: z.string().min(1),
  volume: z.number().min(0).max(100),
});

type Config = z.infer<typeof ConfigSchema>;
```

### Deployment

Compile scripts to standalone binaries that don't require Deno:

```bash
# Deploy all scripts for current platform
make deploy

# Deploy specific category
make dev-deploy-audio
make dev-deploy-system

# Create distributable package
make deploy-package

# Deploy for specific platform
make deploy-package TARGETS=linux   # Linux x64 (default)
make deploy-package TARGETS=arm64   # Linux ARM64 (for Raspberry Pi, etc.)

# List available scripts
make dev-deploy-list

# Clean deployment artifacts
make deploy-clean
```

Deployed binaries are self-contained and don't require Deno runtime.

## CI/CD

This project uses self-hosted GitHub Actions runners for continuous integration:

- **Automatic builds** on every push and PR
- **Linux binaries** for x64 and ARM64 architectures
- **Security scanning** for secrets and unsafe patterns
- **Dependency management** with Cargo-style commands
- **Self-hosted runner** configured with auto-start on reboot

### GitHub Actions Runner Management

The project includes Makefile commands for managing the self-hosted runner:

```bash
# Install runner as a service (auto-starts on reboot)
make runner-install

# Manage the runner
make runner-start    # Start the runner
make runner-stop     # Stop the runner
make runner-status   # Check runner status
make runner-restart  # Restart the runner
```

**Full Documentation:** [docs/github-runner.md](docs/github-runner.md)

### Running CI Locally

```bash
# Run full CI pipeline locally
make validate

# Run specific CI jobs
make lint        # Linting only
make test        # Tests only
make deps-verify # Dependency verification
```

## Architecture

See [docs/architecture/ubuntu-config-scripts-1.0.md](docs/architecture/ubuntu-config-scripts-1.0.md) for detailed architecture documentation.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass: `make validate`
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.
