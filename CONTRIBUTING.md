# Contributing to Ubuntu Config Scripts

Thank you for your interest in contributing to Ubuntu Config Scripts! We welcome contributions to our hybrid TypeScript/Ruchy architecture.

## 🚀 Quick Start

### For the Ruchy Showcase
1. **Run the showcase**: `make ruchy-showcase`
2. **Run tests**: `make ruchy-showcase-test`
3. **View source**: Check out `ruchy-scripts/system/system_diagnostic.ruchy`
4. **Read docs**: See [Architecture Overview](docs/architecture/ubuntu-config-scripts-1.0.md)

## How to Contribute

### Reporting Issues

- Check if the issue already exists in the [issue tracker](https://github.com/paiml/ubuntu-config-scripts/issues)
- Create a new issue with a clear title and description
- Include steps to reproduce the problem
- Add relevant system information (Ubuntu version, Deno version, etc.)

### Submitting Pull Requests

1. **Fork the repository**
   ```bash
   git clone https://github.com/paiml/ubuntu-config-scripts.git
   cd ubuntu-config-scripts
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Write clean, readable code
   - Follow the existing code style
   - Add tests for new functionality
   - Update documentation as needed

4. **Run validation**
   ```bash
   make validate  # Runs format, lint, type-check, and tests
   ```

5. **Commit your changes**
   ```bash
   git commit -m "feat: Add your feature description"
   ```
   
   We follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` New features
   - `fix:` Bug fixes
   - `docs:` Documentation changes
   - `test:` Test additions or changes
   - `refactor:` Code refactoring
   - `style:` Code style changes
   - `chore:` Build process or auxiliary tool changes

6. **Push and create a Pull Request**
   ```bash
   git push origin feature/your-feature-name
   ```
   Then create a PR on GitHub with a clear description.

## Development Guidelines

### Code Quality

#### TypeScript Requirements
- **TypeScript**: Use strict TypeScript with no implicit `any`
- **Testing**: Maintain minimum 95% test coverage
- **Property Testing**: Use fast-check for complex logic
- **No Bash Scripts**: All functionality must be in TypeScript/Deno

#### Ruchy Requirements (Experimental)
- **Ruchy Score**: ≥ 0.90 (use `ruchy score <file>`)
- **PMAT TDG**: ≥ 0.85 (use `pmat analyze <file>`)
- **TDD Approach**: Write tests first in `ruchy-scripts/tests/`
- **Performance**: < 1 second execution, < 5MB binaries

### Project Structure

```
ubuntu-config-scripts/
├── scripts/              # TypeScript implementations (production)
│   ├── lib/             # Core libraries (common, logger, schema)
│   ├── audio/           # Audio management scripts
│   ├── system/          # System configuration scripts
│   └── dev/             # Development tools & bridge transformer
├── ruchy-scripts/        # Ruchy implementations (experimental)
│   ├── lib/             # Core libraries in Ruchy
│   ├── system/          # System scripts in Ruchy
│   └── tests/           # TDD tests for Ruchy code
├── tests/               # TypeScript test files
├── docs/                # Documentation
│   ├── architecture/    # Architecture documentation  
│   ├── migration/       # Migration guides
│   └── sprints/         # Sprint planning documents
└── book/                # Migration guide book
```

### Testing

#### TypeScript Tests
```bash
make test           # Run all TypeScript tests
make test-property  # Run property-based tests
make test-coverage  # Generate coverage report
make test-watch     # Run tests in watch mode
```

#### Ruchy Tests (Experimental)
```bash
make ruchy-showcase-test    # Run system diagnostic tests
make ruchy-ci              # Full quality pipeline
make ruchy-pmat-analysis   # PMAT TDG analysis
```

### Building and Deployment

#### TypeScript/Deno
```bash
make build          # Build the project
make deploy         # Create binary distributions
make dev-deploy     # Deploy specific categories
```

#### Ruchy (Experimental)
```bash
make ruchy-showcase # Build and run system diagnostic
make ruchy-build    # Build all Ruchy scripts to binaries
make ruchy-package  # Create distribution package
```

## Code of Conduct

### Our Pledge

We are committed to providing a friendly, safe, and welcoming environment for all contributors.

### Expected Behavior

- Be respectful and inclusive
- Accept constructive criticism gracefully
- Focus on what is best for the community
- Show empathy towards other community members

### Unacceptable Behavior

- Harassment, discrimination, or offensive comments
- Personal attacks or trolling
- Public or private harassment
- Publishing others' private information without permission

## Getting Help

- Check the [README](README.md) for basic usage
- Review existing [issues](https://github.com/paiml/ubuntu-config-scripts/issues)
- Ask questions in [discussions](https://github.com/paiml/ubuntu-config-scripts/discussions)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.