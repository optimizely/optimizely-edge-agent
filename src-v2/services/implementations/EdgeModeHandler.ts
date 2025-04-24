import { IRequestAdapter } from '../../adapters/interfaces/IRequestAdapter';
import { IResponseAdapter } from '../../adapters/interfaces/IResponseAdapter';
import { ILoggerAdapter } from '../../adapters/interfaces/ILoggerAdapter';
import { ICacheService } from '../interfaces/ICacheService';
import { CDNVariationSettings, IEdgeModeHandler, ContentPreparationResult, ShouldHandleResult } from '../interfaces/IEdgeModeHandler';
import { URLMatcher } from './URLMatcher';
import { 
  OptimizelyUserContext, 
  IDecisionService, 
  OptimizelyDecision 
} from '../interfaces/IDecisionService';
import { IConfigurationService } from '../interfaces/IConfigurationService';

/**
 * Factory function to create a response adapter based on the request
 * This is needed since the IRequestAdapter doesn't have createResponse method
 */
type ResponseAdapterFactory = (request: IRequestAdapter) => IResponseAdapter;

/**
 * Helper function to safely convert string or boolean to boolean
 * 
 * @param value Value to convert
 * @returns boolean result
 */
function isTrue(value: string | boolean | undefined): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return false;
}

/**
 * Implementation of the Edge Mode Handler responsible for processing requests
 * in Edge Mode according to CDN Variation Settings.
 */
export class EdgeModeHandler implements IEdgeModeHandler {
  private urlMatcher: URLMatcher;
  private logger: ILoggerAdapter;
  private cacheService: ICacheService;
  private createResponseAdapter: ResponseAdapterFactory;
  private readonly logPrefix = '[EdgeModeHandler]';
  private decisionService: IDecisionService;
  private configService: IConfigurationService;
  
  // Metrics counters for monitoring
  private metrics = {
    decisionsProcessed: 0,
    edgeModeEligible: 0,
    cdnContentFetched: 0,
    cdnCacheHits: 0,
    cdnCacheMisses: 0,
    originRequestsForwarded: 0,
    contentTransformed: 0,
    errors: 0,
    flagActivations: {} as Record<string, number>,
    variationActivations: {} as Record<string, Record<string, number>>,
    processingTimes: {
      decisions: [] as number[],
      urlMatching: [] as number[],
      contentFetching: [] as number[],
      transformation: [] as number[]
    }
  };
  
  /**
   * Creates a new instance of EdgeModeHandler
   * 
   * @param logger Logger adapter
   * @param cacheService Cache service for storing responses
   * @param createResponseAdapter Factory function to create response adapters
   * @param decisionService Decision service for fetching feature flag decisions
   */
  constructor(
    logger: ILoggerAdapter, 
    cacheService: ICacheService,
    createResponseAdapter: ResponseAdapterFactory,
    decisionService: IDecisionService,
    configService: IConfigurationService
  ) {
    this.logger = logger;
    this.urlMatcher = new URLMatcher(logger);
    this.cacheService = cacheService;
    this.createResponseAdapter = createResponseAdapter;
    this.decisionService = decisionService;
    this.configService = configService;
  }
  
  /**
   * Validates CDN variation settings for required properties and proper formatting
   * 
   * @param settings CDN variation settings to validate
   * @param flagKey Flag key for logging/context
   * @returns Validated settings object with defaults applied where appropriate
   */
  private validateCdnVariationSettings(
    settings: CDNVariationSettings,
    flagKey: string
  ): { isValid: boolean; settings: CDNVariationSettings; issues: string[] } {
    const issues: string[] = [];
    const safeSettings = { ...settings };
    
    // Validate URL patterns (at least one must be present)
    if (!safeSettings.cdnExperimentURL && !safeSettings.pathRegex) {
      issues.push('Missing both cdnExperimentURL and pathRegex - at least one URL pattern is required');
    }
    
    // Validate content source (at least one must be present)
    if (!safeSettings.cdnResponseURL && !isTrue(safeSettings.forwardRequestToOrigin)) {
      issues.push('Missing both cdnResponseURL and forwardRequestToOrigin=true - no content source specified');
    }
    
    // Validate cacheTTL if present
    if (safeSettings.cacheTTL !== undefined) {
      // If it's a string, try to parse it as a number to validate it, but keep as string
      if (typeof safeSettings.cacheTTL === 'string') {
        const parsedTTL = parseInt(safeSettings.cacheTTL, 10);
        if (isNaN(parsedTTL)) {
          issues.push(`Invalid cacheTTL value '${safeSettings.cacheTTL}' - must be a number`);
          // No default assignment, will use service default
        }
        // Keep the original string value, no need to reassign
      } else if (typeof safeSettings.cacheTTL !== 'number') {
        issues.push(`Invalid cacheTTL type ${typeof safeSettings.cacheTTL} - must be a number or numeric string`);
        // No default assignment, will use service default
      } else {
        // If it's a number, convert to string to match expected type
        safeSettings.cacheTTL = String(safeSettings.cacheTTL);
      }
    }
    
    // Validate responseHeaders if present
    if (safeSettings.responseHeaders !== undefined && typeof safeSettings.responseHeaders === 'string') {
      try {
        // Attempt to parse, but only to validate - keep original string for later processing
        JSON.parse(safeSettings.responseHeaders);
      } catch (e) {
        issues.push(`Invalid responseHeaders JSON: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    
    // Validate transformContent if present
    if (safeSettings.transformContent !== undefined && typeof safeSettings.transformContent !== 'string') {
      issues.push(`Invalid transformContent type ${typeof safeSettings.transformContent} - must be a string`);
      // Remove invalid transformContent to prevent errors
      delete safeSettings.transformContent;
    }
    
    // Log validation results
    if (issues.length > 0) {
      this.logger.warn(`${this.logPrefix} Validation issues for flag ${flagKey}:`, JSON.stringify({
        flagKey,
        issues
      }));
    } else {
      this.logger.debug(`${this.logPrefix} Validation successful for flag ${flagKey}`);
    }
    
    return {
      isValid: issues.length === 0,
      settings: safeSettings,
      issues
    };
  }
  
  /**
   * Parses cdnVariationSettings from a decision's variables
   * @param decision - The optimizely decision
   * @returns Parsed CDNVariationSettings or null if not found or invalid
   */
  private parseCdnVariationSettings(decision: OptimizelyDecision): CDNVariationSettings | null {
    try {
      if (!decision.variables || !decision.variables.cdnVariationSettings) {
        return null;
      }
      
      const cdnVariationSettingsRaw = decision.variables.cdnVariationSettings;
      let settings: CDNVariationSettings;
      
      // If cdnVariationSettings is a string (JSON), parse it
      if (typeof cdnVariationSettingsRaw === 'string') {
        try {
          settings = JSON.parse(cdnVariationSettingsRaw);
        } catch (e) {
          this.logger.error(
            `${this.logPrefix} Invalid JSON in cdnVariationSettings for flag ${decision.flagKey}`,
            e
          );
          return null;
        }
      } else {
        // Otherwise assume it's already an object
        settings = cdnVariationSettingsRaw as CDNVariationSettings;
      }
      
      // Validate the settings - even if validation fails, we might be able to use them partially
      const validationResult = this.validateCdnVariationSettings(settings, decision.flagKey || '(unknown)');
      
      // If there are critical issues, log them but still return what we have
      if (!validationResult.isValid) {
        this.logger.warn(
          `${this.logPrefix} Using partially valid cdnVariationSettings for flag ${decision.flagKey} despite issues`,
          JSON.stringify({ issues: validationResult.issues })
        );
      }
      
      return validationResult.settings;
    } catch (e) {
      this.logger.error(`${this.logPrefix} Error parsing cdnVariationSettings`, e);
      return null;
    }
  }

  /**
   * Extracts valid cdnVariationSettings from all decisions
   * @param decisions - Map of flag keys to decisions
   * @returns Array of valid CDNVariationSettings objects
   */
  private extractAllCdnVariationSettings(decisions: Record<string, OptimizelyDecision>): CDNVariationSettings[] {
    const result: CDNVariationSettings[] = [];
    const startTime = Date.now();
    let processedCount = 0;
    let enabledCount = 0;
    let validCount = 0;
    
    try {
      const flagKeys = Object.keys(decisions);
      this.logger.debug(`${this.logPrefix} Processing ${flagKeys.length} decisions for cdnVariationSettings`);
      
      // Early return if no decisions to process
      if (flagKeys.length === 0) {
        this.logger.debug(`${this.logPrefix} No decisions to process`);
        return result;
      }
      
      // Process each decision in the decisions map
      for (const [flagKey, decision] of Object.entries(decisions)) {
        processedCount++;
        
        // Skip if not enabled - quick check to avoid unnecessary processing
        if (!decision.enabled) {
          this.logger.debug(`${this.logPrefix} Skipping disabled flag: ${flagKey}`);
          continue;
        }
        
        enabledCount++;
        
        // Early check if cdnVariationSettings exists before attempting parsing
        if (!decision.variables || !decision.variables.cdnVariationSettings) {
          continue;
        }
        
        // Quick check for empty object or string
        const settingsRaw = decision.variables.cdnVariationSettings;
        if (settingsRaw === null || settingsRaw === undefined || 
           (typeof settingsRaw === 'string' && settingsRaw.trim() === '') ||
           (typeof settingsRaw === 'object' && Object.keys(settingsRaw).length === 0)) {
          this.logger.debug(`${this.logPrefix} Empty cdnVariationSettings for flag: ${flagKey}`);
          continue;
        }
        
        // Parse the settings
        const settings = this.parseCdnVariationSettings(decision);
        if (settings) {
          // Add flagKey and variationKey to the settings for traceability
          const enhancedSettings = {
            ...settings,
            _flagKey: flagKey,
            _variationKey: decision.variationKey ?? undefined
          };
          
          result.push(enhancedSettings);
          validCount++;
          this.logger.debug(`${this.logPrefix} Found valid cdnVariationSettings for flag ${flagKey}, variation ${decision.variationKey}`);
        }
      }
      
      const elapsedMs = Date.now() - startTime;
      this.logger.debug(`${this.logPrefix} Extraction complete: ${processedCount} processed, ${enabledCount} enabled, ${validCount} valid in ${elapsedMs}ms`);
      
      return result;
    } catch (error) {
      const elapsedMs = Date.now() - startTime;
      this.logger.error(`${this.logPrefix} Error extracting cdnVariationSettings (after ${elapsedMs}ms):`, error);
      // Return whatever we've managed to extract so far rather than failing completely
      return result;
    }
  }
  
  /**
   * Determines if the request should be handled by Edge Mode
   * @param request The request to check
   * @param userContext User context for decision making
   * @returns Promise resolving to decision result with handle flag and reason
   */
  public async shouldHandleRequest(
    request: IRequestAdapter,
    userContext: OptimizelyUserContext
  ): Promise<ShouldHandleResult> {
    // Extract SDK key from request headers or query parameters
    const url = request.getUrl();
    const urlParams = new URLSearchParams(url.search);
    const sdkKey = request.getHeader('X-Optimizely-SDK-Key') || urlParams.get('sdkKey') || undefined;
    
    // Log SDK key being used (partially masked for security)
    if (sdkKey) {
      this.logger.debug(`${this.logPrefix} Using SDK Key: ${sdkKey.substring(0, 4)}...`);
    }
    
    this.logger.debug(`${this.logPrefix} Checking if request should be handled: ${url.toString()}`);
    
    try {
      const startTime = Date.now();
      
      // Get all decisions for the user
      let decisions: Record<string, OptimizelyDecision> = {};
      
      try {
        // If sdkKey is provided, use it when getting decisions
        const options = sdkKey ? { sdkKey } : undefined;
        
        // Get all decisions from the DecisionService - this will include all flags that have cdnVariationSettings
        decisions = await this.decisionService.getAllDecisions(userContext.userId, userContext.attributes, options);
        this.logger.debug(`${this.logPrefix} Retrieved ${Object.keys(decisions).length} decisions for Edge Mode routing`);
        
        // Track the number of decisions processed
        this.metrics.decisionsProcessed++;
        
        // Debug all decision keys received for troubleshooting
        this.logger.debug(`${this.logPrefix} Decision flag keys: ${Object.keys(decisions).join(', ')}`);
      } catch (error) {
        this.logger.error(`${this.logPrefix} Error getting decisions from decision service:`, error);
        this.metrics.errors++;
        return {
          handle: false,
          reason: "Failed to retrieve decisions",
          variationSettings: []
        };
      }
      
      // Extract all cdnVariationSettings from decisions
      const variationSettings = this.extractAllCdnVariationSettings(decisions);
      
      // Track decision processing time
      const decisionProcessingTime = Date.now() - startTime;
      this.metrics.processingTimes.decisions.push(decisionProcessingTime);
      
      if (variationSettings.length === 0) {
        this.logger.debug(`${this.logPrefix} No valid cdnVariationSettings found in any decisions`);
        return {
          handle: false,
          reason: "No valid cdnVariationSettings found",
          variationSettings: []
        };
      }
    
      // Log each extracted cdnVariationSettings for debugging
      variationSettings.forEach((settings, index) => {
        this.logger.debug(`${this.logPrefix} Variation setting ${index + 1}:`, JSON.stringify({
          flagKey: settings._flagKey,
          variationKey: settings._variationKey,
          cdnExperimentURL: settings.cdnExperimentURL,
          cdnResponseURL: settings.cdnResponseURL
        }));
      });
      
      const urlMatchStartTime = Date.now();
      
      // Find if there's a matching config for this URL
      const matchingConfig = this.findMatchingConfig(url.toString(), variationSettings);
      
      // Track URL matching processing time
      const urlMatchingTime = Date.now() - urlMatchStartTime;
      this.metrics.processingTimes.urlMatching.push(urlMatchingTime);
      
      if (matchingConfig) {
        this.logger.debug(`${this.logPrefix} Found matching configuration, request should be handled by Edge Mode`, JSON.stringify({ 
          url: url.toString(),
          matchingPattern: matchingConfig.pathRegex || matchingConfig.cdnExperimentURL,
          flagKey: matchingConfig._flagKey,
          variationKey: matchingConfig._variationKey,
          cdnResponseURL: matchingConfig.cdnResponseURL,
          forwardToOrigin: matchingConfig.forwardRequestToOrigin
        }));
        
        // Record flag/variation activation for metrics when we find a match
        if (matchingConfig._flagKey) {
          this.recordActivation(matchingConfig._flagKey, matchingConfig._variationKey);
        }
        
        // Track that we found an eligible edge mode configuration
        this.metrics.edgeModeEligible++;
        
        return { 
          handle: true, 
          reason: "Matching configuration found",
          variationSettings: variationSettings
        };
      }
    
      // Return with handle=false if no matching config found
      return { 
        handle: false, 
        reason: "No matching URL pattern found in cdnVariationSettings",
        variationSettings: variationSettings
      };
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error in shouldHandleRequest:`, error);
      this.metrics.errors++;
      return {
        handle: false,
        reason: `Error determining if request should be handled: ${error instanceof Error ? error.message : String(error)}`,
        variationSettings: []
      };
    }
  }

  /**
   * Prepares content for delivery based on settings
   * @param settings CDN variation settings
   * @param userContext User context for decision making
   * @param request The original request
   * @returns Content preparation result with delivery options
   */
  public async prepareContent(
    settings: CDNVariationSettings,
    userContext: OptimizelyUserContext,
    request: IRequestAdapter
  ): Promise<ContentPreparationResult> {
    try {
      // Extract SDK key from request headers or query parameters
      const url = request.getUrl();
      const urlParams = new URLSearchParams(url.search);
      const sdkKey = request.getHeader('X-Optimizely-SDK-Key') || urlParams.get('sdkKey') || '8mR1pGh8u2ztUP8GqjmQq'; // Use default SDK key as fallback
      
      // Log SDK key being used (partially masked for security)
      if (sdkKey) {
        this.logger.debug(`${this.logPrefix} Using SDK Key: ${sdkKey.substring(0, 4)}...`);
      }
      
      // Ensure settings is not null
      const safeSettings = settings || {};
      
      // Extract content delivery settings from the CDN Variation Settings
      const useCache = isTrue(safeSettings.cacheRequestToOrigin); 
      const forwardToOrigin = isTrue(safeSettings.forwardRequestToOrigin);
      
      // Log settings
      this.logger.debug(`${this.logPrefix} Preparing content with settings:`, JSON.stringify({
        useCache,
        forwardToOrigin,
        hasTransform: !!safeSettings.transformContent,
        hasCdnResponseURL: !!safeSettings.cdnResponseURL,
        sdkKeyUsed: sdkKey ? `${sdkKey.substring(0, 4)}...` : undefined
      }));
      
      // Return content preparation result
      return {
        useCache,
        forwardToOrigin
      };
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error preparing content:`, JSON.stringify(error instanceof Error ? error.message : String(error)));
      // Default behavior in case of error
      return {
        useCache: true,
        forwardToOrigin: true
      };
    }
  }
  
  /**
   * Helper method to add consistent tracing headers to a response
   * 
   * @param response The response adapter to add headers to
   * @param settings The CDN variation settings containing flag and variation information
   * @param cacheStatus Optional cache status (HIT, MISS, etc.)
   */
  private addTracingHeaders(
    response: IResponseAdapter,
    settings: CDNVariationSettings,
    cacheStatus?: string
  ): void {
    try {
      // Add flag and variation headers for traceability
      if (settings._flagKey) {
        response.setHeader('X-Optimizely-Flag', settings._flagKey);
      }
      if (settings._variationKey) {
        response.setHeader('X-Optimizely-Variation', settings._variationKey);
      }
      
      // Add edge mode indicator
      response.setHeader('X-Optimizely-Edge-Mode', 'active');
      
      // Add cache status if provided
      if (cacheStatus) {
        response.setHeader('X-Edge-Cache', cacheStatus);
      }
      
      // Apply any custom response headers from settings
      if (settings.responseHeaders) {
        let headerValues: any = settings.responseHeaders;
        
        // If responseHeaders is a string (JSON), try to parse it
        if (typeof headerValues === 'string') {
          try {
            headerValues = JSON.parse(headerValues);
          } catch (parseError) {
            this.logger.warn(`${this.logPrefix} Failed to parse responseHeaders as JSON`, JSON.stringify({
              error: parseError instanceof Error ? parseError.message : String(parseError)
            }));
            // Continue with empty headers if parsing fails
            headerValues = {};
          }
        }
        
        // Apply headers if we have a valid object
        if (typeof headerValues === 'object' && headerValues !== null) {
          for (const [key, value] of Object.entries(headerValues)) {
            if (value !== undefined && value !== null) {
              try {
                response.setHeader(key, String(value));
              } catch (headerError) {
                this.logger.warn(`${this.logPrefix} Error setting custom header ${key}`, JSON.stringify({
                  value, 
                  error: headerError instanceof Error ? headerError.message : String(headerError)
                }));
              }
            }
          }
        }
      }
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error adding tracing headers:`, error);
      // Continue despite header errors - don't fail the whole response
    }
  }
  
  /**
   * Processes a request in Edge Mode
   * 
   * @param request The incoming request
   * @param cdnVariationSettings The CDN variation settings to apply
   * @returns A promise resolving to a response
   */
  public async processRequest(
    request: IRequestAdapter,
    cdnVariationSettings: CDNVariationSettings
  ): Promise<IResponseAdapter> {
    try {
      // Log the flag and variation information for traceability
      this.logger.debug('EdgeModeHandler: Processing request', JSON.stringify({
        url: request.getUrl().toString(),
        cdnResponseURL: cdnVariationSettings.cdnResponseURL,
        forwardRequestToOrigin: cdnVariationSettings.forwardRequestToOrigin,
        flagKey: cdnVariationSettings._flagKey,
        variationKey: cdnVariationSettings._variationKey
      }));
      
      // Determine if we should fetch content from CDN or forward to origin
      if (cdnVariationSettings.cdnResponseURL) {
        // Fetch from CDN
        const response = await this.fetchContent(cdnVariationSettings.cdnResponseURL, request, cdnVariationSettings);
        
        // Apply content transformation if specified
        if (cdnVariationSettings.transformContent) {
          try {
            const body = await response.getBody();
            if (body) {
              const transformedContent = await this.transformContent(body, cdnVariationSettings.transformContent);
              response.send(transformedContent);
            }
          } catch (error) {
            this.logger.error('EdgeModeHandler: Error transforming CDN content', JSON.stringify({
              error: error instanceof Error ? error.message : String(error)
            }));
            // Continue with original content if transformation fails
          }
        }
        
        // Add tracing and custom headers
        this.addTracingHeaders(response, cdnVariationSettings);
        
        // Add cache override logic here
        try {
          const shouldOverride = this.configService.getOverrideCache();
          if (shouldOverride) {
            this.logger.debug(`${this.logPrefix} Applying cache override headers (Cache-Control: no-store)`);
            // Use setHeader, assuming it's available on the IResponseAdapter implementation
            // based on its usage in addTracingHeaders.
            if (typeof response.setHeader === 'function') { 
              response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
              response.setHeader('Pragma', 'no-cache');
              response.setHeader('Expires', '0');
            } else {
              // Log a warning if setHeader isn't available, as we can't reliably set headers.
              this.logger.warn(`${this.logPrefix} Unable to set cache override headers: setHeader method not found on response object.`);
            }
          }
        } catch (configError) {
          this.logger.error(`${this.logPrefix} Error checking or applying cache override setting:`, configError);
        }
        
        return response;
      } else if (isTrue(cdnVariationSettings.forwardRequestToOrigin)) {
        // Forward to origin
        return this.forwardToOrigin(request, cdnVariationSettings);
      } else {
        // Neither CDN URL nor forward to origin is specified
        this.logger.warn('EdgeModeHandler: Neither CDN URL nor forward to origin is specified in variation settings');
        const response = this.createResponseAdapter(request);
        response.status(400); // Bad Request
        response.send('CDN variation configuration error: No content source specified');
        return response;
      }
    } catch (error) {
      this.logger.error('EdgeModeHandler: Error processing request', JSON.stringify({
        url: request.getUrl().toString(),
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }));
      
      // Create an error response
      const response = this.createResponseAdapter(request);
      response.status(500); // Internal Server Error
      response.send('Error processing request');
      return response;
    }
  }
  
  /**
   * Finds the matching CDN variation settings for a request URL
   * 
   * @param url The URL to match
   * @param allCdnVariationSettings Array of all available CDN variation settings
   * @returns The matching CDN variation settings or null if no match
   */
  public findMatchingConfig(
    url: string,
    allCdnVariationSettings: CDNVariationSettings[]
  ): CDNVariationSettings | null {
    this.logger.debug('EdgeModeHandler: Finding matching config for URL', JSON.stringify({ url }));
    
    // No settings, no match
    if (!allCdnVariationSettings || allCdnVariationSettings.length === 0) {
      this.logger.debug('EdgeModeHandler: No CDN variation settings provided');
      return null;
    }
    
    // Parse the URL to work with its components
    let parsedUrl: URL;
    try {
      // Add protocol if not present to make URL parsing work
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        parsedUrl = new URL(`https://${url}`);
      } else {
        parsedUrl = new URL(url);
      }
    } catch (error) {
      this.logger.warn('EdgeModeHandler: Invalid URL provided for matching', JSON.stringify({ url, error: error instanceof Error ? error.message : String(error) }));
      return null;
    }
    
    // Loop through all settings to find a match
    for (const config of allCdnVariationSettings) {
      // Skip if both required pattern fields are missing
      if (!config.cdnExperimentURL && !config.pathRegex) {
        this.logger.warn('EdgeModeHandler: CDN variation settings missing both cdnExperimentURL and pathRegex', JSON.stringify({ config }));
        continue;
      }
      
      // Determine which pattern to use - prefer regex if available
      const isRegex = !!config.pathRegex;
      let pattern = isRegex ? config.pathRegex : config.cdnExperimentURL;
      
      // If no pattern, skip
      if (!pattern) {
        this.logger.warn('EdgeModeHandler: Invalid URL pattern', JSON.stringify({ config }));
        continue;
      }
      
      // Extract required query params and normalize to array
      let requiredParams: string[] = [];
      if (config.requiredQueryParams) {
        if (typeof config.requiredQueryParams === 'string') {
          // Split comma-separated string
          requiredParams = config.requiredQueryParams.split(',').map(p => p.trim()).filter(p => p.length > 0);
        } else if (Array.isArray(config.requiredQueryParams)) {
          requiredParams = config.requiredQueryParams;
        }
      }
      
      // Extract ignore query params and normalize to array
      let ignoreParams: string[] = [];
      if (config.ignoreQueryParams) {
        if (typeof config.ignoreQueryParams === 'string') {
          // Split comma-separated string
          ignoreParams = config.ignoreQueryParams.split(',').map(p => p.trim()).filter(p => p.length > 0);
        } else if (Array.isArray(config.ignoreQueryParams)) {
          ignoreParams = config.ignoreQueryParams;
        }
      }
      
      // For non-regex patterns, first try a direct path comparison for efficiency
      if (!isRegex && pattern.startsWith('/')) {
        const normalizedUrlPath = this.urlMatcher.normalizePath(parsedUrl.pathname);
        const normalizedPattern = this.urlMatcher.normalizePath(pattern);
        
        if (normalizedUrlPath === normalizedPattern) {
          // For direct path matches, still check query params if required
          if (requiredParams.length > 0) {
            const allParamsPresent = requiredParams.every(
              param => parsedUrl.searchParams.has(param)
            );
            if (!allParamsPresent) {
              this.logger.debug(`EdgeModeHandler: Path matches but missing required query params - url: ${url}, pattern: ${pattern}, requiredParams: ${JSON.stringify(requiredParams)}`);
              continue;
            }
          }
          
          this.logger.debug('EdgeModeHandler: Found direct path match', JSON.stringify({
            urlPath: parsedUrl.pathname,
            pattern
          }));
          return config;
        }
        
        this.logger.debug('EdgeModeHandler: Path does not match', JSON.stringify({ 
          urlPath: parsedUrl.pathname, 
          normalizedUrlPath,
          pattern,
          normalizedPattern
        }));
      }
      
      // Use URLMatcher for all matching scenarios including regex
      const matches = this.urlMatcher.matches(url, pattern, {
        isRegex: isRegex,
        requiredQueryParams: requiredParams,
        ignoreQueryParams: ignoreParams
      });
      
      if (matches) {
        this.logger.debug('EdgeModeHandler: Found matching config via URLMatcher', JSON.stringify({ 
          url, 
          pattern,
          isRegex,
          flagKey: config._flagKey,
          variationKey: config._variationKey
        }));
        return config;
      }
    }
    
    this.logger.debug('EdgeModeHandler: No matching config found for URL', JSON.stringify({ url }));
    return null;
  }
  
  /**
   * Generates an appropriate cache key based on CDN variation settings
   * 
   * @param baseUrl The base URL to use for the cache key
   * @param settings The CDN variation settings
   * @returns A cache key string
   */
  private generateCacheKey(baseUrl: string, settings: CDNVariationSettings): string {
    try {
      // If settings provides a specific cacheKey, use that
      if (settings.cacheKey) {
        // Special case: VARIATION_KEY means use flag key + variation key
        if (settings.cacheKey === 'VARIATION_KEY' && settings._flagKey && settings._variationKey) {
          return `flag:${settings._flagKey}:var:${settings._variationKey}:${baseUrl}`;
        }
        
        // Otherwise use the provided cacheKey directly
        return `custom:${settings.cacheKey}:${baseUrl}`;
      }
      
      // Default case: Use the URL as the base of the cache key
      return `url:${baseUrl}`;
    } catch (error) {
      this.logger.warn(`${this.logPrefix} Error generating cache key, falling back to URL:`, error);
      return `url:${baseUrl}`;
    }
  }
  
  /**
   * Gets the cache TTL from CDN variation settings
   * 
   * @param settings The CDN variation settings
   * @param defaultTTL The default TTL to use if not specified in settings
   * @returns The TTL in seconds
   */
  private getCacheTTL(settings: CDNVariationSettings, defaultTTL: number = 3600): number {
    try {
      if (settings.cacheTTL !== undefined) {
        const ttl = typeof settings.cacheTTL === 'string' 
          ? parseInt(settings.cacheTTL, 10) 
          : settings.cacheTTL;
          
        if (!isNaN(ttl) && ttl >= 0) {
          return ttl;
        }
        
        this.logger.warn(`${this.logPrefix} Invalid cacheTTL value: ${settings.cacheTTL}, using default: ${defaultTTL}`);
      }
      
      return defaultTTL;
    } catch (error) {
      this.logger.warn(`${this.logPrefix} Error parsing cacheTTL, using default:`, error);
      return defaultTTL;
    }
  }
  
  /**
   * Fetches content from the CDN response URL
   * 
   * @param cdnResponseURL The URL to fetch content from
   * @param request The original request (for headers, etc.)
   * @param settings The CDN variation settings (optional)
   * @returns A promise resolving to the fetched content response
   */
  public async fetchContent(
    cdnResponseURL: string,
    request: IRequestAdapter,
    settings?: CDNVariationSettings
  ): Promise<IResponseAdapter> {
    this.logger.debug('EdgeModeHandler: Fetching content', JSON.stringify({ cdnResponseURL }));
    
    const startTime = Date.now();
    
    try {
      // Create a response object
      const response = this.createResponseAdapter(request);
      
      // Generate an appropriate cache key based on settings
      const cacheKey = settings 
        ? this.generateCacheKey(cdnResponseURL, settings)
        : cdnResponseURL;
      
      // Try to get from cache first if available
      const cachedContent = await this.cacheService.get(cacheKey);
      if (cachedContent) {
        this.logger.debug('EdgeModeHandler: Serving cached content', JSON.stringify({ 
          cdnResponseURL,
          cacheKey
        }));
        response.send(cachedContent);
        if (settings) {
          this.addTracingHeaders(response, settings, 'HIT');
        } else {
          response.setHeader('X-Edge-Cache', 'HIT');
        }
        
        // Track cache hit metrics
        this.metrics.cdnContentFetched++;
        this.metrics.cdnCacheHits++;
        
        // Track content fetching time (from cache)
        const fetchTime = Date.now() - startTime;
        this.metrics.processingTimes.contentFetching.push(fetchTime);
        
        return response;
      }
      
      // Fetch the content
      const fetchResponse = await fetch(cdnResponseURL);
      
      if (!fetchResponse.ok) {
        throw new Error(`Failed to fetch content: ${fetchResponse.status} ${fetchResponse.statusText}`);
      }
      
      // Get the content as text
      const content = await fetchResponse.text();
      
      // Set basic response properties
      response.status(fetchResponse.status || 200);
      
      // Copy headers from fetch response - safe way to handle headers
      fetchResponse.headers.forEach((value, key) => {
        if (value !== undefined && value !== null) {
          try {
            response.setHeader(key, String(value));
          } catch (headerError) {
            this.logger.warn(`EdgeModeHandler: Error setting header ${key}`, JSON.stringify({
              value,
              error: headerError instanceof Error ? headerError.message : String(headerError)
            }));
          }
        }
      });
      
      // Add cache indicator and other headers
      if (settings) {
        this.addTracingHeaders(response, settings, 'MISS');
      } else {
        response.setHeader('X-Edge-Cache', 'MISS');
      }
      
      // Send content last after setting headers
      if (content !== undefined && content !== null) {
        response.send(content);
      } else {
        response.send('');
      }
      
      // Store in cache if successful - ensure this happens before we return
      if (fetchResponse.ok && content) {
        // Get TTL from settings or use default
        const ttl = settings 
          ? this.getCacheTTL(settings)
          : 3600; // 1 hour default TTL
          
        await this.cacheService.set(cacheKey, content, ttl);
        this.logger.debug('EdgeModeHandler: Cached content', JSON.stringify({ 
          cdnResponseURL,
          cacheKey,
          ttl
        }));
      }
      
      // Track cache miss metrics
      this.metrics.cdnContentFetched++;
      this.metrics.cdnCacheMisses++;
      
      // Track content fetching time (from origin)
      const fetchTime = Date.now() - startTime;
      this.metrics.processingTimes.contentFetching.push(fetchTime);
      
      return response;
    } catch (error) {
      this.logger.error('EdgeModeHandler: Error fetching content', JSON.stringify({
        cdnResponseURL,
        error: error instanceof Error ? error.message : String(error)
      }));
      
      // Track error metrics
      this.metrics.errors++;
      
      // Create an error response
      const response = this.createResponseAdapter(request);
      response.status(502); // Bad Gateway
      response.send('Error fetching content');
      return response;
    }
  }
  
  /**
   * Apply transformation functions to content.
   * @param content - Content to transform
   * @param transformFn - Transformation function as a string
   * @returns Transformed content
   */
  public async transformContent(
    content: string,
    transformFn: string
  ): Promise<string> {
    try {
      if (!transformFn || transformFn.trim() === '') {
        return content;
      }

      this.logger.debug(`Applying transformation function`);
      const startTime = Date.now();
      
      // Create a function from the string
      // The function should have access to the content variable
      // eslint-disable-next-line no-new-func
      const fn = new Function('content', transformFn);
      
      // Execute the function with the content
      const transformedContent = fn(content);
      
      // Track metrics for transformation
      this.metrics.contentTransformed++;
      const transformTime = Date.now() - startTime;
      this.metrics.processingTimes.transformation.push(transformTime);
      
      // Ensure we always return a string
      if (typeof transformedContent !== 'string') {
        this.logger.warn('Transform function did not return a string. Using original content.');
        return content;
      }
      
      return transformedContent;
    } catch (error) {
      this.logger.error(`Error applying transformation function: ${error instanceof Error ? error.message : String(error)}`);
      this.metrics.errors++;
      return content; // Return original content if transformation fails
    }
  }
  
  /**
   * Helper function to safely convert Headers to a record object
   * 
   * @param headers The Headers object
   * @returns A record of header key-value pairs
   */
  private headersToRecord(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
  
  /**
   * Forwards a request to the origin server
   * 
   * @param request The original request
   * @param cdnVariationSettings The CDN variation settings
   * @returns A promise resolving to the origin response
   */
  public async forwardToOrigin(
    request: IRequestAdapter,
    cdnVariationSettings: CDNVariationSettings
  ): Promise<IResponseAdapter> {
    try {
      this.logger.debug('EdgeModeHandler: Forwarding request to origin', JSON.stringify({
        url: request.getUrl().toString(),
        flagKey: cdnVariationSettings._flagKey || '(unknown)',
        variationKey: cdnVariationSettings._variationKey || '(unknown)'
      }));
      
      // Create a new request with the same method and headers
      const response = await this.fetchFromOrigin(request);
      
      // Add tracing and custom headers
      this.addTracingHeaders(response, cdnVariationSettings);
      
      // Track metrics for origin forwarding
      this.metrics.originRequestsForwarded++;
      
      return response;
    } catch (error) {
      this.logger.error('EdgeModeHandler: Error forwarding to origin', JSON.stringify({
        url: request.getUrl().toString(),
        error: error instanceof Error ? error.message : String(error)
      }));
      
      // Track error metrics
      this.metrics.errors++;
      
      // Return an error response
      const response = this.createResponseAdapter(request);
      response.status(502); // Bad Gateway
      response.send('Error forwarding request to origin');
      return response;
    }
  }

  /**
   * Fetches a response from the origin
   * @param request The request to forward to origin
   * @returns A promise resolving to the origin response
   */
  private async fetchFromOrigin(request: IRequestAdapter): Promise<IResponseAdapter> {
    try {
      this.logger.debug('EdgeModeHandler: Fetching from origin', JSON.stringify({
        url: request.getUrl().toString()
      }));
      
      // Get request details
      const url = request.getUrl();
      const method = request.getMethod();
      const headers = request.getHeaders();
      const body = await request.getBody();
      
      // Create options for fetch
      const fetchOptions: RequestInit = {
        method: method,
        headers: headers,
        body: body || undefined,
        redirect: 'follow' // Follow redirects automatically
      };
      
      // Add Optimizely header to identify the request
      if (fetchOptions.headers && fetchOptions.headers instanceof Headers) {
        fetchOptions.headers.set('X-Optimizely-Edge-Agent', 'v2');
      } else if (fetchOptions.headers && typeof fetchOptions.headers === 'object') {
        (fetchOptions.headers as Record<string, string>)['X-Optimizely-Edge-Agent'] = 'v2';
      }
      
      // Fetch from origin
      const fetchResponse = await fetch(url.toString(), fetchOptions);
      
      // Create and populate response adapter
      const response = this.createResponseAdapter(request);
      
      // Set status
      response.status(fetchResponse.status);
      
      // Copy headers
      fetchResponse.headers.forEach((value, key) => {
        if (value) {
          response.setHeader(key, value);
        }
      });
      
      // Set body
      const responseBody = await fetchResponse.text();
      response.send(responseBody);
      
      this.logger.debug('EdgeModeHandler: Successfully fetched from origin', JSON.stringify({
        url: url.toString(),
        status: fetchResponse.status
      }));
      
      return response;
    } catch (error) {
      this.logger.error('EdgeModeHandler: Error in fetchFromOrigin', JSON.stringify({
        url: request.getUrl().toString(),
        error: error instanceof Error ? error.message : String(error)
      }));
      
      // Create an error response
      const response = this.createResponseAdapter(request);
      response.status(502); // Bad Gateway
      response.send('Error fetching from origin');
      return response;
    }
  }

  /**
   * Gets the current metrics for monitoring and analytics
   * 
   * @returns An object containing various metrics
   */
  public getMetrics(): Record<string, any> {
    // Calculate averages for processing times
    const calculateAverage = (times: number[]): number | null => {
      if (times.length === 0) return null;
      return times.reduce((sum, time) => sum + time, 0) / times.length;
    };
    
    return {
      decisionsProcessed: this.metrics.decisionsProcessed,
      edgeModeEligible: this.metrics.edgeModeEligible,
      cdnContentFetched: this.metrics.cdnContentFetched,
      cdnCacheHitRate: this.metrics.cdnContentFetched > 0 
        ? this.metrics.cdnCacheHits / this.metrics.cdnContentFetched 
        : 0,
      originRequestsForwarded: this.metrics.originRequestsForwarded,
      contentTransformed: this.metrics.contentTransformed,
      errors: this.metrics.errors,
      flagActivations: this.metrics.flagActivations,
      variationActivations: this.metrics.variationActivations,
      averageProcessingTimes: {
        decisions: calculateAverage(this.metrics.processingTimes.decisions),
        urlMatching: calculateAverage(this.metrics.processingTimes.urlMatching),
        contentFetching: calculateAverage(this.metrics.processingTimes.contentFetching),
        transformation: calculateAverage(this.metrics.processingTimes.transformation)
      }
    };
  }
  
  /**
   * Records flag and variation activations for metrics tracking
   * 
   * @param flagKey The flag key
   * @param variationKey The variation key
   */
  private recordActivation(flagKey: string, variationKey?: string): void {
    try {
      // Record flag activation
      if (flagKey) {
        this.metrics.flagActivations[flagKey] = (this.metrics.flagActivations[flagKey] || 0) + 1;
      }
      
      // Record variation activation
      if (flagKey && variationKey) {
        if (!this.metrics.variationActivations[flagKey]) {
          this.metrics.variationActivations[flagKey] = {};
        }
        this.metrics.variationActivations[flagKey][variationKey] = 
          (this.metrics.variationActivations[flagKey][variationKey] || 0) + 1;
      }
    } catch (error) {
      // Don't let metrics tracking failures affect core functionality
      this.logger.warn(`${this.logPrefix} Error recording activation metrics:`, error);
    }
  }
} 