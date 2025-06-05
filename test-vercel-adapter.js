#!/usr/bin/env node

/**
 * Test script for Vercel adapter implementation
 * This script tests the metrics adapters and basic functionality
 */

console.log('🚀 Testing Vercel Adapter Implementation...\n');

// Test environment variables
const testEnv = {
  // Metrics configuration
  OPTIMIZELY_METRICS_ENABLED: 'true',
  OPTIMIZELY_METRICS_PREFIX: 'test_optly',
  OPTIMIZELY_METRICS_SAMPLING_RATE: '1.0',
  OPTIMIZELY_METRICS_MAX_DIMENSIONS: '10',
  OPTIMIZELY_METRICS_ENABLE_HISTOGRAMS: 'true',
  OPTIMIZELY_METRICS_GLOBAL_DIMENSIONS: JSON.stringify({
    environment: 'test',
    region: 'local'
  }),
  
  // Metrics provider selection
  METRICS_PROVIDER: 'prometheus', // Change to 'datadog' or 'newrelic' to test others
  
  // Provider-specific config
  PROMETHEUS_PUSH_GATEWAY_URL: 'http://localhost:9091',
  PROMETHEUS_JOB_NAME: 'test_edge_agent',
  
  // DataDog config (commented out, uncomment to test)
  // DD_API_KEY: 'test-api-key',
  // DD_SITE: 'datadoghq.com',
  // DD_ENV: 'test',
  // DD_SERVICE: 'optimizely-edge-agent-test',
  
  // New Relic config (commented out, uncomment to test)
  // NEW_RELIC_LICENSE_KEY: 'test-license-key',
  // NEW_RELIC_REGION: 'US',
  // NEW_RELIC_APP_NAME: 'optimizely-edge-agent-test',
  
  // Logging
  LOG_LEVEL: 'debug'
};

// Set test environment variables
Object.assign(process.env, testEnv);

async function testMetricsAdapters() {
  console.log('📊 Testing Metrics Adapters...\n');
  
  try {
    // Mock Vercel environment for testing
    const mockVercelEnv = {
      getVariable: (key) => process.env[key] || '',
      fetch: async (url, options) => {
        console.log(`[MockFetch] ${options?.method || 'GET'} ${url}`);
        console.log(`[MockFetch] Headers:`, options?.headers);
        if (options?.body) {
          const bodyStr = options.body instanceof ArrayBuffer 
            ? new TextDecoder().decode(options.body)
            : options.body.toString();
          console.log(`[MockFetch] Body (first 200 chars):`, bodyStr.substring(0, 200));
        }
        
        // Mock successful response
        return {
          ok: true,
          status: 200,
          text: async () => 'OK',
          json: async () => ({ success: true })
        };
      }
    };

    const mockLogger = {
      trace: (...args) => console.log('[TRACE]', ...args),
      debug: (...args) => console.log('[DEBUG]', ...args),
      info: (...args) => console.log('[INFO]', ...args),
      warn: (...args) => console.warn('[WARN]', ...args),
      error: (...args) => console.error('[ERROR]', ...args),
      fatal: (...args) => console.error('[FATAL]', ...args),
      child: () => mockLogger,
      startTimer: () => ({ stop: () => 100 })
    };

    // Test each metrics adapter
    const { PrometheusMetricsAdapter } = await import('./src-v2/adapters/implementations/metrics/PrometheusMetricsAdapter.js');
    const { DataDogMetricsAdapter } = await import('./src-v2/adapters/implementations/metrics/DataDogMetricsAdapter.js');
    const { NewRelicMetricsAdapter } = await import('./src-v2/adapters/implementations/metrics/NewRelicMetricsAdapter.js');

    console.log('✅ Successfully imported all metrics adapters');

    // Test creating adapters
    console.log('\n🏗️  Testing adapter creation...');
    
    const prometheusAdapter = new PrometheusMetricsAdapter(mockLogger, mockVercelEnv);
    console.log('✅ PrometheusMetricsAdapter created');
    
    // Test metrics collection
    console.log('\n📈 Testing metrics collection...');
    
    prometheusAdapter.incrementCounter('test.requests', 5, { endpoint: '/api/test' });
    prometheusAdapter.setGauge('test.cpu_usage', 75.5, { instance: 'edge-1' });
    prometheusAdapter.recordHistogram('test.response_time', 125, { method: 'GET' });
    
    const timer = prometheusAdapter.startTimer('test.operation_duration', { operation: 'test' });
    setTimeout(() => {
      timer.stop();
      console.log('✅ Timer stopped');
    }, 100);
    
    console.log('✅ Metrics recorded successfully');
    
    // Test flushing
    console.log('\n🚀 Testing metrics flush...');
    await prometheusAdapter.flush();
    console.log('✅ Metrics flushed successfully');

  } catch (error) {
    console.error('❌ Error testing metrics adapters:', error);
    console.error('Stack:', error.stack);
  }
}

async function testVercelFactory() {
  console.log('\n🏭 Testing VercelAdapterFactory...\n');
  
  try {
    const { VercelAdapterFactory } = await import('./src-v2/adapters/factories/VercelAdapterFactory.js');
    
    // Mock factory inputs
    const mockInputs = {
      request: new Request('https://example.com/api/test'),
      env: {
        getVariable: (key) => process.env[key] || '',
        fetch: global.fetch
      },
      ctx: {
        waitUntil: (promise) => promise
      }
    };
    
    const factory = new VercelAdapterFactory(mockInputs);
    console.log('✅ VercelAdapterFactory created');
    
    // Test creating adapters
    const envAdapter = factory.createEnvironmentAdapter();
    const loggerAdapter = factory.createLoggerAdapter();
    const requestAdapter = factory.createRequestAdapter();
    const responseAdapter = factory.createResponseAdapter();
    const metricsAdapter = factory.createMetricsAdapter();
    
    console.log('✅ Environment adapter created');
    console.log('✅ Logger adapter created');
    console.log('✅ Request adapter created'); 
    console.log('✅ Response adapter created');
    
    if (metricsAdapter) {
      console.log('✅ Metrics adapter created:', metricsAdapter.constructor.name);
    } else {
      console.log('ℹ️  No metrics adapter (expected if METRICS_PROVIDER not set)');
    }
    
  } catch (error) {
    console.error('❌ Error testing VercelAdapterFactory:', error);
    console.error('Stack:', error.stack);
  }
}

async function testStorageAdapter() {
  console.log('\n💾 Testing VercelStorageAdapter...\n');
  
  try {
    const { createVercelKVAdapter } = await import('./src-v2/adapters/implementations/vercel/VercelStorageAdapter.js');
    
    const storageAdapter = createVercelKVAdapter();
    console.log('✅ VercelStorageAdapter created');
    
    // Test storage operations
    await storageAdapter.put('test:key1', 'test value', { expirationTtl: 3600 });
    console.log('✅ PUT operation completed');
    
    const value = await storageAdapter.get('test:key1', 'text');
    console.log('✅ GET operation completed, value:', value);
    
    await storageAdapter.delete('test:key1');
    console.log('✅ DELETE operation completed');
    
    const listResult = await storageAdapter.list({ prefix: 'test:', limit: 10 });
    console.log('✅ LIST operation completed, result:', listResult);
    
  } catch (error) {
    console.error('❌ Error testing VercelStorageAdapter:', error);
    console.error('Stack:', error.stack);
  }
}

async function runTests() {
  console.log('🧪 Starting Vercel Adapter Tests\n');
  console.log('Environment:', Object.keys(testEnv).map(key => `${key}=${testEnv[key]}`).join('\n'));
  console.log('\n' + '='.repeat(60) + '\n');
  
  await testMetricsAdapters();
  await testVercelFactory();
  await testStorageAdapter();
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ All tests completed!\n');
  
  console.log('📋 Next Steps:');
  console.log('1. Set up real Vercel KV in your Vercel project');
  console.log('2. Configure environment variables in Vercel dashboard');
  console.log('3. Deploy to Vercel Edge Functions');
  console.log('4. Test with real requests\n');
  
  console.log('🔧 To deploy:');
  console.log('   vercel --prod\n');
}

// Handle errors gracefully
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

// Run the tests
runTests().catch((error) => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});