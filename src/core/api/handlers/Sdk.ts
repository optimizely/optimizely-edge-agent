import { IRequest } from '../../../types/request';
import { ApiHandlerDependencies, ApiHandlerParams } from '../../../types/api';
import { logger } from '../../../utils/helpers/optimizelyHelper';
import defaultSettings from '../../../legacy/config/defaultSettings';

interface SdkParams extends ApiHandlerParams {
  sdk_url?: string;
}

/**
 * Processes the response from the SDK URL.
 * @param response - The response object from the SDK URL.
 * @returns A promise that resolves to the stringified JSON or text content.
 */
async function processResponse(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    const json = await response.json();
    return JSON.stringify(json);
  }
  return response.text();
}

/**
 * Fetches and updates the Optimizely JavaScript SDK based on the provided URL.
 * @param request - The incoming request object.
 * @param dependencies - The handler dependencies.
 * @param params - The route parameters including the SDK URL.
 * @returns A promise that resolves to the response object.
 */
export async function handleSdk(
  request: IRequest,
  { abstractionHelper, logger }: ApiHandlerDependencies,
  params: SdkParams
) {
  if (!params.sdk_url) {
    return abstractionHelper.createResponse({
      status: 400,
      statusText: 'Bad Request',
      body: { error: 'Missing SDK URL parameter' },
    });
  }

  const sdkUrl = decodeURIComponent(params.sdk_url);

  try {
    const response = await fetch(sdkUrl);
    if (!response.ok) {
      logger.error(`Error fetching SDK from ${sdkUrl}: ${response.status} ${response.statusText}`);
      return abstractionHelper.createResponse({
        status: response.status,
        statusText: response.statusText,
        body: { error: `Failed to fetch SDK from ${sdkUrl}` },
      });
    }

    const content = await processResponse(response);
    return abstractionHelper.createResponse({
      status: 200,
      statusText: 'OK',
      body: content,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/javascript',
      },
    });
  } catch (error) {
    logger.error(`Error handling SDK request: ${error}`);
    return abstractionHelper.createResponse({
      status: 500,
      statusText: 'Internal Server Error',
      body: { error: 'Internal server error' },
    });
  }
}
