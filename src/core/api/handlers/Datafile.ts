import { IRequest } from '../../../types/request';
import { ApiHandlerDependencies, ApiHandlerParams } from '../../../types/api';
import { logger } from '../../../utils/helpers/optimizelyHelper';
import defaultSettings from '../../../legacy/config/defaultSettings';

/**
 * Fetches and updates the Optimizely datafile based on the provided datafile key.
 * @param request - The incoming request object.
 * @param dependencies - The handler dependencies.
 * @param params - The route parameters.
 * @returns A promise that resolves to the response.
 */
export async function handleDatafile(
  request: IRequest,
  { abstractionHelper, kvStore, logger, defaultSettings }: ApiHandlerDependencies,
  params: ApiHandlerParams
) {
  const { sdkKey } = params;
  if (!sdkKey) {
    return abstractionHelper.createResponse({
      status: 400,
      statusText: 'Bad Request',
      body: { error: 'Missing SDK key' },
    });
  }

  try {
    const datafileKey = `${defaultSettings.datafilePrefix}${sdkKey}`;
    const datafile = await kvStore.get(datafileKey);

    if (!datafile) {
      return abstractionHelper.createResponse({
        status: 404,
        statusText: 'Not Found',
        body: { error: 'Datafile not found' },
      });
    }

    return abstractionHelper.createResponse({
      status: 200,
      statusText: 'OK',
      body: JSON.parse(datafile),
    });
  } catch (error) {
    logger.error(`Error handling datafile request: ${error}`);
    return abstractionHelper.createResponse({
      status: 500,
      statusText: 'Internal Server Error',
      body: { error: 'Internal server error' },
    });
  }
}

/**
 * Retrieves the current Optimizely SDK datafile from KV storage.
 * @param request - The incoming request object.
 * @param dependencies - The handler dependencies.
 * @param params - The route parameters.
 * @returns A promise that resolves to the response containing the datafile.
 */
export async function handleGetDatafile(
  request: IRequest,
  { abstractionHelper, kvStore, logger, defaultSettings }: ApiHandlerDependencies,
  params: ApiHandlerParams
) {
  const { sdkKey } = params;
  if (!sdkKey) {
    return abstractionHelper.createResponse({
      status: 400,
      statusText: 'Bad Request',
      body: { error: 'Missing SDK key' },
    });
  }

  try {
    const datafileKey = `${defaultSettings.datafilePrefix}${sdkKey}`;
    const datafile = await kvStore.get(datafileKey);

    if (!datafile) {
      return abstractionHelper.createResponse({
        status: 404,
        statusText: 'Not Found',
        body: { error: 'Datafile not found' },
      });
    }

    return abstractionHelper.createResponse({
      status: 200,
      statusText: 'OK',
      body: JSON.parse(datafile),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    logger.error(`Error handling get datafile request: ${error}`);
    return abstractionHelper.createResponse({
      status: 500,
      statusText: 'Internal Server Error',
      body: { error: 'Internal server error' },
    });
  }
}
