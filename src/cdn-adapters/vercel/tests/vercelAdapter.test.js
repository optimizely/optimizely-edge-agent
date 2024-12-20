import { describe, it, expect, vi, beforeEach } from 'vitest';
import VercelAdapter from '../vercelAdapter';

vi.mock('../../../_event_listeners_/eventListeners', () => ({
    default: {
        getInstance: vi.fn().mockReturnValue({
            emit: vi.fn(),
            on: vi.fn(),
            removeListener: vi.fn(),
            trigger: vi.fn()
        })
    }
}));

const cookieDefaultOptions = {
    path: '/',
    expires: new Date(Date.now() + 86400e3 * 365),
    maxAge: 86400 * 365,
    domain: 'example.com',
    secure: true,
    httpOnly: true,
    sameSite: 'none'
};

const mockLogger = {
    debug: vi.fn(),
    debugExt: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
};

const mockCoreLogic = {
    processRequest: vi.fn(),
    requestConfig: {},
    determineVariation: vi.fn()
};

const mockOptimizelyProvider = {
    getDatafile: vi.fn(),
    getFlags: vi.fn()
};

const mockAbstractionHelper = {
    abstractRequest: {
        getNewURL: vi.fn(),
        createNewRequestFromUrl: vi.fn(),
        getHeaderFromRequest: vi.fn(),
        setHeaderInRequest: vi.fn(),
        setHeaderFromRequest: vi.fn(),
        setCookieRequest: vi.fn(),
        cloneRequest: vi.fn((req) => req),
        getJsonPayload: vi.fn(),
        getCookieFromRequest: vi.fn()
    },
    abstractResponse: {
        appendCookieToResponse: vi.fn(),
        setHeaderInResponse: vi.fn(),
        getHeaderFromResponse: vi.fn(),
        createNewResponse: vi.fn((body, response) => response)
    }
};

const mockKvStore = {
    get: vi.fn(),
    put: vi.fn()
};

global.Response = class Response {
    constructor(body, init = {}) {
        this.body = body;
        this.headers = new Map();
        this.status = init.status || 200;
        this.ok = this.status >= 200 && this.status < 300;
        this.text = async () => body;
    }

    clone() {
        return new Response(this.body);
    }
};

global.Request = class Request {
    constructor(url, init = {}) {
        this.url = url;
        this.method = init.method || 'GET';
        this.headers = new Map();
        if (init.headers) {
            Object.entries(init.headers).forEach(([key, value]) => {
                this.headers.set(key, value);
            });
        }
    }

    clone() {
        return new Request(this.url, { method: this.method });
    }
};

describe('VercelAdapter', () => {
    let adapter;

    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn();
        adapter = new VercelAdapter(
            mockCoreLogic,
            mockOptimizelyProvider,
            'test-sdk-key',
            mockAbstractionHelper,
            mockKvStore,
            mockKvStore,
            mockLogger,
            'https://example.com'
        );
    });

    describe('Request Processing', () => {
        it('should handle GET requests with caching', async () => {
            const request = new Request('https://example.com/test-endpoint', { method: 'GET' });
            const env = { ENVIRONMENT: 'test' };
            const ctx = { waitUntil: vi.fn() };
            const mockResponse = new Response('test');
            const mockResult = {
                reqResponse: mockResponse,
                cdnExperimentSettings: {
                    cdnResponseURL: 'https://cdn.example.com/test',
                    cacheRequestToOrigin: true
                },
                reqResponseObjectType: 'response'
            };

            mockAbstractionHelper.abstractRequest.getNewURL.mockReturnValue(new URL('https://example.com/test-endpoint'));
            mockCoreLogic.processRequest.mockResolvedValue(mockResult);
            global.fetch.mockResolvedValue(mockResponse);

            const response = await adapter.fetchHandler(request, env, ctx);
            
            expect(response).toBeDefined();
            expect(mockCoreLogic.processRequest).toHaveBeenCalledWith(request, env, ctx, 'test-sdk-key');
        });

        it('should handle NO_MATCH response from processRequest', async () => {
            const request = new Request('https://example.com/test-endpoint', { method: 'GET' });
            const env = { ENVIRONMENT: 'test' };
            const ctx = { waitUntil: vi.fn() };
            const mockResponse = new Response('test');

            mockAbstractionHelper.abstractRequest.getNewURL.mockReturnValue(new URL('https://example.com/test-endpoint'));
            mockCoreLogic.processRequest.mockResolvedValue({ reqResponse: 'NO_MATCH' });
            global.fetch.mockResolvedValue(mockResponse);

            const response = await adapter.fetchHandler(request, env, ctx);
            
            expect(response).toBeDefined();
            expect(mockCoreLogic.processRequest).toHaveBeenCalledWith(request, env, ctx, 'test-sdk-key');
        });

        it('should handle POST requests', async () => {
            const request = new Request('https://example.com/test-endpoint', { method: 'POST' });
            const env = { ENVIRONMENT: 'test' };
            const ctx = { waitUntil: vi.fn() };
            const mockResponse = new Response('test');
            const mockResult = {
                reqResponse: mockResponse,
                cdnExperimentSettings: {
                    cdnResponseURL: 'https://cdn.example.com/test',
                    cacheRequestToOrigin: true
                }
            };

            mockAbstractionHelper.abstractRequest.getNewURL.mockReturnValue(new URL('https://example.com/test-endpoint'));
            mockCoreLogic.processRequest.mockResolvedValue(mockResult);

            const response = await adapter.fetchHandler(request, env, ctx);
            
            expect(response).toBeDefined();
            expect(mockCoreLogic.processRequest).toHaveBeenCalledWith(request, env, ctx, 'test-sdk-key');
        });

        it('should handle modified requests from event listeners', async () => {
            const request = new Request('https://example.com/test-endpoint', { method: 'GET' });
            const modifiedRequest = new Request('https://example.com/modified', { method: 'GET' });
            const env = { ENVIRONMENT: 'test' };
            const ctx = { waitUntil: vi.fn() };
            const mockResponse = new Response('test');
            const mockResult = {
                reqResponse: mockResponse,
                cdnExperimentSettings: {
                    cdnResponseURL: 'https://cdn.example.com/test',
                    cacheRequestToOrigin: true
                }
            };

            mockAbstractionHelper.abstractRequest.getNewURL.mockReturnValue(new URL('https://example.com/test-endpoint'));
            mockCoreLogic.processRequest.mockResolvedValue(mockResult);
            adapter.eventListeners.trigger.mockImplementation((event) => {
                if (event === 'beforeProcessingRequest') {
                    return { modifiedRequest };
                }
                return {};
            });

            const response = await adapter.fetchHandler(request, env, ctx);
            
            expect(response).toBeDefined();
            expect(mockCoreLogic.processRequest).toHaveBeenCalledWith(modifiedRequest, env, ctx, 'test-sdk-key');
        });

        it('should handle datafile operations', async () => {
            const request = new Request('https://example.com/test-endpoint', { method: 'GET' });
            const env = { ENVIRONMENT: 'test' };
            const ctx = { waitUntil: vi.fn() };
            const mockResponse = new Response('test');
            const mockResult = {
                reqResponse: mockResponse,
                cdnExperimentSettings: {}
            };

            mockAbstractionHelper.abstractRequest.getNewURL.mockReturnValue(new URL('https://example.com/test-endpoint'));
            mockCoreLogic.processRequest.mockResolvedValue(mockResult);
            mockCoreLogic.datafileOperation = true;
            adapter.eventListeners.trigger.mockResolvedValue({});

            const response = await adapter.fetchHandler(request, env, ctx);
            
            expect(response).toBeDefined();
            expect(response).toBe(mockResponse);
            expect(mockCoreLogic.processRequest).toHaveBeenCalled();
        });
    });

    describe('Cookie Management', () => {
        describe('setResponseCookie', () => {
            it('should set a cookie with default options', () => {
                const response = new Response();
                mockLogger.debugExt.mockImplementation(() => {});
                adapter.setResponseCookie(response, 'testCookie', 'testValue', cookieDefaultOptions);
                expect(mockAbstractionHelper.abstractResponse.appendCookieToResponse)
                    .toHaveBeenCalledWith(response, expect.stringContaining('testCookie=testValue'));
            });

            it('should throw error for invalid parameters', () => {
                mockLogger.debugExt.mockImplementation(() => {});
                expect(() => adapter.setResponseCookie(null, 'test', 'value'))
                    .toThrow();
            });
        });

        describe('setMultipleRequestCookies', () => {
            it('should set multiple cookies correctly', () => {
                const request = new Request('https://example.com');
                const cookies = {
                    session: { value: '12345', options: { path: '/' } },
                    user: { value: 'john', options: { secure: true } }
                };

                mockLogger.debugExt.mockImplementation(() => {});
                mockAbstractionHelper.abstractRequest.getHeaderFromRequest.mockReturnValue('');
                const modifiedRequest = new Request('https://example.com');
                mockAbstractionHelper.abstractRequest.setHeaderInRequest.mockReturnValue(modifiedRequest);
                mockAbstractionHelper.abstractRequest.cloneRequest.mockReturnValue(request);
                
                const result = adapter.setMultipleRequestCookies(request, cookies);
                expect(result).toBeDefined();
                expect(mockAbstractionHelper.abstractRequest.setHeaderInRequest).toHaveBeenCalledTimes(2);
            });
        });
    });

    describe('Header Management', () => {
        it('should set multiple response headers correctly', () => {
            const response = new Response();
            const headers = {
                'Content-Type': 'application/json',
                'X-Custom': 'test'
            };

            mockLogger.debugExt.mockImplementation(() => {});
            adapter.setMultipleResponseHeaders(response, headers);
            expect(mockAbstractionHelper.abstractResponse.setHeaderInResponse)
                .toHaveBeenCalledTimes(2);
        });
    });

    describe('Cache Management', () => {
        describe('createCacheKey', () => {
            it('should generate correct cache key with variation', () => {
                const request = new Request('https://example.com/test');
                const env = { ENVIRONMENT: 'test' };
                
                mockLogger.debugExt.mockImplementation(() => {});
                mockCoreLogic.determineVariation.mockReturnValue('variant-a');
                mockAbstractionHelper.abstractRequest.getNewURL
                    .mockReturnValue(new URL('https://example.com/test'));

                adapter.createCacheKey(request, env);
                expect(mockAbstractionHelper.abstractRequest.createNewRequestFromUrl)
                    .toHaveBeenCalled();
            });
        });
    });

    describe('Event Management', () => {
        describe('dispatchEventToOptimizely', () => {
            it('should dispatch events correctly', async () => {
                const eventData = {
                    url: 'https://logx.example.com/v1/events',
                    params: { 
                        visitors: [{ id: '1' }]
                    }
                };

                mockLogger.debugExt.mockImplementation(() => {});
                await adapter.dispatchEventToOptimizely(eventData);
                expect(adapter.eventQueue).toHaveLength(1);
            });
        });

        describe('consolidateVisitorsInEvents', async () => {
            it('should combine visitors from multiple events', async () => {
                const eventQueue = [
                    { visitors: [{ id: '1' }] },
                    { visitors: [{ id: '2' }] }
                ];

                mockLogger.debugExt.mockImplementation(() => {});
                const result = await adapter.consolidateVisitorsInEvents(eventQueue);
                expect(result).toBeDefined();
                expect(result.visitors).toBeDefined();
                expect(result.visitors).toHaveLength(2);
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle network failures gracefully', async () => {
            const request = new Request('https://example.com/test');
            const env = { ENVIRONMENT: 'test' };
            const ctx = { waitUntil: vi.fn() };

            adapter.coreLogic.processRequest = vi.fn().mockResolvedValue({
                reqResponse: 'NO_MATCH'
            });

            global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));
            mockAbstractionHelper.abstractRequest.getNewURL.mockReturnValue(new URL('https://example.com/test'));

            const response = await adapter.fetchHandler(request, env, ctx);
            expect(response.status).toBe(500);
            expect(mockLogger.error).toHaveBeenCalled();
        });

        it('should handle invalid CDN settings', async () => {
            const request = new Request('https://example.com/test', { method: 'GET' });
            const env = { ENVIRONMENT: 'test' };
            const ctx = { waitUntil: vi.fn() };
            const mockResponse = new Response('test');

            mockAbstractionHelper.abstractRequest.getNewURL.mockReturnValue(new URL('https://example.com/test'));
            mockCoreLogic.processRequest.mockResolvedValue({ 
                reqResponse: mockResponse,
                cdnExperimentSettings: undefined
            });
            global.fetch.mockResolvedValue(mockResponse);

            const response = await adapter.fetchHandler(request, env, ctx);
            expect(response).toBeDefined();
            expect(mockLogger.debug).toHaveBeenCalledWith('Origin URL [fetchHandler]: https://example.com/test');
            expect(mockLogger.debug).toHaveBeenCalledWith('CDN settings are undefined or invalid');
        });
    });

    describe('Event Listeners', () => {
        it('should handle complete event lifecycle', async () => {
            const request = new Request('https://example.com/test');
            const env = { ENVIRONMENT: 'test' };
            const ctx = { waitUntil: vi.fn() };
            const modifiedRequest = new Request('https://example.com/modified');
            const modifiedResponse = new Response('modified');

            adapter.eventListeners.trigger = vi.fn().mockImplementation((event) => {
                switch(event) {
                    case 'beforeProcessingRequest':
                        return Promise.resolve({ modifiedRequest });
                    case 'afterProcessingRequest':
                        return Promise.resolve({ modifiedResponse });
                    case 'beforeResponse':
                        return Promise.resolve({});
                    default:
                        return Promise.resolve({});
                }
            });

            adapter.coreLogic.processRequest = vi.fn().mockResolvedValue({
                reqResponse: new Response('test'),
                reqResponseObjectType: 'response',
                cdnExperimentSettings: {
                    cdnResponseURL: 'https://example.com/cdn',
                    cacheRequestToOrigin: false,
                    forwardToOrigin: true
                }
            });

            mockAbstractionHelper.abstractRequest.getNewURL.mockReturnValue(new URL('https://example.com/cdn'));
            adapter.fetchFromOriginOrCDN = vi.fn().mockResolvedValue(new Response('cdn response'));

            const response = await adapter.fetchHandler(request, env, ctx);
            expect(response).toBeDefined();
            expect(adapter.eventListeners.trigger).toHaveBeenCalledWith('beforeProcessingRequest', request, adapter.coreLogic.requestConfig);
            expect(adapter.eventListeners.trigger).toHaveBeenCalledWith('afterProcessingRequest', request, expect.any(Response), adapter.coreLogic.requestConfig, expect.any(Object));
            expect(adapter.eventListeners.trigger).toHaveBeenCalledWith('beforeResponse', request, expect.any(Response), expect.any(Object));
        });
    });

    describe('CDN Settings', () => {
        it('should handle valid CDN settings with caching', async () => {
            const request = new Request('https://example.com/test', { method: 'GET' });
            const env = { ENVIRONMENT: 'test' };
            const ctx = { waitUntil: vi.fn() };
            const mockResponse = new Response('test');

            mockAbstractionHelper.abstractRequest.getNewURL.mockReturnValue(new URL('https://example.com/test'));
            mockCoreLogic.processRequest.mockResolvedValue({
                reqResponse: mockResponse,
                cdnExperimentSettings: {
                    cdnResponseURL: 'https://cdn.example.com/test',
                    cacheRequestToOrigin: true
                }
            });
            global.fetch.mockResolvedValue(mockResponse);

            const response = await adapter.fetchHandler(request, env, ctx);
            expect(response).toBeDefined();
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('CDN settings found [fetchHandler]'));
        });

        it('should not cache response when cacheRequestToOrigin is false', async () => {
            const request = new Request('https://example.com/test', { method: 'GET' });
            const env = { ENVIRONMENT: 'test' };
            const ctx = { waitUntil: vi.fn() };
            const mockResponse = new Response('test');

            mockAbstractionHelper.abstractRequest.getNewURL.mockReturnValue(new URL('https://example.com/test'));
            mockCoreLogic.processRequest.mockResolvedValue({
                reqResponse: mockResponse,
                cdnExperimentSettings: {
                    cdnResponseURL: 'https://cdn.example.com/test',
                    cacheRequestToOrigin: false
                }
            });
            global.fetch.mockResolvedValue(mockResponse);

            const response = await adapter.fetchHandler(request, env, ctx);
            expect(response).toBeDefined();
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('CDN settings found [fetchHandler] - shouldCacheResponse: false'));
        });
    });
});
