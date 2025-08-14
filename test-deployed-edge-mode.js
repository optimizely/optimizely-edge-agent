#!/usr/bin/env node

/**
 * Test script for Edge Mode functionality against deployed Cloudflare Worker
 * Tests the cloudflare_demo_flag with expedge.com URLs
 */

const DEPLOYED_URL = 'https://edge-agent-demo.expedge.workers.dev';
const SDK_KEY = '8mR1pGh8u2ztUP8GqjmQq';

async function testEdgeModeDeployed() {
    console.log('🚀 Testing Edge Mode on deployed Cloudflare Worker');
    console.log(`📡 Using URL: ${DEPLOYED_URL}`);
    console.log('🔍 Testing cloudflare_demo_flag with expedge.com URLs\n');

    // Test scenarios
    const scenarios = [
        {
            name: 'Natural visitor (should get random variation)',
            visitorId: 'deployed-visitor-1',
            forcedDecisions: null
        },
        {
            name: 'Forced to ON variation',
            visitorId: 'deployed-visitor-forced-on',
            forcedDecisions: { "cloudflare_demo_flag": { "variationKey": "on" } }
        },
        {
            name: 'Forced to OFF variation',
            visitorId: 'deployed-visitor-forced-off',
            forcedDecisions: { "cloudflare_demo_flag": { "variationKey": "off" } }
        }
    ];

    for (const scenario of scenarios) {
        console.log(`\n🧪 Testing: ${scenario.name}`);
        
        try {
            // Prepare headers
            const headers = {
                'X-Optimizely-Enable-FEX': 'true',
                'X-Optimizely-SDK-Key': SDK_KEY,
                'X-Optimizely-Visitor-ID': scenario.visitorId,
                'User-Agent': 'EdgeModeTest/1.0'
            };

            // Add forced decisions if specified
            if (scenario.forcedDecisions) {
                headers['X-Optimizely-Forced-Decisions'] = JSON.stringify(scenario.forcedDecisions);
            }

            // Make request to root path with debug flag (should trigger Edge Mode)
            const response = await fetch(DEPLOYED_URL + '/?force-edge-mode=true', {
                method: 'GET',
                headers: headers
            });

            console.log(`  Status: ${response.status}`);
            console.log(`  Content-Type: ${response.headers.get('content-type')}`);
            
            // Check for Edge Mode tracing headers
            const edgeFlag = response.headers.get('X-Optimizely-Edge-Flag');
            const edgeVariation = response.headers.get('X-Optimizely-Edge-Variation');
            const edgeEnabled = response.headers.get('X-Optimizely-Edge-Enabled');
            
            if (edgeFlag) {
                console.log(`  🏴 Edge Flag: ${edgeFlag}`);
                console.log(`  🎯 Edge Variation: ${edgeVariation}`);
                console.log(`  ✅ Edge Enabled: ${edgeEnabled}`);
            }

            // Get content preview
            const content = await response.text();
            const preview = content.substring(0, 200).replace(/\s+/g, ' ').trim();
            console.log(`  📄 Content Preview: ${preview}...`);

            // Check if we got expedge.com content or an error
            if (content.includes('expedge') || content.includes('ExpEdge')) {
                console.log('  ✅ Got expedge.com content');
            } else if (content.includes('error') || content.includes('Error')) {
                console.log('  ❌ Got error response');
            } else {
                console.log('  ❓ Got unknown content');
            }

        } catch (error) {
            console.log(`  ❌ Request failed: ${error.message}`);
        }
    }

    console.log('\n🔍 Testing decision endpoint for flag details:');
    
    try {
        const decisionUrl = `${DEPLOYED_URL}/api/decide?userId=debug&flagKey=cloudflare_demo_flag`;
        const response = await fetch(decisionUrl, {
            headers: {
                'X-Optimizely-Enable-FEX': 'true',
                'X-Optimizely-SDK-Key': SDK_KEY
            }
        });

        const decision = await response.json();
        console.log('📊 Flag Decision:', JSON.stringify(decision, null, 2));
        
    } catch (error) {
        console.log(`❌ Decision endpoint failed: ${error.message}`);
    }
}

// Run the test
testEdgeModeDeployed().catch(console.error);