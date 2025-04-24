import { IRequestAdapter } from "../../adapters/interfaces/IRequestAdapter";
import { ILoggerAdapter } from "../../adapters/interfaces/ILoggerAdapter";
import { IDatafileService } from "../interfaces/IDatafileService";
import { IMetricsAdapter } from "../../adapters/interfaces/IMetricsAdapter";
import { ResponseResult } from "../interfaces/IRequestHandler";
import { v4 as uuidv4 } from 'uuid';
import { ICacheService } from "../interfaces/ICacheService";
import { IConfigurationService } from "../interfaces/IConfigurationService";
import { IDecisionService, OptimizelyUserContext, OptimizelyDecision } from "../interfaces/IDecisionService";
import { RequestHandler } from './RequestHandler';
import { extractAttributes } from '../utils/extractAttributes'; // Import the utility

// At the top of the file, after the imports
// Add the RequestConfig interface
interface RequestConfig {
  sdkKey: string | null;
  userId: string | null;
  visitorId: string | null;
  attributes?: Record<string, any>;
  eventTags?: Record<string, any>;
  eventKey?: string;
  configMetadata: {
    sdkKey?: string | null;
    sdkKeyFrom?: string;
    visitorId?: string | null;
    attributes?: Record<string, any>;
    decideOptions?: string[];
    [key: string]: any;
  } | null;
  // Add header/cookie control flags
  setResponseHeaders: boolean;
  setResponseCookies: boolean;
  setRequestHeaders: boolean;
  setRequestCookies: boolean;
  // Add decisions for header generation
  decisions?: Record<string, any>;
}

/**
 * Service responsible for routing and handling API requests.
 */
export class ApiRouter {
  private datafileService: IDatafileService;
  private cacheService: ICacheService;
  private configService: IConfigurationService;
  private logger: ILoggerAdapter;
  private metrics: IMetricsAdapter | undefined;
  private decisionService: IDecisionService | undefined;
  private readonly logPrefix = '[v2][ApiRouter]';
  private apiPathPrefix: string; // Store the API path prefix
  private implementationVersionHeader: string = 'X-Implementation-Version'; // Default implementation version header

  /**
   * Creates an instance of the ApiRouter.
   */
  constructor(
    datafileService: IDatafileService,
    cacheService: ICacheService,
    configService: IConfigurationService,
    logger: ILoggerAdapter,
    metrics?: IMetricsAdapter,
    decisionService?: IDecisionService
  ) {
    if (!datafileService || !cacheService || !configService || !logger) {
      throw new Error("ApiRouter requires datafileService, cacheService, configService, and logger.");
    }
    this.datafileService = datafileService;
    this.cacheService = cacheService;
    this.configService = configService;
    this.logger = logger;
    this.metrics = metrics;
    this.decisionService = decisionService;
    
    // Get the configurable API path prefix
    this.apiPathPrefix = '/api/'; // Default
    try {
      if (configService && 'getApiPathPrefix' in configService) {
        // Use the ConfigurationService if available
        this.apiPathPrefix = (configService as any).getApiPathPrefix();
      }
    } catch (error) {
      this.logger.warn(`${this.logPrefix} Error getting API path prefix, using default '/api/'`, error);
    }
    
    // Initialize implementationVersionHeader from configService if available
    try {
      if (configService && typeof configService.getImplementationVersionHeader === 'function') {
        this.implementationVersionHeader = configService.getImplementationVersionHeader();
      }
    } catch (error) {
      this.logger.warn(`${this.logPrefix} Error getting implementation version header, using default`, error);
    }
    
    this.logger.info(`${this.logPrefix} Initialized with API path prefix: ${this.apiPathPrefix}`);

    if (this.metrics) {
      this.logger.info(`${this.logPrefix} Initialized with metrics tracking enabled.`);
    }
    
    if (this.decisionService) {
      this.logger.info(`${this.logPrefix} Initialized with decision service enabled.`);
    }
  }

  /**
   * Routes an API request to the appropriate handler based on the path.
   * @param requestAdapter - The adapter for the incoming request.
   * @returns A promise resolving to the ResponseResult.
   */
  async routeApiRequest(requestAdapter: IRequestAdapter): Promise<ResponseResult> {
    const requestId = uuidv4();
    const method = requestAdapter.getMethod();
    const url = requestAdapter.getUrl();
    const path = url.pathname;
    
    // Check for X-Optimizely-Enable-FEX header flag
    // If enabled, bypass all Optimizely SDK logic and process the request normally
    if (this.configService.getEnableFex()) {
      this.logger.info(`${this.logPrefix} X-Optimizely-Enable-FEX header is enabled, bypassing Optimizely SDK logic`);
      
      // Return a properly formatted ResponseResult to indicate normal processing
      // This effectively treats the request as if Optimizely is not present
      return this.createJsonResponse(requestId, 200, {
        bypass: true,
        message: "Optimizely processing bypassed due to X-Optimizely-Enable-FEX header"
      }, method);
    }
    
    // Start request timer for API endpoints
    const requestTimer = this.metrics?.startTimer('api_request_duration_seconds', {
      method,
      endpoint: path
    });
    
    // Track API request counters
    this.metrics?.incrementCounter('api_requests_total', 1, {
      method,
      endpoint: path
    });
    
    this.logger.info(`${this.logPrefix} Routing ${method} request ${requestId} for API path: ${path}`);

    try {
      let result: ResponseResult;
      
      // Handle API endpoints using the configurable path prefix
      if (path.endsWith(`${this.apiPathPrefix}datafile`)) {
        result = await this.handleDatafileRequest(requestAdapter, requestId);
      } else if (path.endsWith(`${this.apiPathPrefix}flagkeys`)) {
        result = await this.handleFlagKeysRequest(requestAdapter, requestId);
      } else if (path.endsWith(`${this.apiPathPrefix}sdk`)) {
        result = await this.handleSdkInfoRequest(requestAdapter, requestId);
      } else if (path.endsWith(`${this.apiPathPrefix}variations`)) {
        result = await this.handleVariationsRequest(requestAdapter, requestId);
      } else if (path.endsWith(`${this.apiPathPrefix}decide`)) {
        // Handle individual decide endpoint
        result = await this.handleDecideRequest(requestAdapter, requestId);
      } else if (path.endsWith(`${this.apiPathPrefix}decide-all`)) {
        // Handle decide-all endpoint
        result = await this.handleDecideAllRequest(requestAdapter, requestId);
      } else if (path.endsWith(`${this.apiPathPrefix}decide-for-keys`)) {
        // Handle decide-for-keys endpoint
        result = await this.handleDecideForKeysRequest(requestAdapter, requestId);
      } else if (path.endsWith(`${this.apiPathPrefix}decide-options`)) {
        result = await this.handleDecideOptionsRequest(requestAdapter, requestId);
      } else if (path.endsWith(`${this.apiPathPrefix}set-forced-variation`)) {
        result = await this.handleSetForcedVariationRequest(requestAdapter, requestId);
      } else if (path.endsWith(`${this.apiPathPrefix}get-forced-variation`)) {
        result = await this.handleGetForcedVariationRequest(requestAdapter, requestId);
      } else if (path.endsWith(`${this.apiPathPrefix}remove-forced-variation`)) {
        result = await this.handleRemoveForcedVariationRequest(requestAdapter, requestId);
      } else if (path.endsWith(`${this.apiPathPrefix}remove-all-forced-decisions`)) {
        result = await this.handleRemoveAllForcedDecisionsRequest(requestAdapter, requestId);
      } else if (path.endsWith(`${this.apiPathPrefix}debug`)) {
        // Handle debug endpoint
        result = await this.handleDebugRequest(requestAdapter, requestId);
      } else if (path.includes(`${this.apiPathPrefix}admin/`)) {
        result = await this.handleAdminRequest(requestAdapter, requestId);
      } else {
        // Unknown API endpoint
        this.metrics?.incrementCounter('api_errors_total', 1, {
          endpoint: path,
          method,
          error_type: 'unknown_endpoint'
        });
        result = this.createJsonResponse(requestId, 404, { error: "Unknown endpoint" }, method);
      }
      
      // Add implementation version header
      if (!result.headers) {
        result.headers = {};
      }
      result.headers[this.implementationVersionHeader] = 'v2';
      result.headers['X-Request-ID'] = requestId;
      
      // Record response status
      this.metrics?.incrementCounter('api_responses_total', 1, {
        status_code: result.status.toString(),
        method,
        endpoint: path
      });
      
      // Stop request timer
      if (requestTimer) {
        requestTimer.stop();
      }
      
      return result;
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error routing API request ${requestId}:`, error);
      
      // Track error
      this.metrics?.incrementCounter('api_errors_total', 1, {
        method,
        endpoint: path,
        error_type: error instanceof Error ? error.name : 'unknown'
      });
      
      // Stop request timer if it was started
      if (requestTimer) {
        requestTimer.stop();
      }
      
      // Create error response with headers
      const errorResponse = this.createErrorResponse(requestId, 500, "Internal Server Error", method);
      
      // Add implementation version header
      if (!errorResponse.headers) {
        errorResponse.headers = {};
      }
      errorResponse.headers[this.implementationVersionHeader] = 'v2';
      errorResponse.headers['X-Request-ID'] = requestId;
      
      return errorResponse;
    }
  }

  /**
   * Handles requests to the datafile API endpoint.
   * @param requestAdapter - The request adapter.
   * @param requestId - The unique request ID.
   * @returns A promise resolving to the ResponseResult.
   */
  private async handleDatafileRequest(
    requestAdapter: IRequestAdapter,
    requestId: string
  ): Promise<ResponseResult> {
    const url = requestAdapter.getUrl();
    const method = requestAdapter.getMethod();
    
    // Only get request context for POST requests - respecting design intent
    const requestContext = method === 'POST' ? 
      await this.getRequestConfig(requestAdapter) : undefined;
    
    // Check for SDK key in query parameters
    const params = this.parseUrlParams(url.search);
    const sdkKey = params.sdkKey || '';
    
    if (!sdkKey) {
      this.metrics?.incrementCounter('api_errors_total', 1, {
        endpoint: `${this.apiPathPrefix}datafile`,
        method,
        error_type: 'missing_sdk_key'
      });
      return this.createJsonResponse(requestId, 400, { error: "SDK key is required" }, method, requestContext);
    }
    
    // Track datafile request
    this.metrics?.incrementCounter('datafile_requests_total', 1, {
      method,
    });
    
    try {
      if (method === 'GET') {
        // Extract useKV from config or query/body
        const useKV = this.configService.getEnableDatafileFromKV() || params.datafileFromKV === 'true';
        // Get datafile by SDK key
        const datafileTimer = this.metrics?.startTimer('datafile_fetch_duration');
        const datafile = await this.datafileService.getDatafile(sdkKey, { useKV });
        if (datafileTimer) datafileTimer.stop();
        
        if (!datafile) {
          this.metrics?.incrementCounter('api_errors_total', 1, {
            endpoint: `${this.apiPathPrefix}datafile`,
            method,
            error_type: 'datafile_not_found'
          });
          return this.createJsonResponse(requestId, 404, { error: "Datafile not found" }, method, requestContext);
        }
        
        // Track datafile size
        if (typeof datafile === 'string') {
          this.metrics?.recordHistogram('datafile_size_bytes', datafile.length, { endpoint: `${this.apiPathPrefix}datafile` });
        }
        
        return this.createJsonResponse(requestId, 200, JSON.parse(datafile), method, requestContext);
      } else if (method === 'PUT' || method === 'POST') {
        // Only allow admin users to update datafiles
        const isAdmin = await this.isAdminRequest(requestAdapter);
        if (!isAdmin) {
          this.metrics?.incrementCounter('api_errors_total', 1, {
            endpoint: `${this.apiPathPrefix}datafile`,
            method,
            error_type: 'unauthorized'
          });
          return this.createJsonResponse(requestId, 403, { error: "Unauthorized" }, method, requestContext);
        }
        
        // Get datafile content from request body
        const requestBody = await this.getRequestBody(requestAdapter);
        if (!requestBody) {
          this.metrics?.incrementCounter('api_errors_total', 1, {
            endpoint: `${this.apiPathPrefix}datafile`,
            method,
            error_type: 'invalid_body'
          });
          return this.createJsonResponse(requestId, 400, { error: "Invalid request body" }, method, requestContext);
        }
        
        // Save datafile
        const saveTimer = this.metrics?.startTimer('datafile_save_duration');
        await this.datafileService.saveDatafile(sdkKey, JSON.stringify(requestBody));
        if (saveTimer) saveTimer.stop();
        
        this.metrics?.incrementCounter('datafile_updates_total', 1, {
          method,
        });
        
        // Update flag keys based on the datafile
        if (typeof requestBody === 'object' && requestBody !== null) {
          try {
            await this.updateFlagKeysFromDatafile(sdkKey, requestBody);
          } catch (error) {
            this.logger.error(`${this.logPrefix} Error updating flag keys:`, error);
          }
        }
        
        return this.createJsonResponse(requestId, 200, { success: true }, method, requestContext);
      } else {
        // Method not allowed
        this.metrics?.incrementCounter('api_errors_total', 1, {
          endpoint: `${this.apiPathPrefix}datafile`,
          method,
          error_type: 'method_not_allowed'
        });
        return this.createJsonResponse(requestId, 405, { error: "Method not allowed" }, method, requestContext);
      }
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error handling datafile request:`, error);
      
      // Try to get context for POST requests in error case
      const errorRequestContext = method === 'POST' ? 
        await this.getRequestConfig(requestAdapter).catch(() => null) : undefined;
        
      this.metrics?.incrementCounter('api_errors_total', 1, {
        endpoint: `${this.apiPathPrefix}datafile`,
        method,
        error_type: 'internal_error'
      });
      return this.createErrorResponse(requestId, 500, "Error processing datafile request", method, errorRequestContext);
    }
  }

  /**
   * Handles requests to the flag keys API endpoint.
   * @param requestAdapter - The request adapter.
   * @param requestId - The unique request ID.
   * @returns A promise resolving to the ResponseResult.
   */
  private async handleFlagKeysRequest(
    requestAdapter: IRequestAdapter,
    requestId: string
  ): Promise<ResponseResult> {
    const url = requestAdapter.getUrl();
    const method = requestAdapter.getMethod();
    
    // Only get request context for POST requests - respecting design intent
    const requestContext = method === 'POST' ? 
      await this.getRequestConfig(requestAdapter) : undefined;
    
    // Check for SDK key in query parameters
    const params = this.parseUrlParams(url.search);
    const sdkKey = params.sdkKey || '';
    
    if (!sdkKey) {
      this.metrics?.incrementCounter('api_errors_total', 1, {
        endpoint: `${this.apiPathPrefix}flagkeys`,
        method,
        error_type: 'missing_sdk_key'
      });
      return this.createJsonResponse(requestId, 400, { error: "SDK key is required" }, method, requestContext);
    }
    
    // Track flag keys request
    this.metrics?.incrementCounter('flagkeys_requests_total', 1, {
      method,
    });
    
    try {
      if (method === 'GET') {
        // Extract useKV from config or query/body
        const useKV = this.configService.getEnableFlagsFromKV() || params.flagsFromKV === 'true';
        // Get flag keys by SDK key
        const flagKeysTimer = this.metrics?.startTimer('flagkeys_fetch_duration');
        const flagKeys = await this.datafileService.getFlagKeys(sdkKey, { useKV });
        if (flagKeysTimer) flagKeysTimer.stop();
        
        if (!flagKeys || flagKeys.length === 0) {
          this.metrics?.incrementCounter('api_errors_total', 1, {
            endpoint: `${this.apiPathPrefix}flagkeys`,
            method,
            error_type: 'flagkeys_not_found'
          });
          return this.createJsonResponse(requestId, 404, { error: "Flag keys not found" }, method, requestContext);
        }
        
        // Track flag keys count
        this.metrics?.recordHistogram('flagkeys_count', flagKeys.length, { endpoint: `${this.apiPathPrefix}flagkeys` });
        
        return this.createJsonResponse(requestId, 200, { flagKeys }, method, requestContext);
      } else if (method === 'PUT' || method === 'POST') {
        // Only allow admin users to update flag keys
        const isAdmin = await this.isAdminRequest(requestAdapter);
        if (!isAdmin) {
          this.metrics?.incrementCounter('api_errors_total', 1, {
            endpoint: `${this.apiPathPrefix}flagkeys`,
            method,
            error_type: 'unauthorized'
          });
          return this.createJsonResponse(requestId, 403, { error: "Unauthorized" }, method, requestContext);
        }
        
        // Get flag keys from request body
        const requestBody = await this.getRequestBody(requestAdapter);
        if (!requestBody || !Array.isArray(requestBody.flagKeys)) {
          this.metrics?.incrementCounter('api_errors_total', 1, {
            endpoint: `${this.apiPathPrefix}flagkeys`,
            method,
            error_type: 'invalid_body'
          });
          return this.createJsonResponse(requestId, 400, { error: "Invalid request body. Expected { flagKeys: string[] }" }, method, requestContext);
        }
        
        // Save flag keys
        const saveTimer = this.metrics?.startTimer('flagkeys_save_duration');
        await this.datafileService.saveFlagKeys(sdkKey, requestBody.flagKeys);
        if (saveTimer) saveTimer.stop();
        
        this.metrics?.incrementCounter('flagkeys_updates_total', 1, {
          method,
        });
        
        return this.createJsonResponse(requestId, 200, { success: true }, method, requestContext);
      } else {
        // Method not allowed
        this.metrics?.incrementCounter('api_errors_total', 1, {
          endpoint: `${this.apiPathPrefix}flagkeys`,
          method,
          error_type: 'method_not_allowed'
        });
        return this.createJsonResponse(requestId, 405, { error: "Method not allowed" }, method, requestContext);
      }
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error handling flag keys request:`, error);
      
      // Try to get context for POST requests in error case
      const errorRequestContext = method === 'POST' ? 
        await this.getRequestConfig(requestAdapter).catch(() => null) : undefined;
        
      this.metrics?.incrementCounter('api_errors_total', 1, {
        endpoint: `${this.apiPathPrefix}flagkeys`,
        method,
        error_type: 'internal_error'
      });
      return this.createErrorResponse(requestId, 500, "Error processing flag keys request", method, errorRequestContext);
    }
  }

  /**
   * Handles requests to the SDK information API endpoint.
   * @param requestAdapter - The request adapter.
   * @param requestId - The unique request ID.
   * @returns A promise resolving to the ResponseResult.
   */
  private async handleSdkInfoRequest(
    requestAdapter: IRequestAdapter,
    requestId: string
  ): Promise<ResponseResult> {
    const method = requestAdapter.getMethod();
    
    // Only GET method is supported
    if (method !== 'GET') {
      this.metrics?.incrementCounter('api_errors_total', 1, {
        endpoint: `${this.apiPathPrefix}sdk`,
        method,
        error_type: 'method_not_allowed'
      });
      return this.createJsonResponse(requestId, 405, { error: "Method not allowed" }, method);
    }
    
    try {
        // Get SDK information
        const version = this.configService.getEdgeAgentVersion() || 'unknown';
        const environment = this.configService.getEnvironment() || 'unknown';
        const cdnProvider = this.configService.getCdnProvider() || 'unknown';
        
        // Log values for debugging
        this.logger.debug(`${this.logPrefix} SDK info values:`, {
          version,
          environment,
          cdnProvider
        });
        
        return this.createJsonResponse(requestId, 200, {
          name: "optimizely-edge-agent",
          version,
          environment,
          cdnProvider
        }, method);
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error handling SDK info request:`, error);
      this.metrics?.incrementCounter('api_errors_total', 1, {
        endpoint: '/api/sdk',
        method,
        error_type: 'internal_error'
      });
      return this.createErrorResponse(requestId, 500, "Error processing SDK info request", method);
    }
  }

  /**
   * Handles requests to the variations API endpoint.
   * @param requestAdapter - The request adapter.
   * @param requestId - The unique request ID.
   * @returns A promise resolving to the ResponseResult.
   */
  private async handleVariationsRequest(
    requestAdapter: IRequestAdapter,
    requestId: string
  ): Promise<ResponseResult> {
    const url = requestAdapter.getUrl();
    const method = requestAdapter.getMethod();
    
    // Check for SDK key in query parameters
    const params = this.parseUrlParams(url.search);
    const sdkKey = params.sdkKey || '';
    
    if (!sdkKey) {
      this.metrics?.incrementCounter('api_errors_total', 1, {
        endpoint: '/api/variations',
        method,
        error_type: 'missing_sdk_key'
      });
      return this.createJsonResponse(requestId, 400, { error: "SDK key is required" }, method);
    }
    
    // Track variations request
    this.metrics?.incrementCounter('variations_requests_total', 1, {
      method,
    });
    
    try {
      if (method === 'GET') {
        // Not implemented yet
        this.metrics?.incrementCounter('api_errors_total', 1, {
          endpoint: '/api/variations',
          method,
          error_type: 'not_implemented'
        });
        return this.createJsonResponse(requestId, 501, { error: "Variations API not implemented" }, method);
      } else if (method === 'PUT' || method === 'POST') {
        // Only allow admin users for variations updates
        const isAdmin = await this.isAdminRequest(requestAdapter);
        if (!isAdmin) {
          this.metrics?.incrementCounter('api_errors_total', 1, {
            endpoint: '/api/variations',
            method,
            error_type: 'unauthorized'
          });
          return this.createJsonResponse(requestId, 403, { error: "Unauthorized" }, method);
        }
        
        // Get variation changes from request body
        const requestBody = await this.getRequestBody(requestAdapter);
        if (!requestBody) {
          this.metrics?.incrementCounter('api_errors_total', 1, {
            endpoint: '/api/variations',
            method,
            error_type: 'invalid_body'
          });
          return this.createJsonResponse(requestId, 400, { error: "Invalid request body" }, method);
        }
        
        // Not implemented yet
        this.metrics?.incrementCounter('api_errors_total', 1, {
          endpoint: '/api/variations',
          method,
          error_type: 'not_implemented'
        });
        return this.createJsonResponse(requestId, 501, { error: "Variations API not implemented" }, method);
      } else {
        // Method not allowed
        this.metrics?.incrementCounter('api_errors_total', 1, {
          endpoint: '/api/variations',
          method,
          error_type: 'method_not_allowed'
        });
        return this.createJsonResponse(requestId, 405, { error: "Method not allowed" }, method);
      }
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error handling variations request:`, error);
      this.metrics?.incrementCounter('api_errors_total', 1, {
        endpoint: '/api/variations',
        method,
        error_type: 'internal_error'
      });
      return this.createErrorResponse(requestId, 500, "Error processing variations request", method);
    }
  }

  /**
   * Handles requests to the admin API endpoints.
   * @param requestAdapter - The request adapter.
   * @param requestId - The unique request ID.
   * @returns A promise resolving to the ResponseResult.
   */
  private async handleAdminRequest(
    requestAdapter: IRequestAdapter,
    requestId: string
  ): Promise<ResponseResult> {
    const url = requestAdapter.getUrl();
    const path = url.pathname;
    const method = requestAdapter.getMethod();
    
    // Only allow admin users
    const isAdmin = await this.isAdminRequest(requestAdapter);
    if (!isAdmin) {
      this.metrics?.incrementCounter('api_errors_total', 1, {
        endpoint: 'admin',
        method,
        error_type: 'unauthorized'
      });
      return this.createJsonResponse(requestId, 403, { error: "Unauthorized" }, method);
    }
    
    // Track admin request
    this.metrics?.incrementCounter('admin_requests_total', 1, {
      endpoint: path,
      method
    });
    
    try {
      if (path.endsWith(`${this.apiPathPrefix}admin/cache/clear`)) {
        // Clear cache
        const isAdmin = await this.isAdminRequest(requestAdapter);
        if (!isAdmin) {
          this.metrics?.incrementCounter('api_errors_total', 1, {
            endpoint: `${this.apiPathPrefix}admin/cache/clear`,
            method,
            error_type: 'unauthorized'
          });
          return this.createJsonResponse(requestId, 403, { error: "Unauthorized" }, method);
        }
        
          const cacheTimer = this.metrics?.startTimer('cache_clear_duration');
          // Clear cache (implementation would depend on the cache keys pattern)
          // For now, just log it
          this.logger.info(`${this.logPrefix} Admin requested cache clearing`);
          if (cacheTimer) cacheTimer.stop();
          
          return this.createJsonResponse(requestId, 200, { success: true }, method);
      } else if (path.endsWith(`${this.apiPathPrefix}admin/status`)) {
        // Return service status information
        this.metrics?.incrementCounter('api_requests_total', 1, {
          endpoint: `${this.apiPathPrefix}admin/status`,
          method
        });
        
          const status = {
            timestamp: new Date().toISOString(),
            uptime: 'healthy',
            version: this.configService.getEdgeAgentVersion() || 'unknown',
            environment: this.configService.getEnvironment() || 'unknown',
            cdnProvider: this.configService.getCdnProvider() || 'unknown'
          };
          
          return this.createJsonResponse(requestId, 200, status, method);
      } else {
        // Unknown admin endpoint
        this.metrics?.incrementCounter('api_errors_total', 1, {
          endpoint: 'admin',
          method,
          error_type: 'unknown_endpoint'
        });
        return this.createJsonResponse(requestId, 404, { error: "Unknown admin endpoint" }, method);
      }
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error handling admin request:`, error);
      this.metrics?.incrementCounter('api_errors_total', 1, {
        endpoint: 'admin',
        method,
        error_type: 'internal_error'
      });
      return this.createErrorResponse(requestId, 500, "Error processing admin request", method);
    }
  }

  /**
   * Handles requests to set a forced variation.
   * @param requestAdapter - The request adapter.
   * @param requestId - The unique request ID.
   * @returns A promise resolving to the ResponseResult.
   */
  private async handleSetForcedVariationRequest(
    requestAdapter: IRequestAdapter,
    requestId: string
  ): Promise<ResponseResult> {
    const method = requestAdapter.getMethod();
    
    // Only allow POST or PUT methods
    if (method !== 'POST' && method !== 'PUT') {
      return this.createJsonResponse(requestId, 405, { error: "Method not allowed. Use POST or PUT." });
    }
    
    try {
      this.logger.info(`${this.logPrefix} Processing set-forced-variation request ${requestId}`);
      
      // Only get request context for POST requests - respecting design intent
      const requestContext = method === 'POST' ? 
        await this.getRequestConfig(requestAdapter) : undefined;
      
      if (!this.decisionService) {
        this.logger.error(`${this.logPrefix} Decision service not available`);
        return this.createJsonResponse(requestId, 501, { 
          error: "Decision service not available", 
          message: "Forced variations are only available when decision service is configured"
        }, method, requestContext);
      }
      
      // Get request body
      const requestBody = await this.getRequestBody(requestAdapter);
      
      if (!requestBody) {
        this.logger.warn(`${this.logPrefix} Missing request body`);
        return this.createJsonResponse(requestId, 400, {
          error: "Missing request body",
          message: "The request must include a JSON body with the forced variation details"
        }, method, requestContext);
      }
      
      // Extract parameters from the request body
      const { userId, visitorId, flagKey, variationKey, sdkKey, ruleKey, experimentKey } = requestBody;
      
      // Check for user ID (allow either userId or visitorId)
      const finalUserId = userId || visitorId;
      
      if (!finalUserId) {
        this.logger.warn(`${this.logPrefix} Missing userId or visitorId in request body`);
        return this.createJsonResponse(requestId, 400, {
          error: "Missing userId or visitorId",
          message: "The request must include either userId or visitorId"
        }, method, requestContext);
      }
      
      if (!flagKey) {
        this.logger.warn(`${this.logPrefix} Missing flagKey in request body`);
        return this.createJsonResponse(requestId, 400, {
          error: "Missing flagKey",
          message: "The request must include a flagKey"
        }, method, requestContext);
      }
      
      if (!variationKey) {
        this.logger.warn(`${this.logPrefix} Missing variationKey in request body`);
        return this.createJsonResponse(requestId, 400, {
          error: "Missing variationKey",
          message: "The request must include a variationKey"
        }, method, requestContext);
      }
      
      // Check if the setForcedDecision method is available
      if (!this.decisionService.setForcedDecision || !this.decisionService.createUserContext) {
        this.logger.error(`${this.logPrefix} Forced decision methods not implemented in decision service`);
        return this.createJsonResponse(requestId, 501, {
          error: "Not implemented",
          message: "The decision service does not support forced decisions"
        }, method, requestContext);
      }
      
      try {
        // Create user context first
        const optimizelyUserContext = await this.decisionService.createUserContext(finalUserId, {}, { sdkKey });
        
        if (!optimizelyUserContext) {
          this.logger.error(`${this.logPrefix} Failed to create user context for forced decision`);
          return this.createJsonResponse(requestId, 500, {
            error: "User context creation failed",
            message: "Unable to create Optimizely user context for the forced decision"
          }, method, requestContext);
        }
        
        // Create the forced decision context
        // If experimentKey and ruleKey are provided, include them
        // Otherwise, use the flagKey alone
        const forcedDecisionContext: any = { flagKey };
        
        if (ruleKey && experimentKey) {
          forcedDecisionContext.ruleKey = ruleKey;
        }
        
        // Set the forced decision
        const result = await this.decisionService.setForcedDecision(
          optimizelyUserContext,
          forcedDecisionContext,
          { variationKey }
        );
        
        if (result) {
          this.logger.info(`${this.logPrefix} Successfully set forced variation for user ${finalUserId}, flag ${flagKey}, variation ${variationKey}`);
          return this.createJsonResponse(requestId, 200, {
            success: true,
            userId: finalUserId,
            flagKey,
            variationKey,
            ruleKey: ruleKey || null,
            experimentKey: experimentKey || null
          }, method, requestContext);
        } else {
          this.logger.error(`${this.logPrefix} Failed to set forced variation`);
          return this.createJsonResponse(requestId, 500, {
            error: "Failed to set forced variation",
            message: "The decision service returned false when attempting to set the forced decision"
          }, method, requestContext);
        }
      } catch (forcedError) {
        this.logger.error(`${this.logPrefix} Error setting forced variation:`, forcedError);
        return this.createJsonResponse(requestId, 500, {
          error: "Error setting forced variation",
          message: forcedError instanceof Error ? forcedError.message : String(forcedError)
        }, method, requestContext);
      }
    } catch (error) {
      // Try to get context for POST requests in error case
      const requestContext = method === 'POST' ? 
        await this.getRequestConfig(requestAdapter).catch(() => null) : undefined;
        
      this.logger.error(`${this.logPrefix} Error handling set-forced-variation request:`, error);
      return this.createErrorResponse(requestId, 500, "Error processing set forced variation request", method, requestContext);
    }
  }

  /**
   * Handles requests to get a forced variation.
   * @param requestAdapter - The request adapter.
   * @param requestId - The unique request ID.
   * @returns A promise resolving to the ResponseResult.
   */
  private async handleGetForcedVariationRequest(
    requestAdapter: IRequestAdapter,
    requestId: string
  ): Promise<ResponseResult> {
    // Accept both GET and POST for this endpoint
    const method = requestAdapter.getMethod();
    
    if (method !== 'GET' && method !== 'POST') {
      this.metrics?.incrementCounter('api_errors_total', 1, {
        endpoint: '/api/get-forced-variation',
        method,
        error_type: 'method_not_allowed'
      });
      return this.createJsonResponse(requestId, 405, { error: "Method not allowed. Use GET or POST." });
    }
    
    try {
      // Get parameters either from query params (GET) or request body (POST)
      let sdkKey, flagKey, userId;
      
      if (method === 'GET') {
        const params = this.parseUrlParams(requestAdapter.getUrl().search);
        sdkKey = params.sdkKey;
        flagKey = params.flagKey;
        userId = params.userId;
      } else {
        // POST request
        const requestBody = await this.getRequestBody(requestAdapter);
        sdkKey = requestBody?.sdkKey;
        flagKey = requestBody?.flagKey;
        userId = requestBody?.userId;
      }
      
      // Validate required fields
      if (!sdkKey || !flagKey || !userId) {
        this.metrics?.incrementCounter('api_errors_total', 1, {
          endpoint: '/api/get-forced-variation',
          method,
          error_type: 'missing_required_params'
        });
        return this.createJsonResponse(requestId, 400, {
          error: "Required parameters missing",
          required: ["sdkKey", "flagKey", "userId"]
        });
      }
      
      // Check if DecisionService is available and has getForcedVariation method
      if (this.decisionService && this.decisionService.getForcedVariation) {
        this.logger.info(`${this.logPrefix} Getting forced variation for user ${userId}, flag ${flagKey}`);
        
        try {
          // Get the forced variation
          const variationKey = await this.decisionService.getForcedVariation(
            flagKey,
            userId,
            { sdkKey }
          );
          
          // Track the operation
          this.metrics?.incrementCounter('forced_variation_operations_total', 1, {
            operation: 'get',
            flag_key: flagKey,
            sdk_key: this.hashSensitiveValue(sdkKey),
            result: 'success'
          });
          
          return this.createJsonResponse(requestId, 200, {
            flagKey,
            userId,
            variationKey
          });
        } catch (error) {
          this.logger.error(`${this.logPrefix} Error getting forced variation:`, error);
          
          this.metrics?.incrementCounter('forced_variation_operations_total', 1, {
            operation: 'get',
            flag_key: flagKey,
            sdk_key: this.hashSensitiveValue(sdkKey),
            result: 'error'
          });
          
          return this.createJsonResponse(requestId, 500, {
            error: `Failed to get forced variation for flag '${flagKey}', user '${userId}'`,
            details: error instanceof Error ? error.message : "Unknown error",
            flagKey,
            userId
          });
        }
      }
      
      // Decision Service not available or method not supported
      this.logger.warn(`${this.logPrefix} Get forced variation request received, but DecisionService is not available or doesn't support the method`);
      
      // Track the call
      this.metrics?.incrementCounter('forced_variation_operations_total', 1, {
        operation: 'get',
        flag_key: flagKey,
        sdk_key: this.hashSensitiveValue(sdkKey),
        result: 'not_supported'
      });
      
      return this.createJsonResponse(requestId, 501, {
        message: "Forced variation is not supported by the current configuration.",
        status: "not_implemented",
        details: "The DecisionService implementation does not support getting forced variations."
      });
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error handling get forced variation request:`, error);
      this.metrics?.incrementCounter('api_errors_total', 1, {
        endpoint: '/api/get-forced-variation',
        method,
        error_type: 'internal_error'
      });
      return this.createErrorResponse(requestId, 500, "Error processing get forced variation request");
    }
  }

  /**
   * Handles requests to remove a forced variation.
   * @param requestAdapter - The request adapter.
   * @param requestId - The unique request ID.
   * @returns A promise resolving to the ResponseResult.
   */
  private async handleRemoveForcedVariationRequest(
    requestAdapter: IRequestAdapter,
    requestId: string
  ): Promise<ResponseResult> {
    const method = requestAdapter.getMethod();
    
    // Only allow POST or DELETE methods
    if (method !== 'POST' && method !== 'DELETE') {
      return this.createJsonResponse(requestId, 405, { error: "Method not allowed. Use POST or DELETE." });
    }
    
    try {
      this.logger.info(`${this.logPrefix} Processing remove-forced-variation request ${requestId}`);
      
      // Only get request context for POST requests - respecting design intent
      const requestContext = method === 'POST' ? 
        await this.getRequestConfig(requestAdapter) : undefined;
      
      if (!this.decisionService) {
        this.logger.error(`${this.logPrefix} Decision service not available`);
        return this.createJsonResponse(requestId, 501, { 
          error: "Decision service not available", 
          message: "Forced variations are only available when decision service is configured"
        }, method, requestContext);
      }
      
      // Get request body if it's a POST, or URL parameters if it's a DELETE
      let userId, visitorId, flagKey, ruleKey, experimentKey, sdkKey;
      
      if (method === 'POST') {
        const requestBody = await this.getRequestBody(requestAdapter);
        if (!requestBody) {
          this.logger.warn(`${this.logPrefix} Missing request body for POST`);
          return this.createJsonResponse(requestId, 400, {
            error: "Missing request body",
            message: "POST requests must include a JSON body with the forced variation details to remove"
          }, method, requestContext);
        }
        
        // Extract parameters from the request body
        userId = requestBody.userId;
        visitorId = requestBody.visitorId;
        flagKey = requestBody.flagKey;
        ruleKey = requestBody.ruleKey;
        experimentKey = requestBody.experimentKey;
        sdkKey = requestBody.sdkKey;
      } else {
        // For DELETE, extract parameters from URL
        const urlParams = this.parseUrlParams(requestAdapter.getUrl().search);
        userId = urlParams.userId;
        visitorId = urlParams.visitorId;
        flagKey = urlParams.flagKey;
        ruleKey = urlParams.ruleKey;
        experimentKey = urlParams.experimentKey;
        sdkKey = urlParams.sdkKey;
      }
      
      // Check for user ID (allow either userId or visitorId)
      const finalUserId = userId || visitorId;
      
      if (!finalUserId) {
        this.logger.warn(`${this.logPrefix} Missing userId or visitorId parameter`);
        return this.createJsonResponse(requestId, 400, {
          error: "Missing userId or visitorId",
          message: "The request must include either userId or visitorId"
        }, method, requestContext);
      }
      
      if (!flagKey) {
        this.logger.warn(`${this.logPrefix} Missing flagKey parameter`);
        return this.createJsonResponse(requestId, 400, {
          error: "Missing flagKey",
          message: "The request must include a flagKey"
        }, method, requestContext);
      }
      
      // If the decision service supports removeForcedDecision, use that method
      if (this.decisionService.removeForcedDecision && this.decisionService.createUserContext) {
        try {
          // Create user context first
          const optimizelyUserContext = await this.decisionService.createUserContext(finalUserId, {}, { sdkKey });
          
          if (!optimizelyUserContext) {
            this.logger.error(`${this.logPrefix} Failed to create user context for removing forced decision`);
            return this.createJsonResponse(requestId, 500, {
              error: "User context creation failed",
              message: "Unable to create Optimizely user context for removing the forced decision"
            }, method, requestContext);
          }
          
          // Create the forced decision context
          const forcedDecisionContext: any = { flagKey };
          
          // Add additional context if provided
          if (ruleKey && experimentKey) {
            forcedDecisionContext.ruleKey = ruleKey;
          }
          
          // Remove the forced decision
          const result = await this.decisionService.removeForcedDecision(
            forcedDecisionContext,
            finalUserId,
            { sdkKey }
          );
          
          if (result) {
            this.logger.info(`${this.logPrefix} Successfully removed forced variation for user ${finalUserId}, flag ${flagKey}`);
            return this.createJsonResponse(requestId, 200, {
              success: true,
              userId: finalUserId,
              flagKey,
              ruleKey: ruleKey || null,
              experimentKey: experimentKey || null
            }, method, requestContext);
          } else {
            this.logger.warn(`${this.logPrefix} No forced variation found to remove for user ${finalUserId}, flag ${flagKey}`);
            return this.createJsonResponse(requestId, 200, {
              success: true,
              message: "No forced variation was set to remove",
              userId: finalUserId,
              flagKey,
              ruleKey: ruleKey || null,
              experimentKey: experimentKey || null
            }, method, requestContext);
          }
        } catch (forcedError) {
          this.logger.error(`${this.logPrefix} Error removing forced variation:`, forcedError);
          return this.createJsonResponse(requestId, 500, {
            error: "Error removing forced variation",
            message: forcedError instanceof Error ? forcedError.message : String(forcedError)
          }, method, requestContext);
        }
      }
      
      // Fall back to removeForcedVariation if available
      if (this.decisionService.removeForcedVariation) {
        try {
          // Use the legacy method for removing a forced variation
          const success = await this.decisionService.removeForcedVariation(
            flagKey,
            finalUserId,
            { sdkKey }
          );
          
          if (success) {
            this.logger.info(`${this.logPrefix} Successfully removed forced variation for user ${finalUserId}, flag ${flagKey}`);
            return this.createJsonResponse(requestId, 200, {
              success: true,
              userId: finalUserId,
              flagKey
            }, method, requestContext);
          } else {
            this.logger.warn(`${this.logPrefix} No forced variation found to remove for user ${finalUserId}, flag ${flagKey}`);
            return this.createJsonResponse(requestId, 200, {
              success: true,
              message: "No forced variation was set to remove",
              userId: finalUserId,
              flagKey
            }, method, requestContext);
          }
        } catch (variationError) {
          this.logger.error(`${this.logPrefix} Error removing forced variation:`, variationError);
          return this.createJsonResponse(requestId, 500, {
            error: "Error removing forced variation",
            message: variationError instanceof Error ? variationError.message : String(variationError)
          }, method, requestContext);
        }
      }
      
      // Decision Service does not support either method
      this.logger.error(`${this.logPrefix} Decision service doesn't support removing forced variations`);
      return this.createJsonResponse(requestId, 501, {
        error: "Not implemented",
        message: "The decision service does not support removing forced variations"
      }, method, requestContext);
    } catch (error) {
      // Try to get context for POST requests in error case
      const requestContext = method === 'POST' ? 
        await this.getRequestConfig(requestAdapter).catch(() => null) : undefined;
        
      this.logger.error(`${this.logPrefix} Error handling remove-forced-variation request:`, error);
      return this.createErrorResponse(requestId, 500, "Error processing remove forced variation request", method, requestContext);
    }
  }

  /**
   * Handles requests to remove all forced decisions for a user.
   * @param requestAdapter - The request adapter.
   * @param requestId - The unique request ID.
   * @returns A promise resolving to the ResponseResult.
   */
  private async handleRemoveAllForcedDecisionsRequest(
    requestAdapter: IRequestAdapter,
    requestId: string
  ): Promise<ResponseResult> {
    const method = requestAdapter.getMethod();
    
    // Only allow POST or DELETE methods
    if (method !== 'POST' && method !== 'DELETE') {
      this.metrics?.incrementCounter('api_errors_total', 1, {
        endpoint: '/api/remove-all-forced-decisions',
        method,
        error_type: 'method_not_allowed'
      });
      return this.createJsonResponse(requestId, 405, { error: "Method not allowed. Use POST or DELETE." });
    }
    
    try {
      this.logger.info(`${this.logPrefix} Processing remove-all-forced-decisions request ${requestId}`);
      
      // Only get request context for POST requests - respecting design intent
      const requestContext = method === 'POST' ? 
        await this.getRequestConfig(requestAdapter) : undefined;
      
      // Get required parameters
      let userId, sdkKey;
      
      if (method === 'DELETE') {
        const params = this.parseUrlParams(requestAdapter.getUrl().search);
        sdkKey = params.sdkKey;
        userId = params.userId || params.visitorId;
      } else {
        // POST request
        const requestBody = await this.getRequestBody(requestAdapter);
        if (!requestBody) {
          return this.createJsonResponse(requestId, 400, {
            error: "Missing request body",
            message: "POST requests must include a JSON body with userId/visitorId"
          }, method, requestContext);
        }
        sdkKey = requestBody?.sdkKey;
        userId = requestBody?.userId || requestBody?.visitorId;
      }
      
      // Validate required fields
      if (!userId) {
        this.metrics?.incrementCounter('api_errors_total', 1, {
          endpoint: '/api/remove-all-forced-decisions',
          method,
          error_type: 'missing_required_params'
        });
        return this.createJsonResponse(requestId, 400, {
          error: "Required parameter missing",
          required: ["userId or visitorId"]
        }, method, requestContext);
      }
      
      // Check if decisionService is available
      if (!this.decisionService) {
        this.logger.warn(`${this.logPrefix} Remove all forced decisions request received, but DecisionService is not available`);
        
        this.metrics?.incrementCounter('forced_decision_operations_total', 1, {
          operation: 'remove_all',
          sdk_key: sdkKey ? this.hashSensitiveValue(sdkKey) : 'none',
          result: 'not_supported'
        });
        
        return this.createJsonResponse(requestId, 501, {
          message: "Removing all forced decisions is not supported by the current configuration.",
          status: "not_implemented"
        }, method, requestContext);
      }
      
      // Use removeAllForcedDecisions if available (newer SDK method)
      if (this.decisionService.removeAllForcedDecisions) {
        this.logger.info(`${this.logPrefix} Removing all forced decisions for user ${userId}`);
        
        try {
          // First create a user context
          if (!this.decisionService || !this.decisionService.createUserContext) {
            this.logger.error(`${this.logPrefix} Failed to create user context for removing all forced decisions: Decision service or create user context method not available`);
            return this.createJsonResponse(requestId, 500, {
              error: "User context creation failed",
              message: "The decision service does not support user context creation"
            }, method, requestContext);
          }
          
          const userContext = await this.decisionService.createUserContext(userId, {}, { sdkKey });
          
          if (!userContext) {
            this.logger.error(`${this.logPrefix} Failed to create user context for removing all forced decisions`);
            return this.createJsonResponse(requestId, 500, {
              error: "User context creation failed",
              message: "Unable to create user context for the operation"
            }, method, requestContext);
          }
          
          // Remove all forced decisions
          const result = await this.decisionService.removeAllForcedDecisions(
            userId,
            { sdkKey }
          );
          
          // Track the operation
          this.metrics?.incrementCounter('forced_decision_operations_total', 1, {
            operation: 'remove_all',
            sdk_key: sdkKey ? this.hashSensitiveValue(sdkKey) : 'none',
            result: result ? 'success' : 'failure'
          });
          
          if (result) {
            return this.createJsonResponse(requestId, 200, {
              success: true,
              userId
            }, method, requestContext);
          } else {
            return this.createJsonResponse(requestId, 500, {
              error: `Failed to remove all forced decisions for user '${userId}'`,
              userId
            }, method, requestContext);
          }
        } catch (error) {
          this.logger.error(`${this.logPrefix} Error removing all forced decisions:`, error);
          
          this.metrics?.incrementCounter('forced_decision_operations_total', 1, {
            operation: 'remove_all',
            sdk_key: sdkKey ? this.hashSensitiveValue(sdkKey) : 'none',
            result: 'error'
          });
          
          return this.createJsonResponse(requestId, 500, {
            error: `Failed to remove all forced decisions for user '${userId}'`,
            details: error instanceof Error ? error.message : "Unknown error",
            userId
          }, method, requestContext);
        }
      }
      
      // Decision Service not available or method not supported
      this.logger.warn(`${this.logPrefix} Remove all forced decisions request received, but DecisionService is not available or doesn't support the method`);
      
      // Track the call
      this.metrics?.incrementCounter('forced_decision_operations_total', 1, {
        operation: 'remove_all',
        sdk_key: sdkKey ? this.hashSensitiveValue(sdkKey) : 'none',
        result: 'not_supported'
      });
      
      return this.createJsonResponse(requestId, 501, {
        message: "Removing all forced decisions is not supported by the current configuration.",
        status: "not_implemented",
        details: "The DecisionService implementation does not support removing all forced decisions."
      });
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error handling remove all forced decisions request:`, error);
      this.metrics?.incrementCounter('api_errors_total', 1, {
        endpoint: '/api/remove-all-forced-decisions',
        method,
        error_type: 'internal_error'
      });
      return this.createErrorResponse(requestId, 500, "Error processing remove all forced decisions request");
    }
  }

  /**
   * Handles requests to get available decide options.
   * @param requestAdapter - The request adapter.
   * @param requestId - The unique request ID.
   * @returns A promise resolving to the ResponseResult.
   */
  private async handleDecideOptionsRequest(
    requestAdapter: IRequestAdapter,
    requestId: string
  ): Promise<ResponseResult> {
    const method = requestAdapter.getMethod();
    
    // Track decide options request
    this.metrics?.incrementCounter('decide_options_requests_total', 1, {
      method
    });
    
    try {
      // Only allow GET or POST methods
      if (method !== 'GET' && method !== 'POST') {
        this.metrics?.incrementCounter('api_errors_total', 1, {
          endpoint: '/api/decide-options',
          method,
          error_type: 'method_not_allowed'
        });
        return this.createJsonResponse(requestId, 405, { error: "Method not allowed. Use GET or POST." }, method);
      }
      
      // Only get request context for POST requests - respecting design intent
      const requestContext = method === 'POST' ? 
        await this.getRequestConfig(requestAdapter) : undefined;
      
      // Defined decide options based on Optimizely SDK
      const decideOptions = [
        {
          key: "INCLUDE_REASONS",
          description: "Include decision reasons in the response"
        },
        {
          key: "EXCLUDE_VARIABLES",
          description: "Exclude variables data from the response"
        },
        {
          key: "ENABLED_FLAGS_ONLY",
          description: "Only return flags that are enabled for the user"
        },
        {
          key: "IGNORE_USER_PROFILE_SERVICE",
          description: "Ignore the user profile service when making decisions"
        },
        {
          key: "DISABLE_DECISION_EVENT",
          description: "Disable tracking decision events"
        }
      ];
      
      // Format for each SDK version
      const formattedOptions = {
        sdkVersions: {
          'javascript': {
            latestVersion: '4.9.4',
            options: decideOptions.map(option => ({
              ...option,
              usage: `OptimizelyDecideOption.${option.key}`
            }))
          },
          'react': {
            latestVersion: '2.9.4',
            options: decideOptions.map(option => ({
              ...option,
              usage: `OptimizelyDecideOption.${option.key}`
            }))
          },
          'node': {
            latestVersion: '4.9.4',
            options: decideOptions.map(option => ({
              ...option,
              usage: `OptimizelyDecideOption.${option.key}`
            }))
          }
        },
        apiUsage: {
          example: {
            request: {
              method: "POST",
              url: "/api/decide",
              body: {
                sdkKey: "SDK_KEY",
                flagKey: "my_flag",
                userId: "user123",
                decideOptions: ["INCLUDE_REASONS", "ENABLED_FLAGS_ONLY"]
              }
            }
          }
        }
      };
      
      // Return the decide options
      this.logger.info(`${this.logPrefix} Returning decide options`);
      return this.createJsonResponse(requestId, 200, formattedOptions, method, requestContext);
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error handling decide options request:`, error);
      
      // Try to get context for POST requests in error case
      const requestContext = method === 'POST' ? 
        await this.getRequestConfig(requestAdapter).catch(() => null) : undefined;
      
      this.metrics?.incrementCounter('api_errors_total', 1, {
        endpoint: '/api/decide-options',
        method,
        error_type: 'internal_error'
      });
      return this.createErrorResponse(requestId, 500, "Error processing decide options request", method, requestContext);
    }
  }

  /**
   * Handles individual decide requests for feature flags and experiments.
   * @param requestAdapter - The request adapter.
   * @param requestId - The unique request ID.
   * @returns A promise resolving to the ResponseResult.
   */
  private async handleDecideRequest(
    requestAdapter: IRequestAdapter,
    requestId: string
  ): Promise<ResponseResult> {
    try {
      this.logger.info(`${this.logPrefix} Processing decide request ${requestId}`);
      const method = requestAdapter.getMethod();
      
      // Get the request context to access metadata
      const requestContext = await this.getRequestConfig(requestAdapter);
      
      if (!this.decisionService) {
        this.logger.error(`${this.logPrefix} Decision service not available`);
        return this.createJsonResponse(requestId, 501, { error: "Decision service not available" }, method, requestContext);
      }
      
      // Get request body or URL parameters
      const requestBody = await this.getRequestBody(requestAdapter);
      const urlParams = this.parseUrlParams(requestAdapter.getUrl().search);
      
      // Get decision parameters from body or URL with expanded options for user/visitor ID
      const userId = requestBody?.userId || urlParams.userId || 
                     requestBody?.visitorId || urlParams.visitorId || 
                     requestAdapter.getHeader('X-Optimizely-Visitor-Id');
                     
      // Check for auto-generation of visitor ID if requested
      let finalUserId = userId;
      const overrideVisitorId = urlParams.overrideVisitorId === 'true' || 
                              requestAdapter.getHeader('X-Optimizely-Override-Visitor-Id') === 'true';
                              
      if (overrideVisitorId) {
        finalUserId = this.generateUUID();
        this.logger.debug(`${this.logPrefix} Auto-generated visitor ID due to override: ${finalUserId}`);
        if (requestContext?.configMetadata) {
          requestContext.configMetadata.visitorId = finalUserId;
          requestContext.configMetadata.visitorIdFrom = 'override';
        }
      }
      
      // Support header for single flag key
      const headerFlagKey = requestAdapter.getHeader('X-Optimizely-Flag-Key');
      const flagKey = requestBody?.key || urlParams.key || headerFlagKey;
      
      // If flag key came from header, update metadata
      if (!requestBody?.key && !urlParams.key && headerFlagKey && requestContext?.configMetadata) {
        requestContext.configMetadata.flagKeysDecided = [headerFlagKey];
        requestContext.configMetadata.flagKeysFrom = 'header';
      }
      
      const attributes = requestBody?.attributes || {};
      const sdkKey = requestBody?.sdkKey || urlParams.sdkKey || requestAdapter.getHeader('X-Optimizely-SDK-Key');
      
      // Check for trimmedDecisions parameter in body, URL, or header
      const headerTrimmedDecisions = requestAdapter.getHeader('X-Optimizely-Trimmed-Decisions');
      const trimmedDecisions = 
        requestBody?.trimmedDecisions === true || 
        urlParams.trimmedDecisions === 'true' || 
        headerTrimmedDecisions === 'true';
      
      this.logger.debug(`${this.logPrefix} Decision parameters:`, {
        userId: finalUserId,
        flagKey,
        attributeCount: Object.keys(attributes).length,
        sdkKey: sdkKey ? `${sdkKey.substring(0, 4)}...` : undefined, // Log only first 4 chars for security
        trimmedDecisions
      });
      
      // Validate required parameters
      if (!finalUserId) {
        this.logger.warn(`${this.logPrefix} Missing userId/visitorId parameter`);
        return this.createJsonResponse(requestId, 400, { error: "userId is required (can also be provided as visitorId or X-Optimizely-Visitor-Id header)" }, method, requestContext);
      }
      
      if (!flagKey) {
        this.logger.warn(`${this.logPrefix} Missing key parameter`);
        return this.createJsonResponse(requestId, 400, { error: "flag key parameter is required" }, method, requestContext);
      }
      
      // Get decision from decision service
      this.logger.debug(`${this.logPrefix} Getting decision for user ${finalUserId}, key ${flagKey}`);
      
      try {
        // Collect decide options from all input sources
        const decideOptionsArr = this.collectDecideOptions(requestAdapter, requestBody, urlParams);

        // store in metadata for debug
        if (decideOptionsArr.length > 0 && requestContext?.configMetadata) {
          requestContext.configMetadata.decideOptions = decideOptionsArr;
        }
        
        // Pass sdkKey as an option
        const options: any = sdkKey ? { sdkKey } : {};
        if (decideOptionsArr.length > 0) {
          options.decideOptions = decideOptionsArr;
        }
        const decision = await this.decisionService.getDecision(
          finalUserId,
          flagKey,
          attributes,
          options
        );
        
        // Add decision to the context for headers/cookies
        if (requestContext && decision) {
          try {
            // Import the serializer for header/cookie format
            const { getSerializedArray } = await import('../../utils/decisionUtils.js');
            
            // Create array with single decision and serialize it
            const excludeVariables = decideOptionsArr.includes('EXCLUDE_VARIABLES');
            const includeReasons = decideOptionsArr.includes('INCLUDE_REASONS');
            const enabledFlagsOnly = decideOptionsArr.includes('ENABLED_FLAGS_ONLY');
            
            // Serialize the decision using the same function format from v1
            const serializedDecisions = getSerializedArray(
              [decision], // Convert to array for serialization
              excludeVariables,
              includeReasons,
              enabledFlagsOnly,
              trimmedDecisions,
              method
            );
            
            // Store the serialized array in the context for header/cookie generation
            requestContext.decisions = serializedDecisions;
            
            this.logger.info(`${this.logPrefix} Added serialized decision for flag ${flagKey} to request context for headers/cookies. Format: ${JSON.stringify(serializedDecisions)}`);
          } catch (error) {
            this.logger.error(`${this.logPrefix} Failed to serialize decision for headers/cookies:`, error);
            // Store unprocessed decision as fallback
            requestContext.decisions = [decision];
          }
        }
        
        this.logger.debug(`${this.logPrefix} Decision result:`, decision || { enabled: false });
        
        // If trimmedDecisions is enabled, return a trimmed decision
        if (trimmedDecisions && decision) {
          const trimmedDecision: Record<string, any> = {
            flagKey: decision.flagKey,
            enabled: decision.enabled,
            variationKey: decision.variationKey
          };
          
          // Add optional fields if present
          if (decision.experimentKey) {
            trimmedDecision['experimentKey'] = decision.experimentKey;
          }
          
          if (decision.ruleKey) {
            trimmedDecision['ruleKey'] = decision.ruleKey;
          }
          
          if (!decideOptionsArr.includes('EXCLUDE_VARIABLES')) {
            trimmedDecision['variables'] = decision.variables;
          }
          
          if (decideOptionsArr.includes('INCLUDE_REASONS') && (decision as any).reasons) {
            trimmedDecision['reasons'] = (decision as any).reasons;
          }
          
          this.logger.debug(`${this.logPrefix} Returning trimmed decision`);
          return this.createJsonResponse(requestId, 200, trimmedDecision, method, requestContext);
        }
        
        // If ENABLED_FLAGS_ONLY requested and decision is disabled return 404 style
        if (decideOptionsArr.includes('ENABLED_FLAGS_ONLY') && (!decision || !decision.enabled)) {
          return this.createJsonResponse(requestId, 404, { error: 'Flag disabled for user', flagKey }, method, requestContext);
        }
        
        return this.createJsonResponse(requestId, 200, decision || { enabled: false }, method, requestContext);
      } catch (error) {
        this.logger.error(`${this.logPrefix} Error getting decision:`, error);
        return this.createJsonResponse(requestId, 500, {
          error: "Error getting decision",
          message: error instanceof Error ? error.message : String(error),
          flagKey
        }, method, requestContext);
      }
    } catch (error) {
      const method = requestAdapter.getMethod();
      
      // If we can't access the request context in the error handler, we'll have to proceed without it
      this.logger.error(`${this.logPrefix} Error handling decide request:`, error);
      return this.createErrorResponse(requestId, 500, "Error processing decide request", method);
    }
  }

  /**
   * Handles batch decide-all requests for all feature flags.
   * @param requestAdapter - The request adapter.
   * @param requestId - The unique request ID.
   * @returns A promise resolving to the ResponseResult.
   */
  private async handleDecideAllRequest(
    requestAdapter: IRequestAdapter,
    requestId: string
  ): Promise<ResponseResult> {
    try {
      this.logger.info(`${this.logPrefix} Processing decide-all request ${requestId}`);
      const method = requestAdapter.getMethod();
      
      // Only get request context for POST requests - respecting design intent
      const requestContext = method === 'POST' ? 
        await this.getRequestConfig(requestAdapter) : undefined;
      
      if (!this.decisionService) {
        this.logger.error(`${this.logPrefix} Decision service not available`);
        return this.createJsonResponse(requestId, 501, { error: "Decision service not available" }, method, requestContext);
      }
      
      // Get request body or URL parameters
      const requestBody = await this.getRequestBody(requestAdapter);
      const urlParams = this.parseUrlParams(requestAdapter.getUrl().search);
      
      // Get decision parameters from body or URL, with expanded options for user/visitor ID
      const userId = requestBody?.userId || urlParams.userId || 
                     requestBody?.visitorId || urlParams.visitorId || 
                     requestAdapter.getHeader('X-Optimizely-Visitor-Id');
      
      // Check for auto-generation of visitor ID if requested
      let finalUserId = userId;
      const overrideVisitorId = urlParams.overrideVisitorId === 'true' || 
                              requestAdapter.getHeader('X-Optimizely-Override-Visitor-Id') === 'true';
                              
      if (overrideVisitorId) {
        finalUserId = this.generateUUID();
        this.logger.debug(`${this.logPrefix} Auto-generated visitor ID due to override: ${finalUserId}`);
        if (requestContext?.configMetadata) {
          requestContext.configMetadata.visitorId = finalUserId;
          requestContext.configMetadata.visitorIdFrom = 'override';
        }
      }
      
      const attributes = requestBody?.attributes || {};
      const sdkKey = requestBody?.sdkKey || urlParams.sdkKey || requestAdapter.getHeader('X-Optimizely-SDK-Key');
      
      // Check for trimmedDecisions parameter
      const headerTrimmedDecisions = requestAdapter.getHeader('X-Optimizely-Trimmed-Decisions');
      const trimmedDecisions = 
        requestBody?.trimmedDecisions === true || 
        urlParams.trimmedDecisions === 'true' || 
        headerTrimmedDecisions === 'true';
      
      this.logger.debug(`${this.logPrefix} Decide-all parameters:`, {
        userId: finalUserId,
        attributeCount: Object.keys(attributes).length,
        sdkKey: sdkKey ? `${sdkKey.substring(0, 4)}...` : undefined, // Log only first 4 chars for security
        trimmedDecisions
      });
      
      // Validate required parameters
      if (!finalUserId) {
        this.logger.warn(`${this.logPrefix} Missing userId/visitorId parameter`);
        return this.createJsonResponse(requestId, 400, { error: "userId is required (can be provided as visitorId or X-Optimizely-Visitor-Id header)" }, method, requestContext);
      }
      
      if (!sdkKey) {
        this.logger.warn(`${this.logPrefix} Missing sdkKey parameter`);
        return this.createJsonResponse(requestId, 400, { error: "sdkKey is required" }, method, requestContext);
      }
      
      // Get all flag keys for the SDK key
      try {
        // Check if decideAll method is available
        if (this.decisionService.decideAll) {
          // Extract useKV from config or query/body for decideAll
          const useKV = this.configService.getEnableFlagsFromKV() || urlParams.flagsFromKV === 'true';
          const flagKeys = await this.datafileService.getFlagKeys(sdkKey, { useKV, requestContext });
          
          if (!flagKeys || flagKeys.length === 0) {
            this.logger.warn(`${this.logPrefix} No flag keys found for SDK key ${this.hashSensitiveValue(sdkKey)}`);
            return this.createJsonResponse(requestId, 200, { decisions: [] }, method, requestContext);
          }
          
          this.logger.debug(`${this.logPrefix} Found ${flagKeys.length} flag keys for SDK key ${this.hashSensitiveValue(sdkKey)}`);
          
          // Create user context
          const userContext = { userId: finalUserId, attributes };
          
          // Collect decide options from all input sources ONCE per request
          const decideOptionsArr = this.collectDecideOptions(requestAdapter, requestBody || {}, urlParams);
          if (decideOptionsArr.length > 0 && requestContext?.configMetadata) {
            requestContext.configMetadata.decideOptions = decideOptionsArr;
          }
          
          // Get decisions for all flags (pass decide options to SDK)
          const allDecisions = await this.decisionService.decideAll(userContext, decideOptionsArr, { sdkKey });
          
          // Convert the map returned by SDK into an array for response formatting
          let decisions = Object.values(allDecisions || {}).map(decision => {
            if (trimmedDecisions) {
              const trimmedDecision: Record<string, any> = {
                flagKey: decision.flagKey,
                enabled: decision.enabled,
                variationKey: decision.variationKey,
              };
              
              // Optional fields
              if (decision.experimentKey) trimmedDecision.experimentKey = decision.experimentKey;
              if (decision.ruleKey) trimmedDecision.ruleKey = decision.ruleKey;
              
              // Include variables unless explicitly excluded
              if (!decideOptionsArr.includes('EXCLUDE_VARIABLES')) {
                trimmedDecision.variables = decision.variables;
              }
              
              // INCLUDE_REASONS support
              if (decideOptionsArr.includes('INCLUDE_REASONS') && (decision as any).reasons) {
                trimmedDecision.reasons = (decision as any).reasons;
              }
              
              return trimmedDecision;
            }
            
            // Non-trimmed path – decision already contains reasons when INCLUDE_REASONS was supplied to SDK
            return decision;
          });
          
          // ENABLED_FLAGS_ONLY filtering (only meaningful for multi-flag endpoints)
          if (decideOptionsArr.includes('ENABLED_FLAGS_ONLY')) {
            decisions = decisions.filter((d: any) => d && d.enabled === true);
          }
          
          const response = { decisions };
          
          // Add decisions to the context for headers/cookies
          if (requestContext && decisions.length > 0) {
            try {
              // Import the serializer for header/cookie format
              const { getSerializedArray } = await import('../../utils/decisionUtils.js');
              
              // Get decision options from the array we built above
              const excludeVariables = decideOptionsArr.includes('EXCLUDE_VARIABLES');
              const includeReasons = decideOptionsArr.includes('INCLUDE_REASONS');
              const enabledFlagsOnly = decideOptionsArr.includes('ENABLED_FLAGS_ONLY');
              
              // Serialize all decisions using the same function format from v1
              // We need to re-serialize to ensure the format is consistent with v1
              const serializedDecisions = getSerializedArray(
                Object.values(allDecisions || {}), // Raw decisions from SDK
                excludeVariables,
                includeReasons,
                enabledFlagsOnly,
                trimmedDecisions,
                method
              );
              
              // Store the serialized array in the context for header/cookie generation
              requestContext.decisions = serializedDecisions;
              
              this.logger.info(`${this.logPrefix} Added ${serializedDecisions.length} serialized decisions to request context for headers/cookies`);
            } catch (error) {
              this.logger.error(`${this.logPrefix} Failed to serialize decisions for headers/cookies:`, error);
              // Store unprocessed decisions as fallback
              requestContext.decisions = decisions;
            }
          }
          
          this.logger.debug(`${this.logPrefix} Returning ${decisions.length} decisions`);
          return this.createJsonResponse(requestId, 200, response, method, requestContext);
        } else {
          // decideAll not implemented in the SDK
          this.logger.error(`${this.logPrefix} Decide-all not implemented in the SDK`);
          return this.createJsonResponse(requestId, 501, { error: "Decide-all not implemented" }, method, requestContext);
        }
      } catch (error) {
        this.logger.error(`${this.logPrefix} Error getting decisions for all flags:`, error);
        return this.createJsonResponse(requestId, 500, { 
          error: "Error getting decisions for all flags", 
          message: error instanceof Error ? error.message : String(error)
        }, method, requestContext);
      }
    } catch (error) {
      const method = requestAdapter.getMethod();
      
      // Try to get context for POST requests in error case
      const requestContext = method === 'POST' ? 
        await this.getRequestConfig(requestAdapter).catch(() => null) : undefined;
        
      this.logger.error(`${this.logPrefix} Error handling decide-all request:`, error);
      return this.createErrorResponse(requestId, 500, "Error processing decide-all request", method, requestContext);
    }
  }

  /**
   * Handles batch decide requests for specified feature flags.
   * @param requestAdapter - The request adapter.
   * @param requestId - The unique request ID.
   * @returns A promise resolving to the ResponseResult.
   */
  private async handleDecideForKeysRequest(
    requestAdapter: IRequestAdapter,
    requestId: string
  ): Promise<ResponseResult> {
    try {
      this.logger.info(`${this.logPrefix} Processing decide-for-keys request ${requestId}`);
      const method = requestAdapter.getMethod();
      
      // Only get request context for POST requests - respecting design intent
      const requestContext = method === 'POST' ? 
        await this.getRequestConfig(requestAdapter) : undefined;
      
      if (!this.decisionService) {
        this.logger.error(`${this.logPrefix} Decision service not available`);
        return this.createJsonResponse(requestId, 501, { error: "Decision service not available" }, method, requestContext);
      }
      
      // Get request body or URL parameters
      const requestBody = await this.getRequestBody(requestAdapter);
      const urlParams = this.parseUrlParams(requestAdapter.getUrl().search);
      
      // Get decision parameters from body or URL
      const userId = requestBody?.userId || urlParams.userId || 
                     requestBody?.visitorId || urlParams.visitorId || 
                     requestAdapter.getHeader('X-Optimizely-Visitor-Id');
      
      // Check for auto-generation of visitor ID if requested
      let finalUserId = userId;
      const overrideVisitorId = urlParams.overrideVisitorId === 'true' || 
                              requestAdapter.getHeader('X-Optimizely-Override-Visitor-Id') === 'true';
                              
      if (overrideVisitorId) {
        finalUserId = this.generateUUID();
        this.logger.debug(`${this.logPrefix} Auto-generated visitor ID due to override: ${finalUserId}`);
        if (requestContext?.configMetadata) {
          requestContext.configMetadata.visitorId = finalUserId;
          requestContext.configMetadata.visitorIdFrom = 'override';
        }
      }
      
      const attributes = requestBody?.attributes || {};
      const sdkKey = requestBody?.sdkKey || urlParams.sdkKey || requestAdapter.getHeader('X-Optimizely-SDK-Key');
      
      // Support headers for flag keys
      const headerFlagKey = requestAdapter.getHeader('X-Optimizely-Flag-Key');
      const headerFlagKeysRaw = requestAdapter.getHeader('X-Optimizely-Flag-Keys');
      let flagKeysFromHeader: string[] = [];
      if (headerFlagKey) {
        flagKeysFromHeader = [headerFlagKey];
      } else if (headerFlagKeysRaw) {
        try {
          const parsed = JSON.parse(headerFlagKeysRaw);
          flagKeysFromHeader = Array.isArray(parsed) ? parsed : [parsed];
        } catch (e) {
          flagKeysFromHeader = headerFlagKeysRaw.split(',').map(k => k.trim());
        }
      }
      
      // Parse flagKeys from URL if they're in comma-separated or array format
      const urlFlagKeysRaw: any = urlParams.flagKeys || urlParams.keys;
      let flagKeysFromUrlParsed: string[] = [];
      if (typeof urlFlagKeysRaw === 'string') {
        flagKeysFromUrlParsed = urlFlagKeysRaw.split(',').map(key => key.trim());
      } else if (Array.isArray(urlFlagKeysRaw)) {
        flagKeysFromUrlParsed = urlFlagKeysRaw;
      }
      
      // Combine all sources of flag keys, prioritizing body > header > URL
      let flagKeys: string[] = [];
      if (Array.isArray(requestBody?.flagKeys || requestBody?.keys)) {
        flagKeys = requestBody.flagKeys || requestBody.keys;
      } else if (flagKeysFromHeader.length > 0) {
        flagKeys = flagKeysFromHeader;
      } else if (flagKeysFromUrlParsed.length > 0) {
        flagKeys = flagKeysFromUrlParsed;
      }
      
      // Update metadata if header supplied the keys
      if (flagKeysFromHeader.length > 0 && requestContext?.configMetadata) {
        requestContext.configMetadata.flagKeysDecided = flagKeys;
        requestContext.configMetadata.flagKeysFrom = 'header';
      }
      
      // Check for trimmedDecisions parameter
      const headerTrimmedDecisions = requestAdapter.getHeader('X-Optimizely-Trimmed-Decisions');
      const trimmedDecisions = 
        requestBody?.trimmedDecisions === true || 
        urlParams.trimmedDecisions === 'true' || 
        headerTrimmedDecisions === 'true';
      
      this.logger.debug(`${this.logPrefix} Decide-for-keys parameters:`, {
        userId: finalUserId,
        flagKeysCount: flagKeys.length,
        attributeCount: Object.keys(attributes).length,
        sdkKey: sdkKey ? `${sdkKey.substring(0, 4)}...` : undefined, // Log only first 4 chars for security
        trimmedDecisions
      });
      
      // Validate required parameters
      if (!finalUserId) {
        this.logger.warn(`${this.logPrefix} Missing userId/visitorId parameter`);
        return this.createJsonResponse(requestId, 400, { error: "userId is required (can be provided as visitorId or X-Optimizely-Visitor-Id header)" }, method, requestContext);
      }
      
      if (!sdkKey) {
        this.logger.warn(`${this.logPrefix} Missing sdkKey parameter`);
        return this.createJsonResponse(requestId, 400, { error: "sdkKey is required" }, method, requestContext);
      }
      
      if (!flagKeys || !Array.isArray(flagKeys) || flagKeys.length === 0) {
        this.logger.warn(`${this.logPrefix} Missing or invalid flagKeys parameter`);
        return this.createJsonResponse(requestId, 400, { error: "flagKeys or keys is required and must be an array" }, method, requestContext);
      }
      
      // Get decisions
      try {
        // Create user context
        const userContext = { userId: finalUserId, attributes };
        
        // Store the decisions in an array
        const decisions: any[] = [];
        
        // Decide for each specified flag key
        for (const flagKey of flagKeys) {
          try {
            // Collect decide options from all input sources
            const decideOptionsArr = this.collectDecideOptions(requestAdapter, requestBody || {}, urlParams);
            if (decideOptionsArr.length > 0 && requestContext?.configMetadata) {
              requestContext.configMetadata.decideOptions = decideOptionsArr;
            }
            
            // Get decision for this flag
            const options: any = sdkKey ? { sdkKey } : {};
            if (decideOptionsArr.length > 0) options.decideOptions = decideOptionsArr;
            const decision = await this.decisionService.getDecision(
              finalUserId,
              flagKey,
              attributes,
              options
            );
            
            // If a decision was returned, add it to the results
            if (decision) {
              // Check if ENABLED_FLAGS_ONLY is set
              const enabledFlagsOnly = decideOptionsArr.includes('ENABLED_FLAGS_ONLY');
              
              // Skip disabled flags if ENABLED_FLAGS_ONLY is set
              if (enabledFlagsOnly && decision.enabled === false) {
                this.logger.debug(`${this.logPrefix} Skipping disabled flag ${flagKey} due to ENABLED_FLAGS_ONLY option`);
                continue;
              }
              
              if (trimmedDecisions) {
                const trimmedDecision: Record<string, any> = {
                  flagKey: decision.flagKey,
                  enabled: decision.enabled,
                  variationKey: decision.variationKey,
                };

                if (decision.experimentKey) trimmedDecision.experimentKey = decision.experimentKey;
                if (decision.ruleKey) trimmedDecision.ruleKey = decision.ruleKey;

                if (!decideOptionsArr.includes('EXCLUDE_VARIABLES')) {
                  trimmedDecision.variables = decision.variables;
                }

                if (decideOptionsArr.includes('INCLUDE_REASONS') && (decision as any).reasons) {
                  trimmedDecision.reasons = (decision as any).reasons;
                }

                decisions.push(trimmedDecision);
              } else {
                decisions.push(decision);
              }
            } else {
              // Check if ENABLED_FLAGS_ONLY is set
              const enabledFlagsOnly = decideOptionsArr.includes('ENABLED_FLAGS_ONLY');
              
              // Skip adding default disabled decision if ENABLED_FLAGS_ONLY is set
              if (enabledFlagsOnly) {
                this.logger.debug(`${this.logPrefix} Skipping default disabled flag ${flagKey} due to ENABLED_FLAGS_ONLY option`);
                continue;
              }
              
              // If no decision was returned, add a default "disabled" decision
              decisions.push({
                flagKey,
                enabled: false,
                variables: {}
              });
            }
          } catch (flagError) {
            this.logger.error(`${this.logPrefix} Error getting decision for flag ${flagKey}:`, flagError);
            
            // Add an error decision for this flag
            decisions.push({
              flagKey,
              enabled: false,
              error: flagError instanceof Error ? flagError.message : String(flagError)
            });
          }
        }
        
        this.logger.debug(`${this.logPrefix} Returning ${decisions.length} decisions`);
        return this.createJsonResponse(requestId, 200, { decisions }, method, requestContext);
      } catch (error) {
        this.logger.error(`${this.logPrefix} Error getting decisions for keys:`, error);
        return this.createJsonResponse(requestId, 500, {
          error: "Error getting decisions for keys",
          message: error instanceof Error ? error.message : String(error)
        }, method, requestContext);
      }
    } catch (error) {
      const method = requestAdapter.getMethod();
      
      // Try to get context for POST requests in error case
      const requestContext = method === 'POST' ? 
        await this.getRequestConfig(requestAdapter).catch(() => null) : undefined;
        
      this.logger.error(`${this.logPrefix} Error handling decide-for-keys request:`, error);
      return this.createErrorResponse(requestId, 500, "Error processing decide-for-keys request", method, requestContext);
    }
  }

  /**
   * Handles requests to the debug API endpoint for testing purposes.
   * @param requestAdapter - The request adapter.
   * @param requestId - The unique request ID.
   * @returns A promise resolving to the ResponseResult.
   */
  private async handleDebugRequest(
    requestAdapter: IRequestAdapter,
    requestId: string
  ): Promise<ResponseResult> {
    const method = requestAdapter.getMethod();
    
    // Only allow POST method
    if (method !== 'POST') {
      return this.createJsonResponse(requestId, 405, { 
        error: "Method not allowed",
        message: "Only POST method is supported for debug endpoint"
      }, method);
    }
    
    try {
      // Get request configuration
      const config = await this.getRequestConfig(requestAdapter);
      
      // Extract request information for debugging
      const debugInfo = {
        requestId,
        method,
        path: requestAdapter.getUrl().pathname,
        headers: this.getSafeHeaders(requestAdapter),
        queryParams: this.parseUrlParams(requestAdapter.getUrl().search),
        config,
        attributes: config.attributes || {},
        eventTags: config.eventTags || {},  // Add event tags to debug output
        eventKey: config.eventKey  // Add event key to debug output
      };
      
      // Log debug request for monitoring
      this.logger.info(`${this.logPrefix} Debug request ${requestId}:`, { 
        method,
        path: debugInfo.path,
        attributeKeys: Object.keys(debugInfo.attributes)
      });
      
      return this.createJsonResponse(requestId, 200, debugInfo, method);
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error handling debug request:`, error);
      return this.createErrorResponse(requestId, 500, "Error processing debug request", method);
    }
  }

  /**
   * Retrieves the complete request configuration including metadata for the given request
   * @param requestAdapter - The request adapter
   * @returns The request configuration including metadata
   */
  private async getRequestConfig(requestAdapter: IRequestAdapter): Promise<RequestConfig> {
    // Get basic request data
    const requestUrl = requestAdapter.getUrl();
    const requestMethod = requestAdapter.getMethod();
    const headers = this.extractHeaders(requestAdapter);
    const queryParams = this.parseUrlParams(requestUrl.search);
    
    // Initialize metadata
    const configMetadata = this.initializeConfigMetadata();
    
    // Extract SDK Key with source tracking
    let sdkKey = null;
    let sdkKeyFrom = '';
    if (headers['x-optimizely-sdk-key']) {
      sdkKey = headers['x-optimizely-sdk-key'];
      sdkKeyFrom = 'header';
    } else if (queryParams.sdkKey) {
      sdkKey = queryParams.sdkKey;
      sdkKeyFrom = 'query';
    }
    
    // Extract User/Visitor ID with source tracking
    let userId = null;
    let visitorId = null;
    let visitorIdFrom = '';
    
    // First check headers
    if (headers['x-optimizely-user-id']) {
      userId = headers['x-optimizely-user-id'];
      visitorId = headers['x-optimizely-user-id'];
      visitorIdFrom = 'header';
    } else if (headers['x-optimizely-visitor-id']) {
      visitorId = headers['x-optimizely-visitor-id'];
      visitorIdFrom = 'header';
    }
    // Then check query params, only if not found in headers
    else if (queryParams.userId) {
      userId = queryParams.userId;
      visitorId = queryParams.userId;
      visitorIdFrom = 'query';
    } else if (queryParams.visitorId) {
      visitorId = queryParams.visitorId;
      visitorIdFrom = 'query';
    }
    
    // Extract Flag Key(s) with source tracking
    // First check headers
    if (headers['x-optimizely-flag-key']) {
      configMetadata.flagKeysDecided = [headers['x-optimizely-flag-key']];
      configMetadata.flagKeysFrom = 'header';
    }
    // Then check query params if not found in headers
    else if (queryParams.flagKey) {
      configMetadata.flagKeysDecided = [queryParams.flagKey];
      configMetadata.flagKeysFrom = 'query';
    }
    // Multi-value keys query param
    else if (queryParams.keys) {
      // Handle single value or array of values
      if (Array.isArray(queryParams.keys)) {
        configMetadata.flagKeysDecided = queryParams.keys;
      } else {
        // Split by comma if it's a comma-separated string
        configMetadata.flagKeysDecided = queryParams.keys.includes(',') ? 
          queryParams.keys.split(',').map(k => k.trim()) : [queryParams.keys];
      }
      configMetadata.flagKeysFrom = 'query';
    }
    // Then check singular 'key' param (used by /decide endpoint)
    else if (queryParams.key) {
      configMetadata.flagKeysDecided = [queryParams.key];
      configMetadata.flagKeysFrom = 'query';
    }
    // Check flagKeys query param (array format)
    else if (queryParams.flagKeys) {
      try {
        // Try to parse as JSON if it's a string
        const parsedKeys = typeof queryParams.flagKeys === 'string' ? 
          JSON.parse(queryParams.flagKeys) : queryParams.flagKeys;
        
        configMetadata.flagKeysDecided = Array.isArray(parsedKeys) ? parsedKeys : [parsedKeys];
        configMetadata.flagKeysFrom = 'query';
      } catch (e) {
        // If parsing fails, treat as a single value
        configMetadata.flagKeysDecided = [queryParams.flagKeys];
        configMetadata.flagKeysFrom = 'query';
      }
    }
    
    // Initialize datafileFrom - this will be updated when the datafile is actually retrieved
    // by DatafileService based on where it comes from (KV or CDN)
    if (this.configService.getEnableDatafileFromKV()) {
      // Set initial source expectation - will be confirmed during actual retrieval
      configMetadata.datafileFrom = 'kv';
    } else {
      configMetadata.datafileFrom = 'cdn';
    }
    
    // --- HEADER/COOKIE CONTROL LOGIC ---
    // Defaults (from v1)
    const defaultSetResponseHeaders = true;
    const defaultSetResponseCookies = true;
    const defaultSetRequestHeaders = true;
    const defaultSetRequestCookies = true;

    // Extract from headers (highest priority)
    const setResponseHeadersHeader = headers['x-optimizely-set-response-headers'];
    const setResponseCookiesHeader = headers['x-optimizely-set-response-cookies'];
    const setRequestHeadersHeader = headers['x-optimizely-set-request-headers'];
    const setRequestCookiesHeader = headers['x-optimizely-set-request-cookies'];

    // Extract from query params (next priority)
    const setResponseHeadersQuery = queryParams.setResponseHeaders;
    const setResponseCookiesQuery = queryParams.setResponseCookies;
    const setRequestHeadersQuery = queryParams.setRequestHeaders;
    const setRequestCookiesQuery = queryParams.setRequestCookies;

    // Extract from body (lowest priority before default)
    let setResponseHeadersBody: any = undefined;
    let setResponseCookiesBody: any = undefined;
    let setRequestHeadersBody: any = undefined;
    let setRequestCookiesBody: any = undefined;
    try {
      const requestBody = await this.getRequestBody(requestAdapter);
      if (requestBody) {
        setResponseHeadersBody = requestBody.setResponseHeaders;
        setResponseCookiesBody = requestBody.setResponseCookies;
        setRequestHeadersBody = requestBody.setRequestHeaders;
        setRequestCookiesBody = requestBody.setRequestCookies;
      }
    } catch (error) {
      this.logger.debug(`${this.logPrefix} Error parsing request body for header/cookie control:`, error);
    }

    // Resolve final values with correct precedence
    const setResponseHeaders = this.parseBoolean(
      setResponseHeadersHeader ?? setResponseHeadersQuery ?? setResponseHeadersBody,
      defaultSetResponseHeaders
    );
    const setResponseCookies = this.parseBoolean(
      setResponseCookiesHeader ?? setResponseCookiesQuery ?? setResponseCookiesBody,
      defaultSetResponseCookies
    );
    const setRequestHeaders = this.parseBoolean(
      setRequestHeadersHeader ?? setRequestHeadersQuery ?? setRequestHeadersBody,
      defaultSetRequestHeaders
    );
    const setRequestCookies = this.parseBoolean(
      setRequestCookiesHeader ?? setRequestCookiesQuery ?? setRequestCookiesBody,
      defaultSetRequestCookies
    );

    this.logger.debug(`${this.logPrefix} Header/Cookie Control: setResponseHeaders=${setResponseHeaders}, setResponseCookies=${setResponseCookies}, setRequestHeaders=${setRequestHeaders}, setRequestCookies=${setRequestCookies}`);

    // Create a new request config with the extracted data
    const requestConfig: RequestConfig = {
      sdkKey,
      userId,
      visitorId,
      configMetadata,
      setResponseHeaders,
      setResponseCookies,
      setRequestHeaders,
      setRequestCookies
    };
    
    // Populate the metadata with values and sources
    if (configMetadata) {
      configMetadata.sdkKey = sdkKey;
      configMetadata.sdkKeyFrom = sdkKeyFrom || 'initialization';
      configMetadata.visitorId = visitorId;
      configMetadata.visitorIdFrom = visitorIdFrom;
      
      // Ensure userId and visitorId are in sync
      if (visitorId && !userId) {
        requestConfig.userId = visitorId;  // Sync userId from visitorId when userId is null but visitorId exists
      }
      
      // Set agentServerMode based on path detection
      const path = requestUrl.pathname;
      configMetadata.pathName = path;
      configMetadata.agentServerMode = path.startsWith('/api/');
      
      // Try to get the body for additional data
      try {
        const requestBody = await this.getRequestBody(requestAdapter);
        if (requestBody) {
          // Override with body parameters if present - they take highest precedence
          if (requestBody.userId || requestBody.visitorId) {
            // If a body has either userId or visitorId, it takes precedence
            configMetadata.visitorId = requestBody.visitorId || requestBody.userId || visitorId;
            configMetadata.visitorIdFrom = 'body';
            requestConfig.visitorId = configMetadata.visitorId;
            requestConfig.userId = requestBody.userId || requestBody.visitorId || requestConfig.userId;
          }
          
          if (requestBody.sdkKey) {
            configMetadata.sdkKey = requestBody.sdkKey;
            configMetadata.sdkKeyFrom = 'body';
            requestConfig.sdkKey = requestBody.sdkKey;
          }
          
          // Use extractAttributes to get attributes and their source
          const attributes = await extractAttributes(requestAdapter, this.logger);
          if (Object.keys(attributes).length > 0) {
            configMetadata.attributes = attributes;
            configMetadata.attributesFrom = 'body';
            requestConfig.attributes = attributes;
          }
          
          // Add event tags if available
          if (requestBody.eventTags) {
            configMetadata.eventTags = requestBody.eventTags;
            configMetadata.eventTagsFrom = 'body';
            requestConfig.eventTags = requestBody.eventTags;
          }
          
          // Add event key if available 
          if (requestBody.eventKey) {
            requestConfig.eventKey = requestBody.eventKey;
          }
          
          // Add decide options from the request body if available
          if (requestBody.decideOptions || requestBody.options) {
            configMetadata.decideOptions = requestBody.decideOptions || requestBody.options || [];
          }
          
          // If flag keys are provided in the body - body takes precedence over headers/query
          if (requestBody.flagKeys && Array.isArray(requestBody.flagKeys)) {
            configMetadata.flagKeysDecided = requestBody.flagKeys;
            configMetadata.flagKeysFrom = 'body';
          } else if (requestBody.flagKey) {
            configMetadata.flagKeysDecided = [requestBody.flagKey];
            configMetadata.flagKeysFrom = 'body';
          } else if (requestBody.key) { // singular 'key' field for /decide
            configMetadata.flagKeysDecided = [requestBody.key];
            configMetadata.flagKeysFrom = 'body';
          }
          
          // If datafileFromKV is set in the body, update the datafile source expectation
          if (requestBody.datafileFromKV === true) {
            configMetadata.datafileFrom = 'kv';
          } else if (requestBody.datafileFromKV === false) {
            configMetadata.datafileFrom = 'cdn';
          }
        }
      } catch (error) {
        this.logger.debug(`${this.logPrefix} Error parsing request body for metadata:`, error);
      }
    }
    
    return requestConfig;
  }
  
  /**
   * Extracts headers from the request adapter into a lowercase dictionary
   */
  private extractHeaders(requestAdapter: IRequestAdapter): Record<string, string> {
    const headerObj: Record<string, string> = {};
    
    // Get headers from the adapter
    const headers = requestAdapter.getHeaders();
    
    // Convert headers to lowercase dictionary
    headers.forEach((value, key) => {
      headerObj[key.toLowerCase()] = value;
    });
    
    return headerObj;
  }

  /**
   * Gets headers from request adapter with sensitive information removed.
   * @param requestAdapter - The request adapter.
   * @returns Record of safe headers.
   */
  private getSafeHeaders(requestAdapter: IRequestAdapter): Record<string, string> {
    const headers = requestAdapter.getHeaders();
    const safeHeaders: Record<string, string> = {};
    
    headers.forEach((value, key) => {
      // Skip authorization and cookie headers
      if (key.toLowerCase() === 'authorization' || key.toLowerCase() === 'cookie') {
        safeHeaders[key] = '[REDACTED]';
      } else {
        safeHeaders[key] = value;
      }
    });
    
    return safeHeaders;
  }

  /**
   * Creates a JSON response.
   * @param requestId - The unique request ID.
   * @param status - The HTTP status code.
   * @param body - The response body.
   * @param method - The HTTP method of the request.
   * @param requestContext - The request context containing metadata.
   * @returns The ResponseResult.
   */
  private createJsonResponse(requestId: string, status: number, body: any, method?: string, requestContext?: any): ResponseResult {
    // Start with all headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-ID': requestId,
      [this.implementationVersionHeader]: 'v2'
    };

    // Only add Cache-Control if override is not enabled
    if (!this.configService.getOverrideCache()) {
      headers['Cache-Control'] = 'no-store';
    } else {
      this.logger.debug(`${this.logPrefix} Cache-Control header omitted due to overrideCache setting`);
    }

    // Check if response metadata should be included
    if (this.configService.getEnableResponseMetadata()) {
      body = this.addResponseMetadata(body, method, requestContext);
    }

    // --- DEBUG HEADERS ---
    // Only add debug headers if explicitly enabled through config or required for debug endpoints
    const isDebugEndpoint = method === 'POST' && requestContext?.configMetadata?.pathName?.endsWith('/api/debug');
    if (isDebugEndpoint || this.configService.getEnableDebugHeaders()) {
      this.logger.info(`${this.logPrefix} Adding debug headers to response (requestContext=${!!requestContext})`);
      
      if (requestContext) {
        // Add debug headers to responses
        headers['X-Optimizely-Debug-Config'] = JSON.stringify({
          setResponseHeaders: requestContext.setResponseHeaders,
          setResponseCookies: requestContext.setResponseCookies,
          userId: (requestContext.userId || requestContext.visitorId) 
            ? `${(requestContext.userId || requestContext.visitorId).substring(0, 8)}...` 
            : null,
          decisions: !!requestContext.decisions
        });
        
        // Add debug header for decision format
        if (requestContext.decisions) {
          const sampleDecision = Array.isArray(requestContext.decisions) && requestContext.decisions.length > 0 
            ? requestContext.decisions[0] 
            : requestContext.decisions;
          
          headers['X-Optimizely-Debug-Decision-Format'] = JSON.stringify({
            type: typeof requestContext.decisions,
            isArray: Array.isArray(requestContext.decisions),
            length: Array.isArray(requestContext.decisions) ? requestContext.decisions.length : null,
            sample: sampleDecision,
            hasKeys: Array.isArray(requestContext.decisions) && requestContext.decisions.length > 0 
              ? Object.keys(requestContext.decisions[0]) 
              : (typeof requestContext.decisions === 'object' ? Object.keys(requestContext.decisions) : null)
          });
        }
        
        // Add a debug version of the decisions header
        const decisionsHeaderName = this.configService.getDecisionsHeaderName();
        if (!headers[decisionsHeaderName]) {
          if (requestContext.decisions) {
            // Add real decisions (for debugging only)
            const decisionsValue = typeof requestContext.decisions === 'string' 
              ? requestContext.decisions 
              : JSON.stringify(requestContext.decisions);
            headers[decisionsHeaderName] = decisionsValue;
            this.logger.info(`${this.logPrefix} DEBUG: Adding ${decisionsHeaderName} header (from context.decisions) for debugging`);
          } else {
            // Add empty decisions debug header
            headers[decisionsHeaderName] = JSON.stringify({ debug: "No decisions in context" });
            this.logger.info(`${this.logPrefix} DEBUG: Adding empty ${decisionsHeaderName} header for debugging`);
          }
        }
      }
    }

    // --- HEADER/COOKIE CONTROL LOGIC ---
    // Only apply if requestContext is present and has the flags
    if (requestContext && typeof requestContext.setResponseHeaders === 'boolean') {
      if (!requestContext.setResponseHeaders) {
        // Only keep essential headers and debug headers
        const essentialHeaders = [
          'Content-Type', 
          'X-Request-ID', 
          this.implementationVersionHeader,
          // Also keep debug headers 
          'X-Optimizely-Debug-Config',
          this.configService.getDecisionsHeaderName(),
          'X-Optimizely-Edge-Decisions'
        ];
        
        for (const key of Object.keys(headers)) {
          if (!essentialHeaders.includes(key) && !key.includes('Debug')) {
            delete headers[key];
          }
        }
        this.logger.debug(`${this.logPrefix} setResponseHeaders=false: Only essential headers included in response.`);
      } else {
        this.logger.debug(`${this.logPrefix} setResponseHeaders=true: All standard headers included in response.`);
      }
    }

    // Prepare cookie array for Set-Cookie headers
    const cookieHeaders: string[] = [];

    // Add visitor ID cookie if present
    if (requestContext && typeof requestContext.setResponseCookies === 'boolean' && requestContext.setResponseCookies) {
      const visitorId = requestContext.visitorId;
      if (visitorId) {
        // Use config-driven cookie name for visitor ID
        const visitorIdCookieName = this.configService.getVisitorIdCookieName();
        const visitorIdCookie = `${visitorIdCookieName}=${visitorId}; Path=/; Max-Age=86400`;
        cookieHeaders.push(visitorIdCookie);
        this.logger.debug(`${this.logPrefix} setResponseCookies=true: Set-Cookie header added for ${visitorIdCookieName}.`);
      }
      
      // Add decisions cookie if present in context
      if (requestContext.decisions) {
        const decisionsCookieName = this.configService.getDecisionsCookieName();
        const decisionsValue = typeof requestContext.decisions === 'string' 
          ? requestContext.decisions 
          : JSON.stringify(requestContext.decisions);
        
        // No encoding - use the value directly
        const decisionsCookie = `${decisionsCookieName}=${decisionsValue}; Path=/; Max-Age=86400`;
        cookieHeaders.push(decisionsCookie);
        this.logger.debug(`${this.logPrefix} setResponseCookies=true: Set-Cookie header added for ${decisionsCookieName}.`);
      }
    }

    // Set cookies if we have any
    if (cookieHeaders.length > 0) {
      // Join the array of cookie strings with a newline to ensure proper formatting
      headers['Set-Cookie'] = cookieHeaders.join('\n');
    }

    // Add config-driven headers for parity if present in context
    if (requestContext && typeof requestContext.setResponseHeaders === 'boolean' && requestContext.setResponseHeaders) {
      if (requestContext.visitorId) {
        const visitorIdHeaderName = this.configService.getVisitorIdHeaderName();
        headers[visitorIdHeaderName] = requestContext.visitorId;
        this.logger.debug(`${this.logPrefix} setResponseHeaders=true: Added ${visitorIdHeaderName} header with value: ${requestContext.visitorId}`);
      }
      
      if (requestContext.decisions) {
        const decisionsHeaderName = this.configService.getDecisionsHeaderName();
        const decisionsValue = typeof requestContext.decisions === 'string' 
          ? requestContext.decisions 
          : JSON.stringify(requestContext.decisions);
        headers[decisionsHeaderName] = decisionsValue;
        this.logger.debug(`${this.logPrefix} setResponseHeaders=true: Added ${decisionsHeaderName} header with value: ${decisionsValue}`);
      }
    }

    return {
      status,
      body: JSON.stringify(body),
      headers
    };
  }

  /**
   * Adds metadata to the response body if enabled.
   * @param body - The original response body.
   * @param requestMethod - The HTTP method of the request.
   * @param requestContext - The request context containing metadata.
   * @returns The response body with metadata added.
   */
  private addResponseMetadata(body: any, requestMethod?: string, requestContext?: any): any {
    // Only add metadata to POST requests; for others log it for diagnostics
    if (requestMethod && requestMethod !== 'POST') {
      if (requestContext?.configMetadata) {
        this.logger.debug(`${this.logPrefix} [Meta] GET/other response metadata suppressed from output:`, requestContext.configMetadata);
      }
      return body;
    }
    
    if (!body || typeof body !== 'object') {
      return body;
    }
    
    // Use the existing metadata from the request context if available
    const metadata = requestContext?.configMetadata || this.initializeConfigMetadata();
    
    // If body is already an object, add metadata to it
    if (Array.isArray(body)) {
      // For array responses, wrap in an object
      return {
        data: body,
        metadata
      };
    } else {
      // For object responses, add metadata property
      return {
        ...body,
        metadata
      };
    }
  }

  /**
   * Creates an error response.
   * @param requestId - The unique request ID.
   * @param status - The HTTP status code.
   * @param message - The error message.
   * @param method - The HTTP method of the request.
   * @param requestContext - The request context containing metadata.
   * @returns The ResponseResult.
   */
  private createErrorResponse(requestId: string, status: number, message: string, method?: string, requestContext?: any): ResponseResult {
    return this.createJsonResponse(requestId, status, { error: message }, method, requestContext);
  }

  /**
   * Parses URL search parameters into a dictionary
   */
  private parseUrlParams(searchString: string): Record<string, string> {
    const params: Record<string, string> = {};
    const searchParams = new URLSearchParams(searchString);
    
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
    
    return params;
  }

  /**
   * Gets the request body as a JSON object.
   * @param requestAdapter - The request adapter.
   * @returns A promise resolving to the request body.
   */
  private async getRequestBody(requestAdapter: IRequestAdapter): Promise<any> {
    try {
      const body = await requestAdapter.getBody();
      if (!body) {
        return null;
      }
      
      return typeof body === 'string' ? JSON.parse(body) : body;
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error parsing request body:`, error);
      return null;
    }
  }

  /**
   * Checks if the request is from an admin user.
   * @param requestAdapter - The request adapter.
   * @returns A promise resolving to a boolean indicating if the request is from an admin.
   */
  private async isAdminRequest(requestAdapter: IRequestAdapter): Promise<boolean> {
    try {
      // For now, just check if the admin token is present
      // In a production environment, this would be more robust
      const adminToken = requestAdapter.getHeader('x-admin-token');
      const configToken = this.configService.getAdminToken();
      
      if (!adminToken || !configToken) {
        return false;
      }
      
      return adminToken === configToken;
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error checking admin request:`, error);
      return false;
    }
  }

  /**
   * Extracts flag keys from a datafile and saves them.
   * @param sdkKey - The SDK key.
   * @param datafile - The datafile content.
   */
  private async updateFlagKeysFromDatafile(sdkKey: string, datafile: any): Promise<void> {
    try {
      const flagKeys: string[] = [];
      
      // Extract feature keys from datafile
      if (datafile.featureFlags && Array.isArray(datafile.featureFlags)) {
        for (const flag of datafile.featureFlags) {
          if (flag.key) {
            flagKeys.push(flag.key);
          }
        }
      }
      
      // Extract experiment keys from datafile
      if (datafile.experiments && Array.isArray(datafile.experiments)) {
        for (const experiment of datafile.experiments) {
          if (experiment.key) {
            flagKeys.push(experiment.key);
          }
        }
      }
      
      if (flagKeys.length > 0) {
        await this.datafileService.saveFlagKeys(sdkKey, flagKeys);
        this.logger.info(`${this.logPrefix} Updated ${flagKeys.length} flag keys for SDK key ${this.hashSensitiveValue(sdkKey)}`);
      }
    } catch (error) {
      throw new Error(`Failed to update flag keys from datafile: ${error}`);
    }
  }

  /**
   * Creates a hash of a sensitive value for logging/metrics.
   * @param value - The sensitive value to hash.
   * @returns A hash of the input value.
   */
  private hashSensitiveValue(value: string): string {
    // Simple hashing function for privacy
    // In a real implementation, use a proper hashing algorithm
    return value.substring(0, 4) + '...';
  }

  /**
   * Generates a UUID.
   * @returns A UUID string.
   */
  private generateUUID(): string {
    return uuidv4();
  }

  /**
   * Initializes an empty config metadata template.
   * @returns An empty config metadata object.
   */
  private initializeConfigMetadata(): any {
    return {
      visitorId: '',
      visitorIdFrom: '',
      decideOptions: [],
      attributes: {},
      attributesFrom: '',
      eventTags: {},
      eventTagsFrom: '',
      sdkKey: '',
      sdkKeyFrom: '',
      datafileFrom: '',
      trimmedDecisions: true,
      decideAll: false,
      flagKeysDecided: [],
      flagKeysFrom: '',
      storedDecisionsFound: false,
      storedCookieDecisions: [],
      forcedDecisions: [],
      agentServerMode: false,
      pathName: '',
      cdnVariationSettings: {}
    };
  }

  /**
   * Collects decide options from headers, body and URL parameters into a unified array.
   * Header support:
   *   – Consolidated header:  X-Optimizely-Decide-Options  (JSON list or CSV)
   *   – Individual toggles:   X-Optimizely-Decide-Options-<OPTION>
   */
  private collectDecideOptions(
    requestAdapter: IRequestAdapter,
    requestBody: any,
    urlParams: Record<string, any>
  ): string[] {
    const opts = new Set<string>();

    // Body field decideOptions / options (array or CSV string)
    const bodyRaw = requestBody?.decideOptions || requestBody?.options;
    if (Array.isArray(bodyRaw)) bodyRaw.forEach((o: string) => opts.add(o.toUpperCase()));
    else if (typeof bodyRaw === 'string') bodyRaw.split(',').forEach(o => opts.add(o.trim().toUpperCase()));

    // Query param decideOptions=csv
    if (urlParams.decideOptions) {
      urlParams.decideOptions.split(',').forEach((o: string) => opts.add(o.trim().toUpperCase()));
    }

    // Headers
    const headers = requestAdapter.getHeaders();
    headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (lower === 'x-optimizely-decide-options') {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) parsed.forEach((o: string) => opts.add(o.toUpperCase()));
          else if (typeof parsed === 'string') opts.add(parsed.toUpperCase());
        } catch {
          value.split(',').forEach((o: string) => opts.add(o.trim().toUpperCase()));
        }
      } else if (lower.startsWith('x-optimizely-decide-options-')) {
        const optName = key.substring('X-Optimizely-Decide-Options-'.length).toUpperCase();
        opts.add(optName);
      }
    });

    return Array.from(opts);
  }

  private parseBoolean(value: any, defaultValue: boolean): boolean {
    if (value === undefined || value === null) return defaultValue;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return defaultValue;
  }
} 