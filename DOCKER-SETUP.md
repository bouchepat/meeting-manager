# Docker Setup Guide

This guide explains how to run the Meeting Manager application using Docker and Docker Compose.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed
- [Docker Compose](https://docs.docker.com/compose/install/) installed
- Firebase project configured (see main README.md)

## Quick Start (Development)

1. **Configure Frontend Environment**

   Update `frontend/src/environments/environment.ts` with your Firebase credentials:
   ```typescript
   export const environment = {
     production: false,
     firebase: {
       apiKey: 'YOUR_FIREBASE_API_KEY',
       authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
       projectId: 'YOUR_PROJECT_ID',
       storageBucket: 'YOUR_PROJECT_ID.appspot.com',
       messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
       appId: 'YOUR_APP_ID'
     },
     apiUrl: 'http://localhost:3000/api'
   };
   ```

2. **Start All Services**

   ```bash
   docker-compose up
   ```

   This will start:
   - MySQL database on port 3306
   - Backend API on port 3000
   - Frontend on port 4200

3. **Access the Application**

   - Frontend: http://localhost:4200
   - Backend API: http://localhost:3000/api
   - MySQL: localhost:3306 (use a MySQL client)

## Development Workflow

### Starting Services

```bash
# Start all services in detached mode
docker-compose up -d

# Start specific service
docker-compose up -d mysql
docker-compose up -d backend
docker-compose up -d frontend

# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f backend
```

### Stopping Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: This deletes the database!)
docker-compose down -v
```

### Rebuilding After Code Changes

The development setup uses volume mounting, so most code changes will be reflected automatically through hot reload. However, if you modify dependencies:

```bash
# Rebuild specific service
docker-compose build backend
docker-compose up -d backend

# Rebuild all services
docker-compose build
docker-compose up -d
```

### Accessing Service Shells

```bash
# Access backend container shell
docker-compose exec backend sh

# Access frontend container shell
docker-compose exec frontend sh

# Access MySQL shell
docker-compose exec mysql mysql -u meetinguser -pmeetingpass meeting_manager
```

## Production Deployment

### 1. Configure Environment Variables

Create a `.env` file in the root directory (copy from `.env.example`):

```bash
cp .env.example .env
```

Edit `.env` with secure values:
```env
MYSQL_ROOT_PASSWORD=your_secure_root_password
MYSQL_USER=meetinguser
MYSQL_PASSWORD=your_secure_password
JWT_SECRET=your_very_secure_jwt_secret_key
```

### 2. Update Frontend Production Config

Edit `frontend/src/environments/environment.prod.ts`:
```typescript
export const environment = {
  production: true,
  firebase: {
    // Your Firebase production config
  },
  apiUrl: 'https://your-domain.com/api' // Your production API URL
};
```

### 3. Update Backend CORS

Edit `backend/src/main.ts` to allow your production domain:
```typescript
app.enableCors({
  origin: 'https://your-domain.com',
  credentials: true,
});
```

### 4. Deploy

```bash
# Build and start in production mode
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

Production services will run on:
- Frontend: http://localhost:80 (port 80)
- Backend: http://localhost:3000
- MySQL: Internal network only (not exposed)

## Docker Architecture

### Services

1. **mysql**
   - Image: mysql:8.0
   - Database automatically initialized with `database-schema.sql`
   - Data persisted in Docker volume `mysql_data`
   - Health checks ensure database is ready before backend starts

2. **backend**
   - Built from `./backend/Dockerfile`
   - Development: Uses volume mounting for hot reload
   - Production: Optimized build with only production dependencies
   - Waits for MySQL to be healthy before starting

3. **frontend**
   - Built from `./frontend/Dockerfile`
   - Development: Angular dev server with hot reload
   - Production: Nginx serving optimized static files

### Networks

All services communicate through `meeting-manager-network` bridge network:
- Services can reference each other by service name
- Backend connects to MySQL using hostname `mysql`
- Frontend connects to backend using `http://backend:3000`

### Volumes

- `mysql_data`: Persists MySQL database data
- Development mode: Source code mounted for hot reload
- `node_modules`: Excluded from mounting to avoid conflicts

## Useful Commands

### Database Management

```bash
# Create database backup
docker-compose exec mysql mysqldump -u meetinguser -pmeetingpass meeting_manager > backup.sql

# Restore database from backup
docker-compose exec -T mysql mysql -u meetinguser -pmeetingpass meeting_manager < backup.sql

# Reset database (WARNING: Deletes all data!)
docker-compose down -v
docker-compose up -d
```

### Monitoring

```bash
# View container status
docker-compose ps

# View resource usage
docker stats

# View all logs
docker-compose logs

# Follow logs from all services
docker-compose logs -f

# View logs from specific time
docker-compose logs --since 10m backend
```

### Cleanup

```bash
# Remove stopped containers
docker-compose rm

# Remove all containers, networks, and volumes
docker-compose down -v

# Remove unused Docker resources
docker system prune -a
```

## Troubleshooting

### Backend can't connect to database

**Problem**: Backend logs show connection errors to MySQL

**Solution**:
```bash
# Check MySQL health
docker-compose ps mysql

# Check MySQL logs
docker-compose logs mysql

# Restart services
docker-compose restart mysql backend
```

### Frontend can't reach backend

**Problem**: Frontend shows API connection errors

**Solution**:
- Check that `apiUrl` in environment.ts points to `http://localhost:3000/api`
- Verify backend is running: `docker-compose logs backend`
- Check CORS configuration in `backend/src/main.ts`

### Port already in use

**Problem**: Error: "port is already allocated"

**Solution**:
```bash
# Find what's using the port (example for port 3000)
# Windows
netstat -ano | findstr :3000

# Linux/Mac
lsof -i :3000

# Change port in docker-compose.yml or stop the conflicting service
```

### Container keeps restarting

**Problem**: Service keeps restarting

**Solution**:
```bash
# View detailed logs
docker-compose logs --tail=100 [service-name]

# Check for missing environment variables
docker-compose config

# Rebuild the container
docker-compose build [service-name]
docker-compose up -d [service-name]
```

### Hot reload not working

**Problem**: Code changes not reflected in running container

**Solution**:
- For backend: NestJS watches for changes automatically
- For frontend: Angular dev server should hot reload
- If not working, try rebuilding:
  ```bash
  docker-compose restart backend
  docker-compose restart frontend
  ```

### Database not initializing

**Problem**: Database tables not created

**Solution**:
```bash
# Remove volume and recreate
docker-compose down -v
docker-compose up -d

# Or manually initialize
docker-compose exec mysql mysql -u meetinguser -pmeetingpass meeting_manager < database-schema.sql
```

## Development vs Production

| Feature | Development | Production |
|---------|-------------|------------|
| **Frontend** | Angular dev server (4200) | Nginx serving static files (80) |
| **Backend** | Hot reload enabled | Optimized build |
| **Database** | Exposed on 3306 | Internal only |
| **Volumes** | Source code mounted | No mounting |
| **Logs** | Verbose | Production level |
| **Build** | Development dependencies | Production only |

## Environment Variables Reference

### Backend (.env or docker-compose environment)

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_HOST` | MySQL host | `mysql` (Docker), `localhost` (local) |
| `DATABASE_PORT` | MySQL port | `3306` |
| `DATABASE_USER` | MySQL user | `meetinguser` |
| `DATABASE_PASSWORD` | MySQL password | `meetingpass` |
| `DATABASE_NAME` | Database name | `meeting_manager` |
| `JWT_SECRET` | Secret for JWT tokens | Required |
| `PORT` | Backend port | `3000` |
| `NODE_ENV` | Environment | `development` |

### Frontend (environment.ts)

| Variable | Description |
|----------|-------------|
| `firebase.apiKey` | Firebase API key |
| `firebase.authDomain` | Firebase auth domain |
| `firebase.projectId` | Firebase project ID |
| `apiUrl` | Backend API URL |

## Next Steps

After running with Docker:
1. Test the application at http://localhost:4200
2. Configure Firebase authentication
3. Implement additional features (recording, AI integration, etc.)
4. Deploy to production using `docker-compose.prod.yml`
