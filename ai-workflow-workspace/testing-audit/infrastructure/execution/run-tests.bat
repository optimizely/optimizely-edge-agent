@echo off
rem Windows Batch Script for Running Edge Agent Tests
rem Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)

setlocal enabledelayedexpansion

rem Set variables for paths and runners
set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%\..\..\..\..
set TEST_RUNNER=%SCRIPT_DIR%\run-tests.js
set NODE_CMD=node

rem Display header
echo.
echo Edge Agent Test Execution (Windows)
echo ================================
echo.

rem Process command-line arguments
set ARGS=
:parse_args
if "%~1"=="" goto end_parse_args
set ARGS=%ARGS% %1
shift
goto parse_args
:end_parse_args

rem Check if help was requested
echo %ARGS% | findstr /C:"--help" /C:"-h" >nul
if %ERRORLEVEL% EQU 0 (
    call %NODE_CMD% "%TEST_RUNNER%" --help
    goto :eof
)

rem Check if list tests was requested
echo %ARGS% | findstr /C:"--list" /C:"-l" >nul
if %ERRORLEVEL% EQU 0 (
    call %NODE_CMD% "%TEST_RUNNER%" --list
    goto :eof
)

rem Display run information
echo Working directory: %PROJECT_ROOT%
echo Test runner: %TEST_RUNNER%
echo Command: %NODE_CMD% "%TEST_RUNNER%" %ARGS%
echo.
echo Starting test execution...
echo.

rem Run the test runner with all arguments
call %NODE_CMD% "%TEST_RUNNER%" %ARGS%

rem Store exit code
set EXIT_CODE=%ERRORLEVEL%

rem Display completion message
echo.
if %EXIT_CODE% EQU 0 (
    echo Test execution completed successfully.
) else (
    echo Test execution completed with errors. Exit code: %EXIT_CODE%
)

exit /b %EXIT_CODE% 