import { IRequestAdapter, CloudflareRequestAdapter } from './IRequestAdapter';

/**
 * Type definitions for Cloudflare Workers KV namespace
 */
interface KVNamespace {
  get(key: string, options?: { type?: string; cacheTtl?: number }): Promise<string | null>;
  put(key: string, value: string, options?: { expiration?: number; expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * Interface for storage operations
 */
interface IStorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * Minimal implementation of Cloudflare storage adapter
 */
class CloudflareStorageAdapter implements IStorageAdapter {
  private kvNamespace: KVNamespace;
  
  constructor(kvNamespace: KVNamespace) {
    this.kvNamespace = kvNamespace;
  }
  
  async get(key: string): Promise<string | null> {
    return await this.kvNamespace.get(key);
  }
  
  async set(key: string, value: string, ttl?: number): Promise<void> {
    const options = ttl ? { expirationTtl: ttl } : undefined;
    await this.kvNamespace.put(key, value, options);
  }
  
  async delete(key: string): Promise<void> {
    await this.kvNamespace.delete(key);
  }
}

/**
 * Interface for configuration service
 */
interface IConfigService {
  getDatafile(sdkKey: string): Promise<object | null>;
  getFeatureFlag(sdkKey: string, featureKey: string): Promise<object | null>;
}

/**
 * Minimal implementation of ConfigService
 */
class ConfigService implements IConfigService {
  private storageAdapter: IStorageAdapter;
  private optimizelyClient: any; // This would be the Optimizely SDK client
  
  constructor(storageAdapter: IStorageAdapter, optimizelyClient: any) {
    this.storageAdapter = storageAdapter;
    this.optimizelyClient = optimizelyClient;
  }
  
  async getDatafile(sdkKey: string): Promise<object | null> {
    // First try from cache
    const cachedDatafile = await this.storageAdapter.get(`datafile:${sdkKey}`);
    if (cachedDatafile) {
      return JSON.parse(cachedDatafile);
    }
    
    // If not in cache, get from Optimizely service
    try {
      const datafile = await this.optimizelyClient.getDatafile(sdkKey);
      if (datafile) {
        // Cache the datafile
        await this.storageAdapter.set(`datafile:${sdkKey}`, JSON.stringify(datafile), 300); // 5 minute TTL
        return datafile;
      }
    } catch (error) {
      console.error('Error fetching datafile:', error);
    }
    
    return null;
  }
  
  async getFeatureFlag(sdkKey: string, featureKey: string): Promise<object | null> {
    const datafile = await this.getDatafile(sdkKey);
    if (!datafile) {
      return null;
    }
    
    // Extract feature from datafile
    // This is simplified logic - real implementation would parse the datafile
    const features = (datafile as any).featureFlags || [];
    return features.find((feature: any) => feature.key === featureKey) || null;
  }
}

/**
 * Interface for decision service
 */
interface IDecisionService {
  getVariation(sdkKey: string, experimentKey: string, userId: string, attributes?: Record<string, any>): Promise<string | null>;
  isFeatureEnabled(sdkKey: string, featureKey: string, userId: string, attributes?: Record<string, any>): Promise<boolean>;
}

/**
 * Minimal implementation of DecisionService
 */
class DecisionService implements IDecisionService {
  private configService: IConfigService;
  private optimizelyClient: any; // This would be the Optimizely SDK client
  
  constructor(configService: IConfigService, optimizelyClient: any) {
    this.configService = configService;
    this.optimizelyClient = optimizelyClient;
  }
  
  async getVariation(sdkKey: string, experimentKey: string, userId: string, attributes: Record<string, any> = {}): Promise<string | null> {
    const datafile = await this.configService.getDatafile(sdkKey);
    if (!datafile) {
      return null;
    }
    
    // Initialize the SDK with the datafile
    const client = this.optimizelyClient.createInstance({ datafile });
    
    // Get the variation
    try {
      return client.activate(experimentKey, userId, attributes);
    } catch (error) {
      console.error('Error getting variation:', error);
      return null;
    }
  }
  
  async isFeatureEnabled(sdkKey: string, featureKey: string, userId: string, attributes: Record<string, any> = {}): Promise<boolean> {
    const datafile = await this.configService.getDatafile(sdkKey);
    if (!datafile) {
      return false;
    }
    
    // Initialize the SDK with the datafile
    const client = this.optimizelyClient.createInstance({ datafile });
    
    // Check if feature is enabled
    try {
      return client.isFeatureEnabled(featureKey, userId, attributes);
    } catch (error) {
      console.error('Error checking feature:', error);
      return false;
    }
  }
}

/**
 * Main request handler interface
 */
interface IRequestHandler {
  handleRequest(request: IRequestAdapter): Promise<unknown>;
}

/**
 * Main request handler implementation
 */
class RequestHandler implements IRequestHandler {
  private decisionService: IDecisionService;
  
  constructor(decisionService: IDecisionService) {
    this.decisionService = decisionService;
  }
  
  async handleRequest(request: IRequestAdapter): Promise<unknown> {
    const path = request.getPath();
    
    // Simple path-based routing
    if (path.startsWith('/api/')) {
      return this.handleApiRequest(request);
    } else {
      return this.handleExperimentRequest(request);
    }
  }
  
  private async handleApiRequest(request: IRequestAdapter): Promise<unknown> {
    // Get the API endpoint from the path
    const path = request.getPath();
    const endpoint = path.replace('/api/', '');
    
    // Handle different API endpoints
    if (endpoint === 'status') {
      return request.createResponse({ status: 'ok' });
    }
    
    // 404 for unknown endpoints
    return request.createResponse(
      { error: 'Not found' },
      { status: 404 }
    );
  }
  
  private async handleExperimentRequest(request: IRequestAdapter): Promise<unknown> {
    const sdkKey = request.getQueryParam('sdkKey');
    const experimentKey = request.getQueryParam('experiment');
    const userId = request.getQueryParam('userId');
    
    if (!sdkKey || !experimentKey || !userId) {
      return request.createResponse(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }
    
    // Get attributes from query params
    const attributes: Record<string, any> = {};
    const queryParams = request.getQueryParams();
    for (const [key, value] of Object.entries(queryParams)) {
      if (key !== 'sdkKey' && key !== 'experiment' && key !== 'userId') {
        attributes[key] = value;
      }
    }
    
    // Get the variation
    const variation = await this.decisionService.getVariation(
      sdkKey,
      experimentKey,
      userId,
      attributes
    );
    
    return request.createResponse({ variation });
  }
}

/**
 * Factory for creating Optimizely client
 */
class OptimizelyClientFactory {
  static createClient(): any {
    // In a real implementation, this would initialize the Optimizely SDK
    // For this example, we'll return a mock
    return {
      getDatafile: async (sdkKey: string) => {
        // Mock implementation
        return {
          version: '4',
          sdkKey,
          featureFlags: [
            { key: 'feature1', enabled: true },
            { key: 'feature2', enabled: false }
          ]
        };
      },
      createInstance: (options: any) => {
        // Mock instance
        return {
          activate: (experimentKey: string, userId: string, attributes: any) => {
            // Simple mock decision logic
            return userId.length % 2 === 0 ? 'variation_a' : 'variation_b';
          },
          isFeatureEnabled: (featureKey: string, userId: string, attributes: any) => {
            // Simple mock feature decision
            return featureKey === 'feature1';
          }
        };
      }
    };
  }
}

/**
 * Composition Root for the application
 * This is where all dependencies are wired together
 */
export class CompositionRoot {
  /**
   * Creates the entire dependency graph for a Cloudflare Worker environment
   */
  static createCloudflareWorkerApp(env: any, request: Request): IRequestHandler {
    // Create the platform-specific adapters
    const requestAdapter = new CloudflareRequestAdapter(request);
    const storageAdapter = new CloudflareStorageAdapter(env.OPTIMIZELY_CACHE);
    
    // Create the Optimizely client
    const optimizelyClient = OptimizelyClientFactory.createClient();
    
    // Create the services
    const configService = new ConfigService(storageAdapter, optimizelyClient);
    const decisionService = new DecisionService(configService, optimizelyClient);
    
    // Create the request handler with its dependencies
    const requestHandler = new RequestHandler(decisionService);
    
    return requestHandler;
  }
}

/**
 * Example Cloudflare Worker Entry Point
 */
export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    // Create the application using the composition root
    const app = CompositionRoot.createCloudflareWorkerApp(env, request);
    
    // Create the request adapter
    const requestAdapter = new CloudflareRequestAdapter(request);
    
    try {
      // Handle the request
      const response = await app.handleRequest(requestAdapter);
      return response as Response;
    } catch (error) {
      // Handle errors
      console.error('Error handling request:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}; 