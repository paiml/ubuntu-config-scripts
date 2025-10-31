# Introduction

Welcome to the Ubuntu Config Scripts migration guide! This book documents the journey from TypeScript/Deno to Ruchy, showcasing a hybrid architecture that allows both languages to coexist.

## What You'll Learn

This guide covers:
- **Hybrid Architecture**: How TypeScript and Ruchy work together
- **Migration Process**: Step-by-step conversion guidelines
- **Quality Standards**: TDD, PMAT TDG, and performance requirements
- **Production Examples**: Real-world implementations and best practices

## The System Diagnostic Showcase

Our flagship example demonstrates Ruchy's capabilities:

```ruchy
// Collect real-time system information
let info = collect_system_info();
println!("{}", format_human_readable(&info));
```

This tool achieves:
- **Ruchy Score**: 0.95/1.0
- **PMAT TDG**: 0.87/1.0
- **Performance**: < 1 second execution
- **Binary Size**: < 5MB

## Getting Started

1. **Run the showcase**: `make ruchy-showcase`
2. **Explore the code**: Check `ruchy-scripts/system/system_diagnostic.ruchy`
3. **Read the architecture**: See [Architecture Overview](../docs/architecture/ubuntu-config-scripts-1.0.md)

## Migration Philosophy

Our approach emphasizes:
- **Zero Downtime**: TypeScript remains fully functional
- **Quality First**: Comprehensive testing and quality gates
- **Performance**: Native speed with memory safety
- **Community**: Open source collaboration and feedback

Let's begin the journey to high-performance system administration tools!
