import { IRequestAdapter } from "../../interfaces/IRequestAdapter";

/**
 * Vercel-specific implementation of IRequestAdapter.
 * Adapts Vercel's Request object to the common interface.
 */
export class VercelRequestAdapter implements IRequestAdapter {
  private request: Request;

  /**
   * Creates an instance of the adapter.
   * @param request - The Vercel Request object.
   */
  constructor(request: Request) {
    if (!request) {
      throw new Error("Vercel Request object cannot be null or undefined.");
    }
    this.request = request;
  }

  getMethod(): string {
    return this.request.method;
  }

  getUrl(): URL {
    // The URL constructor will throw if the URL is invalid
    try {
      // For Vercel Edge Functions, we need to construct a URL from request.url
      return new URL(this.request.url);
    } catch (error) {
      console.error('Error parsing URL from Vercel request:', error);
      throw new Error(`Invalid URL in request: ${this.request.url}`);
    }
  }

  getHeader(name: string): string | null {
    return this.request.headers.get(name);
  }

  getHeaders(): Headers {
    return this.request.headers;
  }

  async getBodyText(): Promise<string> {
    try {
      // Clone the request to avoid consuming the body stream
      const clonedRequest = this.request.clone();
      return await clonedRequest.text();
    } catch (error) {
      console.error('Error getting request body as text:', error);
      throw error;
    }
  }

  async getBodyJson<T>(): Promise<T> {
    try {
      // Clone the request to avoid consuming the body stream
      const clonedRequest = this.request.clone();
      return await clonedRequest.json() as T;
    } catch (error) {
      console.error('Error getting request body as JSON:', error);
      throw error;
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
    return this.request as unknown as T;
  }
} 