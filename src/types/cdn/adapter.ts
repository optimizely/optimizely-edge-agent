import type { HttpRequest, HttpResponse } from '../http';
import type { KVStore } from './store';

/**
 * Type for CDN adapters that handle request/response operations
 */
type CDNAdapter = {
  handleRequest(request: HttpRequest): Promise<HttpResponse>;
  getKVStore(): KVStore;
  getRequest(): HttpRequest;
  getResponse(): HttpResponse;
  setResponse(response: HttpResponse): void;
}

export type { CDNAdapter };
