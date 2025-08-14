/**
 * Cookie Utilities
 * 
 * This module provides utilities for parsing, creating, and managing cookies
 * to match the original Edge Agent implementation's cookie handling functionality.
 */

/**
 * Cookie options interface defining the possible options for a cookie
 */
export interface CookieOptions {
  path?: string;
  domain?: string;
  maxAge?: number;
  expires?: Date;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'Lax' | 'Strict' | 'None';
}

/**
 * Cookie interface for representing a cookie with name, value and options
 */
export interface Cookie {
  name: string;
  value: string;
  opts?: CookieOptions;
}

/**
 * Parses a cookie string from a request header into an object
 * where each property is a cookie name and its value is the cookie's value.
 * 
 * @param str - The cookie header string from an HTTP request.
 * @returns An object representing parsed cookies.
 */
export function parseCookie(str: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  
  if (!str) {
    return parsed;
  }
  
  str.split(';').forEach((cookie) => {
    const parts = cookie.match(/(.*?)=(.*)$/);
    if (!parts) {
      return;
    }
    
    const key = parts[1].trim();
    const value = parts[2] || '';
    
    if (key === '') {
      return;
    }
    
    parsed[key] = decodeURIComponent(value.trim());
  });
  
  return parsed;
}

/**
 * Creates a cookie string with the specified name, value, and options.
 * 
 * @param name - The name of the cookie.
 * @param value - The value of the cookie.
 * @param options - Additional cookie options such as path, maxAge, domain, etc.
 * @returns The cookie string for use in a Set-Cookie header.
 */
export function createCookie(name: string, value: string, options: CookieOptions = {}): string {
  if (!name) {
    throw new Error('Cookie name is required');
  }
  
  let cookie = `${name}=${encodeURIComponent(value)}`;
  
  if (options.path) {
    cookie += `; Path=${options.path}`;
  }
  
  if (options.domain) {
    cookie += `; Domain=${options.domain}`;
  }
  
  if (options.maxAge !== undefined && options.maxAge >= 0) {
    cookie += `; Max-Age=${options.maxAge}`;
  }
  
  if (options.expires) {
    cookie += `; Expires=${options.expires.toUTCString()}`;
  }
  
  if (options.secure) {
    cookie += '; Secure';
  }
  
  if (options.httpOnly) {
    cookie += '; HttpOnly';
  }
  
  if (options.sameSite) {
    cookie += `; SameSite=${options.sameSite}`;
  }
  
  return cookie;
}

/**
 * Creates a Set-Cookie header value for each cookie in an array
 * 
 * @param cookies - An array of Cookie objects
 * @returns An array of Set-Cookie header values
 */
export function createSetCookieHeader(cookies: Cookie[]): string[] {
  return cookies.map(cookie => createCookie(cookie.name, cookie.value, cookie.opts));
}

/**
 * Serializes cookie decisions for storage in a cookie using compact format.
 * Matches v1 implementation: flagKey:variationKey:ruleKey joined with &
 * 
 * @param decisions - The decisions object to serialize
 * @returns The serialized decisions string (URL-encoded)
 */
export function serializeDecisions(decisions: Record<string, any>): string {
  // Use compact format like v1: flagKey:variationKey:ruleKey joined with &
  const compactArray: string[] = [];
  
  for (const [flagKey, decision] of Object.entries(decisions)) {
    // Skip invalid or disabled decisions
    if (!decision || typeof decision !== 'object') continue;
    
    // For Edge Mode (GET requests), only include enabled flags with valid variations
    // This matches v1 behavior in getSerializedArray()
    if (decision.enabled === false) continue;
    
    // Only include decisions that have a variation key
    if (!decision.variationKey) continue;
    
    // Skip rollout decisions for GET requests (matching v1 behavior)
    if (decision.ruleKey && decision.ruleKey.includes('-rollout-')) continue;
    
    // Build compact format: flagKey:variationKey:ruleKey
    const ruleKey = decision.ruleKey || '';
    compactArray.push(`${flagKey}:${decision.variationKey}:${ruleKey}`);
  }
  
  // Join with & delimiter - no base64 encoding, just return the plain string
  // URL encoding will be handled by createCookie() when setting the cookie value
  return compactArray.join('&');
}

/**
 * Deserializes cookie decisions from a cookie value.
 * Handles both new compact format and legacy JSON format for backwards compatibility.
 * 
 * @param serializedValue - The serialized decisions string
 * @returns The deserialized decisions object, or null if invalid
 */
export function deserializeDecisions(serializedValue: string): Record<string, any> | null {
  try {
    // First decode from URL encoding (handled by browser/parseCookie automatically)
    let decoded = decodeURIComponent(serializedValue);
    
    // Check if it's JSON (legacy format)
    if (decoded.startsWith('{') || decoded.startsWith('[')) {
      // Legacy JSON format
      return JSON.parse(decoded);
    }
    
    // Check for base64 encoded legacy format (for backwards compatibility)
    try {
      const base64Decoded = atob(decoded);
      if (base64Decoded.startsWith('{') || base64Decoded.startsWith('[')) {
        return JSON.parse(base64Decoded);
      }
      // Could be base64 encoded compact format from older version
      decoded = base64Decoded;
    } catch {
      // Not base64, continue with decoded value
    }
    
    // New compact format: flagKey:variationKey:ruleKey&flagKey2:variationKey2:ruleKey2
    const decisions: Record<string, any> = {};
    const items = decoded.split('&');
    
    for (const item of items) {
      const parts = item.split(':');
      if (parts.length >= 2) {
        const [flagKey, variationKey, ruleKey = ''] = parts;
        decisions[flagKey] = {
          flagKey,
          variationKey,
          ruleKey,
          enabled: true // Compact format only stores enabled flags
        };
      }
    }
    
    return Object.keys(decisions).length > 0 ? decisions : null;
  } catch (error) {
    return null;
  }
}

/**
 * Creates an Optimizely decisions cookie with proper formatting
 * 
 * @param cookieDecisions - The decisions to store in the cookie
 * @param options - Cookie options like TTL, domain, security
 * @returns The Cookie object for the decisions
 */
export function createDecisionsCookie(
  cookieDecisions: Record<string, any>, 
  options: {
    cookieName?: string;
    ttl?: number;
    domain?: string;
    secure?: boolean;
    path?: string;
  } = {}
): Cookie {
  const {
    cookieName = 'optly_edge_decisions',
    ttl = 600, // 10 minutes default
    domain,
    secure = false,
    path = '/'
  } = options;
  
  const cookieOptions: CookieOptions = {
    path,
    maxAge: ttl
  };
  
  if (domain) {
    cookieOptions.domain = domain;
  }
  
  if (secure) {
    cookieOptions.secure = true;
  }
  
  return {
    name: cookieName,
    value: serializeDecisions(cookieDecisions),
    opts: cookieOptions
  };
}

/**
 * Creates a visitor ID cookie with proper formatting
 * 
 * @param visitorId - The visitor ID to store
 * @param options - Cookie options like TTL, domain, security
 * @returns The Cookie object for the visitor ID
 */
export function createVisitorIdCookie(
  visitorId: string,
  options: {
    cookieName?: string;
    ttl?: number;
    domain?: string;
    secure?: boolean;
    path?: string;
  } = {}
): Cookie {
  const {
    cookieName = 'optly_edge_visitor_id',
    ttl = 86400 * 365, // 1 year default
    domain,
    secure = false,
    path = '/'
  } = options;
  
  const cookieOptions: CookieOptions = {
    path,
    maxAge: ttl
  };
  
  if (domain) {
    cookieOptions.domain = domain;
  }
  
  if (secure) {
    cookieOptions.secure = true;
  }
  
  return {
    name: cookieName,
    value: visitorId,
    opts: cookieOptions
  };
} 