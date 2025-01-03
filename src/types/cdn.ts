export interface CookieOptions {
	domain?: string;
	path?: string;
	maxAge?: number;
	expires?: Date;
	httpOnly?: boolean;
	secure?: boolean;
	sameSite?: 'Strict' | 'Lax' | 'None';
}

export interface ICDNAdapter {
	handleRequest(request: Request): Promise<Response>;
	setRequestCookie(request: Request, name: string, value: string, options?: CookieOptions): Request;
	setResponseCookie(response: Response, name: string, value: string, options?: CookieOptions): Response;
	getRequestCookie(request: Request, name: string): string | null;
	getResponseCookie(response: Response, name: string): string | null;
	deleteRequestCookie(request: Request, name: string): Request;
	deleteResponseCookie(response: Response, name: string): Response;
}

export interface IKVStore {
	get(key: string): Promise<string | null>;
	put(key: string, value: string): Promise<void>;
	delete(key: string): Promise<void>;
}
