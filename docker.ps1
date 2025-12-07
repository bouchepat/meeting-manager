# Meeting Manager - Docker Management Script (PowerShell)
# Usage: .\docker.ps1 [command]

param(
    [Parameter(Position=0)]
    [string]$Command = "help",

    [Parameter(Position=1)]
    [string]$File = ""
)

function Show-Help {
    Write-Host "Meeting Manager - Available Commands:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  up              " -ForegroundColor Green -NoNewline; Write-Host "Start all services"
    Write-Host "  dev             " -ForegroundColor Green -NoNewline; Write-Host "Start all services in detached mode"
    Write-Host "  down            " -ForegroundColor Green -NoNewline; Write-Host "Stop all services"
    Write-Host "  logs            " -ForegroundColor Green -NoNewline; Write-Host "View logs from all services"
    Write-Host "  logs-backend    " -ForegroundColor Green -NoNewline; Write-Host "View backend logs only"
    Write-Host "  logs-frontend   " -ForegroundColor Green -NoNewline; Write-Host "View frontend logs only"
    Write-Host "  logs-db         " -ForegroundColor Green -NoNewline; Write-Host "View database logs only"
    Write-Host "  restart         " -ForegroundColor Green -NoNewline; Write-Host "Restart all services"
    Write-Host "  status          " -ForegroundColor Green -NoNewline; Write-Host "Show status of all services"
    Write-Host "  clean           " -ForegroundColor Green -NoNewline; Write-Host "Stop and remove all containers and volumes"
    Write-Host "  rebuild         " -ForegroundColor Green -NoNewline; Write-Host "Rebuild all containers"
    Write-Host "  shell-backend   " -ForegroundColor Green -NoNewline; Write-Host "Open shell in backend container"
    Write-Host "  shell-frontend  " -ForegroundColor Green -NoNewline; Write-Host "Open shell in frontend container"
    Write-Host "  shell-db        " -ForegroundColor Green -NoNewline; Write-Host "Open MySQL shell"
    Write-Host "  backup          " -ForegroundColor Green -NoNewline; Write-Host "Create database backup"
    Write-Host "  restore         " -ForegroundColor Green -NoNewline; Write-Host "Restore database (use: .\docker.ps1 restore backups\file.sql)"
    Write-Host ""
}

switch ($Command) {
    "up" {
        docker-compose up
    }
    "dev" {
        docker-compose up -d
        Write-Host "✅ Services started in detached mode" -ForegroundColor Green
    }
    "down" {
        docker-compose down
        Write-Host "✅ Services stopped" -ForegroundColor Green
    }
    "logs" {
        docker-compose logs -f
    }
    "logs-backend" {
        docker-compose logs -f backend
    }
    "logs-frontend" {
        docker-compose logs -f frontend
    }
    "logs-db" {
        docker-compose logs -f mysql
    }
    "restart" {
        docker-compose restart
        Write-Host "✅ Services restarted" -ForegroundColor Green
    }
    "status" {
        docker-compose ps
    }
    "clean" {
        $confirm = Read-Host "This will delete all data. Are you sure? (yes/no)"
        if ($confirm -eq "yes") {
            docker-compose down -v
            Write-Host "⚠️  All data has been removed!" -ForegroundColor Yellow
        }
    }
    "rebuild" {
        docker-compose build
        docker-compose up -d
        Write-Host "✅ Containers rebuilt" -ForegroundColor Green
    }
    "shell-backend" {
        docker-compose exec backend sh
    }
    "shell-frontend" {
        docker-compose exec frontend sh
    }
    "shell-db" {
        docker-compose exec mysql mysql -u meetinguser -pmeetingpass meeting_manager
    }
    "backup" {
        if (!(Test-Path "backups")) {
            New-Item -ItemType Directory -Path "backups"
        }
        $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
        $filename = "backups\backup-$timestamp.sql"
        docker-compose exec mysql mysqldump -u meetinguser -pmeetingpass meeting_manager | Out-File -Encoding UTF8 $filename
        Write-Host "✅ Backup created: $filename" -ForegroundColor Green
    }
    "restore" {
        if ($File -eq "") {
            Write-Host "❌ Please specify backup file: .\docker.ps1 restore backups\backup-20240101-120000.sql" -ForegroundColor Red
        } else {
            Get-Content $File | docker-compose exec -T mysql mysql -u meetinguser -pmeetingpass meeting_manager
            Write-Host "✅ Database restored from $File" -ForegroundColor Green
        }
    }
    default {
        Show-Help
    }
}
