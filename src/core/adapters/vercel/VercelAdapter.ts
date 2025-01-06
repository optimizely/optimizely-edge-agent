import { BaseAdapter } from '../BaseAdapter';
import type { CookieOptions } from '../../../types';
import type { VercelKVStore } from './VercelKVStore';
import type { CoreLogic } from '../../providers/CoreLogic';

/**
 * Vercel Edge Functions adapter implementation
 */
export class VercelAdapter extends BaseAdapter {
    private readonly NOT_IMPLEMENTED = 'VercelAdapter is not implemented yet. See CloudflareAdapter for reference implementation.';
    private kvStore?: VercelKVStore;

    constructor(private coreLogic: CoreLogic) {
        super();
    }

    setKVStore(kvStore: VercelKVStore): void {
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
