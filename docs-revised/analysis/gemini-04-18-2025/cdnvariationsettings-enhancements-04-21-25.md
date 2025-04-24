
# Planned Enhancements for EdgeModeHandler

After reviewing the provided documentation and code, here's my plan for implementing the five enhancements while properly leveraging the existing `cdnVariationSettings` properties:

## 1. Performance Optimization
- [ ] Add early-return logic in `extractAllCdnVariationSettings` to skip processing disabled flags immediately
- [ ] Optimize JSON parsing by only attempting it when typeof is 'string' and contains '{' character
- [ ] Add detailed debug logging to help identify performance bottlenecks in large decision sets
- [ ] Implement batch processing logic for large decision sets (over configurable threshold)
- [ ] Add timing metrics around the extraction process

## 2. Error Resilience for cdnVariationSettings
- [ ] Create a `validateCdnVariationSettings` helper method that:
  - [ ] Verifies at least one URL pattern exists (cdnExperimentURL or pathRegex)
  - [ ] Checks if a content source is specified (cdnResponseURL or forwardRequestToOrigin)
  - [ ] Validates numeric properties (cacheTTL) and converts them appropriately
  - [ ] Validates boolean properties with proper string conversion
- [ ] Add warning logs for invalid settings rather than failing completely
- [ ] Ensure settings with partial errors can still be used if critical parts are valid

## 3. Traceability Header Consistency
- [ ] Create an `addTracingHeaders(response, settings)` helper method that:
  - [ ] Consistently adds X-Optimizely-Flag and X-Optimizely-Variation headers
  - [ ] Adds X-Optimizely-Edge-Mode: 'active' header
  - [ ] Optionally adds flag decision timestamp if available
- [ ] Replace duplicate header logic in both `processRequest` and `forwardToOrigin` methods
- [ ] Add consistent cache status headers (X-Edge-Cache: HIT/MISS)

## 4. Enhanced Caching Strategy (using existing cdnVariationSettings properties)
- [ ] Properly expose and utilize `cacheTTL` from cdnVariationSettings
  - [ ] Parse numeric value or use default if invalid
  - [ ] Pass TTL to caching service when storing responses
- [ ] Implement `cacheKey` property support:
  - [ ] Handle special "VARIATION_KEY" value for dynamic key generation
  - [ ] Support static cache keys when provided
  - [ ] Fall back to URL-based keys when not specified
- [ ] Honor cache-control headers from origin responses when appropriate
- [ ] Add configurability for cache variation based on user attributes

## 5. Metrics Enhancement
- [ ] Add flag activation metrics:
  - [ ] Track which flags trigger edge mode behavior
  - [ ] Measure variation distribution for edge-mode-enabled flags
- [ ] Implement detailed cache metrics:
  - [ ] Hit/miss rates overall
  - [ ] Hit/miss rates per flag+variation
  - [ ] Cache efficiency metrics (time saved)
- [ ] Add performance timing for key operations:
  - [ ] Decision processing time
  - [ ] URL matching time
  - [ ] Content transformation time
- [ ] Create dashboardable metrics summary method

Does this plan align with your expectations? I'm particularly interested in confirming the approach for handling the `cacheKey` and `cacheTTL` properties from cdnVariationSettings before proceeding with implementation.
