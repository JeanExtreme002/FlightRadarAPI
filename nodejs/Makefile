# Makefile for FlightRadarAPI npm package

# Variables
PACKAGE_NAME = flightradarapi
NODE_MODULES = node_modules
DIST_DIR = dist
COVERAGE_DIR = coverage

# Colors for output
GREEN = \033[0;32m
YELLOW = \033[0;33m
RED = \033[0;31m
NC = \033[0m # No Color

# Default target
.PHONY: help
help:
	@echo "$(GREEN)FlightRadarAPI npm package Makefile$(NC)"
	@echo ""
	@echo "Available targets:"
	@echo "  $(YELLOW)install$(NC)     - Install dependencies"
	@echo "  $(YELLOW)test$(NC)        - Run tests"
	@echo "  $(YELLOW)lint$(NC)        - Run linter"
	@echo "  $(YELLOW)lint-fix$(NC)    - Run linter and fix issues"
	@echo "  $(YELLOW)clean$(NC)       - Clean build artifacts"
	@echo "  $(YELLOW)build$(NC)       - Build the package"
	@echo "  $(YELLOW)validate$(NC)    - Validate package before publishing"
	@echo "  $(YELLOW)publish$(NC)     - Publish to npm registry"
	@echo "  $(YELLOW)publish-dry$(NC) - Dry run publish (test without uploading)"
	@echo "  $(YELLOW)version-patch$(NC) - Bump patch version"
	@echo "  $(YELLOW)version-minor$(NC) - Bump minor version"
	@echo "  $(YELLOW)version-major$(NC) - Bump major version"
	@echo "  $(YELLOW)check-deps$(NC)  - Check for outdated dependencies"
	@echo "  $(YELLOW)update-deps$(NC) - Update dependencies"
	@echo "  $(YELLOW)security$(NC)    - Run security audit"
	@echo "  $(YELLOW)all$(NC)         - Run full build pipeline (install, lint, test, validate)"

# Install dependencies
.PHONY: install
install:
	@echo "$(GREEN)Installing dependencies...$(NC)"
	npm install
	@echo "$(GREEN)Dependencies installed successfully!$(NC)"

# Run tests
.PHONY: test
test:
	@echo "$(GREEN)Running tests...$(NC)"
	npm test
	@echo "$(GREEN)Tests completed!$(NC)"

# Run linter
.PHONY: lint
lint:
	@echo "$(GREEN)Running linter...$(NC)"
	npm run lint
	@echo "$(GREEN)Linting completed!$(NC)"

# Run linter with auto-fix
.PHONY: lint-fix
lint-fix:
	@echo "$(GREEN)Running linter with auto-fix...$(NC)"
	npx eslint . --fix
	@echo "$(GREEN)Linting and fixing completed!$(NC)"

# Clean build artifacts
.PHONY: clean
clean:
	@echo "$(GREEN)Cleaning build artifacts...$(NC)"
	rm -rf $(NODE_MODULES)
	rm -rf $(DIST_DIR)
	rm -rf $(COVERAGE_DIR)
	rm -f package-lock.json
	rm -f *.tgz
	@echo "$(GREEN)Cleanup completed!$(NC)"

# Build package (prepare for publishing)
.PHONY: build
build: install lint test
	@echo "$(GREEN)Building package...$(NC)"
	npm pack
	@echo "$(GREEN)Package built successfully!$(NC)"

# Validate package before publishing
.PHONY: validate
validate:
	@echo "$(GREEN)Validating package...$(NC)"
	npm pack --dry-run
	@echo "$(GREEN)Package validation completed!$(NC)"

# Publish to npm registry
.PHONY: publish
publish: validate
	@echo "$(YELLOW)Are you sure you want to publish to npm? [y/N]$(NC)" && read ans && [ $${ans:-N} = y ]
	@echo "$(GREEN)Publishing to npm...$(NC)"
	npm publish
	@echo "$(GREEN)Package published successfully!$(NC)"

# Dry run publish (test without uploading)
.PHONY: publish-dry
publish-dry:
	@echo "$(GREEN)Running publish dry run...$(NC)"
	npm publish --dry-run
	@echo "$(GREEN)Publish dry run completed!$(NC)"

# Version bumping
.PHONY: version-patch
version-patch:
	@echo "$(GREEN)Bumping patch version...$(NC)"
	npm version patch
	@echo "$(GREEN)Patch version bumped!$(NC)"

.PHONY: version-minor
version-minor:
	@echo "$(GREEN)Bumping minor version...$(NC)"
	npm version minor
	@echo "$(GREEN)Minor version bumped!$(NC)"

.PHONY: version-major
version-major:
	@echo "$(GREEN)Bumping major version...$(NC)"
	npm version major
	@echo "$(GREEN)Major version bumped!$(NC)"

# Check for outdated dependencies
.PHONY: check-deps
check-deps:
	@echo "$(GREEN)Checking for outdated dependencies...$(NC)"
	npm outdated

# Update dependencies
.PHONY: update-deps
update-deps:
	@echo "$(GREEN)Updating dependencies...$(NC)"
	npm update
	@echo "$(GREEN)Dependencies updated!$(NC)"

# Security audit
.PHONY: security
security:
	@echo "$(GREEN)Running security audit...$(NC)"
	npm audit
	@echo "$(GREEN)Security audit completed!$(NC)"

# Fix security vulnerabilities
.PHONY: security-fix
security-fix:
	@echo "$(GREEN)Fixing security vulnerabilities...$(NC)"
	npm audit fix
	@echo "$(GREEN)Security vulnerabilities fixed!$(NC)"

# Full build pipeline
.PHONY: all
all: install lint test validate
	@echo "$(GREEN)Full build pipeline completed successfully!$(NC)"

# Development workflow targets
.PHONY: dev-setup
dev-setup: install
	@echo "$(GREEN)Development environment setup completed!$(NC)"

.PHONY: pre-commit
pre-commit: lint test
	@echo "$(GREEN)Pre-commit checks passed!$(NC)"

.PHONY: pre-publish
pre-publish: all security
	@echo "$(GREEN)Pre-publish checks completed!$(NC)"

# CI/CD targets
.PHONY: ci
ci: install lint test validate
	@echo "$(GREEN)CI pipeline completed!$(NC)"

# Show package info
.PHONY: info
info:
	@echo "$(GREEN)Package Information:$(NC)"
	@npm list --depth=0
	@echo ""
	@echo "$(GREEN)Package Size:$(NC)"
	@npm pack --dry-run | grep "npm notice package size"

# Login to npm (for CI/CD)
.PHONY: npm-login
npm-login:
	@echo "$(GREEN)Logging in to npm...$(NC)"
	npm login

# Logout from npm
.PHONY: npm-logout
npm-logout:
	@echo "$(GREEN)Logging out from npm...$(NC)"
	npm logout

# Quick release workflow
.PHONY: release-patch
release-patch: pre-publish version-patch publish
	@echo "$(GREEN)Patch release completed!$(NC)"

.PHONY: release-minor
release-minor: pre-publish version-minor publish
	@echo "$(GREEN)Minor release completed!$(NC)"

.PHONY: release-major
release-major: pre-publish version-major publish
	@echo "$(GREEN)Major release completed!$(NC)"
