// Test Edge Mode on Cloudflare
const baseUrl = 'http://localhost:8787';

async function testEdgeMode() {
    console.log('🧪 Testing Edge Mode on Cloudflare Workers\n');

    // Test 1: Check if Edge Mode is enabled
    try {
        const response = await fetch(`${baseUrl}/login-2.html`, {
            headers: {
                'X-Optimizely-Enable-FEX': 'true',
                'X-Optimizely-SDK-Key': '8mR1pGh8u2ztUP8GqjmQq',
                'X-Optimizely-Visitor-ID': 'visitor-cloudflare-test-1'
            }
        });

        console.log('📍 Test 1: Edge Mode Request');
        console.log(`Status: ${response.status}`);
        console.log(`Headers:`, Object.fromEntries(response.headers.entries()));
        
        const text = await response.text();
        console.log(`\nContent Preview: ${text.substring(0, 200)}...`);
        
        // Check for decision headers
        const decisionHeaders = [
            'x-optimizely-decision-flag-key',
            'x-optimizely-decision-variation-key',
            'x-optimizely-decision-enabled',
            'x-optimizely-decision-rule-key'
        ];
        
        console.log('\n🔍 Decision Headers:');
        decisionHeaders.forEach(header => {
            const value = response.headers.get(header);
            if (value) {
                console.log(`  ${header}: ${value}`);
            }
        });

    } catch (error) {
        console.error('❌ Error testing Edge Mode:', error.message);
    }

    // Test 2: Test with different visitors to see variation bucketing
    console.log('\n\n📊 Testing Multiple Visitors for Variation Distribution:\n');
    
    const visitors = [
        'cloudflare-visitor-1',
        'cloudflare-visitor-2', 
        'cloudflare-visitor-3',
        'cloudflare-visitor-4',
        'cloudflare-visitor-5'
    ];

    for (const visitorId of visitors) {
        try {
            const response = await fetch(`${baseUrl}/login-2.html`, {
                headers: {
                    'X-Optimizely-Enable-FEX': 'true',
                    'X-Optimizely-SDK-Key': '8mR1pGh8u2ztUP8GqjmQq',
                    'X-Optimizely-Visitor-ID': visitorId
                }
            });

            const variation = response.headers.get('x-optimizely-decision-variation-key');
            const content = await response.text();
            const contentType = content.includes('signup-1.html') ? 'Alternative (signup-1)' : 'Original (signup-2)';
            
            console.log(`Visitor ${visitorId}: ${variation} → ${contentType}`);
            
        } catch (error) {
            console.error(`❌ Error for ${visitorId}:`, error.message);
        }
    }

    // Test 3: Check API endpoints are working
    console.log('\n\n🔌 Testing API Endpoints:\n');
    
    const apiTests = [
        { path: '/api/sdk', headers: { 'X-Optimizely-SDK-Key': '8mR1pGh8u2ztUP8GqjmQq', 'X-Optimizely-Enable-FEX': 'true' } },
        { path: '/api/decide', method: 'POST', body: { userId: 'test-user', flagKey: 'test-flag' } },
        { path: '/api/health', headers: {} }
    ];

    for (const test of apiTests) {
        try {
            const options = {
                method: test.method || 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Optimizely-Enable-FEX': 'true',
                    ...test.headers
                }
            };
            
            if (test.body) {
                options.body = JSON.stringify(test.body);
            }

            const response = await fetch(`${baseUrl}${test.path}`, options);
            const data = await response.text();
            
            console.log(`${test.path}: ${response.status} - ${data.substring(0, 100)}...`);
            
        } catch (error) {
            console.error(`❌ ${test.path}: ${error.message}`);
        }
    }
}

// Run the tests
testEdgeMode().catch(console.error);