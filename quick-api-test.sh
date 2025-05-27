#!/bin/bash

# Quick API validation test
BASE_URL="http://localhost:8787"
SDK_KEY="8mR1pGh8u2ztUP8GqjmQq"
HEADERS="-H 'X-Optimizely-Enable-FEX: true' -H 'Accept: application/json'"

echo "=== API Validation Tests ==="
echo

echo "Test 1: Missing SDK Key (should return 400)"
RESPONSE=$(curl -s -w "STATUS:%{http_code}" -H "X-Optimizely-Enable-FEX: true" -H "Accept: application/json" "$BASE_URL/api/datafile")
STATUS=$(echo "$RESPONSE" | grep -o "STATUS:[0-9]*" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed 's/STATUS:[0-9]*$//')
echo "Status: $STATUS"
echo "Body: $BODY"
if [ "$STATUS" = "400" ] && echo "$BODY" | grep -q "SDK key is required"; then
    echo "✅ PASS"
else
    echo "❌ FAIL"
fi
echo

echo "Test 2: Valid SDK Key (should return 200 with datafile)"
RESPONSE=$(curl -s -w "STATUS:%{http_code}" -H "X-Optimizely-Enable-FEX: true" -H "Accept: application/json" "$BASE_URL/api/datafile?sdkKey=$SDK_KEY")
STATUS=$(echo "$RESPONSE" | grep -o "STATUS:[0-9]*" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed 's/STATUS:[0-9]*$//')
echo "Status: $STATUS"
echo "Body length: $(echo "$BODY" | wc -c)"
if [ "$STATUS" = "200" ] && echo "$BODY" | grep -q "featureFlags"; then
    echo "✅ PASS"
else
    echo "❌ FAIL"
fi
echo

echo "Test 3: Invalid SDK Key (should return 404)"
RESPONSE=$(curl -s -w "STATUS:%{http_code}" -H "X-Optimizely-Enable-FEX: true" -H "Accept: application/json" "$BASE_URL/api/datafile?sdkKey=invalid-key")
STATUS=$(echo "$RESPONSE" | grep -o "STATUS:[0-9]*" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed 's/STATUS:[0-9]*$//')
echo "Status: $STATUS"
echo "Body: $BODY"
if [ "$STATUS" = "404" ] && echo "$BODY" | grep -q "not found"; then
    echo "✅ PASS"
else
    echo "❌ FAIL"
fi
echo

echo "Test 4: Flag Keys Endpoint (should return 200 with flag keys)"
RESPONSE=$(curl -s -w "STATUS:%{http_code}" -H "X-Optimizely-Enable-FEX: true" -H "Accept: application/json" "$BASE_URL/api/flagkeys?sdkKey=$SDK_KEY")
STATUS=$(echo "$RESPONSE" | grep -o "STATUS:[0-9]*" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed 's/STATUS:[0-9]*$//')
echo "Status: $STATUS"
echo "Body: $BODY"
if [ "$STATUS" = "200" ] && echo "$BODY" | grep -q "flagKeys"; then
    echo "✅ PASS"
else
    echo "❌ FAIL"
fi
echo

echo "=== Tests Complete ==="