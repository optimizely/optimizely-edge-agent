# Legacy JavaScript Implementation

This directory contains the original JavaScript implementation that served as reference for the TypeScript migration.
**DO NOT** use this code in new development. Refer to the TypeScript implementations in the parent directory.

## Purpose

This code is kept for:
1. Historical reference during the TypeScript migration
2. Understanding the original implementation details
3. Verification of TypeScript migration correctness

## Structure

The directory structure mirrors the new TypeScript implementation to make it easy to compare:

```
legacy/
  ├── adapters/        # Original CDN adapter implementations
  ├── core/           # Core functionality
  ├── interfaces/     # JavaScript "interfaces" and abstract classes
  └── utils/         # Utility functions
```

## Usage Guidelines

1. ⛔ Do not import from this directory in new code
2. ⛔ Do not modify these files
3. ✅ Use only as reference when implementing TypeScript versions
4. ✅ Compare behavior when verifying TypeScript implementations

## Migration Status

This directory will be removed once:
1. All functionality has been migrated to TypeScript
2. All TypeScript implementations have been verified
3. The migration has been signed off by the team
