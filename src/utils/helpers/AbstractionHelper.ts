import { logger } from './OptimizelyHelper';
import { EventListeners } from '../../core/providers/events/EventListeners';
import defaultSettings from '../../config/defaultSettings';
import { AbstractContext } from '../../core/interfaces/abstractContext';
import { AbstractRequest } from '../../core/interfaces/abstractRequest';
import { AbstractResponse } from '../../core/interfaces/abstractResponse';
import { KVStoreAbstractInterface } from '../../core/interfaces/kvStoreAbstractInterface';

type CdnProvider = 'cloudflare' | 'cloudfront' | 'akamai' | 'vercel' | 'fastly';

interface HeadersObject {
  [key: string]: string | { key: string; value: string }[];
}

interface CloudfrontHeader {
  key: string;
  value: string;
}

interface ResponseLike {
  headers: Headers | HeadersObject;
  body?: BodyInit | null;
  getBody?(): Promise<BodyInit>;
  json?(): Promise<unknown>;
  text?(): Promise<string>;
}

interface KVInterfaceAdapter {
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * Class representing an abstraction helper.
 * Provides helper functions for working with CDN implementations.
 */
export class AbstractionHelper {
  private readonly abstractRequest: AbstractRequest;
  private readonly request: Request;
  private readonly abstractResponse: AbstractResponse;
  private readonly ctx: AbstractContext;
  private readonly env: Record<string, unknown>;
  private kvStore?: KVStoreAbstractInterface;

  /**
   * Constructor for AbstractionHelper.
   */
  constructor(request: Request, ctx: unknown, env: Record<string, unknown>) {
    logger().debug('Inside AbstractionHelper constructor [constructor]');

    this.abstractRequest = new AbstractRequest(request);
    this.request = this.abstractRequest.request;
    this.abstractResponse = new AbstractResponse();
    this.ctx = new AbstractContext(ctx);
    this.env = env;
  }

  /**
   * Returns new headers based on the provided headers and the CDN provider.
   */
  static getNewHeaders(existingHeaders: Headers | HeadersObject): Headers | HeadersObject {
    logger().debugExt(
      'AbstractionHelper - Getting new headers [getNewHeaders]',
      'Existing headers:',
      existingHeaders
    );

    const cdnProvider = defaultSettings.cdnProvider.toLowerCase() as CdnProvider;

    switch (cdnProvider) {
      case 'cloudflare':
      case 'fastly':
      case 'vercel':
        return new Headers(existingHeaders as Headers);

      case 'akamai': {
        const newHeadersAkamai: HeadersObject = {};
        for (const [key, value] of Object.entries(existingHeaders)) {
          newHeadersAkamai[key] = value as string;
        }
        return newHeadersAkamai;
      }

      case 'cloudfront': {
        const newHeadersCloudfront: HeadersObject = {};
        for (const [key, value] of Object.entries(existingHeaders)) {
          newHeadersCloudfront[key.toLowerCase()] = [{ key, value: value as string }];
        }
        return newHeadersCloudfront;
      }

      default:
        throw new Error(`Unsupported CDN provider: ${cdnProvider}`);
    }
  }

  /**
   * Returns new headers based on the provided headers and the CDN provider.
   */
  getNewHeaders(existingHeaders: Headers | HeadersObject): Headers | HeadersObject {
    return AbstractionHelper.getNewHeaders(existingHeaders);
  }

  /**
   * Creates a new response object.
   */
  createResponse(
    body: unknown,
    status = 200,
    headers: HeadersObject = { 'Content-Type': 'application/json' }
  ): Response {
    logger().debug('AbstractionHelper - Creating response [createResponse]');
    return this.abstractResponse.createResponse(body, status, headers);
  }

  /**
   * Retrieves the value of a specific header from the response based on the CDN provider.
   */
  static getHeaderValue(response: ResponseLike, headerName: string): string | null {
    logger().debugExt(
      'AbstractionHelper - Getting header value [getHeaderValue]',
      'Header name:',
      headerName
    );

    const cdnProvider = defaultSettings.cdnProvider as CdnProvider;
    try {
      if (!response || typeof response !== 'object') {
        throw new Error('Invalid response object provided.');
      }

      switch (cdnProvider) {
        case 'cloudflare':
        case 'akamai':
        case 'vercel':
        case 'fastly':
          return (response.headers as Headers).get(headerName) || null;

        case 'cloudfront': {
          const headers = response.headers as HeadersObject;
          const headerValue = headers[headerName.toLowerCase()] as CloudfrontHeader[];
          return headerValue ? headerValue[0].value : null;
        }

        default:
          throw new Error('Unsupported CDN provider.');
      }
    } catch (error) {
      logger().error('Error retrieving header value:', error);
      throw error;
    }
  }

  /**
   * Retrieves the value of a specific header from the response based on the CDN provider.
   */
  getHeaderValue(response: ResponseLike, headerName: string): string | null {
    return AbstractionHelper.getHeaderValue(response, headerName);
  }

  /**
   * Retrieves the response content as stringified JSON or text based on the CDN provider.
   */
  async getResponseContent(response: ResponseLike): Promise<string> {
    logger().debugExt('AbstractionHelper - Getting response content [getResponseContent]');

    try {
      if (!response || typeof response !== 'object') {
        throw new Error('Invalid response object provided.');
      }

      const cdnProvider = defaultSettings.cdnProvider as CdnProvider;
      const contentType = this.getHeaderValue(response, 'Content-Type');
      const isJson = contentType && contentType.includes('application/json');

      switch (cdnProvider) {
        case 'cloudflare':
        case 'vercel':
        case 'fastly': {
          if (isJson && response.json) {
            const json = await response.json();
            return JSON.stringify(json);
          } else if (response.text) {
            return await response.text();
          }
          throw new Error('Response methods not available');
        }

        case 'cloudfront': {
          if (isJson && response.body) {
            const json = JSON.parse(response.body as string);
            return JSON.stringify(json);
          }
          return response.body as string;
        }

        case 'akamai': {
          if (response.getBody) {
            const body = await response.getBody();
            if (isJson) {
              const json = await new Response(body).json();
              return JSON.stringify(json);
            }
            return await new Response(body).text();
          }
          throw new Error('getBody method not available');
        }

        default:
          throw new Error('Unsupported CDN provider.');
      }
    } catch (error) {
      logger().error('Error retrieving response content:', error);
      throw error;
    }
  }

  /**
   * Retrieves the value of an environment variable.
   */
  getEnvVariableValue(name: string, environmentVariables?: Record<string, unknown>): string {
    logger().debugExt(
      'AbstractionHelper - Getting environment variable value [getEnvVariableValue]',
      'Name:',
      name
    );

    const env = environmentVariables || this.env;
    if (env && env[name] !== undefined) {
      return String(env[name]);
    } else if (typeof process !== 'undefined' && process.env[name] !== undefined) {
      return String(process.env[name]);
    } else {
      // Custom logic for Akamai or other CDNs
      if (typeof EdgeKV !== 'undefined') {
        // Assume we're in Akamai
        const edgeKv = new EdgeKV({ namespace: 'default' });
        return edgeKv.getText({ item: name });
      }
      throw new Error(`Environment variable ${name} not found`);
    }
  }

  /**
   * Initialize the KV store based on the CDN provider (singleton).
   */
  initializeKVStore(cdnProvider: CdnProvider, kvInterfaceAdapter: KVInterfaceAdapter): KVStoreAbstractInterface {
    if (!this.kvStore) {
      let provider: KVInterfaceAdapter;

      switch (cdnProvider) {
        case 'cloudflare':
          provider = kvInterfaceAdapter;
          break;
        case 'fastly':
          // Initialize Fastly KV provider
          throw new Error('Fastly KV provider not implemented');
        case 'akamai':
          // Initialize Akamai KV provider
          throw new Error('Akamai KV provider not implemented');
        case 'cloudfront':
          // Initialize CloudFront KV provider
          throw new Error('CloudFront KV provider not implemented');
        default:
          throw new Error('Unsupported CDN provider');
      }

      this.kvStore = new KVStoreAbstractInterface(provider);
    }

    return this.kvStore;
  }
}

/**
 * Retrieves an instance of AbstractionHelper.
 * This cannot be a singleton, and must be created for each request.
 */
export function getAbstractionHelper(
  request: Request,
  env: Record<string, unknown>,
  ctx: unknown
): AbstractionHelper {
  logger().debug('AbstractionHelper - Getting abstraction helper [getAbstractionHelper]');
  return new AbstractionHelper(request, env, ctx);
}
