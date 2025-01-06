import type { OptimizelyProvider } from '../../core/providers/OptimizelyProvider';
import type { AbstractionHelper } from '../../utils/helpers/AbstractionHelper';
import type { KVStore } from '../cdn/store';
import type { Logger } from '../../utils/logging/Logger';

type CoreLogicDependencies = {
  optimizelyProvider: OptimizelyProvider;
  env: Record<string, unknown>;
  ctx: {
    waitUntil: (promise: Promise<unknown>) => void;
    passThroughOnException: () => void;
  };
  waitUntil: (promise: Promise<unknown>) => void;
  passThroughOnException: () => void;
  sdkKey: string;
  abstractionHelper: AbstractionHelper;
  kvStore?: KVStore;
  kvStoreUserProfile?: KVStore;
  logger: Logger;
}

export type { CoreLogicDependencies };
