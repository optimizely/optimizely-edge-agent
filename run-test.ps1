$env:EDGE_AGENT_URL = "http://127.0.0.1:8787"
$env:SDK_KEY = "8mR1pGh8u2ztUP8GqjmQq"
$env:LOG_LEVEL = "debug"

Write-Host "Running forced variation tests..."
Write-Host "EDGE_AGENT_URL: $env:EDGE_AGENT_URL"
Write-Host "SDK_KEY: $env:SDK_KEY"
Write-Host "LOG_LEVEL: $env:LOG_LEVEL"
Write-Host "------------------------------------------------------------"

Set-Location $PSScriptRoot
Set-Location final-tests-validation\test-scripts

Write-Host "Executing: node forced-variation-tests.js"
try {
    $output = node forced-variation-tests.js 2>&1
    $output | Out-String | Write-Host
    
    # Check if results were saved
    if ($output -match "Results saved to (.+)\.json") {
        $jsonFile = $matches[1] + ".json"
        if (Test-Path $jsonFile) {
            Write-Host "Test results saved to: $jsonFile"
        }
        
        $mdFile = $matches[1] + ".md"
        if (Test-Path $mdFile) {
            Write-Host "Test summary saved to: $mdFile"
            Write-Host "------------------------------------------------------------"
            Write-Host "Summary content:"
            Get-Content $mdFile | Write-Host
        }
    }
} catch {
    Write-Host "Error executing test script: $_"
} 