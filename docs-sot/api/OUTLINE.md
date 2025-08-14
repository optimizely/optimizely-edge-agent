# API Documentation Outline

## Overview

This outline plans comprehensive documentation for the Optimizely Edge Agent API. The API provides endpoints for feature flag decisions, datafile management, admin operations, and debugging capabilities.

## Planned Documents

### 1. API Overview (README.md)
**Purpose**: Provide comprehensive introduction to the Edge Agent API
**Content**:
- API architecture and design principles
- Available endpoints overview
- Request/response patterns
- Common headers and parameters
- Error handling patterns
- API versioning (v1 vs v2)
**Research**:
- Review ApiRouter.ts implementation
- Document endpoint routing logic
- Map API path prefix configuration

### 2. Authentication & Authorization (authentication.md)
**Purpose**: Document security mechanisms and access control
**Content**:
- SDK key authentication
- Admin token requirements
- Header-based authentication
- Security best practices
- Rate limiting (if applicable)
**Research**:
- Review isAdminRequest method
- Document X-Optimizely-Admin-Token usage
- Map authentication flows

### 3. Decision Endpoints Suite
#### 3.1 Single Decision (decisions/decide.md)
**Purpose**: Document individual flag decision endpoint
**Content**:
- POST /api/decide endpoint
- Request format and parameters
- User identification (userId/visitorId)
- Attributes and targeting
- Decide options
- Response format
**Research**:
- Review handleDecideRequest method
- Document parameter precedence

#### 3.2 Batch Decisions (decisions/decide-all.md)
**Purpose**: Document all-flags decision endpoint
**Content**:
- POST /api/decide-all endpoint
- Batch processing behavior
- Trimmed decisions option
- Performance considerations
**Research**:
- Review handleDecideAllRequest method
- Document response optimization

#### 3.3 Multiple Keys (decisions/decide-for-keys.md)
**Purpose**: Document selective flags decision endpoint
**Content**:
- POST /api/decide-for-keys endpoint
- Flag key specification
- Batch optimization
**Research**:
- Review handleDecideForKeysRequest method

### 4. Data Management Endpoints
#### 4.1 Datafile Management (data-management/datafile.md)
**Purpose**: Document datafile CRUD operations
**Content**:
- GET /api/datafile - Retrieve datafile
- PUT/POST /api/datafile - Update datafile
- Operation modes (refresh, sync, update)
- KV storage integration
- CDN fallback behavior
**Research**:
- Review handleDatafileRequest method
- Document operation parameter behavior

#### 4.2 Flag Keys (data-management/flagkeys.md)
**Purpose**: Document flag key management
**Content**:
- GET /api/flagkeys endpoint
- KV storage for flag keys
- Automatic extraction from datafile
**Research**:
- Review handleFlagKeysRequest method

### 5. Admin & Debug Endpoints
#### 5.1 Debug Information (admin/debug.md)
**Purpose**: Document debugging capabilities
**Content**:
- GET /api/debug endpoint
- Configuration metadata
- Request context information
- Troubleshooting data
**Research**:
- Review handleDebugRequest method

#### 5.2 Forced Variations (admin/forced-variations.md)
**Purpose**: Document forced decision management
**Content**:
- POST /api/set-forced-variation
- GET /api/get-forced-variation
- POST /api/remove-forced-variation
- POST /api/remove-all-forced-decisions
- Testing and QA workflows
**Research**:
- Review forced variation handlers

### 6. Request/Response Formats (request-response-formats.md)
**Purpose**: Document standard formats and patterns
**Content**:
- Common request structures
- Header specifications
- Parameter precedence (header > query > body)
- Response format standards
- Error response structures
- Metadata tracking
**Research**:
- Review RequestConfig interface
- Document configMetadata structure

### 7. Error Handling (error-handling.md)
**Purpose**: Document error scenarios and responses
**Content**:
- HTTP status codes
- Error response format
- Common error scenarios
- Validation errors
- Troubleshooting guide
**Research**:
- Review error handling patterns
- Document createErrorResponse usage

### 8. SDK Integration (sdk-integration.md)
**Purpose**: Document SDK-specific features
**Content**:
- SDK info endpoint (/api/sdk)
- SDK version compatibility
- Decide options mapping
- Event tracking integration
- User context management
**Research**:
- Review handleSdkInfoRequest
- Document SDK configuration

### 9. Examples & Use Cases (examples/)
**Purpose**: Provide practical implementation examples
**Content**:
- Common integration patterns
- Client library examples
- cURL command examples
- Testing scenarios
- Migration from v1 to v2
**Research**:
- Extract examples from comments
- Create practical scenarios

### 10. Performance & Best Practices (performance.md)
**Purpose**: Document optimization strategies
**Content**:
- Caching strategies
- Batch vs individual requests
- KV storage optimization
- Header/cookie management
- Monitoring and metrics
**Research**:
- Review metrics implementation
- Document performance patterns

## Document Standards

### Structure Template
```markdown
# [Endpoint/Feature Name]

## Overview
Brief description of the endpoint/feature

## Endpoint Details
- **URL**: `/api/[endpoint]`
- **Methods**: GET, POST, PUT, DELETE
- **Authentication**: Required/Optional

## Request Format
### Headers
### Parameters
### Body

## Response Format
### Success Response
### Error Response

## Examples
### Basic Example
### Advanced Example

## Best Practices
## Common Issues
## Related Endpoints
```

### Documentation Guidelines
1. Use clear, concise language
2. Include practical examples for each endpoint
3. Document all parameters with types and defaults
4. Explain parameter precedence rules
5. Include error scenarios and solutions
6. Cross-reference related endpoints
7. Version-specific differences clearly marked

## Priority Order

1. **High Priority** (Core functionality):
   - API Overview (README.md)
   - Authentication & Authorization
   - Single Decision (decide.md)
   - Batch Decisions (decide-all.md)
   - Datafile Management

2. **Medium Priority** (Extended features):
   - Multiple Keys Decisions
   - Flag Keys Management
   - Request/Response Formats
   - Error Handling

3. **Lower Priority** (Advanced/Admin):
   - Admin & Debug Endpoints
   - Forced Variations
   - SDK Integration
   - Performance & Best Practices

## Next Steps

1. Create README.md with API overview
2. Document authentication patterns
3. Detail each decision endpoint
4. Add practical examples
5. Create migration guide from v1
6. Add troubleshooting section