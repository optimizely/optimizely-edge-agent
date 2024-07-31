/**
 * @module AbstractResponse
 */

import defaultSettings from '../../_config_/defaultSettings';
import { AbstractionHelper } from '../abstractionHelper';
import { logger } from '../../_helpers_/optimizelyHelper';

/**
 * The AbstractResponse class is an abstract class that provides a common interface for handling responses.
 * It is designed to be extended by other classes to provide specific implementations for handling responses.
 * Some methods are implemented as static methods and some as instance methods. Some instance methods are also
 * implemented as static methods by reference to the static methods.
 * It implements the following methods:
 * - createResponse(body, status, headers, contentType) - Creates a new response object.
 * - createNewResponse(body, options) - Creates a new response based on the provided body and options.
 * - setHeader(response, name, value) - Sets a header in the response.
 * - getHeader(response, name) - Gets a header from the response.
 * - setCookie(response, name, value, options) - Sets a cookie in the response.
 * - getCookie(response, name) - Gets a cookie from the response.
 * - getCookieFromResponse(response, name) - Gets a cookie from the response.
 */
export class AbstractResponse {
	/**
	 * Creates a new response object.
	 * @static
	 * @param {Object|string} body - The response body.
	 * @param {number} status - The HTTP status code.
	 * @param {Object} headers - The response headers.
	 * @param {string} contentType - The content type of the response body.
	 * @returns {Response|Object} - The constructed response.
	 */
	static createResponse(body, status = 200, headers = {}, contentType = 'application/json') {
		logger().debugExt('AbstractResponse - Creating response [createResponse]');
		logger().debugExt(
			'AbstractResponse - Body:',
			body,
			'Status:',
			status,
			'Headers:',
			headers,
			'Content type:',
			contentType,
		);

		// Ensure headers is a valid object
		if (!headers || typeof headers !== 'object') {
			headers = {};
		}

		// Set the content type in headers if not already set
		if (!headers['Content-Type']) {
			headers['Content-Type'] = contentType;
		}

		let responseBody;
		if (headers['Content-Type'].includes('application/json')) {
			responseBody = JSON.stringify(body);
		} else if (headers['Content-Type'].includes('text/plain') || headers['Content-Type'].includes('text/html')) {
			responseBody = body.toString();
		} else {
			responseBody = body; // For other content types, use the body as is
		}

		const cdnProvider = defaultSettings.cdnProvider.toLowerCase();
		logger().debugExt('AbstractResponse - CDN provider:', cdnProvider);

		switch (cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
				return new Response(responseBody, {
					status: status,
					headers: headers,
				});
			case 'akamai':
				// Assume Akamai EdgeWorkers
				return createResponse(responseBody, {
					status: status,
					headers: headers,
				});
			case 'cloudfront':
				// Assume AWS CloudFront (Lambda@Edge)
				return {
					status: status.toString(),
					statusDescription: 'OK',
					headers: Object.fromEntries(
						Object.entries(headers).map(([k, v]) => [k.toLowerCase(), [{ key: k, value: v }]]),
					),
					body: responseBody,
				};
			default:
				throw new Error('Unsupported CDN provider');
		}
	}

	/**
	 * Creates a new response object.
	 * @param {Object|string} body - The response body.
	 * @param {number} status - The HTTP status code.
	 * @param {Object} headers - The response headers.
	 * @param {string} contentType - The content type of the response body.
	 * @returns {Response|Object} - The constructed response.
	 */
	createResponse(body, status = 200, headers = {}, contentType = 'application/json') {
		return AbstractResponse.createResponse(body, status, headers, contentType);
	}

	/**
	 * Creates a new response based on the provided body and options.
	 * Supports Cloudflare, Akamai, Fastly, CloudFront, and Vercel.
	 * @param {any} body - The body of the response.
	 * @param {Object} options - The options object for the response.
	 * @returns {Response} - The new response object.
	 */
	static createNewResponse(body, options) {
		logger().debugExt('AbstractResponse - Creating new response [createNewResponse]');
		logger().debugExt('AbstractResponse - Body:', body, 'Options:', options);

		const cdnProvider = defaultSettings.cdnProvider.toLowerCase();

		switch (cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
				return new Response(body, options);
			case 'akamai':
				return createResponse(responseBody, options);
			case 'cloudfront':
				// For Akamai and CloudFront, we assume the standard Response constructor works
				return new Response(body, options);
			default:
				throw new Error('Unsupported CDN provider.');
		}
	}

	/**
	 * Creates a new response based on the provided body and options.
	 * Supports Cloudflare, Akamai, Fastly, CloudFront, and Vercel.
	 * @param {any} body - The body of the response.
	 * @param {Object} options - The options object for the response.
	 * @returns {Response} - The new response object.
	 */
	createNewResponse(body, options) {
		return AbstractResponse.createNewResponse(body, options);
	}

	/**
	 * Sets a header in the response.
	 * @param {Response|Object} response - The response object.
	 * @param {string} name - The name of the header.
	 * @param {string} value - The value of the header.
	 */
	static setHeader(response, name, value) {
		logger().debugExt('AbstractResponse - Setting header [setHeader]');
		logger().debugExt('AbstractResponse - Response:', response, 'Name:', name, 'Value:', value);

		const cdnProvider = defaultSettings.cdnProvider.toLowerCase();

		switch (cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
			case 'akamai':
				response.headers.set(name, value);
				break;
			case 'cloudfront':
				response.headers[name.toLowerCase()] = [{ key: name, value: value }];
				break;
			default:
				throw new Error('Unsupported CDN provider');
		}
	}

	/**
	 * Gets a header from the response.
	 * @param {Response|Object} response - The response object.
	 * @param {string} name - The name of the header.
	 * @returns {string|null} - The value of the header, or null if not found.
	 */
	static getHeader(response, name) {
		logger().debugExt('AbstractResponse - Getting header [getHeader]');

		const cdnProvider = defaultSettings.cdnProvider.toLowerCase();

		switch (cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
			case 'akamai':
				return response.headers.get(name);
			case 'cloudfront':
				return response.headers[name.toLowerCase()]?.[0]?.value || null;
			default:
				throw new Error('Unsupported CDN provider');
		}
	}

	/**
	 * Sets a cookie in the response.
	 * @param
	 * Sets a cookie in the response.
	 * @param {Response|Object} response - The response object.
	 * @param {string} name - The name of the cookie.
	 * @param {string} value - The value of the cookie.
	 * @param {Object} [options] - Additional cookie options (e.g., path, domain, maxAge, secure, httpOnly).
	 */
	static setCookie(response, name, value, options = {}) {
		logger().debugExt('AbstractResponse - Setting cookie [setCookie]');

		const cdnProvider = defaultSettings.cdnProvider.toLowerCase();
		let cookieString = `${name}=${value}`;

		for (const [key, val] of Object.entries(options)) {
			cookieString += `; ${key}=${val}`;
		}

		switch (cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
			case 'akamai':
				response.headers.append('Set-Cookie', cookieString);
				break;
			case 'cloudfront':
				if (!response.headers['set-cookie']) {
					response.headers['set-cookie'] = [];
				}
				response.headers['set-cookie'].push({ key: 'Set-Cookie', value: cookieString });
				break;
			default:
				throw new Error('Unsupported CDN provider');
		}
	}

	/**
	 * Gets a cookie from the response.
	 * @param {string} name - The name of the cookie.
	 * @returns {string|null} - The value of the cookie, or null if not found.
	 */
	getCookie(name) {
		logger().debugExt('AbstractResponse - Getting cookie [getCookie]', `Name: ${name}`);

		const cdnProvider = defaultSettings.cdnProvider.toLowerCase();
		let cookies;

		switch (cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
			case 'akamai':
				cookies = this.response.headers.get('Set-Cookie');
				break;
			case 'cloudfront':
				cookies = this.response.headers['set-cookie'];
				break;
			default:
				throw new Error('Unsupported CDN provider');
		}

		if (!cookies) return null;

		const cookieArray = cookies.split(';').map((cookie) => cookie.trim());
		for (const cookie of cookieArray) {
			const [cookieName, cookieValue] = cookie.split('=');
			if (cookieName === name) {
				return cookieValue;
			}
		}
		return null;
	}

	/**
	 * Gets a cookie from the request.
	 * @param {string} name - The name of the cookie.
	 * @returns {string|null} - The value of the cookie, or null if not found.
	 */
	getCookie(name) {
		return AbstractResponse.getCookie(name);
	}

	/**
	 * Get a cookie from the response.
	 * @param {Response|Object} response - The response object.
	 * @param {string} name - The name of the cookie.
	 * @returns {string|null} - The value of the cookie, or null if not found.
	 */
	static getCookieFromResponse(response, name) {
		logger().debugExt('AbstractResponse - Getting cookie from response [getCookieFromResponse]', `Name: ${name}`);

		const cdnProvider = defaultSettings.cdnProvider.toLowerCase();
		let cookies;

		switch (cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
			case 'akamai':
				cookies = response.headers.get('Set-Cookie');
				break;
			case 'cloudfront':
				cookies = response.headers['set-cookie'];
				break;
			default:
				throw new Error('Unsupported CDN provider.');
		}

		if (!cookies) return null;

		const cookieArray = cookies.split(';').map((cookie) => cookie.trim());
		for (const cookie of cookieArray) {
			const [cookieName, cookieValue] = cookie.split('=');
			if (cookieName === name) {
				return cookieValue;
			}
		}
		return null;
	}

	/**
	 * Get a cookie from the response.
	 * @param {Response|Object} response - The response object.
	 * @param {string} name - The name of the cookie.
	 * @returns {string|null} - The value of the cookie, or null if not found.
	 */
	getCookieFromResponse(response, name) {
		return AbstractResponse.getCookieFromResponse(response, name);
	}

	/**
	 * Sets a header in the response.
	 * @param {Response|Object} response - The response object.
	 * @param {string} name - The name of the header.
	 * @param {string} value - The value of the header.
	 */
	setHeader(response, name, value) {
		AbstractResponse.setHeader(response, name, value);
	}

	/**
	 * Gets a header from the response.
	 * @param {Response|Object} response - The response object.
	 * @param {string} name - The name of the header.
	 * @returns {string|null} - The value of the header, or null if not found.
	 */
	getHeader(response, name) {
		return AbstractResponse.getHeader(response, name);
	}

	/**
	 * Sets a cookie in the response.
	 * @param {Response|Object} response - The response object.
	 * @param {string} name - The name of the cookie.
	 * @param {string} value - The value of the cookie.
	 * @param {Object} [options] - Additional cookie options (e.g., path, domain, maxAge, secure, httpOnly).
	 */
	setCookie(response, name, value, options = {}) {
		AbstractResponse.setCookie(response, name, value, options);
	}

	/**
	 * Get a header from the response.
	 * @param {Response} response - The response object.
	 * @param {string} name - The name of the header.
	 * @returns {string|null} - The value of the header, or null if not found.
	 */
	static getHeaderFromResponse(response, name) {
		logger().debugExt('AbstractResponse - Getting header from response [getHeaderFromResponse]', `Name: ${name}`);
		const cdnProvider = defaultSettings.cdnProvider.toLowerCase();
		switch (cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
			case 'akamai':
				return response.headers.get(name);
			case 'cloudfront':
				return response.headers[name.toLowerCase()]?.[0]?.value || null;
			default:
				throw new Error('Unsupported CDN provider.');
		}
	}

	getHeaderFromResponse(response, name) {
		return AbstractResponse.getHeaderFromResponse(response, name);
	}

	/**
	 * Set a header in the response.
	 * @param {Response} response - The response object.
	 * @param {string} name - The name of the header.
	 * @param {string} value - The value of the header.
	 */
	static setHeaderInResponse(response, name, value) {
		logger().debugExt(
			'AbstractResponse - Setting header in response [setHeaderInResponse]',
			`Name: ${name}, Value: ${value}`,
		);
		const cdnProvider = defaultSettings.cdnProvider.toLowerCase();
		switch (cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
			case 'akamai':
				response.headers.set(name, value);
				break;
			case 'cloudfront':
				response.headers[name.toLowerCase()] = [{ key: name, value: value }];
				break;
			default:
				throw new Error('Unsupported CDN provider.');
		}
	}

	setHeaderInResponse(response, name, value) {
		AbstractResponse.setHeaderInResponse(response, name, value);
	}

	/**
	 * Get a cookie from the response.
	 * @param {Response} response - The response object.
	 * @param {string} name - The name of the cookie.
	 * @returns {string|null} - The value of the cookie, or null if not found.
	 */
	static getCookieFromResponse(response, name) {
		logger().debugExt('AbstractResponse - Getting cookie from response [getCookieFromResponse]', `Name: ${name}`);
		const cdnProvider = defaultSettings.cdnProvider.toLowerCase();
		let cookies;

		switch (cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
			case 'akamai':
				cookies = response.headers.get('Set-Cookie');
				break;
			case 'cloudfront':
				cookies = response.headers['set-cookie'];
				break;
			default:
				throw new Error('Unsupported CDN provider.');
		}

		if (!cookies) return null;

		const cookieArray = cookies.split(';').map((cookie) => cookie.trim());
		for (const cookie of cookieArray) {
			const [cookieName, cookieValue] = cookie.split('=');
			if (cookieName === name) {
				return cookieValue;
			}
		}
		return null;
	}

	getCookieFromResponse(response, name) {
		return AbstractResponse.getCookieFromResponse(response, name);
	}

	/**
	 * Set a cookie in the response.
	 * @param {Response} response - The response object.
	 * @param {string} name - The name of the cookie.
	 * @param {string} value - The value of the cookie.
	 * @param {Object} [options] - Additional cookie options (e.g., path, domain, maxAge, secure, httpOnly).
	 */
	static setCookieInResponse(response, name, value, options = {}) {
		logger().debugExt(
			'AbstractResponse - Setting cookie in response [setCookieInResponse]',
			`Name: ${name}, Value: ${value}, Options: ${options}`,
		);
		const cdnProvider = defaultSettings.cdnProvider.toLowerCase();
		let cookieString = `${name}=${value}`;

		for (const [key, val] of Object.entries(options)) {
			cookieString += `; ${key}=${val}`;
		}

		switch (cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
			case 'akamai':
				response.headers.append('Set-Cookie', cookieString);
				break;
			case 'cloudfront':
				if (!response.headers['set-cookie']) {
					response.headers['set-cookie'] = [];
				}
				response.headers['set-cookie'].push({ key: 'Set-Cookie', value: cookieString });
				break;
			default:
				throw new Error('Unsupported CDN provider.');
		}
	}

	setCookieInResponse(response, name, value, options = {}) {
		AbstractResponse.setCookieInResponse(response, name, value, options);
	}

	/**
	 * Appends a cookie to the response headers.
	 * @param {Response} response - The response object.
	 * @param {string} cookieValue - The serialized cookie string.
	 */
	static appendCookieToResponse(response, cookieValue) {
		logger().debugExt(
			'AbstractResponse - Appending cookie to response [appendCookieToResponse]',
			`Cookie value: ${cookieValue}`,
		);
		const cdnProvider = defaultSettings.cdnProvider.toLowerCase();
		switch (cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
			case 'akamai':
				response.headers.append('Set-Cookie', cookieValue);
				break;
			case 'cloudfront':
				if (!response.headers['set-cookie']) {
					response.headers['set-cookie'] = [];
				}
				response.headers['set-cookie'].push({ key: 'Set-Cookie', value: cookieValue });
				break;
			default:
				throw new Error('Unsupported CDN provider.');
		}
	}

	/**
	 * Appends a cookie to the response headers.
	 * @param {Response} response - The response object.
	 * @param {string} cookieValue - The serialized cookie string.
	 */
	appendCookieToResponse(response, cookieValue) {
		AbstractResponse.appendCookieToResponse(response, cookieValue);
	}

	/**
	 * Parses the response body as JSON.
	 * @param {Response|Object} response - The response object.
	 * @returns {Promise<Object>} - The parsed JSON object.
	 */
	static async parseJson(response) {
		const cdnProvider = defaultSettings.cdnProvider.toLowerCase();

		switch (cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
			case 'akamai':
				return response.json();
			case 'cloudfront':
				return JSON.parse(response.body);
			default:
				throw new Error('Unsupported CDN provider');
		}
	}

	/**
	 * Parses the response body as JSON.
	 * @param {Response|Object} response - The response object.
	 * @returns {Promise<Object>} - The parsed JSON object.
	 */
	async parseJson(response) {
		return AbstractResponse.parseJson(response);
	}

	/**
	 * Clones the response object.
	 * @param {Response|Object} response - The response object.
	 * @returns {Response|Object} - The cloned response object.
	 */
	static cloneResponse(response) {
		logger().debugExt('AbstractResponse - Cloning response [cloneResponse]');
		const cdnProvider = defaultSettings.cdnProvider.toLowerCase();

		switch (cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
			case 'akamai':
				return response.clone();
			case 'cloudfront':
				return { ...response };
			default:
				throw new Error('Unsupported CDN provider');
		}
	}

	/**
	 * Clones the response object.
	 * @param {Response|Object} response - The response object.
	 * @returns {Response|Object} - The cloned response object.
	 */
	cloneResponse(response) {
		return AbstractResponse.cloneResponse(response);
	}

	/**
	 * Creates a new response based on the provided body and options.
	 * Supports Cloudflare, Akamai, Fastly, CloudFront, and Vercel.
	 * @param {any} body - The body of the response.
	 * @param {Object} options - The options object for the response.
	 * @returns {Response} - The new response object.
	 */
	static createNewResponse(body, options) {
		logger().debugExt('AbstractResponse - Creating new response [createNewResponse]', 'Body', body, 'Options', options);
		const cdnProvider = defaultSettings.cdnProvider.toLowerCase();

		switch (cdnProvider) {
			case 'cloudflare':
			case 'fastly':
			case 'vercel':
				return new Response(body, options);
			case 'akamai':
			case 'cloudfront':
				// For Akamai and CloudFront, we assume the standard Response constructor works
				return new Response(body, options);
			default:
				throw new Error('Unsupported CDN provider.');
		}
	}

	/**
	 * Creates a new response based on the provided body and options.
	 * Supports Cloudflare, Akamai, Fastly, CloudFront, and Vercel.
	 * @param {any} body - The body of the response.
	 * @param {Object} options - The options object for the response.
	 * @returns {Response} - The new response object.
	 */
	createNewResponse(body, options) {
		return AbstractResponse.createNewResponse(body, options);
	}
}
