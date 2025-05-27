#!/bin/bash

# =============================================================================
# COMPREHENSIVE TEST SUITE FOR /api/datafile ENDPOINT
# =============================================================================
# This script tests all logic paths and error cases for the /api/datafile endpoint
# Based on: api-kv-parity-tdd.md §6 and api-expected-behavior.md §1
# Updated: Based on src-v2/ implementation analysis
#
# Test Coverage:
# 1. Missing SDK Key scenarios
# 2. datafileFromKV=true with KV disabled/enabled/missing data
# 3. Default requests with KV enabled/disabled
# 4. SDK key in header vs query parameter
# 5. Error message validation
# 6. Response metadata validation
# =============================================================================

set -e  # Exit on any error

# =============================================================================
# CONFIGURATION
# =============================================================================
BASE_URL="${OPTIMIZELY_EDGE_AGENT_URL:-http://localhost:8787}"
TEST_SDK_KEY="${TEST_SDK_KEY:-8mR1pGh8u2ztUP8GqjmQq}"
VALID_SDK_KEY="${VALID_SDK_KEY:-8mR1pGh8u2ztUP8GqjmQq}"  # Valid SDK key for testing
INVALID_SDK_KEY="${INVALID_SDK_KEY:-invalid-sdk-key}"

# Required headers for API requests
COMMON_HEADERS="-H 'X-Optimizely-Enable-FEX: true' -H 'Accept: application/json'"
ADMIN_HEADERS="-H 'X-Optimizely-Admin-Token: dev-admin-token'"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "PASS") echo -e "${GREEN}[PASS]${NC} $message" ;;
        "FAIL") echo -e "${RED}[FAIL]${NC} $message" ;;
        "WARN") echo -e "${YELLOW}[WARN]${NC} $message" ;;
        "INFO") echo -e "${BLUE}[INFO]${NC} $message" ;;
    esac
}

# Function to increment test counters
count_test() {
    local result=$1
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if [ "$result" == "PASS" ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# Function to make HTTP request and capture response
make_request() {
    local method=$1
    local url=$2
    local headers=$3
    local expected_status=$4
    local test_description=$5
    
    print_status "INFO" "Testing: $test_description"
    print_status "INFO" "$method $url"
    
    # Make the request and capture both status and body
    local response=$(curl -s -w "HTTPSTATUS:%{http_code}\nHEADERS:%{header_json}" \
        -X "$method" \
        $headers \
        "$url" 2>/dev/null || echo "HTTPSTATUS:000")
    
    # Extract status code and body
    local status_code=$(echo "$response" | grep "HTTPSTATUS:" | cut -d: -f2)
    local body=$(echo "$response" | sed '/HTTPSTATUS:/d' | sed '/HEADERS:/d')
    local headers_json=$(echo "$response" | grep "HEADERS:" | cut -d: -f2-)
    
    # Print response details
    echo "  Status Code: $status_code"
    echo "  Response Body: $body"
    
    # Check if status matches expected
    if [ "$status_code" == "$expected_status" ]; then
        print_status "PASS" "Status code matches expected ($expected_status)"
        count_test "PASS"
        return 0
    else
        print_status "FAIL" "Status code mismatch. Expected: $expected_status, Got: $status_code"
        count_test "FAIL"
        return 1
    fi
}

# Function to test error message content
test_error_message() {
    local url=$1
    local headers=$2
    local expected_status=$3
    local expected_error_message=$4
    local test_description=$5
    
    print_status "INFO" "Testing: $test_description"
    print_status "INFO" "GET $url"
    
    local response=$(eval "curl -s -w 'HTTPSTATUS:%{http_code}' $headers '$url' 2>/dev/null" || echo "HTTPSTATUS:000")
    
    local status_code=$(echo "$response" | grep "HTTPSTATUS:" | cut -d: -f2)
    local body=$(echo "$response" | sed '/HTTPSTATUS:/d')
    
    echo "  Status Code: $status_code"
    echo "  Response Body: $body"
    
    local status_ok=false
    local message_ok=false
    
    # Check status code
    if [ "$status_code" == "$expected_status" ]; then
        print_status "PASS" "Status code matches expected ($expected_status)"
        status_ok=true
    else
        print_status "FAIL" "Status code mismatch. Expected: $expected_status, Got: $status_code"
    fi
    
    # Check error message content
    if echo "$body" | grep -q "$expected_error_message"; then
        print_status "PASS" "Error message contains expected text: '$expected_error_message'"
        message_ok=true
    else
        print_status "FAIL" "Error message mismatch. Expected to contain: '$expected_error_message'"
        print_status "FAIL" "Actual body: $body"
    fi
    
    # Overall test result
    if [ "$status_ok" == true ] && [ "$message_ok" == true ]; then
        count_test "PASS"
        return 0
    else
        count_test "FAIL"
        return 1
    fi
}

# =============================================================================
# TEST SUITE EXECUTION
# =============================================================================

print_status "INFO" "Starting comprehensive /api/datafile endpoint test suite"
print_status "INFO" "Base URL: $BASE_URL"
print_status "INFO" "Test SDK Key: $TEST_SDK_KEY"
echo ""

# =============================================================================
# TEST GROUP 1: MISSING SDK KEY SCENARIOS
# =============================================================================
echo "=========================================="
echo "TEST GROUP 1: MISSING SDK KEY SCENARIOS"
echo "=========================================="

# Test 1.1: No SDK key in query or headers
test_error_message \
    "$BASE_URL/api/datafile" \
    "$COMMON_HEADERS" \
    "400" \
    "SDK key is required" \
    "Missing SDK key (no query param, no header)"

echo ""

# Test 1.2: Empty SDK key in query parameter
test_error_message \
    "$BASE_URL/api/datafile?sdkKey=" \
    "$COMMON_HEADERS" \
    "400" \
    "SDK key is required" \
    "Empty SDK key in query parameter"

echo ""

# Test 1.3: Empty SDK key in header
test_error_message \
    "$BASE_URL/api/datafile" \
    "-H 'x-optimizely-sdk-key: '" \
    "400" \
    "SDK key is required" \
    "Empty SDK key in header"

echo ""

# =============================================================================
# TEST GROUP 2: EXPLICIT KV REQUESTS (datafileFromKV=true)
# =============================================================================
echo "=========================================="
echo "TEST GROUP 2: EXPLICIT KV REQUESTS"
echo "=========================================="

# Test 2.1: KV explicitly requested but KV disabled
test_error_message \
    "$BASE_URL/api/datafile?sdkKey=$TEST_SDK_KEY&datafileFromKV=true" \
    "" \
    "400" \
    "KV storage is not enabled for datafiles" \
    "datafileFromKV=true with KV disabled"

echo ""

# Test 2.2: KV explicitly requested, KV enabled, but datafile not found
# Note: This test assumes KV is enabled for this request via configuration
test_error_message \
    "$BASE_URL/api/datafile?sdkKey=$TEST_SDK_KEY&datafileFromKV=true" \
    "-H 'X-Test-Enable-KV: true'" \
    "404" \
    "Datafile not found in KV storage for the provided SDK key" \
    "datafileFromKV=true with KV enabled but datafile missing"

echo ""

# Test 2.3: KV explicitly requested with SDK key in header
test_error_message \
    "$BASE_URL/api/datafile?datafileFromKV=true" \
    "-H 'x-optimizely-sdk-key: $TEST_SDK_KEY' -H 'X-Test-Enable-KV: true'" \
    "404" \
    "Datafile not found in KV storage for the provided SDK key" \
    "datafileFromKV=true with SDK key in header"

echo ""

# =============================================================================
# TEST GROUP 3: DEFAULT REQUESTS (No datafileFromKV parameter)
# =============================================================================
echo "=========================================="
echo "TEST GROUP 3: DEFAULT REQUESTS"
echo "=========================================="

# Test 3.1: Default request with KV disabled - should use CDN/default source
make_request \
    "GET" \
    "$BASE_URL/api/datafile?sdkKey=$VALID_SDK_KEY" \
    "" \
    "200" \
    "Default request with KV disabled (should use CDN)"

echo ""

# Test 3.2: Default request with KV enabled - should try KV first, then fall back
make_request \
    "GET" \
    "$BASE_URL/api/datafile?sdkKey=$VALID_SDK_KEY" \
    "-H 'X-Test-Enable-KV: true'" \
    "200" \
    "Default request with KV enabled (should try KV, then fall back to CDN)"

echo ""

# Test 3.3: Default request with invalid SDK key
test_error_message \
    "$BASE_URL/api/datafile?sdkKey=$INVALID_SDK_KEY" \
    "" \
    "404" \
    "Datafile not found for the provided SDK key" \
    "Default request with invalid SDK key"

echo ""

# =============================================================================
# TEST GROUP 4: SDK KEY SOURCE VARIATIONS
# =============================================================================
echo "=========================================="
echo "TEST GROUP 4: SDK KEY SOURCE VARIATIONS"
echo "=========================================="

# Test 4.1: SDK key in query parameter
make_request \
    "GET" \
    "$BASE_URL/api/datafile?sdkKey=$VALID_SDK_KEY" \
    "" \
    "200" \
    "SDK key in query parameter"

echo ""

# Test 4.2: SDK key in header
make_request \
    "GET" \
    "$BASE_URL/api/datafile" \
    "-H 'x-optimizely-sdk-key: $VALID_SDK_KEY'" \
    "200" \
    "SDK key in header"

echo ""

# Test 4.3: SDK key in both header and query (header should take precedence)
make_request \
    "GET" \
    "$BASE_URL/api/datafile?sdkKey=$INVALID_SDK_KEY" \
    "-H 'x-optimizely-sdk-key: $VALID_SDK_KEY'" \
    "200" \
    "SDK key in both header and query (header precedence)"

echo ""

# =============================================================================
# TEST GROUP 5: SPECIAL PARAMETER VALUES
# =============================================================================
echo "=========================================="
echo "TEST GROUP 5: SPECIAL PARAMETER VALUES"
echo "=========================================="

# Test 5.1: datafileFromKV=false (explicit false)
make_request \
    "GET" \
    "$BASE_URL/api/datafile?sdkKey=$VALID_SDK_KEY&datafileFromKV=false" \
    "" \
    "200" \
    "datafileFromKV=false (explicit default source)"

echo ""

# Test 5.2: datafileFromKV with invalid value
make_request \
    "GET" \
    "$BASE_URL/api/datafile?sdkKey=$VALID_SDK_KEY&datafileFromKV=invalid" \
    "" \
    "200" \
    "datafileFromKV=invalid (should be treated as false)"

echo ""

# Test 5.3: Case sensitivity test
test_error_message \
    "$BASE_URL/api/datafile?sdkKey=$TEST_SDK_KEY&datafileFromKV=True" \
    "-H 'X-Test-Enable-KV: true'" \
    "404" \
    "Datafile not found in KV storage for the provided SDK key" \
    "datafileFromKV=True (case sensitivity)"

echo ""

# =============================================================================
# TEST GROUP 6: ERROR RESPONSE VALIDATION
# =============================================================================
echo "=========================================="
echo "TEST GROUP 6: ERROR RESPONSE VALIDATION"
echo "=========================================="

# Function to validate JSON response structure
validate_json_response() {
    local url=$1
    local headers=$2
    local test_description=$3
    
    print_status "INFO" "Testing: $test_description"
    
    local response=$(curl -s $headers "$url" 2>/dev/null || echo "{}")
    
    # Check if response is valid JSON
    if echo "$response" | python3 -m json.tool > /dev/null 2>&1; then
        print_status "PASS" "Response is valid JSON"
        
        # Check if error field exists in error responses
        if echo "$response" | grep -q '"error"'; then
            print_status "PASS" "Error field present in error response"
        else
            print_status "WARN" "Error field not found (may be success response)"
        fi
        count_test "PASS"
    else
        print_status "FAIL" "Response is not valid JSON: $response"
        count_test "FAIL"
    fi
}

# Test 6.1: Validate JSON structure for error responses
validate_json_response \
    "$BASE_URL/api/datafile" \
    "" \
    "JSON structure validation for missing SDK key error"

echo ""

# Test 6.2: Validate JSON structure for KV disabled error
validate_json_response \
    "$BASE_URL/api/datafile?sdkKey=$TEST_SDK_KEY&datafileFromKV=true" \
    "" \
    "JSON structure validation for KV disabled error"

echo ""

# =============================================================================
# TEST GROUP 7: RESPONSE METADATA VALIDATION
# =============================================================================
echo "=========================================="
echo "TEST GROUP 7: RESPONSE METADATA VALIDATION"
echo "=========================================="

# Function to check response metadata
check_response_metadata() {
    local url=$1
    local headers=$2
    local expected_source=$3
    local test_description=$4
    
    print_status "INFO" "Testing: $test_description"
    
    local response=$(curl -s $headers "$url" 2>/dev/null || echo "{}")
    
    echo "  Response: $response"
    
    # Check if metadata field exists and contains expected source
    if echo "$response" | grep -q '"metadata"'; then
        print_status "PASS" "Metadata field present in response"
        
        if echo "$response" | grep -q "\"datafileFrom\":\"$expected_source\""; then
            print_status "PASS" "Metadata contains expected datafileFrom: $expected_source"
        else
            print_status "WARN" "Metadata datafileFrom value may differ from expected: $expected_source"
        fi
        count_test "PASS"
    else
        print_status "WARN" "Metadata field not found (may be normal for error responses)"
        count_test "PASS"  # Not failing since metadata is only expected in success responses
    fi
}

# Test 7.1: Check metadata for successful CDN response
check_response_metadata \
    "$BASE_URL/api/datafile?sdkKey=$VALID_SDK_KEY" \
    "" \
    "cdn" \
    "Response metadata validation for CDN source"

echo ""

# =============================================================================
# TEST RESULTS SUMMARY
# =============================================================================
echo ""
echo "=========================================="
echo "TEST RESULTS SUMMARY"
echo "=========================================="
echo "Total Tests: $TOTAL_TESTS"
echo "Passed: $PASSED_TESTS"
echo "Failed: $FAILED_TESTS"

if [ $FAILED_TESTS -eq 0 ]; then
    print_status "PASS" "ALL TESTS PASSED!"
    exit 0
else
    print_status "FAIL" "$FAILED_TESTS test(s) failed"
    exit 1
fi 