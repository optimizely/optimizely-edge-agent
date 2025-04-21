# Architecture Analysis

*Last Updated: April 18, 2025*

This section analyzes the architectural patterns used in both v1 and v2 of the Optimizely Edge Agent, with a focus on how each version implements CDN adaptation and platform-specific functionality.

## Table of Contents

- [CDN Adapters in v1](./cdn-adapters-v1.md)
- [CDN Adapters in v2](./cdn-adapters-v2.md)

## Overview

The Optimizely Edge Agent is designed to run on multiple edge computing platforms (CDNs), including Cloudflare Workers, Vercel Edge Functions, Fastly Compute, and others. Both versions implement platform adaptation, but with significantly different architectural approaches:

### v1 Architecture Highlights

- JavaScript-based implementation
- Direct adapter implementation with conditional imports
- Configuration-driven platform detection
- Global state and procedural implementation patterns

### v2 Architecture Highlights

- TypeScript-based implementation
- Interface-based design with adapter pattern
- Factory-based implementation selection
- Dependency injection via composition root
- Improved abstraction and separation of concerns

The detailed analysis of each implementation provides insights into the evolution of the architecture and the benefits and potential challenges of migrating from v1 to v2.