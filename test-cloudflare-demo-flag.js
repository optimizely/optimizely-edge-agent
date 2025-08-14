// Test the cloudflare_demo_flag with expedge.com URLs
const baseUrl = 'http://localhost:8787';

async function testCloudflareFlag() {
    console.log('🧪 Testing cloudflare_demo_flag with expedge.com\n');
    
    // First, let's verify the flag configuration
    try {
        const configRes = await fetch(`${baseUrl}/api/config?sdkKey=8mR1pGh8u2ztUP8GqjmQq`, {
            headers: {
                'X-Optimizely-Enable-FEX': 'true',
                'X-Optimizely-Admin-Token': 'dev-admin-token'
            }
        });
        
        const config = await configRes.json();
        const cloudflareFlag = config.features?.['cloudflare_demo_flag'];
        
        if (cloudflareFlag) {
            console.log('✅ cloudflare_demo_flag found in config');
            const variations = cloudflareFlag.deliveryRules?.[0]?.variationsMap;
            if (variations) {
                Object.entries(variations).forEach(([key, variation]) => {
                    console.log(`\nVariation: ${key}`);
                    const settings = variation.variablesMap?.cdnVariationSettings?.value;
                    if (settings) {
                        console.log(settings.substring(0, 200) + '...');
                    }
                });
            }
        }
    } catch (e) {
        console.error('Config check failed:', e.message);
    }
    
    // Now test Edge Mode with expedge.com
    console.log('\n\n📡 Testing Edge Mode with expedge.com URL:\n');
    
    // Test different visitors to get different variations
    const testVisitors = [
        { id: 'cf-demo-visitor-1', expectedVariation: 'Testing visitor 1' },
        { id: 'cf-demo-visitor-2', expectedVariation: 'Testing visitor 2' },
        { id: 'cf-demo-visitor-3', expectedVariation: 'Testing visitor 3' },
        { id: 'cf-demo-visitor-forced-on', forcedVariation: 'on', expectedVariation: 'Forced to ON' },
        { id: 'cf-demo-visitor-forced-off', forcedVariation: 'off', expectedVariation: 'Forced to OFF' }
    ];
    
    for (const visitor of testVisitors) {
        console.log(`\n${visitor.expectedVariation} (${visitor.id}):`);
        
        try {
            const headers = {
                'X-Optimizely-Enable-FEX': 'true',
                'X-Optimizely-SDK-Key': '8mR1pGh8u2ztUP8GqjmQq',
                'X-Optimizely-Visitor-ID': visitor.id
            };
            
            // Add forced decision if specified
            if (visitor.forcedVariation) {
                headers['X-Optimizely-Forced-Decisions'] = JSON.stringify({
                    'cloudflare_demo_flag': { variationKey: visitor.forcedVariation }
                });
            }
            
            // Make request to the root path (matches expedge.com/)
            const response = await fetch(`${baseUrl}/`, {
                headers
            });
            
            console.log(`  Status: ${response.status}`);
            
            // Check for important headers
            const decisionHeader = response.headers.get('x-optimizely-edge-decisions');
            if (decisionHeader) {
                try {
                    const decisions = JSON.parse(decisionHeader);
                    const cfDecision = decisions['cloudflare_demo_flag'];
                    if (cfDecision) {
                        console.log(`  Decision: ${cfDecision.enabled ? 'enabled' : 'disabled'}, variation: ${cfDecision.variationKey}`);
                    }
                } catch (e) {
                    console.log('  Decision header present but could not parse');
                }
            }
            
            const body = await response.text();
            
            // Check what we got
            if (body.includes('DNS points to prohibited IP')) {
                console.log('  ❌ DNS error (shouldn\'t happen with expedge.com)');
            } else if (body.includes('backpack')) {
                console.log('  ✅ Got "on" variation content (backpack category)');
            } else if (body.includes('expedge.com')) {
                console.log('  ✅ Got "off" variation content (homepage)');
            } else if (body.includes('<!DOCTYPE html') || body.includes('<html')) {
                console.log('  ✅ Got HTML content');
                console.log(`  Preview: ${body.substring(0, 100)}...`);
            } else {
                console.log('  ❓ Got unexpected response');
                console.log(`  Preview: ${body.substring(0, 100)}...`);
            }
            
        } catch (error) {
            console.error(`  Error: ${error.message}`);
        }
    }
}

testCloudflareFlag().catch(console.error);