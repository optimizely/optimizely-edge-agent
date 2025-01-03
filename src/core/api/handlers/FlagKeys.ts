import { IRequest } from '../../../types/request';
import { ApiHandlerDependencies, ApiHandlerParams } from '../../../types/api';
import { logger } from '../../../utils/helpers/optimizelyHelper';
import defaultSettings from '../../../legacy/config/defaultSettings';

/**
 * Checks if the given object is a valid array.
 * @param arrayObject - The object to validate.
 * @returns True if the object is a non-empty array, false otherwise.
 */
function isValidArray(arrayObject: unknown): boolean {
  return Array.isArray(arrayObject) && arrayObject.length > 0;
}

/**
 * Trims each string in the given array.
 * @param stringArray - The array of strings to trim.
 * @returns A promise that resolves to the trimmed array.
 */
async function trimStringArray(stringArray: string[]): Promise<string[]> {
  return stringArray.map((str) => str.trim()).filter((str) => str.length > 0);
}

/**
 * Handles converting a comma-separated string of flag keys into a JSON response.
 * @param combinedString - A string with flag keys separated by commas.
 * @param dependencies - The handler dependencies.
 * @returns A Response object with JSON content.
 */
async function handleFlagKeysResponse(
  combinedString: string | null,
  { abstractionHelper, logger }: Pick<ApiHandlerDependencies, 'abstractionHelper' | 'logger'>
) {
  if (!combinedString) {
    return abstractionHelper.createResponse({
      status: 404,
      statusText: 'Not Found',
      body: { error: 'No flag keys found' },
    });
  }

  try {
    const flagKeys = await trimStringArray(combinedString.split(','));
    return abstractionHelper.createResponse({
      status: 200,
      statusText: 'OK',
      body: { flagKeys },
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    logger.error(`Error processing flag keys: ${error}`);
    return abstractionHelper.createResponse({
      status: 500,
      statusText: 'Internal Server Error',
      body: { error: 'Error processing flag keys' },
    });
  }
}

/**
 * Handles the Flag Keys API request.
 * @param request - The incoming request.
 * @param dependencies - The handler dependencies.
 * @param params - The route parameters.
 * @returns A promise that resolves to the API response.
 */
export async function handleFlagKeys(
  request: IRequest,
  { abstractionHelper, kvStore, logger, defaultSettings }: ApiHandlerDependencies,
  params: ApiHandlerParams
) {
  if (request.method !== 'POST') {
    return abstractionHelper.createResponse({
      status: 405,
      statusText: 'Method Not Allowed',
      body: { error: 'Method not allowed' },
    });
  }

  try {
    const body = request.body as { flagKeys?: string[] };
    if (!body || !isValidArray(body.flagKeys)) {
      return abstractionHelper.createResponse({
        status: 400,
        statusText: 'Bad Request',
        body: { error: 'Invalid or missing flag keys array in request body' },
      });
    }

    const trimmedFlagKeys = await trimStringArray(body.flagKeys);
    if (trimmedFlagKeys.length === 0) {
      return abstractionHelper.createResponse({
        status: 400,
        statusText: 'Bad Request',
        body: { error: 'No valid flag keys provided after trimming' },
      });
    }

    const combinedString = trimmedFlagKeys.join(',');
    await kvStore.put(defaultSettings.flagKeysPrefix, combinedString);

    return abstractionHelper.createResponse({
      status: 200,
      statusText: 'OK',
      body: { flagKeys: trimmedFlagKeys },
    });
  } catch (error) {
    logger.error(`Error handling flag keys request: ${error}`);
    return abstractionHelper.createResponse({
      status: 500,
      statusText: 'Internal Server Error',
      body: { error: 'Internal server error' },
    });
  }
}

/**
 * Retrieves flag keys stored in the KV store under the namespace 'optly_flagKeys'.
 * @param request - The incoming request.
 * @param dependencies - The handler dependencies.
 * @param params - The route parameters.
 * @returns A promise that resolves to the API response with the flag keys.
 */
export async function handleGetFlagKeys(
  request: IRequest,
  { abstractionHelper, kvStore, logger, defaultSettings }: ApiHandlerDependencies,
  params: ApiHandlerParams
) {
  if (request.method !== 'GET') {
    return abstractionHelper.createResponse({
      status: 405,
      statusText: 'Method Not Allowed',
      body: { error: 'Method not allowed' },
    });
  }

  try {
    const combinedString = await kvStore.get(defaultSettings.flagKeysPrefix);
    return handleFlagKeysResponse(combinedString, { abstractionHelper, logger });
  } catch (error) {
    logger.error(`Error handling get flag keys request: ${error}`);
    return abstractionHelper.createResponse({
      status: 500,
      statusText: 'Internal Server Error',
      body: { error: 'Internal server error' },
    });
  }
}
