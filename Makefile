# Ubuntu Config Scripts - Main Makefile
#
# Run 'make help' to see all available commands
#
#bashrs:disable MAKE004
#bashrs:disable MAKE006
#bashrs:disable MAKE010
#bashrs:disable MAKE012
#bashrs:disable MAKE016

# Disable built-in suffix rules
.SUFFIXES:

# Delete partially-built files on error
.DELETE_ON_ERROR:

# Execute all recipe lines in a single shell
.ONESHELL:

# Prevent parallel execution (shared state access)
.NOTPARALLEL:

# Tool detection
DENO := $(shell command -v deno 2>/dev/null)
PMAT := $(shell command -v pmat 2>/dev/null)

# Colors for output
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[0;33m
BLUE := \033[0;34m
MAGENTA := \033[0;35m
CYAN := \033[0;36m
NC := \033[0m # No Color

# Default goal
.DEFAULT_GOAL := help

# Auto-update Deno before running commands
AUTO_UPDATE_DENO := true

# Include category-specific Makefiles
-include Makefile.audio
-include Makefile.network
-include Makefile.system
-include Makefile.dev
-include Makefile.ruchy
-include Makefile.rust
-include Makefile.book

# Phony targets
# bashrs:disable-line MAKE010
.PHONY: help all test test-coverage test-watch test-property lint format check \
	clean install check-deps validate validate-fast kaizen \
	_ensure-deno update-deno check-deno-updates disable-auto-update \
	deploy deploy-package deploy-clean \
	deps deps-outdated deps-update deps-update-dry deps-update-interactive \
	deps-lock deps-verify deps-clean pmat-info \
	help-audio help-network help-system help-dev

# Primary targets
help: ## Show this help message
	@echo "╔══════════════════════════════════════════════════════════════╗"
	@echo "║           🐧 Ubuntu Config Scripts - Deno TypeScript         ║"
	@echo "╚══════════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "$(CYAN)📋 Primary Commands:$(NC)"
	@echo "────────────────────────────────────────────────────────────────"
	@grep -h -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -v "^[[:space:]]" | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}' | sort
	@echo ""
	@echo "$(CYAN)🎵 Audio Scripts:$(NC) (see 'make help-audio')"
	@echo "────────────────────────────────────────────────────────────────"
	@if [ -f Makefile.audio ]; then \
		grep -h -E '^audio-[a-zA-Z_-]+:.*?## .*$$' Makefile.audio | head -3 | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'; \
	fi
	@[ -f Makefile.audio ] && echo "  $(YELLOW)...$(NC)                  Run 'make help-audio' for all audio commands" || echo "  $(RED)No audio scripts available$(NC)"
	@echo ""
	@echo "$(CYAN)🌐 Network Scripts:$(NC) (see 'make help-network')"
	@echo "────────────────────────────────────────────────────────────────"
	@if [ -f Makefile.network ]; then \
		grep -h -E '^network-[a-zA-Z_-]+:.*?## .*$$' Makefile.network | head -3 | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'; \
	fi
	@[ -f Makefile.network ] && echo "  $(YELLOW)...$(NC)                  Run 'make help-network' for all network commands" || echo "  $(RED)No network scripts available$(NC)"
	@echo ""
	@echo "$(CYAN)💻 System Scripts:$(NC) (see 'make help-system')"
	@echo "────────────────────────────────────────────────────────────────"
	@if [ -f Makefile.system ]; then \
		grep -h -E '^system-[a-zA-Z_-]+:.*?## .*$$' Makefile.system | grep -E "update-deno|all" | head -3 | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'; \
	fi
	@[ -f Makefile.system ] && echo "  $(YELLOW)...$(NC)                  Run 'make help-system' for all system commands" || echo "  $(RED)No system scripts available$(NC)"
	@echo ""
	@echo "$(CYAN)🛠️  Development Scripts:$(NC) (see 'make help-dev')"
	@echo "────────────────────────────────────────────────────────────────"
	@if [ -f Makefile.dev ]; then \
		grep -h -E '^dev-[a-zA-Z_-]+:.*?## .*$$' Makefile.dev | head -3 | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'; \
	fi
	@[ -f Makefile.dev ] && echo "  $(YELLOW)...$(NC)                  Run 'make help-dev' for all dev commands" || echo "  $(RED)No dev scripts available$(NC)"
	@echo ""
	@echo "$(CYAN)🦀 Rust Migration:$(NC) (see 'make rust-integration')"
	@echo "────────────────────────────────────────────────────────────────"
	@if [ -f Makefile.rust ]; then \
		grep -h -E '^rust-[a-zA-Z_-]+:.*?## .*$$' Makefile.rust | head -3 | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'; \
	fi
	@[ -f Makefile.rust ] && echo "  $(YELLOW)...$(NC)                  Run 'make -f Makefile.rust help' for all Rust commands" || echo "  $(RED)No Rust build system available$(NC)"
	@echo ""
	@echo "$(MAGENTA)💡 Tips:$(NC)"
	@echo "────────────────────────────────────────────────────────────────"
	@echo "  • Run 'make deps' to check all dependencies"
	@echo "  • Run 'make validate' before committing changes"
	@echo "  • Use 'make kaizen' for continuous improvement suggestions"
	@echo "  • All scripts are written in Deno TypeScript"
	@echo ""

all: validate ## Run format, lint, check, and test

# Testing targets
test: _ensure-deno ## Run all tests with coverage
	@echo "$(CYAN)🧪 Running all tests...$(NC)"
	@[ -n "$(DENO)" ] || (echo "$(RED)❌ Deno not found. Please install Deno first.$(NC)" >&2 && exit 1)
	@deno test --no-check --allow-all --coverage=coverage
	@echo "$(GREEN)✅ All tests passed!$(NC)"

test-coverage: test ## Run tests and generate coverage report
	@echo "$(CYAN)📊 Generating coverage report...$(NC)"
	@deno coverage coverage --lcov --output=coverage.lcov
	@deno coverage coverage
	@echo "$(GREEN)✅ Coverage report generated!$(NC)"

test-watch: ## Run tests in watch mode
	@echo "$(CYAN)👁️  Running tests in watch mode...$(NC)"
	@deno test --allow-all --watch

test-property: ## Run property-based tests
	@echo "$(CYAN)🎲 Running property-based tests...$(NC)"
	@deno test --allow-all tests/**/*.property.test.ts tests/**/contracts.test.ts
	@echo "$(GREEN)✅ Property tests passed!$(NC)"

# Linting and formatting
lint: _ensure-deno ## Run linter and formatter checks
	@echo "$(CYAN)🔍 Running lint checks...$(NC)"
	@[ -n "$(DENO)" ] || (echo "$(RED)❌ Deno not found. Please install Deno first.$(NC)" >&2 && exit 1)
	@deno fmt --check
	@deno lint
	@echo "$(GREEN)✅ Lint checks passed!$(NC)"

format: _ensure-deno ## Auto-format all code
	@echo "$(CYAN)✨ Formatting code...$(NC)"
	@[ -n "$(DENO)" ] || (echo "$(RED)❌ Deno not found. Please install Deno first.$(NC)" >&2 && exit 1)
	@deno fmt
	@echo "$(GREEN)✅ Code formatted!$(NC)"

check: _ensure-deno ## Type check all TypeScript files
	@echo "$(CYAN)🔧 Type checking...$(NC)"
	@[ -n "$(DENO)" ] || (echo "$(RED)❌ Deno not found. Please install Deno first.$(NC)" >&2 && exit 1)
	@find scripts -name "*.ts" -exec deno check {} \;
	@echo "$(GREEN)✅ Type checking passed!$(NC)"

# Validation and quality
validate: _ensure-deno format lint check test ## Run all validation checks
	@echo "$(GREEN)✅ All validation checks passed!$(NC)"
	@echo "$(CYAN)💡 For PMAT quality gates, use MCP integration in Claude Desktop$(NC)"

pmat-info: ## Show PMAT MCP setup instructions
	@echo "$(CYAN)🎯 PMAT Quality Gates via MCP$(NC)"
	@echo "────────────────────────────────────────────────────────────────"
	@echo ""
	@echo "PMAT should be used ONLY via MCP (Model Context Protocol):"
	@echo ""
	@echo "1. Register PMAT in Claude Desktop settings:"
	@echo '   "mcpServers": {'
	@echo '     "pmat": {'
	@echo '       "command": "pmat",'
	@echo '       "args": ["serve", "--mode", "mcp"]'
	@echo '     }'
	@echo '   }'
	@echo ""
	@echo "2. Use MCP tools in Claude (mcp_pmat_*) for:"
	@echo "   - Quality gate checks"
	@echo "   - Code analysis"
	@echo "   - Context generation"
	@echo "   - Refactoring"
	@echo ""
	@echo "$(YELLOW)⚠️  Do NOT run pmat commands directly$(NC)"

validate-fast: lint check ## Quick validation without tests
	@echo "$(GREEN)✅ Quick validation passed!$(NC)"

# Installation and dependencies
check-deps: ## Check all required dependencies
	@echo "$(CYAN)🔍 Checking dependencies...$(NC)"
	@echo ""
	@echo "Core dependencies:"
	@[ -n "$(DENO)" ] && echo "  $(GREEN)✓$(NC) Deno: $(DENO)" || echo "  $(RED)✗$(NC) Deno: Not found (required)"
	@[ -n "$(DENO)" ] && deno --version | sed 's/^/    /' || true
	@[ -z "$(DENO)" ] && echo "    Install: curl -fsSL https://deno.land/x/install/install.sh | sh" || true
	@echo ""
	@echo "Optional dependencies:"
	@[ -n "$(PMAT)" ] && echo "  $(GREEN)✓$(NC) PMAT: $(PMAT)" || echo "  $(YELLOW)○$(NC) PMAT: Not found (optional)"
	@[ -z "$(PMAT)" ] && echo "    Location: ../paiml-mcp-agent-toolkit" || true
	@echo ""

# bashrs:disable-line MAKE004
# bashrs:disable-line MAKE006
install: ## Install project dependencies (including Deno and pmat)
	@echo "$(CYAN)📦 Installing dependencies...$(NC)"
	@if [ -z "$(DENO)" ]; then \
		@echo "$(YELLOW)🔧 Deno not found. Installing Deno...$(NC)"; \
	fi
	@if [ -z "$(DENO)" ]; then \
		curl -fsSL https://deno.land/install.sh | sh || exit 1; \
	fi
	@if [ -z "$(DENO)" ]; then \
		@echo "$(GREEN)✅ Deno installed to ~/.deno$(NC)"; \
	fi
	@if [ -z "$(DENO)" ]; then \
		@echo "$(CYAN)📝 Adding Deno to PATH...$(NC)"; \
	fi
	@if [ -z "$(DENO)" ] && [ -f ~/.bashrc ] && ! grep -q ".deno/bin" ~/.bashrc; then \
		@echo 'export DENO_INSTALL="$$HOME/.deno"' >> ~/.bashrc; \
		@echo 'export PATH="$$DENO_INSTALL/bin:$$PATH"' >> ~/.bashrc; \
		@echo "$(GREEN)✅ Added Deno to ~/.bashrc$(NC)"; \
	fi
	@if [ -z "$(DENO)" ] && [ -f ~/.zshrc ] && ! grep -q ".deno/bin" ~/.zshrc; then \
		@echo 'export DENO_INSTALL="$$HOME/.deno"' >> ~/.zshrc; \
		@echo 'export PATH="$$DENO_INSTALL/bin:$$PATH"' >> ~/.zshrc; \
		@echo "$(GREEN)✅ Added Deno to ~/.zshrc$(NC)"; \
	fi
	@if [ -z "$(DENO)" ]; then \
		@echo "$(YELLOW)⚠️  Please run: source ~/.bashrc (or ~/.zshrc) to update PATH$(NC)"; \
	fi
	@if [ -z "$(DENO)" ]; then \
		@echo "$(CYAN)💡 Or start a new terminal session$(NC)"; \
	fi
	@if [ -z "$(DENO)" ]; then \
		@echo "$(GREEN)✅ Deno installation complete!$(NC)"; \
	fi
	@if [ -z "$(DENO)" ]; then \
		export PATH="$$HOME/.deno/bin:$$PATH" && $$HOME/.deno/bin/deno --version; \
	fi
	@if [ -n "$(DENO)" ]; then \
		@echo "$(GREEN)✅ Deno already installed: $(DENO)$(NC)"; \
	fi
	@if [ -n "$(DENO)" ]; then \
		deno --version; \
	fi
	@if [ -z "$(PMAT)" ]; then \
		@echo "$(YELLOW)🔧 PMAT not found. Installing PMAT...$(NC)"; \
		if command -v cargo >/dev/null 2>&1; then \
			@echo "$(CYAN)📦 Checking system dependencies for PMAT...$(NC)"; \
			if ! command -v pkg-config >/dev/null 2>&1; then \
				@echo "$(YELLOW)Installing pkg-config...$(NC)"; \
				if [ -x /usr/bin/apt ]; then \
					sudo apt update && sudo apt install -y pkg-config || exit 1; \
				elif [ -x /usr/bin/dnf ]; then \
					sudo dnf install -y pkg-config || exit 1; \
				elif [ -x /usr/bin/yum ]; then \
					sudo yum install -y pkg-config || exit 1; \
				else \
					# bashrs:disable-line MAKE010
					@echo "$(RED)❌ Could not install pkg-config. Please install manually:$(NC)"; \
					# bashrs:disable-line MAKE010
					@echo "    Ubuntu/Debian: sudo apt install pkg-config"; \
					# bashrs:disable-line MAKE010
					@echo "    Fedora: sudo dnf install pkg-config"; \
					# bashrs:disable-line MAKE010
					@echo "    RHEL/CentOS: sudo yum install pkg-config"; \
					exit 1; \
				fi; \
			fi; \
			if ! pkg-config --exists openssl 2>/dev/null; then \
				@echo "$(YELLOW)Installing OpenSSL development libraries...$(NC)"; \
				if [ -x /usr/bin/apt ]; then \
					sudo apt install -y libssl-dev || exit 1; \
				elif [ -x /usr/bin/dnf ]; then \
					sudo dnf install -y openssl-devel || exit 1; \
				elif [ -x /usr/bin/yum ]; then \
					sudo yum install -y openssl-devel || exit 1; \
				else \
					# bashrs:disable-line MAKE010
					@echo "$(RED)❌ Could not install OpenSSL dev libraries. Please install manually:$(NC)"; \
					# bashrs:disable-line MAKE010
					@echo "    Ubuntu/Debian: sudo apt install libssl-dev"; \
					# bashrs:disable-line MAKE010
					@echo "    Fedora/RHEL: sudo dnf/yum install openssl-devel"; \
					exit 1; \
				fi; \
			fi; \
			@echo "$(CYAN)🔨 Building PMAT from source...$(NC)"; \
			cargo install pmat || exit 1; \
			@echo "$(GREEN)✅ PMAT installed via cargo$(NC)"; \
		else \
			# bashrs:disable-line MAKE010
			@echo "$(RED)❌ Cargo not found. Please install Rust first:$(NC)"; \
			# bashrs:disable-line MAKE010
			@echo "    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"; \
			exit 1; \
		fi; \
	else \
		@echo "$(GREEN)✅ PMAT already installed: $(PMAT)$(NC)"; \
	fi
	@echo "$(GREEN)✅ All dependencies ready!$(NC)"

# Utility targets
# bashrs:disable-line MAKE004
clean: ## Clean generated files and caches
	@echo "$(CYAN)🧹 Cleaning...$(NC)"
	@rm -rf coverage coverage.lcov
	@rm -rf .deno_cache
	@rm -rf dist
	@find . -name "*.log" -delete
	@echo "$(GREEN)✅ Cleaned!$(NC)"

kaizen: ## Show continuous improvement suggestions
	@echo "$(CYAN)🌸 KAIZEN: 改善 - Continuous Improvement$(NC)"
	@echo "════════════════════════════════════════════════════════════════"
	@echo ""
	@echo "$(YELLOW)Current Status:$(NC)"
	@if [ -z "$(DENO)" ]; then \
		@echo "  $(RED)⚠️  Deno not installed$(NC)"; \
	else \
		@echo "  $(GREEN)✓$(NC) Deno installed"; \
	fi
	@test_count=$$(find tests -name "*.test.ts" 2>/dev/null | wc -l | tr -d ' '); \
	script_count=$$(find scripts -name "*.ts" 2>/dev/null | wc -l | tr -d ' '); \
	if [ $$test_count -lt $$script_count ]; then \
		@echo "  $(YELLOW)⚠️  Test coverage: $$test_count tests for $$script_count scripts$(NC)"; \
	else \
		@echo "  $(GREEN)✓$(NC) Test coverage: $$test_count tests for $$script_count scripts"; \
	fi
	@echo ""
	@echo "$(YELLOW)Suggestions:$(NC)"
	@echo "  1. Add more integration tests for complex scripts"
	@echo "  2. Implement automated dependency updates"
	@echo "  3. Add performance benchmarks for critical scripts"
	@echo "  4. Create script documentation generator"
	@echo "  5. Set up mutation testing for better test quality"
	@echo ""

# Help for specific categories
help-audio: ## Show audio-specific commands
	@if [ -f Makefile.audio ]; then \
		$(MAKE) -f Makefile.audio audio-help; \  # bashrs:disable-line MAKE012
	else \
		@echo "$(RED)No Makefile.audio found$(NC)"; \
	fi

help-network: ## Show network-specific commands
	@if [ -f Makefile.network ]; then \
		$(MAKE) -f Makefile.network help; \  # bashrs:disable-line MAKE012
	else \
		@echo "$(RED)No Makefile.network found$(NC)"; \
	fi

help-system: ## Show system-specific commands
	@if [ -f Makefile.system ]; then \
		$(MAKE) -f Makefile.system system-help; \  # bashrs:disable-line MAKE012
	else \
		@echo "$(RED)No Makefile.system found$(NC)"; \
	fi

help-dev: ## Show development-specific commands
	@if [ -f Makefile.dev ]; then \
		$(MAKE) -f Makefile.dev dev-help; \  # bashrs:disable-line MAKE012
	else \
		@echo "$(RED)No Makefile.dev found$(NC)"; \
	fi

# Internal target to ensure Deno is up to date
_ensure-deno:
	@if [ "$(AUTO_UPDATE_DENO)" = "true" ] && [ -n "$(DENO)" ] && [ -f scripts/system/update-deno.ts ]; then \
		deno run --allow-net --allow-run --allow-env scripts/system/update-deno.ts >/dev/null 2>&1 || true; \
	fi

# User-facing targets for Deno updates
update-deno: ## Update Deno to latest version
	@$(MAKE) system-update-deno  # bashrs:disable-line MAKE012

check-deno-updates: ## Check for Deno updates
	@$(MAKE) system-update-deno-check  # bashrs:disable-line MAKE012

disable-auto-update: ## Disable automatic Deno updates
	@echo "To disable auto-updates, run:"
	@echo "  export AUTO_UPDATE_DENO=false"
	@echo "Or add to your shell profile:"
	@echo "  echo 'export AUTO_UPDATE_DENO=false' >> ~/.bashrc"

# Deployment targets
# bashrs:disable-line MAKE004
deploy: ## Deploy all scripts as standalone binaries
	@$(MAKE) dev-deploy  # bashrs:disable-line MAKE012

deploy-package: ## Create deployment package
	@$(MAKE) dev-deploy-package  # bashrs:disable-line MAKE012

deploy-clean: ## Clean deployment artifacts
	@$(MAKE) dev-clean-dist  # bashrs:disable-line MAKE012

# Dependency management (Cargo-style)
deps: ## List all dependencies
	@$(MAKE) dev-deps  # bashrs:disable-line MAKE012

deps-outdated: ## Check for outdated dependencies
	@$(MAKE) dev-deps-outdated  # bashrs:disable-line MAKE012

deps-update: ## Update all dependencies
	@$(MAKE) dev-deps-update  # bashrs:disable-line MAKE012

deps-update-dry: ## Preview dependency updates
	@$(MAKE) dev-deps-update-dry  # bashrs:disable-line MAKE012

deps-update-interactive: ## Interactively update dependencies
	@$(MAKE) dev-deps-update-interactive  # bashrs:disable-line MAKE012

deps-lock: ## Update lock file (deno.lock)
	@$(MAKE) dev-deps-lock  # bashrs:disable-line MAKE012

deps-verify: ## Verify locked dependencies
	@$(MAKE) dev-deps-verify  # bashrs:disable-line MAKE012

deps-clean: ## Clean dependency cache
	@$(MAKE) dev-deps-clean  # bashrs:disable-line MAKE012