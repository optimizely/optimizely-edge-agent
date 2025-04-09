import { CDNVariationSettings } from './IEdgeModeHandler';

/**
 * Result of finding a matching URL pattern
 */
export interface URLMatchResult {
  /** Whether a match was found */
  matched: boolean;
  
  /** The matched CDN variation settings */
  settings: CDNVariationSettings;
}

/**
 * Interface for URL matching functionality, which is used to determine if a request URL
 * matches a pattern defined in cdnVariationSettings.
 */
export interface IURLMatcher {
  /**
   * Finds a matching CDN variation settings for a URL
   * 
   * @param url The URL to match
   * @param variationSettings Array of CDN variation settings to match against
   * @returns A promise resolving to the match result
   */
  findMatch(url: string, variationSettings: CDNVariationSettings[]): Promise<URLMatchResult>;
  
  /**
   * Determines whether a URL matches the given pattern
   * 
   * @param url The URL to check
   * @param pattern The pattern to match against (can be a regex string or URL string)
   * @param options Additional matching options
   * @returns boolean indicating whether the URL matches the pattern
   */
  matches(url: string, pattern: string, options?: URLMatchOptions): boolean;

  /**
   * Normalizes a URL path by removing trailing slashes and handling other edge cases
   * 
   * @param path The URL path to normalize
   * @returns The normalized path
   */
  normalizePath(path: string): string;

  /**
   * Checks if a URL matches based on its path, with optional regex support
   * 
   * @param url The URL to check
   * @param pathPattern The path pattern to match against
   * @param isRegex Whether the pattern is a regex pattern
   * @returns boolean indicating whether the URL path matches the pattern
   */
  matchesPath(url: string, pathPattern: string, isRegex?: boolean): boolean;

  /**
   * Checks if a URL matches query parameters based on required and ignored params
   * 
   * @param url The URL to check
   * @param requiredParams List of query parameters that must be present
   * @param ignoreParams List of query parameters to ignore during matching
   * @returns boolean indicating whether the URL matches the query parameter requirements
   */
  matchesQueryParams(url: string, requiredParams?: string[], ignoreParams?: string[]): boolean;
}

/**
 * Options for URL matching
 */
export interface URLMatchOptions {
  /** Whether to use regex for matching */
  isRegex?: boolean;
  
  /** Query parameters that must be present in the URL */
  requiredQueryParams?: string[];
  
  /** Query parameters to ignore during matching */
  ignoreQueryParams?: string[];
  
  /** Whether to ignore case when matching */
  ignoreCase?: boolean;
} 