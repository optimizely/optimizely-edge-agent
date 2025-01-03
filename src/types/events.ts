import { IRequest } from './request';
import { IResponse } from './response';

export interface CdnExperimentSettings {
  ttl: number;
  maxSize: number;
  flushInterval: number;
  enabled: boolean;
}

export interface RequestConfig {
  sdkKey: string;
  flagKeys: string[];
  userId: string;
  userAttributes?: Record<string, unknown>;
  forcedDecisions?: Record<string, unknown>;
}

export interface Decision {
  flagKey: string;
  enabled: boolean;
  variables: Record<string, unknown>;
  ruleKey?: string;
  variationKey?: string;
  reasons?: string[];
}

export interface ProcessedResult {
  decisions: Decision[];
  userContext: {
    id: string;
    attributes: Record<string, unknown>;
  };
}

export interface OperationResult {
  success: boolean;
  error?: Error;
  data?: unknown;
}

export type EventListener<T extends unknown[] = unknown[]> = 
  (...args: T) => Promise<Record<string, unknown> | void> | Record<string, unknown> | void;

export type EventType =
  | 'beforeResponse'
  | 'afterResponse'
  | 'beforeCreateCacheKey'
  | 'afterCreateCacheKey'
  | 'beforeCacheResponse'
  | 'afterCacheResponse'
  | 'beforeRequest'
  | 'afterRequest'
  | 'beforeDecide'
  | 'afterDecide'
  | 'beforeDetermineFlagsToDecide'
  | 'afterDetermineFlagsToDecide'
  | 'beforeReadingCookie'
  | 'afterReadingCookie'
  | 'beforeReadingCache'
  | 'afterReadingCache'
  | 'beforeProcessingRequest'
  | 'afterProcessingRequest'
  | 'beforeReadingRequestConfig'
  | 'afterReadingRequestConfig'
  | 'beforeDispatchingEvents'
  | 'afterDispatchingEvents';

export interface EventListenerParameters {
  beforeResponse: [IRequest, IResponse];
  afterResponse: [IRequest, IResponse];
  beforeCreateCacheKey: [IRequest];
  afterCreateCacheKey: [IRequest, string];
  beforeCacheResponse: [IRequest, IResponse];
  afterCacheResponse: [IRequest, IResponse, CdnExperimentSettings];
  beforeRequest: [IRequest];
  afterRequest: [IRequest, IResponse];
  beforeDecide: [RequestConfig];
  afterDecide: [RequestConfig, Decision[]];
  beforeDetermineFlagsToDecide: [string[]];
  afterDetermineFlagsToDecide: [string[], string[]];
  beforeReadingCookie: [IRequest, string];
  afterReadingCookie: [IRequest, string, string | null];
  beforeReadingCache: [string];
  afterReadingCache: [string, unknown];
  beforeProcessingRequest: [IRequest];
  afterProcessingRequest: [IRequest, ProcessedResult];
  beforeReadingRequestConfig: [IRequest];
  afterReadingRequestConfig: [IRequest, RequestConfig];
  beforeDispatchingEvents: [Record<string, unknown>[]];
  afterDispatchingEvents: [Record<string, unknown>[], OperationResult];
}
