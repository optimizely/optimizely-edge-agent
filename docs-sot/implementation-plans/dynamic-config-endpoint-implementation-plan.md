# Dynamic Config Endpoint Implementation Plan

**Plan ID:** `dynamic-config-endpoint`  
**Created:** 2025-01-27  
**Status:** PLANNING  
**Priority:** HIGH  
**Estimated Effort:** 5-8 hours  

## Overview

This plan implements a dynamic `/api/config` endpoint for the Optimizely Edge Agent v2 that provides flexible, queryable access to OptimizelyConfig data. This addresses the feature parity gap where v1 has `/v1/config` but v2 lacks an equivalent endpoint.

## Goals

### Primary Goals
- ✅ **Feature Parity**: Restore config endpoint functionality from v1
- ✅ **Enhanced Querying**: Provide dynamic query capabilities beyond v1
- ✅ **Performance**: Enable efficient, targeted data retrieval
- ✅ **Developer Experience**: Support admin tooling and debugging workflows

### Secondary Goals
- ✅ **Flexible Response Formats**: Support minimal, standard, and full detail levels
- ✅ **Lookup Operations**: Enable key↔id bidirectional lookups
- ✅ **Resource Filtering**: Allow selective data inclusion/exclusion

## Technical Requirements

### Dependencies
- **OptimizelyConfig API**: Access to `client.getOptimizelyConfig()`
- **DecisionService**: Must expose OptimizelyConfig retrieval method
- **ApiRouter**: Route handling and parameter parsing
- **ConfigurationService**: SDK key validation and configuration

### API Specification

**Base Endpoint:** `GET /api/config`

**Required Parameters:**
- `sdkKey`: Optimizely SDK key (header or query)

**Optional Query Parameters:**
```typescript
// Resource Selection
include?: string           // Comma-separated: features,experiments,attributes,audiences,events
exclude?: string           // Comma-separated list to exclude
summary?: boolean          // Return counts only

// Lookup Operations
lookup?: "key" | "id"      // Lookup method
value?: string             // Value to lookup
type?: "feature" | "experiment" | "audience" | "event"  // Resource type

// Reverse Lookup
reverseLookup?: "id" | "key"  // Return opposite of lookup
key?: string               // Key for reverse lookup

// Specific Resource Filters
featureKey?: string        // Get specific feature
experimentKey?: string     // Get specific experiment
audienceId?: string        // Get specific audience
eventKey?: string          // Get specific event

// Format Control
format?: "minimal" | "standard" | "full"  // Detail level
metadata?: boolean         // Include metadata (default: true)
```

## Implementation Phases

### Phase 1: Core Infrastructure (2-3 hours)

#### Task 1.1: Extend DecisionService
**File:** `src-v2/services/implementations/DecisionService.ts`

```typescript
/**
 * Retrieves the OptimizelyConfig for the given SDK key
 * @param sdkKey - The Optimizely SDK key
 * @returns Promise<OptimizelyConfig | null>
 */
public async getOptimizelyConfig(sdkKey: string): Promise<OptimizelyConfig | null> {
  const client = await this.getClient(sdkKey);
  if (!client) {
    this.logger.warn(`${this.logPrefix} No client available for SDK key: ${sdkKey}`);
    return null;
  }
  
  try {
    const config = client.getOptimizelyConfig();
    this.logger.debug(`${this.logPrefix} Retrieved OptimizelyConfig for SDK key: ${sdkKey}`);
    return config;
  } catch (error) {
    this.logger.error(`${this.logPrefix} Error retrieving OptimizelyConfig:`, error);
    return null;
  }
}
```

**Acceptance Criteria:**
- ✅ Method successfully retrieves OptimizelyConfig from initialized client
- ✅ Returns null for invalid SDK keys
- ✅ Proper error handling and logging
- ✅ Unit tests cover success and error cases

#### Task 1.2: Add Config Route to ApiRouter
**File:** `src-v2/services/implementations/ApiRouter.ts`

Add routing logic in `routeApiRequest` method:

```typescript
else if (path.endsWith(`${this.apiPathPrefix}config`)) {
  result = await this.handleConfigRequest(requestAdapter, requestId);
}
```

**Acceptance Criteria:**
- ✅ Route correctly identifies `/api/config` requests
- ✅ Calls appropriate handler method
- ✅ Maintains existing route precedence

### Phase 2: Core Handler Implementation (2-3 hours)

#### Task 2.1: Implement Base Config Handler
**File:** `src-v2/services/implementations/ApiRouter.ts`

```typescript
/**
 * Handles requests to the config API endpoint.
 * Provides dynamic access to OptimizelyConfig data with flexible querying.
 */
private async handleConfigRequest(
  requestAdapter: IRequestAdapter,
  requestId: string
): Promise<ResponseResult> {
  const url = requestAdapter.getUrl();
  const method = requestAdapter.getMethod();
  const params = this.parseUrlParams(url.search);
  
  // Only support GET requests
  if (method !== 'GET') {
    return this.createJsonResponse(
      requestId, 
      405, 
      { error: "Method not allowed. Config endpoint supports GET only." }, 
      method
    );
  }
  
  // Get SDK key from header or query
  const sdkKeyHeader = requestAdapter.getHeader('x-optimizely-sdk-key');
  const sdkKey = sdkKeyHeader || params.sdkKey || '';
  
  if (!sdkKey) {
    this.metrics?.incrementCounter('api_errors_total', 1, {
      endpoint: `${this.apiPathPrefix}config`,
      method,
      error_type: 'missing_sdk_key'
    });
    return this.createJsonResponse(
      requestId, 
      400, 
      { error: "SDK key is required" }, 
      method
    );
  }

  try {
    // Get OptimizelyConfig from DecisionService
    if (!this.decisionService) {
      return this.createJsonResponse(
        requestId, 
        503, 
        { error: "Decision service not available" }, 
        method
      );
    }

    const optimizelyConfig = await this.decisionService.getOptimizelyConfig(sdkKey);
    if (!optimizelyConfig) {
      this.metrics?.incrementCounter('api_errors_total', 1, {
        endpoint: `${this.apiPathPrefix}config`,
        method,
        error_type: 'config_not_found'
      });
      return this.createJsonResponse(
        requestId, 
        404, 
        { error: "Configuration not found for the provided SDK key" }, 
        method
      );
    }

    // Process dynamic query parameters
    const result = this.processConfigQuery(optimizelyConfig, params, requestId);
    
    // Track successful config request
    this.metrics?.incrementCounter('config_requests_total', 1, {
      method,
      query_type: this.getQueryType(params)
    });
    
    return this.createJsonResponse(requestId, 200, result, method);
    
  } catch (error) {
    this.logger.error(`${this.logPrefix} [REQUEST:${requestId}] Error in config request:`, error);
    this.metrics?.incrementCounter('api_errors_total', 1, {
      endpoint: `${this.apiPathPrefix}config`,
      method,
      error_type: 'internal_error'
    });
    return this.createJsonResponse(
      requestId, 
      500, 
      { error: "Failed to retrieve configuration" }, 
      method
    );
  }
}
```

**Acceptance Criteria:**
- ✅ Validates SDK key from header or query parameter
- ✅ Retrieves OptimizelyConfig through DecisionService
- ✅ Returns appropriate HTTP status codes
- ✅ Includes proper error handling and metrics
- ✅ Only accepts GET requests

#### Task 2.2: Implement Query Processing Logic
**File:** `src-v2/services/implementations/ApiRouter.ts`

```typescript
/**
 * Processes query parameters to generate dynamic config response
 */
private processConfigQuery(config: any, params: any, requestId: string): any {
  const result: any = {};
  
  this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] Processing config query with params:`, params);
  
  // Handle metadata (include by default unless explicitly excluded)
  if (params.metadata !== 'false') {
    result.metadata = {
      revision: config.revision,
      sdkKey: config.sdkKey,
      environmentKey: config.environmentKey,
      timestamp: new Date().toISOString(),
      requestId: requestId
    };
  }

  // Handle summary mode (returns counts only)
  if (params.summary === 'true') {
    return {
      ...result,
      summary: {
        totalFeatures: Object.keys(config.featuresMap || {}).length,
        totalExperiments: Object.keys(config.experimentsMap || {}).length,
        totalAttributes: (config.attributes || []).length,
        totalAudiences: (config.audiences || []).length,
        totalEvents: (config.events || []).length
      }
    };
  }

  // Handle lookup operations
  if (params.lookup && params.value && params.type) {
    return {
      ...result,
      lookup: this.performLookup(config, params, requestId)
    };
  }

  // Handle reverse lookup operations
  if (params.reverseLookup && params.key && params.type) {
    return {
      ...result,
      reverseLookup: this.performReverseLookup(config, params, requestId)
    };
  }

  // Handle specific resource requests
  if (params.featureKey) {
    const feature = config.featuresMap?.[params.featureKey];
    return feature ? 
      { ...result, feature: this.formatFeature(feature, params) } : 
      { ...result, error: `Feature '${params.featureKey}' not found` };
  }

  if (params.experimentKey) {
    const experiment = config.experimentsMap?.[params.experimentKey];
    return experiment ? 
      { ...result, experiment: this.formatExperiment(experiment, params) } : 
      { ...result, error: `Experiment '${params.experimentKey}' not found` };
  }

  if (params.audienceId) {
    const audience = (config.audiences || []).find((a: any) => a.id === params.audienceId);
    return audience ? 
      { ...result, audience } : 
      { ...result, error: `Audience '${params.audienceId}' not found` };
  }

  if (params.eventKey) {
    const event = (config.events || []).find((e: any) => e.key === params.eventKey);
    return event ? 
      { ...result, event } : 
      { ...result, error: `Event '${params.eventKey}' not found` };
  }

  // Handle include/exclude logic for full response
  const includeList = params.include ? 
    params.include.split(',').map((s: string) => s.trim()) : 
    ['features', 'experiments', 'attributes', 'audiences', 'events'];
  const excludeList = params.exclude ? 
    params.exclude.split(',').map((s: string) => s.trim()) : 
    [];
  
  // Build response based on include/exclude
  if (includeList.includes('features') && !excludeList.includes('features')) {
    result.features = this.processFeatures(config.featuresMap, params, requestId);
  }
  
  if (includeList.includes('experiments') && !excludeList.includes('experiments')) {
    result.experiments = this.processExperiments(config.experimentsMap, params, requestId);
  }
  
  if (includeList.includes('attributes') && !excludeList.includes('attributes')) {
    result.attributes = config.attributes || [];
  }
  
  if (includeList.includes('audiences') && !excludeList.includes('audiences')) {
    result.audiences = config.audiences || [];
  }
  
  if (includeList.includes('events') && !excludeList.includes('events')) {
    result.events = config.events || [];
  }

  return result;
}
```

**Acceptance Criteria:**
- ✅ Handles all query parameter combinations correctly
- ✅ Returns appropriate data based on include/exclude filters
- ✅ Supports summary mode for quick overviews
- ✅ Properly formats responses based on format parameter
- ✅ Includes comprehensive logging for debugging

### Phase 3: Lookup Operations (1-2 hours)

#### Task 3.1: Implement Lookup Methods
**File:** `src-v2/services/implementations/ApiRouter.ts`

```typescript
/**
 * Performs lookup operations (key->object or id->object)
 */
private performLookup(config: any, params: any, requestId: string): any {
  const { lookup, value, type } = params;
  
  this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] Performing lookup: ${lookup}=${value} for type=${type}`);
  
  switch (type) {
    case 'feature':
      if (lookup === 'key') {
        return config.featuresMap?.[value] || null;
      }
      if (lookup === 'id') {
        const features = Object.values(config.featuresMap || {});
        return features.find((f: any) => f.id === value) || null;
      }
      break;
      
    case 'experiment':
      if (lookup === 'key') {
        return config.experimentsMap?.[value] || null;
      }
      if (lookup === 'id') {
        const experiments = Object.values(config.experimentsMap || {});
        return experiments.find((e: any) => e.id === value) || null;
      }
      break;
      
    case 'audience':
      if (lookup === 'id') {
        return (config.audiences || []).find((a: any) => a.id === value) || null;
      }
      if (lookup === 'name') {
        return (config.audiences || []).find((a: any) => a.name === value) || null;
      }
      break;
      
    case 'event':
      if (lookup === 'key') {
        return (config.events || []).find((e: any) => e.key === value) || null;
      }
      if (lookup === 'id') {
        return (config.events || []).find((e: any) => e.id === value) || null;
      }
      break;
  }
  
  return null;
}

/**
 * Performs reverse lookup operations (key->id or id->key)
 */
private performReverseLookup(config: any, params: any, requestId: string): any {
  const { reverseLookup, key, type } = params;
  
  this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] Performing reverse lookup: ${reverseLookup} for ${type} key=${key}`);
  
  switch (type) {
    case 'feature':
      const feature = config.featuresMap?.[key];
      if (feature) {
        return reverseLookup === 'id' ? feature.id : feature.key;
      }
      break;
      
    case 'experiment':
      const experiment = config.experimentsMap?.[key];
      if (experiment) {
        return reverseLookup === 'id' ? experiment.id : experiment.key;
      }
      break;
      
    case 'audience':
      const audience = (config.audiences || []).find((a: any) => 
        reverseLookup === 'id' ? a.name === key : a.id === key
      );
      if (audience) {
        return reverseLookup === 'id' ? audience.id : audience.name;
      }
      break;
      
    case 'event':
      const event = (config.events || []).find((e: any) => 
        reverseLookup === 'id' ? e.key === key : e.id === key
      );
      if (event) {
        return reverseLookup === 'id' ? event.id : event.key;
      }
      break;
  }
  
  return null;
}
```

**Acceptance Criteria:**
- ✅ Supports bidirectional lookups for all resource types
- ✅ Returns null for not found cases
- ✅ Handles missing or malformed config data gracefully
- ✅ Includes proper logging for debugging

### Phase 4: Response Formatting (1 hour)

#### Task 4.1: Implement Format Processing
**File:** `src-v2/services/implementations/ApiRouter.ts`

```typescript
/**
 * Processes features based on format parameter
 */
private processFeatures(featuresMap: any, params: any, requestId: string): any {
  if (!featuresMap) return {};
  
  const format = params.format || 'standard';
  const excludeVariables = params.exclude?.includes('variablesMap');
  const excludeExperiments = params.exclude?.includes('experimentsMap');
  
  switch (format) {
    case 'minimal':
      return Object.keys(featuresMap).reduce((acc: any, key: string) => {
        acc[key] = {
          id: featuresMap[key].id,
          key: featuresMap[key].key
        };
        return acc;
      }, {});
      
    case 'full':
      return featuresMap;
      
    case 'standard':
    default:
      return Object.keys(featuresMap).reduce((acc: any, key: string) => {
        const feature = { ...featuresMap[key] };
        if (excludeVariables) delete feature.variablesMap;
        if (excludeExperiments) delete feature.experimentsMap;
        acc[key] = feature;
        return acc;
      }, {});
  }
}

/**
 * Helper method to determine query type for metrics
 */
private getQueryType(params: any): string {
  if (params.summary === 'true') return 'summary';
  if (params.lookup) return 'lookup';
  if (params.reverseLookup) return 'reverse_lookup';
  if (params.featureKey) return 'feature_specific';
  if (params.experimentKey) return 'experiment_specific';
  if (params.include || params.exclude) return 'filtered';
  return 'full';
}
```

**Acceptance Criteria:**
- ✅ Supports minimal, standard, and full format levels
- ✅ Respects exclude parameters for lighter responses
- ✅ Properly categorizes query types for metrics
- ✅ Maintains data structure integrity

## Testing Strategy

### Unit Tests
**Location:** `src-v2/tests/services/implementations/ApiRouter.config.test.ts`

```typescript
describe('ApiRouter Config Endpoint', () => {
  // Test cases for each functionality
  test('should return full config with valid SDK key')
  test('should return 400 for missing SDK key')
  test('should return 404 for invalid SDK key')
  test('should handle summary queries correctly')
  test('should perform feature lookups by key and id')
  test('should perform reverse lookups correctly')
  test('should respect include/exclude parameters')
  test('should handle format parameters')
  test('should handle specific resource queries')
  test('should return proper error messages')
});
```

### Integration Tests
**Location:** `src-v2/tests/integration/ConfigEndpoint.test.ts`

```typescript
describe('Config Endpoint Integration', () => {
  test('should integrate with live OptimizelyConfig')
  test('should handle real SDK keys and datafiles')
  test('should match v1 config endpoint behavior for basic queries')
  test('should perform under load')
});
```

### API Testing
Create comprehensive curl/Postman tests covering all query combinations:

```bash
# Basic functionality
curl "http://localhost:8787/api/config?sdkKey=8mR1pGh8u2ztUP8GqjmQq"

# Summary mode
curl "http://localhost:8787/api/config?sdkKey=8mR1pGh8u2ztUP8GqjmQq&summary=true"

# Feature lookup
curl "http://localhost:8787/api/config?sdkKey=8mR1pGh8u2ztUP8GqjmQq&lookup=key&value=test_feature&type=feature"

# Filtered response
curl "http://localhost:8787/api/config?sdkKey=8mR1pGh8u2ztUP8GqjmQq&include=features,attributes&format=minimal"
```

## Documentation Requirements

### API Documentation Update
**File:** `documentation/edge-agent-v2-api-endpoint-reference.md`

Add comprehensive section for `/api/config` endpoint including:
- All query parameters
- Response examples
- Use case scenarios
- Performance considerations

### Usage Examples
**File:** `docs-sot/api/config/README.md`

Create detailed usage guide with:
- Common query patterns
- Performance optimization tips
- Integration examples
- Troubleshooting guide

### Postman Collection
**File:** `test-scripts/postman-config-collection.json`

Create Postman collection with:
- All query parameter combinations
- Environment variables setup
- Automated test assertions

## Success Criteria

### Functional Requirements
- ✅ Endpoint correctly returns OptimizelyConfig data
- ✅ All query parameters work as specified
- ✅ Lookup operations return correct results
- ✅ Error handling provides helpful messages
- ✅ Response format matches API specification

### Performance Requirements
- ✅ Response time < 200ms for summary queries
- ✅ Response time < 500ms for full config queries
- ✅ Memory usage remains stable under load
- ✅ Caching improves subsequent request performance

### Quality Requirements
- ✅ 95%+ test coverage for new code
- ✅ All integration tests pass
- ✅ No breaking changes to existing endpoints
- ✅ Comprehensive error handling
- ✅ Proper logging and metrics integration

### Documentation Requirements
- ✅ API reference documentation updated
- ✅ Usage examples provided
- ✅ Postman collection created
- ✅ Implementation notes documented

## Rollout Plan

### Phase 1: Development & Testing (Week 1)
- Implement core functionality
- Write comprehensive tests
- Initial integration testing

### Phase 2: Documentation & QA (Week 1)
- Update API documentation
- Create usage examples
- QA testing with real datafiles

### Phase 3: Validation & Polish (Week 1)
- Performance testing
- Error handling validation
- Final documentation review

### Phase 4: Release (Week 2)
- Merge to main branch
- Update deployment documentation
- Announce new endpoint availability

## Monitoring & Metrics

### Key Metrics to Track
- `config_requests_total` - Total config requests by query type
- `config_request_duration` - Request processing time
- `config_errors_total` - Error rates by error type
- `config_cache_hits` - Cache performance (if implemented)

### Alerting
- Alert on error rate > 5%
- Alert on response time > 1s
- Alert on memory usage spikes

## Future Enhancements

### Potential V2 Features
- **Caching**: Implement OptimizelyConfig caching with TTL
- **WebSockets**: Real-time config updates via WebSockets
- **GraphQL**: GraphQL interface for advanced querying
- **Export Formats**: Support CSV, XML export formats
- **Search**: Full-text search across config data
- **Webhooks**: Webhook support for config changes

### Performance Optimizations
- **Response Compression**: Gzip/Brotli compression
- **Streaming**: Stream large responses
- **Pagination**: Paginate large feature lists
- **Field Selection**: GraphQL-style field selection

## Risk Mitigation

### Performance Risks
- **Risk**: Large datafiles cause slow responses
- **Mitigation**: Implement response size limits and pagination

### Security Risks
- **Risk**: SDK key exposure in logs
- **Mitigation**: Sanitize sensitive data in logs

### Compatibility Risks
- **Risk**: Breaking changes to OptimizelyConfig structure
- **Mitigation**: Version the endpoint and maintain backward compatibility

## Implementation Timeline

| Phase | Duration | Dependencies | Deliverables |
|-------|----------|--------------|--------------|
| Phase 1 | 2-3 hours | DecisionService access | Core handler, basic routing |
| Phase 2 | 2-3 hours | Phase 1 complete | Query processing, error handling |
| Phase 3 | 1-2 hours | Phase 2 complete | Lookup operations |
| Phase 4 | 1 hour | Phase 3 complete | Response formatting |
| Testing | 2-3 hours | All phases complete | Comprehensive test suite |
| Documentation | 1-2 hours | Implementation complete | API docs, examples |

**Total Estimated Effort:** 8-13 hours  
**Target Completion:** Within 1-2 sprints

---

This implementation plan provides a comprehensive roadmap for creating a powerful, flexible config endpoint that exceeds the functionality of the v1 equivalent while maintaining simplicity for basic use cases. 