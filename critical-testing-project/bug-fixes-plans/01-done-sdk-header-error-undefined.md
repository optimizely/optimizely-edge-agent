
I'll investigate the SDK key parameter handling bug and create a fix plan. Let me start by examining the CloudflareComposition.js file where the error occurs.

Ran tool
Let me search for the composition files to locate the cloudflareComposition.js:

Ran tool
Now I'll look at the source file that contains the error:

Read file: src-v2/composition/cloudflareComposition.ts
Looking at the cloudflareComposition.ts file, I can see the error occurs in the handleCloudflareWorkerRequest function, specifically around line 155. Let me examine the ResponseResult type to understand how headers are handled:

Ran tool
Let's check that interface:

Read file: src-v2/services/interfaces/IRequestHandler.ts
Now let me look at the RequestHandler implementation to understand how response headers are generated:

Read file: src-v2/services/implementations/RequestHandler.ts
Let me check the createJsonResponse method to see how response headers are handled:

Read file: src-v2/services/implementations/RequestHandler.ts
Let me check the createResponseHeaders method:

Read file: src-v2/services/implementations/RequestHandler.ts
Now, let me look at the addDecisionHeadersToResponse and addCookiesToResponse methods:

Ran tool

Read file: src-v2/services/implementations/RequestHandler.ts
Now I have a good understanding of the issue. Let me see the ConfigurationService where SDK key is retrieved from headers:

Read file: src-v2/services/implementations/ConfigurationService.ts
Based on my investigation of the Optimizely Edge Agent codebase, I can identify the bug and provide a plan to fix it. Here's my analysis:

## Bug Analysis

The error `TypeError: Invalid header value` occurs in the CloudflareComposition.js on line 155 during response header creation. After examining the code:

1. **Root Cause:** When sending a response, one of the header values is invalid. This is likely happening in the `addDecisionHeadersToResponse` method, where `X-Optimizely-SDK-Key` header gets set when the SDK key is available.

2. **Specific Issue:** The code attempts to set response headers but doesn't properly validate that the header values are valid strings. In particular, when SDK key is `undefined`, `null`, or when the SDK key header structure contains non-string values, it causes the Cloudflare Worker to throw an error.

3. **Impact:** This error affects all responses from the `/decide` endpoint, preventing users from getting flag decisions regardless of how the SDK key is provided (header, query parameter, or request body).

## Fix Plan

Here's the step-by-step plan to fix the issue:

1. **Add Header Value Validation:** Update the `addDecisionHeadersToResponse` method in `RequestHandler.ts` to ensure all header values are valid strings before setting them.

2. **Fix SDK Key Header:** Ensure the SDK key is properly validated before setting it as a response header.

3. **Improve Error Handling:** Add better error handling around header creation to catch and log issues without failing the entire request.

4. **Add Unit Tests:** Create tests specifically for the header value validation to prevent future regressions.

Here's the specific code change required:

```typescript
// In RequestHandler.ts - addDecisionHeadersToResponse method

private addDecisionHeadersToResponse(
  decisions: Record<string, OptimizelyDecision>,
  config: Record<string, any>,
  responseHeaders: Record<string, string>
): void {
  // Skip if return decisions is disabled or headers are disabled
  if (config.returnDecisions === false || config.responseHeadersAndCookies === false) {
    return;
  }
  
  // Check for header configuration - if headers config is present, use it to control which headers to include
  const headerConfig = config.headers || {
    'decisions': true,
    'variations': true,
    'experiments': true,
    'visitor-id': true,
    'sdk-key': true,
    'powered-by': true
  };
  
  // Add Powered-By header if enabled
  if (headerConfig['powered-by'] !== false) {
    responseHeaders['X-Powered-By'] = 'Optimizely Edge';
  }
  
  // Add SDK Key header if enabled and available - ADD VALIDATION HERE
  if (headerConfig['sdk-key'] !== false && config.sdkKey) {
    // Ensure SDK key is a valid string value
    const sdkKeyValue = String(config.sdkKey).trim();
    if (sdkKeyValue) {
      responseHeaders['X-Optimizely-SDK-Key'] = sdkKeyValue;
    }
  }
  
  // Add Visitor ID header if enabled and available - ADD VALIDATION HERE
  if (headerConfig['visitor-id'] !== false && config.userId) {
    const visitorIdValue = String(config.userId).trim();
    if (visitorIdValue) {
      responseHeaders['X-Optimizely-Visitor-Id'] = visitorIdValue;
    }
  }
  
  // Rest of the method remains the same...
}
```

Additionally, we should update the `createResponseHeaders` method to include error handling:

```typescript
private createResponseHeaders(
  userContext: OptimizelyUserContext,
  decisions: Record<string, OptimizelyDecision>,
  config: Record<string, any>
): Record<string, string> {
  try {
    // Initialize headers with standard values
    const responseHeaders: Record<string, string> = {
      'X-Optimizely-Edge-Agent': 'v2'
    };
    
    // Set content type if not explicitly disabled
    if (config.includeContentType !== false) {
      responseHeaders['Content-Type'] = 'application/json';
    }
    
    // Add standard decision-related headers with error handling
    try {
      this.addDecisionHeadersToResponse(decisions, config, responseHeaders);
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error adding decision headers:`, error);
    }
    
    // Add custom headers from config with error handling
    try {
      this.addCustomHeadersFromConfig(config, responseHeaders);
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error adding custom headers:`, error);
    }
    
    // Add cookies to response headers with error handling
    try {
      this.addCookiesToResponse(userContext, decisions, config, responseHeaders);
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error adding cookies to response:`, error);
    }
    
    // Final validation pass to ensure all header values are strings
    Object.keys(responseHeaders).forEach(key => {
      const value = responseHeaders[key];
      if (value === undefined || value === null) {
        delete responseHeaders[key];
      } else if (typeof value !== 'string') {
        try {
          responseHeaders[key] = String(value);
        } catch (e) {
          this.logger.error(`${this.logPrefix} Invalid header value for ${key}, removing header`);
          delete responseHeaders[key];
        }
      }
    });
    
    return responseHeaders;
  } catch (error) {
    // Return minimal safe headers if there's an unexpected error
    this.logger.error(`${this.logPrefix} Critical error creating response headers:`, error);
    return {
      'X-Optimizely-Edge-Agent': 'v2',
      'Content-Type': 'application/json'
    };
  }
}
```

## Implementation Plan

1. **Make Code Changes**: Implement the fixes described above in the RequestHandler.ts file.

2. **Add Unit Tests**: Create tests that verify header values are properly validated and invalid values don't cause exceptions.

3. **Test SDK Key Handling**: Verify that SDK keys provided via different methods (header, query, body) all work correctly:
   - Test with valid SDK keys in each location
   - Test with invalid/missing SDK keys
   - Test with edge cases (empty strings, non-string values)

4. **Review CloudflareComposition.js**: Make sure the Response generation has proper error handling:
   ```typescript
   // Line 155 in cloudflareComposition.js
   return new Response(result.body, {
     status: result.status,
     headers: result.headers || {} // Ensure headers is always an object
   });
   ```

5. **Update Documentation**: Update API documentation to clearly specify the validation requirements for SDK keys.

This fix properly validates header values and adds robust error handling to prevent the worker from crashing when faced with invalid header values. It maintains the existing functionality while making it more resilient to edge cases.
