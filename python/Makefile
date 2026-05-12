# Makefile for FlightRadarAPI Python package

# Variables
PACKAGE_NAME = FlightRadar24
BUILD_DIR = build
DIST_DIR = dist
EGG_INFO = $(PACKAGE_NAME).egg-info
VENV_DIR = venv
TEST_DIR = tests

# Minimum offline coverage required by `test-coverage` and by the CI workflow.
# Keep this single source-of-truth in sync with `.github/workflows/python-package.yml`
# (raise both together when the offline suite grows).
COVERAGE_MIN = 60

# Dev tooling installed by `install-dev` / `dev-setup` on top of `.[tests]`.
# Centralised so the two targets do not drift.
DEV_TOOLS = pytest-cov flake8 black mypy twine build hatch pip-audit

# Auto-detect virtualenv. When `venv/` already exists, every target uses its
# interpreter so `make test` / `make lint` / etc. work without first running
# `source venv/bin/activate`. Otherwise we fall back to the system python.
#
# Targets that *create* the venv (notably `dev-setup`) must call
# `$(VENV_DIR)/bin/pip` directly — variable expansion happens at parse time,
# so the auto-detection below cannot pick up a venv created later in the
# same `make` invocation.
ifneq ($(wildcard $(VENV_DIR)/bin/python),)
PYTHON := $(VENV_DIR)/bin/python
PIP := $(VENV_DIR)/bin/pip
else
PYTHON := python3
PIP := pip3
endif

# Colors for output
GREEN = \033[0;32m
YELLOW = \033[0;33m
NC = \033[0m # No Color

# Default target
.PHONY: help
help:
	@echo "$(GREEN)FlightRadarAPI Python package Makefile$(NC)"
	@echo ""
	@echo "Available targets:"
	@echo "  $(YELLOW)install$(NC)          - Install package in development mode"
	@echo "  $(YELLOW)install-deps$(NC)     - Install dependencies"
	@echo "  $(YELLOW)install-dev$(NC)      - Install development dependencies"
	@echo "  $(YELLOW)test$(NC)             - Run tests"
	@echo "  $(YELLOW)test-verbose$(NC)     - Run tests with verbose output"
	@echo "  $(YELLOW)test-coverage$(NC)    - Run tests with coverage report"
	@echo "  $(YELLOW)lint$(NC)             - Run linter (flake8)"
	@echo "  $(YELLOW)lint-fix$(NC)         - Run auto-formatter (black)"
	@echo "  $(YELLOW)type-check$(NC)       - Run type checker (mypy)"
	@echo "  $(YELLOW)clean$(NC)            - Clean build artifacts"
	@echo "  $(YELLOW)build$(NC)            - Build package"
	@echo "  $(YELLOW)build-wheel$(NC)      - Build wheel package"
	@echo "  $(YELLOW)build-sdist$(NC)      - Build source distribution"
	@echo "  $(YELLOW)validate$(NC)         - Validate package"
	@echo "  $(YELLOW)publish$(NC)          - Publish to PyPI"
	@echo "  $(YELLOW)publish-test$(NC)     - Publish to Test PyPI"
	@echo "  $(YELLOW)version$(NC)          - Show current version"
	@echo "  $(YELLOW)check-deps$(NC)       - Check for outdated dependencies"
	@echo "  $(YELLOW)update-deps$(NC)      - Update dependencies"
	@echo "  $(YELLOW)security$(NC)         - Run security audit"
	@echo "  $(YELLOW)docs$(NC)             - Build the MkDocs site (output in ../site/)"
	@echo "  $(YELLOW)docs-serve$(NC)       - Serve the MkDocs site locally with auto-reload"
	@echo "  $(YELLOW)venv$(NC)             - Create virtual environment"
	@echo "  $(YELLOW)all$(NC)              - Run full pipeline (install, lint, test, build)"

# Create virtual environment.
#
# Uses `python3` literally rather than `$(PYTHON)`: when this target runs with
# an existing venv on disk the auto-detection at the top would point at
# `venv/bin/python` and we'd be asking the venv to recreate itself, which is
# both confusing and unreliable on Python builds with restricted `venv`
# support. The system python3 is the right bootstrap interpreter.
.PHONY: venv
venv:
	@echo "$(GREEN)Creating virtual environment...$(NC)"
	python3 -m venv $(VENV_DIR)
	@echo "$(GREEN)Virtual environment created in $(VENV_DIR)$(NC)"
	@echo "$(YELLOW)To activate: source $(VENV_DIR)/bin/activate$(NC)"

# Install package in editable mode (no dev tools).
.PHONY: install
install:
	@echo "$(GREEN)Installing package in editable mode...$(NC)"
	$(PIP) install -e .
	@echo "$(GREEN)Package installed successfully!$(NC)"

# Backwards-compatible alias for `install`. Kept so older docs / muscle memory
# referencing `make install-deps` keep working; consolidating eliminated the
# old redundant double `pip install -e .` between `install-deps` and `install`.
.PHONY: install-deps
install-deps: install

# Install everything needed for development: package (editable) + test extras
# + the tooling used by other Makefile targets (lint, type-check, security,
# build). Dev tools are defined once in `$(DEV_TOOLS)` so this target and
# `dev-setup` cannot drift.
.PHONY: install-dev
install-dev:
	@echo "$(GREEN)Installing development dependencies...$(NC)"
	$(PIP) install -e ".[tests]"
	$(PIP) install $(DEV_TOOLS)
	@echo "$(GREEN)Development dependencies installed successfully!$(NC)"

# Run tests
.PHONY: test
test:
	@echo "$(GREEN)Running tests...$(NC)"
	$(PYTHON) -m pytest $(TEST_DIR) -v
	@echo "$(GREEN)Tests completed!$(NC)"

# Run tests with verbose output
.PHONY: test-verbose
test-verbose:
	@echo "$(GREEN)Running tests with verbose output...$(NC)"
	$(PYTHON) -m pytest $(TEST_DIR) -v -s
	@echo "$(GREEN)Verbose tests completed!$(NC)"

# Run tests with coverage. Threshold lives in $(COVERAGE_MIN) so it stays in
# sync with the CI workflow — bump both together.
.PHONY: test-coverage
test-coverage:
	@echo "$(GREEN)Running tests with coverage (min $(COVERAGE_MIN)%)...$(NC)"
	$(PYTHON) -m pytest $(TEST_DIR) --cov=$(PACKAGE_NAME) --cov-report=html --cov-report=term --cov-fail-under=$(COVERAGE_MIN)
	@echo "$(GREEN)Coverage report generated!$(NC)"
	@echo "$(YELLOW)HTML report available at htmlcov/index.html$(NC)"

# Run linter
.PHONY: lint
lint:
	@echo "$(GREEN)Running linter (flake8)...$(NC)"
	$(PYTHON) -m flake8 $(PACKAGE_NAME) $(TEST_DIR)
	@echo "$(GREEN)Linting completed!$(NC)"

# Run auto-formatter
.PHONY: lint-fix
lint-fix:
	@echo "$(GREEN)Running auto-formatter (black)...$(NC)"
	$(PYTHON) -m black $(PACKAGE_NAME) $(TEST_DIR)
	@echo "$(GREEN)Code formatting completed!$(NC)"

# Run type checker
.PHONY: type-check
type-check:
	@echo "$(GREEN)Running type checker (mypy)...$(NC)"
	$(PYTHON) -m mypy $(PACKAGE_NAME) --ignore-missing-imports
	@echo "$(GREEN)Type checking completed!$(NC)"

# Clean *build* artifacts only. Kept narrow so that `build` (and everything
# that depends on it: `validate`, `publish`, `release`) does not silently
# wipe coverage reports or pytest/mypy caches that the developer just ran.
.PHONY: clean-build
clean-build:
	@echo "$(GREEN)Cleaning build artifacts...$(NC)"
	rm -rf $(BUILD_DIR) $(DIST_DIR) $(EGG_INFO)

# Full clean: build artifacts + caches + coverage reports. Use this between
# branches or before publishing. Note that `build` no longer depends on
# `clean` — call `make clean build` if you want a fully scrubbed build.
.PHONY: clean
clean: clean-build
	@echo "$(GREEN)Cleaning caches and coverage reports...$(NC)"
	rm -rf .pytest_cache htmlcov .coverage .mypy_cache
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f \( -name "*.pyc" -o -name "*.pyo" -o -name "*.pyd" \) -delete
	@echo "$(GREEN)Cleanup completed!$(NC)"

# Build package. Depends on `clean-build` (not `clean`) so coverage / cache
# files survive — see the comment on `clean-build` for motivation.
.PHONY: build
build: clean-build
	@echo "$(GREEN)Building package...$(NC)"
	$(PYTHON) -m build
	@echo "$(GREEN)Package built successfully!$(NC)"

# Build wheel package only
.PHONY: build-wheel
build-wheel: clean-build
	@echo "$(GREEN)Building wheel package...$(NC)"
	$(PYTHON) -m build --wheel
	@echo "$(GREEN)Wheel package built successfully!$(NC)"

# Build source distribution only
.PHONY: build-sdist
build-sdist: clean-build
	@echo "$(GREEN)Building source distribution...$(NC)"
	$(PYTHON) -m build --sdist
	@echo "$(GREEN)Source distribution built successfully!$(NC)"

# Validate package
.PHONY: validate
validate: build
	@echo "$(GREEN)Validating package...$(NC)"
	$(PYTHON) -m twine check $(DIST_DIR)/*
	@echo "$(GREEN)Package validation completed!$(NC)"

# Publish to PyPI
.PHONY: publish
publish: validate
	@echo "$(YELLOW)Are you sure you want to publish to PyPI? [y/N]$(NC)" && read ans && [ $${ans:-N} = y ]
	@echo "$(GREEN)Publishing to PyPI...$(NC)"
	$(PYTHON) -m twine upload $(DIST_DIR)/*
	@echo "$(GREEN)Package published successfully to PyPI!$(NC)"

# Publish to Test PyPI
.PHONY: publish-test
publish-test: validate
	@echo "$(GREEN)Publishing to Test PyPI...$(NC)"
	$(PYTHON) -m twine upload --repository testpypi $(DIST_DIR)/*
	@echo "$(GREEN)Package published successfully to Test PyPI!$(NC)"

# Show current version
.PHONY: version
version:
	@echo "$(GREEN)Current package version:$(NC)"
	@$(PYTHON) -c "import $(PACKAGE_NAME); print($(PACKAGE_NAME).__version__)"

# Check for outdated dependencies
.PHONY: check-deps
check-deps:
	@echo "$(GREEN)Checking for outdated dependencies...$(NC)"
	$(PIP) list --outdated

# Update every dependency that `install-dev` installs — the package itself
# (editable, with test extras) AND the dev tools. Updating only the extras
# (the previous behaviour) silently drifted flake8/mypy/etc. behind.
.PHONY: update-deps
update-deps:
	@echo "$(GREEN)Updating dependencies...$(NC)"
	$(PIP) install --upgrade -e ".[tests]"
	$(PIP) install --upgrade $(DEV_TOOLS)
	@echo "$(GREEN)Dependencies updated!$(NC)"

# Security audit. Uses `pip-audit` to match the CI workflow (the older
# `safety` CLI was retired upstream and is no longer the recommended tool).
# Assumes `make install-dev` already installed `pip-audit`.
.PHONY: security
security:
	@echo "$(GREEN)Running security audit (pip-audit)...$(NC)"
	$(PYTHON) -m pip_audit
	@echo "$(GREEN)Security audit completed!$(NC)"

# Build the MkDocs site. The configuration (`mkdocs.yml`) and the `docs/`
# directory live in the repository root, so we invoke MkDocs from one level
# up. Requires `mkdocs-material` (install with `pip install mkdocs-material`
# — kept out of `install-dev` because the docs site is rebuilt by CI, not
# every developer needs the dependency locally).
.PHONY: docs
docs:
	@echo "$(GREEN)Building MkDocs site...$(NC)"
	cd .. && mkdocs build
	@echo "$(GREEN)Site generated in ../site/$(NC)"

# Serve the MkDocs site locally with auto-reload.
.PHONY: docs-serve
docs-serve:
	@echo "$(GREEN)Serving MkDocs site at http://127.0.0.1:8000 ...$(NC)"
	cd .. && mkdocs serve

# Full development pipeline. Uses `install-dev` (not `install`) so that
# `lint`, `type-check`, and `test` have flake8 / mypy / pytest available
# when this is run from a fresh checkout.
.PHONY: all
all: install-dev lint type-check test build validate
	@echo "$(GREEN)Full pipeline completed successfully!$(NC)"

# Development workflow target.
#
# Installs every dev dependency *into the venv* using `$(VENV_DIR)/bin/pip`
# directly — do not rely on `$(PIP)` here, because Make resolves variables at
# parse time and the venv may not have existed yet when this Makefile was
# read.
.PHONY: dev-setup
dev-setup: venv
	@echo "$(GREEN)Installing project (editable) + dev dependencies into $(VENV_DIR)/...$(NC)"
	$(VENV_DIR)/bin/pip install --upgrade pip
	$(VENV_DIR)/bin/pip install -e ".[tests]"
	$(VENV_DIR)/bin/pip install $(DEV_TOOLS)
	@echo "$(GREEN)Development environment setup completed!$(NC)"
	@echo ""
	@echo "$(YELLOW)You can now run targets directly — they auto-detect $(VENV_DIR)/.$(NC)"
	@echo "$(YELLOW)To activate the venv in your shell anyway:$(NC) source $(VENV_DIR)/bin/activate"

.PHONY: pre-commit
pre-commit: lint type-check test
	@echo "$(GREEN)Pre-commit checks passed!$(NC)"

.PHONY: pre-publish
pre-publish: all security
	@echo "$(GREEN)Pre-publish checks completed!$(NC)"

# CI/CD target. `install-dev` already installs the package in editable mode
# via `pip install -e ".[tests]"`, so a separate `install` step would be
# redundant.
.PHONY: ci
ci: install-dev lint type-check test build validate
	@echo "$(GREEN)CI pipeline completed!$(NC)"

# Show package info. The grep filter lists every tool in $(DEV_TOOLS) plus
# the package itself and `pytest` (installed via the `[tests]` extra). Keep
# the regex in sync if $(DEV_TOOLS) changes.
.PHONY: info
info:
	@echo "$(GREEN)Package Information:$(NC)"
	@echo "Name: $(PACKAGE_NAME)"
	@$(PYTHON) -c "import $(PACKAGE_NAME); print('Version:', $(PACKAGE_NAME).__version__)" 2>/dev/null || echo "Version: Not installed"
	@echo "Python: $(shell $(PYTHON) --version)"
	@echo "Pip: $(shell $(PIP) --version)"
	@echo ""
	@echo "$(GREEN)Installed packages:$(NC)"
	@$(PIP) list | grep -E "($(PACKAGE_NAME)|pytest|pytest-cov|flake8|black|mypy|twine|build|hatch|pip-audit)"

# Quick release workflow
.PHONY: release
release: pre-publish publish
	@echo "$(GREEN)Release completed!$(NC)"

.PHONY: release-test
release-test: pre-publish publish-test
	@echo "$(GREEN)Test release completed!$(NC)"

# Install from PyPI (for testing)
.PHONY: install-from-pypi
install-from-pypi:
	@echo "$(GREEN)Installing from PyPI...$(NC)"
	$(PIP) install $(PACKAGE_NAME)
	@echo "$(GREEN)Package installed from PyPI!$(NC)"

# Install from Test PyPI (for testing)
.PHONY: install-from-test-pypi
install-from-test-pypi:
	@echo "$(GREEN)Installing from Test PyPI...$(NC)"
	$(PIP) install --index-url https://test.pypi.org/simple/ $(PACKAGE_NAME)
	@echo "$(GREEN)Package installed from Test PyPI!$(NC)"

# Uninstall package
.PHONY: uninstall
uninstall:
	@echo "$(GREEN)Uninstalling package...$(NC)"
	$(PIP) uninstall $(PACKAGE_NAME) -y
	@echo "$(GREEN)Package uninstalled!$(NC)"
