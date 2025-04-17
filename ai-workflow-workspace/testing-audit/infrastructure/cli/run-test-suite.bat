@echo off
REM Test Suite Runner with Evidence Collection
REM Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)

setlocal enabledelayedexpansion

REM Get the script directory to use as base for all paths
set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%..\..\.."

REM Set up environment
set BASE_URL=http://localhost:8787
set LIVE_URL=https://edge-agent-test.expedge.workers.dev
set EVIDENCE_DIR=%PROJECT_ROOT%\evidence\results
set TIMESTAMP=%date:~-4,4%-%date:~-7,2%-%date:~-10,2%T%time:~0,2%-%time:~3,2%-%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%

echo Script directory: %SCRIPT_DIR%
echo Project root: %PROJECT_ROOT%
echo Evidence directory: %EVIDENCE_DIR%

REM Create evidence directory if it doesn't exist
if not exist "%EVIDENCE_DIR%" mkdir "%EVIDENCE_DIR%"

REM Create test run manifest
echo Test Run Started: %TIMESTAMP% > "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md"
echo Base URL (Local): %BASE_URL% >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md"
echo Live URL: %LIVE_URL% >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md"
echo Environment Variables: >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md"
echo   CLOUDFLARE_WORKER_URL: %CLOUDFLARE_WORKER_URL% >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md"
echo   OPTIMIZELY_SDK_KEY: [Set] >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md"
echo. >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md"
echo ## Test Results >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md"
echo. >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md"

REM Basic test first
echo ### Running Basic Test (Local) >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md"
echo. >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md"
echo ```log >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md"
node "%SCRIPT_DIR%run-test.js" --test "%SCRIPT_DIR%..\examples\basic-test.js" --base-url %BASE_URL% --output "%EVIDENCE_DIR%\basic-test-local-%TIMESTAMP%.json" >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md" 2>&1
echo ``` >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md"
echo. >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md"

REM Same test in live environment
echo ### Running Basic Test (Live) >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md"
echo. >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md"
echo ```log >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md"
node "%SCRIPT_DIR%run-test.js" --test "%SCRIPT_DIR%..\examples\basic-test.js" --base-url %LIVE_URL% --output "%EVIDENCE_DIR%\basic-test-live-%TIMESTAMP%.json" >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md" 2>&1
echo ``` >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md"
echo. >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md"

REM Comparison test
echo ### Running Basic Test (Comparison) >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md"
echo. >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md"
echo ```log >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md"
node "%SCRIPT_DIR%run-test.js" --test "%SCRIPT_DIR%..\examples\basic-test.js" --compare --output "%EVIDENCE_DIR%\basic-test-comparison-%TIMESTAMP%.json" >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md" 2>&1
echo ``` >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md"
echo. >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md"

REM Run tests from the catalog
echo ### Running Tests from Catalog >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md"
echo. >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md"

REM Find test files and adapt them for environment-aware testing
for %%t in (infrastructure-verification decision-api-test parameter-validation-test forced-variation-tests parameter-handling-tests kv-storage-tests cdn-variation-test lowercase-variation-test feature-parity-test) do (
    echo #### Running %%t Test (Comparison) >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md"
    echo. >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md"
    
    REM Check if test adapter exists for this test
    if exist "%PROJECT_ROOT%\adapters\%%t-adapter.js" (
        echo ```log >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md"
        node "%SCRIPT_DIR%run-test.js" --test "%PROJECT_ROOT%\adapters\%%t-adapter.js" --compare --output "%EVIDENCE_DIR%\%%t-comparison-%TIMESTAMP%.json" >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md" 2>&1
        echo ``` >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md"
    ) else (
        echo Test adapter for %%t not found. Skipping. >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md"
    )
    echo. >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md"
)

REM Final summary
echo ## Summary >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md"
echo. >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md"
echo Test run completed at %date% %time% >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md"
echo Evidence files stored in %EVIDENCE_DIR% >> "%EVIDENCE_DIR%\test-run-%TIMESTAMP%.md"

echo.
echo Test run completed.
echo Evidence stored in %EVIDENCE_DIR%\test-run-%TIMESTAMP%.md

endlocal 