# Makefile for the FlightRadarAPI Go package

PACKAGE = ./flightradarapi
COVERAGE_FILE = coverage.out

# Minimum offline coverage required by `test-coverage` and by the CI workflow.
# Keep in sync with `.github/workflows/go-package.yml`.
COVERAGE_MIN = 80

GO ?= go

# Pinned, like every action in the workflows: an upstream release adding a check
# would otherwise turn CI red on a tree nobody touched. Bump them deliberately.
STATICCHECK_VERSION = v0.8.1
GOVULNCHECK_VERSION = v1.7.0

GREEN = \033[0;32m
YELLOW = \033[0;33m
NC = \033[0m

.PHONY: help
help:
	@echo "$(GREEN)FlightRadarAPI Go package Makefile$(NC)"
	@echo ""
	@echo "Available targets:"
	@echo "  $(YELLOW)deps$(NC)             - Download and verify module dependencies"
	@echo "  $(YELLOW)build$(NC)            - Compile the package"
	@echo "  $(YELLOW)test$(NC)             - Run the offline tests (PR gate)"
	@echo "  $(YELLOW)test-verbose$(NC)     - Run the offline tests with verbose output"
	@echo "  $(YELLOW)test-coverage$(NC)    - Run the offline tests with a coverage report"
	@echo "  $(YELLOW)test-integration$(NC) - Run the live FR24 tests"
	@echo "  $(YELLOW)test-race$(NC)        - Run the offline tests with the race detector"
	@echo "  $(YELLOW)lint$(NC)             - Run gofmt and go vet"
	@echo "  $(YELLOW)lint-strict$(NC)      - Run staticcheck on top of lint"
	@echo "  $(YELLOW)lint-fix$(NC)         - Format the code with gofmt"
	@echo "  $(YELLOW)tidy$(NC)             - Tidy go.mod and go.sum"
	@echo "  $(YELLOW)security$(NC)         - Run a vulnerability scan (govulncheck)"
	@echo "  $(YELLOW)docs$(NC)             - Show the package documentation"
	@echo "  $(YELLOW)clean$(NC)            - Remove build and coverage artifacts"
	@echo "  $(YELLOW)version$(NC)          - Show the package version"
	@echo "  $(YELLOW)all$(NC)              - Run the full pipeline (deps, lint, test, build)"

.PHONY: deps
deps:
	@echo "$(GREEN)Downloading dependencies...$(NC)"
	$(GO) mod download
	$(GO) mod verify

.PHONY: build
build:
	@echo "$(GREEN)Building package...$(NC)"
	$(GO) build ./...

.PHONY: test
test:
	@echo "$(GREEN)Running offline tests...$(NC)"
	$(GO) test $(PACKAGE)

.PHONY: test-verbose
test-verbose:
	@echo "$(GREEN)Running offline tests with verbose output...$(NC)"
	$(GO) test -v $(PACKAGE)

# Coverage threshold lives in $(COVERAGE_MIN) so it stays in sync with CI.
.PHONY: test-coverage
test-coverage:
	@echo "$(GREEN)Running offline tests with coverage (min $(COVERAGE_MIN)%)...$(NC)"
	$(GO) test -coverprofile=$(COVERAGE_FILE) $(PACKAGE)
	@$(GO) tool cover -func=$(COVERAGE_FILE) | tail -1
	@total=$$($(GO) tool cover -func=$(COVERAGE_FILE) | tail -1 | grep -oE '[0-9]+\.[0-9]+'); \
	if [ $$(echo "$$total < $(COVERAGE_MIN)" | bc -l) -eq 1 ]; then \
		echo "$(YELLOW)Coverage $$total% is below the $(COVERAGE_MIN)% minimum$(NC)"; exit 1; \
	fi
	@echo "$(GREEN)Coverage report written to $(COVERAGE_FILE)$(NC)"
	@echo "$(YELLOW)HTML report: go tool cover -html=$(COVERAGE_FILE)$(NC)"

# Hits production FR24, so it is not part of `test`.
.PHONY: test-integration
test-integration:
	@echo "$(GREEN)Running live FR24 tests...$(NC)"
	$(GO) test -tags integration -run TestLive -v $(PACKAGE)

.PHONY: test-race
test-race:
	@echo "$(GREEN)Running offline tests with the race detector...$(NC)"
	$(GO) test -race $(PACKAGE)

.PHONY: lint
lint:
	@echo "$(GREEN)Running gofmt and go vet...$(NC)"
	@unformatted=$$(gofmt -l .); \
	if [ -n "$$unformatted" ]; then \
		echo "$(YELLOW)These files need gofmt:$(NC)"; echo "$$unformatted"; exit 1; \
	fi
	$(GO) vet ./...
	$(GO) vet -tags integration ./...
	@echo "$(GREEN)Linting completed!$(NC)"

# The counterpart of flake8/mypy on the Python side and eslint on the Node side:
# `go vet` alone is far thinner than either.
.PHONY: lint-strict
lint-strict: lint
	@echo "$(GREEN)Running staticcheck...$(NC)"
	$(GO) run honnef.co/go/tools/cmd/staticcheck@$(STATICCHECK_VERSION) ./...

.PHONY: lint-fix
lint-fix:
	@echo "$(GREEN)Formatting code...$(NC)"
	gofmt -w .

.PHONY: tidy
tidy:
	@echo "$(GREEN)Tidying modules...$(NC)"
	$(GO) mod tidy

# Uses govulncheck, the same tool the CI workflow runs. A finding in the
# standard library means the local toolchain is behind, not that this package
# is: CI resolves 1.26.x to the newest patch and sees none.
.PHONY: security
security:
	@echo "$(GREEN)Running vulnerability scan (govulncheck)...$(NC)"
	$(GO) run golang.org/x/vuln/cmd/govulncheck@$(GOVULNCHECK_VERSION) ./...

.PHONY: docs
docs:
	@echo "$(GREEN)Package documentation:$(NC)"
	$(GO) doc -all $(PACKAGE)

.PHONY: clean
clean:
	@echo "$(GREEN)Cleaning artifacts...$(NC)"
	rm -f $(COVERAGE_FILE)
	$(GO) clean -cache -testcache ./...

.PHONY: version
version:
	@grep -E '^const Version' flightradarapi/doc.go | cut -d'"' -f2

.PHONY: all
all: deps lint test build
	@echo "$(GREEN)Full pipeline completed successfully!$(NC)"

.PHONY: pre-commit
pre-commit: lint test
	@echo "$(GREEN)Pre-commit checks passed!$(NC)"

.PHONY: ci
ci: deps lint-strict test-coverage build
	@echo "$(GREEN)CI pipeline completed!$(NC)"
