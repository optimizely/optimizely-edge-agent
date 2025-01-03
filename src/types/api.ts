import { IRequest, IResponse } from './request';
import { IKVStore } from './cdn';
import { Logger } from '../utils/logging/Logger';
import { AbstractionHelper } from '../utils/helpers/AbstractionHelper';

export interface ApiHandlerDependencies {
  abstractionHelper: AbstractionHelper;
  kvStore: IKVStore;
  logger: Logger;
  defaultSettings: Record<string, unknown>;
}

export interface ApiHandlerParams {
  sdkKey?: string;
  flagKey?: string;
  variationKey?: string;
}

export interface ApiHandler {
  (
    request: IRequest,
    dependencies: ApiHandlerDependencies,
    params: ApiHandlerParams
  ): Promise<IResponse>;
}

export interface ApiRoute {
  method: string;
  pattern: RegExp;
  handler: ApiHandler;
}

export interface ApiRouter {
  route(request: IRequest, dependencies: ApiHandlerDependencies): Promise<IResponse>;
}
