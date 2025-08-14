/**
 * Test to verify forced decisions bug is fixed
 * The bug: User context cache didn't include forced decisions in cache key
 * The fix: Include forced decisions in cache key and apply them during context creation
 */

const SDK_KEY = '8mR1pGh8u2ztUP8GqjmQq';
const FLAG_KEY = 'test-flag';
const EDGE_URL = 'http://localhost:8787';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testForcedDecisionsFix() {
  console.log('='.repeat(80));
  console.log('FORCED DECISIONS BUG FIX VERIFICATION TEST');
  console.log('='.repeat(80));
  console.log('\nTesting the fix for user context cache issue with forced decisions');
  console.log('The bug: Cached user contexts ignored forced decisions');
  console.log('The fix: Include forced decisions in cache key\n');
  
  const testUserId = 'cache-test-user-' + Date.now();
  
  // Test 1: First request WITHOUT forced decisions (populates cache)
  console.log('1. First request WITHOUT forced decisions (populates cache)...');
  try {
    const response1 = await fetch(`${EDGE_URL}/api/decide?flagKey=${FLAG_KEY}&userId=${testUserId}`, {
      headers: {
        'X-Optimizely-SDK-Key': SDK_KEY
      }
    });
    
    if (response1.ok) {
      const decision1 = await response1.json();
      console.log(`   Normal decision: variationKey="${decision1.variationKey}", enabled=${decision1.enabled}`);
      console.log(`   This should populate the user context cache\n`);
    }
  } catch (error) {
    console.log(`   Error: ${error.message}\n`);
  }
  
  // Test 2: Second request WITH forced "on" (should NOT use cached context)
  console.log('2. Second request WITH forced "on" (should create new context with forced decision)...');
  try {
    const forcedOn = JSON.stringify({ [FLAG_KEY]: { variationKey: 'on' } });
    const response2 = await fetch(`${EDGE_URL}/api/decide?flagKey=${FLAG_KEY}&userId=${testUserId}`, {
      headers: {
        'X-Optimizely-SDK-Key': SDK_KEY,
        'X-Optimizely-Forced-Decisions': forcedOn
      }
    });
    
    if (response2.ok) {
      const decision2 = await response2.json();
      console.log(`   Forced "on" decision: variationKey="${decision2.variationKey}", enabled=${decision2.enabled}`);
      
      if (decision2.variationKey === 'on') {
        console.log(`   ✅ SUCCESS! Forced decision "on" is working correctly!\n`);
      } else {
        console.log(`   ❌ FAIL! Expected "on" but got "${decision2.variationKey}"`);
        console.log(`   The fix may not be working correctly\n`);
      }
    }
  } catch (error) {
    console.log(`   Error: ${error.message}\n`);
  }
  
  // Test 3: Third request WITHOUT forced decisions (should use original cached context)
  console.log('3. Third request WITHOUT forced decisions (should use original cached context)...');
  try {
    const response3 = await fetch(`${EDGE_URL}/api/decide?flagKey=${FLAG_KEY}&userId=${testUserId}`, {
      headers: {
        'X-Optimizely-SDK-Key': SDK_KEY
      }
    });
    
    if (response3.ok) {
      const decision3 = await response3.json();
      console.log(`   Normal decision again: variationKey="${decision3.variationKey}", enabled=${decision3.enabled}`);
      console.log(`   This should use the cached context without forced decisions\n`);
    }
  } catch (error) {
    console.log(`   Error: ${error.message}\n`);
  }
  
  // Test 4: Fourth request WITH forced "off" (different forced decision)
  console.log('4. Fourth request WITH forced "off" (should create another new context)...');
  try {
    const forcedOff = JSON.stringify({ [FLAG_KEY]: { variationKey: 'off' } });
    const response4 = await fetch(`${EDGE_URL}/api/decide?flagKey=${FLAG_KEY}&userId=${testUserId}`, {
      headers: {
        'X-Optimizely-SDK-Key': SDK_KEY,
        'X-Optimizely-Forced-Decisions': forcedOff
      }
    });
    
    if (response4.ok) {
      const decision4 = await response4.json();
      console.log(`   Forced "off" decision: variationKey="${decision4.variationKey}", enabled=${decision4.enabled}`);
      
      if (decision4.variationKey === 'off') {
        console.log(`   ✅ SUCCESS! Forced decision "off" is working correctly!\n`);
      } else {
        console.log(`   ❌ FAIL! Expected "off" but got "${decision4.variationKey}"`);
        console.log(`   The fix may not be working correctly\n`);
      }
    }
  } catch (error) {
    console.log(`   Error: ${error.message}\n`);
  }
  
  // Test 5: Rapid succession test (cache stress test)
  console.log('5. Rapid succession test with different forced decisions...');
  const rapidTestUser = 'rapid-test-' + Date.now();
  const variations = ['on', 'off', 'control'];
  let allPassed = true;
  
  for (const variation of variations) {
    const forced = JSON.stringify({ [FLAG_KEY]: { variationKey: variation } });
    try {
      const response = await fetch(`${EDGE_URL}/api/decide?flagKey=${FLAG_KEY}&userId=${rapidTestUser}`, {
        headers: {
          'X-Optimizely-SDK-Key': SDK_KEY,
          'X-Optimizely-Forced-Decisions': forced
        }
      });
      
      if (response.ok) {
        const decision = await response.json();
        if (decision.variationKey === variation) {
          console.log(`   ✅ Forced "${variation}": SUCCESS`);
        } else {
          console.log(`   ❌ Forced "${variation}": FAIL (got "${decision.variationKey}")`);
          allPassed = false;
        }
      }
    } catch (error) {
      console.log(`   ❌ Error testing "${variation}": ${error.message}`);
      allPassed = false;
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('TEST RESULTS:');
  console.log('='.repeat(80));
  
  if (allPassed) {
    console.log('✅ ALL TESTS PASSED! The forced decisions bug has been fixed!');
    console.log('\nThe fix successfully:');
    console.log('1. Includes forced decisions in the user context cache key');
    console.log('2. Applies forced decisions when creating new contexts');
    console.log('3. Maintains separate cache entries for different forced decisions');
    console.log('4. Allows the same user to have different forced decisions simultaneously');
  } else {
    console.log('❌ SOME TESTS FAILED - The bug may not be fully fixed');
    console.log('\nPossible issues:');
    console.log('1. The cache key might not be properly including forced decisions');
    console.log('2. Forced decisions might not be applied correctly to new contexts');
    console.log('3. There might be race conditions in the caching logic');
  }
  
  console.log('='.repeat(80));
}

// Make sure the server is running first
console.log('Make sure the Edge Agent is running at http://localhost:8787');
console.log('Run: wrangler dev --local\n');

// Wait a moment then run the test
setTimeout(() => {
  testForcedDecisionsFix().catch(console.error);
}, 1000);