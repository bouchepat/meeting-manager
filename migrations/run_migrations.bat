@echo off
REM Database Migration Runner for Meeting Manager (Windows)
REM This script runs migrations inside the Docker MySQL container

setlocal EnableDelayedExpansion

REM Database configuration
set DB_CONTAINER=meeting-manager-db
set DB_USER=meetinguser
set DB_PASSWORD=meetingpass
set DB_NAME=meeting_manager

REM Colors aren't easily supported in batch, using plain text
set INFO_PREFIX=[INFO]
set WARNING_PREFIX=[WARNING]
set ERROR_PREFIX=[ERROR]

REM Check if Docker container is running
:check_container
docker ps | findstr /C:"%DB_CONTAINER%" >nul 2>&1
if errorlevel 1 (
    echo %ERROR_PREFIX% Database container '%DB_CONTAINER%' is not running!
    echo %INFO_PREFIX% Please start the container with: docker-compose up -d
    exit /b 1
)
echo %INFO_PREFIX% Database container is running

REM Get command
set COMMAND=%1
if "%COMMAND%"=="" set COMMAND=help

if "%COMMAND%"=="migrate" goto run_migrate
if "%COMMAND%"=="seed" goto run_seed
if "%COMMAND%"=="fresh" goto run_fresh
if "%COMMAND%"=="reset" goto run_reset
if "%COMMAND%"=="file" goto run_file
if "%COMMAND%"=="help" goto show_help
if "%COMMAND%"=="--help" goto show_help
if "%COMMAND%"=="-h" goto show_help

echo %ERROR_PREFIX% Unknown command: %COMMAND%
goto show_help

:run_migrate
echo %INFO_PREFIX% === Running Schema Migrations ===
for %%f in (migrations\schema\[0-9]*.sql) do (
    echo %INFO_PREFIX% Running migration: %%~nxf
    type "%%f" | docker exec -i %DB_CONTAINER% mysql -u%DB_USER% -p%DB_PASSWORD% %DB_NAME% 2^>nul
    if errorlevel 1 (
        echo %ERROR_PREFIX% Failed to execute: %%~nxf
        exit /b 1
    )
    echo %INFO_PREFIX% Successfully executed: %%~nxf
)
echo %INFO_PREFIX% All migrations completed successfully!
goto :eof

:run_seed
echo %INFO_PREFIX% === Running Seed Data ===
for %%f in (migrations\schema\1[0-9][0-9]*.sql) do (
    echo %INFO_PREFIX% Running seed: %%~nxf
    type "%%f" | docker exec -i %DB_CONTAINER% mysql -u%DB_USER% -p%DB_PASSWORD% %DB_NAME% 2^>nul
    if errorlevel 1 (
        echo %ERROR_PREFIX% Failed to execute: %%~nxf
        exit /b 1
    )
    echo %INFO_PREFIX% Successfully executed: %%~nxf
)
echo %INFO_PREFIX% Seed data loaded successfully!
goto :eof

:run_fresh
echo %WARNING_PREFIX% === FRESH MIGRATION - ALL DATA WILL BE LOST ===
set /p CONFIRM="Are you sure you want to drop all tables? (yes/no): "
if not "%CONFIRM%"=="yes" (
    echo %INFO_PREFIX% Migration cancelled
    exit /b 0
)

echo %INFO_PREFIX% Running full schema initialization from init.sql...
docker exec %DB_CONTAINER% sh -c "mysql -u%DB_USER% -p%DB_PASSWORD% %DB_NAME% < /migrations/init.sql"
if errorlevel 1 (
    echo %ERROR_PREFIX% Failed to run init.sql
    exit /b 1
)
echo %INFO_PREFIX% Fresh migration completed!
goto :eof

:run_reset
echo %WARNING_PREFIX% === DATABASE RESET - ALL DATA WILL BE LOST ===
set /p CONFIRM="Are you sure you want to reset the database? (yes/no): "
if not "%CONFIRM%"=="yes" (
    echo %INFO_PREFIX% Reset cancelled
    exit /b 0
)

echo %INFO_PREFIX% Running full database reset from init.sql (schema + seeds)...
docker exec %DB_CONTAINER% sh -c "mysql -u%DB_USER% -p%DB_PASSWORD% %DB_NAME% < /migrations/init.sql"
if errorlevel 1 (
    echo %ERROR_PREFIX% Failed to run init.sql
    exit /b 1
)
echo %INFO_PREFIX% Database reset completed!
goto :eof

:run_file
if "%2"=="" (
    echo %ERROR_PREFIX% Please specify a file path
    echo %INFO_PREFIX% Usage: %0 file ^<path-to-sql-file^>
    exit /b 1
)
echo %INFO_PREFIX% Running file: %2
type "%2" | docker exec -i %DB_CONTAINER% mysql -u%DB_USER% -p%DB_PASSWORD% %DB_NAME% 2^>nul
if errorlevel 1 (
    echo %ERROR_PREFIX% Failed to execute: %2
    exit /b 1
)
echo %INFO_PREFIX% Successfully executed: %2
goto :eof

:show_help
echo.
echo Database Migration Runner for Meeting Manager
echo.
echo Usage: %0 [command] [options]
echo.
echo Commands:
echo     migrate         Run all pending schema migrations
echo     seed            Run seed data (development data)
echo     fresh           Drop all tables and recreate from scratch (WARNING: deletes all data)
echo     reset           Fresh migration + seed data
echo     file ^<path^>     Run a specific SQL file
echo     help            Show this help message
echo.
echo Examples:
echo     %0 migrate                          # Run schema migrations
echo     %0 seed                             # Run seed data
echo     %0 fresh                            # Fresh migration (drops all tables)
echo     %0 reset                            # Fresh migration + seeds
echo     %0 file migrations\schema\002_*.sql # Run specific migration
echo.
goto :eof
