# Makefile for the FlightRadarAPI documentation.
#
# Each SDK has its own Makefile (python/, nodejs/, go/). This one covers what
# belongs to the repository as a whole: the documentation.

# Variables
VENV_DIR = .venv
DOCS_DIR = docs
DOCS_BUILD_DIR = $(DOCS_DIR)/_build/html

# Use the virtual environment when `make venv` has created it.
ifneq ($(wildcard $(VENV_DIR)/bin/python),)
PYTHON := $(VENV_DIR)/bin/python
else
PYTHON := python3
endif
PIP = $(PYTHON) -m pip

# Colors for output
GREEN = \033[0;32m
YELLOW = \033[0;33m
NC = \033[0m # No Color

# Default target
.PHONY: help
help:
	@echo "$(GREEN)FlightRadarAPI documentation Makefile$(NC)"
	@echo ""
	@echo "Setup:"
	@echo "  $(YELLOW)venv$(NC)             - Create a virtual environment in $(VENV_DIR)"
	@echo "  $(YELLOW)install-docs$(NC)     - Install the dependencies to build the documentation"
	@echo ""
	@echo "Documentation:"
	@echo "  $(YELLOW)docs$(NC)             - Build the HTML documentation (output: $(DOCS_BUILD_DIR))"
	@echo "  $(YELLOW)docs-serve$(NC)       - Live-reload docs server at http://127.0.0.1:8000"
	@echo "  $(YELLOW)docs-clean$(NC)       - Remove the docs build directory"
	@echo ""
	@echo "The SDKs have their own Makefiles: python/, nodejs/ and go/."

# Create virtual environment. `python3` literally: $(PYTHON) may already point
# at the environment being created.
.PHONY: venv
venv:
	@echo "$(GREEN)Creating virtual environment...$(NC)"
	python3 -m venv $(VENV_DIR)
	@echo "$(YELLOW)To activate: source $(VENV_DIR)/bin/activate$(NC)"

# Install the documentation dependencies. The build imports nothing from the
# SDKs, so none of them has to be installed.
.PHONY: install-docs
install-docs:
	@echo "$(GREEN)Installing documentation dependencies...$(NC)"
	$(PIP) install -r $(DOCS_DIR)/requirements.txt

# Build the HTML documentation with the same flags as CI and Read the Docs:
# warnings, including broken cross-references (-n), fail the build.
.PHONY: docs
docs:
	@echo "$(GREEN)Building HTML documentation...$(NC)"
	$(PYTHON) -m sphinx -n -W --keep-going -b html $(DOCS_DIR) $(DOCS_BUILD_DIR)
	@echo "$(GREEN)Documentation generated at $(DOCS_BUILD_DIR)/index.html$(NC)"

# Live-reload docs server. sphinx-autobuild is installed on demand. After
# changing a toctree, restart it: it only rebuilds changed pages, so the
# sidebar on the other pages goes stale.
.PHONY: docs-serve
docs-serve:
	@echo "$(GREEN)Starting live-reload docs server at http://127.0.0.1:8000$(NC)"
	@$(PYTHON) -c "import sphinx_autobuild" 2>/dev/null || $(PIP) install sphinx-autobuild
	$(PYTHON) -m sphinx_autobuild $(DOCS_DIR) $(DOCS_BUILD_DIR) --open-browser

# Wipe the built docs
.PHONY: docs-clean
docs-clean:
	@echo "$(GREEN)Cleaning docs build directory...$(NC)"
	rm -rf $(DOCS_DIR)/_build
