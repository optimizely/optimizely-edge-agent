/**
 * Interface representing a request that can be used across different platforms
 */
export interface IRequest {
	url: string;
	method: string;
	headers: Record<string, string>;
	body?: unknown;
	cookies: Record<string, string>;
	ip?: string;
	userAgent?: string;
}
