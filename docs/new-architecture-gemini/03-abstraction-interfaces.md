---
type: "documentation"
purpose: "architecture-abstractions"
category: "Architecture Proposal"
version: "1.0.0"
status: "Draft"
description: "Defines the interfaces for the abstraction layer in the proposed Optimizely Edge Agent re-architecture."
planId: "rearch-opti-edge-agent-001"
dateCreated: "[Current Date]" # Please replace with the actual date
lastUpdated: "[Current Date]" # Please replace with the actual date
related_files: ["../plan.md", "01-principles.md", "02-components.md"]
---

# Proposed Abstraction Layer Interfaces

**Plan ID:** `rearch-opti-edge-agent-001`

## 1. Introduction

This document defines the TypeScript interfaces for the abstraction layer proposed in the re-architecture plan (`plan.md`, section 7). These interfaces decouple the core application logic from specific CDN environment implementations, promoting modularity, testability, and maintainability.

Core application components will depend on these interfaces, which will be implemented by environment-specific adapters (e.g., `CloudflareRequestAdapter`, `CloudflareKVAdapter`).

*(Note: Type definitions like `HeadersInit`, `RequestInit`, `Response`, `URL` generally refer to standard Web API types available in most edge environments. Specific implementation details might vary slightly.)*

## 2. Environment Adapter Interface

Provides access to environment-specific functionalities.

```typescript
interface IEnvironmentAdapter {
    /**
     * Retrieves the value of an environment variable.
     * @param name The name of the environment variable.
     * @returns The value of the variable or undefined if not found.
     */
    getVariable(name: string): string | undefined;

    /**
     * Allows asynchronous tasks (like event dispatching or KV writes)
     * to complete even after the main response has been sent.
     * This typically maps to ctx.waitUntil in Cloudflare.
     * @param promise The promise representing the asynchronous task.
     */
    waitUntil(promise: Promise<any>): void;

    // Potentially add other environment-specific methods as needed
}
```

## 3. Request Adapter Interface

Standardizes access to incoming request details.

```typescript
interface IRequestAdapter {
    /**
     * Gets the original, underlying request object (use sparingly).
     */
    readonly originalRequest: Request;

    /**
     * Gets the full URL of the request.
     */
    getUrl(): URL;

    /**
     * Gets the HTTP method (e.g., 'GET', 'POST').
     */
    getMethod(): string;

    /**
     * Gets a specific request header value.
     * @param name Header name (case-insensitive).
     * @returns Header value or null if not found.
     */
    getHeader(name: string): string | null;

    /**
     * Gets all request headers.
     */
    getHeaders(): Headers;

    /**
     * Gets a specific cookie value from the request headers.
     * @param name Cookie name.
     * @returns Cookie value or null if not found.
     */
    getCookie(name: string): string | null;

    /**
     * Gets the request body, parsed as JSON if possible, otherwise as text or ArrayBuffer.
     * Handles different content types.
     * @returns Parsed body or null if no body.
     */
    getBody(): Promise<any | null>;

    /**
     * Gets the client's IP address, if available from the environment.
     */
    getIP(): string | undefined;

    /**
     * Creates a new Request object, potentially cloning the original with modifications.
     * Useful for forwarding requests.
     * @param url Optional new URL string or URL object.
     * @param options Optional RequestInit options (e.g., headers, method, body).
     */
    clone(url?: string | URL, options?: RequestInit): Request;
}
```

## 4. Response Adapter Interface

Abstracts the creation and modification of outgoing responses.

```typescript
interface IResponseAdapter {
    /**
     * Creates a new Response object.
     * @param body Response body (string, Buffer, stream, etc.). Defaults to null.
     * @param status HTTP status code. Defaults to 200.
     * @param headers Response headers (Headers object or HeadersInit). Defaults to { 'Content-Type': 'text/plain' }.
     * @returns A Response object.
     */
    create(body?: BodyInit | null, status?: number, headers?: HeadersInit): Response;

    /**
     * Sets a header on a Response object. Creates a clone if modifying an immutable response.
     * @param response The Response object.
     * @param name Header name.
     * @param value Header value.
     * @returns The potentially modified Response object.
     */
    setHeader(response: Response, name: string, value: string): Response;

    /**
     * Appends a 'Set-Cookie' header to a Response object. Creates a clone if modifying an immutable response.
     * @param response The Response object.
     * @param cookieString The full string for the Set-Cookie header.
     * @returns The potentially modified Response object.
     */
    appendCookie(response: Response, cookieString: string): Response;

    /**
     * Gets a specific response header value.
     * @param response The Response object.
     * @param name Header name (case-insensitive).
     * @returns Header value or null if not found.
     */
    getHeader(response: Response, name: string): string | null;

    /**
     * Gets all response headers.
     * @param response The Response object.
     */
    getHeaders(response: Response): Headers;
}
```

## 5. KV Store Adapter Interface

Defines the contract for Key-Value store interactions.

```typescript
interface IKVStoreAdapter {
    /**
     * Retrieves a value from the KV store.
     * @param key The key to retrieve.
     * @returns The string value, or null if the key is not found.
     */
    get(key: string): Promise<string | null>;

    /**
     * Stores a value in the KV store.
     * @param key The key to store the value under.
     * @param value The string value to store.
     * @param options Optional settings, e.g., TTL.
     */
    put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;

    /**
     * Deletes a key-value pair from the store.
     * @param key The key to delete.
     */
    delete(key: string): Promise<void>;
}
```

## 6. Cache Adapter Interface

Abstracts interactions with the edge cache.

```typescript
interface ICacheAdapter {
    /**
     * Attempts to find a Response in the cache matching the request.
     * @param request The Request object or URL string to match.
     * @param options Optional cache matching options.
     * @returns The cached Response or undefined if not found.
     */
    match(request: Request | string, options?: CacheQueryOptions): Promise<Response | undefined>;

    /**
     * Stores a Response in the cache.
     * @param request The Request object or URL string used as the cache key.
     * @param response The Response object to cache. Must be cloneable.
     * @param options Optional cache storage options (like waitUntil). Note: TTL might be handled via Response headers or KV options depending on implementation.
     */
    put(request: Request | string, response: Response): Promise<void>;

    /**
     * Removes a Response from the cache.
     * @param request The Request object or URL string to remove.
     * @param options Optional cache deletion options.
     * @returns True if an entry was deleted, false otherwise.
     */
    delete(request: Request | string, options?: CacheQueryOptions): Promise<boolean>;
}
```

## 7. Event Dispatcher Adapter Interface

Abstracts the mechanism for dispatching events asynchronously.

```typescript
interface IEventDispatcherAdapter {
    /**
     * Dispatches an event payload, typically asynchronously without blocking the main response.
     * Often involves making an HTTP POST request.
     * @param eventData The data/payload for the event.
     * @param targetUrl The URL endpoint to send the event to.
     */
    dispatchEvent(eventData: any, targetUrl: string): Promise<void>;
}
```

## 8. Implementation Notes

-   Implementations of these interfaces (e.g., `CloudflareRequestAdapter`) will reside in environment-specific directories (e.g., `src/adapters/cloudflare/`).
-   Core logic modules will receive instances of these interfaces via dependency injection.
-   Error handling within adapter implementations should be robust, logging errors and potentially throwing specific error types that the core logic can handle or surface. 