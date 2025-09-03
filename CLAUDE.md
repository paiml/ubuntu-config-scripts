# Claude Context for Ubuntu Config Scripts

This document provides context for Claude or other AI assistants working on this project.

## CRITICAL REQUIREMENTS - PMAT QUALITY GATES

**MANDATORY**: PMAT MUST be used ONLY via MCP (Model Context Protocol) registration:

### PMAT MCP Integration

**IMPORTANT**: Do NOT run pmat commands directly in the terminal or Makefile. PMAT must be:
1. **Registered as an MCP server** in Claude Desktop
2. **Used via MCP tools** that appear as `mcp_pmat_*` functions
3. **Accessed through the MCP protocol** for all quality gates

### Setting Up PMAT MCP

```json
// In Claude Desktop settings:
{
  "mcpServers": {
    "pmat": {
      "command": "pmat",
      "args": ["serve", "--mode", "mcp"]
    }
  }
}
```

### Using PMAT via MCP

Once registered, use PMAT features through MCP tools:
- `mcp_pmat_analyze` - Analyze code quality
- `mcp_pmat_quality_gate` - Run quality gate checks
- `mcp_pmat_context` - Generate project context
- `mcp_pmat_enforce` - Enforce quality standards
- `mcp_pmat_refactor` - Refactor code with analysis

### Quality Gate Requirements

- **Test Coverage**: Minimum 80% for all scripts
- **Code Quality**: No critical issues from PMAT analysis via MCP
- **Security**: No security vulnerabilities detected
- **Architecture**: Must follow project architecture patterns
- **Complexity**: Cyclomatic complexity must be within limits

### Workflow

1. **Before ANY commit**: Use MCP tools to run quality gates
2. **During development**: Use MCP context generation for understanding
3. **For refactoring**: Use MCP refactor tools with real-time analysis
4. **Quality enforcement**: Use MCP enforce for extreme quality standards

## Project Overview

Ubuntu Config Scripts is a collection of Deno TypeScript scripts for configuring and managing Ubuntu systems. The project emphasizes:
- **Type Safety**: Strict TypeScript with runtime validation
- **Testing**: Property-based testing with fast-check
- **Quality Gates**: PMAT enforcement for all code
- **CI/CD**: Gunner integration for cost-effective builds
- **No Bash**: All scripts are TypeScript (per architecture requirements)

## Key Design Decisions

### 1. Deno TypeScript Only
- **Requirement**: NO bash scripts allowed
- All scripts written in TypeScript for Deno runtime
- Scripts compiled to standalone binaries for deployment

### 2. Strict Type Checking
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### 3. Property-Based Testing
- Uses fast-check for property testing
- Tests invariants and contracts
- Located in `tests/**/*.property.test.ts`

### 4. Makefile-Driven Workflow
- Main Makefile includes category-specific Makefiles
- Categories: audio, system, dev
- Auto-update Deno before commands

### 5. Gunner CI/CD Integration
- Runs on AWS spot instances
- Configuration in `gunner.yaml`
- Workflows in `.github/workflows/`

## Project Structure

```
ubuntu-config-scripts/
├── Makefile                 # Main build system
├── Makefile.audio          # Audio-specific targets
├── Makefile.system         # System-specific targets
├── Makefile.dev            # Development targets
├── scripts/
│   ├── lib/               # Shared libraries
│   │   ├── logger.ts      # Structured logging
│   │   ├── common.ts      # Common utilities
│   │   ├── schema.ts      # Type-safe validation
│   │   ├── deps-manager.ts # Dependency management
│   │   └── deploy.ts      # Binary compilation
│   ├── audio/             # Audio scripts
│   ├── system/            # System scripts
│   └── dev/               # Development scripts
├── tests/                 # Test files
├── deps.ts                # Central dependencies
├── deno.json             # Deno configuration
└── gunner.yaml           # Gunner CI configuration
```

## Common Tasks

### Adding a New Script

1. Create script in appropriate directory under `scripts/`
2. Use shared libraries from `scripts/lib/`
3. Add tests in `tests/`
4. Add Make target to appropriate Makefile
5. Ensure strict typing and property tests

### Working with Dependencies

```bash
make deps           # List dependencies
make deps-outdated  # Check for updates
make deps-update    # Update all dependencies
make deps-lock      # Update lock file
```

### Running CI Locally

```bash
make validate       # Run full validation
make test-property  # Run property tests
make check         # Type check only
```

### Deployment

```bash
make deploy                    # Build all binaries
make deploy-package            # Create distribution package
make deploy TARGETS=linux      # Build for specific platform
```

## Type Safety Patterns

### Runtime Validation
```typescript
import { z } from "./lib/schema.ts";

const ConfigSchema = z.object({
  port: z.number().int().min(1).max(65535),
  debug: z.boolean(),
});

type Config = z.infer<typeof ConfigSchema>;
const config = ConfigSchema.parse(data); // Runtime validation
```

### Exhaustive Pattern Matching
```typescript
type Command = 
  | { type: "start" }
  | { type: "stop" }
  | { type: "restart" };

function handle(cmd: Command) {
  switch (cmd.type) {
    case "start": return start();
    case "stop": return stop();
    case "restart": return restart();
    // No default needed - TypeScript ensures exhaustiveness
  }
}
```

### Property Testing
```typescript
import { fc } from "../../deps.ts";

fc.assert(
  fc.property(fc.array(fc.integer()), (arr) => {
    const sorted = [...arr].sort((a, b) => a - b);
    // Test invariants
    assertEquals(sorted.length, arr.length);
  })
);
```

## Troubleshooting

### Type Errors
- Check `deno.json` for strict settings
- Use `make check` to validate types
- Look for `noUncheckedIndexedAccess` issues with arrays

### Test Failures
- Property tests may find edge cases
- Check test output for counterexamples
- Use `make test-watch` for debugging

### CI Issues
- Gunner runners use capitalized labels: `[self-hosted, Linux, X64]`
- Job names must start with "Test", "Build" or contain "Quality Gate" for Gunner
- Runner may lack tools like `unzip` - we install Deno manually
- Auto-update is disabled in CI (`AUTO_UPDATE_DENO=false`)
- We ONLY use Gunner runners, never standard GitHub runners

## Important Notes

1. **Never use bash scripts** - All functionality must be TypeScript
2. **ALWAYS run `make validate` before committing** - This includes PMAT quality gates
3. **Use PMAT todo management** - Track all tasks with `pmat todo`
4. **Maintain 80% test coverage** - Verify with `pmat coverage`
5. **Use property tests for complex logic**
6. **Prefer exhaustive type checking over runtime checks**
7. **Auto-update is enabled by default** - Set `AUTO_UPDATE_DENO=false` to disable
8. **Run `pmat check --all` before EVERY push to GitHub**

## Recent Additions

### OBS Studio Configuration (configure-obs.ts)
- Automated OBS setup for screencasting and course recording
- Hardware encoder detection (NVIDIA NVENC, VAAPI, x264)
- 1080p recording optimized for DaVinci Resolve (MOV format, CRF 16)
- Audio device configuration with Yamaha mic support
- Scene and source management
- Hotkey configuration
- Fix for screen capture issues (fix-obs-capture.ts)
- Launch script with XSHM capture support

### DaVinci Resolve Support
- NVIDIA driver management (upgrade-nvidia-driver.ts)
- GPU optimization with prime-select nvidia for dedicated GPU usage
- Launch script with window positioning fixes (launch-davinci.ts)
- Audio configuration: Use WAV/AIFF with PCM audio for Linux compatibility
- OBS Integration: Record in MOV format with PCM audio for DaVinci import

### Audio/Video Diagnostics
- Comprehensive audio/video diagnostic tool (diagnose-av-issues.ts)
- Real-time playback testing with FFmpeg-generated test files
- Audio sink detection and status monitoring
- Video acceleration testing (VA-API, NVDEC)
- Hardware encoder detection and validation
- Network streaming diagnostics
- System resource monitoring
- Automated fix generation and application
- PipeWire/PulseAudio troubleshooting
- GPU driver and CUDA diagnostics

### Audio System Management
- External speaker configuration (configure-speakers.ts)
- Audio troubleshooting and device detection
- Property-based testing for audio configurations
- Automatic audio sink management and restart
- PipeWire monitor service (create-pipewire-monitor.ts): Auto-recovery from audio errors
  - Monitors for "Broken pipe" and error states every 30 seconds
  - Automatically restarts PipeWire services when issues detected
  - Configures PipeWire with improved buffer and timeout settings
  - Prevents recurring audio failures with systemd service

### Disk Management Tools
- Disk usage analyzer (analyze-disk-usage.ts): Find large files and directories
- Smart cleanup tool (cleanup-disk.ts): Safe cleanup with dry-run mode
- Rust build artifact cleanup: Automatic `cargo clean` for all projects
- Cache management: Clean .cache, trash, and temp directories
- System cleanup: APT, snap, journal logs integration
- rclean integration: Suggests interactive cleanup targets

## Known Issues and Solutions

### DaVinci Resolve Audio on Linux
- DaVinci on Linux has issues with AAC audio codec
- Solution: Use WAV, AIFF, or MOV files with PCM audio
- For OBS recordings: Set format to MOV with pcm_s24le audio encoder
- Convert existing files: `ffmpeg -i input.mp4 -c:v copy -c:a pcm_s24le output.mov`
- Ensure system uses NVIDIA GPU: `sudo prime-select nvidia`

### OBS Black Screen on Ubuntu
- PipeWire capture may fail on X11 systems
- Solution: Use "Screen Capture (XSHM)" instead of PipeWire
- Run `make system-obs-launch` for proper environment setup

### Audio Issues After Reboot
- PipeWire audio nodes may enter error state after system restart
- Symptoms: Audio sinks show "(null)" status, "Broken pipe" errors in logs
- Quick fix: Restart PipeWire services with `systemctl --user restart pipewire pipewire-pulse`
- Permanent solution: Run `make system-pipewire-monitor` to install auto-recovery service
  - Creates systemd service that monitors and fixes audio automatically
  - Applies PipeWire configuration to prevent "Broken pipe" errors
  - Service persists across reboots and auto-starts on login

### Audio/Video Playback Testing
- Comprehensive diagnostic tool available: `make system-av-diagnose`
- Real playback testing: `make system-av-test-playback`
- Automatic fix application: `make system-av-fix`
- Handles suspended audio sinks, wrong default devices, and hardware issues

## Future Enhancements

- [ ] Network configuration scripts
- [ ] System monitoring scripts
- [ ] Package installation automation
- [ ] Configuration templating
- [ ] Remote execution capabilities
- [ ] Automated backup scripts
- [ ] Docker/Podman integration
- never "workaround" toyota way.