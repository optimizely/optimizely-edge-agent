/**
 * Interface representing a response that can be used across different platforms
 */
export interface IResponse {
	status: number;
	statusText: string;
	headers: Record<string, string>;
	body: unknown;
	cookies: Record<string, string>;
}
