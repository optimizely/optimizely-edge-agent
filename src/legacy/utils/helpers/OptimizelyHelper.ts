import * as cookie from 'cookie';
import * as cookieDefaultOptions from './config/cookieOptions';
import defaultSettings from './config/defaultSettings';
import Logger from './logging/logger';
import { EventListeners } from '../../core/providers/events/EventListeners';
import { AbstractionHelper } from './AbstractionHelper';
import { AbstractRequest } from '../../core/interfaces/abstractRequest';
import { AbstractResponse } from '../../core/interfaces/abstractResponse';

const DELIMITER = '&';
const FLAG_VAR_DELIMITER = ':';
const KEY_VALUE_DELIMITER = ',';

type CdnProvider = 'cloudfront' | 'akamai' | 'cloudflare' | 'fastly' | 'vercel';

interface FetchOptions {
  method: string;
  headers?: Record<string, string>;
  body?: string;
}

interface CookieOptions {
  expires?: Date;
  maxAge?: number;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

interface Decision {
  flagKey: string;
  enabled: boolean;
  variables?: Record<string, unknown>;
  variation?: string;
  reasons?: string[];
  userContext?: Record<string, unknown>;
}

/**
 * Returns the logger instance.
 */
export function logger(): Logger {
  return Logger.getInstance();
}

/**
 * Simulate a fetch operation using a hypothetical httpRequest function for Akamai.
 */
async function akamaiFetch(url: string, options: FetchOptions): Promise<unknown> {
  try {
    const response = await httpRequest(url, options);
    if (options.method === 'GET') {
      return JSON.parse(response as string);
    }
    return response;
  } catch (error) {
    logger().error('Request failed:', error);
    throw error;
  }
}

/**
 * Fetch data from a specified URL using the HTTPS module tailored for AWS CloudFront.
 */
function cloudfrontFetch(url: string, options: FetchOptions): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk: string) => (data += chunk));
      res.on('end', () => {
        if (res.headers['content-type']?.includes('application/json') && options.method === 'GET') {
          resolve(JSON.parse(data));
        } else {
          resolve(data);
        }
      });
    });

    req.on('error', (error: Error) => reject(error));
    if (options.method === 'POST' && options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

/**
 * Generic fetch method that delegates to specific fetch implementations based on the CDN provider.
 */
export async function fetchByRequestObject(request: Request): Promise<Response> {
  const options: FetchOptions = {
    method: request.method,
    headers: Object.fromEntries(request.headers),
  };

  switch (defaultSettings.cdnProvider as CdnProvider) {
    case 'cloudfront':
      return await cloudfrontFetch(request.url, options) as Response;
    case 'akamai':
      return await akamaiFetch(request.url, options) as Response;
    case 'cloudflare':
    case 'fastly':
    case 'vercel':
      try {
        const response = await fetch(request);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: AbstractionHelper.getNewHeaders(response),
        });
      } catch (error) {
        logger().error('Request failed:', error);
        throw error;
      }
    default:
      throw new Error('Unsupported CDN provider');
  }
}

/**
 * Generic fetch method that delegates to specific fetch implementations based on the CDN provider.
 */
export async function fetchByUrl(url: string, options: FetchOptions): Promise<unknown> {
  switch (defaultSettings.cdnProvider as CdnProvider) {
    case 'cloudfront':
      return await cloudfrontFetch(url, options);
    case 'akamai':
      return await akamaiFetch(url, options);
    case 'cloudflare':
    case 'fastly':
      try {
        const response = await fetch(url, options);
        if (options.method === 'GET') {
          const contentType = response.headers.get('Content-Type') || '';
          if (contentType.includes('application/json')) {
            return await response.json();
          } else if (contentType.includes('text/html')) {
            return await response.text();
          } else if (contentType.includes('application/octet-stream')) {
            return await response.arrayBuffer();
          }
          return await response.text();
        }
        return response;
      } catch (error) {
        logger().error('Request failed:', error);
        throw error;
      }
    default:
      throw new Error('Unsupported CDN provider');
  }
}

/**
 * Checks if the given request path matches any of the defined Rest API routes.
 */
export function routeMatches(requestPath: string): boolean {
  const routes = [
    '/v1/api/datafiles/:key',
    '/v1/api/flag_keys',
    '/v1/api/sdk/:sdk_url',
    '/v1/api/variation_changes/:experiment_id/:api_token',
  ];

  const matchesRoute = (route: string): boolean => {
    const regex = new RegExp('^' + route.replace(/:\w+/g, '([^/]+)') + '$');
    return regex.test(requestPath);
  };

  return routes.some(matchesRoute);
}

/**
 * Checks if the given URL path is a valid experimentation endpoint.
 */
export function isValidExperimentationEndpoint(url: string, validEndpoints: string[]): boolean {
  const urlWithoutQuery = url.split('?')[0];
  const normalizedUrl = urlWithoutQuery.replace(/\/$/, '');
  return validEndpoints.includes(normalizedUrl);
}

/**
 * Retrieves the response JSON key name based on the URL path.
 */
export function getResponseJsonKeyName(urlPath: string): string {
  const pathParts = urlPath.split('/').filter(Boolean);
  return pathParts[pathParts.length - 1];
}

/**
 * Clones a response object.
 */
export async function cloneResponseObject(responseObject: Response): Promise<Response> {
  return new Response(responseObject.body, {
    status: responseObject.status,
    statusText: responseObject.statusText,
    headers: new Headers(responseObject.headers),
  });
}

/**
 * Checks if an array is valid (non-empty and contains elements).
 */
export function arrayIsValid(array: unknown[]): boolean {
  return Array.isArray(array) && array.length > 0;
}

/**
 * Checks if a JSON string represents a valid object.
 */
export function jsonObjectIsValid(json: string): boolean {
  try {
    const obj = JSON.parse(json);
    return typeof obj === 'object' && obj !== null && !Array.isArray(obj);
  } catch {
    return false;
  }
}

/**
 * Generates a UUID.
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Converts days to seconds.
 */
export function getDaysInSeconds(days: number): number {
  return days * 24 * 60 * 60;
}

/**
 * Parses a cookie header string into an object.
 */
export function parseCookies(cookieHeader: string): Record<string, string> {
  if (typeof cookieHeader !== 'string') {
    throw new TypeError('Cookie header must be a string');
  }
  return cookie.parse(cookieHeader);
}

/**
 * Retrieves the value of a cookie by name.
 */
export function getCookieValueByName(cookies: string, name: string): string | undefined {
  const parsedCookies = parseCookies(cookies);
  return parsedCookies[name];
}

/**
 * Creates a cookie string with the specified name, value, and options.
 */
export function createCookie(name: string, value: string, options: CookieOptions = {}): string {
  const mergedOptions = { ...cookieDefaultOptions, ...options };
  return cookie.serialize(name, value, mergedOptions);
}

/**
 * Splits a string by a delimiter and trims each element.
 */
export function splitAndTrimArray(input: string): string[] {
  return input.split(DELIMITER).map((item) => item.trim());
}

/**
 * Trims each string element in an array.
 */
export function trimStringArray(array: string[]): string[] {
  return array.map((item) => item.trim());
}

/**
 * Serializes a subset of decision objects based on provided criteria.
 */
export function getSerializedArray(
  decisionsArray: Decision[],
  excludeVariables: boolean,
  includeReasons: boolean,
  enabledFlagsOnly: boolean,
  trimmedDecisions: boolean,
  httpMethod: string
): Decision[] {
  if (!Array.isArray(decisionsArray)) {
    return [];
  }

  return decisionsArray
    .filter((decision) => !enabledFlagsOnly || decision.enabled)
    .map((decision) => {
      const serializedDecision: Decision = {
        flagKey: decision.flagKey,
        enabled: decision.enabled,
      };

      if (!excludeVariables && decision.variables) {
        serializedDecision.variables = decision.variables;
      }

      if (decision.variation) {
        serializedDecision.variation = decision.variation;
      }

      if (includeReasons && decision.reasons) {
        serializedDecision.reasons = decision.reasons;
      }

      if (!trimmedDecisions && decision.userContext) {
        serializedDecision.userContext = decision.userContext;
      }

      return serializedDecision;
    });
}

/**
 * Retrieves the flag keys to decide based on stored decisions and active flags.
 */
export function getFlagsToDecide(storedDecisions: Decision[], activeFlags: string[]): string[] {
  return activeFlags.filter(
    (flagKey) => !storedDecisions.some((decision) => decision.flagKey === flagKey)
  );
}

/**
 * Retrieves the invalid decisions based on active flags.
 */
export function getInvalidCookieDecisions(decisions: Decision[], activeFlags: string[]): Decision[] {
  return decisions.filter((decision) => !activeFlags.includes(decision.flagKey));
}

/**
 * Retrieves the valid stored decisions based on active flags.
 */
export function getValidCookieDecisions(decisions: Decision[], activeFlags: string[]): Decision[] {
  return decisions.filter((decision) => activeFlags.includes(decision.flagKey));
}

/**
 * Serializes an array of decision objects into a string.
 */
export function serializeDecisions(decisions: Decision[]): string | undefined {
  if (!Array.isArray(decisions) || decisions.length === 0) {
    return undefined;
  }
  return JSON.stringify(decisions);
}

/**
 * Deserializes a string into an array of decision objects.
 */
export function deserializeDecisions(input: string): Decision[] {
  if (!input) {
    return [];
  }

  try {
    const parsed = JSON.parse(input);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is Decision =>
      typeof item === 'object' &&
      item !== null &&
      typeof item.flagKey === 'string' &&
      typeof item.enabled === 'boolean'
    );
  } catch {
    return [];
  }
}

/**
 * Safely stringifies an object into a JSON string.
 */
export function safelyStringifyJSON(data: unknown): string {
  try {
    return JSON.stringify(data);
  } catch (error) {
    logger().error('Error stringifying JSON:', error);
    return '';
  }
}

/**
 * Safely parses a JSON string into an object.
 */
export function safelyParseJSON(jsonString: string): unknown {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    logger().error('Error parsing JSON:', error);
    return null;
  }
}

/**
 * Checks if a string represents a valid JSON object.
 */
export function isValidJsonObject(obj: string): boolean {
  if (typeof obj !== 'string') {
    throw new TypeError('Input must be a string');
  }

  try {
    const parsed = JSON.parse(obj);
    return (
      typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed) &&
      Object.keys(parsed).length > 0
    );
  } catch {
    return false;
  }
}

/**
 * Checks if the given parameter is a valid non-empty JavaScript object.
 */
export function isValidObject(obj: unknown, returnEmptyObject = false): boolean {
  try {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
      return false;
    }

    if (returnEmptyObject) {
      return true;
    }

    return Object.keys(obj as Record<string, unknown>).length > 0;
  } catch (error) {
    logger().error('Error validating object:', error);
    return false;
  }
}
