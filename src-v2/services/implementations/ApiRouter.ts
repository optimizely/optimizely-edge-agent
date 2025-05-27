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

/**
 * Configuration object for API requests containing user context, SDK settings, and header/cookie control flags.
 * This interface defines the complete request configuration used throughout the API processing pipeline.
 */
interface RequestConfig {
  /** The SDK key for the Optimizely project */
  sdkKey: string | null;
  /** The user identifier for the request */
  userId: string | null;
  /** The visitor identifier for the request (can be same as userId) */
  visitorId: string | null;
  /** User attributes for targeting and segmentation */
  attributes?: Record<string, any>;
  /** Event tags for tracking additional metadata */
  eventTags?: Record<string, any>;
  /** Event key for tracking specific events */
  eventKey?: string;
  /** Configuration metadata including sources and tracking information */
  configMetadata: {
    /** SDK key value */
    sdkKey?: string | null;
    /** Source of the SDK key (header, query, body) */
    sdkKeyFrom?: string;
    /** Visitor ID value */
    visitorId?: string | null;
    /** User attributes object */
    attributes?: Record<string, any>;
    /** Decide options array for decision behavior */
    decideOptions?: string[];
    /** Additional metadata fields */
    [key: string]: any;
  } | null;
  /** Whether to set response headers */
  setResponseHeaders: boolean;
  /** Whether to set response cookies */
  setResponseCookies: boolean;
  /** Whether to set request headers */
  setRequestHeaders: boolean;
  /** Whether to set request cookies */
  setRequestCookies: boolean;
  /** Decisions array for header/cookie generation */
  decisions?: Record<string, any>;
}

/**
 * Service responsible for routing and handling API requests for the Optimizely Edge Agent.
 * 
 * This class implements the core API routing logic, handling various endpoints like:
 * - /api/datafile - Datafile management (GET/PUT/POST)
 * - /api/flagkeys - Flag keys management
 * - /api/decide - Single flag decisions
 * - /api/decide-all - All flags decisions
 * - /api/decide-for-keys - Multiple specific flags decisions
 * - /api/variations - Variation management
 * - /api/admin/* - Administrative endpoints
 * - /api/debug - Debug information
 * - Forced variation endpoints
 * 
 * The router supports both v1 and v2 API patterns and includes comprehensive
 * header/cookie control, metadata tracking, and response formatting.
 */
export class ApiRouter {
  /** Service for datafile and flag key operations */
  private datafileService: IDatafileService;
  /** Service for caching operations */
  private cacheService: ICacheService;
  /** Service for configuration management */
  private configService: IConfigurationService;
  /** Logger adapter for logging operations */
  private logger: ILoggerAdapter;
  /** Optional metrics adapter for tracking performance and usage */
  private metrics: IMetricsAdapter | undefined;
  /** Optional decision service for Optimizely SDK operations */
  private decisionService: IDecisionService | undefined;
  /** Log prefix for consistent logging */
  private readonly logPrefix = '[v2][ApiRouter]';
  /** Configurable API path prefix (default: '/api/') */
  private apiPathPrefix: string;
  /** Header name for implementation version tracking */
  private implementationVersionHeader: string = 'X-Implementation-Version';

  /**
   * Creates an instance of the ApiRouter.
   * 
   * @param datafileService - Service for datafile and flag key operations
   * @param cacheService - Service for caching operations
   * @param configService - Service for configuration management
   * @param logger - Logger adapter for logging operations
   * @param metrics - Optional metrics adapter for performance tracking
   * @param decisionService - Optional decision service for Optimizely SDK operations
   * @throws {Error} When required services are not provided
   * 
   * @example
   * ```typescript
   * const apiRouter = new ApiRouter(
   *   datafileService,
   *   cacheService,
   *   configService,
   *   logger,
   *   metricsAdapter,
   *   decisionService
   * );
   * ```
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
   * 
   * This is the main entry point for all API requests. It performs:
   * - Configuration initialization from the request
   * - FEX (Feature Experimentation) bypass checking
   * - Path-based routing to specific handlers
   * - Error handling and metrics tracking
   * - Response header management
   * 
   * @param requestAdapter - The adapter for the incoming request
   * @returns A promise resolving to the ResponseResult with status, body, and headers
   * 
   * @example
   * ```typescript
   * const response = await apiRouter.routeApiRequest(requestAdapter);
   * console.log(`Status: ${response.status}, Body: ${response.body}`);
   * ```
   */
  async routeApiRequest(requestAdapter: IRequestAdapter): Promise<ResponseResult> {
    const requestId = uuidv4();
    const method = requestAdapter.getMethod();
    const url = requestAdapter.getUrl();
    const path = url.pathname;
    
    // CRITICAL FIX: Initialize ConfigurationService with the request adapter FIRST
    // This ensures the ConfigurationService has the correct metadata before any other component uses it
    this.logger.info(`${this.logPrefix} [REQUEST:${requestId}] ===== INITIALIZING CONFIGURATION FROM REQUEST =====`);
    try {
      await this.configService.initialize(requestAdapter);
      this.logger.info(`${this.logPrefix} [REQUEST:${requestId}] Configuration initialized successfully`);
    } catch (error) {
      this.logger.error(`${this.logPrefix} [REQUEST:${requestId}] Failed to initialize configuration:`, error);
      // Continue processing - we'll use defaults
    }
    
    // Check for X-Optimizely-Enable-FEX header flag
    // If disabled (false), bypass all Optimizely SDK logic and process the request normally
    if (!this.configService.getEnableFex()) {
      this.logger.info(`${this.logPrefix} X-Optimizely-Enable-FEX header is disabled, bypassing Optimizely SDK logic`);
      
      // Return a properly formatted ResponseResult to indicate normal processing
      // This effectively treats the request as if Optimizely is not present
      return this.createJsonResponse(requestId, 200, {
        bypass: true,
        message: "Optimizely processing bypassed because X-Optimizely-Enable-FEX is false"
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
   * 
   * **GET Requests:**
   * - Retrieve datafile from KV storage or CDN based on configuration
   * - Supports ?datafileFromKV=true to force KV-only retrieval
   * 
   * **PUT/POST Requests (Admin only):**
   * - **Default behavior**: Expects datafile JSON in request body to save to KV storage
   * - **Operation modes** via ?operation parameter:
   *   - `?operation=refresh` - Fetches datafile from Optimizely CDN and saves to KV
   *   - `?operation=sync` - Same as refresh (alias)
   *   - `?operation=fetch` - Same as refresh (alias)
   *   - `?operation=update` - Default behavior (save provided body)
   *   - `?operation=save` - Same as update (alias)
   * - **Empty body handling**: Use ?allowEmpty=true to create minimal datafile structure
   * 
   * **Recommended CDN-to-KV Update:**
   * Use `PUT /api/datafile?operation=refresh` with SDK key in X-Optimizely-SDK-Key header
   * This fetches from CDN, saves to KV, and updates flag keys automatically.
   * 
   * @param requestAdapter - The request adapter
   * @param requestId - The unique request ID for tracking
   * @returns A promise resolving to the ResponseResult
   * @private
   * 
   * @example
   * ```typescript
   * // GET: Retrieve datafile
   * GET /api/datafile?sdkKey=your_sdk_key
   * 
   * // GET: Force KV-only retrieval
   * GET /api/datafile?sdkKey=your_sdk_key&datafileFromKV=true
   * 
   * // PUT: Save custom datafile JSON (default behavior)
   * PUT /api/datafile
   * Headers: X-Optimizely-SDK-Key: your_sdk_key
   * Body: { "version": "4", "experiments": [], ... }
   * 
   * // PUT: Fetch from CDN and update KV (recommended)
   * PUT /api/datafile?operation=refresh
   * Headers: X-Optimizely-SDK-Key: your_sdk_key
   * // No body required - fetches from CDN automatically
   * 
   * // POST: Create minimal datafile when no content available
   * POST /api/datafile?allowEmpty=true
   * Headers: X-Optimizely-SDK-Key: your_sdk_key
   * // Empty body allowed - creates minimal structure
   * 
   * // POST: Sync from CDN (same as refresh)
   * POST /api/datafile?operation=sync
   * Headers: X-Optimizely-SDK-Key: your_sdk_key
   * ```
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
    
    // Check for SDK key in query parameters and headers
    const params = this.parseUrlParams(url.search);
    const sdkKeyHeader = requestAdapter.getHeader('x-optimizely-sdk-key');
    const sdkKey = sdkKeyHeader || params.sdkKey || '';
    
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
        // Check if datafileFromKV is explicitly requested via query parameter
        const datafileFromKV = params.datafileFromKV === 'true';
        // Check if KV storage is enabled in configuration
        const isKVEnabled = this.configService.getEnableDatafileFromKV();
        
        this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] Handling datafile request: sdkKey=${sdkKey}, datafileFromKV=${datafileFromKV}, isKVEnabled=${isKVEnabled}`);
        
        // CASE 1: Explicit KV requested
        if (datafileFromKV) {
          // If KV is explicitly requested but not enabled, return error
          if (!isKVEnabled) {
            this.logger.info(`${this.logPrefix} [REQUEST:${requestId}] KV storage requested but not enabled`);
            this.metrics?.incrementCounter('api_errors_total', 1, {
              endpoint: `${this.apiPathPrefix}datafile`,
              method,
              error_type: 'kv_not_enabled'
            });
            return this.createJsonResponse(requestId, 400, { 
              error: "KV storage is not enabled for datafiles. Please enable it in configuration to use this feature." 
            }, method, requestContext);
          }
          
          // Attempt to get datafile from KV storage only
          this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] Fetching datafile from KV storage only`);
          const datafileTimer = this.metrics?.startTimer('datafile_fetch_duration');
          try {
            const datafile = await this.datafileService.getDatafile(sdkKey, { useKV: true, requestContext });
            if (datafileTimer) datafileTimer.stop();
            
            if (!datafile) {
              this.logger.info(`${this.logPrefix} [REQUEST:${requestId}] Datafile not found in KV storage`);
              this.metrics?.incrementCounter('api_errors_total', 1, {
                endpoint: `${this.apiPathPrefix}datafile`,
                method,
                error_type: 'datafile_not_found_kv'
              });
              return this.createJsonResponse(requestId, 404, { 
                error: "Datafile not found in KV storage for the provided SDK key." 
              }, method, requestContext);
            }
            
            this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] Successfully retrieved datafile from KV storage`);
            // Track datafile size
            if (typeof datafile === 'string') {
              this.metrics?.recordHistogram('datafile_size_bytes', datafile.length, { 
                endpoint: `${this.apiPathPrefix}datafile`,
                source: 'kv'
              });
            }
            
            return this.createJsonResponse(requestId, 200, JSON.parse(datafile), method, requestContext);
          } catch (kvError) {
            this.logger.error(`${this.logPrefix} [REQUEST:${requestId}] Error retrieving datafile from KV:`, kvError);
            this.metrics?.incrementCounter('api_errors_total', 1, {
              endpoint: `${this.apiPathPrefix}datafile`,
              method,
              error_type: 'kv_access_error'
            });
            return this.createJsonResponse(requestId, 500, { 
              error: "Error accessing KV storage: " + (kvError instanceof Error ? kvError.message : String(kvError)) 
            }, method, requestContext);
          }
        }
        
        // CASE 2: No explicit KV request (fallback behavior based on config)
        // Try KV first if enabled by configuration, then fall back to default source
        if (isKVEnabled) {
          this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] KV enabled by config, trying KV first with fallback`);
          try {
            const kvDatafile = await this.datafileService.getDatafile(sdkKey, { useKV: true, requestContext });
            if (kvDatafile) {
              this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] Found datafile in KV storage`);
              // Track datafile size and source
              if (typeof kvDatafile === 'string') {
                this.metrics?.recordHistogram('datafile_size_bytes', kvDatafile.length, { 
                  endpoint: `${this.apiPathPrefix}datafile`,
                  source: 'kv'
                });
              }
              return this.createJsonResponse(requestId, 200, JSON.parse(kvDatafile), method, requestContext);
            }
            // If not found in KV, fall through to default source
            this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] Datafile not found in KV, falling back to default source`);
          } catch (kvError) {
            // Log error but continue to fallback
            this.logger.warn(`${this.logPrefix} [REQUEST:${requestId}] Error retrieving from KV, falling back:`, kvError);
          }
        } else {
          this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] KV not enabled by config, using default source only`);
        }
        
        // Default source (CDN/config)
        this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] Fetching datafile from default source`);
        const datafileTimer = this.metrics?.startTimer('datafile_fetch_duration');
        try {
          // Pass useKV=false to explicitly use default source
          const datafile = await this.datafileService.getDatafile(sdkKey, { useKV: false, requestContext });
          if (datafileTimer) datafileTimer.stop();
          
          if (!datafile) {
            this.logger.info(`${this.logPrefix} [REQUEST:${requestId}] Datafile not found in default source`);
            this.metrics?.incrementCounter('api_errors_total', 1, {
              endpoint: `${this.apiPathPrefix}datafile`,
              method,
              error_type: 'datafile_not_found_default'
            });
            return this.createJsonResponse(requestId, 404, { 
              error: "Datafile not found for the provided SDK key." 
            }, method, requestContext);
          }
          
          this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] Successfully retrieved datafile from default source`);
          // Track datafile size and source
          if (typeof datafile === 'string') {
            this.metrics?.recordHistogram('datafile_size_bytes', datafile.length, { 
              endpoint: `${this.apiPathPrefix}datafile`,
              source: 'default'
            });
          }
          
          return this.createJsonResponse(requestId, 200, JSON.parse(datafile), method, requestContext);
        } catch (defaultError) {
          if (datafileTimer) datafileTimer.stop();
          this.logger.error(`${this.logPrefix} [REQUEST:${requestId}] Error retrieving datafile from default source:`, defaultError);
          this.metrics?.incrementCounter('api_errors_total', 1, {
            endpoint: `${this.apiPathPrefix}datafile`,
            method,
            error_type: 'default_source_error'
          });
          return this.createJsonResponse(requestId, 500, { 
            error: "Error retrieving datafile from default source: " + 
              (defaultError instanceof Error ? defaultError.message : String(defaultError)) 
          }, method, requestContext);
        }
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
        
        // Get datafile content from request body with smart handling
        const requestBody = await this.getRequestBody(requestAdapter);
        
        // Smart body handling: Check if this is a specific operation type
        const url = requestAdapter.getUrl();
        const urlParams = this.parseUrlParams(url.search);
        const operationType = urlParams.operation || 'update'; // Default to 'update'
        
        // Handle different operation types
        switch (operationType.toLowerCase()) {
          case 'refresh':
          case 'sync':
          case 'fetch':
            // For these operations, no body is required - fetch from CDN
            this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] Performing ${operationType} operation - fetching from CDN`);
            try {
              const refreshedDatafile = await this.datafileService.refreshDatafile(sdkKey, true);
              if (!refreshedDatafile) {
                return this.createJsonResponse(requestId, 404, { 
                  error: `Failed to ${operationType} datafile from CDN for SDK key ${sdkKey}` 
                }, method, requestContext);
              }
              
              // Update flag keys from refreshed datafile
              try {
                const datafileObj = JSON.parse(refreshedDatafile);
                await this.updateFlagKeysFromDatafile(sdkKey, datafileObj);
              } catch (flagKeyError) {
                this.logger.error(`${this.logPrefix} Error updating flag keys after ${operationType}:`, flagKeyError);
              }
              
              return this.createJsonResponse(requestId, 200, { 
                success: true, 
                operation: operationType,
                message: `Datafile ${operationType} completed successfully` 
              }, method, requestContext);
            } catch (error) {
              return this.createJsonResponse(requestId, 500, { 
                error: `Failed to ${operationType} datafile: ${error instanceof Error ? error.message : String(error)}` 
              }, method, requestContext);
            }
            
          case 'update':
          case 'save':
          default:
            // For update/save operations, validate body content
            if (!requestBody) {
              // Check if we should allow empty body for specific configurations
              const allowEmptyBody = urlParams.allowEmpty === 'true' || 
                                   requestAdapter.getHeader('x-optimizely-allow-empty-body') === 'true';
              
              if (allowEmptyBody) {
                // Create minimal valid datafile structure
                const minimalDatafile = {
                  version: "4",
                  rollouts: [],
                  typedAudiences: [],
                  anonymizeIP: false,
                  experiments: [],
                  audiences: [],
                  groups: [],
                  attributes: [],
                  projectId: sdkKey,
                  variables: [],
                  featureFlags: [],
                  events: [],
                  revision: "1"
                };
                
                this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] Empty body allowed - using minimal datafile structure`);
                
                // Save minimal datafile
                const saveTimer = this.metrics?.startTimer('datafile_save_duration');
                await this.datafileService.saveDatafile(sdkKey, JSON.stringify(minimalDatafile));
                if (saveTimer) saveTimer.stop();
                
                return this.createJsonResponse(requestId, 200, { 
                  success: true, 
                  message: "Minimal datafile created successfully",
                  datafile: minimalDatafile 
                }, method, requestContext);
              } else {
                // Standard behavior - require body
                this.metrics?.incrementCounter('api_errors_total', 1, {
                  endpoint: `${this.apiPathPrefix}datafile`,
                  method,
                  error_type: 'invalid_body'
                });
                return this.createJsonResponse(requestId, 400, { 
                  error: "Invalid request body. Provide datafile JSON, use ?operation=refresh to fetch from CDN, or use ?allowEmpty=true to create minimal datafile" 
                }, method, requestContext);
              }
            }
            
            // Standard update/save with provided body
            break;
        }
        
        // Save datafile (for update/save operations with valid body)
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
   * 
   * Supports:
   * - GET: Retrieve flag keys from KV storage or derived from datafile
   * - PUT/POST: Save flag keys (admin only)
   * - KV storage with fallback to default source
   * 
   * @param requestAdapter - The request adapter
   * @param requestId - The unique request ID for tracking
   * @returns A promise resolving to the ResponseResult
   * @private
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
    
    // Check for SDK key in query parameters and headers
    const params = this.parseUrlParams(url.search);
    const sdkKeyHeader = requestAdapter.getHeader('x-optimizely-sdk-key');
    const sdkKey = sdkKeyHeader || params.sdkKey || '';
    
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
        // Check if flagsFromKV is explicitly requested via query parameter
        const flagsFromKV = params.flagsFromKV === 'true';
        // Check if KV storage is enabled in configuration
        const isKVEnabled = this.configService.getEnableFlagsFromKV();
        
        this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] Handling flag keys request: sdkKey=${sdkKey}, flagsFromKV=${flagsFromKV}, isKVEnabled=${isKVEnabled}`);
        
        // CASE 1: Explicit KV requested
        if (flagsFromKV) {
          // If KV is explicitly requested but not enabled, return error
          if (!isKVEnabled) {
            this.logger.info(`${this.logPrefix} [REQUEST:${requestId}] KV storage requested but not enabled for flag keys`);
            this.metrics?.incrementCounter('api_errors_total', 1, {
              endpoint: `${this.apiPathPrefix}flagkeys`,
              method,
              error_type: 'kv_not_enabled'
            });
            return this.createJsonResponse(requestId, 400, { 
              error: "KV storage is not enabled for flag keys. Please enable it in configuration to use this feature." 
            }, method, requestContext);
          }
          
          // Attempt to get flag keys from KV storage only
          this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] Fetching flag keys from KV storage only`);
          const flagKeysTimer = this.metrics?.startTimer('flagkeys_fetch_duration');
          try {
            const flagKeys = await this.datafileService.getFlagKeys(sdkKey, { useKV: true, requestContext });
            if (flagKeysTimer) flagKeysTimer.stop();
            
            if (!flagKeys || flagKeys.length === 0) {
              this.logger.info(`${this.logPrefix} [REQUEST:${requestId}] Flag keys not found in KV storage`);
              this.metrics?.incrementCounter('api_errors_total', 1, {
                endpoint: `${this.apiPathPrefix}flagkeys`,
                method,
                error_type: 'flagkeys_not_found_kv'
              });
              return this.createJsonResponse(requestId, 404, { 
                error: "Flag keys not found in KV storage for the provided SDK key." 
              }, method, requestContext);
            }
            
            this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] Successfully retrieved flag keys from KV storage`);
            // Track flag keys count
            this.metrics?.recordHistogram('flagkeys_count', flagKeys.length, { 
              endpoint: `${this.apiPathPrefix}flagkeys`,
              source: 'kv'
            });
            
            return this.createJsonResponse(requestId, 200, { flagKeys }, method, requestContext);
          } catch (kvError) {
            if (flagKeysTimer) flagKeysTimer.stop();
            this.logger.error(`${this.logPrefix} [REQUEST:${requestId}] Error retrieving flag keys from KV:`, kvError);
            this.metrics?.incrementCounter('api_errors_total', 1, {
              endpoint: `${this.apiPathPrefix}flagkeys`,
              method,
              error_type: 'kv_access_error'
            });
            return this.createJsonResponse(requestId, 500, { 
              error: "Error accessing KV storage: " + (kvError instanceof Error ? kvError.message : String(kvError)) 
            }, method, requestContext);
          }
        }
        
        // CASE 2: No explicit KV request (fallback behavior based on config)
        // Try KV first if enabled by configuration, then fall back to default source
        if (isKVEnabled) {
          this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] KV enabled by config, trying KV first with fallback`);
          try {
            const kvFlagKeys = await this.datafileService.getFlagKeys(sdkKey, { useKV: true, requestContext });
            if (kvFlagKeys && kvFlagKeys.length > 0) {
              this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] Found flag keys in KV storage`);
              // Track flag keys count and source
              this.metrics?.recordHistogram('flagkeys_count', kvFlagKeys.length, { 
                endpoint: `${this.apiPathPrefix}flagkeys`,
                source: 'kv'
              });
              return this.createJsonResponse(requestId, 200, { flagKeys: kvFlagKeys }, method, requestContext);
            }
            // If not found in KV, fall through to default source
            this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] Flag keys not found in KV, falling back to default source`);
          } catch (kvError) {
            // Log error but continue to fallback
            this.logger.warn(`${this.logPrefix} [REQUEST:${requestId}] Error retrieving flag keys from KV, falling back:`, kvError);
          }
        } else {
          this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] KV not enabled by config, using default source only`);
        }
        
        // Default source (CDN/config)
        this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] Fetching flag keys from default source`);
        const flagKeysTimer = this.metrics?.startTimer('flagkeys_fetch_duration');
        try {
          // Pass useKV=false to explicitly use default source
          const flagKeys = await this.datafileService.getFlagKeys(sdkKey, { useKV: false, requestContext });
          if (flagKeysTimer) flagKeysTimer.stop();
          
          if (!flagKeys || flagKeys.length === 0) {
            this.logger.info(`${this.logPrefix} [REQUEST:${requestId}] Flag keys not found in default source`);
            this.metrics?.incrementCounter('api_errors_total', 1, {
              endpoint: `${this.apiPathPrefix}flagkeys`,
              method,
              error_type: 'flagkeys_not_found_default'
            });
            return this.createJsonResponse(requestId, 404, { 
              error: "Flag keys not found for the provided SDK key." 
            }, method, requestContext);
          }
          
          this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] Successfully retrieved flag keys from default source`);
          // Track flag keys count and source
          this.metrics?.recordHistogram('flagkeys_count', flagKeys.length, { 
            endpoint: `${this.apiPathPrefix}flagkeys`,
            source: 'default'
          });
          
          return this.createJsonResponse(requestId, 200, { flagKeys }, method, requestContext);
        } catch (defaultError) {
          if (flagKeysTimer) flagKeysTimer.stop();
          this.logger.error(`${this.logPrefix} [REQUEST:${requestId}] Error retrieving flag keys from default source:`, defaultError);
          this.metrics?.incrementCounter('api_errors_total', 1, {
            endpoint: `${this.apiPathPrefix}flagkeys`,
            method,
            error_type: 'default_source_error'
          });
          return this.createJsonResponse(requestId, 500, { 
            error: "Error retrieving flag keys from default source: " + 
              (defaultError instanceof Error ? defaultError.message : String(defaultError)) 
          }, method, requestContext);
        }
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
   * 
   * Returns information about the edge agent including:
   * - Version number
   * - Environment
   * - CDN provider
   * - Agent name
   * 
   * @param requestAdapter - The request adapter
   * @param requestId - The unique request ID for tracking
   * @returns A promise resolving to the ResponseResult
   * @private
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
   * 
   * @param requestAdapter - The request adapter
   * @param requestId - The unique request ID for tracking
   * @returns A promise resolving to the ResponseResult
   * @private
   * @deprecated This endpoint is not yet implemented
   */
  private async handleVariationsRequest(
    requestAdapter: IRequestAdapter,
    requestId: string
  ): Promise<ResponseResult> {
    const url = requestAdapter.getUrl();
    const method = requestAdapter.getMethod();
    
    // Check for SDK key in query parameters and headers
    const params = this.parseUrlParams(url.search);
    const sdkKeyHeader = requestAdapter.getHeader('x-optimizely-sdk-key');
    const sdkKey = sdkKeyHeader || params.sdkKey || '';
    
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
   * 
   * Supports admin-only operations:
   * - /api/admin/cache/clear - Clear cache
   * - /api/admin/status - Get service status
   * 
   * @param requestAdapter - The request adapter
   * @param requestId - The unique request ID for tracking
   * @returns A promise resolving to the ResponseResult
   * @private
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
   * Handles requests to set a forced variation for a user.
   * 
   * Allows setting forced decisions for testing and QA purposes.
   * Requires decision service to be available.
   * 
   * @param requestAdapter - The request adapter
   * @param requestId - The unique request ID for tracking
   * @returns A promise resolving to the ResponseResult
   * @private
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
   * Handles requests to get a forced variation for a user.
   * 
   * Retrieves any forced decision that has been set for a user and flag combination.
   * 
   * @param requestAdapter - The request adapter
   * @param requestId - The unique request ID for tracking
   * @returns A promise resolving to the ResponseResult
   * @private
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
   * Handles requests to remove a forced variation for a user.
   * 
   * Removes any forced decision that has been set for a user and flag combination.
   * 
   * @param requestAdapter - The request adapter
   * @param requestId - The unique request ID for tracking
   * @returns A promise resolving to the ResponseResult
   * @private
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
   * 
   * Clears all forced decisions across all flags for a specific user.
   * 
   * @param requestAdapter - The request adapter
   * @param requestId - The unique request ID for tracking
   * @returns A promise resolving to the ResponseResult
   * @private
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
   * 
   * Returns the list of available decide options that can be used with
   * the decision endpoints, formatted for different SDK versions.
   * 
   * @param requestAdapter - The request adapter
   * @param requestId - The unique request ID for tracking
   * @returns A promise resolving to the ResponseResult
   * @private
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
   * Makes a decision for a single flag key with mode-specific response formatting and integration.
   * 
   * **Edge Mode Behavior:**
   * - Returns JSON decision data for application consumption
   * - Integrates with CDN response headers and cookies when configured
   * - Optimized for single-flag decisions with minimal latency
   * - Supports response header injection for CDN edge caching
   * 
   * **Agent Mode Behavior:**
   * - Returns comprehensive JSON response with decision details
   * - Includes metadata about decision sources and processing
   * - Supports detailed error reporting and debugging information
   * - Optimized for application-to-application communication
   * 
   * **Flag Key Sources (precedence order):**
   * 1. Request body: `{ "flagKey": "flag-name" }`
   * 2. Query parameter: `?flagKey=flag-name`
   * 3. Header: `X-Optimizely-Flag-Key: flag-name`
   * 
   * **User Identification (precedence order):**
   * 1. Request body: `{ "userId": "user123" }` or `{ "visitorId": "visitor456" }`
   * 2. Header: `X-Optimizely-User-Id` or `X-Optimizely-Visitor-Id`
   * 3. Cookie: `optimizely_user_id` or `optimizely_visitor_id`
   * 
   * **Decide Options Support:**
   * All Optimizely SDK decide options are supported:
   * - `INCLUDE_REASONS`: Include decision reasoning in response
   * - `EXCLUDE_VARIABLES`: Exclude variable values from response
   * - `ENABLED_FLAGS_ONLY`: Only return enabled flags
   * - `IGNORE_USER_PROFILE_SERVICE`: Skip sticky bucketing for this request
   * 
   * @param requestAdapter - The request adapter containing HTTP request details
   * @param requestId - The unique request ID for tracking and correlation
   * @returns Promise resolving to ResponseResult with decision data and appropriate HTTP status
   * @private
   * 
   * @example
   * ```typescript
   * // Basic decide request
   * POST /api/decide
   * Content-Type: application/json
   * {
   *   "userId": "user123",
   *   "flagKey": "checkout_redesign",
   *   "attributes": { 
   *     "platform": "web",
   *     "userType": "premium" 
   *   }
   * }
   * 
   * // Response:
   * {
   *   "variationKey": "treatment",
   *   "enabled": true,
   *   "variables": { "buttonColor": "blue" },
   *   "ruleKey": "experiment_123",
   *   "flagKey": "checkout_redesign"
   * }
   * ```
   * 
   * @example
   * ```typescript
   * // Decide with debug options
   * POST /api/decide
   * {
   *   "userId": "test_user",
   *   "flagKey": "feature_toggle",
   *   "decideOptions": ["INCLUDE_REASONS", "EXCLUDE_VARIABLES"]
   * }
   * 
   * // Response includes decision reasoning:
   * {
   *   "variationKey": "off",
   *   "enabled": false,
   *   "reasons": [
   *     "User does not meet audience conditions for experiment"
   *   ],
   *   "ruleKey": "rollout_456",
   *   "flagKey": "feature_toggle"
   * }
   * ```
   * 
   * @example
   * ```typescript
   * // Query parameter usage
   * GET /api/decide?flagKey=my_flag&userId=user789&platform=mobile
   * 
   * // Header-based usage
   * POST /api/decide
   * X-Optimizely-Flag-Key: my_flag
   * X-Optimizely-User-Id: user789
   * Content-Type: application/json
   * {
   *   "attributes": { "platform": "mobile" }
   * }
   * ```
   * 
   * @see {@link handleDecideAllRequest} for making decisions on multiple flags
   * @see {@link DecisionService.decide} for the underlying decision logic
   * @since v2.0.0
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
      
      // Prepare a lowercase map of headers for case-insensitive access within this handler
      const allHeadersRaw = requestAdapter.getHeaders();
      const headers: Record<string, string> = {};
      allHeadersRaw.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });

      // Determine User ID / Visitor ID and its source with correct precedence (header > query > body)
      let initialUserId: string | null = null;
      let actualVisitorIdFrom: string = '';

      const headerVisitorId = headers['x-optimizely-visitor-id']; // Use lowercased map

      if (headerVisitorId) {
        initialUserId = headerVisitorId;
        actualVisitorIdFrom = 'header';
      } else if (urlParams.userId) {
        initialUserId = urlParams.userId;
        actualVisitorIdFrom = 'query';
      } else if (urlParams.visitorId) {
        initialUserId = urlParams.visitorId;
        actualVisitorIdFrom = 'query';
      } else if (requestBody?.userId) {
        initialUserId = requestBody.userId;
        actualVisitorIdFrom = 'body';
      } else if (requestBody?.visitorId) {
        initialUserId = requestBody.visitorId;
        actualVisitorIdFrom = 'body';
      }
      
      // Check for auto-generation of visitor ID if requested
      let finalUserId = initialUserId;
      // Extract with proper precedence (header → query → body) for override flag
      const rawOverrideVisitorIdHeader = requestAdapter.getHeader('X-Optimizely-Override-Visitor-Id');
      const overrideVisitorIdHeaderValue = typeof rawOverrideVisitorIdHeader === 'string' ? rawOverrideVisitorIdHeader.toLowerCase() : null;

      const rawOverrideVisitorIdQuery = urlParams.overrideVisitorId;
      const overrideVisitorIdQueryValue = typeof rawOverrideVisitorIdQuery === 'string' ? rawOverrideVisitorIdQuery.toLowerCase() : null;

      const overrideVisitorIdBodyValue = requestBody?.overrideVisitorId; // boolean or undefined

      let finalOverrideVisitorIdValue = false; // Default to false
      let actualOverrideVisitorIdFrom = '';

      if (overrideVisitorIdHeaderValue !== null) {
          finalOverrideVisitorIdValue = overrideVisitorIdHeaderValue === 'true';
          actualOverrideVisitorIdFrom = 'header';
      } else if (overrideVisitorIdQueryValue !== null) {
          finalOverrideVisitorIdValue = overrideVisitorIdQueryValue === 'true';
          actualOverrideVisitorIdFrom = 'query';
      } else if (typeof overrideVisitorIdBodyValue === 'boolean') {
          finalOverrideVisitorIdValue = overrideVisitorIdBodyValue;
          actualOverrideVisitorIdFrom = 'body';
      }

      if (requestContext?.configMetadata) {
          requestContext.configMetadata.overrideVisitorId = finalOverrideVisitorIdValue;
          if (actualOverrideVisitorIdFrom) { // Only set 'From' if a source was identified
            requestContext.configMetadata.overrideVisitorIdFrom = actualOverrideVisitorIdFrom;
          }
      }
      
      // The 'const overrideVisitorId' can now use finalOverrideVisitorIdValue
      const overrideVisitorId = finalOverrideVisitorIdValue;
                              
      // Explicitly set the source of overrideVisitorId in the requestContext metadata
      // This will be used by addResponseMetadata
      if (requestContext?.configMetadata) {
        if (overrideVisitorIdHeaderValue !== null) {
          requestContext.configMetadata.overrideVisitorIdFrom = 'header';
        } else if (overrideVisitorIdQueryValue !== null) {
          requestContext.configMetadata.overrideVisitorIdFrom = 'query';
        } else if (typeof overrideVisitorIdBodyValue === 'boolean') {
          requestContext.configMetadata.overrideVisitorIdFrom = 'body';
        }
        // If overrideVisitorId is false, overrideVisitorIdFrom will remain unset here,
        // allowing it to be potentially picked up from ConfigService or default later in addResponseMetadata.
      }

      if (overrideVisitorId) {
        finalUserId = this.generateUUID();
        this.logger.debug(`${this.logPrefix} Auto-generated visitor ID due to override: ${finalUserId}`);
        if (requestContext?.configMetadata) {
          requestContext.configMetadata.visitorId = finalUserId;
          requestContext.configMetadata.visitorIdFrom = 'override';
          
          // Track the source of overrideVisitorId in metadata
          if (overrideVisitorIdHeaderValue !== null) { // Check based on the direct header value read
            requestContext.configMetadata.overrideVisitorIdFrom = 'header';
          } else if (overrideVisitorIdQueryValue !== null) { // Check based on the direct query value read
            requestContext.configMetadata.overrideVisitorIdFrom = 'query';
          } else if (typeof overrideVisitorIdBodyValue === 'boolean') { // Check based on the direct body value read
            requestContext.configMetadata.overrideVisitorIdFrom = 'body';
          }
          // No direct update to (this.configService as any).metadata
        }
      } else {
        // If not overridden, set the visitorIdFrom based on actual source
        if (requestContext?.configMetadata && actualVisitorIdFrom) {
          requestContext.configMetadata.visitorId = finalUserId; // Update value in context
          requestContext.configMetadata.visitorIdFrom = actualVisitorIdFrom;
        }
      }
      
      // Support header for single flag key
      const headerFlagKey = headers['x-optimizely-flag-key']; // Use lowercased map
      // Support both key and flagKey parameters for backward compatibility with correct precedence (header → query → body)
      const flagKey = headerFlagKey || urlParams.flagKey || urlParams.key || requestBody?.flagKey || requestBody?.key;
      
      // Update metadata based on the actual source used according to precedence
      if (requestContext?.configMetadata) {
        // Check if the header *exists*, even if its value might be empty
        if (headers.hasOwnProperty('x-optimizely-flag-key')) { 
          requestContext.configMetadata.flagKeysDecided = [headerFlagKey || '']; // Use headerFlagKey, default to empty if it was null/undefined but header existed
          requestContext.configMetadata.flagKeysFrom = 'header';
        } else if (urlParams.flagKey || urlParams.key) {
          requestContext.configMetadata.flagKeysDecided = [urlParams.flagKey || urlParams.key];
          requestContext.configMetadata.flagKeysFrom = 'query';
        } else if (requestBody?.flagKey || requestBody?.key) {
          requestContext.configMetadata.flagKeysDecided = [requestBody.flagKey || requestBody.key];
          requestContext.configMetadata.flagKeysFrom = 'body';
        }
        this.logger.debug(`${this.logPrefix} [HANDLE_DECIDE_REQUEST] flagKeysFrom set to: ${requestContext.configMetadata.flagKeysFrom}`);
      }
      
      const attributes = requestBody?.attributes || {};
      
      // Determine SDK Key and its source with correct precedence (header > query > body)
      let sdkKey: string | null = null;
      let actualSdkKeyFrom: string = '';

      const headerSdkKeyVal = headers['x-optimizely-sdk-key']; // Use lowercased map
      if (headerSdkKeyVal) {
        sdkKey = headerSdkKeyVal;
        actualSdkKeyFrom = 'header';
      } else if (urlParams.sdkKey) {
        sdkKey = urlParams.sdkKey;
        actualSdkKeyFrom = 'query';
      } else if (requestBody?.sdkKey) {
        sdkKey = requestBody.sdkKey;
        actualSdkKeyFrom = 'body';
      }

      if (requestContext?.configMetadata && actualSdkKeyFrom) {
        requestContext.configMetadata.sdkKey = sdkKey;
        requestContext.configMetadata.sdkKeyFrom = actualSdkKeyFrom;
      } else if (requestContext?.configMetadata && !requestContext.configMetadata.sdkKeyFrom && sdkKey) {
         requestContext.configMetadata.sdkKey = sdkKey;
         requestContext.configMetadata.sdkKeyFrom = 'body'; 
      }
      
      // Check for trimmedDecisions parameter in body, URL, or header
      const headerTrimmedDecisions = headers['x-optimizely-trimmed-decisions']; // Use lowercased map
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
        this.logger.warn(`${this.logPrefix} Missing flagKey parameter`);
        return this.createJsonResponse(requestId, 400, { error: "flagKey parameter is required (can also be provided as 'key' or X-Optimizely-Flag-Key header)" }, method, requestContext);
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
   * Handles batch decide-all requests for multiple feature flags simultaneously.
   * Supports both "all flags" and "specific flags" modes with efficient batch processing and mode-specific optimizations.
   * 
   * **Edge Mode Behavior:**
   * - Returns flat JSON object mapping flag keys to decision objects
   * - Optimized for CDN edge processing with minimal response size
   * - Supports response header injection for enabled flags
   * - Ideal for single-page applications requiring multiple flag states
   * 
   * **Agent Mode Behavior:**
   * - Returns comprehensive decision map with detailed metadata
   * - Includes batch processing metrics and timing information
   * - Supports detailed error reporting for individual flags
   * - Optimized for server-to-server batch decision requests
   * 
   * **Flag Key Sources (precedence order):**
   * 1. Request body: `{ "flagKeys": ["flag1", "flag2"] }` - Decide for specific flags only
   * 2. Query parameter: `?flagKeys=flag1,flag2` - Comma-separated flag list
   * 3. KV Storage: All flag keys stored for the SDK key (when no flagKeys provided)
   * 4. Datafile: All feature flags defined in the project (fallback)
   * 
   * **Performance Optimizations:**
   * - Single SDK client initialization for all decisions
   * - Parallel decision processing when supported by platform
   * - Shared user profile service lookups
   * - Batch metrics recording and logging
   * 
   * **User Identification:** Same precedence as single decide requests
   * 
   * @param requestAdapter - The request adapter containing HTTP request details
   * @param requestId - The unique request ID for tracking and correlation
   * @returns Promise resolving to ResponseResult with decision map and appropriate HTTP status
   * @private
   * 
   * @example
   * ```typescript
   * // Decide for all available flags
   * POST /api/decide-all
   * Content-Type: application/json
   * {
   *   "userId": "user123",
   *   "attributes": { 
   *     "platform": "web",
   *     "plan": "premium" 
   *   }
   * }
   * 
   * // Response includes all flags:
   * {
   *   "checkout_redesign": {
   *     "variationKey": "treatment",
   *     "enabled": true,
   *     "variables": { "buttonColor": "blue" }
   *   },
   *   "new_navigation": {
   *     "variationKey": "control",
   *     "enabled": false,
   *     "variables": {}
   *   }
   * }
   * ```
   * 
   * @example
   * ```typescript
   * // Decide for specific flags only
   * POST /api/decide-all
   * {
   *   "userId": "user456",
   *   "flagKeys": ["checkout_redesign", "payment_flow"],
   *   "decideOptions": ["ENABLED_FLAGS_ONLY"]
   * }
   * 
   * // Response only includes specified flags that are enabled:
   * {
   *   "checkout_redesign": {
   *     "variationKey": "treatment",
   *     "enabled": true,
   *     "variables": { "version": "v2" }
   *   }
   * }
   * ```
   * 
   * @example
   * ```typescript
   * // Query parameter usage for specific flags
   * GET /api/decide-all?userId=user789&flagKeys=flag1,flag2,flag3
   * 
   * // Edge Mode usage for CDN integration
   * POST /api/decide-all
   * X-Optimizely-User-Id: edge_user_123
   * {
   *   "decideOptions": ["EXCLUDE_VARIABLES"],  // Minimize response size
   *   "attributes": { "device": "mobile" }
   * }
   * ```
   * 
   * @see {@link handleDecideRequest} for making decisions on individual flags
   * @see {@link DecisionService.decideAll} for the underlying batch decision logic
   * @since v2.0.0
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
      
      // Determine User ID / Visitor ID and its source with correct precedence (header > query > body)
      let initialUserId: string | null = null;
      let actualVisitorIdFrom: string = '';

      const headerVisitorId = requestAdapter.getHeader('X-Optimizely-Visitor-Id'); // Standard header
      const altHeaderVisitorId = requestAdapter.getHeader('x-optimizely-visitor-id'); // Lowercase variant

      if (headerVisitorId) {
        initialUserId = headerVisitorId;
        actualVisitorIdFrom = 'header';
      } else if (altHeaderVisitorId) {
        initialUserId = altHeaderVisitorId;
        actualVisitorIdFrom = 'header';
      } else if (urlParams.userId) {
        initialUserId = urlParams.userId;
        actualVisitorIdFrom = 'query';
      } else if (urlParams.visitorId) {
        initialUserId = urlParams.visitorId;
        actualVisitorIdFrom = 'query';
      } else if (requestBody?.userId) {
        initialUserId = requestBody.userId;
        actualVisitorIdFrom = 'body';
      } else if (requestBody?.visitorId) {
        initialUserId = requestBody.visitorId;
        actualVisitorIdFrom = 'body';
      }
      
      // Check for auto-generation of visitor ID if requested
      let finalUserId = initialUserId;
      // Extract with proper precedence (header → query → body) for override flag
      const rawOverrideVisitorIdHeader = requestAdapter.getHeader('X-Optimizely-Override-Visitor-Id');
      const overrideVisitorIdHeaderValue = typeof rawOverrideVisitorIdHeader === 'string' ? rawOverrideVisitorIdHeader.toLowerCase() : null;

      const rawOverrideVisitorIdQuery = urlParams.overrideVisitorId;
      const overrideVisitorIdQueryValue = typeof rawOverrideVisitorIdQuery === 'string' ? rawOverrideVisitorIdQuery.toLowerCase() : null;

      const overrideVisitorIdBodyValue = requestBody?.overrideVisitorId; // boolean or undefined

      let finalOverrideVisitorIdValue = false; // Default to false
      let actualOverrideVisitorIdFrom = '';

      if (overrideVisitorIdHeaderValue !== null) {
          finalOverrideVisitorIdValue = overrideVisitorIdHeaderValue === 'true';
          actualOverrideVisitorIdFrom = 'header';
      } else if (overrideVisitorIdQueryValue !== null) {
          finalOverrideVisitorIdValue = overrideVisitorIdQueryValue === 'true';
          actualOverrideVisitorIdFrom = 'query';
      } else if (typeof overrideVisitorIdBodyValue === 'boolean') {
          finalOverrideVisitorIdValue = overrideVisitorIdBodyValue;
          actualOverrideVisitorIdFrom = 'body';
      }

      if (requestContext?.configMetadata) {
          requestContext.configMetadata.overrideVisitorId = finalOverrideVisitorIdValue;
          if (actualOverrideVisitorIdFrom) { // Only set 'From' if a source was identified
            requestContext.configMetadata.overrideVisitorIdFrom = actualOverrideVisitorIdFrom;
          }
      }
      
      // The 'const overrideVisitorId' can now use finalOverrideVisitorIdValue
      const overrideVisitorId = finalOverrideVisitorIdValue;
                              
      if (overrideVisitorId) {
        finalUserId = this.generateUUID();
        this.logger.debug(`${this.logPrefix} Auto-generated visitor ID due to override: ${finalUserId}`);
        if (requestContext?.configMetadata) {
          requestContext.configMetadata.visitorId = finalUserId;
          requestContext.configMetadata.visitorIdFrom = 'override';
          
          // Track the source of overrideVisitorId in metadata
          if (overrideVisitorIdHeaderValue !== null) { // Check based on the direct header value read
            requestContext.configMetadata.overrideVisitorIdFrom = 'header';
          } else if (overrideVisitorIdQueryValue !== null) { // Check based on the direct query value read
            requestContext.configMetadata.overrideVisitorIdFrom = 'query';
          } else if (typeof overrideVisitorIdBodyValue === 'boolean') { // Check based on the direct body value read
            requestContext.configMetadata.overrideVisitorIdFrom = 'body';
          }
          // No direct update to (this.configService as any).metadata
        }
      } else {
        // If not overridden, set the visitorIdFrom based on actual source
        if (requestContext?.configMetadata && actualVisitorIdFrom) {
          requestContext.configMetadata.visitorId = finalUserId; // Update value in context
          requestContext.configMetadata.visitorIdFrom = actualVisitorIdFrom;
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
   * 
   * Makes decisions for a specific set of flag keys for a user.
   * More efficient than individual decide calls when multiple flags are needed.
   * 
   * @param requestAdapter - The request adapter
   * @param requestId - The unique request ID for tracking
   * @returns A promise resolving to the ResponseResult
   * @private
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
      // Extract with proper precedence (header → query → body)
      const rawOverrideVisitorIdHeader = requestAdapter.getHeader('X-Optimizely-Override-Visitor-Id');
      const overrideVisitorIdHeaderValue = typeof rawOverrideVisitorIdHeader === 'string' ? rawOverrideVisitorIdHeader.toLowerCase() : null;

      const rawOverrideVisitorIdQuery = urlParams.overrideVisitorId;
      const overrideVisitorIdQueryValue = typeof rawOverrideVisitorIdQuery === 'string' ? rawOverrideVisitorIdQuery.toLowerCase() : null;

      const overrideVisitorIdBodyValue = requestBody?.overrideVisitorId; // boolean or undefined

      let finalOverrideVisitorIdValue = false; // Default to false
      let actualOverrideVisitorIdFrom = '';

      if (overrideVisitorIdHeaderValue !== null) {
          finalOverrideVisitorIdValue = overrideVisitorIdHeaderValue === 'true';
          actualOverrideVisitorIdFrom = 'header';
      } else if (overrideVisitorIdQueryValue !== null) {
          finalOverrideVisitorIdValue = overrideVisitorIdQueryValue === 'true';
          actualOverrideVisitorIdFrom = 'query';
      } else if (typeof overrideVisitorIdBodyValue === 'boolean') {
          finalOverrideVisitorIdValue = overrideVisitorIdBodyValue;
          actualOverrideVisitorIdFrom = 'body';
      }

      if (requestContext?.configMetadata) {
          requestContext.configMetadata.overrideVisitorId = finalOverrideVisitorIdValue;
          if (actualOverrideVisitorIdFrom) { // Only set 'From' if a source was identified
            requestContext.configMetadata.overrideVisitorIdFrom = actualOverrideVisitorIdFrom;
          }
      }
      
      // The 'const overrideVisitorId' can now use finalOverrideVisitorIdValue
      const overrideVisitorId = finalOverrideVisitorIdValue;
                              
      if (overrideVisitorId) {
        finalUserId = this.generateUUID();
        this.logger.debug(`${this.logPrefix} Auto-generated visitor ID due to override: ${finalUserId}`);
        if (requestContext?.configMetadata) {
          requestContext.configMetadata.visitorId = finalUserId;
          requestContext.configMetadata.visitorIdFrom = 'override';
          
          // Track the source of overrideVisitorId in metadata
          if (overrideVisitorIdHeaderValue !== null) { // Check based on the direct header value read
            requestContext.configMetadata.overrideVisitorIdFrom = 'header';
          } else if (overrideVisitorIdQueryValue !== null) { // Check based on the direct query value read
            requestContext.configMetadata.overrideVisitorIdFrom = 'query';
          } else if (typeof overrideVisitorIdBodyValue === 'boolean') { // Check based on the direct body value read
            requestContext.configMetadata.overrideVisitorIdFrom = 'body';
          }
                                                               
          // CRITICAL FIX: Ensure metadata value is properly tracked in ConfigService for response generation
          try {
            // Try to access metadata directly (internal implementation detail)
            if ((this.configService as any).metadata) {
              (this.configService as any).metadata.overrideVisitorIdFrom = overrideVisitorIdHeaderValue ? 'header' : 
                                                                      (overrideVisitorIdQueryValue ? 'query' : 'body');
              this.logger.debug(`${this.logPrefix} Updated overrideVisitorIdFrom in ConfigService metadata: ${(this.configService as any).metadata.overrideVisitorIdFrom}`);
            }
          } catch (err) {
            this.logger.warn(`${this.logPrefix} Could not update overrideVisitorIdFrom in ConfigService metadata: ${err}`);
          }
        }
      }
      
      const attributes = requestBody?.attributes || {};
      const sdkKey = requestBody?.sdkKey || urlParams.sdkKey || requestAdapter.getHeader('X-Optimizely-SDK-Key');
      
      // Determine Flag Keys and their source with correct precedence (header > query > body)
      let flagKeys: string[] = [];
      let actualFlagKeysFrom: string = '';

      const headerFlagKey = requestAdapter.getHeader('X-Optimizely-Flag-Key');
      const headerFlagKeysRaw = requestAdapter.getHeader('X-Optimizely-Flag-Keys');
      
      if (headerFlagKey) {
        flagKeys = [headerFlagKey];
        actualFlagKeysFrom = 'header';
      } else if (headerFlagKeysRaw) {
        try {
          const parsed = JSON.parse(headerFlagKeysRaw);
          flagKeys = Array.isArray(parsed) ? parsed : [parsed];
        } catch (e) {
          flagKeys = headerFlagKeysRaw.split(',').map(k => k.trim());
        }
        actualFlagKeysFrom = 'header';
      }
      
      const urlFlagKeysRaw: any = urlParams.flagKeys || urlParams.keys;
      if (actualFlagKeysFrom === '' && urlFlagKeysRaw) { // Only check URL if not already sourced from header
        if (typeof urlFlagKeysRaw === 'string') {
          flagKeys = urlFlagKeysRaw.split(',').map(key => key.trim());
        } else if (Array.isArray(urlFlagKeysRaw)) {
          flagKeys = urlFlagKeysRaw;
        }
        if (flagKeys.length > 0) actualFlagKeysFrom = 'query';
      }

      const bodyFlagKeys = requestBody?.flagKeys || requestBody?.keys;
      if (actualFlagKeysFrom === '' && Array.isArray(bodyFlagKeys) && bodyFlagKeys.length > 0) { // Only check body if not from header/query
        flagKeys = bodyFlagKeys;
        actualFlagKeysFrom = 'body';
      }
      
      // Update metadata based on the actual source used for flagKeys
      if (requestContext?.configMetadata && actualFlagKeysFrom) {
        requestContext.configMetadata.flagKeysDecided = flagKeys;
        requestContext.configMetadata.flagKeysFrom = actualFlagKeysFrom;
      } else if (requestContext?.configMetadata && flagKeys.length > 0 && !requestContext.configMetadata.flagKeysFrom) {
        // If keys were found (e.g. only in body) but no explicit source set yet by getRequestConfig
        requestContext.configMetadata.flagKeysDecided = flagKeys;
        requestContext.configMetadata.flagKeysFrom = 'body'; // Default to body if no other more specific source was set
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
   * 
   * Returns comprehensive debug information about the request including:
   * - Request headers and parameters
   * - Configuration and metadata
   * - Extracted attributes and event data
   * 
   * @param requestAdapter - The request adapter
   * @param requestId - The unique request ID for tracking
   * @returns A promise resolving to the ResponseResult
   * @private
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
   * Retrieves the complete request configuration including metadata for the given request.
   * 
   * This method extracts and processes all relevant information from the request:
   * - SDK key with source tracking (header → query → body precedence)
   * - User/Visitor ID with source tracking
   * - Flag keys with source tracking
   * - Attributes and event data
   * - Header/cookie control flags
   * - Visitor ID override functionality
   * 
   * @param requestAdapter - The request adapter
   * @returns The request configuration including metadata
   * @private
   */
  private async getRequestConfig(requestAdapter: IRequestAdapter): Promise<RequestConfig> {
    // Get basic request data
    const requestUrl = requestAdapter.getUrl();
    const requestMethod = requestAdapter.getMethod();
    const headers = this.extractHeaders(requestAdapter);
    const queryParams = this.parseUrlParams(requestUrl.search);
    
    // ===== DEBUG: Log critical information about request and metadata =====
    this.logger.debug(`${this.logPrefix} [REQUEST CONFIG DEBUG] ===== Beginning request config extraction =====`);
    this.logger.debug(`${this.logPrefix} [REQUEST CONFIG DEBUG] URL: ${requestUrl.toString()}, Method: ${requestMethod}`);
    this.logger.debug(`${this.logPrefix} [REQUEST CONFIG DEBUG] Critical Headers: sdkKey=${headers['x-optimizely-sdk-key']}, visitorId=${headers['x-optimizely-visitor-id'] || headers['X-Optimizely-Visitor-Id']}`);
    this.logger.debug(`${this.logPrefix} [REQUEST CONFIG DEBUG] Critical Query Params: sdkKey=${queryParams.sdkKey}, visitorId=${queryParams.visitorId}`);
    
    // IMPORTANT: Get the ConfigService metadata to check for inconsistencies
    const configServiceMetadata = this.configService.getMetadata();
    this.logger.debug(`${this.logPrefix} [REQUEST CONFIG DEBUG] Existing ConfigService metadata: sdkKeyFrom=${configServiceMetadata.sdkKeyFrom}, visitorIdFrom=${configServiceMetadata.visitorIdFrom}`);
    
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
    if (headers['X-Optimizely-Visitor-Id']) {
      userId = headers['X-Optimizely-Visitor-Id'];
      visitorId = headers['X-Optimizely-Visitor-Id'];
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

    // Extract enableResponseMetadata with proper precedence (header → query → body)
    const enableResponseMetadataHeader = headers['x-optimizely-enable-response-metadata'];
    const enableResponseMetadataQuery = queryParams.enableResponseMetadata;
    const enableResponseMetadataBody = setResponseHeadersBody?.enableResponseMetadata;
    
    // Determine final value with proper precedence
    let enableResponseMetadata = undefined;
    let enableResponseMetadataFrom = null;
    
    if (enableResponseMetadataHeader !== undefined) {
      enableResponseMetadata = this.parseBoolean(enableResponseMetadataHeader, true);
      enableResponseMetadataFrom = 'header';
    } else if (enableResponseMetadataQuery !== undefined) {
      enableResponseMetadata = this.parseBoolean(enableResponseMetadataQuery, true);
      enableResponseMetadataFrom = 'query';
    } else if (enableResponseMetadataBody !== undefined) {
      enableResponseMetadata = this.parseBoolean(enableResponseMetadataBody, true);
      enableResponseMetadataFrom = 'body';
    }
    
    // If a value was determined, update the ConfigurationService
    if (enableResponseMetadata !== undefined) {
      this.configService.setValue('enableResponseMetadata', enableResponseMetadata);
      this.logger.debug(`${this.logPrefix} Setting enableResponseMetadata=${enableResponseMetadata} from ${enableResponseMetadataFrom}`);
      
      // Add to metadata
      configMetadata.enableResponseMetadata = enableResponseMetadata;
      configMetadata.enableResponseMetadataFrom = enableResponseMetadataFrom;
      
      // CRITICAL FIX: Ensure metadata value is properly tracked in ConfigService for response generation
      try {
        // Try to access metadata directly (internal implementation detail)
        if ((this.configService as any).metadata) {
          (this.configService as any).metadata.enableResponseMetadataFrom = enableResponseMetadataFrom;
          this.logger.debug(`${this.logPrefix} Updated enableResponseMetadataFrom in ConfigService metadata: ${enableResponseMetadataFrom}`);
        }
      } catch (err) {
        this.logger.warn(`${this.logPrefix} Could not update enableResponseMetadataFrom in ConfigService metadata: ${err}`);
      }
    }

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
          // For sdkKey and visitorId, only update source to 'body' if not already set by header/query
          if (requestBody.sdkKey) {
            // The actual sdkKey value is taken with body precedence if present.
            requestConfig.sdkKey = requestBody.sdkKey;
            configMetadata.sdkKey = requestBody.sdkKey;
            // But the source metadata should only be 'body' if not previously set by header/query.
            if (!sdkKeyFrom) { // sdkKeyFrom was determined from headers/query earlier
              configMetadata.sdkKeyFrom = 'body';
            }
          }

          if (requestBody.userId || requestBody.visitorId) {
            const bodyVisitorId = requestBody.visitorId || requestBody.userId;
            // Actual value takes body precedence if present
            requestConfig.visitorId = bodyVisitorId;
            requestConfig.userId = bodyVisitorId; // Assuming userId and visitorId are interchangeable here for value
            configMetadata.visitorId = bodyVisitorId;
            // But the source metadata should only be 'body' if not previously set by header/query.
            if (!visitorIdFrom) { // visitorIdFrom was determined from headers/query earlier
              configMetadata.visitorIdFrom = 'body';
            }
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
          
          // Only use body values for flagKeys if not already set from headers or query
          // This preserves the header > query > body precedence
          if (!configMetadata.flagKeysFrom) {
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
    
    this.logger.debug(`${this.logPrefix} [REQUEST_CONFIG_RETURN] flagKeysFrom: ${requestConfig.configMetadata?.flagKeysFrom}`);
    return requestConfig;
  }
  
  /**
   * Extracts headers from the request adapter into a lowercase dictionary.
   * 
   * @param requestAdapter - The request adapter
   * @returns Record of headers with lowercase keys
   * @private
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
   * 
   * Filters out authorization and cookie headers for safe logging and debugging.
   * 
   * @param requestAdapter - The request adapter
   * @returns Record of safe headers with sensitive data redacted
   * @private
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
   * Creates a JSON response with proper headers and metadata.
   * 
   * This method handles:
   * - Content-Type and standard headers
   * - Implementation version tracking
   * - Cache control headers
   * - Response metadata inclusion
   * - Debug headers (when enabled)
   * - Header/cookie control logic
   * - Visitor ID and decisions headers/cookies
   * 
   * @param requestId - The unique request ID
   * @param status - The HTTP status code
   * @param body - The response body object
   * @param method - The HTTP method of the request
   * @param requestContext - The request context containing metadata
   * @returns The ResponseResult with formatted response
   * @private
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

    // *******************************************************************
    // ***** ADD YOUR COMPREHENSIVE HEADER LOGGING STATEMENT HERE *****
    // *******************************************************************
    // This point is after all conditional logic for adding/removing headers
    // has been processed, and 'header' contains the final set.

    this.logger.warn(`${this.logPrefix} FINAL HEADERS FOR REQUEST ${requestId}: ${JSON.stringify(headers)}`);
    // Using logger.warn for high visibility during debugging; change level as needed.
    // You can also iterate and log them one by one if preferred:
    // for (const [key, value] of Object.entries(headers)) {
    //   this.logger.warn(`${this.logPrefix} FINAL HEADER: ${key}: ${value}`);
    // }
    // Also log the length of specific problematic headers:
    const decisionsHeaderName = this.configService.getDecisionsHeaderName();
    if (headers[decisionsHeaderName]) {
       this.logger.warn(`${this.logPrefix} ${decisionsHeaderName} LENGTH: ${headers[decisionsHeaderName].length}`);
    }
    // *******************************************************************

    return {
      status,
      body: JSON.stringify(body),
      headers
    };
  }

  /**
   * Adds metadata to the response body if enabled.
   * 
   * Merges configuration metadata with request context metadata
   * to provide comprehensive information about parameter sources
   * and processing details. Only included in POST requests by default.
   * 
   * @param body - The original response body
   * @param requestMethod - The HTTP method of the request
   * @param requestContext - The request context containing metadata
   * @returns The response body with metadata added
   * @private
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
    
    // CRITICAL FIX: Always get the most up-to-date metadata from the ConfigService for source tracking
    // This ensures that our response metadata always reflects the correct parameter precedence
    const configServiceMetadata = this.configService.getMetadata();
    
    // Start with the ConfigService metadata (source of truth)
    // This ensures the correct source tracking info is always used
    const metadata = {...configServiceMetadata};
    
    if (requestContext?.configMetadata) {
      this.logger.debug(`${this.logPrefix} [META DEBUG] Merging/overwriting with requestContext.configMetadata. RC sdkKeyFrom=${requestContext.configMetadata.sdkKeyFrom}, RC visitorIdFrom=${requestContext.configMetadata.visitorIdFrom}, RC flagKeysFrom=${requestContext.configMetadata.flagKeysFrom}, RC overrideVisitorId=${requestContext.configMetadata.overrideVisitorId}, RC overrideVisitorIdFrom=${requestContext.configMetadata.overrideVisitorIdFrom}`);
      Object.keys(requestContext.configMetadata).forEach(key => {
        const rcValue = requestContext.configMetadata[key];
        // For specific keys, always prefer the value from requestContext if it exists and is not empty (or is a boolean for overrideVisitorId),
        // as handlers (handleDecideRequest, etc.) set this authoritatively based on actual precedence for that request.
        const preferRequestContextKeys = [
          'flagKeysFrom', 'sdkKeyFrom', 'visitorIdFrom', 
          'enableResponseMetadataFrom', 'attributesFrom', 
          'overrideVisitorId', 'overrideVisitorIdFrom',
          'datafileFrom', 'flagKeysDecided'
        ];

        if (preferRequestContextKeys.includes(key)) {
          // For boolean overrideVisitorId, allow true/false. For strings, ensure not empty.
          if ((key === 'overrideVisitorId' && typeof rcValue === 'boolean') || (rcValue && rcValue !== '')) {
            (metadata as any)[key] = rcValue;
            this.logger.debug(`${this.logPrefix} [META DEBUG] Updated metadata.${key} using requestContext value: ${rcValue}`);
          }
        } else if (metadata[key as keyof typeof metadata] === undefined) { // For other keys, add if missing in configServiceMetadata
          (metadata as any)[key] = rcValue;
          this.logger.debug(`${this.logPrefix} [META DEBUG] Added missing metadata.${key} from requestContext value: ${rcValue}`);
        }
      });
    }
    
    // Add decisionFromStorage if it exists
    if (body && body.metadata && body.metadata.decisionFromStorage !== undefined) {
      (metadata as any).decisionFromStorage = body.metadata.decisionFromStorage;
      this.logger.debug(`${this.logPrefix} Decision from storage: ${body.metadata.decisionFromStorage}`);
    }
    
    // Final metadata check before sending
    this.logger.debug(`${this.logPrefix} [META DEBUG] FINAL response metadata: sdkKeyFrom=${metadata.sdkKeyFrom}, visitorIdFrom=${metadata.visitorIdFrom}`);
    this.logger.debug(`${this.logPrefix} [META DEBUG] Post-merge metadata.flagKeysFrom: ${metadata.flagKeysFrom}`);
    
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
   * Creates an error response with consistent formatting.
   * 
   * @param requestId - The unique request ID
   * @param status - The HTTP status code
   * @param message - The error message
   * @param method - The HTTP method of the request
   * @param requestContext - The request context containing metadata
   * @returns The ResponseResult with error formatting
   * @private
   */
  private createErrorResponse(requestId: string, status: number, message: string, method?: string, requestContext?: any): ResponseResult {
    return this.createJsonResponse(requestId, status, { error: message }, method, requestContext);
  }

  /**
   * Parses URL search parameters into a dictionary.
   * 
   * @param searchString - The URL search string (query parameters)
   * @returns Record of parameter key-value pairs
   * @private
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
   * 
   * Handles both string and object body formats, with error handling
   * for malformed JSON.
   * 
   * @param requestAdapter - The request adapter
   * @returns A promise resolving to the request body object or null
   * @private
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
   * 
   * Validates the X-Optimizely-Admin-Token header against the configured
   * admin token from the configuration service.
   * 
   * @param requestAdapter - The request adapter
   * @returns A promise resolving to a boolean indicating admin status
   * @private
   */
  private async isAdminRequest(requestAdapter: IRequestAdapter): Promise<boolean> {
    try {
      // For now, just check if the admin token is present
      // In a production environment, this would be more robust
      const adminToken = requestAdapter.getHeader('X-Optimizely-Admin-Token');
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
   * 
   * Processes both feature flags and experiments from the datafile
   * to create a comprehensive list of available flag keys.
   * 
   * @param sdkKey - The SDK key
   * @param datafile - The datafile content object
   * @throws {Error} When flag key extraction or saving fails
   * @private
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
   * 
   * Simple hashing function for privacy protection in logs and metrics.
   * Shows first 4 characters followed by '...' for identification.
   * 
   * @param value - The sensitive value to hash
   * @returns A hash of the input value for safe logging
   * @private
   */
  private hashSensitiveValue(value: string): string {
    // Simple hashing function for privacy
    // In a real implementation, use a proper hashing algorithm
    return value.substring(0, 4) + '...';
  }

  /**
   * Generates a UUID for visitor ID creation.
   * 
   * @returns A UUID string
   * @private
   */
  private generateUUID(): string {
    return uuidv4();
  }

  /**
   * Initializes an empty config metadata template.
   * 
   * Creates the standard metadata structure used throughout
   * the request processing pipeline.
   * 
   * @returns An empty config metadata object with default values
   * @private
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
   * 
   * Supports multiple input formats:
   * - Header: X-Optimizely-Decide-Options (JSON list or CSV)
   * - Individual toggle headers: X-Optimizely-Decide-Options-<OPTION>
   * - Body: decideOptions or options field (array or CSV string)
   * - Query: decideOptions parameter (CSV string)
   * 
   * @param requestAdapter - The request adapter
   * @param requestBody - The parsed request body
   * @param urlParams - The parsed URL parameters
   * @returns Array of unique decide option strings in uppercase
   * @private
   * 
   * @example
   * ```typescript
   * // Header format
   * X-Optimizely-Decide-Options: ["INCLUDE_REASONS", "EXCLUDE_VARIABLES"]
   * 
   * // Individual toggle format
   * X-Optimizely-Decide-Options-INCLUDE-REASONS: true
   * 
   * // Body format
   * { "decideOptions": ["INCLUDE_REASONS"] }
   * 
   * // Query format
   * ?decideOptions=INCLUDE_REASONS,EXCLUDE_VARIABLES
   * ```
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

  /**
   * Parses a value to boolean with a default fallback.
   * 
   * Handles various input types and provides consistent boolean conversion:
   * - undefined/null → default value
   * - boolean → direct return
   * - string → 'true' (case-insensitive) → true, else false
   * - other → default value
   * 
   * @param value - The value to parse as boolean
   * @param defaultValue - The default value if parsing fails
   * @returns The parsed boolean value or default
   * @private
   */
  private parseBoolean(value: any, defaultValue: boolean): boolean {
    if (value === undefined || value === null) return defaultValue;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return defaultValue;
  }
} 