import { BaseAdapter } from '../BaseAdapter';
import { CookieOptions, CDNSettings } from '../../../types';
import { FastlyKVStore } from './FastlyKVStore';

/**
 * Fastly Compute@Edge adapter implementation
 */
export class FastlyAdapter extends BaseAdapter {
    private readonly NOT_IMPLEMENTED = 'FastlyAdapter is not implemented yet. See CloudflareAdapter for reference implementation.';
    private kvStore?: FastlyKVStore;

    constructor(private coreLogic: any) {
        super();
    }

    setKVStore(kvStore: FastlyKVStore): void {
        this.kvStore = kvStore;
    }

    async handleRequest(request: Request): Promise<Response> {
        if (!this.kvStore) {
            throw new Error('KVStore not initialized');
        }
        throw new Error(this.NOT_IMPLEMENTED);
    }

    setRequestCookie(request: Request, name: string, value: string, options?: CookieOptions): Request {
        throw new Error(this.NOT_IMPLEMENTED);
    }

    setResponseCookie(response: Response, name: string, value: string, options?: CookieOptions): Response {
        throw new Error(this.NOT_IMPLEMENTED);
    }

    getRequestCookie(request: Request, name: string): string | null {
        throw new Error(this.NOT_IMPLEMENTED);
    }

    getResponseCookie(response: Response, name: string): string | null {
        throw new Error(this.NOT_IMPLEMENTED);
    }

    deleteRequestCookie(request: Request, name: string): Request {
        throw new Error(this.NOT_IMPLEMENTED);
    }

    deleteResponseCookie(response: Response, name: string): Response {
        throw new Error(this.NOT_IMPLEMENTED);
    }
}
