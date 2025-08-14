import type { IRequestAdapter } from '../../adapters/interfaces/IRequestAdapter';
import type { UserAttributes } from '@optimizely/optimizely-sdk/dist/optimizely.lite.es';
import type { ILoggerAdapter } from '../../adapters/interfaces/ILoggerAdapter';

export interface ExtractAttributesResult {
  attributes: UserAttributes;
  errorCount: number;
  errors: string[];
}

/**
 * Extracts attributes from the request, tracking errors encountered.
 * @param requestAdapter - The request adapter.
 * @param logger - Optional logger for warnings/debugging.
 * @returns A promise resolving to an object with attributes, errorCount, and errors.
 */
export async function extractAttributes(
  requestAdapter: IRequestAdapter,
  logger?: ILoggerAdapter
): Promise<ExtractAttributesResult> {
  const attributes: Record<string, any> = {};
  let errorCount = 0;
  const errors: string[] = [];

  // Extract attributes from headers
  const userAttributesHeader = requestAdapter.getHeader('x-user-attributes');
  if (userAttributesHeader) {
    try {
      const headerAttributes = JSON.parse(userAttributesHeader);
      Object.assign(attributes, headerAttributes);
    } catch (error) {
      errorCount++;
      const msg = 'Failed to parse x-user-attributes header as JSON';
      errors.push(msg);
      logger?.warn?.(msg, error);
    }
  }

  // Extract attributes from query parameters
  const url = requestAdapter.getUrl();
  const attributesParam = url.searchParams.get('attributes');
  if (attributesParam) {
    try {
      const queryAttributes = JSON.parse(attributesParam);
      mergeAttributes(attributes, queryAttributes, logger);
    } catch (error) {
      errorCount++;
      const msg = 'Failed to parse attributes query parameter as JSON';
      errors.push(msg);
      logger?.warn?.(msg, error);
    }
  }

  // For POST requests, extract attributes from body
  if (requestAdapter.getMethod() === 'POST') {
    try {
      const body = await requestAdapter.getBodyJson<{ attributes?: Record<string, unknown> }>();
      if (body.attributes) {
        mergeAttributes(attributes, body.attributes, logger);
      }
    } catch (error) {
      errorCount++;
      const msg = 'No valid JSON body or no attributes in body';
      errors.push(msg);
      logger?.debug?.(msg, error);
    }
  }

  return { attributes, errorCount, errors };
}

function mergeAttributes(
  target: Record<string, any>,
  source: Record<string, any>,
  logger?: ILoggerAdapter
): void {
  if (!source || typeof source !== 'object') {
    return;
  }

  for (const [key, value] of Object.entries(source)) {
    if (Array.isArray(value)) {
      if (Array.isArray(target[key])) {
        target[key] = [...target[key], ...value];
      } else if (target[key] === undefined) {
        target[key] = [...value];
      } else {
        target[key] = [target[key], ...value];
      }
    } else if (value !== null && typeof value === 'object') {
      if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) {
        target[key] = {};
      }
      mergeAttributes(target[key], value, logger);
    } else {
      if (target[key] === undefined) {
        target[key] = value;
      }
    }
  }
} 