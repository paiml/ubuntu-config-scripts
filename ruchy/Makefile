# Ruchy-based Ubuntu Config Scripts Makefile
# Integrated with PMAT quality gates and TDD workflow

.SUFFIXES:
.PHONY: all \
	audit \
	basic-quality-check \
	benchmark \
	bridge-validate \
	build \
	build-debug \
	check \
	check-deps \
	ci-build \
	ci-prepare \
	ci-validate \
	clean \
	clean-all \
	deploy \
	dev-monitor \
	dev-setup \
	docs \
	format \
	format-check \
	help \
	install \
	install-dev \
	lint \
	package \
	pmat-check \
	pmat-init \
	quick-check \
	test \
	test-coverage \
	test-property \
	test-watch \
	validate
.DEFAULT_GOAL := all

# Configuration
RUCHY_BIN := $(shell which ruchy)
CARGO_BIN := $(shell which cargo)
PMAT_BIN := $(shell which pmat)
TARGET_DIR := target
BINARY_NAME := ubuntu-config

# Quality gate requirements
MIN_COVERAGE := 80
MAX_COMPLEXITY := 10

all: validate build test

# Dependency checks
check-deps:
	@echo "Checking dependencies..."
	@command -v ruchy >/dev/null 2>&1 || { echo "Error: ruchy not found. Install with: cargo install ruchy"; exit 1; }
	@command -v cargo >/dev/null 2>&1 || { echo "Error: cargo not found. Install Rust toolchain"; exit 1; }
	@command -v pmat >/dev/null 2>&1 || { echo "Warning: pmat not found. Quality gates will be limited"; }
	@echo "✓ Dependencies check passed"

# PMAT integration
pmat-init:
	@if [ -n "$(PMAT_BIN)" ]; then \
		@echo "Initializing PMAT..."; \
		$(PMAT_BIN) init || true; \
	else \
		@echo "PMAT not found - skipping initialization"; \
	fi

pmat-check: pmat-init
	@if [ -n "$(PMAT_BIN)" ]; then \
		@echo "Running PMAT quality gates..."; \
		$(PMAT_BIN) check --all --min-coverage=$(MIN_COVERAGE) --max-complexity=$(MAX_COMPLEXITY); \
	else \
		@echo "PMAT not found - running basic checks instead"; \
		$(MAKE) basic-quality-check; \
	fi

basic-quality-check:
	@echo "Running basic quality checks..."
	cargo clippy -- -D warnings
	cargo fmt --check
	@echo "✓ Basic quality checks passed"

# Build targets
build: check-deps
	@echo "Building Ruchy project..."
	cargo build --release
	@echo "✓ Build completed: $(TARGET_DIR)/release/$(BINARY_NAME)"

build-debug: check-deps
	@echo "Building debug version..."
	cargo build
	@echo "✓ Debug build completed: $(TARGET_DIR)/debug/$(BINARY_NAME)"

# Test targets with TDD support
test: check-deps
	@echo "Running test suite..."
	cargo test --verbose
	@echo "✓ Tests completed"

test-property: check-deps
	@echo "Running property-based tests..."
	cargo test --features property-tests --verbose
	@echo "✓ Property tests completed"

test-coverage: check-deps
	@echo "Generating coverage report with LLVM..."
	@if command -v cargo-llvm-cov >/dev/null 2>&1; then \
		cargo llvm-cov --html --open; \
		cargo llvm-cov --lcov --output-path target/coverage/lcov.info; \
		@echo "✓ Coverage report generated"; \
	else \
		@echo "cargo-llvm-cov not found. Install with: cargo install cargo-llvm-cov"; \
		exit 1; \
	fi

test-watch:
	@echo "Starting test watcher..."
	cargo watch -x test

# Validation pipeline
validate: check-deps pmat-check test-property bridge-validate
	@echo "✓ Full validation pipeline completed"

bridge-validate: build-debug
	@echo "Running bridge validator..."
	$(TARGET_DIR)/debug/$(BINARY_NAME) dev bridge-validator
	@echo "✓ Bridge validation completed"

# Quality assurance
lint:
	@echo "Running linter..."
	cargo clippy -- -D warnings
	@echo "✓ Lint check passed"

format:
	@echo "Formatting code..."
	cargo fmt
	@echo "✓ Code formatted"

format-check:
	@echo "Checking code formatting..."
	cargo fmt --check
	@echo "✓ Format check passed"

audit:
	@echo "Running security audit..."
	@if command -v cargo-audit >/dev/null 2>&1; then \
		cargo audit; \
	else \
		@echo "cargo-audit not found. Install with: cargo install cargo-audit"; \
	fi
	@echo "✓ Security audit completed"

# Deployment targets
package: validate build
	@echo "Creating deployment packages..."
	$(TARGET_DIR)/release/$(BINARY_NAME) dev deploy
	@echo "✓ Packages created"

install: build
	@echo "Installing ubuntu-config-scripts..."
	sudo target/install.sh
	@echo "✓ Installation completed"

install-dev: build-debug
	@echo "Installing development version..."
	sudo cp $(TARGET_DIR)/debug/$(BINARY_NAME) /usr/local/bin/$(BINARY_NAME)-dev
	sudo chmod +x /usr/local/bin/$(BINARY_NAME)-dev
	@echo "✓ Development version installed as $(BINARY_NAME)-dev"

# Development workflow
dev-setup:
	@echo "Setting up development environment..."
	$(TARGET_DIR)/debug/$(BINARY_NAME) dev install-pmat-deps
	$(MAKE) pmat-init
	@echo "✓ Development environment ready"

dev-monitor:
	@echo "Starting development monitor..."
	$(TARGET_DIR)/debug/$(BINARY_NAME) dev ruchy-monitor --no-service
	@echo "✓ Development monitor completed"

# Clean targets
clean:
	@echo "Cleaning build artifacts..."
	cargo clean
	rm -rf target/debian
	rm -rf target/*.AppDir
	rm -f target/*.AppImage
	rm -f target/install.sh
	rm -f target/*.deb
	rm -f target/*.sha256
	@echo "✓ Clean completed"

clean-all: clean
	@echo "Removing all generated files..."
	rm -rf .pmat
	rm -rf coverage
	@echo "✓ Deep clean completed"

# Utility targets
check: format-check lint test
	@echo "✓ All checks passed"

quick-check: format-check lint
	@echo "✓ Quick checks passed"

benchmark:
	@echo "Running benchmarks..."
	cargo bench
	@echo "✓ Benchmarks completed"

# Documentation
docs:
	@echo "Generating documentation..."
	cargo doc --open
	@echo "✓ Documentation generated"

# CI/CD support targets
ci-prepare: check-deps pmat-init
	@echo "Preparing for CI environment..."
	@echo "✓ CI preparation completed"

ci-validate: ci-prepare validate
	@echo "✓ CI validation completed"

ci-build: ci-validate build package
	@echo "✓ CI build completed"

# Help target
help:
	@echo "Ubuntu Config Scripts - Ruchy Build System"
	@echo ""
	@echo "Main targets:"
	@echo "  all          - Build and test everything (default)"
	@echo "  build        - Build release binary"
	@echo "  test         - Run test suite"
	@echo "  validate     - Run full validation pipeline with PMAT"
	@echo "  package      - Create deployment packages"
	@echo "  install      - Install to system"
	@echo ""
	@echo "Development targets:"
	@echo "  dev-setup    - Set up development environment"
	@echo "  test-watch   - Run tests in watch mode"
	@echo "  test-coverage- Generate coverage report"
	@echo "  format       - Format code"
	@echo "  lint         - Run linter"
	@echo ""
	@echo "Quality gates:"
	@echo "  pmat-check   - Run PMAT quality analysis"
	@echo "  bridge-validate - Validate Ruchy bridge"
	@echo "  audit        - Security audit"
	@echo ""
	@echo "Cleanup:"
	@echo "  clean        - Remove build artifacts"
	@echo "  clean-all    - Remove all generated files"
	@echo ""
	@echo "For more information, see README.md"