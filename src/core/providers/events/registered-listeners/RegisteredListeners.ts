import { EventListeners } from '../EventListeners';
import { logger } from '../../../../utils/helpers/optimizelyHelper';
import { AbstractRequest } from '../../../core/interfaces/abstractRequest';
import { AbstractResponse } from '../../../core/interfaces/abstractResponse';

// Types for event parameters
interface CdnExperimentSettings {
  // Add CDN experiment settings properties
  [key: string]: unknown;
}

interface RequestConfig {
  // Add request config properties
  [key: string]: unknown;
}

interface Decision {
  // Add decision properties
  [key: string]: unknown;
}

interface ProcessedResult {
  // Add processed result properties
  [key: string]: unknown;
}

interface OperationResult {
  // Add operation result properties
  [key: string]: unknown;
}

// Get singleton instance
const eventListeners = EventListeners.getInstance();

// Register event listeners
eventListeners.on('beforeCacheResponse', async (request: AbstractRequest, response: AbstractResponse) => {
  logger().debug('Before cache response event triggered');
  return {};
});

eventListeners.on('afterCacheResponse', async (
  request: AbstractRequest,
  response: AbstractResponse,
  cdnExperimentSettings: CdnExperimentSettings
) => {
  logger().debug('After cache response event triggered');
});

eventListeners.on('beforeResponse', async (
  request: AbstractRequest,
  response: AbstractResponse,
  cdnExperimentSettings: CdnExperimentSettings
) => {
  logger().debug('Before response event triggered');
  return {};
});

eventListeners.on('afterResponse', async (
  request: AbstractRequest,
  response: AbstractResponse,
  cdnExperimentSettings: CdnExperimentSettings
) => {
  logger().debug('After response event triggered');
  return {};
});

eventListeners.on('beforeCreateCacheKey', async (
  request: AbstractRequest,
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
  request: AbstractRequest,
  cdnExperimentSettings: CdnExperimentSettings
) => {
  logger().debug('Before request event triggered');
});

eventListeners.on('afterRequest', async (
  request: AbstractRequest,
  response: AbstractResponse,
  cdnExperimentSettings: CdnExperimentSettings
) => {
  logger().debug('After request event triggered');
  return {};
});

eventListeners.on('beforeDecide', async (
  request: AbstractRequest,
  requestConfig: RequestConfig,
  flagsToDecide: string[],
  flagsToForce: Record<string, unknown>
) => {
  // logger().debug('Before decide event triggered');
});

eventListeners.on('afterDecide', async (
  request: AbstractRequest,
  requestConfig: RequestConfig,
  decisions: Decision[]
) => {
  // logger().debug('After decide event triggered');
});

eventListeners.on('beforeDetermineFlagsToDecide', async (
  request: AbstractRequest,
  requestConfig: RequestConfig
) => {
  // logger().debug('Before determine flags to decide event triggered');
});

eventListeners.on('afterDetermineFlagsToDecide', async (
  request: AbstractRequest,
  requestConfig: RequestConfig,
  flagsToForce: Record<string, unknown>,
  flagsToDecide: string[],
  validStoredDecisions: Decision[]
) => {
  // logger().debug('After determine flags to decide event triggered');
});

eventListeners.on('beforeReadingCookie', async (
  request: AbstractRequest,
  cookieHeaderString: string
) => {
  // logger().debug('Before reading cookie event triggered');
});

eventListeners.on('afterReadingCookie', async (
  request: AbstractRequest,
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
  request: AbstractRequest,
  requestConfig: RequestConfig,
  cdnExperimentSettings: CdnExperimentSettings
) => {
  logger().debug('Before reading cache event triggered');
});

eventListeners.on('afterReadingCache', async (
  request: AbstractRequest,
  responseFromCache: AbstractResponse,
  requestConfig: RequestConfig,
  cdnExperimentSettings: CdnExperimentSettings
) => {
  logger().debug('After reading cache event triggered');
});

eventListeners.on('beforeProcessingRequest', async (
  request: AbstractRequest,
  requestConfig: RequestConfig
) => {
  // logger().debug('Before processing request event triggered');
});

eventListeners.on('afterProcessingRequest', async (
  request: AbstractRequest,
  response: AbstractResponse,
  requestConfig: RequestConfig,
  processedResult: ProcessedResult
) => {
  // logger().debug('After processing request event triggered');
});

eventListeners.on('beforeDispatchingEvents', async (
  url: string,
  events: unknown[]
) => {
  logger().debug('Before dispatching events event triggered');
});

eventListeners.on('afterDispatchingEvents', async (
  request: AbstractRequest,
  response: AbstractResponse,
  events: unknown[],
  operationResult: OperationResult
) => {
  logger().debug('After dispatching events event triggered');
});

export default eventListeners;
