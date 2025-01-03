import { BaseAdapter } from '../BaseAdapter';
import { CookieOptions } from '../../../types';

/**
 * TODO: Implement Vercel Edge Functions adapter
 * This adapter is currently a placeholder and needs to be implemented based on
 * the CloudflareAdapter implementation as a model.
 * See: src/core/adapters/cloudflare/CloudflareAdapter.ts
 */
export class VercelAdapter extends BaseAdapter {
    private readonly NOT_IMPLEMENTED = 'VercelAdapter is not implemented yet. See CloudflareAdapter for reference implementation.';

    async handleRequest(request: Request): Promise<Response> {
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
