# Error Handling in v2

_Last Updated: 2025-04-18_

## Overview

The v2 implementation introduces a more robust and structured error handling approach compared to v1. It leverages TypeScript's type safety and implements consistent error handling patterns across all services.

## Core Error Handling Pattern

The primary error handling occurs in the `handleRequest` method of `RequestHandler.ts`:

```typescript
async handleRequest(requestAdapter: IRequestAdapter): Promise<ResponseResult> {
  const requestId = uuidv4();
  // ...initialization

  // Start request timer
  const requestTimer = this.metrics?.startTimer('request_duration', {
    method,
    path,
  });

  try {
    // Request processing logic
    // ...
  } catch (error) {
    this.logger.error(`${this.logPrefix} RequestHandler [${requestId}]: Error handling request.`, error);

    // Track error
    this.metrics?.incrementCounter('request_errors', 1, {
      method,
      path: url.pathname,
      error_type: error instanceof Error ? error.name : 'unknown',
    });

    // Stop request timer
    if (requestTimer) {
      requestTimer.stop();
    }

    // Try to trigger cleanup even on errors
    try {
      this.triggerCleanupIfNeeded();
    } catch (cleanupError) {
      // Ignore cleanup errors on the error path
    }

    const errorResponse = this.createErrorResponse(requestId, 500, 'Internal Server Error');
    
    // Add implementation version header
    errorResponse.headers['X-Implementation-Version'] = 'v2';
    errorResponse.headers['X-Request-ID'] = requestId;

    return errorResponse;
  }
}
```

## Key Error Handling Improvements

### 1. Structured Error Responses

The v2 implementation uses a dedicated method for creating consistent error responses:

```typescript
private createErrorResponse(
  requestId: string,
  status: number,
  message: string,
  userContext?: OptimizelyUserContext,
  config?: Record<string, any>
): ResponseResult {
  const responseBody = {
    error: message,
    requestId,
    status,
    timestamp: new Date().toISOString()
  };

  if (config?.includeDebugInfo && userContext) {
    responseBody.debug = {
      userId: userContext.userId,
      attributesProvided: Object.keys(userContext.attributes || {}).length
    };
  }

  return {
    status,
    body: JSON.stringify(responseBody),
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': requestId
    }
  };
}
```

This ensures all error responses have:
- Consistent JSON structure
- HTTP status code
- Error message
- Request ID for tracing
- Timestamp

### 2. Granular Error Metrics

The v2 implementation tracks detailed error metrics with context:

```typescript
this.metrics?.incrementCounter('request_errors', 1, {
  method,
  path: url.pathname,
  error_type: error instanceof Error ? error.name : 'unknown',
});
```

These metrics enable:
- Error type classification
- Path-specific error rates
- Method-specific error analysis

### 3. Structured Logging

All error logging follows a structured pattern with component tagging:

```typescript
this.logger.error(`${this.logPrefix} RequestHandler [${requestId}]: Error handling request.`, error);
```

The logging approach includes:
- Component prefix (e.g., `[RequestHandler]`)
- Request ID for correlation
- Operation context
- Full error object (not just message)

### 4. Cascading Error Handlers

The v2 implementation uses cascading error handlers for different services:

```typescript
// ApiRouter error handling
if (this.apiRouter) {
  try {
    // Call ApiRouter
    const result = await this.apiRouter.routeApiRequest(requestAdapter);
    // ...
  } catch (error) {
    this.logger.error(`${this.logPrefix} RequestHandler [${requestId}]: Error calling ApiRouter`, error);

    // Track API error
    this.metrics?.incrementCounter('api_errors_total', 1, {
      path,
      method,
      error_type: error instanceof Error ? error.name : 'unknown',
    });

    // Return error response
    return {
      status: 500,
      body: JSON.stringify({
        error: 'API request handling error',
        message: error instanceof Error ? error.message : 'Unknown error',
        path: path,
      }),
      headers: {
        'Content-Type': 'application/json',
        'X-Implementation-Version': 'v2',
        'X-Request-ID': requestId,
      },
    };
  }
}
```

This ensures that:
- Errors in specific components don't crash the entire request
- Appropriate error details are provided based on the failing component
- Error metrics are tracked with component-specific tags

### 5. Recovery Strategies

The v2 implementation attempts to recover from non-critical errors:

```typescript
// Try to trigger cleanup even on errors
try {
  this.triggerCleanupIfNeeded();
} catch (cleanupError) {
  // Ignore cleanup errors on the error path
}
```

```typescript
// Cache handling with error recovery
try {
  // Attempt to retrieve from cache
  const cacheResult = await this.cacheService.get(cacheKey);
  
  if (cacheResult) {
    // Use cached content
  }
} catch (cacheError) {
  // Log cache error but continue processing
  this.logger.error(`${this.logPrefix} Cache retrieval error`, cacheError);
  
  // Fall back to origin fetch
  // ...
}
```

### 6. Type-Checking Error Handling

The TypeScript implementation enables more robust type checking for errors:

```typescript
if (error instanceof Error) {
  this.logger.error(`${this.logPrefix} Specific error handling for: ${error.name}`, error);
  errorType = error.name;
  errorMessage = error.message;
} else {
  // Handle non-Error objects
  this.logger.error(`${this.logPrefix} Unknown error type`, String(error));
  errorType = 'unknown';
  errorMessage = String(error);
}
```

## Comparison with v1

| Feature | v1 Implementation | v2 Implementation |
|---------|-------------------|-------------------|
| **Error Structure** | Ad-hoc error responses | Consistent `createErrorResponse` method |
| **Error Metrics** | Basic error counting | Detailed metrics with context tags |
| **Logging** | Simple message logging | Structured logging with request IDs |
| **Recovery** | Limited fallback strategies | Multiple recovery points |
| **Service Errors** | Single try/catch block | Component-specific error handling |
| **Error Classification** | Limited | Error type detection and metrics |
| **Debugging Info** | Minimal | Optional debug data in responses |

## Error Handling Workflow

1. **Detection**: Errors caught in try/catch blocks
2. **Logging**: Structured logging with context
3. **Metrics**: Increment counters with tags
4. **Recovery**: Attempt non-critical operation recovery
5. **Response**: Create standardized error response
6. **Headers**: Add tracking headers (X-Request-ID, etc.)
7. **Cleanup**: Attempt cleanup operations where safe

This multi-layered approach significantly improves both error visibility and system resiliency in v2.