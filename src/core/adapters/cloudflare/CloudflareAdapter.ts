import { BaseAdapter } from '../BaseAdapter';
import { CookieOptions, CDNSettings, EventBatchSettings } from '../../../types';
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

interface CachedResponse {
	body: string;
	status: number;
	statusText: string;
	headers: Record<string, string>;
	timestamp: number;
}

export class CloudflareAdapter extends BaseAdapter {
	private coreLogic: any; // TODO: Add proper type when CoreLogic is converted
	private env?: CloudflareEnv;
	private ctx?: CloudflareFetchContext;
	private eventQueue: any[] = [];
	private lastEventFlush: number = Date.now();

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

		// Handle event dispatching
		if (url.pathname === '/v1/events') {
			return this.handleEventRequest(request);
		}

		return this.handleCachingRequest(request);
	}

	private async handleCachingRequest(request: Request): Promise<Response> {
		const settings = await this.getCDNSettings();
		const cacheKey = this.generateCacheKey(request, settings);

		if (request.method !== 'GET' || !settings.enabled) {
			return this.defaultFetch(request);
		}

		// Try to get from cache
		const cachedResponse = await this.getCachedResponse(cacheKey);
		if (cachedResponse && !this.isCacheExpired(cachedResponse, settings.ttl)) {
			return this.constructResponse(cachedResponse);
		}

		// Fetch from origin
		const response = await this.fetchFromOrigin(request, settings);
		
		// Cache the response
		if (response.ok) {
			this.ctx?.waitUntil(this.cacheResponse(cacheKey, response, settings));
		}

		return response;
	}

	private async handleEventRequest(request: Request): Promise<Response> {
		const event = await request.json();
		this.eventQueue.push(event);

		// Check if we should flush events
		const settings = defaultSettings.events as EventBatchSettings;
		if (
			this.eventQueue.length >= settings.maxSize ||
			Date.now() - this.lastEventFlush >= settings.flushInterval
		) {
			this.ctx?.waitUntil(this.flushEvents());
		}

		return new Response('Event received', { status: 202 });
	}

	private async flushEvents(): Promise<void> {
		if (this.eventQueue.length === 0) return;

		const events = [...this.eventQueue];
		this.eventQueue = [];
		this.lastEventFlush = Date.now();

		const settings = defaultSettings.events as EventBatchSettings;
		await fetch(settings.endpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ events }),
		});
	}

	private async getCDNSettings(): Promise<CDNSettings> {
		// TODO: Implement settings retrieval from KV or config
		return {
			enabled: true,
			ttl: 3600,
			bypassCache: false,
		};
	}

	private generateCacheKey(request: Request, settings: CDNSettings): string {
		const url = new URL(request.url);
		const prefix = settings.keyPrefix || 'cache';
		return `${prefix}:${url.pathname}${url.search}`;
	}

	private async getCachedResponse(key: string): Promise<CachedResponse | null> {
		if (!this.env?.OPTIMIZELY_KV) return null;

		const cached = await this.env.OPTIMIZELY_KV.get(key, 'json');
		return cached as CachedResponse | null;
	}

	private isCacheExpired(cached: CachedResponse, ttl: number = 3600): boolean {
		return Date.now() - cached.timestamp > ttl * 1000;
	}

	private async cacheResponse(key: string, response: Response, settings: CDNSettings): Promise<void> {
		if (!this.env?.OPTIMIZELY_KV) return;

		const headers: Record<string, string> = {};
		response.headers.forEach((value, key) => {
			headers[key] = value;
		});

		const cached: CachedResponse = {
			body: await response.clone().text(),
			status: response.status,
			statusText: response.statusText,
			headers,
			timestamp: Date.now(),
		};

		await this.env.OPTIMIZELY_KV.put(key, JSON.stringify(cached), {
			expirationTtl: settings.ttl,
		});
	}

	private constructResponse(cached: CachedResponse): Response {
		return new Response(cached.body, {
			status: cached.status,
			statusText: cached.statusText,
			headers: cached.headers,
		});
	}

	private async fetchFromOrigin(request: Request, settings: CDNSettings): Promise<Response> {
		const url = settings.originUrl ? new URL(request.url, settings.originUrl) : request.url;
		const fetchOptions: RequestInit = {
			method: request.method,
			headers: { ...request.headers, ...settings.headers },
		};

		return fetch(url.toString(), fetchOptions);
	}

	private async handleApiRequest(abstractRequest: AbstractRequest): Promise<Response> {
		// TODO: Implement API request handling
		throw new Error('API request handling not implemented');
	}

	private async defaultFetch(request: Request): Promise<Response> {
		return fetch(request);
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
}
