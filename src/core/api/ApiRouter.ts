import { IRequest } from '../../types/request';
import { ApiHandlerDependencies, ApiRoute } from '../../types/api';
import {
  handleDatafile,
  handleGetDatafile,
  handleFlagKeys,
  handleGetFlagKeys,
  handleSdk,
  handleVariationChanges,
} from './handlers';

const routes: ApiRoute[] = [
  {
    method: 'GET',
    pattern: /^\/v1\/datafiles\/([^\/]+)$/,
    handler: handleGetDatafile,
  },
  {
    method: 'POST',
    pattern: /^\/v1\/datafiles\/([^\/]+)$/,
    handler: handleDatafile,
  },
  {
    method: 'GET',
    pattern: /^\/v1\/flag-keys$/,
    handler: handleGetFlagKeys,
  },
  {
    method: 'POST',
    pattern: /^\/v1\/flag-keys$/,
    handler: handleFlagKeys,
  },
  {
    method: 'GET',
    pattern: /^\/v1\/sdk\/([^\/]+)$/,
    handler: handleSdk,
  },
  {
    method: 'GET',
    pattern: /^\/v1\/experiments\/([^\/]+)\/variations$/,
    handler: handleVariationChanges,
  },
];

/**
 * Extract parameters from the URL based on the route pattern.
 * @param url - The request URL.
 * @param pattern - The route pattern to match against.
 * @returns The extracted parameters.
 */
function extractParams(url: string, pattern: RegExp): Record<string, string> {
  const match = url.match(pattern);
  if (!match) {
    return {};
  }

  // Extract named parameters from the URL
  if (url.includes('datafiles')) {
    return { sdkKey: match[1] };
  } else if (url.includes('sdk')) {
    return { sdk_url: match[1] };
  } else if (url.includes('experiments')) {
    return { experiment_id: match[1] };
  }

  return {};
}

/**
 * Route the incoming request to the appropriate handler.
 * @param request - The incoming request.
 * @param dependencies - The handler dependencies.
 * @returns A promise that resolves to the response.
 */
export async function route(request: IRequest, dependencies: ApiHandlerDependencies) {
  const { abstractionHelper } = dependencies;
  const url = new URL(request.url).pathname;

  // Find the matching route
  const route = routes.find(
    (r) => r.method === request.method && r.pattern.test(url)
  );

  if (!route) {
    return abstractionHelper.createResponse({
      status: 404,
      statusText: 'Not Found',
      body: { error: 'Route not found' },
    });
  }

  // Extract parameters and handle the request
  const params = extractParams(url, route.pattern);
  return route.handler(request, dependencies, params);
}
