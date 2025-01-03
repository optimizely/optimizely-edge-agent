import { BaseAdapter } from '../BaseAdapter';
import { CookieOptions, CDNSettings, EventBatchSettings } from '../../../types';
import { IRequest } from '../../../types/request';
import { IResponse } from '../../../types/response';
import * as optlyHelper from '../../../utils/helpers/optimizelyHelper';
import * as cookieDefaultOptions from '../../../legacy/config/cookieOptions';
import defaultSettings from '../../../legacy/config/defaultSettings';
import EventListeners from '../../providers/events/eventListeners';
import type { CoreLogic } from '../../providers/CoreLogic';

interface CloudflareEnv {
	OPTIMIZELY_KV: KVNamespace;
	[key: string]: unknown;
}

interface CloudflareFetchContext {
	waitUntil(promise: Promise<unknown>): void;
	passThroughOnException(): void;
}

interface CachedResponse {
	body: string;
	headers: Record<string, string>;
	status: number;
	statusText: string;
	timestamp: number;
}

interface CloudflareKVStore {
	get(key: string, type: 'json'): Promise<CachedResponse | null>;
	put(key: string, value: string, options: { expirationTtl: number }): Promise<void>;
}

export class CloudflareAdapter extends BaseAdapter {
	private coreLogic: CoreLogic;
	private kvStore?: CloudflareKVStore;
	private eventListeners: EventListeners;

	constructor(coreLogic: CoreLogic) {
		super();
		this.coreLogic = coreLogic;
		this.eventListeners = new EventListeners();
	}

	setKVStore(kvStore: CloudflareKVStore): void {
		this.kvStore = kvStore;
	}

	async handleRequest(request: Request): Promise<Response> {
		const req: IRequest = {
			url: request.url,
			method: request.method,
			headers: Object.fromEntries(request.headers.entries()),
			cookies: this.parseCookies(request),
			ip: request.headers.get('cf-connecting-ip') || undefined,
			userAgent: request.headers.get('user-agent') || undefined,
		};

		if (request.body) {
			req.body = await request.json();
		}

		const res: IResponse = await this.coreLogic.handleRequest(req);
		return new Response(JSON.stringify(res.body), {
			status: res.status,
			statusText: res.statusText,
			headers: res.headers,
		});
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
			this.kvStore?.put(cacheKey, JSON.stringify(response), {
				expirationTtl: settings.ttl,
			});
		}

		return response;
	}

	private async handleEventRequest(request: Request): Promise<Response> {
		const event = await request.json();
		this.eventListeners.push(event);

		// Check if we should flush events
		const settings = defaultSettings.events as EventBatchSettings;
		if (
			this.eventListeners.length >= settings.maxSize ||
			Date.now() - this.lastEventFlush >= settings.flushInterval
		) {
			this.flushEvents();
		}

		return new Response('Event received', { status: 202 });
	}

	private async flushEvents(): Promise<void> {
		if (this.eventListeners.length === 0) return;

		const events = [...this.eventListeners];
		this.eventListeners = [];
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
		if (!this.kvStore) return null;

		const cached = await this.kvStore.get(key, 'json');
		return cached as CachedResponse | null;
	}

	private isCacheExpired(cached: CachedResponse, ttl: number = 3600): boolean {
		return Date.now() - cached.timestamp > ttl * 1000;
	}

	private async cacheResponse(
		key: string,
		response: Response,
		settings: CDNSettings,
	): Promise<void> {
		if (!this.kvStore) return;

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

		await this.kvStore.put(key, JSON.stringify(cached), {
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

	setRequestCookie(
		request: Request,
		name: string,
		value: string,
		options?: CookieOptions,
	): Request {
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

	setResponseCookie(
		response: Response,
		name: string,
		value: string,
		options?: CookieOptions,
	): Response {
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
