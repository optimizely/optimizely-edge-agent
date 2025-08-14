import { IRequestAdapter } from "../../interfaces/IRequestAdapter";

/**
 * Cloudflare-specific implementation of IRequestAdapter.
 * Wraps the standard Cloudflare Worker Request object.
 */
export class CloudflareRequestAdapter implements IRequestAdapter {
  private request: Request;

  constructor(request: Request) {
    if (!request) {
      throw new Error("Cloudflare Request object cannot be null or undefined.");
    }
    this.request = request;
  }

  getMethod(): string {
    return this.request.method;
  }

  getUrl(): URL {
    return new URL(this.request.url);
  }

  getHeader(name: string): string | null {
    return this.request.headers.get(name);
  }

  getHeaders(): Headers {
    return this.request.headers;
  }

  async getBodyText(): Promise<string> {
    // Cloudflare Request body can only be consumed once.
    // Cloning is necessary if the body needs to be read multiple times
    // (e.g., here and also later in the native request).
    // Consider optimizing if only needed once.
    try {
      return await this.request.clone().text();
    } catch (error) {
      // Handle cases where body might be empty or already consumed elsewhere
      console.error("Error reading request body as text:", error);
      return ""; // Or throw, depending on desired behavior
    }
  }

  async getBodyJson<T>(): Promise<T> {
    // Similar cloning consideration as getBodyText
    try {
      const text = await this.request.clone().text();
      if (!text || text.trim() === '') {
        // No body present, return empty object
        return {} as T;
      }
      return JSON.parse(text) as T;
    } catch (error) {
      console.error("Error reading request body as JSON:", error);
      throw new Error(`Failed to parse request body as JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Gets the request body, attempting to automatically determine the format based on content type.
   * If the content-type header suggests JSON, it will attempt to parse as JSON.
   * Otherwise, it will return the body as text.
   * @returns A promise resolving to the body in the most appropriate format.
   */
  async getBody(): Promise<any> {
    const contentType = this.getHeader('content-type');
    
    // If content type indicates JSON, try to parse as JSON
    if (contentType && contentType.includes('application/json')) {
      try {
        return await this.getBodyJson();
      } catch (error) {
        // If JSON parsing fails, fall back to text
        console.warn("Failed to parse JSON body despite content-type header. Falling back to text:", error);
        return await this.getBodyText();
      }
    }
    
    // For other content types, return as text
    return await this.getBodyText();
  }

  getNativeRequest<T = Request>(): T {
    // Type assertion might be needed depending on usage context
    return this.request as unknown as T;
  }
} 