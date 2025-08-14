// Test if we can fetch the Pages URL through the worker
const baseUrl = 'http://localhost:8787';

async function testDirectFetch() {
    console.log('🧪 Testing Direct Fetch Through Worker\n');
    
    // Test if the worker can fetch the Pages URL
    try {
        // Create a test endpoint that will fetch the Pages URL
        const testBody = {
            url: 'https://edge-agent-demo-simone-tutorial.pages.dev/login-2.html'
        };
        
        const response = await fetch(`${baseUrl}/api/debug`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Optimizely-Enable-FEX': 'true',
                'X-Optimizely-Admin-Token': 'dev-admin-token'
            },
            body: JSON.stringify(testBody)
        });
        
        const result = await response.text();
        console.log('Debug endpoint response:', result);
        
    } catch (error) {
        console.error('Failed to test direct fetch:', error.message);
    }
    
    // Now let's test Edge Mode again with more detailed info
    console.log('\n\n🔍 Testing Edge Mode with Forced Variation:\n');
    
    try {
        const edgeResponse = await fetch(`${baseUrl}/login-2.html`, {
            headers: {
                'X-Optimizely-Enable-FEX': 'true',
                'X-Optimizely-SDK-Key': '8mR1pGh8u2ztUP8GqjmQq',
                'X-Optimizely-Visitor-ID': 'test-fetch-visitor',
                'X-Optimizely-Forced-Decisions': JSON.stringify({
                    'test-flag': { variationKey: 'control' }
                })
            }
        });
        
        console.log('Status:', edgeResponse.status);
        console.log('Headers:');
        ['x-optimizely-decision-variation-key', 'x-edge-cache', 'content-type'].forEach(header => {
            const value = edgeResponse.headers.get(header);
            if (value) console.log(`  ${header}: ${value}`);
        });
        
        const body = await edgeResponse.text();
        if (body.includes('DNS points to prohibited IP')) {
            console.log('\n❌ Still getting DNS error\n');
            console.log('First 300 chars of error page:');
            console.log(body.substring(0, 300));
        } else {
            console.log('\n✅ Got actual content!\n');
            console.log('Content preview:', body.substring(0, 200));
        }
        
    } catch (error) {
        console.error('Edge Mode request failed:', error.message);
    }
}

testDirectFetch();