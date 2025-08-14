/**
 * Response utilities that implement the same content detection and formatting logic
 * as the original AbstractResponse.js implementation.
 */

/**
 * Creates a properly formatted response following the original AbstractResponse.js pattern.
 * This ensures proper content type detection and body formatting.
 * 
 * @param body - The response body content
 * @param status - The HTTP status code (default: 200)
 * @param headers - The response headers (default: {})
 * @param contentType - The default content type if not in headers (default: 'application/json')
 * @returns A properly formatted Response object
 */
export function createFormattedResponse(
  body: any, 
  status: number = 200, 
  headers: Record<string, string | string[]> = {}, 
  contentType: string = 'application/json'
): Response {
  // Ensure headers is a valid object (matching original logic)
  if (!headers || typeof headers !== 'object') {
    headers = {};
  }

  // Step 1: Detect content type based on body content if not already set
  if (!headers['Content-Type'] && !headers['content-type']) {
    // If body looks like HTML, set HTML content type
    if (typeof body === 'string') {
      const trimmedContent = body.trim().toLowerCase();
      const isHtmlContent = trimmedContent.startsWith('<!doctype html') || 
                           trimmedContent.startsWith('<html') ||
                           trimmedContent.includes('<html>') ||
                           trimmedContent.includes('<html ');
      
      if (isHtmlContent) {
        headers['Content-Type'] = 'text/html; charset=utf-8';
      } else {
        headers['Content-Type'] = contentType;
      }
    } else {
      headers['Content-Type'] = contentType;
    }
  }

  // Step 2: Format the response body based on content type (matching original logic)
  let responseBody: string;
  const finalContentType = headers['Content-Type'] || headers['content-type'] || contentType;
  
  if (finalContentType.includes('application/json')) {
    responseBody = JSON.stringify(body);
  } else if (finalContentType.includes('text/plain') || finalContentType.includes('text/html')) {
    responseBody = String(body); // Use String() instead of toString() to handle null/undefined
  } else {
    responseBody = body; // For other content types, use the body as is
  }

  // Step 3: Create the Response object with properly formatted content
  // Special handling for Set-Cookie headers - they must be added via append()
  const responseHeaders = new Headers();
  
  // Add all headers, with special handling for Set-Cookie
  Object.entries(headers).forEach(([name, value]) => {
    if (name.toLowerCase() === 'set-cookie') {
      // Set-Cookie needs special handling - each cookie must be appended separately
      if (Array.isArray(value)) {
        // If it's an array, append each cookie separately
        value.forEach(cookie => {
          if (cookie) {
            responseHeaders.append('Set-Cookie', String(cookie));
          }
        });
      } else if (typeof value === 'string') {
        // If it's a string, check if it contains multiple cookies separated by newlines
        const cookies = value.split('\n');
        cookies.forEach(cookie => {
          if (cookie && cookie.trim()) {
            responseHeaders.append('Set-Cookie', cookie.trim());
          }
        });
      }
    } else {
      // For all other headers, just set them normally
      responseHeaders.set(name, String(value));
    }
  });
  
  return new Response(responseBody, {
    status: status,
    headers: responseHeaders
  });
}

/**
 * Detects if content is HTML based on common HTML patterns.
 * @param content - The content to analyze
 * @returns True if content appears to be HTML
 */
export function isHtmlContent(content: string): boolean {
  if (!content || typeof content !== 'string') {
    return false;
  }
  
  const trimmedContent = content.trim().toLowerCase();
  return trimmedContent.startsWith('<!doctype html') || 
         trimmedContent.startsWith('<html') ||
         trimmedContent.includes('<html>') ||
         trimmedContent.includes('<html ') ||
         trimmedContent.includes('<body') ||
         trimmedContent.includes('<head');
}

/**
 * Fixes Content-Type header for HTML content if it's incorrectly set.
 * @param content - The response content
 * @param headers - The current headers
 * @returns Updated headers with correct Content-Type
 */
export function fixContentTypeForHtml(content: string, headers: Record<string, string | string[]>): Record<string, string | string[]> {
  const updatedHeaders = { ...headers };
  
  if (isHtmlContent(content)) {
    const currentContentType = updatedHeaders['Content-Type'] || updatedHeaders['content-type'];
    if (!currentContentType || !currentContentType.includes('text/html')) {
      updatedHeaders['Content-Type'] = 'text/html; charset=utf-8';
      // Remove lowercase variant if it exists
      delete updatedHeaders['content-type'];
    }
  }
  
  return updatedHeaders;
}