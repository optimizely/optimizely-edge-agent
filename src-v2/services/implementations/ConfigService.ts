import { IConfigService, OptimizelyDatafile } from "../interfaces/IConfigService";
import { IDatafileService } from "../interfaces/IDatafileService";
import { ILoggerAdapter } from "../../adapters/interfaces/ILoggerAdapter";

// Define constants for defaults
const PACKAGE_VERSION = '2.0.0'; // Should match package.json version
const DEFAULT_ENVIRONMENT = 'production';
const DEFAULT_CDN_PROVIDER = 'cloudflare';

/**
 * Service responsible for retrieving the Optimizely configuration (datafile).
 * Uses the DatafileService for retrieving and managing datafiles.
 */
export class ConfigService implements IConfigService {
  private logger: ILoggerAdapter;
  private datafileService: IDatafileService;
  private readonly logPrefix = '[v2][ConfigService]';
  private cachedVersion: string | null = null;
  private cachedEnvironment: string | null = null;
  private cachedCdnProvider: string | null = null;
  private cachedAdminToken: string | null = null;

  /**
   * Creates an instance of the ConfigService.
   * @param datafileService - Service for managing datafiles.
   * @param logger - Logger adapter.
   */
  constructor(datafileService: IDatafileService, logger: ILoggerAdapter) {
    if (!datafileService || !logger) {
      throw new Error("ConfigService requires datafileService and logger.");
    }
    this.datafileService = datafileService;
    this.logger = logger;
  }

  /**
   * Fetches the Optimizely configuration datafile for a given SDK key.
   * First attempts to get from KV storage, then falls back to fetching from CDN if not found.
   * 
   * @param sdkKey - The SDK key.
   * @returns A promise resolving to the OptimizelyDatafile or null.
   */
  async getDatafile(sdkKey?: string): Promise<OptimizelyDatafile | null> {
    if (!sdkKey) {
      this.logger.error(`${this.logPrefix} getDatafile: SDK key is required.`);
      return null;
    }

    this.logger.debug(`${this.logPrefix} Attempting to fetch datafile for key '${sdkKey}'`);

    try {
      // First try to get from storage
      let datafileJson = await this.datafileService.getDatafile(sdkKey);
      
      // If not found in storage, try to fetch from CDN
      if (!datafileJson) {
        this.logger.debug(`${this.logPrefix} Datafile not found in storage for '${sdkKey}', fetching from CDN.`);
        datafileJson = await this.datafileService.refreshDatafile(sdkKey);
        
        if (!datafileJson) {
          this.logger.warn(`${this.logPrefix} Datafile not found for SDK key '${sdkKey}'.`);
          return null;
        }
      }
      
      // Parse the JSON string to an object
      const datafile = JSON.parse(datafileJson) as OptimizelyDatafile;
      
      // Try to get revision for logging, handle potential errors if structure is unexpected
      let revision = 'unknown';
      if (datafile && typeof datafile === 'object' && 'revision' in datafile) {
        revision = String((datafile as any).revision);
      }
      
      this.logger.info(`${this.logPrefix} Successfully fetched datafile for SDK key '${sdkKey}', revision '${revision}'.`);
      return datafile;
    } catch (error) {
      this.logger.error(`${this.logPrefix} Failed to fetch or parse datafile for SDK key '${sdkKey}'.`, error);
      return null;
    }
  }

  /**
   * Gets the Edge Agent version.
   * @returns The Edge Agent version string or the default if not available.
   */
  getEdgeAgentVersion(): string | null {
    if (this.cachedVersion) {
      return this.cachedVersion;
    }
    
    // In a real implementation, this could come from an environment variable or a configuration file
    // For now, just return the hard-coded version
    this.cachedVersion = PACKAGE_VERSION;
    return this.cachedVersion;
  }
  
  /**
   * Gets the current environment (e.g., 'production', 'development').
   * @returns The environment string or the default if not available.
   */
  getEnvironment(): string | null {
    if (!this.cachedEnvironment) {
      // Use the environment adapter instead of process.env
      try {
        const envAdapter = this.datafileService.getEnvironmentAdapter();
        this.cachedEnvironment = envAdapter.getVariable('ENVIRONMENT') || DEFAULT_ENVIRONMENT;
      } catch (error) {
        this.logger.error("Error getting environment:", error);
        this.cachedEnvironment = DEFAULT_ENVIRONMENT;
      }
    }
    return this.cachedEnvironment;
  }
  
  /**
   * Gets the CDN provider (e.g., 'cloudflare', 'vercel', 'fastly').
   * @returns The CDN provider string or the default if not available.
   */
  getCdnProvider(): string | null {
    if (!this.cachedCdnProvider) {
      try {
        const envAdapter = this.datafileService.getEnvironmentAdapter();
        this.cachedCdnProvider = envAdapter.getVariable('CDN_PROVIDER') || DEFAULT_CDN_PROVIDER;
      } catch (error) {
        this.logger.error("Error getting CDN provider:", error);
        this.cachedCdnProvider = DEFAULT_CDN_PROVIDER;
      }
    }
    return this.cachedCdnProvider;
  }
  
  /**
   * Gets the admin token for secure operations.
   * @returns The admin token or null if not configured.
   */
  getAdminToken(): string | null {
    if (!this.cachedAdminToken) {
      try {
        const envAdapter = this.datafileService.getEnvironmentAdapter();
        this.cachedAdminToken = envAdapter.getVariable('ADMIN_TOKEN') || null;
      } catch (error) {
        this.logger.error("Error getting admin token:", error);
        this.cachedAdminToken = null;
      }
    }
    return this.cachedAdminToken;
  }

  // TODO: Implement onUpdate if needed, possibly using a polling mechanism

  /**
   * v1/v2 compatibility: Gets the configured header name for user attributes
   * @returns The header name or a default value
   */
  getAttributesHeaderName(): string | undefined {
    return 'X-Optimizely-Attributes-Header';
  }

  /**
   * v1/v2 compatibility: Gets the configured header name for event tags
   * @returns The header name or a default value
   */
  getEventTagsHeaderName(): string | undefined {
    return 'X-Optimizely-Event-Tags-Header';
  }

  /**
   * v1/v2 compatibility: Gets the configured header name for event key
   * @returns The header name or a default value
   */
  getEventKeyHeaderName(): string | undefined {
    return 'X-Optimizely-Event-Key';
  }

  /**
   * v1/v2 compatibility: Checks if FEX (Feature Experimentation) is enabled
   * @returns true if enabled, false otherwise
   */
  getEnableFex(): boolean {
    return true; // Default to enabled
  }

  /**
   * v1/v2 compatibility: Gets the configured decisions cookie name
   * @returns The cookie name or a default value
   */
  getDecisionsCookieName(): string {
    return 'optly_edge_decisions';
  }

  /**
   * v1/v2 compatibility: Gets the configured visitor ID cookie name
   * @returns The cookie name or a default value
   */
  getVisitorIdCookieName(): string {
    return 'optly_edge_visitor_id';
  }

  /**
   * v1/v2 compatibility: Gets the configured decisions header name
   * @returns The header name or a default value
   */
  getDecisionsHeaderName(): string {
    return 'X-OPTIMIZELY-EDGE-DECISIONS';
  }

  /**
   * v1/v2 compatibility: Gets the configured visitor ID header name
   * @returns The header name or a default value
   */
  getVisitorIdHeaderName(): string {
    return 'X-Optimizely-Edge-Visitor-Id';
  }

  /**
   * v1/v2 compatibility: Checks if datafile should be fetched from KV
   * @returns true if enabled, false otherwise
   */
  getEnableDatafileFromKV(): boolean {
    return false; // Default to disabled
  }

  /**
   * v1/v2 compatibility: Checks if flags should be fetched from KV
   * @returns true if enabled, false otherwise
   */
  getEnableFlagsFromKV(): boolean {
    return false; // Default to disabled
  }

  /**
   * v1/v2 compatibility: Checks if response metadata should be included
   * @returns true if enabled, false otherwise
   */
  getEnableResponseMetadata(): boolean {
    return true; // Default to enabled
  }

  /**
   * v1/v2 compatibility: Checks if cache override is enabled
   * @returns true if enabled, false otherwise
   */
  getOverrideCache(): boolean {
    return false; // Default to disabled
  }

  /**
   * v1/v2 compatibility: Gets default decide options
   * @returns Array of default decide options
   */
  getDefaultDecideOptions(): string[] {
    return []; // Default to empty array (no options)
  }
} 