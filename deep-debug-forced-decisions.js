/**
 * Deep debugging for forced decisions
 * This will help us understand what's REALLY happening
 */

const SDK_KEY = '8mR1pGh8u2ztUP8GqjmQq';
const FLAG_KEY = 'test-flag';
const EDGE_URL = 'http://localhost:8787';

async function deepDebug() {
  console.log('='.repeat(80));
  console.log('DEEP DEBUG: FORCED DECISIONS');
  console.log('='.repeat(80));
  
  // 1. First, check what variations actually exist
  console.log('\n1. CHECKING DATAFILE FOR VALID VARIATIONS...');
  try {
    const datafileRes = await fetch(`${EDGE_URL}/api/datafile`, {
      headers: { 
        'X-Optimizely-SDK-Key': SDK_KEY,
        'X-Optimizely-Enable-FEX': 'true'
      }
    });
    
    if (datafileRes.ok) {
      const datafile = await datafileRes.json();
      
      // Find test-flag
      const flag = datafile.featureFlags?.find(f => f.key === FLAG_KEY);
      if (!flag) {
        console.log('   ❌ FLAG NOT FOUND IN DATAFILE!');
        return;
      }
      
      console.log(`   ✅ Found flag: ${FLAG_KEY}`);
      console.log(`   Flag ID: ${flag.id}`);
      
      // Check experiments
      const validVariations = new Set();
      if (flag.experimentIds?.length > 0) {
        console.log(`   Experiments: ${flag.experimentIds.length}`);
        for (const expId of flag.experimentIds) {
          const exp = datafile.experiments?.find(e => e.id === expId);
          if (exp) {
            console.log(`\n   Experiment: ${exp.key}`);
            exp.variations?.forEach(v => {
              console.log(`     - Variation: "${v.key}" (enabled=${v.featureEnabled})`);
              validVariations.add(v.key);
            });
          }
        }
      }
      
      // Check rollouts
      const rollout = datafile.rollouts?.find(r => r.id === flag.rolloutId);
      if (rollout) {
        console.log(`\n   Rollout: ${flag.rolloutId}`);
        rollout.experiments?.forEach(exp => {
          exp.variations?.forEach(v => {
            console.log(`     - Variation: "${v.key}" (enabled=${v.featureEnabled})`);
            validVariations.add(v.key);
          });
        });
      }
      
      console.log(`\n   VALID VARIATIONS: ${Array.from(validVariations).join(', ')}`);
      
      // 2. Test each valid variation
      console.log('\n2. TESTING FORCED DECISIONS WITH EACH VALID VARIATION...\n');
      
      for (const variation of validVariations) {
        await testForcedVariation(variation);
      }
      
      // 3. Test with an INVALID variation
      console.log('\n3. TESTING WITH INVALID VARIATION "fake-variation"...');
      await testForcedVariation('fake-variation');
      
    } else {
      console.log('   ❌ Could not fetch datafile');
    }
  } catch (error) {
    console.log('   ❌ Error: ' + error.message);
  }
  
  // 4. Check if headers are even being received
  console.log('\n4. TESTING RAW HEADER ECHO (if endpoint exists)...');
  try {
    const testHeaders = {
      'X-Optimizely-SDK-Key': SDK_KEY,
      'X-Optimizely-Forced-Decisions': JSON.stringify({[FLAG_KEY]: {variationKey: 'test'}}),
      'X-Test-Header': 'test-value'
    };
    
    const debugRes = await fetch(`${EDGE_URL}/api/debug`, {
      headers: testHeaders
    });
    
    if (debugRes.ok) {
      const debugData = await debugRes.json();
      console.log('   Debug endpoint response:', JSON.stringify(debugData, null, 2));
    } else {
      console.log('   No debug endpoint available (expected)');
    }
  } catch (error) {
    console.log('   Debug endpoint not available (expected)');
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('ANALYSIS COMPLETE');
  console.log('='.repeat(80));
}

async function testForcedVariation(variation) {
  const userId = `test-user-${Date.now()}-${variation}`;
  const forced = JSON.stringify({[FLAG_KEY]: {variationKey: variation}});
  
  console.log(`   Testing forced variation "${variation}"...`);
  console.log(`   User ID: ${userId}`);
  console.log(`   Header: X-Optimizely-Forced-Decisions: ${forced}`);
  
  try {
    const response = await fetch(`${EDGE_URL}/api/decide?flagKey=${FLAG_KEY}&userId=${userId}`, {
      headers: {
        'X-Optimizely-SDK-Key': SDK_KEY,
        'X-Optimizely-Enable-FEX': 'true',
        'X-Optimizely-Forced-Decisions': forced
      }
    });
    
    if (response.ok) {
      const decision = await response.json();
      const success = decision.variationKey === variation;
      console.log(`   Result: variationKey="${decision.variationKey}" ${success ? '✅' : '❌'}`);
      
      if (!success) {
        console.log(`   Expected: "${variation}"`);
        console.log(`   Got: "${decision.variationKey}"`);
        console.log(`   Full response: ${JSON.stringify(decision)}`);
      }
    } else {
      console.log(`   ❌ HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  console.log('');
}

// Run the deep debug
deepDebug().catch(console.error);