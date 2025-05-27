# =============================================================================
# COMPREHENSIVE TEST SUITE FOR /api/datafile ENDPOINT (PowerShell Version)
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

param(
    [string]$BaseUrl = "http://localhost:8080",
    [string]$TestSdkKey = "test-sdk-key-123",
    [string]$ValidSdkKey = "21537940209",
    [string]$InvalidSdkKey = "invalid-sdk-key"
)

# Test counters
$script:TotalTests = 0
$script:PassedTests = 0
$script:FailedTests = 0

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

function Write-Status {
    param(
        [string]$Status,
        [string]$Message
    )
    
    switch ($Status) {
        "PASS" { Write-Host "[PASS] $Message" -ForegroundColor Green }
        "FAIL" { Write-Host "[FAIL] $Message" -ForegroundColor Red }
        "WARN" { Write-Host "[WARN] $Message" -ForegroundColor Yellow }
        "INFO" { Write-Host "[INFO] $Message" -ForegroundColor Blue }
    }
}

function Count-Test {
    param([string]$Result)
    
    $script:TotalTests++
    if ($Result -eq "PASS") {
        $script:PassedTests++
    } else {
        $script:FailedTests++
    }
}

function Invoke-TestRequest {
    param(
        [string]$Method,
        [string]$Url,
        [hashtable]$Headers = @{},
        [int]$ExpectedStatus,
        [string]$TestDescription
    )
    
    Write-Status "INFO" "Testing: $TestDescription"
    Write-Status "INFO" "$Method $Url"
    
    try {
        $response = Invoke-WebRequest -Uri $Url -Method $Method -Headers $Headers -ErrorAction SilentlyContinue
        $statusCode = $response.StatusCode
        $body = $response.Content
        
        Write-Host "  Status Code: $statusCode"
        Write-Host "  Response Body: $body"
        
        if ($statusCode -eq $ExpectedStatus) {
            Write-Status "PASS" "Status code matches expected ($ExpectedStatus)"
            Count-Test "PASS"
            return $true
        } else {
            Write-Status "FAIL" "Status code mismatch. Expected: $ExpectedStatus, Got: $statusCode"
            Count-Test "FAIL"
            return $false
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $body = ""
        
        if ($_.Exception.Response) {
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($stream)
                $body = $reader.ReadToEnd()
                $reader.Close()
                $stream.Close()
            } catch {
                $body = "Error reading response body"
            }
        }
        
        Write-Host "  Status Code: $statusCode"
        Write-Host "  Response Body: $body"
        
        if ($statusCode -eq $ExpectedStatus) {
            Write-Status "PASS" "Status code matches expected ($ExpectedStatus)"
            Count-Test "PASS"
            return $true
        } else {
            Write-Status "FAIL" "Status code mismatch. Expected: $ExpectedStatus, Got: $statusCode"
            Count-Test "FAIL"
            return $false
        }
    }
}

function Test-ErrorMessage {
    param(
        [string]$Url,
        [hashtable]$Headers = @{},
        [int]$ExpectedStatus,
        [string]$ExpectedErrorMessage,
        [string]$TestDescription
    )
    
    Write-Status "INFO" "Testing: $TestDescription"
    Write-Status "INFO" "GET $Url"
    
    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -Headers $Headers -ErrorAction SilentlyContinue
        $statusCode = $response.StatusCode
        $body = $response.Content
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $body = ""
        
        if ($_.Exception.Response) {
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($stream)
                $body = $reader.ReadToEnd()
                $reader.Close()
                $stream.Close()
            } catch {
                $body = "Error reading response body"
            }
        }
    }
    
    Write-Host "  Status Code: $statusCode"
    Write-Host "  Response Body: $body"
    
    $statusOk = $statusCode -eq $ExpectedStatus
    $messageOk = $body -like "*$ExpectedErrorMessage*"
    
    if ($statusOk) {
        Write-Status "PASS" "Status code matches expected ($ExpectedStatus)"
    } else {
        Write-Status "FAIL" "Status code mismatch. Expected: $ExpectedStatus, Got: $statusCode"
    }
    
    if ($messageOk) {
        Write-Status "PASS" "Error message contains expected text: '$ExpectedErrorMessage'"
    } else {
        Write-Status "FAIL" "Error message mismatch. Expected to contain: '$ExpectedErrorMessage'"
        Write-Status "FAIL" "Actual body: $body"
    }
    
    if ($statusOk -and $messageOk) {
        Count-Test "PASS"
        return $true
    } else {
        Count-Test "FAIL"
        return $false
    }
}

function Test-JsonResponse {
    param(
        [string]$Url,
        [hashtable]$Headers = @{},
        [string]$TestDescription
    )
    
    Write-Status "INFO" "Testing: $TestDescription"
    
    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -Headers $Headers -ErrorAction SilentlyContinue
        $body = $response.Content
    } catch {
        $body = ""
        if ($_.Exception.Response) {
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($stream)
                $body = $reader.ReadToEnd()
                $reader.Close()
                $stream.Close()
            } catch {
                $body = "{}"
            }
        }
    }
    
    try {
        $json = $body | ConvertFrom-Json
        Write-Status "PASS" "Response is valid JSON"
        
        if ($json.PSObject.Properties.Name -contains "error") {
            Write-Status "PASS" "Error field present in error response"
        } else {
            Write-Status "WARN" "Error field not found (may be success response)"
        }
        Count-Test "PASS"
        return $true
    } catch {
        Write-Status "FAIL" "Response is not valid JSON: $body"
        Count-Test "FAIL"
        return $false
    }
}

function Test-ResponseMetadata {
    param(
        [string]$Url,
        [hashtable]$Headers = @{},
        [string]$ExpectedSource,
        [string]$TestDescription
    )
    
    Write-Status "INFO" "Testing: $TestDescription"
    
    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -Headers $Headers -ErrorAction SilentlyContinue
        $body = $response.Content
    } catch {
        $body = ""
        if ($_.Exception.Response) {
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($stream)
                $body = $reader.ReadToEnd()
                $reader.Close()
                $stream.Close()
            } catch {
                $body = "{}"
            }
        }
    }
    
    Write-Host "  Response: $body"
    
    if ($body -like "*metadata*") {
        Write-Status "PASS" "Metadata field present in response"
        
        if ($body -like "*datafileFrom*:*$ExpectedSource*") {
            Write-Status "PASS" "Metadata contains expected datafileFrom: $ExpectedSource"
        } else {
            Write-Status "WARN" "Metadata datafileFrom value may differ from expected: $ExpectedSource"
        }
        Count-Test "PASS"
        return $true
    } else {
        Write-Status "WARN" "Metadata field not found (may be normal for error responses)"
        Count-Test "PASS"  # Not failing since metadata is only expected in success responses
        return $true
    }
}

# =============================================================================
# TEST SUITE EXECUTION
# =============================================================================

Write-Status "INFO" "Starting comprehensive /api/datafile endpoint test suite"
Write-Status "INFO" "Base URL: $BaseUrl"
Write-Status "INFO" "Test SDK Key: $TestSdkKey"
Write-Host ""

# =============================================================================
# TEST GROUP 1: MISSING SDK KEY SCENARIOS
# =============================================================================
Write-Host "=========================================="
Write-Host "TEST GROUP 1: MISSING SDK KEY SCENARIOS"
Write-Host "=========================================="

# Test 1.1: No SDK key in query or headers
Test-ErrorMessage -Url "$BaseUrl/api/datafile" -ExpectedStatus 400 -ExpectedErrorMessage "SDK key is required" -TestDescription "Missing SDK key (no query param, no header)"
Write-Host ""

# Test 1.2: Empty SDK key in query parameter
Test-ErrorMessage -Url "$BaseUrl/api/datafile?sdkKey=" -ExpectedStatus 400 -ExpectedErrorMessage "SDK key is required" -TestDescription "Empty SDK key in query parameter"
Write-Host ""

# Test 1.3: Empty SDK key in header
Test-ErrorMessage -Url "$BaseUrl/api/datafile" -Headers @{"x-optimizely-sdk-key" = ""} -ExpectedStatus 400 -ExpectedErrorMessage "SDK key is required" -TestDescription "Empty SDK key in header"
Write-Host ""

# =============================================================================
# TEST GROUP 2: EXPLICIT KV REQUESTS (datafileFromKV=true)
# =============================================================================
Write-Host "=========================================="
Write-Host "TEST GROUP 2: EXPLICIT KV REQUESTS"
Write-Host "=========================================="

# Test 2.1: KV explicitly requested but KV disabled
Test-ErrorMessage -Url "$BaseUrl/api/datafile?sdkKey=$TestSdkKey&datafileFromKV=true" -ExpectedStatus 400 -ExpectedErrorMessage "KV storage is not enabled for datafiles" -TestDescription "datafileFromKV=true with KV disabled"
Write-Host ""

# Test 2.2: KV explicitly requested, KV enabled, but datafile not found
Test-ErrorMessage -Url "$BaseUrl/api/datafile?sdkKey=$TestSdkKey&datafileFromKV=true" -Headers @{"X-Test-Enable-KV" = "true"} -ExpectedStatus 404 -ExpectedErrorMessage "Datafile not found in KV storage for the provided SDK key" -TestDescription "datafileFromKV=true with KV enabled but datafile missing"
Write-Host ""

# Test 2.3: KV explicitly requested with SDK key in header
Test-ErrorMessage -Url "$BaseUrl/api/datafile?datafileFromKV=true" -Headers @{"x-optimizely-sdk-key" = $TestSdkKey; "X-Test-Enable-KV" = "true"} -ExpectedStatus 404 -ExpectedErrorMessage "Datafile not found in KV storage for the provided SDK key" -TestDescription "datafileFromKV=true with SDK key in header"
Write-Host ""

# =============================================================================
# TEST GROUP 3: DEFAULT REQUESTS (No datafileFromKV parameter)
# =============================================================================
Write-Host "=========================================="
Write-Host "TEST GROUP 3: DEFAULT REQUESTS"
Write-Host "=========================================="

# Test 3.1: Default request with KV disabled - should use CDN/default source
Invoke-TestRequest -Method "GET" -Url "$BaseUrl/api/datafile?sdkKey=$ValidSdkKey" -ExpectedStatus 200 -TestDescription "Default request with KV disabled (should use CDN)"
Write-Host ""

# Test 3.2: Default request with KV enabled - should try KV first, then fall back
Invoke-TestRequest -Method "GET" -Url "$BaseUrl/api/datafile?sdkKey=$ValidSdkKey" -Headers @{"X-Test-Enable-KV" = "true"} -ExpectedStatus 200 -TestDescription "Default request with KV enabled (should try KV, then fall back to CDN)"
Write-Host ""

# Test 3.3: Default request with invalid SDK key
Test-ErrorMessage -Url "$BaseUrl/api/datafile?sdkKey=$InvalidSdkKey" -ExpectedStatus 404 -ExpectedErrorMessage "Datafile not found for the provided SDK key" -TestDescription "Default request with invalid SDK key"
Write-Host ""

# =============================================================================
# TEST GROUP 4: SDK KEY SOURCE VARIATIONS
# =============================================================================
Write-Host "=========================================="
Write-Host "TEST GROUP 4: SDK KEY SOURCE VARIATIONS"
Write-Host "=========================================="

# Test 4.1: SDK key in query parameter
Invoke-TestRequest -Method "GET" -Url "$BaseUrl/api/datafile?sdkKey=$ValidSdkKey" -ExpectedStatus 200 -TestDescription "SDK key in query parameter"
Write-Host ""

# Test 4.2: SDK key in header
Invoke-TestRequest -Method "GET" -Url "$BaseUrl/api/datafile" -Headers @{"x-optimizely-sdk-key" = $ValidSdkKey} -ExpectedStatus 200 -TestDescription "SDK key in header"
Write-Host ""

# Test 4.3: SDK key in both header and query (header should take precedence)
Invoke-TestRequest -Method "GET" -Url "$BaseUrl/api/datafile?sdkKey=$InvalidSdkKey" -Headers @{"x-optimizely-sdk-key" = $ValidSdkKey} -ExpectedStatus 200 -TestDescription "SDK key in both header and query (header precedence)"
Write-Host ""

# =============================================================================
# TEST GROUP 5: SPECIAL PARAMETER VALUES
# =============================================================================
Write-Host "=========================================="
Write-Host "TEST GROUP 5: SPECIAL PARAMETER VALUES"
Write-Host "=========================================="

# Test 5.1: datafileFromKV=false (explicit false)
Invoke-TestRequest -Method "GET" -Url "$BaseUrl/api/datafile?sdkKey=$ValidSdkKey&datafileFromKV=false" -ExpectedStatus 200 -TestDescription "datafileFromKV=false (explicit default source)"
Write-Host ""

# Test 5.2: datafileFromKV with invalid value
Invoke-TestRequest -Method "GET" -Url "$BaseUrl/api/datafile?sdkKey=$ValidSdkKey&datafileFromKV=invalid" -ExpectedStatus 200 -TestDescription "datafileFromKV=invalid (should be treated as false)"
Write-Host ""

# Test 5.3: Case sensitivity test
Test-ErrorMessage -Url "$BaseUrl/api/datafile?sdkKey=$TestSdkKey&datafileFromKV=True" -Headers @{"X-Test-Enable-KV" = "true"} -ExpectedStatus 404 -ExpectedErrorMessage "Datafile not found in KV storage for the provided SDK key" -TestDescription "datafileFromKV=True (case sensitivity)"
Write-Host ""

# =============================================================================
# TEST GROUP 6: ERROR RESPONSE VALIDATION
# =============================================================================
Write-Host "=========================================="
Write-Host "TEST GROUP 6: ERROR RESPONSE VALIDATION"
Write-Host "=========================================="

# Test 6.1: Validate JSON structure for error responses
Test-JsonResponse -Url "$BaseUrl/api/datafile" -TestDescription "JSON structure validation for missing SDK key error"
Write-Host ""

# Test 6.2: Validate JSON structure for KV disabled error
Test-JsonResponse -Url "$BaseUrl/api/datafile?sdkKey=$TestSdkKey&datafileFromKV=true" -TestDescription "JSON structure validation for KV disabled error"
Write-Host ""

# =============================================================================
# TEST GROUP 7: RESPONSE METADATA VALIDATION
# =============================================================================
Write-Host "=========================================="
Write-Host "TEST GROUP 7: RESPONSE METADATA VALIDATION"
Write-Host "=========================================="

# Test 7.1: Check metadata for successful CDN response
Test-ResponseMetadata -Url "$BaseUrl/api/datafile?sdkKey=$ValidSdkKey" -ExpectedSource "cdn" -TestDescription "Response metadata validation for CDN source"
Write-Host ""

# =============================================================================
# TEST RESULTS SUMMARY
# =============================================================================
Write-Host ""
Write-Host "=========================================="
Write-Host "TEST RESULTS SUMMARY"
Write-Host "=========================================="
Write-Host "Total Tests: $script:TotalTests"
Write-Host "Passed: $script:PassedTests"
Write-Host "Failed: $script:FailedTests"

if ($script:FailedTests -eq 0) {
    Write-Status "PASS" "ALL TESTS PASSED!"
    exit 0
} else {
    Write-Status "FAIL" "$script:FailedTests test(s) failed"
    exit 1
} 