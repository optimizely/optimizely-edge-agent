import { IRequestAdapter } from '../../adapters/interfaces/IRequestAdapter';
import { IResponseAdapter } from '../../adapters/interfaces/IResponseAdapter';
import { OptimizelyUserContext } from './IDecisionService';

/**
 * Interface representing CDN Variation Settings as defined in Optimizely projects.
 * This is a critical component for Edge Mode functionality.
 */
export interface CDNVariationSettings {
  /**
   * URL pattern to match against incoming requests
   */
  cdnExperimentURL?: string;
  
  /**
   * URL from which to fetch variation content
   */
  cdnResponseURL?: string;
  
  /**
   * Controls whether to forward requests to origin
   */
  forwardRequestToOrigin?: string | boolean;
  
  /**
   * Controls whether to cache responses
   */
  cacheRequestToOrigin?: string | boolean;
  
  /**
   * Identifier for caching (special value "VARIATION_KEY" or custom string)
   */
  cacheKey?: string;
  
  /**
   * Cache time-to-live in seconds
   */
  cacheTTL?: string;
  
  /**
   * Optional regex pattern for more complex URL matching
   */
  pathRegex?: string;
  
  /**
   * Whether to ignore query parameters in URL matching
   */
  ignoreQueryParams?: string;
  
  /**
   * Comma-separated list of required query parameters
   */
  requiredQueryParams?: string;
  
  /**
   * JSON string of additional headers to add to the response
   */
  responseHeaders?: string;
  
  /**
   * JavaScript function (as string) to transform the content
   */
  transformContent?: string;
  
  /**
   * Flag key that this variation setting is associated with (for traceability)
   */
  _flagKey?: string;
  
  /**
   * Variation key that this setting is associated with (for traceability)
   */
  _variationKey?: string;
  
  /**
   * Allow additional properties
   */
  [key: string]: any;
}

/**
 * Result of checking if a request should be handled by Edge Mode
 */
export interface ShouldHandleResult {
  /** Whether the request should be handled by Edge Mode */
  handle: boolean;
  
  /** If handle is false, the reason why not */
  reason?: string;
  
  /** If handle is true, the variation settings to use */
  variationSettings?: CDNVariationSettings[];
}

/**
 * Result of preparing content for a request
 */
export interface ContentPreparationResult {
  /** Whether to forward the request to origin */
  forwardToOrigin: boolean;
  
  /** Whether to use caching */
  useCache: boolean;
  
  /** Response content if not forwarding to origin */
  content?: string;
  
  /** Response headers */
  headers?: Record<string, string>;
  
  /** Response status code */
  status?: number;
}

/**
 * Interface for the Edge Mode Handler responsible for processing requests
 * in Edge Mode according to CDN Variation Settings.
 */
export interface IEdgeModeHandler {
  /**
   * Determines if a request should be handled in Edge Mode
   * 
   * @param request The incoming request
   * @param userContext The user context for decision making
   * @returns A promise resolving to the result indicating if the request should be handled
   */
  shouldHandleRequest(
    request: IRequestAdapter,
    userContext: OptimizelyUserContext
  ): Promise<ShouldHandleResult>;

  /**
   * Determines if a request should be handled by Edge Mode using pre-fetched decisions
   * 
   * @param request The request to check
   * @param userContext User context for decision making
   * @param decisions Pre-fetched decisions to use instead of making a new call
   * @returns Promise resolving to decision result with handle flag and reason
   */
  shouldHandleRequestWithDecisions(
    request: IRequestAdapter,
    userContext: OptimizelyUserContext,
    decisions: Record<string, any>
  ): Promise<ShouldHandleResult>;
  
  /**
   * Prepares content for a request based on CDN variation settings
   * 
   * @param settings The CDN variation settings to apply
   * @param userContext The user context for decision making
   * @param request The original request
   * @returns A promise resolving to the content preparation result
   */
  prepareContent(
    settings: CDNVariationSettings,
    userContext: OptimizelyUserContext,
    request: IRequestAdapter
  ): Promise<ContentPreparationResult>;
  
  /**
   * Processes a request in Edge Mode
   * 
   * @param request The incoming request
   * @param cdnVariationSettings The CDN variation settings to apply
   * @returns A promise resolving to a response
   */
  processRequest(
    request: IRequestAdapter,
    cdnVariationSettings: CDNVariationSettings
  ): Promise<IResponseAdapter>;
  
  /**
   * Finds the matching CDN variation settings for a request URL
   * 
   * @param url The URL to match
   * @param allCdnVariationSettings Array of all available CDN variation settings
   * @returns The matching CDN variation settings or null if no match
   */
  findMatchingConfig(
    url: string,
    allCdnVariationSettings: CDNVariationSettings[]
  ): CDNVariationSettings | null;
  
  /**
   * Fetches content from the CDN response URL
   * 
   * @param cdnResponseURL The URL to fetch content from
   * @param request The original request (for headers, etc.)
   * @returns A promise resolving to the fetched content
   */
  fetchContent(
    cdnResponseURL: string,
    request: IRequestAdapter
  ): Promise<IResponseAdapter>;
  
  /**
   * Transforms content based on the transformContent function in CDN variation settings
   * 
   * @param content The content to transform
   * @param transformFn The transformation function (as string)
   * @returns The transformed content
   */
  transformContent(
    content: string,
    transformFn: string
  ): Promise<string>;
  
  /**
   * Forwards a request to the origin server
   * 
   * @param request The original request
   * @param cdnVariationSettings The CDN variation settings
   * @returns A promise resolving to the origin response
   */
  forwardToOrigin(
    request: IRequestAdapter,
    cdnVariationSettings: CDNVariationSettings
  ): Promise<IResponseAdapter>;
} 