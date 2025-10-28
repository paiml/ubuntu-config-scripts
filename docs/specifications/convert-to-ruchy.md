# Extreme TDD Conversion: TypeScript to Ruchy

## Project Overview

Complete conversion of all 96 TypeScript/Deno scripts to Ruchy using Extreme Test-Driven Development (TDD) methodology with PMAT quality enforcement.

## Meta Configuration

```yaml
project: Ubuntu Config Scripts - Ruchy Conversion
approach: Extreme Test-Driven Development
quality_gates:
  max_complexity: 10
  max_cognitive: 7
  min_coverage: 0.95
  min_mutation_score: 0.90
  satd_tolerance: 0
  property_test_iterations: 1000
execution:
  ticket_workflow: RED-GREEN-REFACTOR-PMAT
  commit_strategy: atomic_per_ticket
  build_verification: mandatory_clean_with_all_tools
  testing_tools: 15_major_tools
```

## Quality Enforcement Tools (15 Major)

Based on `../ruchy` and `../ruchyruchy` standards:

### Static Analysis (5)
1. **cargo check** - Compile-time verification
2. **cargo clippy** - Lint and code quality
3. **rustfmt** - Code formatting
4. **cargo-audit** - Security vulnerability scanning
5. **cargo-deny** - Dependency licensing and security

### Testing (5)
6. **cargo test** - Unit and integration tests
7. **cargo-tarpaulin** - Code coverage (>95%)
8. **cargo-mutants** - Mutation testing (>90%)
9. **proptest** - Property-based testing (1000+ iterations)
10. **quickcheck** - Alternative property testing

### Performance & Quality (5)
11. **criterion** - Benchmarking (<100ms startup)
12. **cargo-bloat** - Binary size analysis
13. **cargo-udeps** - Unused dependency detection
14. **miri** - Undefined behavior detection
15. **pmat** - Comprehensive quality gate orchestration

## Current State Analysis

### TypeScript Scripts Inventory (96 total)

#### Libraries (10 scripts)
- `scripts/lib/common.ts` - Utility functions
- `scripts/lib/logger.ts` - Logging framework
- `scripts/lib/schema.ts` - Zod validation schemas
- `scripts/lib/config.ts` - Configuration management
- `scripts/lib/deno-updater.ts` - Deno update logic
- `scripts/lib/strict-config.ts` - Strict TypeScript config
- `scripts/lib/deps.ts` - Dependency management
- `scripts/lib/turso-client.ts` - Database client
- `scripts/lib/script-repository.ts` - Script metadata
- `scripts/lib/deploy.ts` - Deployment utilities

#### Audio Scripts (10 scripts)
- `scripts/audio/configure-speakers.ts`
- `scripts/audio/enable-mic.ts`
- `scripts/audio/fix-audio.ts`
- `scripts/audio/test-speakers.ts`
- `scripts/audio/test-mic.ts`
- And 5 more...

#### System Scripts (50+ scripts)
- `scripts/system/restart-ibus.ts` ⭐ (NEW)
- `scripts/system/configure-obs.ts`
- `scripts/system/diagnose-av-issues.ts`
- `scripts/system/create-pipewire-monitor.ts`
- `scripts/system/upgrade-nvidia-driver.ts`
- `scripts/system/configure-davinci.ts`
- `scripts/system/cleanup-disk.ts`
- And 43+ more...

#### Dev Scripts (15 scripts)
- `scripts/dev/deploy.ts`
- `scripts/dev/deps.ts`
- `scripts/dev/install-pmat-deps.ts`
- `scripts/dev/bridge-validator.ts`
- `scripts/dev/bridge-transformer.ts`
- `scripts/dev/ruchy-version-monitor.ts`
- `scripts/dev/fix-makefile-warnings.ts` ⭐ (NEW)
- And 8 more...

#### MCP/Search Scripts (11 scripts)
- `scripts/mcp-server.ts`
- `scripts/seed.ts`
- `scripts/search.ts`
- And 8 more...

## Conversion Strategy

### Phase 1: Foundation (Weeks 1-2)
**Goal**: Establish Ruchy library equivalents of core TypeScript libraries

**Priority Order**:
1. `lib/logger.ts` → `ruchy/lib/logger.ruchy`
2. `lib/common.ts` → `ruchy/lib/common.ruchy`
3. `lib/schema.ts` → `ruchy/lib/schema.ruchy` (using serde)
4. `lib/config.ts` → `ruchy/lib/config.ruchy`

**Per-Script Workflow**:
```
1. RED: Write comprehensive property-based tests in Ruchy
   - Unit tests (TDD)
   - Property tests (1000+ iterations)
   - Integration tests

2. GREEN: Implement in Ruchy to pass tests
   - Maintain TypeScript parity
   - Add Rust safety improvements
   - Ensure <100ms startup time

3. REFACTOR: Optimize and clean
   - Run all 15 tools
   - Achieve quality gates
   - Document improvements

4. PMAT: Enforce quality
   - pmat check --all
   - Coverage >95%
   - Mutation score >90%
   - Complexity <10
   - Zero SATD
```

### Phase 2: Audio Scripts (Weeks 3-4)
**Goal**: Convert all audio configuration and diagnostic scripts

**Conversion Order** (by complexity):
1. `configure-speakers.ts` → `audio/configure_speakers.ruchy`
2. `enable-mic.ts` → `audio/enable_mic.ruchy`
3. `fix-audio.ts` → `audio/fix_audio.ruchy`
4. `test-speakers.ts` → `audio/test_speakers.ruchy`
5. Continue with remaining 6 scripts...

**Additional Requirements**:
- Maintain PipeWire API compatibility
- Add ALSA/PulseAudio fallbacks
- Property test audio device detection
- Benchmark: Device scan <50ms

### Phase 3: System Scripts - Critical Path (Weeks 5-8)
**Goal**: Convert high-priority system scripts first

**Tier 1: Critical (Week 5)**
1. ⭐ `restart-ibus.ts` → `system/restart_ibus.ruchy`
2. `create-pipewire-monitor.ts` → `system/create_pipewire_monitor.ruchy`
3. `diagnose-av-issues.ts` → `system/diagnose_av.ruchy`
4. `configure-obs.ts` → `system/configure_obs.ruchy`
5. `upgrade-nvidia-driver.ts` → `system/upgrade_nvidia.ruchy`

**Tier 2: Important (Week 6)**
6. `configure-davinci.ts` → `system/configure_davinci.ruchy`
7. `cleanup-disk.ts` → `system/cleanup_disk.ruchy`
8. `analyze-disk-usage.ts` → `system/analyze_disk.ruchy`
9. `optimize-rust-dev.ts` → `system/optimize_rust_dev.ruchy`
10. `configure-time.ts` → `system/configure_time.ruchy`

**Tier 3: Remaining (Weeks 7-8)**
- 40+ additional system scripts in batches of 5-10

### Phase 4: Dev Scripts (Weeks 9-10)
**Goal**: Convert development and tooling scripts

**Conversion Order**:
1. ⭐ `fix-makefile-warnings.ts` → `dev/fix_makefile_warnings.ruchy`
2. `deploy.ts` → `dev/deploy.ruchy`
3. `deps.ts` → `dev/deps.ruchy`
4. `install-pmat-deps.ts` → `dev/install_pmat_deps.ruchy`
5. `bridge-validator.ts` → `dev/bridge_validator.ruchy`
6. `bridge-transformer.ts` → `dev/bridge_transformer.ruchy`
7. `ruchy-version-monitor.ts` → `dev/ruchy_monitor.ruchy`
8. Remaining 8 scripts...

### Phase 5: MCP/Search Infrastructure (Weeks 11-12)
**Goal**: Convert MCP server and semantic search system

**Conversion Order**:
1. `turso-client.ts` → `lib/turso_client.ruchy` (async runtime)
2. `script-repository.ts` → `lib/script_repository.ruchy`
3. `seed.ts` → `seed.ruchy`
4. `search.ts` → `search.ruchy`
5. `mcp-server.ts` → `mcp_server.ruchy` (stdio protocol)

**Special Requirements**:
- Async/await with Tokio runtime
- OpenAI API integration (reqwest + serde_json)
- Turso libSQL client
- MCP stdio protocol implementation
- Property test: Search relevance consistency

## Testing Requirements Per Script

### Unit Tests
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_functionality() {
        // Arrange
        // Act
        // Assert
    }

    #[test]
    fn test_error_conditions() {
        // Test all error paths
    }

    #[test]
    fn test_edge_cases() {
        // Test boundary conditions
    }
}
```

### Property Tests (1000+ iterations)
```rust
#[cfg(test)]
mod proptests {
    use proptest::prelude::*;

    proptest! {
        #[test]
        fn test_invariant_holds(input in any::<InputType>()) {
            // Test mathematical properties
            // Test round-trip conversions
            // Test idempotency
        }

        #[test]
        fn test_no_panics(input in any::<InputType>()) {
            // Ensure no panics for any input
            let _ = function_under_test(input);
        }
    }
}
```

### Integration Tests
```rust
#[test]
fn integration_test_full_workflow() {
    // Test complete user workflows
    // Test system interactions
    // Test file I/O
}
```

### Benchmark Tests
```rust
use criterion::{black_box, criterion_group, criterion_main, Criterion};

fn benchmark_function(c: &mut Criterion) {
    c.bench_function("function_name", |b| {
        b.iter(|| function_under_test(black_box(&input)))
    });
}

criterion_group!(benches, benchmark_function);
criterion_main!(benches);
```

## Quality Gate Enforcement

### Pre-Commit Checklist (Per Ticket)
```bash
# 1. Format check
cargo fmt --check

# 2. Lint check
cargo clippy -- -D warnings

# 3. Security audit
cargo audit

# 4. Compilation
cargo check --all-targets

# 5. Tests
cargo test --all

# 6. Coverage (>95%)
cargo tarpaulin --out Html --output-dir coverage

# 7. Mutation testing (>90%)
cargo mutants --timeout 300

# 8. Property tests (1000+ iterations)
PROPTEST_CASES=1000 cargo test

# 9. Benchmarks (<100ms startup)
cargo bench

# 10. Undefined behavior check
cargo +nightly miri test

# 11. Unused dependencies
cargo udeps

# 12. Binary size analysis
cargo bloat --release

# 13. License compliance
cargo deny check

# 14. PMAT quality gate
pmat check --all --strict

# 15. Final build
cargo build --release
```

### Success Criteria
- ✅ All 15 tools pass
- ✅ Coverage ≥95%
- ✅ Mutation score ≥90%
- ✅ Complexity ≤10
- ✅ Cognitive complexity ≤7
- ✅ Zero SATD
- ✅ Zero clippy warnings
- ✅ Zero security vulnerabilities
- ✅ Startup time <100ms
- ✅ Clean build in release mode

## Ticket Template

```yaml
ticket:
  id: RUCHY-XXX
  title: "Convert [script-name].ts to Ruchy"
  phase: "[Phase Number]"
  priority: "[critical|high|medium|low]"

  requirements:
    - "Maintain functional parity with TypeScript version"
    - "Add property-based tests with 1000+ iterations"
    - "Achieve <100ms startup time"
    - "Pass all 15 quality tools"

  tests:
    - "test_[functionality]_basic_case"
    - "test_[functionality]_error_handling"
    - "proptest_[functionality]_invariants"
    - "integration_test_[functionality]_workflow"
    - "bench_[functionality]_performance"

  acceptance:
    - "100% test coverage"
    - "Mutation score >90%"
    - "All quality gates pass"
    - "Benchmarks meet targets"
    - "Documentation complete"

  typescript_source: "scripts/[category]/[script-name].ts"
  ruchy_target: "ruchy/[category]/[script_name].ruchy"
  test_file: "ruchy/tests/[category]/[script_name]_test.ruchy"
```

## Migration Benefits

### Performance Improvements
- **Startup Time**: Deno ~50-100ms → Ruchy <10ms (10x faster)
- **Memory Usage**: Deno ~30-50MB → Ruchy <5MB (10x reduction)
- **Binary Size**: Deno N/A → Ruchy single binary ~2-5MB
- **Execution Speed**: 3-5x faster for I/O operations

### Safety Improvements
- **Compile-Time Guarantees**: Rust type system catches errors at compile time
- **Memory Safety**: No null pointer dereferences, buffer overflows
- **Thread Safety**: Fearless concurrency with ownership system
- **Error Handling**: Result<T, E> forces explicit error handling

### Developer Experience
- **Single Binary**: No runtime dependencies (vs Deno runtime)
- **Cross-Platform**: Build once, run anywhere
- **Better IDE Support**: rust-analyzer provides superior intellisense
- **Faster CI/CD**: Compiled binaries deploy instantly

### Operational Benefits
- **No Runtime Required**: Direct system calls, no V8 overhead
- **Predictable Performance**: No JIT warm-up, no GC pauses
- **Better Resource Usage**: Lower CPU and memory footprint
- **Easier Distribution**: Single binary vs Deno + TypeScript files

## Risk Mitigation

### Dual-Support Strategy
During conversion (Phases 1-5):
- ✅ Keep TypeScript scripts functional
- ✅ Run both in parallel for validation
- ✅ Gradually deprecate TypeScript after Ruchy proven
- ✅ Maintain Makefile targets for both

### Rollback Plan
If Ruchy version fails in production:
- ✅ Keep TypeScript scripts in repo
- ✅ Makefile can switch back instantly
- ✅ Document known issues in conversion notes

### Testing Strategy
- ✅ Side-by-side testing: Run both versions, compare outputs
- ✅ Property tests validate behavior equivalence
- ✅ Integration tests on real systems
- ✅ Dogfooding: Use Ruchy versions internally first

## Success Metrics

### Quantitative
- **Scripts Converted**: 96/96 (100%)
- **Test Coverage**: ≥95% across all scripts
- **Mutation Score**: ≥90% across all scripts
- **Performance**: 3-5x faster than TypeScript
- **Binary Size**: <50MB total for all scripts
- **Build Time**: <5 minutes for full project

### Qualitative
- **Zero regressions**: All functionality preserved
- **Enhanced reliability**: Rust safety prevents entire classes of bugs
- **Better maintainability**: Type system + tests catch errors early
- **Improved developer experience**: Faster feedback loops

## Timeline Summary

| Phase | Duration | Scripts | Focus |
|-------|----------|---------|-------|
| Phase 1 | 2 weeks | 10 | Core libraries |
| Phase 2 | 2 weeks | 10 | Audio scripts |
| Phase 3 | 4 weeks | 50+ | System scripts (tiered) |
| Phase 4 | 2 weeks | 15 | Dev scripts |
| Phase 5 | 2 weeks | 11 | MCP/Search infrastructure |
| **Total** | **12 weeks** | **96** | **Complete conversion** |

## Next Steps

1. **Create roadmap.yaml**: Detailed ticket breakdown
2. **Setup Ruchy project structure**: Match TypeScript layout
3. **Start with RUCHY-001**: Convert `lib/logger.ts`
4. **Establish CI/CD**: Automate 15-tool quality gate
5. **Begin Phase 1**: Foundation libraries

## Bug Reporting Protocol

**CRITICAL: If you discover a Ruchy bug, STOP THE LINE immediately!**

Following the Toyota Production System philosophy, any team member finding a defect must halt work and address it:

### When to Stop The Line

Stop work and file a bug if you encounter:
- Ruchy compiler crashes or panics
- Invalid syntax rejected incorrectly (or valid syntax accepted incorrectly)
- `ruchy test` producing incorrect results
- `ruchy check` false positives/negatives
- Inconsistent behavior between Ruchy and Rust backends
- Documentation contradictions
- Toolchain failures (build, test, coverage, quality-gate)

### Bug Reporting Process

1. **STOP**: Halt all conversion work immediately
2. **Document**: Capture minimal reproducible example
3. **File Bug**: Open issue at `git@github.com:paiml/ruchy.git`
4. **Template**:
   ```markdown
   ## Bug Description
   [Clear description of issue]

   ## Minimal Reproduction
   ```ruchy
   // Minimal code demonstrating issue
   ```

   ## Expected Behavior
   [What should happen]

   ## Actual Behavior
   [What actually happens]

   ## Environment
   - Ruchy version: [output of `ruchy --version`]
   - OS: [Ubuntu version]
   - Cargo version: [output of `cargo --version`]

   ## Additional Context
   [Any relevant details, error messages, stack traces]
   ```

5. **Wait**: Do NOT work around the bug or continue with affected conversion
6. **Track**: Add bug reference to ticket blocking you (e.g., "BLOCKED: ruchy#42")
7. **Resume**: Only continue after bug is fixed or confirmed as "working as intended"

### Philosophy

The "Stop The Line" approach ensures:
- **Zero defects propagate**: Bugs caught immediately, not accumulated
- **Quality over speed**: Better to pause than ship broken code
- **Team empowerment**: Any developer can halt for quality
- **Continuous improvement**: Bugs become learning opportunities

**Reference**: See `../ruchyruchy/` for examples of this process in practice

## References

- Ruchy Documentation: `../ruchy/docs/`
- Ruchy Examples: `../ruchy/examples/`
- RuchyRuchy Project: `../ruchyruchy/` (Stop The Line examples)
- Rosetta Ruchy: `../rosetta-ruchy/` (Algorithm examples)
- Ruchy Book: `../ruchy-book/` (Language guide)
- PMAT Toolkit: `../paiml-mcp-agent-toolkit/`
- Quality Standards: `../ruchy/CLAUDE.md`
- Bug Tracker: `git@github.com:paiml/ruchy.git`

---

**Status**: Active - RUCHY-001 RED Phase Complete
**Last Updated**: 2025-10-28
**Next**: RUCHY-001 GREEN Phase Implementation
