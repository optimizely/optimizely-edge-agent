import type { HttpRequest } from './http/request';
import type { HttpResponse } from './http/response';
import type { KVStore } from './cdn/store';
import type { Logger } from '../utils/logging/Logger';
import type { AbstractionHelper } from '../utils/helpers/AbstractionHelper';

export interface ApiHandlerDependencies {
  abstractionHelper: AbstractionHelper;
  kvStore: KVStore;
  logger: Logger;
  defaultSettings: Record<string, unknown>;
}

export interface ApiHandlerParams {
  sdkKey?: string;
  flagKey?: string;
  variationKey?: string;
}

export type ApiHandler = (
    request: HttpRequest,
    dependencies: ApiHandlerDependencies,
    params: ApiHandlerParams) => Promise<HttpResponse>

export interface ApiRoute {
  method: string;
  pattern: RegExp;
  handler: ApiHandler;
}

export interface ApiRouter {
  route(request: HttpRequest, dependencies: ApiHandlerDependencies): Promise<HttpResponse>;
}
