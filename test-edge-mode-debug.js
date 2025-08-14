// Debug Edge Mode URL handling
const baseUrl = 'http://localhost:8787';

async function debugEdgeMode() {
    console.log('🔍 Debugging Edge Mode URL handling\n');
    
    // Test with a fresh visitor to see what URLs are being used
    const visitorId = 'debug-visitor-' + Date.now();
    
    try {
        // First get the decision to see what cdnResponseURL should be used
        const decideRes = await fetch(`${baseUrl}/api/decide?userId=${visitorId}&flagKey=cloudflare_demo_flag`, {
            headers: {
                'X-Optimizely-Enable-FEX': 'true',
                'X-Optimizely-SDK-Key': '8mR1pGh8u2ztUP8GqjmQq'
            }
        });
        
        const decision = await decideRes.json();
        console.log('Decision for visitor:', decision.enabled ? 'ENABLED' : 'DISABLED', 'variation:', decision.variationKey);
        
        if (decision.variables?.cdnVariationSettings) {
            const settings = decision.variables.cdnVariationSettings;
            console.log('\ncdnVariationSettings:');
            console.log('  cdnExperimentURL:', settings.cdnExperimentURL);
            console.log('  cdnResponseURL:', settings.cdnResponseURL);
            console.log('  isControlVariation:', settings.isControlVariation);
        }
        
        // Now test the actual Edge Mode request
        console.log('\n📡 Testing Edge Mode request to /category/backpack\n');
        
        const edgeRes = await fetch(`${baseUrl}/category/backpack`, {
            headers: {
                'X-Optimizely-Enable-FEX': 'true',
                'X-Optimizely-SDK-Key': '8mR1pGh8u2ztUP8GqjmQq',
                'X-Optimizely-Visitor-ID': visitorId
            }
        });
        
        console.log('Response status:', edgeRes.status);
        console.log('Response headers:');
        console.log('  X-Optimizely-Flag:', edgeRes.headers.get('X-Optimizely-Flag'));
        console.log('  X-Optimizely-Variation:', edgeRes.headers.get('X-Optimizely-Variation'));
        console.log('  X-Optimizely-Edge-Mode:', edgeRes.headers.get('X-Optimizely-Edge-Mode'));
        
        if (edgeRes.status !== 200) {
            const body = await edgeRes.text();
            console.log('\nError response preview:', body.substring(0, 200));
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

debugEdgeMode();