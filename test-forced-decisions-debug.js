/**
 * Debug script for forced decisions issue
 * Run with: node test-forced-decisions-debug.js
 */

const SDK_KEY = '8mR1pGh8u2ztUP8GqjmQq';
const FLAG_KEY = 'test-flag';
const EDGE_URL = 'http://localhost:8787';

async function testForcedDecisions() {
  console.log('='.repeat(60));
  console.log('FORCED DECISIONS DEBUG TEST');
  console.log('='.repeat(60));
  
  // Test 1: Get datafile to check valid variations
  console.log('\n1. Fetching datafile to check valid variations...');
  try {
    const datafileResponse = await fetch(`${EDGE_URL}/api/datafile`, {
      headers: {
        'X-Optimizely-SDK-Key': SDK_KEY
      }
    });
    
    if (datafileResponse.ok) {
      const datafile = await datafileResponse.json();
      
      // Find the test-flag configuration
      const flag = datafile.featureFlags?.find(f => f.key === FLAG_KEY);
      if (flag) {
        console.log(`   Flag "${FLAG_KEY}" found!`);
        console.log(`   ID: ${flag.id}`);
        console.log(`   Experiments: ${flag.experimentIds?.length || 0}`);
        
        // Find experiments and variations
        if (flag.experimentIds && flag.experimentIds.length > 0) {
          const experiment = datafile.experiments?.find(e => e.id === flag.experimentIds[0]);
          if (experiment) {
            console.log(`   Experiment: ${experiment.key}`);
            console.log('   Variations:');
            experiment.variations?.forEach(v => {
              console.log(`     - Key: "${v.key}", ID: ${v.id}, Enabled: ${v.featureEnabled}`);
            });
          }
        }
        
        // Check rollout rules
        const rollout = datafile.rollouts?.find(r => r.id === flag.rolloutId);
        if (rollout) {
          console.log('   Rollout experiments:');
          rollout.experiments?.forEach(exp => {
            console.log(`     - ${exp.key}`);
            exp.variations?.forEach(v => {
              console.log(`       - Variation: "${v.key}", ID: ${v.id}, Enabled: ${v.featureEnabled}`);
            });
          });
        }
      } else {
        console.log(`   ❌ Flag "${FLAG_KEY}" not found in datafile!`);
      }
    } else {
      console.log(`   ❌ Failed to fetch datafile: ${datafileResponse.status}`);
    }
  } catch (error) {
    console.log(`   ❌ Error fetching datafile: ${error.message}`);
  }
  
  // Test 2: Normal decision without forced variation
  console.log('\n2. Testing normal decision (no forced variation)...');
  try {
    const normalResponse = await fetch(`${EDGE_URL}/api/decide?flagKey=${FLAG_KEY}&userId=test-user-normal`, {
      headers: {
        'X-Optimizely-SDK-Key': SDK_KEY
      }
    });
    
    if (normalResponse.ok) {
      const decision = await normalResponse.json();
      console.log(`   Normal decision: variationKey="${decision.variationKey}", enabled=${decision.enabled}`);
    } else {
      console.log(`   ❌ Failed: ${normalResponse.status}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  // Test 3: Forced decision with "on"
  console.log('\n3. Testing forced decision with variation "on"...');
  try {
    const forcedOn = JSON.stringify({ [FLAG_KEY]: { variationKey: 'on' } });
    console.log(`   Sending header: X-Optimizely-Forced-Decisions: ${forcedOn}`);
    
    const forcedOnResponse = await fetch(`${EDGE_URL}/api/decide?flagKey=${FLAG_KEY}&userId=test-user-forced-on`, {
      headers: {
        'X-Optimizely-SDK-Key': SDK_KEY,
        'X-Optimizely-Forced-Decisions': forcedOn
      }
    });
    
    if (forcedOnResponse.ok) {
      const decision = await forcedOnResponse.json();
      console.log(`   Forced "on" decision: variationKey="${decision.variationKey}", enabled=${decision.enabled}`);
      if (decision.variationKey !== 'on') {
        console.log(`   ❌ ISSUE: Expected "on" but got "${decision.variationKey}"`);
      } else {
        console.log(`   ✅ Forced decision working correctly!`);
      }
    } else {
      console.log(`   ❌ Failed: ${forcedOnResponse.status}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  // Test 4: Forced decision with "off"
  console.log('\n4. Testing forced decision with variation "off"...');
  try {
    const forcedOff = JSON.stringify({ [FLAG_KEY]: { variationKey: 'off' } });
    console.log(`   Sending header: X-Optimizely-Forced-Decisions: ${forcedOff}`);
    
    const forcedOffResponse = await fetch(`${EDGE_URL}/api/decide?flagKey=${FLAG_KEY}&userId=test-user-forced-off`, {
      headers: {
        'X-Optimizely-SDK-Key': SDK_KEY,
        'X-Optimizely-Forced-Decisions': forcedOff
      }
    });
    
    if (forcedOffResponse.ok) {
      const decision = await forcedOffResponse.json();
      console.log(`   Forced "off" decision: variationKey="${decision.variationKey}", enabled=${decision.enabled}`);
      if (decision.variationKey !== 'off') {
        console.log(`   ❌ ISSUE: Expected "off" but got "${decision.variationKey}"`);
      } else {
        console.log(`   ✅ Forced decision working correctly!`);
      }
    } else {
      console.log(`   ❌ Failed: ${forcedOffResponse.status}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  // Test 5: Try with invalid variation key
  console.log('\n5. Testing forced decision with invalid variation "invalid-key"...');
  try {
    const forcedInvalid = JSON.stringify({ [FLAG_KEY]: { variationKey: 'invalid-key' } });
    console.log(`   Sending header: X-Optimizely-Forced-Decisions: ${forcedInvalid}`);
    
    const forcedInvalidResponse = await fetch(`${EDGE_URL}/api/decide?flagKey=${FLAG_KEY}&userId=test-user-forced-invalid`, {
      headers: {
        'X-Optimizely-SDK-Key': SDK_KEY,
        'X-Optimizely-Forced-Decisions': forcedInvalid
      }
    });
    
    if (forcedInvalidResponse.ok) {
      const decision = await forcedInvalidResponse.json();
      console.log(`   Forced "invalid-key" decision: variationKey="${decision.variationKey}", enabled=${decision.enabled}`);
      console.log(`   Note: Invalid variation should fall back to normal bucketing`);
    } else {
      console.log(`   ❌ Failed: ${forcedInvalidResponse.status}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('DIAGNOSIS:');
  console.log('1. Check if "on" and "off" are valid variation keys in the datafile');
  console.log('2. Verify forced decisions are being parsed from headers');
  console.log('3. Confirm SDK setForcedDecision is being called');
  console.log('4. Check if the SDK version supports forced decisions');
  console.log('='.repeat(60));
}

// Run the test
testForcedDecisions().catch(console.error);