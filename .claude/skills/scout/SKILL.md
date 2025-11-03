---
name: Dependency Scout
description: Map and analyze code dependencies to identify potential impact before making changes
---

## Purpose
The Dependency Scout identifies all dependencies and dependents of code components to prevent catastrophic changes. This skill helps developers understand the ripple effects of modifications before they happen.

## What the Scout Does

### 1. Dependency Mapping
- **Traces imports/exports**: Maps all import statements, require calls, and module exports
- **Identifies function calls**: Finds where functions, classes, and methods are used
- **Tracks data flow**: Follows how data structures and types propagate through the codebase
- **Maps configuration dependencies**: Identifies config files, environment variables, and external services

### 2. Impact Analysis
- **Downstream effects**: Shows what will break if you change a specific component
- **Upstream dependencies**: Reveals what the component relies on
- **Cross-package boundaries**: Tracks dependencies across different packages/modules
- **Runtime dependencies**: Identifies dynamic imports and runtime-resolved dependencies

### 3. Risk Assessment
- **Critical path identification**: Highlights components that many others depend on
- **Blast radius calculation**: Estimates how many files/components could be affected
- **Breaking change detection**: Identifies changes that could cause compilation or runtime errors
- **Test coverage gaps**: Shows areas where changes might not be caught by tests

## How It Maps Dependencies

### Static Analysis