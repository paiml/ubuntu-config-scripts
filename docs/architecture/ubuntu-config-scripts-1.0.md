# Ubuntu Config Scripts Architecture v1.0

## Overview

Ubuntu Config Scripts implements a hybrid architecture supporting both TypeScript/Deno (production) and Ruchy (experimental) implementations. This design enables gradual migration while maintaining full backward compatibility.

## Architecture Principles

### 1. Hybrid Language Support
- **TypeScript (Production)**: All functionality available, battle-tested
- **Ruchy (Experimental)**: Performance-optimized implementations
- **Bridge Architecture**: Automated conversion between languages
- **Coexistence**: Both languages supported simultaneously

### 2. Zero-Dependency Deployment  
- **TypeScript**: Compiled to self-contained Deno binaries
- **Ruchy**: Native binaries with no runtime dependencies
- **Distribution**: Single executable per script
- **Installation**: No package manager dependencies required

### 3. Quality-First Development
- **TDD**: Test-driven development for all components
- **PMAT Integration**: Technical Debt Gradient analysis
- **Property Testing**: Invariant-based validation
- **CI/CD**: Automated quality gates on every change

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Ubuntu Config Scripts                    │
├─────────────────────────────────────────────────────────────┤
│                    User Interface                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Make CLI  │  │ Direct Exec │  │ Binary Dist │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│                  Script Categories                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │    Audio    │  │   System    │  │Development │         │
│  │  Management │  │    Config   │  │    Tools    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│                 Language Implementations                    │
│  ┌─────────────────────────────┐  ┌──────────────────────┐ │
│  │      TypeScript/Deno        │  │        Ruchy         │ │
│  │   ┌─────────────────────┐   │  │  ┌─────────────────┐ │ │
│  │   │   lib/common.ts     │   │  │  │ lib/common.ruchy│ │ │
│  │   │   lib/logger.ts     │   │  │  │ lib/logger.ruchy│ │ │
│  │   │   lib/schema.ts     │───┼──┼─▶│ bridge-gen.ruchy│ │ │
│  │   │   audio/*.ts        │   │  │  │ audio/*.ruchy   │ │ │
│  │   │   system/*.ts       │   │  │  │ system/*.ruchy  │ │ │
│  │   └─────────────────────┘   │  │  └─────────────────┘ │ │
│  └─────────────────────────────┘  └──────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                   Bridge Components                         │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │            TypeScript ↔ Ruchy Bridge                    │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌────────────────┐  │ │
│  │  │ Transformer │  │  Validator  │  │  Test Runner   │  │ │
│  │  └─────────────┘  └─────────────┘  └────────────────┘  │ │
│  └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                    Quality Gates                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │    PMAT     │  │    Tests    │  │   CI/CD Pipeline    │ │
│  │    TDG      │  │  Coverage   │  │  GitHub Actions     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                   System Integration                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Ubuntu    │  │  PipeWire   │  │     Hardware        │ │
│  │ SystemD/D   │  │   ALSA      │  │  NVIDIA/DaVinci     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Component Details

### Core Libraries (`scripts/lib/`)

#### Common Utilities (`common.ts`)
- Command execution with proper error handling
- File system operations with permission validation
- System information collection
- Cross-platform compatibility helpers

#### Logging System (`logger.ts`)
- Structured logging with multiple output formats
- Configurable log levels and filtering
- Performance metrics collection
- Error context preservation

#### Schema Validation (`schema.ts`)
- Runtime type validation with Zod
- Configuration file parsing
- API response validation
- Type-safe error messages

### Script Categories

#### Audio Management (`scripts/audio/`)
- **configure-speakers.ts**: External speaker configuration
- **enable-mic.ts**: Microphone setup and testing
- **fix-audio.ts**: Audio troubleshooting and repair

#### System Configuration (`scripts/system/`)
- **configure-obs.ts**: OBS Studio setup for screencasting
- **launch-davinci.ts**: DaVinci Resolve optimization
- **upgrade-nvidia-driver.ts**: NVIDIA driver management
- **diagnose-av-issues.ts**: Audio/video diagnostics

#### Development Tools (`scripts/dev/`)
- **bridge-transformer.ts**: TypeScript to Ruchy conversion
- **deploy.ts**: Binary compilation and distribution
- **deps.ts**: Dependency management

### Bridge Architecture

#### Transformation Pipeline
1. **Parse**: TypeScript AST analysis
2. **Transform**: Syntax rule application
3. **Validate**: Ruchy compilation check
4. **Test**: Behavioral equivalence verification
5. **Deploy**: Binary generation

#### Quality Assurance
- **Automated Testing**: Both language implementations tested
- **Performance Benchmarking**: Execution time and memory usage
- **PMAT Analysis**: Technical debt measurement
- **Security Scanning**: Vulnerability detection

## Data Flow

### Script Execution Flow
```
User Command → Make Target → Script Selection → Language Runtime → System APIs
     ↓              ↓              ↓               ↓              ↓
  CLI Args    →  Validation  →  Execution   →  Error Handling → Result
```

### Configuration Flow
```
Config Files → Schema Validation → Runtime Options → Script Parameters
     ↓               ↓                    ↓              ↓
Environment  →  Type Checking    →    Execution   →   Logging
```

### Error Handling Flow
```
System Error → Error Context → User-Friendly Message → Recovery Options
     ↓             ↓                ↓                     ↓
  Logging   →  Diagnostics  →   Documentation   →   Resolution
```

## Performance Characteristics

### TypeScript/Deno
- **Startup Time**: 100-200ms (JIT compilation)
- **Memory Usage**: 25-50MB base + script requirements
- **Binary Size**: 40-80MB (includes Deno runtime)
- **Execution Speed**: Optimized JavaScript performance

### Ruchy (Target)
- **Startup Time**: 1-5ms (native binary)
- **Memory Usage**: 5-15MB (no runtime overhead)  
- **Binary Size**: 2-8MB (statically linked)
- **Execution Speed**: Native performance

## Security Model

### Principle of Least Privilege
- Scripts request only required permissions
- Sudo access only for specific operations
- Temporary privilege escalation when needed
- Audit trail for all privileged operations

### Supply Chain Security
- **TypeScript**: Deno security model with explicit permissions
- **Ruchy**: Zero external dependencies at runtime
- **CI/CD**: Dependency scanning and vulnerability checks
- **Distribution**: Signed binaries with integrity verification

### System Integration
- **Sandboxing**: Limited file system access
- **Network**: Explicit network permission requirements
- **Hardware**: Safe hardware interaction patterns
- **Configuration**: Validated configuration files only

## Deployment Strategies

### Development Mode
```bash
# Direct TypeScript execution
deno run --allow-all scripts/system/configure-obs.ts

# Ruchy interpretation  
ruchy run system/configure-obs.ruchy
```

### Production Mode
```bash
# Compiled binaries
./dist/configure-obs          # TypeScript → Deno binary
./dist/ruchy/configure-obs    # Ruchy → Native binary
```

### Distribution
```bash
# Package creation
make deploy-package TARGETS=linux    # Multi-architecture
tar -xzf ubuntu-config-scripts.tar.gz
./bin/setup-system
```

## Quality Metrics

### Code Quality Standards
- **Cyclomatic Complexity**: ≤ 10 per function
- **Function Length**: ≤ 50 lines
- **Parameter Count**: ≤ 4 per function
- **Test Coverage**: ≥ 95%
- **PMAT TDG Score**: ≥ 0.85

### Performance Requirements
- **Script Execution**: < 5 seconds for any operation
- **System Response**: < 1 second for information gathering
- **Memory Usage**: < 100MB peak for any script
- **Disk Usage**: < 1GB for full installation

### Reliability Standards
- **Error Handling**: All failure modes covered
- **Graceful Degradation**: Partial functionality when possible
- **Recovery**: Automatic recovery from transient failures
- **Monitoring**: Health checks and status reporting

## Migration Timeline

### Phase 1: Foundation (Completed ✅)
- Bridge architecture implementation
- Core library TypeScript implementations
- CI/CD pipeline establishment
- Quality gate integration

### Phase 2: Showcase (Completed ✅)
- System diagnostic Ruchy implementation
- Performance benchmarking
- Documentation and examples
- Community feedback collection

### Phase 3: Core Migration (Current 🔄)
- Library migration to Ruchy
- API compatibility maintenance
- Cross-platform support
- Production deployment testing

### Phase 4: Full Migration (Planned 📋)
- All scripts migrated to Ruchy
- TypeScript deprecation path
- Community adoption support
- Long-term maintenance planning

## Future Considerations

### Scalability
- **Multi-system Management**: Configuration fleet management
- **Cloud Integration**: Remote execution capabilities
- **Containerization**: Docker/Podman native support
- **Service Mesh**: Integration with modern infrastructure

### Extensibility
- **Plugin Architecture**: Third-party script integration
- **API Endpoints**: REST/GraphQL interfaces
- **Event System**: Webhook and notification support
- **Configuration Management**: Declarative system state

### Community
- **Package Registry**: Community script sharing
- **Documentation**: Interactive tutorials and guides
- **Support Channels**: Issue tracking and discussions
- **Contribution**: Streamlined contribution workflow