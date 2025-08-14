Certainly! Here is a **prescriptive, technical implementation plan guide** for robust cache management and admin cache clearing in your Optimizely Edge Agent system. This guide is structured to be used as a TDD (Technical Design Document) or as a direct input for an implementation plan, and is written to minimize ambiguity and creative interpretation.

---

# Implementation Plan Guide: Robust Cache Management & Admin Cache Clearing

## 1. **Background & Current State**

- The system currently caches **Optimizely datafiles** and **flag keys** per SDK key, both **in-memory** and in **persistent KV storage**.
- The default TTL (Time-To-Live) for both caches is **1 hour (3600 seconds)**, hardcoded in the codebase.
- The `/api/admin/cache/clear` endpoint currently:
  - Does **not** accept any parameters.
  - Does **not** actually clear any cache (only logs the request).
  - Does **not** support scoping (e.g., by SDK key, flag key, or variation).
  - Does **not** clear CDN/Cloudflare cache.
- There is **no way to configure the TTL** for datafile or flag keys cache via environment variable or config file.

---

## 2. **Objectives**

- **Make cache TTLs configurable** via environment variables.
- **Implement robust, parameterized cache clearing** via the `/api/admin/cache/clear` endpoint.
- **Support scoping** for cache clearing (global, per SDK key, per flag key, per variation).
- **Add support for clearing CDN/Cloudflare cache** if required.
- **Ensure all actions are logged and auditable.**
- **Return detailed responses** indicating what was cleared.
- **Minimize creative interpretation**: All requirements and steps are explicit.

---

## 3. **Required Improvements**

### 3.1. **Configurable TTLs**
- **Add environment variables** for cache TTLs:
  - `DATAFILE_CACHE_TTL_SECONDS` (default: 3600)
  - `FLAGKEYS_CACHE_TTL_SECONDS` (default: 3600)
- **Update DatafileService and related code** to:
  - Read TTL values from environment variables at startup.
  - Use these values as the default TTL for both in-memory and KV caches.
  - If the environment variable is not set, fall back to the current default (1 hour).

### 3.2. **Admin Cache Clear Endpoint Enhancements**
- **Accept the following parameters** (via query string or JSON body):
  - `scope` (string, required): `"all"`, `"sdkKey"`, `"flagKey"`, `"variation"`
  - `sdkKey` (string, optional): Required if `scope` is `"sdkKey"`, `"flagKey"`, or `"variation"`
  - `flagKey` (string, optional): Required if `scope` is `"flagKey"` or `"variation"`
  - `variationKey` (string, optional): Required if `scope` is `"variation"`
  - `cacheType` (string, optional): `"memory"`, `"kv"`, `"cdn"`, or `"all"` (default: `"all"`)
- **Validate parameters** and return 400 if required parameters are missing for the selected scope.

### 3.3. **Cache Clearing Logic**
- **For each cache layer (memory, KV, CDN):**
  - **Memory:**  
    - Use `clearMemoryCache()` for global clear.
    - For scoped clear, remove only relevant entries from the in-memory maps.
  - **KV:**  
    - For global clear, delete all relevant keys (e.g., all `datafile:*` and `flagkeys:*`).
    - For scoped clear, delete only the relevant keys (e.g., `datafile:{sdkKey}`, `flagkeys:{sdkKey}`).
  - **CDN/Cloudflare:**  
    - If `cacheType` includes `"cdn"`, use the Cloudflare Worker API or Cloudflare REST API to purge cache by URL, tag, or prefix as appropriate.
    - Only implement if required by the deployment environment.

### 3.4. **Logging & Auditing**
- **Log every cache clear request** with:
  - Timestamp
  - Requesting user/admin (if available)
  - Parameters received
  - Actions taken (which caches, which keys, which scope)
  - Result (success/failure, errors)

### 3.5. **Response Structure**
- **Return a JSON response** with:
  - `success` (boolean)
  - `cleared` (array of objects, each with `cacheType`, `scope`, `keysCleared`)
  - `errors` (array, if any)
  - `message` (string, summary)

### 3.6. **Testing**
- **Add unit and integration tests** for:
  - All parameter combinations and error cases.
  - Each cache layer and scope.
  - TTL configuration via environment variable.
  - CDN cache clearing (if implemented).

---

## 4. **Prescriptive Implementation Steps**

### 4.1. **Configurable TTLs**
1. In `DatafileService.ts` and any related cache code:
   - At service initialization, read `process.env.DATAFILE_CACHE_TTL_SECONDS` and `process.env.FLAGKEYS_CACHE_TTL_SECONDS`.
   - Use these values as the default TTL for all cache operations.
   - Update all usages of `DEFAULT_DATAFILE_TTL` and `DEFAULT_FLAGKEYS_TTL` to use the environment variable value if set.

### 4.2. **Admin Endpoint Parameter Handling**
2. In `ApiRouter.ts` (or equivalent):
   - Parse parameters from the request (support both query string and JSON body).
   - Validate parameters according to the rules above.
   - If parameters are missing or invalid, return a 400 error with a clear message.

### 4.3. **Cache Clearing Logic**
3. For each cache type:
   - **Memory:**  
     - If `scope` is `"all"`, call `clearMemoryCache()`.
     - If `scope` is `"sdkKey"`, remove only the relevant SDK key from the in-memory maps.
     - If `scope` is `"flagKey"` or `"variation"`, remove only the relevant flag/variation from the in-memory maps.
   - **KV:**  
     - If `scope` is `"all"`, delete all `datafile:*` and `flagkeys:*` keys.
     - If `scope` is `"sdkKey"`, delete only `datafile:{sdkKey}` and `flagkeys:{sdkKey}`.
     - If `scope` is `"flagKey"` or `"variation"`, delete only the relevant keys.
   - **CDN:**  
     - If `cacheType` includes `"cdn"`, call the appropriate Cloudflare API to purge cache for the relevant URLs or tags.

### 4.4. **Logging**
4. Log all actions as described above.

### 4.5. **Response**
5. Build and return a detailed JSON response as described above.

### 4.6. **Testing**
6. Write tests for all new logic, including TTL configuration, parameter validation, and cache clearing.

---

## 5. **Explicit Non-Goals**
- Do **not** allow creative interpretation of scoping or parameter handling. All logic must follow the rules above.
- Do **not** implement partial or "best effort" cache clearing—if a scope is not supported, return an error.
- Do **not** change the cache key structure unless explicitly required.

---

## 6. **Documentation**
- Update all relevant documentation to describe:
  - The new environment variables for TTL.
  - The parameters and behavior of the `/api/admin/cache/clear` endpoint.
  - The logging and auditing approach.

---

## 7. **Sample API Usage**

**Request:**
```http
POST /api/admin/cache/clear
Content-Type: application/json
Authorization: Bearer [admin-token]

{
  "scope": "sdkKey",
  "sdkKey": "abc123",
  "cacheType": "all"
}
```

**Response:**
```json
{
  "success": true,
  "cleared": [
    { "cacheType": "memory", "scope": "sdkKey", "keysCleared": ["datafile:abc123", "flagkeys:abc123"] },
    { "cacheType": "kv", "scope": "sdkKey", "keysCleared": ["datafile:abc123", "flagkeys:abc123"] }
  ],
  "errors": [],
  "message": "Cleared memory and KV cache for sdkKey abc123"
}
```

---

## 8. **Checklist for Implementation Plan Creation**

- [ ] TTLs for datafile and flag keys are configurable via environment variables.
- [ ] `/api/admin/cache/clear` accepts and validates all required parameters.
- [ ] Cache clearing logic supports all required scopes and cache types.
- [ ] CDN cache clearing is supported if required.
- [ ] All actions are logged and auditable.
- [ ] Responses are detailed and informative.
- [ ] All new logic is fully tested.
- [ ] Documentation is updated.

