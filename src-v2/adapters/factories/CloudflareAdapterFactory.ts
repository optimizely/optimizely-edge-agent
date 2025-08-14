import { IRequestAdapter } from "../interfaces/IRequestAdapter";
import { IStorageAdapter } from "../interfaces/IStorageAdapter";
import { IEnvironmentAdapter } from "../interfaces/IEnvironmentAdapter";
import { ILoggerAdapter } from "../interfaces/ILoggerAdapter";
import { IMetricsAdapter } from "../interfaces/IMetricsAdapter";
import { IResponseAdapter } from "../interfaces/IResponseAdapter";

import { CloudflareRequestAdapter } from "../implementations/cloudflare/CloudflareRequestAdapter";
import { CloudflareStorageAdapter } from "../implementations/cloudflare/CloudflareStorageAdapter";
import { CloudflareEnvironmentAdapter, CloudflareEnv, CloudflareExecutionContext } from "../implementations/cloudflare/CloudflareEnvironmentAdapter";
import { CloudflareLoggerAdapter } from "../implementations/cloudflare/CloudflareLoggerAdapter";
import { CloudflareMetricsAdapter } from "../implementations/cloudflare/CloudflareMetricsAdapter";
import { CloudflareResponseAdapter } from "../implementations/cloudflare/CloudflareResponseAdapter";

// Import the Cloudflare types
import type * as CF from '@cloudflare/workers-types';

// Type alias to be consistent with CloudflareStorageAdapter
type CloudflareKV = CF.KVNamespace;

// Interface defining the inputs required by the Cloudflare factory
export interface CloudflareAdapterFactoryInputs {
  request: Request;
  env: CloudflareEnv;
  ctx: CloudflareExecutionContext;
}

/**
 * Factory class responsible for creating adapter instances specific to the Cloudflare environment.
 */
export class CloudflareAdapterFactory {
  private inputs: CloudflareAdapterFactoryInputs;
  private environmentAdapter: IEnvironmentAdapter | null = null; // Cache adapters
  private loggerAdapter: ILoggerAdapter | null = null;

  constructor(inputs: CloudflareAdapterFactoryInputs) {
    if (!inputs || !inputs.request || !inputs.env || !inputs.ctx) {
      throw new Error("CloudflareAdapterFactory requires request, env, and ctx inputs.");
    }
    this.inputs = inputs;
  }

  // Method to create or get cached EnvironmentAdapter
  private getEnvironmentAdapter(): IEnvironmentAdapter {
    if (!this.environmentAdapter) {
      this.environmentAdapter = new CloudflareEnvironmentAdapter(this.inputs.env, this.inputs.ctx);
    }
    return this.environmentAdapter;
  }

  // Method to create or get cached LoggerAdapter
  private getLoggerAdapter(): ILoggerAdapter {
    if (!this.loggerAdapter) {
      const envAdapter = this.getEnvironmentAdapter();
      this.loggerAdapter = new CloudflareLoggerAdapter(envAdapter);
    }
    return this.loggerAdapter;
  }

  createRequestAdapter(): IRequestAdapter {
    // RequestAdapter is typically created per-request
    return new CloudflareRequestAdapter(this.inputs.request);
  }

  createResponseAdapter(request: IRequestAdapter): IResponseAdapter {
    // Create a new ResponseAdapter instance
    return new CloudflareResponseAdapter();
  }

  createStorageAdapter(bindingName: string): IStorageAdapter {
    // StorageAdapter needs the specific KV binding name
    const kvBinding = this.getEnvironmentAdapter().getBinding<CloudflareKV>(bindingName);
    if (!kvBinding) {
      throw new Error(`KV Namespace binding '${bindingName}' not found in environment.`);
    }
    
    // Now the CloudflareStorageAdapter accepts CloudflareKV directly
    return new CloudflareStorageAdapter(kvBinding);
  }

  createEnvironmentAdapter(): IEnvironmentAdapter {
    return this.getEnvironmentAdapter(); // Return cached instance
  }

  createLoggerAdapter(): ILoggerAdapter {
    if (!this.loggerAdapter) {
      const envAdapter = this.getEnvironmentAdapter();
      this.loggerAdapter = new CloudflareLoggerAdapter(envAdapter);
    }
    return this.loggerAdapter;
  }

  createMetricsAdapter(): IMetricsAdapter {
    const logger = this.getLoggerAdapter();
    const environmentAdapter = this.getEnvironmentAdapter();
    
    // Get analytics engine if available
    let analyticsEngine = null;
    if (this.inputs.env && 'ANALYTICS_ENGINE' in this.inputs.env) {
      analyticsEngine = this.inputs.env.ANALYTICS_ENGINE;
    }
    
    return new CloudflareMetricsAdapter(
      logger, 
      'optimizely_edge_', 
      analyticsEngine, 
      undefined, // config - let environment variables take precedence
      environmentAdapter // pass environment adapter for env var configuration
    );
  }
} 