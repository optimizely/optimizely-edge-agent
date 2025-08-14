import { IRequestAdapter } from '../../adapters/interfaces/IRequestAdapter';
import { IResponseAdapter } from '../../adapters/interfaces/IResponseAdapter';

/**
 * Options for forwarding a request
 */
export interface RequestForwardOptions {
  /**
   * Target URL to forward the request to
   */
  targetUrl: string;
  
  /**
   * HTTP method to use for the forwarded request
   * If not provided, the original request's method will be used
   */
  method?: string;
  
  /**
   * HTTP headers to include in the forwarded request
   * If not provided, the original request's headers will be used
   */
  headers?: Record<string, string>;
  
  /**
   * Whether to include the request body in the forwarded request
   * Default: true
   */
  includeBody?: boolean;
  
  /**
   * Whether to follow redirects
   * Default: true
   */
  followRedirects?: boolean;
  
  /**
   * Maximum number of redirects to follow
   * Default: 5
   */
  maxRedirects?: number;
  
  /**
   * Timeout in milliseconds for the forwarded request
   * Default: 30000 (30 seconds)
   */
  timeout?: number;
  
  /**
   * Whether to compress the request body
   * Default: false
   */
  compressBody?: boolean;
  
  /**
   * Headers to exclude from the forwarded request
   */
  excludeHeaders?: string[];
  
  /**
   * Headers to include in the forwarded request
   * If empty, all headers will be included except those in excludeHeaders
   */
  includeHeaders?: string[];
  
  /**
   * Additional query parameters to add to the URL
   */
  additionalQueryParams?: Record<string, string>;
  
  /**
   * Query parameters to remove from the URL
   */
  removeQueryParams?: string[];
}

/**
 * Result of a forwarded request
 */
export interface RequestForwardResult {
  /**
   * Original request that was forwarded
   */
  originalRequest: IRequestAdapter;
  
  /**
   * Target URL the request was forwarded to
   */
  targetUrl: string;
  
  /**
   * Whether the forwarding was successful
   */
  success: boolean;
  
  /**
   * If success is false, the error that occurred
   */
  error?: Error;
  
  /**
   * The response from the forwarded request
   */
  response?: IResponseAdapter;
  
  /**
   * The time it took to forward the request in milliseconds
   */
  timeTaken: number;
  
  /**
   * For requests with redirects, the chain of URLs that were followed
   */
  redirectChain?: string[];

  /**
   * Response body (for easy access)
   */
  body: string;

  /**
   * Response status code
   */
  status: number;

  /**
   * Response headers
   */
  headers: Record<string, string>;
}

/**
 * Interface for forwarding requests to other services
 */
export interface IRequestForwarder {
  /**
   * Forwards a request to another service
   * 
   * @param request The request to forward
   * @param options Options for forwarding the request, or null to use defaults
   * @returns Promise resolving to the result of the forwarded request
   */
  forwardRequest(
    request: IRequestAdapter,
    options: RequestForwardOptions | null
  ): Promise<RequestForwardResult>;
  
  /**
   * Forwards a request and applies the response to the original response
   * 
   * @param request The request to forward
   * @param response The response to apply the forwarded response to
   * @param options Options for forwarding the request
   * @returns Promise resolving to the result of the forwarded request
   */
  forwardRequestAndApplyResponse(
    request: IRequestAdapter,
    response: IResponseAdapter,
    options: RequestForwardOptions
  ): Promise<RequestForwardResult>;
  
  /**
   * Builds a URL for forwarding a request
   * 
   * @param originalUrl The original URL
   * @param targetUrl The target URL
   * @param options Options for building the URL
   * @returns The URL for forwarding the request
   */
  buildForwardUrl(
    originalUrl: string,
    targetUrl: string,
    options?: {
      additionalQueryParams?: Record<string, string>;
      removeQueryParams?: string[];
      preserveOriginalQueryParams?: boolean;
    }
  ): string;
} 