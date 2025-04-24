import { IURLMatcher, URLMatchOptions, URLMatchResult } from '../interfaces/IURLMatcher';
import { CDNVariationSettings } from '../interfaces/IEdgeModeHandler';
import { ILoggerAdapter } from '../../adapters/interfaces/ILoggerAdapter';

/**
 * Implementation of the URLMatcher service used to match URLs in Edge Mode.
 * This is a critical component for the cdnVariationSettings functionality.
 */
export class URLMatcher implements IURLMatcher {
  private logger: ILoggerAdapter;

  /**
   * Creates a new URLMatcher instance
   * @param logger The logger adapter to use
   */
  constructor(logger: ILoggerAdapter) {
    this.logger = logger;
  }

  /**
   * Finds a matching CDN variation settings for a URL
   * 
   * @param url The URL to match
   * @param variationSettings Array of CDN variation settings to match against
   * @returns A promise resolving to the match result
   */
  public async findMatch(url: string, variationSettings: CDNVariationSettings[]): Promise<URLMatchResult> {
    this.logger.debug('URLMatcher: Finding matching variation settings for URL', { url });
    
    // Default result with no match
    const noMatchResult: URLMatchResult = {
      matched: false,
      settings: {} as CDNVariationSettings // Using empty object with type assertion as a fallback
    };
    
    // No settings, no match
    if (!variationSettings || variationSettings.length === 0) {
      this.logger.debug('URLMatcher: No variation settings provided');
      return noMatchResult;
    }
    
    // Loop through all settings to find a match
    for (const settings of variationSettings) {
      if (!settings.cdnExperimentURL) {
        this.logger.warn('URLMatcher: CDN variation settings missing cdnExperimentURL', { settings });
        continue;
      }
      
      const isRegex = !!settings.pathRegex;
      const pattern = isRegex ? settings.pathRegex : settings.cdnExperimentURL;
      
      // If no pattern, skip
      if (!pattern) {
        this.logger.warn('URLMatcher: Invalid URL pattern', { settings });
        continue;
      }
      
      // Check if URL matches the pattern with the given options
      const matches = this.matches(url, pattern, {
        isRegex,
        requiredQueryParams: settings.requiredQueryParams ? settings.requiredQueryParams.split(',').map(p => p.trim()) : undefined,
        ignoreQueryParams: settings.ignoreQueryParams ? settings.ignoreQueryParams.split(',').map(p => p.trim()) : undefined
      });
      
      if (matches) {
        this.logger.debug('URLMatcher: Found matching settings', { 
          url, 
          pattern,
          isRegex
        });
        return {
          matched: true,
          settings
        };
      }
    }
    
    this.logger.debug('URLMatcher: No matching settings found for URL', { url });
    return noMatchResult;
  }

  /**
   * Determines whether a URL matches the given pattern with the specified options
   */
  public matches(url: string, pattern: string, options: URLMatchOptions = {}): boolean {
    // Parse the URL to work with its components
    let parsedUrl: URL;
    try {
      // Add protocol if not present to make URL parsing work
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        parsedUrl = new URL(`https://${url}`);
      } else {
        parsedUrl = new URL(url);
      }
    } catch (e) {
      console.error(`URLMatcher: Invalid URL "${url}": ${e}`);
      return false;
    }

    // If it's a regex pattern, handle differently
    if (options.isRegex) {
      return this.matchesRegexPattern(url, pattern, options.ignoreCase);
    }

    // Otherwise, do both path and query parameter matching
    const pathMatches = this.matchesPath(url, pattern, options.isRegex);
    if (!pathMatches) {
      return false;
    }

    // If we have query param requirements, check those too
    if (options.requiredQueryParams?.length || options.ignoreQueryParams?.length) {
      return this.matchesQueryParams(
        url, 
        options.requiredQueryParams, 
        options.ignoreQueryParams
      );
    }

    return true;
  }

  /**
   * Normalizes a URL path by removing trailing slashes and handling other edge cases
   */
  public normalizePath(path: string): string {
    // Handle empty path
    if (!path) {
      return '/';
    }

    // Ensure path starts with /
    let normalized = path.startsWith('/') ? path : `/${path}`;
    
    // Remove trailing slash unless it's just the root path
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    
    // Remove query string if present
    const queryIndex = normalized.indexOf('?');
    if (queryIndex !== -1) {
      normalized = normalized.substring(0, queryIndex);
    }
    
    return normalized;
  }

  /**
   * Checks if a URL matches based on its path, with optional regex support
   */
  public matchesPath(url: string, pathPattern: string, isRegex = false): boolean {
    let parsedUrl: URL;
    try {
      // Add protocol if not present to make URL parsing work
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        parsedUrl = new URL(`https://${url}`);
      } else {
        parsedUrl = new URL(url);
      }
    } catch (e) {
      console.error(`URLMatcher: Invalid URL "${url}": ${e}`);
      return false;
    }

    const urlPath = this.normalizePath(parsedUrl.pathname);
    
    if (isRegex) {
      try {
        const regex = new RegExp(pathPattern);
        return regex.test(urlPath);
      } catch (e) {
        console.error(`URLMatcher: Invalid regex pattern "${pathPattern}": ${e}`);
        return false;
      }
    } else {
      // For non-regex matching, normalize the pattern as well
      const normalizedPattern = this.normalizePath(pathPattern);
      return urlPath === normalizedPattern;
    }
  }

  /**
   * Checks if a URL matches a regex pattern
   */
  private matchesRegexPattern(url: string, pattern: string, ignoreCase = false): boolean {
    try {
      const flags = ignoreCase ? 'i' : '';
      const regex = new RegExp(pattern, flags);
      return regex.test(url);
    } catch (e) {
      console.error(`URLMatcher: Invalid regex pattern "${pattern}": ${e}`);
      return false;
    }
  }

  /**
   * Checks if a URL matches query parameters based on required and ignored params
   */
  public matchesQueryParams(
    url: string, 
    requiredParams: string[] = [], 
    ignoreParams: string[] = []
  ): boolean {
    let parsedUrl: URL;
    try {
      // Add protocol if not present to make URL parsing work
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        parsedUrl = new URL(`https://${url}`);
      } else {
        parsedUrl = new URL(url);
      }
    } catch (e) {
      console.error(`URLMatcher: Invalid URL "${url}": ${e}`);
      return false;
    }

    // Get all query parameters from the URL
    const urlParams = new Set(
      Array.from(parsedUrl.searchParams.keys())
        .filter(param => !ignoreParams.includes(param))
    );

    // Check if all required parameters are present
    for (const param of requiredParams) {
      if (!parsedUrl.searchParams.has(param)) {
        return false;
      }
    }

    return true;
  }
} 