# Docker Setup Files Overview

This document explains all the Docker-related files in this project.

## Core Docker Files

### `docker-compose.yml`
**Purpose**: Development environment configuration

**What it does**:
- Defines three services: MySQL, Backend, Frontend
- Configures volume mounting for hot reload
- Sets up networking between services
- Initializes database with schema on first run

**Key features**:
- Development mode (hot reload enabled)
- Source code mounted for instant updates
- MySQL initialized with `database-schema.sql`
- Health checks ensure services start in correct order

### `docker-compose.prod.yml`
**Purpose**: Production environment configuration

**What it does**:
- Same services as development but optimized for production
- No volume mounting (uses built images)
- Environment variables from `.env` file
- Optimized builds

**Differences from dev**:
- Frontend: Nginx serving static files (not dev server)
- Backend: Production build with minimal dependencies
- No hot reload
- More secure (uses environment variables)

### `backend/Dockerfile`
**Purpose**: Backend container definition

**Stages**:
1. **Development**: Includes all dependencies, runs `npm run start:dev`
2. **Production**: Only production dependencies, runs compiled code

**Port**: 3000

### `frontend/Dockerfile`
**Purpose**: Frontend container definition

**Stages**:
1. **Development**: Angular dev server with hot reload
2. **Build**: Compiles Angular application
3. **Production**: Nginx serves compiled files

**Ports**:
- Development: 4200
- Production: 80

### `frontend/nginx.conf`
**Purpose**: Nginx configuration for production frontend

**Features**:
- Serves Angular application
- Handles client-side routing
- Enables gzip compression
- Caches static assets

## Environment Files

### `backend/.env`
**Purpose**: Local development environment variables

**Used when**: Running backend locally (not in Docker)

### `backend/.env.docker`
**Purpose**: Docker development environment variables

**Used when**: Running in Docker (docker-compose.yml uses these values)

**Key difference**: `DATABASE_HOST=mysql` (service name in Docker network)

### `.env.example`
**Purpose**: Template for production environment variables

**Usage**: Copy to `.env` when deploying with `docker-compose.prod.yml`

## Helper Scripts

### `Makefile`
**Platform**: Linux/Mac

**Commands**: `make help`, `make up`, `make down`, `make logs`, etc.

**Why**: Convenient shortcuts for Docker Compose commands

### `docker.ps1`
**Platform**: Windows PowerShell

**Commands**: `.\docker.ps1 help`, `.\docker.ps1 up`, etc.

**Same functionality as Makefile but for PowerShell**

### `docker.bat`
**Platform**: Windows CMD

**Commands**: `docker.bat help`, `docker.bat up`, etc.

**Simpler version for Command Prompt users**

## Ignore Files

### `backend/.dockerignore`
**Purpose**: Exclude files from Docker context when building backend

**Excludes**:
- node_modules (will be installed in container)
- dist (will be built in container)
- .env (uses container environment)
- Git files, logs, etc.

### `frontend/.dockerignore`
**Purpose**: Exclude files from Docker context when building frontend

**Excludes**:
- node_modules
- dist
- .angular cache
- Test files

### `.gitignore`
**Purpose**: Exclude files from Git version control

**Excludes**:
- node_modules
- Environment files (.env)
- Build outputs
- Logs
- Database backups (except schema)

## Database Files

### `database-schema.sql`
**Purpose**: Database initialization script

**What it does**:
- Creates all tables (users, meetings, guests, tasks, summaries)
- Sets up foreign keys and indexes
- Defines enum types
- Optionally includes sample data

**When used**:
- First time MySQL container starts
- Manually via MySQL command
- Through backup/restore scripts

## Documentation Files

### `DOCKER-SETUP.md`
**Purpose**: Comprehensive Docker guide

**Contains**:
- Detailed setup instructions
- Development workflow
- Production deployment
- Troubleshooting
- Environment variables reference
- Docker architecture explanation

### `QUICK-START.md`
**Purpose**: Get started in 5 minutes

**Contains**:
- Step-by-step setup
- Firebase configuration
- Common commands
- Troubleshooting basics
- Development workflow

### `README.md`
**Purpose**: Main project documentation

**Contains**:
- Project overview
- Quick start (Docker + manual)
- API documentation
- Database schema
- Features list

## File Structure

```
manager/
├── docker-compose.yml              # Development orchestration
├── docker-compose.prod.yml         # Production orchestration
├── .env.example                    # Production env template
├── .gitignore                      # Git ignore rules
├── Makefile                        # Linux/Mac helper
├── docker.ps1                      # PowerShell helper
├── docker.bat                      # CMD helper
│
├── database-schema.sql             # DB initialization
│
├── backend/
│   ├── Dockerfile                  # Backend container
│   ├── .dockerignore              # Backend ignore
│   ├── .env                       # Local dev env
│   └── .env.docker                # Docker dev env
│
├── frontend/
│   ├── Dockerfile                  # Frontend container
│   ├── .dockerignore              # Frontend ignore
│   └── nginx.conf                 # Production server
│
└── docs/
    ├── README.md                   # Main docs
    ├── DOCKER-SETUP.md            # Docker details
    ├── QUICK-START.md             # Quick guide
    └── DOCKER-FILES-OVERVIEW.md   # This file
```

## How It All Works Together

### Development Mode

1. Run `docker-compose up`
2. Docker Compose reads `docker-compose.yml`
3. Three containers start:
   - **MySQL**: Uses official image, mounts `database-schema.sql`
   - **Backend**: Built from `backend/Dockerfile` (development stage)
   - **Frontend**: Built from `frontend/Dockerfile` (development stage)
4. Services communicate via `meeting-manager-network`
5. Source code is mounted for hot reload
6. Database is initialized on first run

### Production Mode

1. Create `.env` file with production values
2. Run `docker-compose -f docker-compose.prod.yml up -d`
3. Three containers start:
   - **MySQL**: Same as dev
   - **Backend**: Built from `backend/Dockerfile` (production stage)
   - **Frontend**: Built from `frontend/Dockerfile` (production stage)
4. No volume mounting (uses built images)
5. Nginx serves optimized static files
6. Environment variables from `.env` file

### Hot Reload in Development

**Backend**:
- `backend/` directory mounted to `/app` in container
- `/app/node_modules` excluded (uses container's modules)
- NestJS watches files and restarts on changes

**Frontend**:
- `frontend/` directory mounted to `/app` in container
- `/app/node_modules` excluded
- Angular dev server with hot module replacement

### Database Initialization

1. MySQL container starts
2. Checks `/var/lib/mysql` (empty on first run)
3. Runs `/docker-entrypoint-initdb.d/init.sql`
4. Database schema created
5. Container marked as "healthy"
6. Backend starts (was waiting for healthy status)

## Common Workflows

### Making Code Changes

**Backend**:
1. Edit files in `backend/src/`
2. NestJS auto-restarts
3. Changes reflected immediately

**Frontend**:
1. Edit files in `frontend/src/`
2. Angular hot reload
3. Browser auto-refreshes

### Adding Dependencies

**Backend**:
```bash
cd backend
npm install new-package
docker-compose restart backend
```

**Frontend**:
```bash
cd frontend
npm install new-package --legacy-peer-deps
docker-compose restart frontend
```

### Database Changes

**Schema changes**:
1. Update `database-schema.sql`
2. Recreate database:
   ```bash
   docker-compose down -v
   docker-compose up -d
   ```

**Or update manually**:
```bash
docker-compose exec mysql mysql -u meetinguser -pmeetingpass meeting_manager < database-schema.sql
```

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mysql

# Using helper scripts
make logs              # Linux/Mac
.\docker.ps1 logs      # PowerShell
docker.bat logs        # CMD
```

## Best Practices

### Development
- Use `docker-compose.yml` for development
- Keep source code on host (mounted volumes)
- Use helper scripts for convenience
- Check logs regularly

### Production
- Use `docker-compose.prod.yml`
- Secure your `.env` file
- Use strong passwords
- Update CORS settings
- Consider using a reverse proxy (nginx/traefik)
- Regular database backups

### Security
- Never commit `.env` files
- Change default passwords
- Keep Docker images updated
- Use secrets management in production
- Limit database access

## Troubleshooting

### "Port already in use"
Edit `docker-compose.yml` to use different ports

### "Container keeps restarting"
Check logs: `docker-compose logs [service-name]`

### "Database connection refused"
Wait for MySQL health check to pass

### "Changes not reflected"
For dependency changes: `docker-compose build [service]`

### "Clean slate needed"
```bash
docker-compose down -v  # Deletes all data!
docker-compose up
```

## Next Steps

1. Read [QUICK-START.md](QUICK-START.md) to get running
2. Check [DOCKER-SETUP.md](DOCKER-SETUP.md) for details
3. See [README.md](README.md) for API documentation
4. Start developing!
