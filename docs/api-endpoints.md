# Optimizely Edge Agent API Documentation

This document provides details on the available API endpoints in the Optimizely Edge Agent.

## Base URL

All API endpoints are relative to your Edge Agent deployment URL:

```
https://[your-edge-agent-domain]/api/
```

## Authentication

Administrative endpoints require authentication using an admin token. Include this token in the `X-Admin-Token` header:

```
X-Admin-Token: your-admin-token
```

The admin token is configured when deploying the Edge Agent.

## Available Endpoints

### 1. Datafile Management

#### GET /api/datafile

Retrieves an Optimizely datafile for the specified SDK key.

**Query Parameters:**
- `sdkKey` (required): The Optimizely SDK key

**Example Request:**
```
GET /api/datafile?sdkKey=FsQSrZX4QJSbwgpJt9Fvs
```

**Success Response (200 OK):**
```json
{
  "version": "4",
  "rollouts": [],
  "anonymizeIP": true,
  "projectId": "15499260431",
  "variables": [],
  "featureFlags": [
    {
      "experimentIds": [],
      "rolloutId": "15527724675",
      "variables": [
        {
          "defaultValue": "default-value",
          "type": "string",
          "subType": null,
          "id": "15501264373"
        }
      ],
      "id": "15544850171",
      "key": "my_feature_flag"
    }
  ],
  "experiments": [],
  "audiences": [],
  "groups": [],
  "attributes": [],
  "botFiltering": true,
  "accountId": "15356250960",
  "events": [],
  "revision": "94"
}
```

**Error Response (404 Not Found):**
```json
{
  "error": "Datafile not found"
}
```

#### POST /api/datafile

Stores an Optimizely datafile for the specified SDK key. Requires admin authentication.

**Query Parameters:**
- `sdkKey` (required): The Optimizely SDK key

**Headers:**
- `Content-Type: application/json`
- `X-Admin-Token: your-admin-token`

**Example Request:**
```
POST /api/datafile?sdkKey=FsQSrZX4QJSbwgpJt9Fvs
Content-Type: application/json
X-Admin-Token: your-admin-token

{
  "version": "4",
  "rollouts": [],
  "anonymizeIP": true,
  "projectId": "15499260431",
  "featureFlags": [
    {
      "experimentIds": [],
      "id": "15544850171",
      "key": "my_feature_flag"
    }
  ],
  "revision": "95"
}
```

**Success Response (200 OK):**
```json
{
  "success": true
}
```

**Error Response (401 Unauthorized):**
```json
{
  "error": "Unauthorized"
}
```

### 2. Flag Keys Management

#### GET /api/flagkeys

Retrieves all flag keys for the specified SDK key.

**Query Parameters:**
- `sdkKey` (required): The Optimizely SDK key

**Example Request:**
```
GET /api/flagkeys?sdkKey=FsQSrZX4QJSbwgpJt9Fvs
```

**Success Response (200 OK):**
```json
{
  "flagKeys": ["my_feature_flag", "another_flag", "example_flag"]
}
```

**Error Response (404 Not Found):**
```json
{
  "error": "Flag keys not found"
}
```

#### POST /api/flagkeys

Stores flag keys for the specified SDK key. Requires admin authentication.

**Query Parameters:**
- `sdkKey` (required): The Optimizely SDK key

**Headers:**
- `Content-Type: application/json`
- `X-Admin-Token: your-admin-token`

**Example Request:**
```
POST /api/flagkeys?sdkKey=FsQSrZX4QJSbwgpJt9Fvs
Content-Type: application/json
X-Admin-Token: your-admin-token

{
  "flagKeys": ["my_feature_flag", "another_flag", "new_flag"]
}
```

**Success Response (200 OK):**
```json
{
  "success": true
}
```

**Error Response (401 Unauthorized):**
```json
{
  "error": "Unauthorized"
}
```

### 3. SDK Information

#### GET /api/sdk

Returns information about the Optimizely Edge Agent.

**Example Request:**
```
GET /api/sdk
```

**Success Response (200 OK):**
```json
{
  "name": "optimizely-edge-agent",
  "version": "2.0.0",
  "environment": "production",
  "cdnProvider": "cloudflare"
}
```

### 4. Admin Endpoints

#### GET /api/admin/status

Returns the current status of the Edge Agent. Requires admin authentication.

**Headers:**
- `X-Admin-Token: your-admin-token`

**Example Request:**
```
GET /api/admin/status
X-Admin-Token: your-admin-token
```

**Success Response (200 OK):**
```json
{
  "timestamp": "2023-04-06T12:34:56.789Z",
  "uptime": 3600,
  "version": "2.0.0",
  "environment": "production",
  "cdnProvider": "cloudflare"
}
```

**Error Response (403 Forbidden):**
```json
{
  "error": "Unauthorized"
}
```

#### POST /api/admin/cache/clear

Clears the Edge Agent cache. Requires admin authentication.

**Headers:**
- `X-Admin-Token: your-admin-token`

**Example Request:**
```
POST /api/admin/cache/clear
X-Admin-Token: your-admin-token
```

**Success Response (200 OK):**
```json
{
  "success": true
}
```

**Error Response (403 Forbidden):**
```json
{
  "error": "Unauthorized"
}
```

## Error Responses

The API returns standard HTTP status codes:

- `200 OK`: The request was successful
- `400 Bad Request`: The request was invalid or missing required parameters
- `401 Unauthorized`: Authentication failed
- `403 Forbidden`: The client does not have permission to access the resource
- `404 Not Found`: The requested resource was not found
- `405 Method Not Allowed`: The HTTP method is not supported for this endpoint
- `500 Internal Server Error`: An unexpected error occurred on the server

All error responses include a JSON body with an error message:

```json
{
  "error": "Error message"
}
```

## Rate Limiting

The API implements rate limiting to protect against abuse. Rate limits vary depending on the endpoint:

- Read operations (GET): 300 requests per minute
- Write operations (POST): 60 requests per minute
- Admin operations: 10 requests per minute

When rate limited, the API returns a `429 Too Many Requests` status code.

## Troubleshooting

Common issues and solutions:

1. **401 Unauthorized**: Verify your admin token is correctly set in the `X-Admin-Token` header.
2. **404 Not Found**: Confirm the SDK key is correct and that the datafile exists.
3. **429 Too Many Requests**: Implement exponential backoff in your client to handle rate limiting.

For additional support, please contact the Optimizely support team. 