@echo off
REM Meeting Manager - Docker Management Script (Batch)
REM Usage: docker.bat [command]

if "%1"=="" goto help
if "%1"=="help" goto help
if "%1"=="up" goto up
if "%1"=="dev" goto dev
if "%1"=="down" goto down
if "%1"=="logs" goto logs
if "%1"=="restart" goto restart
if "%1"=="status" goto status
if "%1"=="clean" goto clean
if "%1"=="rebuild" goto rebuild
goto help

:help
echo Meeting Manager - Available Commands:
echo.
echo   up              Start all services
echo   dev             Start all services in detached mode
echo   down            Stop all services
echo   logs            View logs from all services
echo   restart         Restart all services
echo   status          Show status of all services
echo   clean           Stop and remove all containers and volumes
echo   rebuild         Rebuild all containers
echo.
goto end

:up
docker-compose up
goto end

:dev
docker-compose up -d
echo Services started in detached mode
goto end

:down
docker-compose down
echo Services stopped
goto end

:logs
docker-compose logs -f
goto end

:restart
docker-compose restart
echo Services restarted
goto end

:status
docker-compose ps
goto end

:clean
set /p confirm="This will delete all data. Are you sure? (yes/no): "
if "%confirm%"=="yes" (
    docker-compose down -v
    echo All data has been removed!
)
goto end

:rebuild
docker-compose build
docker-compose up -d
echo Containers rebuilt
goto end

:end
