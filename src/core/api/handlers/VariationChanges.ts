import { IRequest } from '../../../types/request';
import { ApiHandlerDependencies, ApiHandlerParams } from '../../../types/api';
import { logger } from '../../../utils/helpers/optimizelyHelper';
import defaultSettings from '../../../legacy/config/defaultSettings';

interface VariationChangesParams extends ApiHandlerParams {
  experiment_id?: string;
  api_token?: string;
}

interface OptimizelyApiResponse {
  id: string;
  variations: Array<{
    id: string;
    key: string;
    status: string;
  }>;
}

/**
 * Processes the response from the Optimizely API.
 * @param response - The response object from the API.
 * @returns A promise that resolves to the processed response data.
 */
async function processApiResponse(response: Response): Promise<OptimizelyApiResponse> {
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetches and updates the variation changes from the Optimizely API.
 * @param request - The incoming request object.
 * @param dependencies - The handler dependencies.
 * @param params - The route parameters including experiment ID and API token.
 * @returns A promise that resolves to the response object.
 */
export async function handleVariationChanges(
  request: IRequest,
  { abstractionHelper, logger }: ApiHandlerDependencies,
  params: VariationChangesParams
) {
  const { experiment_id: experimentId, api_token: bearerToken } = params;

  if (!experimentId || !bearerToken) {
    return abstractionHelper.createResponse({
      status: 400,
      statusText: 'Bad Request',
      body: { error: 'Missing experiment ID or API token' },
    });
  }

  const baseUrl = 'https://api.optimizely.com/v2/experiments/';
  const apiUrl = baseUrl + experimentId;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await processApiResponse(response);
    return abstractionHelper.createResponse({
      status: 200,
      statusText: 'OK',
      body: data,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    logger.error(`Error handling variation changes request: ${error}`);
    return abstractionHelper.createResponse({
      status: 500,
      statusText: 'Internal Server Error',
      body: { error: 'Internal server error' },
    });
  }
}
