# OpenNeural Makefile
# Local-first desktop ML experimentation application

# Default shell
SHELL := /bin/bash

# Colors for output
BLUE := \033[34m
GREEN := \033[32m
YELLOW := \033[33m
RESET := \033[0m

# Virtual environment path
VENV_DIR := .venv
VENV_BIN := $(VENV_DIR)/bin

.PHONY: help install install-node install-python dev build test package clean typecheck lint

# Show available targets
help: ## Display this help message
	@echo "OpenNeural Build Commands"
	@echo "========================"
	@echo ""
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(BLUE)%-15s$(RESET) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""

# Install all dependencies (Node.js and Python)
install: ## Install all workspace dependencies
	@echo "$(GREEN)Installing Node.js dependencies...$(RESET)"
	npm install
	@echo "$(GREEN)Installing Python backend dependencies...$(RESET)"
	python3.11 -m venv $(VENV_DIR)
	. $(VENV_BIN)/activate && pip install -e backend
	@echo "$(GREEN)Installation complete!$(RESET)"

# Install only Node.js dependencies
install-node: ## Install only Node.js dependencies (skip Python)
	@echo "$(GREEN)Installing Node.js dependencies...$(RESET)"
	npm install
	@echo "$(GREEN)Node.js installation complete!$(RESET)"

# Install only Python dependencies
install-python: ## Install only Python dependencies
	@echo "$(GREEN)Installing Python backend dependencies...$(RESET)"
	python3.11 -m venv $(VENV_DIR)
	. $(VENV_BIN)/activate && pip install -e backend
	@echo "$(GREEN)Python installation complete!$(RESET)"

# Start development servers (runs in parallel)
dev: ## Start all development servers (frontend, electron, backend)
	@echo "$(GREEN)Starting development servers...$(RESET)"
	npm run dev

# Build all workspaces
build: ## Build all workspaces for production
	@echo "$(GREEN)Building all workspaces...$(RESET)"
	npm run build
	@echo "$(GREEN)Build complete!$(RESET)"

# Run all tests
test: ## Run tests for all workspaces
	@echo "$(GREEN)Running tests...$(RESET)"
	npm run test
	@echo "$(GREEN)Tests complete!$(RESET)"

# Package the Electron application
package: build ## Package the Electron application for distribution
	@echo "$(GREEN)Packaging Electron application...$(RESET)"
	npm run package
	@echo "$(GREEN)Packaging complete!$(RESET)"

# Clean all build artifacts and dependencies
clean: ## Remove all build artifacts, node_modules, and virtual environment
	@echo "$(YELLOW)Cleaning build artifacts...$(RESET)"
	rm -rf node_modules
	rm -rf $(VENV_DIR)
	rm -rf electron/node_modules
	rm -rf frontend/node_modules
	rm -rf backend/dist
	rm -rf backend/build
	rm -rf backend/*.egg-info
	rm -rf electron/dist
	rm -rf frontend/dist
	@echo "$(GREEN)Clean complete!$(RESET)"

# Type check all TypeScript code
typecheck: ## Run TypeScript type checking across all workspaces
	@echo "$(GREEN)Running type checks...$(RESET)"
	npm run typecheck

# Lint all code
lint: ## Run linting across all workspaces
	@echo "$(GREEN)Running linters...$(RESET)"
	npm run lint
