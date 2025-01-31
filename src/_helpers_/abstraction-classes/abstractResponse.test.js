import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AbstractResponse } from './abstractResponse';
import defaultSettings from '../../_config_/defaultSettings';
import { logger } from '../../_helpers_/optimizelyHelper';

// Mock the logger
vi.mock('../../_helpers_/optimizelyHelper', () => ({
    logger: () => ({
        debugExt: vi.fn()
    })
}));

// Mock Response for environments that don't have it
class Headers {
    constructor(init = {}) {
        this._headers = new Map();
        if (init) {
            Object.entries(init).forEach(([key, value]) => {
                this.set(key, value);
            });
        }
    }

    get(name) {
        return this._headers.get(name.toLowerCase()) || null;
    }

    set(name, value) {
        this._headers.set(name.toLowerCase(), value);
    }

    append(name, value) {
        const existing = this.get(name);
        if (existing) {
            this.set(name, `${existing}, ${value}`);
        } else {
            this.set(name, value);
        }
    }
}

global.Response = class Response {
    constructor(body, options = {}) {
        this.body = body;
        this.status = options.status || 200;
        this.headers = new Headers(options.headers);
    }

    clone() {
        return new Response(this.body, {
            status: this.status,
            headers: Object.fromEntries(this.headers._headers)
        });
    }

    async json() {
        return JSON.parse(this.body);
    }
};

describe('AbstractResponse', () => {
    const originalCdnProvider = defaultSettings.cdnProvider;
    
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        defaultSettings.cdnProvider = originalCdnProvider;
    });

    describe('createResponse', () => {
        it('should create a Cloudflare response with JSON content type', () => {
            defaultSettings.cdnProvider = 'cloudflare';
            const body = { message: 'test' };
            const status = 200;
            const headers = { 'X-Custom': 'value' };

            const response = AbstractResponse.createResponse(body, status, headers);

            expect(response).toBeInstanceOf(Response);
            expect(response.status).toBe(status);
            expect(response.headers.get('Content-Type')).toBe('application/json');
            expect(response.headers.get('X-Custom')).toBe('value');
        });

        it('should create a response with text/plain content type', () => {
            defaultSettings.cdnProvider = 'cloudflare';
            const body = 'Hello World';
            const status = 200;
            const headers = { 'Content-Type': 'text/plain' };

            const response = AbstractResponse.createResponse(body, status, headers);

            expect(response).toBeInstanceOf(Response);
            expect(response.status).toBe(status);
            expect(response.headers.get('Content-Type')).toBe('text/plain');
        });

        it('should create a CloudFront response with correct format', () => {
            defaultSettings.cdnProvider = 'cloudfront';
            const body = { message: 'test' };
            const status = 200;
            const headers = { 'X-Custom': 'value' };

            const response = AbstractResponse.createResponse(body, status, headers);

            expect(response.status).toBe('200');
            expect(response.statusDescription).toBe('OK');
            expect(response.headers['x-custom']).toEqual([{ key: 'X-Custom', value: 'value' }]);
            expect(response.headers['content-type']).toEqual([{ key: 'Content-Type', value: 'application/json' }]);
            expect(JSON.parse(response.body)).toEqual(body);
        });

        it('should handle missing headers', () => {
            defaultSettings.cdnProvider = 'cloudflare';
            const body = { message: 'test' };
            const status = 200;

            const response = AbstractResponse.createResponse(body, status);

            expect(response).toBeInstanceOf(Response);
            expect(response.status).toBe(status);
            expect(response.headers.get('Content-Type')).toBe('application/json');
        });

        it('should throw error for unsupported CDN provider', () => {
            defaultSettings.cdnProvider = 'unsupported';
            const body = { message: 'test' };

            expect(() => AbstractResponse.createResponse(body)).toThrow('Unsupported CDN provider');
        });
    });

    describe('createNewResponse', () => {
        beforeEach(() => {
            // Mock createResponse function for Akamai
            global.createResponse = vi.fn().mockReturnValue({ 
                headers: new Headers(),
                status: 201 
            });
        });

        afterEach(() => {
            if (global.createResponse) {
                delete global.createResponse;
            }
        });

        it('should create a new Cloudflare response', () => {
            defaultSettings.cdnProvider = 'cloudflare';
            const body = 'test';
            const options = { status: 201 };

            const response = AbstractResponse.createNewResponse(body, options);

            expect(response).toBeInstanceOf(Response);
            expect(response.status).toBe(201);
        });

        it('should create a new Akamai response', () => {
            defaultSettings.cdnProvider = 'akamai';
            const body = 'test';
            const options = { status: 201 };

            const response = AbstractResponse.createNewResponse(body, options);

            // TODO: Fix test
            // expect(global.createResponse).toHaveBeenCalledWith('test', { status: 201 });
            expect(response.status).toBe(201);
        });

        it('should create a new CloudFront response', () => {
            defaultSettings.cdnProvider = 'cloudfront';
            const body = 'test';
            const options = { status: 201 };

            const response = AbstractResponse.createNewResponse(body, options);

            expect(response).toBeInstanceOf(Response);
            expect(response.status).toBe(201);
        });

        it('should throw error for unsupported CDN provider', () => {
            defaultSettings.cdnProvider = 'unsupported';
            expect(() => AbstractResponse.createNewResponse('test', {})).toThrow('Unsupported CDN provider');
        });
    });

    describe('header operations', () => {
        beforeEach(() => {
            // Mock createResponse function for Akamai
            global.createResponse = vi.fn().mockReturnValue({ 
                headers: new Headers(),
                status: 200 
            });
        });

        afterEach(() => {
            if (global.createResponse) {
                delete global.createResponse;
            }
        });

        it('should set and get header for Cloudflare response', () => {
            defaultSettings.cdnProvider = 'cloudflare';
            const response = new Response('test');
            
            AbstractResponse.setHeader(response, 'X-Test', 'value');
            const value = AbstractResponse.getHeader(response, 'X-Test');

            expect(value).toBe('value');
        });

        it('should set and get header for Akamai response', () => {
            defaultSettings.cdnProvider = 'akamai';
            const response = { headers: new Headers() };
            
            AbstractResponse.setHeader(response, 'X-Test', 'value');
            const value = AbstractResponse.getHeader(response, 'X-Test');

            expect(value).toBe('value');
        });

        it('should set and get header for CloudFront response', () => {
            defaultSettings.cdnProvider = 'cloudfront';
            const response = { headers: {} };
            
            AbstractResponse.setHeader(response, 'X-Test', 'value');
            const value = AbstractResponse.getHeader(response, 'X-Test');

            expect(value).toBe('value');
        });

        it('should return null for non-existent header', () => {
            defaultSettings.cdnProvider = 'cloudflare';
            const response = new Response('test');
            
            const value = AbstractResponse.getHeader(response, 'X-Non-Existent');
            expect(value).toBeNull();
        });

        it('should handle invalid headers object', () => {
            defaultSettings.cdnProvider = 'cloudflare';
            const response = { headers: null };
            
            expect(() => AbstractResponse.setHeader(response, 'X-Test', 'value')).toThrowError();
        });
    });

    describe('cookie operations', () => {
        beforeEach(() => {
            // Mock createResponse function for Akamai
            global.createResponse = vi.fn().mockReturnValue({ 
                headers: new Headers(),
                status: 200 
            });
        });

        afterEach(() => {
            if (global.createResponse) {
                delete global.createResponse;
            }
        });

        it('should set and get cookie for Cloudflare response', () => {
            defaultSettings.cdnProvider = 'cloudflare';
            const response = new Response('test');
            
            AbstractResponse.setCookie(response, 'test-cookie', 'value', { path: '/' });
            expect(response.headers.get('Set-Cookie')).toBe('test-cookie=value; path=/');
        });

        it('should set and get cookie for Akamai response', () => {
            defaultSettings.cdnProvider = 'akamai';
            const response = new Response('test');
            
            AbstractResponse.setCookie(response, 'test-cookie', 'value', { path: '/' });
            expect(response.headers.get('Set-Cookie')).toBe('test-cookie=value; path=/');
        });

        it('should set and get cookie for CloudFront response', () => {
            defaultSettings.cdnProvider = 'cloudfront';
            const response = { headers: {} };
            
            AbstractResponse.setCookie(response, 'test-cookie', 'value', { path: '/' });
            expect(response.headers['set-cookie'][0].value).toBe('test-cookie=value; path=/');
        });

        it('should append cookie to response', () => {
            defaultSettings.cdnProvider = 'cloudflare';
            const response = new Response('test');
            
            AbstractResponse.appendCookieToResponse(response, 'test-cookie=value');
            expect(response.headers.get('Set-Cookie')).toBe('test-cookie=value');
        });

        it('should get cookie from response', () => {
            defaultSettings.cdnProvider = 'cloudflare';
            const response = new Response('test');
            response.headers.set('Set-Cookie', 'test-cookie=value');
            
            const value = AbstractResponse.getCookieFromResponse(response, 'test-cookie');
            expect(value).toBe('value');
        });

        it('should return null when cookie is not found', () => {
            defaultSettings.cdnProvider = 'cloudflare';
            const response = new Response('test');
            
            const value = AbstractResponse.getCookieFromResponse(response, 'non-existent');
            expect(value).toBeNull();
        });

        it('should handle multiple cookies', () => {
            defaultSettings.cdnProvider = 'cloudflare';
            const response = new Response('test');
            response.headers.set('Set-Cookie', 'cookie1=value1; cookie2=value2');
            
            const value1 = AbstractResponse.getCookieFromResponse(response, 'cookie1');
            const value2 = AbstractResponse.getCookieFromResponse(response, 'cookie2');
            expect(value1).toBe('value1');
            expect(value2).toBe('value2');
        });

        it('should handle cookie options correctly', () => {
            defaultSettings.cdnProvider = 'cloudflare';
            const response = new Response('test');
            const options = {
                path: '/',
                domain: 'example.com',
                maxAge: 3600,
                secure: true,
                httpOnly: true
            };
            
            AbstractResponse.setCookie(response, 'test-cookie', 'value', options);
            const cookie = response.headers.get('Set-Cookie');
            expect(cookie).toContain('test-cookie=value');
            expect(cookie).toContain('path=/');
            expect(cookie).toContain('domain=example.com');
            expect(cookie).toContain('maxAge=3600');
            expect(cookie).toContain('secure=true');
            expect(cookie).toContain('httpOnly=true');
        });
    });

    describe('JSON operations', () => {
        it('should parse JSON for Cloudflare response', async () => {
            defaultSettings.cdnProvider = 'cloudflare';
            const body = { test: 'value' };
            const response = new Response(JSON.stringify(body));
            
            const result = await AbstractResponse.parseJson(response);
            expect(result).toEqual(body);
        });

        it('should parse JSON for CloudFront response', async () => {
            defaultSettings.cdnProvider = 'cloudfront';
            const body = { test: 'value' };
            const response = { body: JSON.stringify(body) };
            
            const result = await AbstractResponse.parseJson(response);
            expect(result).toEqual(body);
        });
    });

    describe('response cloning', () => {
        it('should clone Cloudflare response', () => {
            defaultSettings.cdnProvider = 'cloudflare';
            const response = new Response('test');
            
            const cloned = AbstractResponse.cloneResponse(response);
            expect(cloned).toBeInstanceOf(Response);
        });

        it('should clone CloudFront response', () => {
            defaultSettings.cdnProvider = 'cloudfront';
            const response = { body: 'test', headers: {} };
            
            const cloned = AbstractResponse.cloneResponse(response);
            expect(cloned).toEqual(response);
            expect(cloned).not.toBe(response);
        });
    });

    describe('instance methods', () => {
        it('should call static methods from instance methods', () => {
            const instance = new AbstractResponse();
            const response = new Response('test');
            
            // Test that instance methods correctly call their static counterparts
            const staticSetHeader = vi.spyOn(AbstractResponse, 'setHeader');
            instance.setHeader(response, 'X-Test', 'value');
            expect(staticSetHeader).toHaveBeenCalledWith(response, 'X-Test', 'value');

            const staticGetHeader = vi.spyOn(AbstractResponse, 'getHeader');
            instance.getHeader(response, 'X-Test');
            expect(staticGetHeader).toHaveBeenCalledWith(response, 'X-Test');

            const staticSetCookie = vi.spyOn(AbstractResponse, 'setCookie');
            instance.setCookie(response, 'test-cookie', 'value');
            expect(staticSetCookie).toHaveBeenCalledWith(response, 'test-cookie', 'value', {});

            const staticGetCookie = vi.spyOn(AbstractResponse, 'getCookieFromResponse');
            instance.getCookieFromResponse(response, 'test-cookie');
            expect(staticGetCookie).toHaveBeenCalledWith(response, 'test-cookie');

            const staticCloneResponse = vi.spyOn(AbstractResponse, 'cloneResponse');
            instance.cloneResponse(response);
            expect(staticCloneResponse).toHaveBeenCalledWith(response);

            // const staticParseJson = vi.spyOn(AbstractResponse, 'parseJson');
            // instance.parseJson(response);
            // expect(staticParseJson).toHaveBeenCalledWith(response);
        });
    });

    describe('error handling', () => {
        it('should throw error for unsupported CDN provider in setHeaderInResponse', () => {
            defaultSettings.cdnProvider = 'unsupported';
            const response = new Response('test');
            
            expect(() => AbstractResponse.setHeaderInResponse(response, 'X-Test', 'value')).toThrow('Unsupported CDN provider');
        });

        it('should throw error for unsupported CDN provider in appendCookieToResponse', () => {
            defaultSettings.cdnProvider = 'unsupported';
            const response = new Response('test');
            
            expect(() => AbstractResponse.appendCookieToResponse(response, 'test-cookie=value')).toThrow('Unsupported CDN provider');
        });

        it('should throw error for unsupported CDN provider in setCookieInResponse', () => {
            defaultSettings.cdnProvider = 'unsupported';
            const response = new Response('test');
            
            expect(() => AbstractResponse.setCookieInResponse(response, 'test-cookie', 'value')).toThrow('Unsupported CDN provider');
        });

        it('should throw error for unsupported CDN provider in parseJson', () => {
            defaultSettings.cdnProvider = 'unsupported';
            const response = new Response('test');
            
            expect(() => AbstractResponse.parseJson(response)).rejects.toThrow('Unsupported CDN provider');
        });
    });
});
