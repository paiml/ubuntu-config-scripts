# Ubuntu Config Scripts 1.0 Architecture

## Overview

Ubuntu Config Scripts is a collection of Deno TypeScript scripts for configuring and managing Ubuntu systems. The project emphasizes high test coverage, strict linting, and integration with the sister project `paiml-mcp-agent-toolkit`.

## Technology Stack

- **Runtime**: Deno
- **Language**: TypeScript
- **Build System**: Makefile
- **Testing Framework**: Deno test
- **Linting**: Deno lint and fmt
- **CI/CD**: GitHub Actions with Gunner

## Project Structure

```
ubuntu-config-scripts/
├── Makefile                 # Build, test, and lint targets
├── scripts/                 # Main script implementations
│   ├── lib/                # Shared library code
│   │   ├── common.ts       # Common utilities
│   │   ├── config.ts       # Configuration management
│   │   └── logger.ts       # Logging utilities
│   ├── install-packages.ts # Package installation script
│   ├── configure-system.ts # System configuration script
│   └── setup-dev-env.ts    # Development environment setup
├── tests/                   # Test files
│   ├── lib/                # Library tests
│   └── scripts/            # Script tests
├── .github/
│   └── workflows/
│       └── ci.yml          # GitHub Actions with Gunner
├── deno.json               # Deno configuration
└── docs/
    └── architecture/
        └── ubuntu-config-scripts-1.0.md
```

## Core Principles

### 1. Deno TypeScript Only

- No bash scripts allowed
- All scripts written in TypeScript for Deno runtime
- Type safety and modern JavaScript features

### 2. High Test Coverage

- Minimum 80% test coverage requirement
- Unit tests for all library functions
- Integration tests for scripts
- Coverage reports generated in CI

### 3. Strict Linting

- Format checking with `deno fmt`
- Lint checking with `deno lint`
- Type checking with `deno check`
- All checks must pass before merge

### 4. Makefile-Driven Workflow

```makefile
# Core targets
test:        # Run all tests with coverage
lint:        # Run format and lint checks
format:      # Auto-format code
check:       # Type check all TypeScript files
build:       # Compile and bundle scripts
clean:       # Clean generated files
```

### 5. Shared Library Architecture

All scripts share common functionality through the `scripts/lib/` directory:

- **common.ts**: Utility functions, file operations, command execution
- **config.ts**: Configuration parsing and validation
- **logger.ts**: Structured logging with levels
- **pmat.ts**: Integration with paiml-mcp-agent-toolkit

## Integration with PMAT

The project integrates with the sister project `paiml-mcp-agent-toolkit` (PMAT) located at `../paiml-mcp-agent-toolkit`:

```typescript
// scripts/lib/pmat.ts
import { SomeUtility } from "../../paiml-mcp-agent-toolkit/mod.ts";

export function usePmatFeature() {
  // Integration code
}
```

## Script Standards

Each script must follow these standards:

### Structure

```typescript
// scripts/example-script.ts
import { logger } from "./lib/logger.ts";
import { parseConfig } from "./lib/config.ts";
import { runCommand } from "./lib/common.ts";

interface ScriptOptions {
  verbose: boolean;
  dryRun: boolean;
}

async function main(options: ScriptOptions) {
  logger.info("Starting script execution");

  try {
    // Script implementation
  } catch (error) {
    logger.error("Script failed", error);
    Deno.exit(1);
  }
}

// CLI parsing and execution
if (import.meta.main) {
  // Parse arguments and run main
}
```

### Testing

```typescript
// tests/scripts/example-script.test.ts
import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { main } from "../../scripts/example-script.ts";

Deno.test("example script - success case", async () => {
  // Test implementation
});
```

## CI/CD with Gunner

The project uses Gunner for cost-effective CI/CD on AWS spot instances:

### Gunner Configuration

```yaml
# gunner.yaml
name: ubuntu-config-scripts
runners:
  instance_types:
    - type: t3a.medium  # For regular CI jobs
      labels: [gunner]
      weight: 90
    - type: t3a.small   # For deployment jobs
      labels: [gunner, deploy]
      weight: 10
  spot:
    enabled: true
    max_price_percentage: 80
```

### GitHub Actions Workflows

1. **CI Pipeline** (`.github/workflows/ci.yml`)
   - Runs on every push and PR
   - Uses Gunner runners: `[self-hosted, linux, x64, gunner]`
   - Jobs: lint, test, validate-deps, security-scan, build
   - Fallback to GitHub runners for smoke tests

2. **Deployment** (`.github/workflows/deploy.yml`)
   - Triggered on releases or manual dispatch
   - Builds binaries for all platforms
   - Creates Docker images
   - Uploads release artifacts

3. **Gunner Tasks** (`.github/workflows/gunner-tasks.yml`)
   - On-demand heavy workloads
   - Benchmarks, stress tests, cross-compilation
   - Full validation and dependency audits

### Cost Optimization

- Spot instances for 80% cost savings
- Auto-scaling (0-3 instances)
- 10-minute idle timeout
- $50/month budget limit

## Development Workflow

1. **Development Setup**
   ```bash
   git clone <repo>
   cd ubuntu-config-scripts
   make check  # Verify environment
   ```

2. **Adding New Scripts**
   - Create script in `scripts/`
   - Add shared code to `scripts/lib/`
   - Write tests in `tests/`
   - Update Makefile if needed

3. **Testing**
   ```bash
   make test           # Run all tests
   make test-coverage  # Generate coverage report
   ```

4. **Linting**
   ```bash
   make format  # Auto-format code
   make lint    # Check format and lint
   make check   # Type check
   ```

## Security Considerations

- No hardcoded credentials
- Secure handling of system configurations
- Audit logging for all system changes
- Permission checks before modifications

## Binary Deployment

The project includes a comprehensive deployment system for creating standalone binaries:

### Deployment Features
- Compile scripts to self-contained executables
- Cross-platform compilation support
- Automatic packaging with documentation
- No Deno runtime required for deployment

### Supported Targets
- `x86_64-unknown-linux-gnu` - Linux x64
- `aarch64-unknown-linux-gnu` - Linux ARM64  
- `x86_64-apple-darwin` - macOS x64
- `aarch64-apple-darwin` - macOS ARM64
- `x86_64-pc-windows-msvc` - Windows x64

### Deployment Commands
```bash
make deploy              # Deploy all scripts
make deploy-package      # Create distributable package
make deploy-clean        # Clean deployment artifacts
```

## Future Enhancements

- Plugin system for extensibility
- Remote execution capabilities
- Configuration templating system
- Integration with configuration management tools
