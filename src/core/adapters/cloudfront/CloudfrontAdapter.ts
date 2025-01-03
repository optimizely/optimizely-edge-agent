import { BaseAdapter } from '../BaseAdapter';
import { CookieOptions, CDNSettings } from '../../../types';
import { CloudfrontKVStore } from './CloudfrontKVStore';

/**
 * AWS Cloudfront adapter implementation
 */
export class CloudfrontAdapter extends BaseAdapter {
    private readonly NOT_IMPLEMENTED = 'CloudfrontAdapter is not implemented yet. See CloudflareAdapter for reference implementation.';
    private kvStore?: CloudfrontKVStore;

    constructor(private coreLogic: any) {
        super();
    }

    setKVStore(kvStore: CloudfrontKVStore): void {
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
