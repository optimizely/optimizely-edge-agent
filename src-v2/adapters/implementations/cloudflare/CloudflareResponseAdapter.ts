import { IResponseAdapter } from "../../interfaces/IResponseAdapter";
import { createFormattedResponse, isHtmlContent, fixContentTypeForHtml } from "../../../utils/responseUtils";

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
   * Sends a response body with proper content type detection.
   * @param content - The content to send.
   */
  send(content: string): void {
    this.responseBody = content;
    
    // Apply HTML content detection and fix Content-Type if needed
    if (isHtmlContent(content) && !this.headers.has("Content-Type")) {
      this.headers.set("Content-Type", "text/html; charset=utf-8");
    } else if (!this.headers.has("Content-Type")) {
      this.headers.set("Content-Type", "text/plain; charset=utf-8");
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
   * Creates and returns a Cloudflare Worker Response object using the original
   * AbstractResponse.js formatting pattern for proper content type handling.
   * @returns A Cloudflare Response.
   */
  toResponse(): Response {
    // Convert Headers to Record for the utility function
    const headersRecord: Record<string, string> = {};
    this.headers.forEach((value, key) => {
      headersRecord[key] = value;
    });
    
    // Use the utility that follows the original AbstractResponse.js pattern
    return createFormattedResponse(
      this.responseBody,
      this.statusCode,
      headersRecord,
      'application/json' // Default content type
    );
  }
} 