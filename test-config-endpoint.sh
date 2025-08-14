#!/bin/bash

# Test script for the /api/config endpoint
# Make sure to update SDK_KEY with a valid SDK key

SDK_KEY="8mR1pGh8u2ztUP8GqjmQq"  # Replace with your SDK key
BASE_URL="http://localhost:8787"

echo "=== Testing Optimizely Config Endpoint ==="
echo ""

# Test 1: Get full config
echo "1. Testing full config retrieval:"
echo "curl -X GET \"${BASE_URL}/api/config?sdkKey=${SDK_KEY}\" -H \"X-Optimizely-Enable-FEX: true\""
curl -X GET "${BASE_URL}/api/config?sdkKey=${SDK_KEY}" -H "X-Optimizely-Enable-FEX: true" | jq '.'
echo ""
echo "---"
echo ""

# Test 2: Get summary only
echo "2. Testing summary mode:"
echo "curl -X GET \"${BASE_URL}/api/config?sdkKey=${SDK_KEY}&summary=true\" -H \"X-Optimizely-Enable-FEX: true\""
curl -X GET "${BASE_URL}/api/config?sdkKey=${SDK_KEY}&summary=true" -H "X-Optimizely-Enable-FEX: true" | jq '.'
echo ""
echo "---"
echo ""

# Test 3: Get features only with minimal format
echo "3. Testing features only with minimal format:"
echo "curl -X GET \"${BASE_URL}/api/config?sdkKey=${SDK_KEY}&include=features&format=minimal\" -H \"X-Optimizely-Enable-FEX: true\""
curl -X GET "${BASE_URL}/api/config?sdkKey=${SDK_KEY}&include=features&format=minimal" -H "X-Optimizely-Enable-FEX: true" | jq '.'
echo ""
echo "---"
echo ""

# Test 4: Test without metadata
echo "4. Testing without metadata:"
echo "curl -X GET \"${BASE_URL}/api/config?sdkKey=${SDK_KEY}&metadata=false&include=features&format=minimal\" -H \"X-Optimizely-Enable-FEX: true\""
curl -X GET "${BASE_URL}/api/config?sdkKey=${SDK_KEY}&metadata=false&include=features&format=minimal" -H "X-Optimizely-Enable-FEX: true" | jq '.'
echo ""
echo "---"
echo ""

# Test 5: Test specific feature lookup
echo "5. Testing feature lookup (replace 'test_feature' with an actual feature key):"
echo "curl -X GET \"${BASE_URL}/api/config?sdkKey=${SDK_KEY}&featureKey=test_feature\" -H \"X-Optimizely-Enable-FEX: true\""
curl -X GET "${BASE_URL}/api/config?sdkKey=${SDK_KEY}&featureKey=test_feature" -H "X-Optimizely-Enable-FEX: true" | jq '.'
echo ""
echo "---"
echo ""

# Test 6: Test lookup by key
echo "6. Testing lookup operations (replace 'test_feature' with an actual feature key):"
echo "curl -X GET \"${BASE_URL}/api/config?sdkKey=${SDK_KEY}&lookup=key&value=test_feature&type=feature\" -H \"X-Optimizely-Enable-FEX: true\""
curl -X GET "${BASE_URL}/api/config?sdkKey=${SDK_KEY}&lookup=key&value=test_feature&type=feature" -H "X-Optimizely-Enable-FEX: true" | jq '.'
echo ""
echo "---"
echo ""

# Test 7: Test exclude functionality
echo "7. Testing exclude functionality:"
echo "curl -X GET \"${BASE_URL}/api/config?sdkKey=${SDK_KEY}&exclude=audiences,events\" -H \"X-Optimizely-Enable-FEX: true\""
curl -X GET "${BASE_URL}/api/config?sdkKey=${SDK_KEY}&exclude=audiences,events" -H "X-Optimizely-Enable-FEX: true" | jq '.'
echo ""
echo "---"
echo ""

# Test 8: Test error case - no SDK key
echo "8. Testing error case - no SDK key:"
echo "curl -X GET \"${BASE_URL}/api/config\" -H \"X-Optimizely-Enable-FEX: true\""
curl -X GET "${BASE_URL}/api/config" -H "X-Optimizely-Enable-FEX: true" | jq '.'
echo ""
echo "---"
echo ""

# Test 9: Test error case - wrong method
echo "9. Testing error case - POST method (should fail):"
echo "curl -X POST \"${BASE_URL}/api/config?sdkKey=${SDK_KEY}\" -H \"X-Optimizely-Enable-FEX: true\""
curl -X POST "${BASE_URL}/api/config?sdkKey=${SDK_KEY}" -H "X-Optimizely-Enable-FEX: true" | jq '.'
echo ""
echo "---"
echo ""

# Test 10: Test with SDK key in header
echo "10. Testing with SDK key in header:"
echo "curl -X GET \"${BASE_URL}/api/config\" -H \"X-Optimizely-Enable-FEX: true\" -H \"X-Optimizely-SDK-Key: ${SDK_KEY}\""
curl -X GET "${BASE_URL}/api/config" -H "X-Optimizely-Enable-FEX: true" -H "X-Optimizely-SDK-Key: ${SDK_KEY}" | jq '.' | head -20
echo "... (truncated)"
echo ""

echo "=== Config Endpoint Tests Complete ==="