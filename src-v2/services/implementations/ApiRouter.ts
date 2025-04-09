import { IRequestAdapter } from "../../adapters/interfaces/IRequestAdapter";
import { ILoggerAdapter } from "../../adapters/interfaces/ILoggerAdapter";
import { IDatafileService } from "../interfaces/IDatafileService";
import { IMetricsAdapter } from "../../adapters/interfaces/IMetricsAdapter";
import { ResponseResult } from "../interfaces/IRequestHandler";
import { v4 as uuidv4 } from 'uuid';
import { ICacheService } from "../interfaces/ICacheService";
import { IConfigService } from "../interfaces/IConfigService";
import { IDecisionService, OptimizelyUserContext } from "../interfaces/IDecisionService";

/**
 * Service responsible for routing and handling API requests.
 */
export class ApiRouter {
  private datafileService: IDatafileService;
  private cacheService: ICacheService;
  private configService: IConfigService;
  private logger: ILoggerAdapter;
  private metrics: IMetricsAdapter | undefined;
  private decisionService: IDecisionService | undefined;
  private readonly logPrefix = '[v2][ApiRouter]';

  /**
   * Creates an instance of the ApiRouter.
   */
  constructor(
    datafileService: IDatafileService,
    cacheService: ICacheService,
    configService: IConfigService,
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
    
    // Start request timer for API endpoints
    const requestTimerStop = this.metrics?.startTimer('api_request_duration_seconds', {
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
      
      // Handle API endpoints
      if (path.endsWith('/api/datafile')) {
        result = await this.handleDatafileRequest(requestAdapter, requestId);
      } else if (path.endsWith('/api/flagkeys')) {
        result = await this.handleFlagKeysRequest(requestAdapter, requestId);
      } else if (path.endsWith('/api/sdk')) {
        result = await this.handleSdkInfoRequest(requestAdapter, requestId);
      } else if (path.endsWith('/api/variations')) {
        result = await this.handleVariationsRequest(requestAdapter, requestId);
      } else if (path.endsWith('/api/decide-options')) {
        result = await this.handleDecideOptionsRequest(requestAdapter, requestId);
      } else if (path.endsWith('/api/set-forced-variation')) {
        result = await this.handleSetForcedVariationRequest(requestAdapter, requestId);
      } else if (path.endsWith('/api/get-forced-variation')) {
        result = await this.handleGetForcedVariationRequest(requestAdapter, requestId);
      } else if (path.endsWith('/api/remove-forced-variation')) {
        result = await this.handleRemoveForcedVariationRequest(requestAdapter, requestId);
      } else if (path.includes('/api/admin/')) {
        result = await this.handleAdminRequest(requestAdapter, requestId);
      } else {
        // Unknown API endpoint
        this.metrics?.incrementCounter('api_errors_total', 1, {
          endpoint: path,
          method,
          error_type: 'unknown_endpoint'
        });
        result = this.createJsonResponse(requestId, 404, { error: "Unknown endpoint" });
      }
      
      // Add implementation version header
      if (!result.headers) {
        result.headers = {};
      }
      result.headers['X-Implementation-Version'] = 'v2';
      result.headers['X-Request-ID'] = requestId;
      
      // Record response status
      this.metrics?.incrementCounter('api_responses_total', 1, {
        status_code: result.status.toString(),
        method,
        endpoint: path
      });
      
      // Stop request timer
      if (requestTimerStop) {
        requestTimerStop.stop();
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
      if (requestTimerStop) {
        requestTimerStop.stop();
      }
      
      // Create error response with headers
      const errorResponse = this.createErrorResponse(requestId, 500, "Internal Server Error");
      
      // Add implementation version header
      if (!errorResponse.headers) {
        errorResponse.headers = {};
      }
      errorResponse.headers['X-Implementation-Version'] = 'v2';
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
    
    // Check for SDK key in query parameters
    const params = this.parseUrlParams(url.search);
    const sdkKey = params.sdkKey || '';
    
    if (!sdkKey) {
      this.metrics?.incrementCounter('api_errors_total', 1, {
        endpoint: '/api/datafile',
        method,
        error_type: 'missing_sdk_key'
      });
      return this.createJsonResponse(requestId, 400, { error: "SDK key is required" });
    }
    
    // Track datafile request
    this.metrics?.incrementCounter('datafile_requests_total', 1, {
      method,
    });
    
    try {
      if (method === 'GET') {
        // Get datafile by SDK key
        const datafileTimer = this.metrics?.startTimer('datafile_fetch_duration');
        const datafile = await this.datafileService.getDatafile(sdkKey);
        if (datafileTimer) datafileTimer.stop();
        
        if (!datafile) {
          this.metrics?.incrementCounter('api_errors_total', 1, {
            endpoint: '/api/datafile',
            method,
            error_type: 'datafile_not_found'
          });
          return this.createJsonResponse(requestId, 404, { error: "Datafile not found" });
        }
        
        // Track datafile size
        if (typeof datafile === 'string') {
          this.metrics?.recordHistogram('datafile_size_bytes', datafile.length, { endpoint: '/api/datafile' });
        }
        
        return this.createJsonResponse(requestId, 200, JSON.parse(datafile));
      } else if (method === 'PUT' || method === 'POST') {
        // Only allow admin users to update datafiles
        const isAdmin = await this.isAdminRequest(requestAdapter);
        if (!isAdmin) {
          this.metrics?.incrementCounter('api_errors_total', 1, {
            endpoint: '/api/datafile',
            method,
            error_type: 'unauthorized'
          });
          return this.createJsonResponse(requestId, 403, { error: "Unauthorized" });
        }
        
        // Get datafile content from request body
        const requestBody = await this.getRequestBody(requestAdapter);
        if (!requestBody) {
          this.metrics?.incrementCounter('api_errors_total', 1, {
            endpoint: '/api/datafile',
            method,
            error_type: 'invalid_body'
          });
          return this.createJsonResponse(requestId, 400, { error: "Invalid request body" });
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
        
        return this.createJsonResponse(requestId, 200, { success: true });
      } else {
        // Method not allowed
        this.metrics?.incrementCounter('api_errors_total', 1, {
          endpoint: '/api/datafile',
          method,
          error_type: 'method_not_allowed'
        });
        return this.createJsonResponse(requestId, 405, { error: "Method not allowed" });
      }
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error handling datafile request:`, error);
      this.metrics?.incrementCounter('api_errors_total', 1, {
        endpoint: '/api/datafile',
        method,
        error_type: 'internal_error'
      });
      return this.createErrorResponse(requestId, 500, "Error processing datafile request");
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
    
    // Check for SDK key in query parameters
    const params = this.parseUrlParams(url.search);
    const sdkKey = params.sdkKey || '';
    
    if (!sdkKey) {
      this.metrics?.incrementCounter('api_errors_total', 1, {
        endpoint: '/api/flagkeys',
        method,
        error_type: 'missing_sdk_key'
      });
      return this.createJsonResponse(requestId, 400, { error: "SDK key is required" });
    }
    
    // Track flag keys request
    this.metrics?.incrementCounter('flagkeys_requests_total', 1, {
      method,
    });
    
    try {
      if (method === 'GET') {
        // Get flag keys by SDK key
        const flagKeysTimer = this.metrics?.startTimer('flagkeys_fetch_duration');
        const flagKeys = await this.datafileService.getFlagKeys(sdkKey);
        if (flagKeysTimer) flagKeysTimer.stop();
        
        if (!flagKeys || flagKeys.length === 0) {
          this.metrics?.incrementCounter('api_errors_total', 1, {
            endpoint: '/api/flagkeys',
            method,
            error_type: 'flagkeys_not_found'
          });
          return this.createJsonResponse(requestId, 404, { error: "Flag keys not found" });
        }
        
        // Track flag keys count
        this.metrics?.recordHistogram('flagkeys_count', flagKeys.length, { endpoint: '/api/flagkeys' });
        
        return this.createJsonResponse(requestId, 200, { flagKeys });
      } else if (method === 'PUT' || method === 'POST') {
        // Only allow admin users to update flag keys
        const isAdmin = await this.isAdminRequest(requestAdapter);
        if (!isAdmin) {
          this.metrics?.incrementCounter('api_errors_total', 1, {
            endpoint: '/api/flagkeys',
            method,
            error_type: 'unauthorized'
          });
          return this.createJsonResponse(requestId, 403, { error: "Unauthorized" });
        }
        
        // Get flag keys from request body
        const requestBody = await this.getRequestBody(requestAdapter);
        if (!requestBody || !Array.isArray(requestBody.flagKeys)) {
          this.metrics?.incrementCounter('api_errors_total', 1, {
            endpoint: '/api/flagkeys',
            method,
            error_type: 'invalid_body'
          });
          return this.createJsonResponse(requestId, 400, { error: "Invalid request body" });
        }
        
        // Save flag keys
        const saveTimer = this.metrics?.startTimer('flagkeys_save_duration');
        await this.datafileService.saveFlagKeys(sdkKey, requestBody.flagKeys);
        if (saveTimer) saveTimer.stop();
        
        this.metrics?.incrementCounter('flagkeys_updates_total', 1, {
          method,
        });
        
        return this.createJsonResponse(requestId, 200, { success: true });
      } else {
        // Method not allowed
        this.metrics?.incrementCounter('api_errors_total', 1, {
          endpoint: '/api/flagkeys',
          method,
          error_type: 'method_not_allowed'
        });
        return this.createJsonResponse(requestId, 405, { error: "Method not allowed" });
      }
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error handling flag keys request:`, error);
      this.metrics?.incrementCounter('api_errors_total', 1, {
        endpoint: '/api/flagkeys',
        method,
        error_type: 'internal_error'
      });
      return this.createErrorResponse(requestId, 500, "Error processing flag keys request");
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
    
    // Track SDK info request
    this.metrics?.incrementCounter('sdk_info_requests_total', 1, { method });
    
    try {
      if (method === 'GET') {
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
        });
      } else {
        // Method not allowed
        this.metrics?.incrementCounter('api_errors_total', 1, {
          endpoint: '/api/sdk',
          method,
          error_type: 'method_not_allowed'
        });
        return this.createJsonResponse(requestId, 405, { error: "Method not allowed" });
      }
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error handling SDK info request:`, error);
      this.metrics?.incrementCounter('api_errors_total', 1, {
        endpoint: '/api/sdk',
        method,
        error_type: 'internal_error'
      });
      return this.createErrorResponse(requestId, 500, "Error processing SDK info request");
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
      return this.createJsonResponse(requestId, 400, { error: "SDK key is required" });
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
        return this.createJsonResponse(requestId, 501, { error: "Variations API not implemented" });
      } else if (method === 'PUT' || method === 'POST') {
        // Only allow admin users for variations updates
        const isAdmin = await this.isAdminRequest(requestAdapter);
        if (!isAdmin) {
          this.metrics?.incrementCounter('api_errors_total', 1, {
            endpoint: '/api/variations',
            method,
            error_type: 'unauthorized'
          });
          return this.createJsonResponse(requestId, 403, { error: "Unauthorized" });
        }
        
        // Get variation changes from request body
        const requestBody = await this.getRequestBody(requestAdapter);
        if (!requestBody) {
          this.metrics?.incrementCounter('api_errors_total', 1, {
            endpoint: '/api/variations',
            method,
            error_type: 'invalid_body'
          });
          return this.createJsonResponse(requestId, 400, { error: "Invalid request body" });
        }
        
        // Not implemented yet
        this.metrics?.incrementCounter('api_errors_total', 1, {
          endpoint: '/api/variations',
          method,
          error_type: 'not_implemented'
        });
        return this.createJsonResponse(requestId, 501, { error: "Variations API not implemented" });
      } else {
        // Method not allowed
        this.metrics?.incrementCounter('api_errors_total', 1, {
          endpoint: '/api/variations',
          method,
          error_type: 'method_not_allowed'
        });
        return this.createJsonResponse(requestId, 405, { error: "Method not allowed" });
      }
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error handling variations request:`, error);
      this.metrics?.incrementCounter('api_errors_total', 1, {
        endpoint: '/api/variations',
        method,
        error_type: 'internal_error'
      });
      return this.createErrorResponse(requestId, 500, "Error processing variations request");
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
      return this.createJsonResponse(requestId, 403, { error: "Unauthorized" });
    }
    
    // Track admin request
    this.metrics?.incrementCounter('admin_requests_total', 1, {
      endpoint: path,
      method
    });
    
    try {
      if (path.endsWith('/api/admin/cache/clear')) {
        // Clear cache
        if (method === 'POST') {
          const cacheTimer = this.metrics?.startTimer('cache_clear_duration');
          // Clear cache (implementation would depend on the cache keys pattern)
          // For now, just log it
          this.logger.info(`${this.logPrefix} Admin requested cache clearing`);
          if (cacheTimer) cacheTimer.stop();
          
          return this.createJsonResponse(requestId, 200, { success: true });
        } else {
          // Method not allowed
          this.metrics?.incrementCounter('api_errors_total', 1, {
            endpoint: '/api/admin/cache/clear',
            method,
            error_type: 'method_not_allowed'
          });
          return this.createJsonResponse(requestId, 405, { error: "Method not allowed" });
        }
      } else if (path.endsWith('/api/admin/status')) {
        // Get system status
        if (method === 'GET') {
          const status = {
            timestamp: new Date().toISOString(),
            uptime: 'healthy',
            version: this.configService.getEdgeAgentVersion() || 'unknown',
            environment: this.configService.getEnvironment() || 'unknown',
            cdnProvider: this.configService.getCdnProvider() || 'unknown'
          };
          
          return this.createJsonResponse(requestId, 200, status);
        } else {
          // Method not allowed
          this.metrics?.incrementCounter('api_errors_total', 1, {
            endpoint: '/api/admin/status',
            method,
            error_type: 'method_not_allowed'
          });
          return this.createJsonResponse(requestId, 405, { error: "Method not allowed" });
        }
      } else {
        // Unknown admin endpoint
        this.metrics?.incrementCounter('api_errors_total', 1, {
          endpoint: 'admin',
          method,
          error_type: 'unknown_endpoint'
        });
        return this.createJsonResponse(requestId, 404, { error: "Unknown admin endpoint" });
      }
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error handling admin request:`, error);
      this.metrics?.incrementCounter('api_errors_total', 1, {
        endpoint: 'admin',
        method,
        error_type: 'internal_error'
      });
      return this.createErrorResponse(requestId, 500, "Error processing admin request");
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
    
    // Only allow POST method for this endpoint
    if (method !== 'POST') {
      this.metrics?.incrementCounter('api_errors_total', 1, {
        endpoint: '/api/set-forced-variation',
        method,
        error_type: 'method_not_allowed'
      });
      return this.createJsonResponse(requestId, 405, { error: "Method not allowed. Use POST." });
    }
    
    try {
      // Get request body
      const requestBody = await this.getRequestBody(requestAdapter);
      
      // Validate required fields
      const sdkKey = requestBody?.sdkKey;
      const flagKey = requestBody?.flagKey;
      const userId = requestBody?.userId;
      const variationKey = requestBody?.variationKey; // Can be null to remove
      
      if (!sdkKey || !flagKey || !userId) {
        this.metrics?.incrementCounter('api_errors_total', 1, {
          endpoint: '/api/set-forced-variation',
          method,
          error_type: 'missing_required_params'
        });
        return this.createJsonResponse(requestId, 400, {
          error: "Required parameters missing",
          required: ["sdkKey", "flagKey", "userId"]
        });
      }
      
      // Check if DecisionService is available and has setForcedVariation method
      if (this.decisionService && this.decisionService.setForcedVariation) {
        this.logger.info(`${this.logPrefix} Setting forced variation for user ${userId}, flag ${flagKey}, variation ${variationKey || 'null'}`);
        
        try {
          // Set the forced variation
          await this.decisionService.setForcedVariation(
            flagKey,
            userId,
            variationKey,
            { sdkKey }
          );
          
          // Track the operation
          this.metrics?.incrementCounter('forced_variation_operations_total', 1, {
            operation: 'set',
            flag_key: flagKey,
            sdk_key: this.hashSensitiveValue(sdkKey),
            result: 'success'
          });
          
          return this.createJsonResponse(requestId, 200, {
            success: true,
            flagKey,
            userId,
            variationKey
          });
        } catch (error) {
          this.logger.error(`${this.logPrefix} Error setting forced variation:`, error);
          
          this.metrics?.incrementCounter('forced_variation_operations_total', 1, {
            operation: 'set',
            flag_key: flagKey,
            sdk_key: this.hashSensitiveValue(sdkKey),
            result: 'error'
          });
          
          return this.createJsonResponse(requestId, 500, {
            error: "Failed to set forced variation",
            message: error instanceof Error ? error.message : "Unknown error"
          });
        }
      }
      
      // Decision Service not available or method not supported
      this.logger.warn(`${this.logPrefix} Set forced variation request received, but DecisionService is not available or doesn't support the method`);
      
      // Track the call
      this.metrics?.incrementCounter('forced_variation_operations_total', 1, {
        operation: 'set',
        flag_key: flagKey,
        sdk_key: this.hashSensitiveValue(sdkKey),
        result: 'not_supported'
      });
      
      return this.createJsonResponse(requestId, 501, {
        message: "Forced variation is not supported by the current configuration.",
        status: "not_implemented",
        details: "The DecisionService implementation does not support setting forced variations."
      });
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error handling set forced variation request:`, error);
      this.metrics?.incrementCounter('api_errors_total', 1, {
        endpoint: '/api/set-forced-variation',
        method,
        error_type: 'internal_error'
      });
      return this.createErrorResponse(requestId, 500, "Error processing set forced variation request");
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
            error: "Failed to get forced variation",
            message: error instanceof Error ? error.message : "Unknown error"
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
    
    // Only allow POST or DELETE methods for this endpoint
    if (method !== 'POST' && method !== 'DELETE') {
      this.metrics?.incrementCounter('api_errors_total', 1, {
        endpoint: '/api/remove-forced-variation',
        method,
        error_type: 'method_not_allowed'
      });
      return this.createJsonResponse(requestId, 405, { error: "Method not allowed. Use POST or DELETE." });
    }
    
    try {
      // Get request parameters
      let sdkKey, flagKey, userId;
      
      if (method === 'DELETE') {
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
          endpoint: '/api/remove-forced-variation',
          method,
          error_type: 'missing_required_params'
        });
        return this.createJsonResponse(requestId, 400, {
          error: "Required parameters missing",
          required: ["sdkKey", "flagKey", "userId"]
        });
      }
      
      // Check if DecisionService is available and has setForcedVariation method (used to remove by passing null)
      if (this.decisionService && this.decisionService.setForcedVariation) {
        this.logger.info(`${this.logPrefix} Removing forced variation for user ${userId}, flag ${flagKey}`);
        
        try {
          // Remove the forced variation by setting it to null
          await this.decisionService.setForcedVariation(
            flagKey,
            userId,
            null, // Pass null to remove the forced variation
            { sdkKey }
          );
          
          // Track the operation
          this.metrics?.incrementCounter('forced_variation_operations_total', 1, {
            operation: 'remove',
            flag_key: flagKey,
            sdk_key: this.hashSensitiveValue(sdkKey),
            result: 'success'
          });
          
          return this.createJsonResponse(requestId, 200, {
            success: true,
            flagKey,
            userId
          });
        } catch (error) {
          this.logger.error(`${this.logPrefix} Error removing forced variation:`, error);
          
          this.metrics?.incrementCounter('forced_variation_operations_total', 1, {
            operation: 'remove',
            flag_key: flagKey,
            sdk_key: this.hashSensitiveValue(sdkKey),
            result: 'error'
          });
          
          return this.createJsonResponse(requestId, 500, {
            error: "Failed to remove forced variation",
            message: error instanceof Error ? error.message : "Unknown error"
          });
        }
      }
      
      // Decision Service not available or method not supported
      this.logger.warn(`${this.logPrefix} Remove forced variation request received, but DecisionService is not available or doesn't support the method`);
      
      // Track the call
      this.metrics?.incrementCounter('forced_variation_operations_total', 1, {
        operation: 'remove',
        flag_key: flagKey,
        sdk_key: this.hashSensitiveValue(sdkKey),
        result: 'not_supported'
      });
      
      return this.createJsonResponse(requestId, 501, {
        message: "Forced variation is not supported by the current configuration.",
        status: "not_implemented",
        details: "The DecisionService implementation does not support removing forced variations."
      });
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error handling remove forced variation request:`, error);
      this.metrics?.incrementCounter('api_errors_total', 1, {
        endpoint: '/api/remove-forced-variation',
        method,
        error_type: 'internal_error'
      });
      return this.createErrorResponse(requestId, 500, "Error processing remove forced variation request");
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
        return this.createJsonResponse(requestId, 405, { error: "Method not allowed. Use GET or POST." });
      }
      
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
      return this.createJsonResponse(requestId, 200, formattedOptions);
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error handling decide options request:`, error);
      this.metrics?.incrementCounter('api_errors_total', 1, {
        endpoint: '/api/decide-options',
        method,
        error_type: 'internal_error'
      });
      return this.createErrorResponse(requestId, 500, "Error processing decide options request");
    }
  }

  /**
   * Creates a JSON response.
   * @param requestId - The unique request ID.
   * @param status - The HTTP status code.
   * @param body - The response body.
   * @returns The ResponseResult.
   */
  private createJsonResponse(requestId: string, status: number, body: any): ResponseResult {
    return {
      status,
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-Request-ID': requestId
      }
    };
  }

  /**
   * Creates an error response.
   * @param requestId - The unique request ID.
   * @param status - The HTTP status code.
   * @param message - The error message.
   * @returns The ResponseResult.
   */
  private createErrorResponse(requestId: string, status: number, message: string): ResponseResult {
    return this.createJsonResponse(requestId, status, { error: message });
  }

  /**
   * Parses URL search parameters into a key-value object.
   * @param search - The URL search string.
   * @returns An object with key-value pairs.
   */
  private parseUrlParams(search: string): Record<string, string> {
    const params: Record<string, string> = {};
    const searchParams = new URLSearchParams(search);
    
    for (const [key, value] of searchParams.entries()) {
      params[key] = value;
    }
    
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
} 