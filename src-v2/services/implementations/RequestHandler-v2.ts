import { IRequestHandler, ResponseResult } from "../interfaces/IRequestHandler";
import { IRequestAdapter } from "../../adapters/interfaces/IRequestAdapter";
import { IDecisionService, OptimizelyDecision, OptimizelyDecideOption, OptimizelyUserContext } from "../interfaces/IDecisionService";
import { IEventService, OptimizelyEventData } from "../interfaces/IEventService";
import { ILoggerAdapter, LogContext } from "../../adapters/interfaces/ILoggerAdapter";
import { IMetricsAdapter, MetricTags } from "../../adapters/interfaces/IMetricsAdapter";
import { v4 as uuidv4 } from 'uuid';
import { ICacheService } from "../interfaces/ICacheService";
import { IEdgeModeIntegration } from './EdgeModeIntegration';
import { ICookieService } from '../interfaces/ICookieService';
import { IFlagStorageService } from "../interfaces/IFlagStorageService";
import { IConfigurationService } from "../interfaces/IConfigurationService";

/**
 * Service responsible for handling incoming requests and orchestrating
 * calls to other services to produce a response.
 */
export class RequestHandlerV2 implements IRequestHandler {
  private decisionService: IDecisionService;
  private eventService: IEventService;
  private logger: ILoggerAdapter;
  private metrics: IMetricsAdapter | null;
  private readonly componentName = 'RequestHandler';
  private cacheService: ICacheService;
  private edgeModeIntegration: IEdgeModeIntegration | null;
  private cookieService: ICookieService | null;
  private flagStorage: IFlagStorageService | null;
  private configurationService: IConfigurationService | null;
  private lastCleanupTime: number = 0;
  private cleanupTriggerInterval: number = 3600000; // Default: trigger possibility every hour
  private cleanupTriggerProbability: number = 0.1; // Default: 10% probability
  private requestTriggeringEnabled: boolean = true; // Default: true
  private implementationVersionHeader: string = 'X-Implementation-Version'; // Default implementation version header

  /**
   * Creates an instance of the RequestHandler.
   */
  constructor(
    decisionService: IDecisionService,
    eventService: IEventService,
    logger: ILoggerAdapter,
    cacheService: ICacheService,
    edgeModeIntegration?: IEdgeModeIntegration,
    metrics?: IMetricsAdapter,
    cookieService?: ICookieService,
    flagStorage?: IFlagStorageService,
    configurationService?: IConfigurationService,
    cleanupConfig?: {
      triggerIntervalMs?: number;
      triggerProbability?: number;
      requestTriggeringEnabled?: boolean;
    }
  ) {
    if (!decisionService || !eventService || !logger || !cacheService) {
      throw new Error("RequestHandler requires decisionService, eventService, logger, and cacheService.");
    }
    
    this.decisionService = decisionService;
    this.eventService = eventService;
    this.logger = logger.forComponent(this.componentName);
    this.cacheService = cacheService;
    this.edgeModeIntegration = edgeModeIntegration || null;
    this.metrics = metrics || null;
    this.cookieService = cookieService || null;
    this.flagStorage = flagStorage || null;
    this.configurationService = configurationService || null;
    
    // Initialize implementationVersionHeader from configService if available
    if (this.configurationService && typeof this.configurationService.getImplementationVersionHeader === 'function') {
      this.implementationVersionHeader = this.configurationService.getImplementationVersionHeader();
    }
    
    // Setup cleanup configuration
    if (cleanupConfig) {
      if (cleanupConfig.triggerIntervalMs !== undefined) {
        this.cleanupTriggerInterval = cleanupConfig.triggerIntervalMs;
      }
      if (cleanupConfig.triggerProbability !== undefined) {
        this.cleanupTriggerProbability = Math.max(0, Math.min(1, cleanupConfig.triggerProbability));
      }
      this.requestTriggeringEnabled = cleanupConfig.requestTriggeringEnabled !== false;
    }

    // Create service availability metrics - consolidated into a single metric
    if (this.metrics) {
      const services = {
        decision_service: 1,
        event_service: 1,
        cache_service: 1,
        edge_mode_integration: edgeModeIntegration ? 1 : 0,
        cookie_service: cookieService ? 1 : 0,
        flag_storage: flagStorage ? 1 : 0,
        configuration_service: configurationService ? 1 : 0
      };
      
      // Count total available services (single metric instead of 7)
      const availableCount = Object.values(services).filter(v => v === 1).length;
      this.metrics.setGauge('services_available_count', availableCount, { 
        total: Object.keys(services).length 
      });
      
      // Log detailed status for debugging without creating metrics
      this.logger.debug('Service availability status:', services);
      
      // Add cleanup configuration metrics
      if (this.flagStorage && this.requestTriggeringEnabled) {
        this.metrics.setGauge('cleanup_trigger_interval_ms', this.cleanupTriggerInterval);
        this.metrics.setGauge('cleanup_trigger_probability', this.cleanupTriggerProbability);
      }
    }

    // Log initialized services using structured logging
    this.logger.info("Initialized with required and optional services", {
      services: {
        decisionService: true,
        eventService: true,
        cacheService: true,
        edgeModeIntegration: !!edgeModeIntegration,
        metrics: !!metrics,
        cookieService: !!cookieService,
        flagStorage: !!flagStorage,
        configurationService: !!configurationService
      },
      cleanup: this.flagStorage ? {
        enabled: this.requestTriggeringEnabled,
        triggerIntervalMs: this.cleanupTriggerInterval,
        triggerProbability: this.cleanupTriggerProbability
      } : undefined
    });
  }


  /**
   * Handles an incoming request.
   * @param requestAdapter - The adapter for the incoming request.
   * @returns A promise resolving to the ResponseResult.
   */
  async handleRequest(requestAdapter: IRequestAdapter): Promise<ResponseResult> {
    const requestId = uuidv4();
    const method = requestAdapter.getMethod();
    const url = requestAdapter.getUrl();
    const path = url.pathname;
    
    // Create request-specific logger with request context
    const requestLogger = this.logger.forRequest(requestId, {
      method,
      path,
      url: url.toString()
    });
    
    // Start comprehensive request timer with operation context
    let requestTimer;
    let requestStartTime = Date.now();
    if (this.metrics) {
      requestTimer = this.metrics.startTimer('request_duration', {
        method,
        path,
        requestId
      });
    }
    
    // Track request counters with detailed dimensions
    if (this.metrics) {
      this.metrics.incrementCounter('requests_total', 1, {
        method,
        path,
        host: url.hostname
      });
    }
    
    requestLogger.info("Handling request");

    try {
      // Logic for handling the request...
      // This is where the original request handling logic would go
      
      // For simplicity, we'll just return a placeholder response
      const result: ResponseResult = {
        status: 200,
        body: JSON.stringify({ success: true }),
        headers: {
          'Content-Type': 'application/json',
          [this.implementationVersionHeader]: 'v2',
          'X-Request-ID': requestId
        }
      };
      
      // Record response metrics
      if (this.metrics) {
        this.metrics.incrementCounter('response_status', 1, { 
          status: result.status.toString(),
          method,
          path: path.split('/')[1] || 'root'
        });

        if (result.body) {
          const bodySize = result.body
            ? (typeof result.body === 'string' ? result.body.length : JSON.stringify(result.body).length) 
            : 0;

          this.metrics.recordHistogram('response_size_bytes', bodySize, { 
            method, 
            status: result.status.toString() 
          });
        }
      }
      
      // Log request completion with duration
      const duration = Date.now() - requestStartTime;
      if (requestTimer) {
        requestTimer.stop();
      }
      
      requestLogger.info("Request completed successfully", { 
        status: result.status,
        durationMs: duration
      });
      
      return result;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      
      // Log error with structured context
      requestLogger.error("Error handling request", errorObj, {
        errorType: errorObj.name,
        stack: errorObj.stack
      });
      
      // Track error metrics
      if (this.metrics) {
        this.metrics.incrementCounter('request_errors', 1, {
          method,
          path: path.split('/')[1] || 'root',
          error_type: errorObj.name
        });
      }
      
      // Calculate duration and stop timer
      const duration = Date.now() - requestStartTime;
      if (requestTimer) {
        requestTimer.stop();
      }
      
      requestLogger.info("Request failed", { 
        errorType: errorObj.name,
        durationMs: duration
      });
      
      // Return error response
      return {
        status: 500,
        body: JSON.stringify({ error: "Internal Server Error" }),
        headers: {
          'Content-Type': 'application/json',
          [this.implementationVersionHeader]: 'v2',
          'X-Request-ID': requestId
        }
      };
    }
  }
  
  /**
   * Masks sensitive value for logging (e.g., user IDs, SDK keys).
   * @param value - The value to mask
   * @returns Masked value for safe logging
   */
  private maskSensitiveValue(value: string): string {
    if (!value) return '';
    if (value.length <= 4) return '***';
    return `${value.substring(0, 2)}***${value.substring(value.length - 2)}`;
  }
} 