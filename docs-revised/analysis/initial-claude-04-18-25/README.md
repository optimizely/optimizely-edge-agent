# Optimizely Edge Agent Analysis (v1/v2)

*Last Updated: April 18, 2025*

## Overview

This repository contains the analysis documentation comparing the original Optimizely Edge Agent codebase (src/ in JavaScript) with its refactored successor (src-v2/ in TypeScript). This analysis documents architectural differences, verifies functional parity, validates enhancements, and identifies potential gaps.

## Table of Contents

1. [Architecture Analysis](./01-architecture/README.md)
   - [CDN Adapters in v1](./01-architecture/cdn-adapters-v1.md)
   - [CDN Adapters in v2](./01-architecture/cdn-adapters-v2.md)

2. [Request Handling Analysis](#)
   - [Request Handling in v1](#)
   - [Request Handling in v2](#)
   - [Configuration Management in v1](#)
   - [Configuration Management in v2](#)

3. [Operational Mode Analysis](#)
   - [Edge Mode in v1](#)
   - [Edge Mode in v2](#)
   - [Agent Mode in v1](#)
   - [Agent Mode in v2](#)

4. [Supporting Features Analysis](#)
   - [Caching Implementation](#)
   - [Optimizely SDK Integration](#)
   - [API Implementation](#)
   - [Error Handling](#)
   - [Performance Optimization](#)
   - [Testing Approaches](#)

5. [Synthesis and Migration Considerations](#)
   - [Component Diagrams](#)
   - [Request Flow Sequences](#)
   - [Migration Considerations](#)
   - [Functional Parity Verification](#)

## Architecture Comparison Overview

The Edge Agent supports multiple CDN environments (Cloudflare, Fastly, Vercel, etc.) through two different architectural approaches:

- **v1 (JavaScript)**: Uses direct CDN-specific adapter classes with conditional imports and configuration
- **v2 (TypeScript)**: Implements a complete adapter pattern with interfaces, factories, and dependency injection

Detailed analysis of each component is provided in the linked documents above.

## Using This Documentation

This documentation is organized into logical sections that match the milestones in the implementation plan. Each section contains detailed analyses of different components/aspects of both codebases, including code examples, diagrams, and explanations.

As the analysis progresses, this README will be updated with links to all completed analysis documents.

### Supporting Features Analysis (Milestone M4)

*   [Caching Implementation](./03-supporting-features/caching-implementation.md)
*   [API Endpoint Implementation](./04-api-endpoints/api-endpoint-analysis.md)
*   Optimizely SDK Integration (Task OPT-1 - *In Progress*)
*   Error Handling Comparison (Task ERR-1 - *Pending*)
*   Performance Optimization Approaches (Task PERF-1 - *Pending*)
*   Testing Approaches (Task TEST-1 - *Pending*)

### Documentation and Synthesis (Milestone M5)