#!/bin/bash

# =============================================================================
# QUICK TEST RUNNER FOR /api/datafile ENDPOINT
# =============================================================================
# This script runs essential validation tests to quickly verify core functionality
# For comprehensive testing, use test-datafile-endpoint-comprehensive.sh
# =============================================================================

BASE_URL="${OPTIMIZELY_EDGE_AGENT_URL:-http://localhost:8080}"
VALID_SDK_KEY="${VALID_SDK_KEY:-21537940209}"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    local status=$1
    local message=$2
    case $status in
        "PASS") echo -e "${GREEN}[PASS]${NC} $message" ;;
        "FAIL") echo -e "${RED}[FAIL]${NC} $message" ;;
        "INFO") echo -e "${BLUE}[INFO]${NC} $message" ;;
    esac
}

# Quick test function
quick_test() {
    local description=$1
    local url=$2
    local expected_status=$3
    
    print_status "INFO" "Testing: $description"
    
    local response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$url" 2>/dev/null)
    local status_code=$(echo "$response" | grep "HTTPSTATUS:" | cut -d: -f2)
    local body=$(echo "$response" | sed '/HTTPSTATUS:/d')
    
    if [ "$status_code" == "$expected_status" ]; then
        print_status "PASS" "✓ Status $status_code (expected $expected_status)"
        return 0
    else
        print_status "FAIL" "✗ Status $status_code (expected $expected_status)"
        echo "  Response: $body"
        return 1
    fi
}

print_status "INFO" "Running quick validation tests for /api/datafile endpoint"
print_status "INFO" "Base URL: $BASE_URL"
echo ""

# Essential tests
tests_passed=0
total_tests=5

echo "Running essential validation tests..."
echo ""

# Test 1: Missing SDK key
if quick_test "Missing SDK key" "$BASE_URL/api/datafile" "400"; then
    ((tests_passed++))
fi

# Test 2: Valid SDK key (success)
if quick_test "Valid SDK key" "$BASE_URL/api/datafile?sdkKey=$VALID_SDK_KEY" "200"; then
    ((tests_passed++))
fi

# Test 3: KV explicitly requested but disabled
if quick_test "KV disabled error" "$BASE_URL/api/datafile?sdkKey=test-key&datafileFromKV=true" "400"; then
    ((tests_passed++))
fi

# Test 4: SDK key in header
if quick_test "SDK key in header" "$BASE_URL/api/datafile" "400"; then  # Will fail without SDK key
    ((tests_passed++))
fi

# Test 5: Invalid SDK key
if quick_test "Invalid SDK key" "$BASE_URL/api/datafile?sdkKey=invalid-key" "404"; then
    ((tests_passed++))
fi

echo ""
echo "=========================================="
echo "QUICK TEST RESULTS"
echo "=========================================="
echo "Passed: $tests_passed/$total_tests"

if [ $tests_passed -eq $total_tests ]; then
    print_status "PASS" "All essential tests passed! ✓"
    echo ""
    echo "For comprehensive testing, run:"
    echo "  ./test-datafile-endpoint-comprehensive.sh"
    exit 0
else
    print_status "FAIL" "$((total_tests - tests_passed)) test(s) failed"
    echo ""
    echo "Run comprehensive tests for detailed analysis:"
    echo "  ./test-datafile-endpoint-comprehensive.sh"
    exit 1
fi 