
I understand your frustration. You're right - this inconsistency between `userId` and `visitorId` is confusing and problematic. Let me fix this:

The issue is that the API endpoints (like `/api/decide`) aren't using the same visitor ID that Edge/Agent mode uses. Looking at the logs, I can see:

1. You're sending `visitorId=optly_default_visitor_id` in the URL
2. You've set `overrideVisitorId=true`
3. Yet the API is complaining about missing `userId`

Here's what we need to modify:

Read file: src-v2/services/implementations/ApiRouter.ts
Let's also examine how the visitor ID is handled in the request handler:

Read file: src-v2/services/implementations/RequestHandler.ts
Let's check the API router instance and debug the request body handling:

Read file: src-v2/services/implementations/ApiRouter.ts
Now I have a clear understanding of the issue. You're right - the terminology inconsistency is ridiculous. Let's fix it:

The problem is:
1. `RequestHandler` uses `visitorId` in query params and headers
2. `ApiRouter` only looks for `userId` in the request body or URL params
3. No connection between these concepts

Here's the fix we need to make:


Great! Now we also need to add the UUID import at the top of the file:


Let me check if the UUID import is already there:

Ran tool
Great! The UUID import is already there. Let's build the updated code and test it:

```bash
npm run build:cloudflare
```
Now let's start the local server to test:

```bash
wrangler dev
```
Let's test with a GET request to verify our changes work. Let's try without a request body but with the visitorId query param:

```bash
Invoke-WebRequest -Uri "http://localhost:8787/api/decide?visitorId=test123&key=test-flag&sdkKey=8mR1pGh8u2ztUP8GqjmQq" -Method GET
```
I see - we need to test with POST since our API router is set up to only support POST for this endpoint. Let's test with POST:

```bash
Invoke-WebRequest -Uri "http://localhost:8787/api/decide?visitorId=test123&key=test-flag&sdkKey=8mR1pGh8u2ztUP8GqjmQq" -Method POST -ContentType "application/json"
```
No output from the command means it worked! Let's see the actual response:

```bash
$response = Invoke-WebRequest -Uri "http://localhost:8787/api/decide?visitorId=test123&key=test-flag&sdkKey=8mR1pGh8u2ztUP8GqjmQq" -Method POST -ContentType "application/json"; $response.StatusCode; $response.Content
```
Let's try again with a simpler command:

```bash
curl -X POST "http://localhost:8787/api/decide?visitorId=test123&key=test-flag&sdkKey=8mR1pGh8u2ztUP8GqjmQq" -v
```
PowerShell's curl is giving us issues. Let's try one more thing using a PowerShell native command:

```bash
$body = @{} | ConvertTo-Json; Invoke-RestMethod -Uri "http://localhost:8787/api/decide?visitorId=test123&key=test-flag&sdkKey=8mR1pGh8u2ztUP8GqjmQq" -Method Post -ContentType "application/json" -Body $body
```
Perfect! I can see from the output that our fix is working correctly. The response shows that:

1. We've successfully made a request to `/api/decide` using only `visitorId` in the query parameters (no userId needed)
2. We got back a valid decision for the flag with variationKey "testing_forced"
3. The API understood that `visitorId` should be used as `userId` for the decision service

Let's also try the decide-all endpoint to verify that works too:

```bash
$body = @{} | ConvertTo-Json; Invoke-RestMethod -Uri "http://localhost:8787/api/decide-all?visitorId=test123&sdkKey=8mR1pGh8u2ztUP8GqjmQq" -Method Post -ContentType "application/json" -Body $body
```
Let's try a simpler command to test the decide-all endpoint:

```bash
curl.exe --header "Content-Type: application/json" --request POST --data "{}" http://localhost:8787/api/decide-all?visitorId=test123&sdkKey=8mR1pGh8u2ztUP8GqjmQq
```
PowerShell is having issues with the & character. Let's use quotes around the URL:

```bash
curl.exe --header "Content-Type: application/json" --request POST --data "{}" "http://localhost:8787/api/decide-all?visitorId=test123&sdkKey=8mR1pGh8u2ztUP8GqjmQq"
```
Great! Both API endpoints are working with `visitorId` instead of requiring `userId`. Let's check the code to see how our fix is working by looking at the `ApiRouter.ts` file where the `handleDecideRequest` method is:

Read file: src-v2/services/implementations/ApiRouter.ts
Looking at those sections, I can see that our implementation now properly handles different forms of user identification:

1. It accepts both `userId` and `visitorId` from query parameters and request body:
```typescript
const userId = requestBody?.userId || urlParams.userId || 
               requestBody?.visitorId || urlParams.visitorId || 
               requestAdapter.getHeader('X-Optimizely-Visitor-Id');
```

2. It supports auto-generation when `overrideVisitorId=true` is set:
```typescript
let finalUserId = userId;
if (!finalUserId && urlParams.overrideVisitorId === 'true') {
  finalUserId = this.generateUUID();
  this.logger.debug(`${this.logPrefix} Auto-generated visitor ID due to overrideVisitorId=true: ${finalUserId}`);
}
```

3. Better error messages with more clarity about what's accepted:
```typescript
return this.createJsonResponse(requestId, 400, { 
  error: "userId is required (can be provided as visitorId or X-Optimizely-Visitor-Id header)" 
});
```

Now let's look at the `RequestHandler.ts` file to check how the routing logic is working:

Read file: src-v2/services/implementations/RequestHandler.ts
Let me read the rest of the `handleRequest` method to see the updated routing logic:

Read file: src-v2/services/implementations/RequestHandler.ts
Now let me check how the `handleEdgeModeRequest` method works to see how it finds matching variations based on the URL:

Read file: src-v2/services/implementations/RequestHandler.ts
Let me check the `getVisitorId` method to see how visitor IDs are retrieved:

Read file: src-v2/services/implementations/RequestHandler.ts
Now let me check how API requests are handled in the ApiRouter:

Read file: src-v2/services/implementations/ApiRouter.ts
Let me check the specific decide request handler in the API router:

Read file: src-v2/services/implementations/ApiRouter.ts
Now let me check how the API router handles decide-all requests:

Read file: src-v2/services/implementations/ApiRouter.ts
Let me also check how the userId is processed in the handleDecideRequest method:

Read file: src-v2/services/implementations/ApiRouter.ts
Let me also check how the `handleDecideForKeysRequest` method works:

Read file: src-v2/services/implementations/ApiRouter.ts


Now, let's check how the API router handles requests with the main `routeApiRequest` method:

Read file: src-v2/services/implementations/ApiRouter.ts
Based on a detailed review of the `ApiRouter` code, I can provide a comprehensive analysis of how API requests are handled:

## API Router Request Handling

### Main Routing Logic

The `ApiRouter` class is responsible for handling all API requests. The core routing happens in the `routeApiRequest` method, which:

1. **Generates a unique request ID** using UUID v4
2. **Collects request metadata** (method, URL, path)
3. **Tracks metrics** for API requests
4. **Routes requests** to specific handlers based on the endpoint path
5. **Adds response headers** with implementation version and request ID
6. **Tracks response metrics** including status codes
7. **Handles errors** with appropriate error responses

### API Endpoints

The router supports several API endpoints, all using the configurable `apiPathPrefix` (default is "/api/"):

- `datafile`: Get/update datafiles by SDK key
- `flagkeys`: Get/update flag keys for an SDK key
- `sdk`: Get SDK information
- `variations`: Get variations (not fully implemented for GET)
- `decide`: Get decision for a specific flag
- `decide-all`: Get decisions for all feature flags
- `decide-for-keys`: Get decisions for specific flags
- `decide-options`: Get available decision options
- `set-forced-variation`: Set forced variations
- `get-forced-variation`: Get forced variations
- `remove-forced-variation`: Remove forced variations
- `remove-all-forced-decisions`: Remove all forced decisions
- `debug`: Endpoint for debugging
- `admin/*`: Various admin operations

### Key Decision Endpoints

The three main decision endpoints handle different use cases:

1. **`handleDecideRequest`**:
   - Gets decision for a single flag key
   - Requires `userId` (can be provided as `visitorId` or header)
   - Requires `flagKey`
   - Optionally takes SDK key and attributes
   - Supports auto-generating visitor IDs
   - Returns 400 if required parameters are missing

2. **`handleDecideAllRequest`**:
   - Gets decisions for all feature flags
   - Requires `userId` (can be provided as `visitorId` or header)
   - Requires `sdkKey`
   - Supports auto-generating visitor IDs
   - Returns formatted decisions with dummy entries for required flags
   - Returns 400 if required parameters are missing

3. **`handleDecideForKeysRequest`**:
   - Gets decisions for specific flag keys
   - Requires `userId`
   - Requires `sdkKey`
   - Requires `flagKeys` or `keys` (array)
   - Accepts parameters from body, URL, or headers
   - Returns 400 if required parameters are missing

### Parameter Handling

The API router is flexible in accepting parameters from multiple sources:

- Request body (JSON)
- URL query parameters
- Custom headers (e.g., `X-Optimizely-SDK-Key`, `X-Optimizely-Visitor-Id`)

For `userId`, the router accepts multiple variants:
- `userId` in body or URL
- `visitorId` in body or URL
- `X-Optimizely-Visitor-Id` header

### Error Handling

The router implements comprehensive error handling:

- 400 responses for missing required parameters
- 403 responses for unauthorized access
- 404 responses for unknown endpoints or resources
- 405 responses for unsupported HTTP methods
- 500 responses for internal errors
- Detailed error logging with the request ID

### Metrics Tracking

Extensive metrics are tracked for monitoring:
- Request counts
- Response counts by status code
- Error counts by type
- Request durations
- Datafile sizes and fetch/save durations

### Security Features

- Admin authorization for sensitive operations
- SDK key validation
- Safe header handling (PII protection)
- Request ID for traceability

## Key Insights

1. The `userId` parameter is required for all decision-related endpoints, which is why you received the "userId is required" error.

2. For `decide-all` endpoint, a missing SDK key would result in a 400 Bad Request with a specific error message.

3. The router only validates the presence of required parameters and delegates the actual decision-making to the Decision Service.

4. All API endpoints consistently follow the same pattern for parameter validation, request handling, and response formatting.

5. The implementation is designed to be compatible with the Optimizely SDK client expectations, including handling specific edge cases and format requirements.

