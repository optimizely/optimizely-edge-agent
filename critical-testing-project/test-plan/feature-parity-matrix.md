# Optimizely Edge Agent: Feature Parity Matrix

This document tracks the feature parity between the original JavaScript implementation (src/) and the new TypeScript implementation (src-v2/) of the Optimizely Edge Agent.

## Core Functionality

| Feature | Original Implementation | New Implementation | Status | Testing Status | Notes |
|---------|------------------------|-------------------|--------|---------------|-------|
| **Edge Mode (GET Requests)** |
| URL Matching | | | | | |
| Variation Content Serving | | | | | |
| Caching (Cache Key) | | | | | |
| Response Headers | | | | | |
| Origin Forwarding | | | | | |
| **Agent Mode (POST Requests)** |
| Feature Flag Decisions | | | | | |
| Experiment Decisions | | | | | |
| Batch Decisions | | | | | |
| Event Tracking | | | | | |
| **Core Components** |
| OptimizelyProvider | | | | | |
| CoreLogic | | | | | |
| CDN Adapters | | | | | |
| RequestConfig | | | | | |
| OptimizelyHelper | | | | | |

## Advanced Features

| Feature | Original Implementation | New Implementation | Status | Testing Status | Notes |
|---------|------------------------|-------------------|--------|---------------|-------|
| **Decision Options** |
| includeReasons | | | | | |
| excludeVariables | | | | | |
| **Forced Variations** |
| Header-based | | | | | |
| JSON-based | | | | | |
| Query-based | | | | | |
| **User Identification** |
| Cookie Management | | | | | |
| Visitor ID Creation | | | | | |
| UUID Generation | | | | | |
| **KV Storage** |
| Flag Key Storage | | | | | |
| Datafile Storage | | | | | |
| User Profile Storage | | | | | |
| **Parameter Handling** |
| Query Parameters | | | | | |
| Header Parameters | | | | | |
| JSON Body Parameters | | | | | |
| Parameter Precedence | | | | | |

## CDN-Specific Features

| Feature | Original Implementation | New Implementation | Status | Testing Status | Notes |
|---------|------------------------|-------------------|--------|---------------|-------|
| **Cloudflare** |
| Workers-specific Implementation | | | | | |
| KV Store Integration | | | | | |
| **Vercel** |
| Edge Functions Support | | | | | |
| **Fastly** |
| Compute@Edge Support | | | | | |

## API Endpoints

| Endpoint | Original Implementation | New Implementation | Status | Testing Status | Notes |
|----------|------------------------|-------------------|--------|---------------|-------|
| `/api/decide` | | | | | |
| `/api/decide-all` | | | | | |
| `/api/decide-for-keys` | | | | | |
| `/api/track-event` | | | | | |
| `/api/track-events` | | | | | |
| `/api/get-forced-variation` | | | | | |
| `/api/set-forced-variation` | | | | | |
| `/api/remove-forced-variation` | | | | | |
| `/api/get-datafile` | | | | | |
| `/api/datafile-status` | | | | | |
| Additional Endpoints | | | | | |

## Configuration Options

| Configuration | Original Implementation | New Implementation | Status | Testing Status | Notes |
|--------------|------------------------|-------------------|--------|---------------|-------|
| SDK Key | | | | | |
| cdnVariationSettings | | | | | |
| datafileOptions | | | | | |
| eventOptions | | | | | |
| userProfileOptions | | | | | |
| logger | | | | | |

## Status Legend

- **Implementation Status**:
  - ✅ Complete - Full implementation with feature parity
  - ⚠️ Partial - Partially implemented or with behavioral differences
  - ❌ Missing - Not implemented in the new version
  - 🔄 Enhanced - Implemented with enhancements beyond original

- **Testing Status**:
  - ✅ Verified - Fully tested and verified against live infrastructure
  - 🧪 In Progress - Testing in progress
  - ❌ Failed - Testing revealed issues or discrepancies
  - ⚠️ Limited - Limited testing completed
  - 📝 Documented - Behavior documented but not fully tested 