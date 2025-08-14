// Simple test to see what's happening with Edge Mode on Cloudflare
const baseUrl = 'http://localhost:8787';

async function testSimple() {
    console.log('Testing Cloudflare Edge Mode...\n');
    
    // First, check if we can get the config
    const configResponse = await fetch(`${baseUrl}/api/config?sdkKey=8mR1pGh8u2ztUP8GqjmQq`, {
        headers: {
            'X-Optimizely-Enable-FEX': 'true',
            'X-Optimizely-Admin-Token': 'dev-admin-token'
        }
    });
    
    const config = await configResponse.json();
    console.log('Config mode:', config.mode || 'Not found');
    console.log('Features with cdnVariationSettings:', 
        Object.entries(config.features || {})
            .filter(([key, feature]) => feature.variablesMap?.cdnVariationSettings)
            .map(([key]) => key)
    );
    
    // Now test the actual edge request
    console.log('\n\nTesting Edge request to /login-2.html:');
    
    const response = await fetch(`${baseUrl}/login-2.html`, {
        headers: {
            'X-Optimizely-Enable-FEX': 'true',
            'X-Optimizely-SDK-Key': '8mR1pGh8u2ztUP8GqjmQq',
            'X-Optimizely-Visitor-ID': 'test-visitor-1'
        }
    });
    
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    
    // Check for key headers
    const importantHeaders = [
        'content-type',
        'x-optimizely-implementation-version',
        'x-optimizely-edge-decisions',
        'x-optimizely-decision-flag-key',
        'x-optimizely-decision-variation-key'
    ];
    
    console.log('\nHeaders:');
    importantHeaders.forEach(header => {
        const value = response.headers.get(header);
        if (value) {
            console.log(`  ${header}: ${value.substring(0, 100)}${value.length > 100 ? '...' : ''}`);
        }
    });
    
    // Get first 500 chars of response
    const text = await response.text();
    console.log('\nResponse body preview:');
    console.log(text.substring(0, 500) + '...');
    
    // Check if this looks like a Cloudflare error page
    if (text.includes('Cloudflare') && text.includes('403')) {
        console.log('\n⚠️  This appears to be a Cloudflare error page, not Edge Mode content');
    }
}

testSimple().catch(console.error);