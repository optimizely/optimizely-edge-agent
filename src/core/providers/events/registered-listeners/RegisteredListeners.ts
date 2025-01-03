import { EventListeners } from '../EventListeners';
import { Logger } from '../../../../utils/logging/Logger';
import { IRequest } from '../../../../types/request';
import { IResponse } from '../../../../types/response';
import {
  CdnExperimentSettings,
  RequestConfig,
  Decision,
  ProcessedResult,
  OperationResult,
  EventListener
} from '../../../../types/events';

// Get singleton instances
const eventListeners = EventListeners.getInstance();
const logger = Logger.getInstance({});

// Register event listeners
eventListeners.on('beforeCacheResponse', async (request: IRequest, response: IResponse) => {
  logger.debug('Before cache response event triggered');
  return {};
});

eventListeners.on('afterCacheResponse', async (
  request: IRequest,
  response: IResponse,
  cdnExperimentSettings: CdnExperimentSettings
) => {
  logger.debug('After cache response event triggered');
  return {};
});

eventListeners.on('beforeResponse', async (
  request: IRequest,
  response: IResponse
) => {
  logger.debug('Before response event triggered');
});

eventListeners.on('afterResponse', async (
  request: IRequest,
  response: IResponse
) => {
  logger.debug('After response event triggered');
});

eventListeners.on('beforeDecide', async (config: RequestConfig) => {
  logger.debug('Before decide event triggered');
});

eventListeners.on('afterDecide', async (
  config: RequestConfig,
  decisions: Decision[]
) => {
  logger.debug('After decide event triggered');
});

eventListeners.on('beforeCreateCacheKey', async (request: IRequest) => {
  logger.debug('Before create cache key event triggered');
  return { request, cacheKey: undefined };
});

eventListeners.on('afterCreateCacheKey', async (request: IRequest, cacheKey: string) => {
  logger.debug('After create cache key event triggered');
});

eventListeners.on('beforeRequest', async (request: IRequest) => {
  logger.debug('Before request event triggered');
});

eventListeners.on('afterRequest', async (
  request: IRequest,
  response: IResponse
) => {
  logger.debug('After request event triggered');
  return {};
});

eventListeners.on('beforeDetermineFlagsToDecide', async (flagKeys: string[]) => {
  logger.debug('Before determine flags to decide event triggered');
});

eventListeners.on('afterDetermineFlagsToDecide', async (
  requestedFlags: string[],
  decidedFlags: string[]
) => {
  logger.debug('After determine flags to decide event triggered');
});

eventListeners.on('afterReadingCookie', async (
  request: IRequest,
  cookieName: string,
  cookieValue: string | null
) => {
  logger.debug('After reading cookie event triggered');
  return {
    savedCookieDecisions: [],
    validStoredDecisions: [],
    invalidCookieDecisions: []
  };
});

eventListeners.on('beforeReadingCache', async (cacheKey: string) => {
  logger.debug('Before reading cache event triggered');
});

eventListeners.on('afterReadingCache', async (
  cacheKey: string,
  cacheValue: unknown
) => {
  logger.debug('After reading cache event triggered');
});

eventListeners.on('beforeProcessingRequest', async (request: IRequest) => {
  logger.debug('Before processing request event triggered');
});

eventListeners.on('afterProcessingRequest', async (
  request: IRequest,
  result: ProcessedResult
) => {
  logger.debug('After processing request event triggered');
});

eventListeners.on('beforeDispatchingEvents', async (events: Record<string, unknown>[]) => {
  logger.debug('Before dispatching events triggered');
});

eventListeners.on('afterDispatchingEvents', async (
  events: Record<string, unknown>[],
  result: OperationResult
) => {
  logger.debug('After dispatching events triggered');
});

eventListeners.on('beforeReadingCache', async (request: IRequest, requestConfig: RequestConfig, cdnExperimentSettings: CdnExperimentSettings) => {
  logger.debug('Before reading cache event triggered');
});

eventListeners.on('afterReadingCache', async (
  request: IRequest,
  responseFromCache: IResponse,
  requestConfig: RequestConfig,
  cdnExperimentSettings: CdnExperimentSettings
) => {
  logger.debug('After reading cache event triggered');
});

export default eventListeners;
