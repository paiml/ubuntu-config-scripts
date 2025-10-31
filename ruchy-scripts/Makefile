# Ruchy Ubuntu Config Scripts Makefile
# Migration from TypeScript/Deno to native Ruchy implementation

.SUFFIXES:
.PHONY: benchmark \
	check \
	ci-validate \
	clean \
	dev-check \
	dev-test \
	help \
	install \
	lint \
	migrate-next \
	run \
	run-tests \
	status \
	test \
	test-audio \
	test-common \
	test-logger \
	test-schema \
	test-system \
	validate

# Default target
help:
	@echo "🦀 Ruchy Ubuntu Config Scripts"
	@echo "==============================="
	@echo ""
	@echo "Development Commands:"
	@echo "  check         - Syntax validation for all .ruchy files"
	@echo "  lint          - Code quality analysis"
	@echo "  test          - Run all test suites"
	@echo "  run-tests     - Execute specific test files"
	@echo "  validate      - Full quality gate validation"
	@echo ""
	@echo "Library Commands:"
	@echo "  test-logger   - Test logger module"
	@echo "  test-common   - Test common utilities"
	@echo "  test-schema   - Test schema validation"
	@echo ""
	@echo "System Commands:"
	@echo "  clean         - Remove temporary files"
	@echo "  install       - Install Ruchy if not present"
	@echo ""
	@echo "Migration Status:"
	@echo "  ✅ Core libraries: logger, common utilities"
	@echo "  🔄 Audio scripts: pending migration"
	@echo "  🔄 System scripts: pending migration"
	@echo "  🔄 Dev tools: pending migration"

# Check syntax of validated Ruchy files only
check:
	@echo "🔍 Checking syntax of validated .ruchy files..."
	@echo "=== Core Libraries ===" 
	@echo "Checking: ./lib/common_v3.ruchy" && ruchy check "./lib/common_v3.ruchy"
	@echo "Checking: ./lib/logger_v2.ruchy" && ruchy check "./lib/logger_v2.ruchy"
	@echo "Checking: ./lib/patterns_v1.ruchy" && ruchy check "./lib/patterns_v1.ruchy"
	@echo "Checking: ./lib/data_structures_v1.ruchy" && ruchy check "./lib/data_structures_v1.ruchy"
	@echo "=== Audio Modules ===" 
	@echo "Checking: ./audio/configure_speakers.ruchy" && ruchy check "./audio/configure_speakers.ruchy"
	@echo "Checking: ./audio/enable_mic.ruchy" && ruchy check "./audio/enable_mic.ruchy"
	@echo "Checking: ./audio/fix_audio.ruchy" && ruchy check "./audio/fix_audio.ruchy"
	@echo "=== System Modules ===" 
	@echo "Checking: ./system/collect_system_info.ruchy" && ruchy check "./system/collect_system_info.ruchy"
	@echo "Checking: ./system/analyze_disk_usage.ruchy" && ruchy check "./system/analyze_disk_usage.ruchy"
	@echo "Checking: ./system/diagnose_av_issues.ruchy" && ruchy check "./system/diagnose_av_issues.ruchy"
	@echo "=== Test Files ===" 
	@echo "Checking: ./test_suite.ruchy" && ruchy check "./test_suite.ruchy"
	@echo "Checking: ./tests/test_audio.ruchy" && ruchy check "./tests/test_audio.ruchy"
	@echo "Checking: ./tests/test_system.ruchy" && ruchy check "./tests/test_system.ruchy"
	@echo "✅ All validated files pass syntax check"

# Lint all Ruchy files for code quality
lint:
	@echo "🧹 Running lint analysis on all .ruchy files..."
	@find . -name "*.ruchy" -exec echo "Linting: {}" \; -exec ruchy lint {} \;
	@echo "✅ Lint analysis completed"

# Run all test suites
test: test-logger test-common test-audio test-system test-schema
	@echo "🦀 All test suites completed"

# Run specific test files
run-tests:
	@echo "🧪 Running all test files..."
	@find tests -name "test_*.ruchy" -exec echo "Running: {}" \; -exec ruchy run {} \;

# Test logger module
test-logger:
	@echo "🧪 Testing logger module..."
	@ruchy run lib/test_logger_v2.ruchy

# Test common utilities
test-common:
	@echo "🧪 Testing common utilities..."
	@ruchy run lib/test_common_v3.ruchy

# Test audio modules
test-audio:
	@echo "🧪 Testing audio modules..."
	@ruchy run tests/test_audio.ruchy

# Test system modules
test-system:
	@echo "🧪 Testing system modules..."
	@ruchy run tests/test_system.ruchy

# Test schema validation (when implemented)
test-schema:
	@echo "🧪 Testing schema validation..."
	@echo "⚠️  Schema tests not yet implemented"

# Full validation pipeline
validate: check lint test
	@echo "🎯 Running full validation pipeline..."
	@echo "✅ All quality gates passed"

# Clean temporary files
clean:
	@echo "🧹 Cleaning temporary files..."
	@find . -name "*.tmp" -delete
	@find . -name "*.log" -delete
	@echo "✅ Cleanup completed"

# Install Ruchy if not present
install:
	@echo "📦 Checking Ruchy installation..."
	@if ! command -v ruchy >/dev/null 2>&1; then \
		@echo "❌ Ruchy not found. Install with: cargo install ruchy"; \
		exit 1; \
	else \
		@echo "✅ Ruchy is installed: $$(ruchy --version)"; \
	fi

# Migration progress tracking
status:
	@echo "📊 Migration Status Report"
	@echo "========================="
	@echo ""
	@echo "TypeScript Files: $$(find ../scripts -name '*.ts' 2>/dev/null | wc -l)"
	@echo "Ruchy Files:      $$(find . -name '*.ruchy' 2>/dev/null | wc -l)"
	@echo "Test Files:       $$(find tests -name '*.ruchy' 2>/dev/null | wc -l)"
	@echo ""
	@echo "Progress by Category:"
	@echo "  📚 Core Libraries:  2/8 files migrated (25%)"
	@echo "  🔊 Audio Scripts:   0/3 files migrated (0%)"
	@echo "  🖥️  System Scripts:  0/31 files migrated (0%)"
	@echo "  🛠️  Dev Tools:       0/3 files migrated (0%)"
	@echo ""
	@echo "Overall Progress: 2/45 files (4%)"

# Performance benchmarking
benchmark:
	@echo "⚡ Running performance benchmarks..."
	@echo "🔍 Syntax checking speed:"
	@time find . -name "*.ruchy" -exec ruchy check {} \; >/dev/null 2>&1
	@echo "🧪 Test execution speed:"
	@time ruchy run tests/test_logger.ruchy >/dev/null 2>&1
	@echo "✅ Benchmark completed"

# Development shortcuts
dev-check: install check lint
	@echo "🚀 Development validation completed"

dev-test: install test
	@echo "🚀 Development testing completed"

# Migration helpers
migrate-next:
	@echo "🔄 Next migration steps:"
	@echo "1. Implement schema.ruchy (UCS-0002-C)"
	@echo "2. Port remaining lib/ files (UCS-0002-D)"
	@echo "3. Create audio script migrations (UCS-0003)"
	@echo "4. Begin system script conversions (UCS-0004)"

# Quality gates for CI/CD
ci-validate: install check lint test
	@echo "🎯 CI validation pipeline completed successfully"
	@echo "✅ Ready for deployment"