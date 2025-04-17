/**
 * @fileoverview Response Normalization Framework
 * 
 * This module provides utilities for normalizing responses to enable
 * consistent comparison between local and live environments.
 * 
 * Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)
 */

/**
 * Normalizes responses for comparison between environments
 * @param {object} response - Response object to normalize
 * @param {object} options - Normalization options
 * @returns {object} Normalized response
 */
function normalizeResponse(response, options = {}) {
  if (!response) return response;
  
  const normalized = { ...response };
  const context = options.context || {};
  
  // Normalize headers
  if (normalized.headers) {
    normalized.headers = normalizeHeaders(normalized.headers, options);
  }
  
  // Normalize body
  if (normalized.body) {
    normalized.body = normalizeBody(normalized.body, options);
  }
  
  // Normalize status codes for known variations
  if (options.normalizeStatusCodes && context.isLiveEnvironment) {
    normalized.status = normalizeStatusCode(normalized.status, options);
  }
  
  return normalized;
}

/**
 * Normalizes response headers
 * @param {object} headers - Headers to normalize
 * @param {object} options - Normalization options
 * @returns {object} Normalized headers
 */
function normalizeHeaders(headers, options = {}) {
  const normalizedHeaders = { ...headers };
  
  // Remove Cloudflare-specific headers if requested
  if (options.removeCloudflareHeaders) {
    const cfHeaders = [
      'cf-ray', 'cf-cache-status', 'cf-worker', 'cf-edge-cache',
      'cf-request-id', 'cf-connecting-ip', 'cf-ipcountry'
    ];
    
    for (const header of cfHeaders) {
      delete normalizedHeaders[header];
    }
  }
  
  // Normalize cache-control headers if requested
  if (options.normalizeCacheHeaders) {
    // Normalize cache control headers
    if (normalizedHeaders['cache-control']) {
      // Simplified cache-control normalization logic
      normalizedHeaders['cache-control'] = normalizedHeaders['cache-control']
        .replace(/max-age=\d+/, 'max-age=XXX')
        .replace(/s-maxage=\d+/, 's-maxage=XXX');
    }
    
    // Normalize other cache-related headers
    if (normalizedHeaders['expires']) {
      normalizedHeaders['expires'] = 'NORMALIZED_DATE';
    }
    
    if (normalizedHeaders['last-modified']) {
      normalizedHeaders['last-modified'] = 'NORMALIZED_DATE';
    }
  }
  
  // Normalize header cases if requested
  if (options.normalizeHeaderCase) {
    const keys = Object.keys(normalizedHeaders);
    const lowerCaseHeaders = {};
    
    for (const key of keys) {
      lowerCaseHeaders[key.toLowerCase()] = normalizedHeaders[key];
    }
    
    return lowerCaseHeaders;
  }
  
  return normalizedHeaders;
}

/**
 * Normalizes response body
 * @param {any} body - Body to normalize
 * @param {object} options - Normalization options
 * @returns {any} Normalized body
 */
function normalizeBody(body, options = {}) {
  // Skip if no body or normalization not requested
  if (!body || !options.normalizeBody) {
    return body;
  }
  
  let normalizedBody = body;
  
  // Parse JSON strings if needed
  if (typeof body === 'string' && options.parseJsonBody) {
    try {
      normalizedBody = JSON.parse(body);
    } catch (e) {
      // Not JSON, keep as string
      return body;
    }
  }
  
  // If object, normalize properties
  if (typeof normalizedBody === 'object' && normalizedBody !== null) {
    // Handle arrays
    if (Array.isArray(normalizedBody)) {
      return normalizedBody.map(item => normalizeBody(item, options));
    }
    
    // Handle objects
    const result = { ...normalizedBody };
    
    // Remove timestamp fields if requested
    if (options.normalizeTimestamps) {
      const timestampFields = ['timestamp', 'created_at', 'updated_at', 'expires_at', 'date', 'time'];
      for (const field of timestampFields) {
        if (field in result) {
          result[field] = 'NORMALIZED_TIMESTAMP';
        }
      }
    }
    
    // Sort response keys for deterministic comparison if requested
    if (options.sortResponseKeys) {
      return sortObjectKeys(result);
    }
    
    // Normalize nested objects
    for (const [key, value] of Object.entries(result)) {
      if (typeof value === 'object' && value !== null) {
        result[key] = normalizeBody(value, options);
      }
    }
    
    return result;
  }
  
  return normalizedBody;
}

/**
 * Normalizes status codes for known variations
 * @param {number} statusCode - Original status code
 * @param {object} options - Normalization options
 * @returns {number} Normalized status code
 */
function normalizeStatusCode(statusCode, options = {}) {
  const statusMappings = options.statusMappings || {};
  
  // Apply custom mappings if provided
  if (statusCode in statusMappings) {
    return statusMappings[statusCode];
  }
  
  // Default mappings for common variations in live environment
  if (options.context?.isLiveEnvironment) {
    // Handle specific cases
    switch (statusCode) {
      case 520: return 500; // Cloudflare unknown error -> Internal server error
      case 524: return 504; // Cloudflare timeout -> Gateway timeout
      case 530: return 503; // Origin unavailable -> Service unavailable
      default: return statusCode;
    }
  }
  
  return statusCode;
}

/**
 * Sorts object keys for deterministic comparison
 * @param {object} obj - Object to sort keys
 * @returns {object} Object with sorted keys
 */
function sortObjectKeys(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }
  
  // Sort keys of object
  const sortedObj = {};
  const sortedKeys = Object.keys(obj).sort();
  
  for (const key of sortedKeys) {
    sortedObj[key] = typeof obj[key] === 'object' && obj[key] !== null
      ? sortObjectKeys(obj[key])
      : obj[key];
  }
  
  return sortedObj;
}

/**
 * Normalizes URL parameters for comparison
 * @param {string} url - URL to normalize
 * @param {object} options - Normalization options
 * @returns {string} Normalized URL
 */
function normalizeUrl(url, options = {}) {
  if (!url) return url;
  
  try {
    const parsedUrl = new URL(url);
    
    // Sort query parameters if requested
    if (options.sortQueryParameters) {
      const params = new URLSearchParams(parsedUrl.search);
      parsedUrl.search = new URLSearchParams(
        [...params.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      ).toString();
    }
    
    // Normalize hostname case
    if (options.normalizeHostCase) {
      parsedUrl.hostname = parsedUrl.hostname.toLowerCase();
    }
    
    return parsedUrl.toString();
  } catch (e) {
    // Not a valid URL, return as is
    return url;
  }
}

module.exports = {
  normalizeResponse,
  normalizeHeaders,
  normalizeBody,
  normalizeStatusCode,
  normalizeUrl,
  sortObjectKeys
}; 