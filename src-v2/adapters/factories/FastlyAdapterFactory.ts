import { IRequestAdapter } from "../interfaces/IRequestAdapter";
import { IStorageAdapter } from "../interfaces/IStorageAdapter";
import { IEnvironmentAdapter } from "../interfaces/IEnvironmentAdapter";
import { ILoggerAdapter } from "../interfaces/ILoggerAdapter";
import { IResponseAdapter } from "../interfaces/IResponseAdapter";

import { FastlyRequestAdapter } from "../implementations/fastly/FastlyRequestAdapter";
import { FastlyStorageAdapter } from "../implementations/fastly/FastlyStorageAdapter";
import { FastlyEnvironmentAdapter, FastlyEnv, FastlyExecutionContext } from "../implementations/fastly/FastlyEnvironmentAdapter";
import { FastlyLoggerAdapter } from "../implementations/fastly/FastlyLoggerAdapter";
import { FastlyResponseAdapter } from "../implementations/fastly/FastlyResponseAdapter";
import { FastlyKVStore } from "../implementations/fastly/FastlyStorageAdapter";

// Interface defining the inputs required by the Fastly factory
export interface FastlyAdapterFactoryInputs {
  request: Request;
  env: FastlyEnv;
  ctx: FastlyExecutionContext;
}

/**
 * Factory class responsible for creating adapter instances specific to the Fastly environment.
 */
export class FastlyAdapterFactory {
  private inputs: FastlyAdapterFactoryInputs;
  private environmentAdapter: IEnvironmentAdapter | null = null; // Cache adapters
  private loggerAdapter: ILoggerAdapter | null = null;

  constructor(inputs: FastlyAdapterFactoryInputs) {
    if (!inputs || !inputs.request || !inputs.env || !inputs.ctx) {
      throw new Error("FastlyAdapterFactory requires request, env, and ctx inputs.");
    }
    this.inputs = inputs;
  }

  // Method to create or get cached EnvironmentAdapter
  private getEnvironmentAdapter(): IEnvironmentAdapter {
    if (!this.environmentAdapter) {
      this.environmentAdapter = new FastlyEnvironmentAdapter(this.inputs.env, this.inputs.ctx);
    }
    return this.environmentAdapter;
  }

  // Method to create or get cached LoggerAdapter
  private getLoggerAdapter(): ILoggerAdapter {
    if (!this.loggerAdapter) {
      // Logger depends on EnvironmentAdapter to get log level
      const envAdapter = this.getEnvironmentAdapter();
      this.loggerAdapter = new FastlyLoggerAdapter(envAdapter);
    }
    return this.loggerAdapter;
  }

  createRequestAdapter(): IRequestAdapter {
    // RequestAdapter is typically created per-request
    return new FastlyRequestAdapter(this.inputs.request);
  }

  createResponseAdapter(): IResponseAdapter {
    // Create a new ResponseAdapter instance
    return new FastlyResponseAdapter();
  }

  createStorageAdapter(bindingName: string): IStorageAdapter {
    // StorageAdapter needs the specific KV binding name
    const kvBinding = this.getEnvironmentAdapter().getBinding<FastlyKVStore>(bindingName);
    if (!kvBinding) {
      throw new Error(`KV Store binding '${bindingName}' not found in environment.`);
    }
    // Consider caching based on bindingName if appropriate
    return new FastlyStorageAdapter(kvBinding);
  }

  createEnvironmentAdapter(): IEnvironmentAdapter {
    return this.getEnvironmentAdapter(); // Return cached instance
  }

  createLoggerAdapter(): ILoggerAdapter {
    return this.getLoggerAdapter(); // Return cached instance
  }
} 