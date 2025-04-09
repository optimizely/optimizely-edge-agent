/**
 * @interface IRequestAdapter
 * @description Defines the contract for adapting incoming HTTP requests
 * from various environments (e.g., Cloudflare Workers, Node.js) into a standardized format.
 */
export interface IRequestAdapter {
  /**
   * Gets the HTTP method of the request (e.g., 'GET', 'POST').
   */
  getMethod(): string;

  /**
   * Gets the URL of the request.
   */
  getUrl(): URL;

  /**
   * Gets the value of a specific request header.
   * @param name - The name of the header (case-insensitive).
   * @returns The header value or null if not found.
   */
  getHeader(name: string): string | null;

  /**
   * Gets all request headers.
   * @returns A Headers object or equivalent representation.
   */
  getHeaders(): Headers; // Assuming standard Headers object

  /**
   * Gets the request body as text.
   * @returns A promise resolving to the body text.
   */
  getBodyText(): Promise<string>;

  /**
   * Gets the request body as JSON.
   * @typeParam T - The expected type of the JSON object.
   * @returns A promise resolving to the parsed JSON object.
   */
  getBodyJson<T>(): Promise<T>;
  
  /**
   * Gets the request body, attempting to automatically determine the format.
   * This is a convenience method that may try to parse as JSON if appropriate.
   * @returns A promise resolving to the body, which could be a string, object, or other formats.
   */
  getBody(): Promise<any>;

  /**
   * Gets the underlying native request object for environment-specific needs.
   * Use with caution to avoid breaking abstractions.
   * @returns The native request object (e.g., Cloudflare Request, Node http.IncomingMessage).
   */
  getNativeRequest<T = unknown>(): T;
} 