import { IResponseAdapter } from "../../interfaces/IResponseAdapter";

/**
 * Cloudflare-specific implementation of IResponseAdapter.
 * Provides a wrapper around Cloudflare Worker Response functionality.
 */
export class CloudflareResponseAdapter implements IResponseAdapter {
  private headers: Headers;
  private statusCode: number;
  private responseBody: string;

  constructor() {
    this.headers = new Headers();
    this.statusCode = 200; // Default status code
    this.responseBody = "";
  }

  /**
   * Sets a response header.
   * @param name - The name of the header.
   * @param value - The value of the header.
   */
  setHeader(name: string, value: string): void {
    this.headers.set(name, value);
  }

  /**
   * Gets all response headers.
   * @returns A Headers object.
   */
  getHeaders(): Headers {
    return this.headers;
  }

  /**
   * Sets the HTTP status code for the response.
   * @param code - The HTTP status code (e.g., 200, 404, 500).
   */
  status(code: number): void {
    this.statusCode = code;
  }

  /**
   * Gets the current HTTP status code.
   * @returns The HTTP status code.
   */
  getStatus(): number {
    return this.statusCode;
  }

  /**
   * Sends a response body as text/plain.
   * @param content - The content to send.
   */
  send(content: string): void {
    this.responseBody = content;
    // Set default Content-Type if not already set
    if (!this.headers.has("Content-Type")) {
      this.headers.set("Content-Type", "text/plain");
    }
  }

  /**
   * Gets the response body.
   * @returns The response body content.
   */
  getBody(): string {
    return this.responseBody;
  }

  /**
   * Sends a response as JSON. Sets the Content-Type header to application/json.
   * @param data - The data to send as JSON.
   */
  json(data: any): void {
    this.responseBody = JSON.stringify(data);
    this.headers.set("Content-Type", "application/json");
  }

  /**
   * Creates and returns a Cloudflare Worker Response object.
   * @returns A Cloudflare Response.
   */
  toResponse(): Response {
    return new Response(this.responseBody, {
      status: this.statusCode,
      headers: this.headers
    });
  }
} 