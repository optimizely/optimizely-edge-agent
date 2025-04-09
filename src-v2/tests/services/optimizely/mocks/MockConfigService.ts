import { IConfigService, OptimizelyDatafile } from '../../../../services/interfaces/IConfigService';
import { vi } from 'vitest';

/**
 * Mock implementation of IConfigService for testing
 */
export class MockConfigService implements IConfigService {
  public getDatafileMock = vi.fn();
  public getOptimizelyConfigMock = vi.fn();
  public initializeMock = vi.fn();
  
  // Store sample datafiles for different SDK keys
  private datafiles: Record<string, any> = {};

  constructor() {
    this.getDatafile = this.getDatafile.bind(this);
    
    // Setup a default mock implementation that returns datafiles from our store
    this.getDatafileMock.mockImplementation((sdkKey: string) => {
      return Promise.resolve(this.datafiles[sdkKey] || null);
    });

    // Setup default implementation for getOptimizelyConfig
    this.getOptimizelyConfigMock.mockImplementation(() => {
      return Promise.resolve(null);
    });

    // Setup default implementation for initialize
    this.initializeMock.mockResolvedValue(true);
  }

  /**
   * Implementation of the getDatafile method
   */
  async getDatafile(sdkKey: string): Promise<any> {
    return this.getDatafileMock(sdkKey);
  }

  /**
   * Implementation of the getOptimizelyConfig method
   */
  async getOptimizelyConfig(): Promise<OptimizelyDatafile | null> {
    return this.getOptimizelyConfigMock();
  }

  /**
   * Implementation of the initialize method
   */
  async initialize(): Promise<boolean> {
    return this.initializeMock();
  }

  /**
   * Returns the Edge Agent version
   */
  getEdgeAgentVersion(): string {
    return '2.0.0';
  }

  /**
   * Returns the current environment
   */
  getEnvironment(): string {
    return 'test';
  }

  /**
   * Returns the CDN provider
   */
  getCdnProvider(): string {
    return 'cloudflare';
  }

  /**
   * Returns the admin token
   */
  getAdminToken(): string {
    return 'mock-admin-token';
  }

  /**
   * Sets up a mock datafile to be returned for a specific SDK key
   */
  setupDatafile(sdkKey: string, datafile: any): void {
    this.datafiles[sdkKey] = datafile;
  }

  /**
   * Clears a specific mock datafile
   */
  clearDatafile(sdkKey: string): void {
    delete this.datafiles[sdkKey];
  }

  /**
   * Clears all mock datafiles and resets mock counters
   */
  reset(): void {
    this.datafiles = {};
    this.getDatafileMock.mockClear();
    this.getOptimizelyConfigMock.mockClear();
    this.initializeMock.mockClear();
  }
  
  /**
   * Setup a mock datafile with common configuration
   */
  setupDefaultDatafile(sdkKey: string, options: {
    revision?: string;
    featureFlags?: Array<{
      id: string;
      key: string;
      rolloutId?: string;
      experimentIds?: string[];
      variables?: Array<{
        id: string;
        key: string;
        type: string;
        defaultValue: string;
      }>;
    }>;
  } = {}): void {
    this.datafiles[sdkKey] = {
      revision: options.revision || '123',
      version: '4',
      sdkKey,
      anonymizeIP: true,
      projectId: 'test-project',
      featureFlags: options.featureFlags || [
        {
          id: 'flag-1',
          key: 'test-flag',
          rolloutId: 'rollout-1',
          experimentIds: [],
          variables: [
            {
              id: 'var-1',
              key: 'test-variable',
              type: 'string',
              defaultValue: 'default'
            }
          ]
        }
      ],
      experiments: [],
      audiences: [],
      groups: [],
      attributes: [],
      events: []
    };
  }
} 