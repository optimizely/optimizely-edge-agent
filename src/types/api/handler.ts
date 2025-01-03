import { HttpRequest, HttpResponse } from '../http';
import { KVStore } from '../cdn';
import { Logger } from '../../utils/logging/Logger';
import { AbstractionHelper } from '../../utils/helpers/AbstractionHelper';

type ApiHandlerDependencies = {
  abstractionHelper: AbstractionHelper;
  kvStore: KVStore;
  logger: Logger;
  defaultSettings: Record<string, unknown>;
}

type ApiHandlerParams = {
  sdkKey?: string;
  flagKey?: string;
  variationKey?: string;
  experiment_id?: string;
  api_token?: string;
  sdk_url?: string;
}

type ApiHandler = (
  request: HttpRequest,
  dependencies: ApiHandlerDependencies,
  params: ApiHandlerParams
) => Promise<HttpResponse>;

type ApiRoute = {
  method: string;
  pattern: RegExp;
  handler: ApiHandler;
}

type ApiRouter = {
  route(request: HttpRequest, dependencies: ApiHandlerDependencies): Promise<HttpResponse>;
}

export type {
  ApiHandlerDependencies,
  ApiHandlerParams,
  ApiHandler,
  ApiRoute,
  ApiRouter
};
