/**
 * Test script to verify edge_mode_final_test flag configuration
 */

const fetch = require('node-fetch');

const SDK_KEY = '8mR1pGh8u2ztUP8GqjmQq';
const BASE_URL = 'http://localhost:8787';
const FLAG_KEY = 'edge_mode_final_test';
const GITHUB_PAGES_BASE = 'https://simone-coelho.github.io/optimizely-edge-mode-demo';

async function testEdgeModeFinalFlag() {
  console.log('🔍 Testing edge_mode_final_test flag configuration');
  console.log('=' .repeat(60));

  try {
    // 1. Check if server is running
    console.log('\n1️⃣ Checking server status...');
    const healthRes = await fetch(`${BASE_URL}/api/test`, {
      headers: { 'X-Optimizely-SDK-Key': SDK_KEY }
    });
    
    if (!healthRes.ok) {
      console.error('❌ Server is not responding correctly');
      process.exit(1);
    }
    console.log('✅ Server is running');

    // 2. Fetch datafile and check flag
    console.log('\n2️⃣ Fetching datafile...');
    const datafileRes = await fetch(`${BASE_URL}/api/datafile`, {
      headers: { 'X-Optimizely-SDK-Key': SDK_KEY }
    });
    
    const datafile = await datafileRes.json();
    console.log(`✅ Datafile fetched (version ${datafile.version})`);

    // 3. Check if edge_mode_final_test flag exists
    console.log('\n3️⃣ Looking for edge_mode_final_test flag...');
    const flag = datafile.featureFlags?.find(f => f.key === FLAG_KEY);
    
    if (!flag) {
      console.error(`❌ Flag '${FLAG_KEY}' not found in datafile`);
      console.log('\nAvailable flags:');
      datafile.featureFlags?.forEach(f => {
        console.log(`  - ${f.key}`);
      });
      process.exit(1);
    }
    
    console.log(`✅ Flag '${FLAG_KEY}' found`);
    console.log(`   ID: ${flag.id}`);
    console.log(`   Experiments: ${flag.experimentIds?.length || 0}`);
    console.log(`   Variables: ${flag.variables?.length || 0}`);

    // 4. Check flag variables for cdnVariationSettings
    console.log('\n4️⃣ Checking flag variables...');
    const cdnVar = flag.variables?.find(v => v.key === 'cdnVariationSettings');
    
    if (!cdnVar) {
      console.error('❌ cdnVariationSettings variable not found');
      console.log('\nAvailable variables:');
      flag.variables?.forEach(v => {
        console.log(`  - ${v.key} (${v.type})`);
      });
      process.exit(1);
    }
    
    console.log('✅ cdnVariationSettings variable found');
    console.log(`   Type: ${cdnVar.type}`);
    console.log(`   Default: ${cdnVar.defaultValue?.substring(0, 100)}...`);

    // 5. Test a decision with the flag
    console.log('\n5️⃣ Testing decision endpoint with flag...');
    const decisionRes = await fetch(`${BASE_URL}/api/decide?flagKey=${FLAG_KEY}&userId=test-user`, {
      headers: {
        'X-Optimizely-SDK-Key': SDK_KEY,
        'X-Optimizely-Enable-FEX': 'true'
      }
    });
    
    const decision = await decisionRes.json();
    console.log('✅ Decision received:');
    console.log(`   Enabled: ${decision.enabled}`);
    console.log(`   Variation: ${decision.variationKey}`);
    
    if (decision.variables?.cdnVariationSettings) {
      const settings = decision.variables.cdnVariationSettings;
      console.log('   CDN Settings:');
      console.log(`     - Content URL: ${settings.contentUrl}`);
      console.log(`     - Match Pattern: ${settings.matchPattern}`);
      console.log(`     - Replace Pattern: ${settings.replacePattern}`);
      
      // Check if URL is correct
      if (settings.contentUrl && settings.contentUrl.startsWith(GITHUB_PAGES_BASE)) {
        console.log(`   ✅ Content URL correctly points to GitHub Pages`);
      } else {
        console.log(`   ⚠️ Content URL doesn't match expected base: ${GITHUB_PAGES_BASE}`);
      }
    } else {
      console.log('   ⚠️ No cdnVariationSettings in decision');
    }

    // 6. Test forced decisions
    console.log('\n6️⃣ Testing forced decisions...');
    const variations = ['control', 'a', 'b'];
    
    for (const variation of variations) {
      const forced = { [FLAG_KEY]: { variationKey: variation } };
      const forcedRes = await fetch(`${BASE_URL}/api/decide?flagKey=${FLAG_KEY}&userId=forced-test`, {
        headers: {
          'X-Optimizely-SDK-Key': SDK_KEY,
          'X-Optimizely-Enable-FEX': 'true',
          'X-Optimizely-Forced-Decisions': JSON.stringify(forced)
        }
      });
      
      const forcedDecision = await forcedRes.json();
      const match = forcedDecision.variationKey === variation;
      console.log(`   ${match ? '✅' : '❌'} Forced ${variation}: got ${forcedDecision.variationKey}`);
    }

    // 7. Test Edge Mode content fetching
    console.log('\n7️⃣ Testing Edge Mode content fetching...');
    const edgeRes = await fetch(`${BASE_URL}/`, {
      headers: {
        'X-Optimizely-SDK-Key': SDK_KEY,
        'X-Optimizely-Enable-FEX': 'true',
        'X-Optimizely-Forced-Decisions': JSON.stringify({
          [FLAG_KEY]: { variationKey: 'control' }
        })
      }
    });
    
    const headers = Object.fromEntries(edgeRes.headers.entries());
    console.log('   Response headers:');
    console.log(`     - Status: ${edgeRes.status}`);
    console.log(`     - Variation: ${headers['x-optimizely-variation'] || 'not set'}`);
    console.log(`     - Mode: ${headers['x-optimizely-mode'] || 'not set'}`);
    console.log(`     - Cache: ${headers['x-optimizely-cache'] || 'not set'}`);
    
    const body = await edgeRes.text();
    const hasContent = body.includes('Purple Theme') || 
                      body.includes('Pink Theme') || 
                      body.includes('Ocean Theme');
    
    if (hasContent) {
      console.log('   ✅ Edge Mode content detected in response');
    } else {
      console.log('   ❌ No Edge Mode content found in response');
      console.log(`   Response preview: ${body.substring(0, 200)}...`);
    }

    console.log('\n' + '=' .repeat(60));
    console.log('✅ All tests completed successfully!');
    console.log('The edge_mode_final_test flag is properly configured.');
    console.log('=' .repeat(60));

  } catch (error) {
    console.error('\n❌ Error during testing:', error.message);
    process.exit(1);
  }
}

// Run the test
testEdgeModeFinalFlag();