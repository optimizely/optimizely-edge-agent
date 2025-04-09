import { IRequestAdapter } from "../interfaces/IRequestAdapter";
import { IStorageAdapter } from "../interfaces/IStorageAdapter";
import { IEnvironmentAdapter } from "../interfaces/IEnvironmentAdapter";
import { ILoggerAdapter } from "../interfaces/ILoggerAdapter";
import { IResponseAdapter } from "../interfaces/IResponseAdapter";

import { VercelRequestAdapter } from "../implementations/vercel/VercelRequestAdapter";
import { VercelStorageAdapter } from "../implementations/vercel/VercelStorageAdapter";
import { VercelEnvironmentAdapter, VercelEnv, VercelExecutionContext } from "../implementations/vercel/VercelEnvironmentAdapter";
import { VercelLoggerAdapter } from "../implementations/vercel/VercelLoggerAdapter";
import { VercelResponseAdapter } from "../implementations/vercel/VercelResponseAdapter";
import { VercelKVNamespace } from "../implementations/vercel/VercelStorageAdapter";

// Interface defining the inputs required by the Vercel factory
export interface VercelAdapterFactoryInputs {
  request: Request;
  env: VercelEnv;
  ctx: VercelExecutionContext;
}

/**
 * Factory class responsible for creating adapter instances specific to the Vercel environment.
 */
export class VercelAdapterFactory {
  private inputs: VercelAdapterFactoryInputs;
  private environmentAdapter: IEnvironmentAdapter | null = null; // Cache adapters
  private loggerAdapter: ILoggerAdapter | null = null;

  constructor(inputs: VercelAdapterFactoryInputs) {
    if (!inputs || !inputs.request || !inputs.env || !inputs.ctx) {
      throw new Error("VercelAdapterFactory requires request, env, and ctx inputs.");
    }
    this.inputs = inputs;
  }

  // Method to create or get cached EnvironmentAdapter
  private getEnvironmentAdapter(): IEnvironmentAdapter {
    if (!this.environmentAdapter) {
      this.environmentAdapter = new VercelEnvironmentAdapter(this.inputs.env, this.inputs.ctx);
    }
    return this.environmentAdapter;
  }

  // Method to create or get cached LoggerAdapter
  private getLoggerAdapter(): ILoggerAdapter {
    if (!this.loggerAdapter) {
      // Logger depends on EnvironmentAdapter to get log level
      const envAdapter = this.getEnvironmentAdapter();
      this.loggerAdapter = new VercelLoggerAdapter(envAdapter);
    }
    return this.loggerAdapter;
  }

  createRequestAdapter(): IRequestAdapter {
    // RequestAdapter is typically created per-request
    return new VercelRequestAdapter(this.inputs.request);
  }

  createResponseAdapter(): IResponseAdapter {
    // Create a new ResponseAdapter instance
    return new VercelResponseAdapter();
  }

  createStorageAdapter(bindingName: string): IStorageAdapter {
    // StorageAdapter needs the specific KV binding name
    const kvBinding = this.getEnvironmentAdapter().getBinding<VercelKVNamespace>(bindingName);
    if (!kvBinding) {
      throw new Error(`KV Namespace binding '${bindingName}' not found in environment.`);
    }
    // Consider caching based on bindingName if appropriate
    return new VercelStorageAdapter(kvBinding);
  }

  createEnvironmentAdapter(): IEnvironmentAdapter {
    return this.getEnvironmentAdapter(); // Return cached instance
  }

  createLoggerAdapter(): ILoggerAdapter {
    return this.getLoggerAdapter(); // Return cached instance
  }
} 