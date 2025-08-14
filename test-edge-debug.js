// Test Edge Mode with detailed debugging
const baseUrl = 'http://localhost:8787';

async function testEdgeDebug() {
    console.log('🔍 Edge Mode Detailed Debug\n');
    
    // First check the config to see what's configured
    try {
        const configRes = await fetch(`${baseUrl}/api/config?sdkKey=8mR1pGh8u2ztUP8GqjmQq`, {
            headers: {
                'X-Optimizely-Enable-FEX': 'true',
                'X-Optimizely-Admin-Token': 'dev-admin-token'
            }
        });
        
        const config = await configRes.json();
        
        // Find test-flag configuration
        const testFlag = config.features?.['test-flag'];
        if (testFlag?.experimentsMap?.test_flag_experiment) {
            const variations = testFlag.experimentsMap.test_flag_experiment.variationsMap;
            console.log('📋 test-flag variations:');
            Object.entries(variations).forEach(([key, variation]) => {
                const cdnSettings = variation.variablesMap?.cdnVariationSettings?.value;
                if (cdnSettings) {
                    try {
                        const parsed = JSON.parse(cdnSettings);
                        console.log(`\n${key}:`);
                        console.log(`  cdnExperimentURL: ${parsed.cdnExperimentURL}`);
                        console.log(`  cdnResponseURL: ${parsed.cdnResponseURL}`);
                    } catch (e) {
                        console.log(`  cdnVariationSettings: ${cdnSettings}`);
                    }
                }
            });
        }
    } catch (error) {
        console.error('Failed to get config:', error.message);
    }
    
    // Now test edge mode with different approaches
    console.log('\n\n🧪 Testing Edge Mode Request:\n');
    
    // Test 1: Direct request
    console.log('Test 1: Direct request to /login-2.html');
    try {
        const res1 = await fetch(`${baseUrl}/login-2.html`, {
            headers: {
                'X-Optimizely-Enable-FEX': 'true',
                'X-Optimizely-SDK-Key': '8mR1pGh8u2ztUP8GqjmQq',
                'X-Optimizely-Visitor-ID': 'debug-visitor-1'
            }
        });
        
        console.log('Status:', res1.status);
        console.log('Edge decisions header:', res1.headers.get('x-optimizely-edge-decisions') ? 'Present' : 'Missing');
        
        const body = await res1.text();
        if (body.includes('DNS points to prohibited IP')) {
            console.log('❌ Still getting Cloudflare DNS error');
        } else if (body.includes('signup-1.html') || body.includes('signup-2.html')) {
            console.log('✅ Got actual content!');
        }
    } catch (error) {
        console.error('Request failed:', error.message);
    }
    
    // Test 2: Try with a forced variation
    console.log('\n\nTest 2: With forced variation to "on"');
    try {
        const res2 = await fetch(`${baseUrl}/login-2.html`, {
            headers: {
                'X-Optimizely-Enable-FEX': 'true',
                'X-Optimizely-SDK-Key': '8mR1pGh8u2ztUP8GqjmQq',
                'X-Optimizely-Visitor-ID': 'debug-visitor-2',
                'X-Optimizely-Forced-Decisions': JSON.stringify({
                    'test-flag': { variationKey: 'on' }
                })
            }
        });
        
        console.log('Status:', res2.status);
        const body = await res2.text();
        if (body.includes('signup-1.html')) {
            console.log('✅ Got variation "on" content (signup-1)');
        } else if (body.includes('signup-2.html')) {
            console.log('✅ Got variation "control" content (signup-2)');
        } else if (body.includes('DNS points to prohibited IP')) {
            console.log('❌ Still getting Cloudflare DNS error');
        }
    } catch (error) {
        console.error('Request failed:', error.message);
    }
    
    // Test 3: Check if we can access the Pages URL directly
    console.log('\n\nTest 3: Direct fetch to Cloudflare Pages URL');
    try {
        const res3 = await fetch('https://edge-agent-demo-simone-tutorial.pages.dev/login-2.html');
        console.log('Pages URL Status:', res3.status);
        const text = await res3.text();
        console.log('Content preview:', text.substring(0, 200) + '...');
    } catch (error) {
        console.error('Pages fetch failed:', error.message);
    }
}

testEdgeDebug().catch(console.error);