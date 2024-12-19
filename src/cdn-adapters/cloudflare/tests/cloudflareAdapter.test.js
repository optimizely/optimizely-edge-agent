import { describe, it, expect, vi, beforeEach } from 'vitest';
import CloudflareAdapter from '../cloudflareAdapter';

// Mock EventListeners
vi.mock('../../../_helpers_/eventListeners', () => ({
    default: {
        getInstance: vi.fn().mockReturnValue({
            emit: vi.fn(),
            on: vi.fn(),
            removeListener: vi.fn(),
            trigger: vi.fn()
        })
    }
}));

// Mock cookieDefaultOptions
const cookieDefaultOptions = {
    path: '/',
    expires: new Date(Date.now() + 86400e3 * 365),
    maxAge: 86400 * 365,
    domain: 'apidev.expedge.com',
    secure: true,
    httpOnly: true,
    sameSite: 'none'
};

// Mock dependencies
const mockLogger = {
    debug: vi.fn(),
    debugExt: vi.fn(),
    error: vi.fn()
};

const mockCoreLogic = {
    determineVariation: vi.fn()
};

const mockOptimizelyProvider = {
    // Add mock implementation as needed
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

// Mock Response and Request globally
global.Response = class Response {
    constructor(body, init) {
        this.body = body;
        this.headers = new Map();
        this.status = (init && init.status) || 200;
        this.ok = this.status >= 200 && this.status < 300;
        this.text = async () => this.body;
    }
    
    clone() {
        return new Response(this.body, { status: this.status });
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

describe('CloudflareAdapter', () => {
    let adapter;

    beforeEach(() => {
        // Reset all mocks before each test
        vi.clearAllMocks();
        
        // Reset global fetch mock
        global.fetch = vi.fn();
        
        adapter = new CloudflareAdapter(
            mockCoreLogic,
            mockOptimizelyProvider,
            'test-sdk-key',
            mockAbstractionHelper,
            mockKvStore,
            mockKvStore,
            mockLogger,
            'https://test.pages.url'
        );
    });

    describe('fetchHandler', () => {
        it('should handle GET requests with caching', async () => {
            const request = new Request('https://test.com/test-endpoint', { method: 'GET' });
            const env = { ENVIRONMENT: 'test' };
            const ctx = { waitUntil: vi.fn() };

            mockAbstractionHelper.abstractRequest.getNewURL.mockReturnValue(new URL('https://test.com/test-endpoint'));
            mockAbstractionHelper.abstractRequest.createNewRequestFromUrl.mockReturnValue(request);
            global.fetch = vi.fn().mockResolvedValue(new Response('test'));

            const response = await adapter.fetchHandler(request, env, ctx);
            expect(response).toBeDefined();
        });

        it('should handle POST requests without caching', async () => {
            const request = new Request('https://test.com/test-endpoint', { method: 'POST' });
            const env = { ENVIRONMENT: 'test' };
            const ctx = { waitUntil: vi.fn() };

            global.fetch = vi.fn().mockResolvedValue(new Response('test'));
            const response = await adapter.fetchHandler(request, env, ctx);
            expect(response).toBeDefined();
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
                const request = new Request('https://test.com');
                const cookies = {
                    session: { value: '12345', options: { path: '/' } },
                    user: { value: 'john', options: { secure: true } }
                };

                mockLogger.debugExt.mockImplementation(() => {});
                mockAbstractionHelper.abstractRequest.getHeaderFromRequest.mockReturnValue('');
                mockAbstractionHelper.abstractRequest.setHeaderFromRequest.mockReturnValue(request);
                mockAbstractionHelper.abstractRequest.cloneRequest.mockReturnValue(request);
                
                const result = adapter.setMultipleRequestCookies(request, cookies);
                expect(result).toBeDefined();
                expect(mockAbstractionHelper.abstractRequest.setHeaderFromRequest).toHaveBeenCalled();
            });
        });
    });

    describe('Header Management', () => {
        describe('setMultipleResponseHeaders', () => {
            it('should set multiple headers correctly', () => {
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
    });

    describe('Cache Management', () => {
        describe('createCacheKey', () => {
            it('should generate correct cache key with variation', () => {
                const request = new Request('https://test.com/test');
                const env = { ENVIRONMENT: 'test' };
                
                mockLogger.debugExt.mockImplementation(() => {});
                mockCoreLogic.determineVariation.mockReturnValue('variant-a');
                mockAbstractionHelper.abstractRequest.getNewURL
                    .mockReturnValue(new URL('https://test.com/test'));

                adapter.createCacheKey(request, env);
                expect(mockAbstractionHelper.abstractRequest.createNewRequestFromUrl)
                    .toHaveBeenCalled();
            });
        });
    });

    describe('Data Management', () => {
        describe('getDatafile', () => {
            it('should fetch datafile with correct TTL', async () => {
                const mockResponseData = JSON.stringify({ version: '1' });
                const mockResponse = new Response(mockResponseData, {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
                global.fetch = vi.fn().mockResolvedValue(mockResponse);

                mockLogger.debugExt.mockImplementation(() => {});
                const result = await adapter.getDatafile('test-sdk-key', 3600);
                expect(result).toBe(mockResponseData);
            });

            it('should handle fetch errors gracefully', async () => {
                global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
                mockLogger.error.mockImplementation(() => {});

                await expect(adapter.getDatafile('test-sdk-key'))
                    .rejects.toThrow('Error fetching datafile');
            });
        });
    });

    describe('Event Handling', () => {
        describe('dispatchEventToOptimizely', () => {
            it('should dispatch events correctly', async () => {
                const eventData = {
                    url: 'https://logx.optimizely.com/v1/events',
                    params: { 
                        visitors: [{ id: '1' }]
                    }
                };

                mockLogger.debugExt.mockImplementation(() => {});
                await adapter.dispatchEventToOptimizely(eventData);
                expect(adapter.eventQueue).toHaveLength(1);
            });
        });

        describe('consolidateVisitorsInEvents', () => {
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
});
