/**
 * Test forced decisions with correct API usage
 */

const SDK_KEY = '8mR1pGh8u2ztUP8GqjmQq';
const FLAG_KEY = 'test-flag';
const EDGE_URL = 'http://localhost:8787';

async function testForcedDecisions() {
  console.log('='.repeat(80));
  console.log('FORCED DECISIONS TEST - CORRECT API FORMAT');
  console.log('='.repeat(80));
  
  // Test 1: Normal decision without forced
  console.log('\n1. Testing normal decision (no forced variation)...');
  try {
    const response1 = await fetch(`${EDGE_URL}/api/decide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Optimizely-SDK-Key': SDK_KEY,
        'X-Optimizely-Enable-FEX': 'true'
      },
      body: JSON.stringify({
        flagKey: FLAG_KEY,
        user: { id: 'test-user-normal' }
      })
    });
    
    const text1 = await response1.text();
    console.log(`   Response: ${text1}`);
    
    if (text1.includes('error')) {
      console.log('   ❌ Error in response');
    } else {
      try {
        const decision1 = JSON.parse(text1);
        console.log(`   Normal decision: variationKey="${decision1.variationKey}", enabled=${decision1.enabled}`);
      } catch (e) {
        console.log(`   ❌ Could not parse response: ${e.message}`);
      }
    }
  } catch (error) {
    console.log(`   ❌ Request failed: ${error.message}`);
  }
  
  // Test 2: Forced decision "on"
  console.log('\n2. Testing forced decision with variation "on"...');
  try {
    const forcedOn = JSON.stringify({ [FLAG_KEY]: { variationKey: 'on' } });
    console.log(`   Sending header: X-Optimizely-Forced-Decisions: ${forcedOn}`);
    
    const response2 = await fetch(`${EDGE_URL}/api/decide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Optimizely-SDK-Key': SDK_KEY,
        'X-Optimizely-Enable-FEX': 'true',
        'X-Optimizely-Forced-Decisions': forcedOn
      },
      body: JSON.stringify({
        flagKey: FLAG_KEY,
        user: { id: 'test-user-forced-on' }
      })
    });
    
    const text2 = await response2.text();
    console.log(`   Response: ${text2}`);
    
    if (text2.includes('error')) {
      console.log('   ❌ Error in response');
    } else {
      try {
        const decision2 = JSON.parse(text2);
        console.log(`   Forced "on" decision: variationKey="${decision2.variationKey}", enabled=${decision2.enabled}`);
        
        if (decision2.variationKey === 'on') {
          console.log(`   ✅ SUCCESS! Forced decision "on" is working!`);
        } else {
          console.log(`   ❌ FAIL! Expected "on" but got "${decision2.variationKey}"`);
        }
      } catch (e) {
        console.log(`   ❌ Could not parse response: ${e.message}`);
      }
    }
  } catch (error) {
    console.log(`   ❌ Request failed: ${error.message}`);
  }
  
  // Test 3: Forced decision "off"
  console.log('\n3. Testing forced decision with variation "off"...');
  try {
    const forcedOff = JSON.stringify({ [FLAG_KEY]: { variationKey: 'off' } });
    console.log(`   Sending header: X-Optimizely-Forced-Decisions: ${forcedOff}`);
    
    const response3 = await fetch(`${EDGE_URL}/api/decide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Optimizely-SDK-Key': SDK_KEY,
        'X-Optimizely-Enable-FEX': 'true',
        'X-Optimizely-Forced-Decisions': forcedOff
      },
      body: JSON.stringify({
        flagKey: FLAG_KEY,
        user: { id: 'test-user-forced-off' }
      })
    });
    
    const text3 = await response3.text();
    console.log(`   Response: ${text3}`);
    
    if (text3.includes('error')) {
      console.log('   ❌ Error in response');
    } else {
      try {
        const decision3 = JSON.parse(text3);
        console.log(`   Forced "off" decision: variationKey="${decision3.variationKey}", enabled=${decision3.enabled}`);
        
        if (decision3.variationKey === 'off') {
          console.log(`   ✅ SUCCESS! Forced decision "off" is working!`);
        } else {
          console.log(`   ❌ FAIL! Expected "off" but got "${decision3.variationKey}"`);
        }
      } catch (e) {
        console.log(`   ❌ Could not parse response: ${e.message}`);
      }
    }
  } catch (error) {
    console.log(`   ❌ Request failed: ${error.message}`);
  }
  
  // Test 4: Forced decision "control"
  console.log('\n4. Testing forced decision with variation "control"...');
  try {
    const forcedControl = JSON.stringify({ [FLAG_KEY]: { variationKey: 'control' } });
    console.log(`   Sending header: X-Optimizely-Forced-Decisions: ${forcedControl}`);
    
    const response4 = await fetch(`${EDGE_URL}/api/decide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Optimizely-SDK-Key': SDK_KEY,
        'X-Optimizely-Enable-FEX': 'true',
        'X-Optimizely-Forced-Decisions': forcedControl
      },
      body: JSON.stringify({
        flagKey: FLAG_KEY,
        user: { id: 'test-user-forced-control' }
      })
    });
    
    const text4 = await response4.text();
    console.log(`   Response: ${text4}`);
    
    if (text4.includes('error')) {
      console.log('   ❌ Error in response');
    } else {
      try {
        const decision4 = JSON.parse(text4);
        console.log(`   Forced "control" decision: variationKey="${decision4.variationKey}", enabled=${decision4.enabled}`);
        
        if (decision4.variationKey === 'control') {
          console.log(`   ✅ SUCCESS! Forced decision "control" is working!`);
        } else {
          console.log(`   ❌ FAIL! Expected "control" but got "${decision4.variationKey}"`);
        }
      } catch (e) {
        console.log(`   ❌ Could not parse response: ${e.message}`);
      }
    }
  } catch (error) {
    console.log(`   ❌ Request failed: ${error.message}`);
  }
  
  // Test 5: Cache test - same user, different forced decisions
  console.log('\n5. Testing cache with same user, different forced decisions...');
  const cacheTestUser = 'cache-test-' + Date.now();
  
  // First request with forced "on"
  try {
    const response5a = await fetch(`${EDGE_URL}/api/decide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Optimizely-SDK-Key': SDK_KEY,
        'X-Optimizely-Enable-FEX': 'true',
        'X-Optimizely-Forced-Decisions': JSON.stringify({ [FLAG_KEY]: { variationKey: 'on' } })
      },
      body: JSON.stringify({
        flagKey: FLAG_KEY,
        user: { id: cacheTestUser }
      })
    });
    
    const text5a = await response5a.text();
    const decision5a = JSON.parse(text5a);
    console.log(`   Same user, forced "on": ${decision5a.variationKey}`);
    
    // Second request with forced "off" (same user)
    const response5b = await fetch(`${EDGE_URL}/api/decide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Optimizely-SDK-Key': SDK_KEY,
        'X-Optimizely-Enable-FEX': 'true',
        'X-Optimizely-Forced-Decisions': JSON.stringify({ [FLAG_KEY]: { variationKey: 'off' } })
      },
      body: JSON.stringify({
        flagKey: FLAG_KEY,
        user: { id: cacheTestUser }
      })
    });
    
    const text5b = await response5b.text();
    const decision5b = JSON.parse(text5b);
    console.log(`   Same user, forced "off": ${decision5b.variationKey}`);
    
    if (decision5a.variationKey === 'on' && decision5b.variationKey === 'off') {
      console.log(`   ✅ SUCCESS! Cache properly handles different forced decisions for same user!`);
    } else {
      console.log(`   ❌ FAIL! Cache may be interfering with forced decisions`);
    }
    
  } catch (error) {
    console.log(`   ❌ Cache test failed: ${error.message}`);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('TEST COMPLETE');
  console.log('='.repeat(80));
}

// Run the test
testForcedDecisions().catch(console.error);