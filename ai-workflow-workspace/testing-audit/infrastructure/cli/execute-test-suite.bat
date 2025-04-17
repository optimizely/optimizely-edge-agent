@echo off
REM Enhanced Test Suite Executor with Absolute Path Resolution
REM Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)

setlocal enabledelayedexpansion

REM Get the absolute script directory
set "SCRIPT_DIR=%~dp0"
cd %SCRIPT_DIR%
cd ..\..\..
set "PROJECT_ROOT=%CD%"
set "ADAPTER_DIR=%PROJECT_ROOT%\ai-workflow-workspace\testing-audit\adapters"
set "EVIDENCE_DIR=%PROJECT_ROOT%\ai-workflow-workspace\testing-audit\evidence\results"
set "TEST_RUNNER=%PROJECT_ROOT%\ai-workflow-workspace\testing-audit\infrastructure\cli\run-test.js"

REM Create timestamp for this test run
set "TIMESTAMP=%date:~-4,4%-%date:~-7,2%-%date:~-10,2%T%time:~0,2%-%time:~3,2%-%time:~6,2%"
set "TIMESTAMP=%TIMESTAMP: =0%"

REM Define local environment (using Wrangler server)
set "BASE_URL=http://localhost:8787"

echo ====================================================================
echo Test Suite Execution (with Absolute Path Resolution)
echo Project Root: %PROJECT_ROOT%
echo Test Timestamp: %TIMESTAMP%
echo Local Environment: %BASE_URL%
echo ====================================================================
echo.

REM Create evidence directories if they don't exist
if not exist "%EVIDENCE_DIR%" mkdir "%EVIDENCE_DIR%"
if not exist "%EVIDENCE_DIR%\%TIMESTAMP%" mkdir "%EVIDENCE_DIR%\%TIMESTAMP%"

REM Create summary file
set "SUMMARY_FILE=%EVIDENCE_DIR%\%TIMESTAMP%\test-summary.md"

echo # Optimizely Edge Agent Test Execution Report > "%SUMMARY_FILE%"
echo. >> "%SUMMARY_FILE%"
echo **Date:** %date% >> "%SUMMARY_FILE%"
echo **Time:** %time% >> "%SUMMARY_FILE%"
echo **Environment:** Local (Wrangler) - %BASE_URL% >> "%SUMMARY_FILE%"
echo. >> "%SUMMARY_FILE%"
echo ## Test Results Summary >> "%SUMMARY_FILE%"
echo. >> "%SUMMARY_FILE%"
echo ^| Test ^| Status ^| Evidence ^| >> "%SUMMARY_FILE%"
echo ^| ---- ^| ------ ^| -------- ^| >> "%SUMMARY_FILE%"

REM Define test adapters to execute
set "TEST_ADAPTERS=infrastructure-verification-adapter decision-api-test-adapter kv-storage-tests-adapter parameter-validation-test-adapter forced-variation-tests-adapter parameter-handling-tests-adapter"

REM Execute each test adapter
for %%a in (%TEST_ADAPTERS%) do (
    echo.
    echo --------------------------------------------------------------------
    echo EXECUTING TEST: %%a
    echo --------------------------------------------------------------------
    
    REM Define output files
    set "LOG_FILE=%EVIDENCE_DIR%\%TIMESTAMP%\%%a-log.txt"
    set "RESULT_FILE=%EVIDENCE_DIR%\%TIMESTAMP%\%%a-result.json"
    
    echo Executing node "%TEST_RUNNER%" --test "%ADAPTER_DIR%\%%a.js" --base-url %BASE_URL% --output "%RESULT_FILE%"
    
    REM Execute test and capture output
    node "%TEST_RUNNER%" --test "%ADAPTER_DIR%\%%a.js" --base-url %BASE_URL% --output "%RESULT_FILE%" > "%LOG_FILE%" 2>&1
    
    REM Check if test succeeded by parsing the result file
    set "TEST_STATUS=❌ FAILED"
    findstr /C:"\"success\":true" "%RESULT_FILE%" > nul
    if not errorlevel 1 (
        set "TEST_STATUS=✅ PASSED"
    )
    
    echo Test completed: %TEST_STATUS%
    echo.
    
    REM Add to summary
    echo ^| %%a ^| %TEST_STATUS% ^| [Log](results/%TIMESTAMP%/%%a-log.txt) [Result](results/%TIMESTAMP%/%%a-result.json) ^| >> "%SUMMARY_FILE%"
)

echo.
echo ====================================================================
echo Test Execution Completed
echo Test Summary: "%SUMMARY_FILE%"
echo ====================================================================

REM Copy summary to main evidence directory for easier access
copy "%SUMMARY_FILE%" "%EVIDENCE_DIR%\latest-test-summary.md" > nul

echo.
echo Latest test summary copied to: "%EVIDENCE_DIR%\latest-test-summary.md"
echo.

endlocal 