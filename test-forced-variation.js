const https = require('https');
const http = require('http');

// Request data
const data = JSON.stringify({
  userId: "test-user-node",
  flagKey: "test-flag",
  attributes: {
    forcedDecisions: {
      "test-flag": {
        variationKey: "on" // lowercase "on" is the key test case
      }
    }
  }
});

// Request options
const options = {
  hostname: '127.0.0.1',
  port: 8787,
  path: '/api/decide',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    'X-Optimizely-SDK-Key': '8mR1pGh8u2ztUP8GqjmQq'
  }
};

// Make request
const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log('RESPONSE BODY:');
    try {
      const parsedData = JSON.parse(responseData);
      console.log(JSON.stringify(parsedData, null, 2));
      
      // Check if variation matches our forced value
      if (parsedData.variationKey === "on") {
        console.log("✅ SUCCESS: Lowercase 'on' variation correctly preserved!");
      } else {
        console.log(`❌ FAIL: Expected variation 'on' but got '${parsedData.variationKey}'`);
      }
    } catch (e) {
      console.log(responseData);
      console.log(`Error parsing response: ${e.message}`);
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

// Write data to request body
req.write(data);
req.end();

console.log('Request sent, waiting for response...'); 