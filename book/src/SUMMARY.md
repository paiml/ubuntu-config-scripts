# Summary

[Ubuntu Config Scripts: The Ruchy Migration Guide](title-page.md)
[Foreword](foreword.md)
[Introduction](ch00-00-introduction.md)

## Part I: Migration Philosophy

- [The Ruchy-First Approach](ch01-00-ruchy-first-approach.md)
    - [Why Migrate from Deno/TypeScript](ch01-01-why-migrate.md)
    - [Hybrid Architecture Strategy](ch01-02-hybrid-architecture.md)
    - [Quality Gates and Testing](ch01-03-quality-gates.md)

## Part II: Instrumentation and Metrics

- [Instrumenting Ruchy Development](ch02-00-instrumentation.md)
    - [Performance Profiling](ch02-01-performance-profiling.md)
    - [Memory Usage Analysis](ch02-02-memory-analysis.md)
    - [Compilation Metrics](ch02-03-compilation-metrics.md)
    - [Error Pattern Detection](ch02-04-error-patterns.md)
    - [Latest Ruchy Features (v0.9.6)](ch02-05-latest-features.md)

## Part III: Hybrid Development

- [Building Hybrid Scripts](ch03-00-hybrid-scripts.md)
    - [Ruchy Logic + System Helpers](ch03-01-ruchy-plus-helpers.md)
    - [External Command Execution](ch03-02-external-commands.md)
    - [Data Flow Architecture](ch03-03-data-flow.md)
    - [Testing Hybrid Systems](ch03-04-testing-hybrid.md)

## Part IV: System Configuration Patterns

- [Audio System Management](ch04-00-audio-systems.md)
    - [PipeWire Configuration](ch04-01-pipewire-config.md)
    - [Device Detection and Setup](ch04-02-device-detection.md)
    - [Troubleshooting Automation](ch04-03-troubleshooting.md)

- [System Information Gathering](ch05-00-system-info.md)
    - [Hardware Detection](ch05-01-hardware-detection.md)
    - [Service Monitoring](ch05-02-service-monitoring.md)
    - [Performance Metrics](ch05-03-performance-metrics.md)

- [Package Management](ch06-00-package-management.md)
    - [APT Integration](ch06-01-apt-integration.md)
    - [Dependency Resolution](ch06-02-dependency-resolution.md)
    - [System Updates](ch06-03-system-updates.md)

## Part V: Migration Strategies

- [From TypeScript to Ruchy](ch07-00-typescript-to-ruchy.md)
    - [Syntax Translation Patterns](ch07-01-syntax-translation.md)
    - [Type System Migration](ch07-02-type-migration.md)
    - [Async/Await Conversion](ch07-03-async-conversion.md)
    - [Error Handling Migration](ch07-04-error-handling.md)

- [Deno API Replacement](ch08-00-deno-api-replacement.md)
    - [File System Operations](ch08-01-filesystem-ops.md)
    - [Process Management](ch08-02-process-management.md)
    - [Environment Variables](ch08-03-environment-vars.md)
    - [Network Operations](ch08-04-network-ops.md)

## Part VI: Advanced Topics

- [Property-Based Testing](ch09-00-property-testing.md)
    - [Generator Design](ch09-01-generators.md)
    - [Invariant Testing](ch09-02-invariants.md)
    - [Shrinking Strategies](ch09-03-shrinking.md)

- [Actor System Integration](ch10-00-actor-systems.md)
    - [Service Monitoring with Actors](ch10-01-service-monitoring.md)
    - [Event-Driven Configuration](ch10-02-event-driven.md)
    - [Fault Tolerance](ch10-03-fault-tolerance.md)

- [Performance Optimization](ch11-00-performance.md)
    - [Compilation Optimization](ch11-01-compilation-opt.md)
    - [Runtime Performance](ch11-02-runtime-performance.md)
    - [Memory Management](ch11-03-memory-management.md)

## Part VII: Real-World Examples

- [Complete Script Migrations](ch12-00-complete-migrations.md)
    - [Audio Configuration Script](ch12-01-audio-config.md)
    - [System Diagnostics Tool](ch12-02-system-diagnostics.md)
    - [Package Manager Interface](ch12-03-package-manager.md)

- [Case Studies](ch13-00-case-studies.md)
    - [Performance Comparisons](ch13-01-performance-comparisons.md)
    - [Developer Experience](ch13-02-developer-experience.md)
    - [Maintenance Benefits](ch13-03-maintenance-benefits.md)

## Part VIII: Future Roadmap

- [Ruchy Development Roadmap](ch14-00-roadmap.md)
    - [Short-term Goals](ch14-01-short-term.md)
    - [Long-term Vision](ch14-02-long-term.md)
    - [Community Contribution](ch14-03-community.md)

## Appendices

- [Appendix A: Installation Guide](appendix-a-installation.md)
- [Appendix B: Ruchy Syntax Quick Reference](appendix-b-syntax.md)
- [Appendix C: Migration Checklist](appendix-c-migration-checklist.md)
- [Appendix D: Performance Benchmarks](appendix-d-benchmarks.md)
- [Appendix E: Instrumentation API Reference](appendix-e-instrumentation-api.md)
- [Appendix F: Troubleshooting Common Issues](appendix-f-troubleshooting.md)
- [Appendix G: Resources and Links](appendix-g-resources.md)