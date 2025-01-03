import { EventListeners } from '../EventListeners';
import { logger } from '../../../../utils/helpers/optimizelyHelper';
import { IRequest } from '../../../../types/request';
import { IResponse } from '../../../../types/response';
import {
  CdnExperimentSettings,
  RequestConfig,
  Decision,
  ProcessedResult,
  OperationResult
} from '../../../../types/events';

// Get singleton instance
const eventListeners = EventListeners.getInstance();

// Register event listeners
eventListeners.on('beforeCacheResponse', async (request: IRequest, response: IResponse) => {
  logger().debug('Before cache response event triggered');
  return {};
});

eventListeners.on('afterCacheResponse', async (
  request: IRequest,
  response: IResponse,
  cdnExperimentSettings: CdnExperimentSettings
) => {
  logger().debug('After cache response event triggered');
});

eventListeners.on('beforeResponse', async (
  request: IRequest,
  response: IResponse
) => {
  logger().debug('Before response event triggered');
});

eventListeners.on('afterResponse', async (
  request: IRequest,
  response: IResponse
) => {
  logger().debug('After response event triggered');
});

eventListeners.on('beforeDecide', async (config: RequestConfig) => {
  logger().debug('Before decide event triggered');
});

eventListeners.on('afterDecide', async (
  config: RequestConfig,
  decisions: Decision[]
) => {
  logger().debug('After decide event triggered');
});

eventListeners.on('beforeProcessingRequest', async (request: IRequest) => {
  logger().debug('Before processing request event triggered');
});

eventListeners.on('afterProcessingRequest', async (
  request: IRequest,
  result: ProcessedResult
) => {
  logger().debug('After processing request event triggered');
});

eventListeners.on('beforeDispatchingEvents', async (events: Record<string, unknown>[]) => {
  logger().debug('Before dispatching events triggered');
});

eventListeners.on('afterDispatchingEvents', async (
  events: Record<string, unknown>[],
  result: OperationResult
) => {
  logger().debug('After dispatching events triggered');
});

eventListeners.on('beforeCreateCacheKey', async (
  request: IRequest,
  cdnExperimentSettings: CdnExperimentSettings
) => {
  logger().debug('Before create cache key event triggered');
  return { request, cacheKey: undefined };
});

eventListeners.on('afterCreateCacheKey', async (
  cacheKey: string,
  cdnExperimentSettings: CdnExperimentSettings
) => {
  logger().debug('After create cache key event triggered, cacheKey:', cacheKey);
});

eventListeners.on('beforeRequest', async (
  request: IRequest,
  cdnExperimentSettings: CdnExperimentSettings
) => {
  logger().debug('Before request event triggered');
});

eventListeners.on('afterRequest', async (
  request: IRequest,
  response: IResponse,
  cdnExperimentSettings: CdnExperimentSettings
) => {
  logger().debug('After request event triggered');
  return {};
});

eventListeners.on('beforeDetermineFlagsToDecide', async (
  request: IRequest,
  requestConfig: RequestConfig
) => {
  // logger().debug('Before determine flags to decide event triggered');
});

eventListeners.on('afterDetermineFlagsToDecide', async (
  request: IRequest,
  requestConfig: RequestConfig,
  flagsToForce: Record<string, unknown>,
  flagsToDecide: string[],
  validStoredDecisions: Decision[]
) => {
  // logger().debug('After determine flags to decide event triggered');
});

eventListeners.on('beforeReadingCookie', async (
  request: IRequest,
  cookieHeaderString: string
) => {
  // logger().debug('Before reading cookie event triggered');
});

eventListeners.on('afterReadingCookie', async (
  request: IRequest,
  savedCookieDecisions: Decision[],
  validStoredDecisions: Decision[],
  invalidCookieDecisions: Decision[]
) => {
  logger().debug('After reading cookie event triggered');
  logger().debug(
    'Saved cookie decisions:',
    savedCookieDecisions,
    'Valid stored decisions:',
    validStoredDecisions,
    'Invalid cookie decisions:',
    invalidCookieDecisions
  );
  return { savedCookieDecisions, validStoredDecisions, invalidCookieDecisions };
});

eventListeners.on('beforeReadingCache', async (
  request: IRequest,
  requestConfig: RequestConfig,
  cdnExperimentSettings: CdnExperimentSettings
) => {
  logger().debug('Before reading cache event triggered');
});

eventListeners.on('afterReadingCache', async (
  request: IRequest,
  responseFromCache: IResponse,
  requestConfig: RequestConfig,
  cdnExperimentSettings: CdnExperimentSettings
) => {
  logger().debug('After reading cache event triggered');
});

export default eventListeners;
