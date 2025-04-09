# Optimizely Edge Agent: Feature Parity Guide

## Overview

This document provides a comprehensive guide for implementing feature parity between the original Optimizely Edge Agent and the re-architected version. It details the operational modes, core functionality, and implementation requirements necessary to ensure a seamless transition. Use this document as a reference to understand what must be maintained during the re-architecture process.

## Operational Modes

The Optimizely Edge Agent operates in two distinct modes, each with unique functionality and behaviors:

### 1. Edge Mode (GET Requests)

Edge Mode is activated when the agent receives GET requests. In this mode, the agent:

- Matches incoming request URLs against configured experiment URLs
- Makes variation decisions for matched requests
- Fetches, caches, and serves appropriate content variations
- Manages response headers and cookies for maintaining bucketing decisions

**Key Characteristics:**
- Requires `cdnVariationSettings` configuration in the Optimizely Feature Flag
- Can forward requests to origin or serve directly from the edge
- Supports content caching with configurable TTL
- Maintains visitor bucketing through cookies or headers

### 2. Agent Mode (POST Requests)

Agent Mode is activated when the agent receives POST requests. In this mode, the agent:

- Acts as a serverless API endpoint for direct Optimizely SDK operations
- Processes decision requests using the full Optimizely SDK capabilities
- Returns decision results directly to the client
- Doesn't rely on `cdnVariationSettings`

**Key Characteristics:**
- Supports JSON body payloads for configuration
- Allows forced decisions and custom attributes
- Enables direct access to Optimizely SDK features
- Functions as a microservice rather than a content proxy

## Core Functionality Requirements

### 1. cdnVariationSettings Handling

The `cdnVariationSettings` object is central to Edge Mode operation and must be handled exactly as in the original implementation.

**Required Properties:**
- `cdnExperimentURL`: URL pattern to match against incoming requests
- `cdnResponseURL`: URL from which to fetch variation content
- `cacheKey`: Identifier for caching (special value "VARIATION_KEY" or custom string)
- `forwardRequestToOrigin`: Controls whether to forward requests to origin ("true"/"false")
- `cacheRequestToOrigin`: Controls whether to cache responses ("true"/"false")
- `cacheTTL`: Cache time-to-live in seconds
- `isControlVariation`: Identifies control variations ("true"/"false")

**Implementation Requirements:**
- Parse these settings from the Optimizely SDK decision variables
- Apply them consistently across all adapter implementations
- Validate settings structure and set appropriate defaults when values are missing

### 2. URL Matching and Routing

**Requirements:**
- Match incoming request URLs against `cdnExperimentURL` patterns
- Handle path normalization (removing trailing slashes, double slashes)
- Support ignoring query parameters in matching logic
- Maintain test flag override capability for debugging

**Implementation Plan:**
- Create a URL matching service that works across all adapter implementations
- Implement proper URL normalization and comparison logic
- Support pattern matching with and without query parameters

### 3. Visitor Identification and Bucketing

**Requirements:**
- Generate consistent visitor IDs for new users
- Maintain visitor bucketing across sessions using cookies/headers
- Support overriding visitor IDs for testing
- Read visitor IDs from cookies, headers, or query parameters according to priority

**Implementation Plan:**
- Create a VisitorService that handles visitor ID generation and retrieval
- Implement cookie-based bucketing persistence across requests
- Support header-based visitor identification for headerless contexts
- Maintain override capabilities through request configuration

### 4. Caching Behavior

**Requirements:**
- Cache experiment variations based on `cacheKey` configuration
- Support the special "VARIATION_KEY" cache key format
- Respect `cacheTTL` settings for cached content
- Implement cache invalidation and refreshing

**Implementation Plan:**
- Create a CacheService that leverages the StorageAdapter interface
- Implement cache key generation logic matching the original
- Support cache TTL through adapter-specific implementations
- Ensure proper cache management across variations

### 5. Decision Making and Execution

**Requirements:**
- Initialize Optimizely SDK with appropriate datafile
- Execute variation decisions based on visitor context
- Support all decision options (includeReasons, excludeVariables, etc.)
- Handle forced decisions for testing and targeting

**Implementation Plan:**
- Create an ExperimentationService abstraction for SDK operations
- Implement decision execution logic consistent with original implementation
- Support forced decision overrides through request configuration
- Maintain decision event triggering (or suppression when configured)

### 6. Cookie and Header Management

**Requirements:**
- Set and read cookies according to original implementation rules
- Maintain cookie serialization format for compatibility
- Support header-based bucketing information
- Apply the correct cookie settings (expiration, path, domain, etc.)

**Implementation Plan:**
- Create a CookieService with adapter-specific implementations
- Maintain cookie format compatibility for bucketing information
- Implement proper header-based alternative for environments without cookies
- Support configuration to control cookie/header behavior

### 7. Request and Response Handling

**Requirements:**
- Clone and modify requests when forwarding to origin
- Set appropriate headers and cookies on responses
- Handle response body modifications when needed
- Maintain error handling patterns

**Implementation Plan:**
- Leverage RequestAdapter and custom response objects
- Implement request cloning with header/cookie modifications
- Create consistent response handling across adapters
- Maintain error response format for compatibility

### 8. Event Tracking and Dispatch

**Requirements:**
- Collect and dispatch decision events to Optimizely
- Support event batching and consolidation
- Handle event tags and attributes
- Support disabling event tracking

**Implementation Plan:**
- Create an EventService abstraction for tracking operations
- Implement background processing for event dispatch
- Maintain event format compatibility
- Support configuration to control event behavior

### 9. KV Store Integration

**Requirements:**
- Support datafile storage and retrieval from KV
- Enable flag key management in KV store
- Maintain datafile refresh mechanism
- Support KV-based user profiles

**Implementation Plan:**
- Leverage StorageAdapter for KV operations
- Implement datafile management services
- Create flag key management capability
- Support user profile persistence when configured

### 10. RequestConfig Handling

**Requirements:**
- Process configuration from headers, query parameters, and JSON body
- Apply configuration priority: headers > query parameters > JSON body
- Support all original configuration options
- Allow for custom configuration extensions

**Implementation Plan:**
- Create a ConfigurationService abstraction
- Implement priority-based configuration resolution
- Support all original configuration parameters
- Enable extension for custom configuration needs

## Feature Parity Verification

To verify feature parity, implement tests that:

1. Compare the output of the original and new implementations side by side
2. Verify all combinations of configuration settings produce identical results
3. Test both Edge Mode and Agent Mode functionality
4. Confirm identical cache behaviors, cookie handling, and event tracking
5. Validate error handling and edge cases match original behavior

## Mode-Specific Implementation Details

### Edge Mode (GET) Implementation Requirements

1. **URL Matching Phase**
   - Match incoming URL against all experiment URLs from decisions
   - Normalize URLs consistently with the original implementation
   - Support test flag debugging overrides

2. **Decision Execution Phase**
   - Retrieve or generate visitor ID
   - Execute Optimizely decision for matched experiment
   - Extract cdnVariationSettings from decision

3. **Content Delivery Phase**
   - Determine if content should be served from cache
   - Generate proper cache key
   - Fetch content from origin or cache
   - Apply headers and cookies to response

4. **Response Processing Phase**
   - Modify response based on configuration
   - Set bucketing cookies/headers
   - Dispatch events asynchronously

### Agent Mode (POST) Implementation Requirements

1. **Request Parsing Phase**
   - Parse JSON body, headers, and query parameters
   - Build configuration according to priority rules
   - Extract decision parameters (flags, attributes, etc.)

2. **Decision Execution Phase**
   - Initialize SDK with appropriate datafile
   - Execute requested decisions
   - Format decision results

3. **Response Generation Phase**
   - Generate structured JSON response
   - Apply headers and cookies if configured
   - Dispatch events asynchronously

## CDN-Specific Implementation Considerations

### Cloudflare Implementation

Primary focus for Phase 2:

1. **KV Integration**
   - Implement CloudflareStorageAdapter for KV operations
   - Support datafile and key management
   - Enable user profile storage

2. **Worker Execution Context**
   - Handle waitUntil for asynchronous operations
   - Manage Cloudflare-specific resource limitations
   - Implement effective caching strategies

3. **Request/Response Handling**
   - Clone requests with proper header modifications
   - Set cookies following Cloudflare patterns
   - Support URL rewriting and forwarding

### Future CDN Implementations (Vercel, Fastly)

Ensure the following abstractions are properly designed to support additional CDNs:

1. **Storage Abstractions**
   - Abstract KV operations to support different KV implementations
   - Handle CDN-specific storage limitations and features

2. **Request/Response Abstractions**
   - Support different request/response models
   - Handle CDN-specific header and cookie limitations

3. **Caching Abstractions**
   - Support different caching mechanisms and TTL implementations
   - Handle CDN-specific cache invalidation patterns

## Implementation Roadmap

Phase 2 (Cloudflare Feature Parity) should focus on:

1. Implementing the complete cdnVariationSettings handling
2. Building the URL matching and decision pipeline
3. Creating proper cookie/header management
4. Implementing caching mechanisms
5. Building event dispatch capabilities

Once these core components are working, additional functionality can be added in sequence.

## Conclusion

By maintaining feature parity across these core functionalities, the re-architected Optimizely Edge Agent will provide a seamless transition for existing users while leveraging the benefits of the new modular architecture. The adapter pattern and interface abstractions will enable better testing, maintenance, and multi-CDN support without sacrificing the powerful functionality of the original implementation.
