import { CookieOptions, CDNAdapter } from '../../types';

export abstract class BaseAdapter implements CDNAdapter {
	abstract handleRequest(request: Request): Promise<Response>;

	abstract setRequestCookie(
		request: Request,
		name: string,
		value: string,
		options?: CookieOptions,
	): Request;

	abstract setResponseCookie(
		response: Response,
		name: string,
		value: string,
		options?: CookieOptions,
	): Response;

	abstract getRequestCookie(request: Request, name: string): string | null;

	abstract getResponseCookie(response: Response, name: string): string | null;

	abstract deleteRequestCookie(request: Request, name: string): Request;

	abstract deleteResponseCookie(response: Response, name: string): Response;

	protected serializeCookie(name: string, value: string, options?: CookieOptions): string {
		const parts = [`${name}=${value}`];

		if (options) {
			if (options.domain) parts.push(`Domain=${options.domain}`);
			if (options.path) parts.push(`Path=${options.path}`);
			if (options.maxAge) parts.push(`Max-Age=${options.maxAge}`);
			if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
			if (options.httpOnly) parts.push('HttpOnly');
			if (options.secure) parts.push('Secure');
			if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
		}

		return parts.join('; ');
	}

	protected parseCookie(cookieString: string | null): Map<string, string> {
		const cookies = new Map<string, string>();
		if (!cookieString) return cookies;

		for (const cookie of cookieString.split(';')) {
			const parts = cookie.split('=');
			const name = parts[0]?.trim();
			const value = parts[1]?.trim();
			if (name && value) {
				cookies.set(name, value);
			}
		}

		return cookies;
	}
}
