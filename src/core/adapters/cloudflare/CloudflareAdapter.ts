import { BaseAdapter } from '../BaseAdapter';
import { CookieOptions } from '../../../types';
import { AbstractRequest } from '../../interfaces/abstractRequest';
import { AbstractResponse } from '../../interfaces/abstractResponse';
import * as optlyHelper from '../../../utils/helpers/optimizelyHelper';
import * as cookieDefaultOptions from '../../../config/cookieOptions';
import defaultSettings from '../../../config/defaultSettings';
import EventListeners from '../../providers/events/eventListeners';

interface CloudflareEnv {
	OPTIMIZELY_KV: KVNamespace;
	[key: string]: unknown;
}

interface CloudflareFetchContext {
	waitUntil(promise: Promise<any>): void;
	passThroughOnException(): void;
}

export class CloudflareAdapter extends BaseAdapter {
	private coreLogic: any; // TODO: Add proper type when CoreLogic is converted
	private env?: CloudflareEnv;
	private ctx?: CloudflareFetchContext;

	constructor(coreLogic: any) {
		super();
		this.coreLogic = coreLogic;
	}

	setContext(env: CloudflareEnv, ctx: CloudflareFetchContext): void {
		this.env = env;
		this.ctx = ctx;
	}

	async handleRequest(request: Request): Promise<Response> {
		if (!this.env || !this.ctx) {
			throw new Error('Cloudflare context not set. Call setContext before handling requests.');
		}

		const url = new URL(request.url);
		const abstractRequest = new AbstractRequest(request, 'cloudflare');

		// Handle API requests
		if (url.pathname.startsWith('/v1/')) {
			return this.handleApiRequest(abstractRequest);
		}

		// Handle default requests
		return this.defaultFetch(request);
	}

	setRequestCookie(request: Request, name: string, value: string, options?: CookieOptions): Request {
		const cookieValue = this.serializeCookie(name, value, options);
		const newHeaders = new Headers(request.headers);
		newHeaders.append('Cookie', cookieValue);
		
		return new Request(request.url, {
			method: request.method,
			headers: newHeaders,
			body: request.body,
			redirect: request.redirect,
		});
	}

	setResponseCookie(response: Response, name: string, value: string, options?: CookieOptions): Response {
		const cookieValue = this.serializeCookie(name, value, options);
		const newHeaders = new Headers(response.headers);
		newHeaders.append('Set-Cookie', cookieValue);

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: newHeaders,
		});
	}

	getRequestCookie(request: Request, name: string): string | null {
		const cookies = this.parseCookie(request.headers.get('Cookie'));
		return cookies.get(name) || null;
	}

	getResponseCookie(response: Response, name: string): string | null {
		const cookies = this.parseCookie(response.headers.get('Set-Cookie'));
		return cookies.get(name) || null;
	}

	deleteRequestCookie(request: Request, name: string): Request {
		return this.setRequestCookie(request, name, '', { expires: new Date(0) });
	}

	deleteResponseCookie(response: Response, name: string): Response {
		return this.setResponseCookie(response, name, '', { expires: new Date(0) });
	}

	private async handleApiRequest(abstractRequest: AbstractRequest): Promise<Response> {
		// TODO: Implement API request handling
		throw new Error('API request handling not implemented');
	}

	private async defaultFetch(request: Request): Promise<Response> {
		return fetch(request);
	}
}
