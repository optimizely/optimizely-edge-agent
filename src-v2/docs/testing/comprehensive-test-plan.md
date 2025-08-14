# Comprehensive Test Plan for Optimizely Edge Agent

This document outlines a comprehensive test plan focusing specifically on headers, query parameters, and JSON payload testing for the Optimizely Edge Agent. The plan includes detailed test cases to ensure all aspects of the API are properly validated.

## Parameter Definition Reference

### Request Headers

| Header | Purpose | Required | Applies To |
|--------|---------|----------|------------|
| `X-Optimizely-SDK-Key` | Identifies the Optimizely project | Yes | All endpoints |
| `X-Optimizely-Flag-Key` | Specifies the feature flag | Yes (for decisions) | `/decide` |
| `X-Optimizely-User-Id` | Identifies the user | Yes | All endpoints |
| `X-Optimizely-Event-Key` | Identifies the tracking event | Yes (for tracking) | `/track`, `/track.gif` |
| `X-Optimizely-Attributes` | User attributes as JSON | No | All endpoints |
| `Content-Type` | Format of the request body | No | All POST endpoints |
| `Accept` | Format of the response | No | All endpoints |
| `X-Optimizely-Client-Name` | SDK client name | No | All endpoints |
| `X-Optimizely-Client-Version` | SDK client version | No | All endpoints |

### Query Parameters

| Parameter | Purpose | Required | Applies To |
|-----------|---------|----------|------------|
| `sdkKey` | Identifies the Optimizely project | Yes | All endpoints |
| `flagKey` | Specifies the feature flag | Yes (for decisions) | `/decide` |
| `userId` | Identifies the user | Yes | All endpoints |
| `eventKey` | Identifies the tracking event | Yes (for tracking) | `/track`, `/track.gif` |
| `attributes` | User attributes as encoded JSON | No | All endpoints |
| `visitor_id` | Alternative user identifier | No | All endpoints |
| `value` | Event value for conversion events | No | `/track`, `/track.gif` |
| `include_reasons` | Include variation reasons | No | `/decide` |
| `exclude_variables` | Exclude flag variables | No | `/decide` |
| `enabled_flags_only` | Only return enabled flags | No | `/decide-all` |

### JSON Payload Fields

| Field | Purpose | Required | Applies To |
|-------|---------|----------|------------|
| `sdkKey` | Identifies the Optimizely project | Yes | All endpoints |
| `flagKey` | Specifies the feature flag | Yes (for decisions) | `/decide` |
| `flagKeys` | List of feature flags | Yes | `/decide-for-keys` |
| `user` | User object with ID and attributes | Yes | All endpoints |
| `user.id` | User identifier | Yes | All endpoints |
| `user.attributes` | User attributes object | No | All endpoints |
| `eventKey` | Identifies the tracking event | Yes (for tracking) | `/track` |
| `eventTags` | Additional event metadata | No | `/track` |
| `options` | Decision options | No | `/decide`, `/decide-all` |
| `events` | Array of events for batch tracking | Yes | `/track-events` |

## Test Plan by Endpoint

### 1. `/decide` Endpoint

#### 1.1 Header-based Testing

| Test ID | Description | Headers | Expected Result |
|---------|-------------|---------|----------------|
| D-H-01 | Basic header-only decision | `X-Optimizely-SDK-Key`, `X-Optimizely-Flag-Key`, `X-Optimizely-User-Id` | 200 OK with valid decision |
| D-H-02 | Header with attributes JSON | All basic headers + `X-Optimizely-Attributes: {"location":"US"}` | 200 OK with targeted decision |
| D-H-03 | Missing SDK Key header | `X-Optimizely-Flag-Key`, `X-Optimizely-User-Id` | 400 Bad Request |
| D-H-04 | Missing Flag Key header | `X-Optimizely-SDK-Key`, `X-Optimizely-User-Id` | 400 Bad Request |
| D-H-05 | Missing User ID header | `X-Optimizely-SDK-Key`, `X-Optimizely-Flag-Key` | 400 Bad Request |
| D-H-06 | Invalid SDK Key header | `X-Optimizely-SDK-Key: "invalid-key"`, other valid headers | 404 Not Found |
| D-H-07 | Invalid Flag Key header | `X-Optimizely-Flag-Key: "non-existent-flag"`, other valid headers | 404 Not Found |
| D-H-08 | Custom client info headers | Add `X-Optimizely-Client-Name: "edge-test"`, `X-Optimizely-Client-Version: "1.0.0"` | 200 OK with valid decision |

#### 1.2 Query Parameter Testing

| Test ID | Description | Query Parameters | Expected Result |
|---------|-------------|-----------------|----------------|
| D-Q-01 | Basic query parameter decision | `?sdkKey=key&flagKey=flag&userId=user1` | 200 OK with valid decision |
| D-Q-02 | Query with attributes | `?sdkKey=key&flagKey=flag&userId=user1&attributes={"country":"UK"}` | 200 OK with targeted decision |
| D-Q-03 | Missing SDK Key parameter | `?flagKey=flag&userId=user1` | 400 Bad Request |
| D-Q-04 | Missing Flag Key parameter | `?sdkKey=key&userId=user1` | 400 Bad Request |
| D-Q-05 | Missing User ID parameter | `?sdkKey=key&flagKey=flag` | 400 Bad Request |
| D-Q-06 | Invalid SDK Key parameter | `?sdkKey=invalid-key&flagKey=flag&userId=user1` | 404 Not Found |
| D-Q-07 | Include reasons parameter | `?sdkKey=key&flagKey=flag&userId=user1&include_reasons=true` | 200 OK with reasons included |
| D-Q-08 | Exclude variables parameter | `?sdkKey=key&flagKey=flag&userId=user1&exclude_variables=true` | 200 OK without variables |
| D-Q-09 | Using visitor_id instead of userId | `?sdkKey=key&flagKey=flag&visitor_id=visitor1` | 200 OK with valid decision |
| D-Q-10 | Malformed attributes JSON | `?sdkKey=key&flagKey=flag&userId=user1&attributes={invalid}` | 400 Bad Request |

#### 1.3 JSON Payload Testing

| Test ID | Description | Payload | Expected Result |
|---------|-------------|---------|----------------|
| D-J-01 | Basic JSON decision | `{"sdkKey": "key", "flagKey": "flag", "user": {"id": "user1"}}` | 200 OK with valid decision |
| D-J-02 | Full user attributes | `{"sdkKey": "key", "flagKey": "flag", "user": {"id": "user1", "attributes": {"country": "DE", "premium": true}}}` | 200 OK with targeted decision |
| D-J-03 | Missing SDK Key | `{"flagKey": "flag", "user": {"id": "user1"}}` | 400 Bad Request |
| D-J-04 | Missing Flag Key | `{"sdkKey": "key", "user": {"id": "user1"}}` | 400 Bad Request |
| D-J-05 | Missing User ID | `{"sdkKey": "key", "flagKey": "flag", "user": {}}` | 400 Bad Request |
| D-J-06 | Decision options | `{"sdkKey": "key", "flagKey": "flag", "user": {"id": "user1"}, "options": ["INCLUDE_REASONS"]}` | 200 OK with reasons included |
| D-J-07 | Multiple decision options | `{"sdkKey": "key", "flagKey": "flag", "user": {"id": "user1"}, "options": ["INCLUDE_REASONS", "EXCLUDE_VARIABLES"]}` | 200 OK with reasons, no variables |
| D-J-08 | Invalid JSON format | Malformed JSON | 400 Bad Request |
| D-J-09 | Empty user attributes | `{"sdkKey": "key", "flagKey": "flag", "user": {"id": "user1", "attributes": {}}}` | 200 OK with default decision |
| D-J-10 | Complex user attributes | `{"sdkKey": "key", "flagKey": "flag", "user": {"id": "user1", "attributes": {"device": {"type": "mobile", "os": "iOS"}, "location": {"country": "US", "city": "SF"}}}}` | 200 OK with targeted decision |

#### 1.4 Mixed Method Testing

| Test ID | Description | Request Type | Expected Result |
|---------|-------------|--------------|----------------|
| D-M-01 | Header takes precedence over query params | Headers: `X-Optimizely-Flag-Key: "header-flag"` + Query: `?flagKey=query-flag` (other params valid) | Decision for "header-flag" |
| D-M-02 | Header takes precedence over body | Headers: `X-Optimizely-User-Id: "header-user"` + Body: `{"userId": "body-user"}` (other fields valid) | Decision for "header-user" |
| D-M-03 | Query takes precedence over body | Query: `?sdkKey=query-key` + Body: `{"sdkKey": "body-key"}` (other fields valid) | Use "query-key" for SDK |
| D-M-04 | Attributes combined from all sources | Headers with some attrs + Query with some attrs + Body with some attrs | Combined attributes used |
| D-M-05 | Missing required param from all sources | No SDK key in any source | 400 Bad Request |

### 2. `/track` Endpoint

#### 2.1 Header-based Tracking

| Test ID | Description | Headers | Expected Result |
|---------|-------------|---------|----------------|
| T-H-01 | Basic header-only tracking | `X-Optimizely-SDK-Key`, `X-Optimizely-Event-Key`, `X-Optimizely-User-Id` | 200 OK |
| T-H-02 | Header with attributes | All basic headers + `X-Optimizely-Attributes: {"purchase_amount":99.99}` | 200 OK |
| T-H-03 | Missing SDK Key header | `X-Optimizely-Event-Key`, `X-Optimizely-User-Id` | 400 Bad Request |
| T-H-04 | Missing Event Key header | `X-Optimizely-SDK-Key`, `X-Optimizely-User-Id` | 400 Bad Request |
| T-H-05 | Missing User ID header | `X-Optimizely-SDK-Key`, `X-Optimizely-Event-Key` | 400 Bad Request |
| T-H-06 | Multiple custom headers | Add `X-Optimizely-Value: "99.99"`, `X-Optimizely-Currency: "USD"` | 200 OK |

#### 2.2 Query Parameter Tracking

| Test ID | Description | Query Parameters | Expected Result |
|---------|-------------|-----------------|----------------|
| T-Q-01 | Basic query parameter tracking | `?sdkKey=key&eventKey=event&userId=user1` | 200 OK |
| T-Q-02 | Query with event value | `?sdkKey=key&eventKey=event&userId=user1&value=99.99` | 200 OK |
| T-Q-03 | Query with event attributes | `?sdkKey=key&eventKey=event&userId=user1&attributes={"currency":"USD"}` | 200 OK |
| T-Q-04 | Missing SDK Key parameter | `?eventKey=event&userId=user1` | 400 Bad Request |
| T-Q-05 | Missing Event Key parameter | `?sdkKey=key&userId=user1` | 400 Bad Request |
| T-Q-06 | Missing User ID parameter | `?sdkKey=key&eventKey=event` | 400 Bad Request |
| T-Q-07 | Using visitor_id instead of userId | `?sdkKey=key&eventKey=event&visitor_id=visitor1` | 200 OK |
| T-Q-08 | Revenue event with value | `?sdkKey=key&eventKey=purchase&userId=user1&value=199.99` | 200 OK |
| T-Q-09 | Multiple event tags | `?sdkKey=key&eventKey=event&userId=user1&value=99.99&currency=USD&quantity=2` | 200 OK |

#### 2.3 JSON Payload Tracking

| Test ID | Description | Payload | Expected Result |
|---------|-------------|---------|----------------|
| T-J-01 | Basic JSON tracking | `{"sdkKey": "key", "eventKey": "event", "user": {"id": "user1"}}` | 200 OK |
| T-J-02 | With event tags | `{"sdkKey": "key", "eventKey": "event", "user": {"id": "user1"}, "eventTags": {"value": 99.99}}` | 200 OK |
| T-J-03 | With user attributes | `{"sdkKey": "key", "eventKey": "event", "user": {"id": "user1", "attributes": {"premium": true}}}` | 200 OK |
| T-J-04 | Missing SDK Key | `{"eventKey": "event", "user": {"id": "user1"}}` | 400 Bad Request |
| T-J-05 | Missing Event Key | `{"sdkKey": "key", "user": {"id": "user1"}}` | 400 Bad Request |
| T-J-06 | Missing User ID | `{"sdkKey": "key", "eventKey": "event", "user": {}}` | 400 Bad Request |
| T-J-07 | Complex event tags | `{"sdkKey": "key", "eventKey": "purchase", "user": {"id": "user1"}, "eventTags": {"revenue": 99.99, "currency": "USD", "items": [{"id": "SKU123", "price": 49.99, "quantity": 2}]}}` | 200 OK |
| T-J-08 | Invalid event tags format | `{"sdkKey": "key", "eventKey": "event", "user": {"id": "user1"}, "eventTags": "invalid"}` | 400 Bad Request |

### 3. `/track.gif` Endpoint (Pixel Tracking)

#### 3.1 Query Parameter Pixel Tracking

| Test ID | Description | Query Parameters | Expected Result |
|---------|-------------|-----------------|----------------|
| P-Q-01 | Basic pixel tracking | `?sdkKey=key&eventKey=event&userId=user1` | 200 OK with 1x1 transparent GIF |
| P-Q-02 | With event value | `?sdkKey=key&eventKey=event&userId=user1&value=99.99` | 200 OK with 1x1 transparent GIF |
| P-Q-03 | With attributes | `?sdkKey=key&eventKey=event&userId=user1&attributes={"premium":true}` | 200 OK with 1x1 transparent GIF |
| P-Q-04 | Missing SDK Key | `?eventKey=event&userId=user1` | 400 Bad Request or 1x1 GIF (implementation dependent) |
| P-Q-05 | Missing Event Key | `?sdkKey=key&userId=user1` | 400 Bad Request or 1x1 GIF (implementation dependent) |
| P-Q-06 | Missing User ID | `?sdkKey=key&eventKey=event` | 400 Bad Request or 1x1 GIF (implementation dependent) |
| P-Q-07 | Using visitor_id instead | `?sdkKey=key&eventKey=event&visitor_id=visitor1` | 200 OK with 1x1 transparent GIF |
| P-Q-08 | Complete conversion tracking | `?sdkKey=key&eventKey=purchase&userId=user1&value=99.99&currency=USD` | 200 OK with 1x1 transparent GIF |

### 4. `/decide-for-keys` Endpoint

#### 4.1 JSON Payload Multiple Decisions

| Test ID | Description | Payload | Expected Result |
|---------|-------------|---------|----------------|
| MF-J-01 | Basic multiple flags | `{"sdkKey": "key", "flagKeys": ["flag1", "flag2"], "user": {"id": "user1"}}` | 200 OK with decisions object |
| MF-J-02 | With user attributes | `{"sdkKey": "key", "flagKeys": ["flag1", "flag2"], "user": {"id": "user1", "attributes": {"country": "US"}}}` | 200 OK with targeted decisions |
| MF-J-03 | With decision options | `{"sdkKey": "key", "flagKeys": ["flag1", "flag2"], "user": {"id": "user1"}, "options": ["INCLUDE_REASONS"]}` | 200 OK with reasons included |
| MF-J-04 | Missing SDK Key | `{"flagKeys": ["flag1", "flag2"], "user": {"id": "user1"}}` | 400 Bad Request |
| MF-J-05 | Missing Flag Keys array | `{"sdkKey": "key", "user": {"id": "user1"}}` | 400 Bad Request |
| MF-J-06 | Empty Flag Keys array | `{"sdkKey": "key", "flagKeys": [], "user": {"id": "user1"}}` | 200 OK with empty decisions object |
| MF-J-07 | Invalid flags in array | `{"sdkKey": "key", "flagKeys": ["non-existent-flag"], "user": {"id": "user1"}}` | 200 OK with null decision for that flag |
| MF-J-08 | Mix of valid and invalid flags | `{"sdkKey": "key", "flagKeys": ["valid-flag", "non-existent-flag"], "user": {"id": "user1"}}` | 200 OK with mixed results |

#### 4.2 Header and Query Parameter Tests

| Test ID | Description | Request Type | Expected Result |
|---------|-------------|--------------|----------------|
| MF-M-01 | Multiple flag keys in query string | Query: `?sdkKey=key&flagKeys=flag1,flag2&userId=user1` | 200 OK or 400 Bad Request (implementation dependent) |
| MF-M-02 | Header-based multiple flags | Headers with multiple `X-Optimizely-Flag-Key` headers | 200 OK or 400 Bad Request (implementation dependent) |

### 5. CDN Variation Settings Tests

#### 5.1 Edge Mode Request Tests

| Test ID | Description | Request Type | Expected Result |
|---------|-------------|--------------|----------------|
| E-01 | Basic URL match | GET request to a URL matching CDN Variation Settings | CDN variation content |
| E-02 | URL with required query params | GET with all required query params present | CDN variation content |
| E-03 | URL with missing required query param | GET with some required query params missing | 404 Not Found |
| E-04 | URL with ignored query params | GET with query params that should be ignored | CDN variation content |
| E-05 | Response headers | Successful edge mode request | Response with `X-Optimizely-Variation`, `X-Optimizely-Flag`, `X-Optimizely-Visitor-Id` headers |
| E-06 | Variation with targeting | GET request with visitor that matches audience rules | Targeted variation content |
| E-07 | Caching | Repeated GET requests with same user | `X-Optimizely-Cache: HIT` for cached responses |

## Test Matrix - Combinations of Parameters and Methods

| ID | Headers | Query Params | JSON Body | Endpoint | Expected |
|----|---------|--------------|-----------|----------|----------|
| C-01 | SDK Key | Flag Key, User ID | None | `/decide` | Header SDK Key takes precedence |
| C-02 | None | SDK Key | Event Key, User ID | `/track` | Valid tracking with query SDK Key |
| C-03 | All required | All required (different) | None | `/decide` | Headers take precedence |
| C-04 | User attributes | Additional attributes | User with attributes | `/decide` | Attributes merged with precedence order |
| C-05 | All required values | None | Same required values | `/track` | Headers take precedence |
| C-06 | None | None | All valid values | `/decide-for-keys` | Valid response using body values |
| C-07 | Partial required values | Remaining required values | None | `/decide` | Valid response using combined values |

## Realistic User Flows

| Flow ID | Description | Request Sequence | Expected Results |
|---------|-------------|------------------|------------------|
| F-01 | Complete user journey | 1. GET EdgeMode request for page<br>2. POST `/decide` for dynamic components<br>3. GET `/track.gif` for page view<br>4. POST `/track` for conversion | All requests succeed and metrics recorded |
| F-02 | Silent tracking flow | 1. GET EdgeMode request with visitor ID<br>2. Image pixel with `/track.gif`<br>3. GET to URL with query params that match | Tracking works without JSON payloads |
| F-03 | Headers-only flow | Series of requests using only headers for auth and IDs | All requests succeed |
| F-04 | Query parameters flow | Series of requests using only query params | All requests succeed |
| F-05 | Mixed parameter flow | Combination of headers, query params, and JSON across requests | All requests succeed with correct precedence | 