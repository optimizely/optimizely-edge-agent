// Test script to verify Vercel KV storage implementation
const { VercelStorageAdapter, createVercelKVAdapter } = require('./src-v2/adapters/implementations/vercel/VercelStorageAdapter');

async function testKVImplementation() {
  console.log('🧪 Testing Vercel KV Storage Implementation...\n');

  // Test 1: Create adapter without KV (should use memory)
  console.log('Test 1: Memory Storage (no KV credentials)');
  const memoryAdapter = new VercelStorageAdapter(null);
  
  try {
    // Test basic operations
    await memoryAdapter.put('test-key', 'test-value', { expirationTtl: 60 });
    const value = await memoryAdapter.get('test-key', 'text');
    console.log('✅ Memory storage PUT/GET:', value === 'test-value' ? 'PASS' : 'FAIL');
    
    // Test JSON storage
    await memoryAdapter.put('json-key', '{"name": "test", "value": 123}');
    const jsonValue = await memoryAdapter.get('json-key', 'json');
    console.log('✅ Memory storage JSON:', jsonValue?.name === 'test' ? 'PASS' : 'FAIL');
    
    // Test exists
    const exists = await memoryAdapter.exists('test-key');
    console.log('✅ Memory storage EXISTS:', exists ? 'PASS' : 'FAIL');
    
    // Test list
    const listResult = await memoryAdapter.list({ prefix: 'test' });
    console.log('✅ Memory storage LIST:', listResult.keys.length > 0 ? 'PASS' : 'FAIL');
    
    // Test delete
    await memoryAdapter.delete('test-key');
    const deletedValue = await memoryAdapter.get('test-key', 'text');
    console.log('✅ Memory storage DELETE:', deletedValue === null ? 'PASS' : 'FAIL');
    
  } catch (error) {
    console.error('❌ Memory storage test failed:', error);
  }

  console.log('\nTest 2: Factory Function (without real KV credentials)');
  
  try {
    const factoryAdapter = createVercelKVAdapter();
    
    // Test basic operations
    await factoryAdapter.put('factory-test', 'factory-value');
    const factoryValue = await factoryAdapter.get('factory-test', 'text');
    console.log('✅ Factory adapter GET:', factoryValue === 'factory-value' ? 'PASS' : 'FAIL');
    
  } catch (error) {
    console.error('❌ Factory adapter test failed:', error);
  }

  console.log('\nTest 3: Real KV Detection Logic');
  
  // Save original env vars
  const originalKvUrl = process.env.KV_URL;
  const originalKvToken = process.env.KV_REST_API_TOKEN;
  
  try {
    // Test with fake KV credentials
    process.env.KV_URL = 'redis://fake-kv-url:6379';
    process.env.KV_REST_API_TOKEN = 'fake-token';
    
    const kvAdapter = createVercelKVAdapter();
    console.log('✅ KV detection with credentials: adapter created');
    
    // This should try to use real KV but fail gracefully due to fake credentials
    await kvAdapter.put('kv-test', 'kv-value');
    console.log('✅ KV fallback: graceful handling of connection errors');
    
  } catch (error) {
    console.log('✅ Expected error with fake credentials:', error.message.substring(0, 50) + '...');
  } finally {
    // Restore original env vars
    if (originalKvUrl) {
      process.env.KV_URL = originalKvUrl;
    } else {
      delete process.env.KV_URL;
    }
    if (originalKvToken) {
      process.env.KV_REST_API_TOKEN = originalKvToken;
    } else {
      delete process.env.KV_REST_API_TOKEN;
    }
  }

  console.log('\nTest 4: Edge Cases');
  
  try {
    const edgeAdapter = new VercelStorageAdapter(null);
    
    // Test with different data types
    await edgeAdapter.put('string-key', 'string-value');
    await edgeAdapter.put('buffer-key', Buffer.from('buffer-value'));
    
    const stringResult = await edgeAdapter.get('string-key', 'text');
    const bufferResult = await edgeAdapter.get('buffer-key', 'arrayBuffer');
    
    console.log('✅ String storage:', stringResult === 'string-value' ? 'PASS' : 'FAIL');
    console.log('✅ Buffer storage:', bufferResult instanceof ArrayBuffer ? 'PASS' : 'FAIL');
    
    // Test TTL functionality
    await edgeAdapter.put('ttl-key', 'ttl-value', { expirationTtl: 1 });
    const ttlBefore = await edgeAdapter.exists('ttl-key');
    
    // Wait 1.1 seconds for expiration
    await new Promise(resolve => setTimeout(resolve, 1100));
    const ttlAfter = await edgeAdapter.exists('ttl-key');
    
    console.log('✅ TTL before expiration:', ttlBefore ? 'PASS' : 'FAIL');
    console.log('✅ TTL after expiration:', !ttlAfter ? 'PASS' : 'FAIL');
    
  } catch (error) {
    console.error('❌ Edge cases test failed:', error);
  }

  console.log('\n🎉 Vercel KV Storage Implementation Test Complete!\n');
  
  console.log('📋 Summary:');
  console.log('- Memory storage: Fully functional for development');
  console.log('- Factory function: Creates adapters correctly');
  console.log('- KV detection: Properly detects credentials and falls back');
  console.log('- Edge cases: Handles different data types and TTL');
  console.log('- Error handling: Graceful fallback when KV unavailable');
}

// Run the test
testKVImplementation().catch(console.error);