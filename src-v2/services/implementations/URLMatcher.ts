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
    
    // DEBUG FLAG: Check for force-edge-mode query parameter
    try {
      let parsedUrl: URL;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        parsedUrl = new URL(`https://${url}`);
      } else {
        parsedUrl = new URL(url);
      }
      
      if (parsedUrl.searchParams.has('force-edge-mode')) {
        this.logger.debug('URLMatcher: DEBUG - force-edge-mode parameter detected, using first available CDN settings');
        
        // Find the first settings that has cdnExperimentURL or cdnResponseURL
        for (const settings of variationSettings) {
          if (settings.cdnExperimentURL || settings.cdnResponseURL) {
            this.logger.debug('URLMatcher: DEBUG - Using first available CDN settings', { settings });
            return {
              matched: true,
              settings
            };
          }
        }
      }
    } catch (e) {
      // If URL parsing fails, continue with normal matching
      this.logger.warn('URLMatcher: Failed to parse URL for debug flag check', { url, error: e });
    }
    
    // Loop through all settings to find a match
    for (const settings of variationSettings) {
      // Check if we have either cdnExperimentURL or pathRegex
      if (!settings.cdnExperimentURL && !settings.pathRegex) {
        this.logger.warn('URLMatcher: CDN variation settings missing both cdnExperimentURL and pathRegex', { settings });
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

    // DEVELOPMENT ENHANCEMENT: Check for development/local environments
    // If we're running on localhost/127.0.0.1, try path-only matching first
    const isDevelopment = this.isLocalDevelopment(parsedUrl);
    
    if (isDevelopment) {
      this.logger.debug('URLMatcher: Development environment detected, trying path-only matching', { 
        url: parsedUrl.toString(), 
        pattern 
      });
      
      // Try path-only matching for development
      const pathOnlyMatches = this.matchesPathOnly(url, pattern);
      if (pathOnlyMatches) {
        this.logger.debug('URLMatcher: Path-only match found in development mode', { 
          urlPath: parsedUrl.pathname, 
          pattern 
        });
        
        // Still check query params if required
        if (options.requiredQueryParams?.length || options.ignoreQueryParams?.length) {
          return this.matchesQueryParams(
            url, 
            options.requiredQueryParams, 
            options.ignoreQueryParams
          );
        }
        
        return true;
      }
    }

    // Otherwise, do both path and query parameter matching (original behavior)
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
      // Handle special wildcard patterns
      if (pathPattern === '/*') {
        // Match any path
        return true;
      } else if (pathPattern === '/') {
        // Match only homepage (root path)
        return urlPath === '/';
      } else if (pathPattern.endsWith('/*')) {
        // Match path prefix (e.g., "/products/*" matches "/products/123")
        const prefix = this.normalizePath(pathPattern.slice(0, -2)); // Remove /*
        return urlPath === prefix || urlPath.startsWith(prefix + '/');
      } else {
        // For non-wildcard patterns, do exact matching
        const normalizedPattern = this.normalizePath(pathPattern);
        return urlPath === normalizedPattern;
      }
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

    // Get all query parameters from the URL using forEach for Web Worker compatibility
    const urlParamNames: string[] = [];
    parsedUrl.searchParams.forEach((value: string, key: string) => {
      if (!ignoreParams.includes(key)) {
        urlParamNames.push(key);
      }
    });
    const urlParams = new Set(urlParamNames);

    // Check if all required parameters are present
    for (const param of requiredParams) {
      if (!parsedUrl.searchParams.has(param)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Checks if the URL is from a local development environment
   * @param parsedUrl The parsed URL object
   * @returns true if this is a local development environment
   */
  private isLocalDevelopment(parsedUrl: URL): boolean {
    const hostname = parsedUrl.hostname.toLowerCase();
    const port = parsedUrl.port;
    
    // Check for common local development hostnames
    const localHostnames = ['localhost', '127.0.0.1', '0.0.0.0'];
    const isLocalHostname = localHostnames.includes(hostname);
    
    // Check for common development ports
    const devPorts = ['3000', '3001', '5000', '8000', '8080', '8787', '9000'];
    const isDevPort = devPorts.includes(port) || port === '';
    
    return isLocalHostname && isDevPort;
  }

  /**
   * Performs path-only matching for development environments
   * Extracts the path from the pattern URL and compares it to the request path
   * @param url The request URL to match
   * @param pattern The pattern URL (may include full domain)
   * @returns true if the paths match
   */
  private matchesPathOnly(url: string, pattern: string): boolean {
    try {
      // Parse request URL
      let requestUrl: URL;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        requestUrl = new URL(`https://${url}`);
      } else {
        requestUrl = new URL(url);
      }
      
      // Parse pattern URL to extract path
      let patternPath: string;
      if (!pattern.startsWith('http://') && !pattern.startsWith('https://')) {
        // If pattern is just a path, use it directly
        if (pattern.startsWith('/')) {
          patternPath = pattern;
        } else {
          // If pattern doesn't start with /, treat as domain + path
          const patternUrl = new URL(`https://${pattern}`);
          patternPath = patternUrl.pathname;
        }
      } else {
        const patternUrl = new URL(pattern);
        patternPath = patternUrl.pathname;
      }
      
      const requestPath = this.normalizePath(requestUrl.pathname);
      
      // Handle wildcard patterns
      if (patternPath === '/*') {
        // Match any path
        this.logger.debug('URLMatcher: Wildcard /* matches all paths', { requestPath });
        return true;
      } else if (patternPath === '/') {
        // Match only homepage
        const matches = requestPath === '/';
        this.logger.debug('URLMatcher: Homepage pattern / matching', { requestPath, matches });
        return matches;
      } else if (patternPath.endsWith('/*')) {
        // Match path prefix
        const prefix = this.normalizePath(patternPath.slice(0, -2));
        const matches = requestPath === prefix || requestPath.startsWith(prefix + '/');
        this.logger.debug('URLMatcher: Prefix pattern matching', { 
          pattern: patternPath,
          prefix,
          requestPath, 
          matches 
        });
        return matches;
      } else {
        // Exact match
        const normalizedPattern = this.normalizePath(patternPath);
        const matches = requestPath === normalizedPattern;
        this.logger.debug('URLMatcher: Exact path matching', { 
          requestPath, 
          normalizedPattern,
          matches
        });
        return matches;
      }
    } catch (e) {
      this.logger.warn(`URLMatcher: Error in path-only matching: ${e}`);
      return false;
    }
  }
} 