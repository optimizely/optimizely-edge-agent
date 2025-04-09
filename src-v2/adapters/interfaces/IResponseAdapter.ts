/**
 * @interface IResponseAdapter
 * @description Defines the contract for adapting HTTP responses
 * across various environments (e.g., Cloudflare Workers, Node.js).
 */
export interface IResponseAdapter {
  /**
   * Sets a response header.
   * @param name - The name of the header.
   * @param value - The value of the header.
   */
  setHeader(name: string, value: string): void;

  /**
   * Gets all response headers.
   * @returns A Headers object or equivalent representation.
   */
  getHeaders(): Headers;

  /**
   * Sets the HTTP status code for the response.
   * @param code - The HTTP status code (e.g., 200, 404, 500).
   */
  status(code: number): void;

  /**
   * Gets the current HTTP status code.
   * @returns The HTTP status code.
   */
  getStatus(): number;

  /**
   * Sends a response body as text/plain.
   * @param content - The content to send.
   */
  send(content: string): void;

  /**
   * Gets the response body.
   * @returns The response body content.
   */
  getBody(): string;

  /**
   * Sends a response as JSON. Sets the Content-Type header to application/json.
   * @param data - The data to send as JSON.
   */
  json(data: any): void;
} 