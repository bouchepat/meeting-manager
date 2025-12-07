# Quick Start Guide - Docker Edition

Get the Meeting Manager application running in under 5 minutes using Docker!

## Prerequisites

- ✅ Docker Desktop installed ([Download here](https://www.docker.com/products/docker-desktop))
- ✅ Firebase project created ([Firebase Console](https://console.firebase.google.com/))

## Step-by-Step Setup

### 1. Configure Firebase (2 minutes)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use an existing one
3. Enable **Google Authentication**:
   - Go to Authentication → Sign-in method
   - Enable Google provider
4. Get your Firebase config:
   - Go to Project Settings → General
   - Scroll down to "Your apps"
   - Copy the Firebase configuration

### 2. Update Environment File (1 minute)

Open `frontend/src/environments/environment.ts` and paste your Firebase config:

```typescript
export const environment = {
  production: false,
  firebase: {
    apiKey: 'YOUR_FIREBASE_API_KEY',           // ← Paste here
    authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
    projectId: 'YOUR_PROJECT_ID',
    storageBucket: 'YOUR_PROJECT_ID.appspot.com',
    messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
    appId: 'YOUR_APP_ID'
  },
  apiUrl: 'http://localhost:3000/api'  // ← Keep this as is
};
```

### 3. Start the Application (1 minute)

Open a terminal in the project root directory and run:

**Option A - Using Docker Compose directly:**
```bash
docker-compose up
```

**Option B - Using helper scripts:**

Windows (PowerShell):
```powershell
.\docker.ps1 up
```

Windows (CMD):
```cmd
docker.bat up
```

Linux/Mac:
```bash
make up
```

### 4. Access the Application

Wait for all services to start (you'll see "Application is running" in the logs), then open:

🌐 **Frontend**: http://localhost:4200

The application is now running! You can:
- Click "Get Started with Google" to sign in
- Create meetings
- Add tasks
- Toggle between light and dark themes

## What Just Happened?

Docker Compose started three containers:

1. **MySQL Database** (port 3306)
   - Automatically initialized with the database schema
   - Ready to store meetings, tasks, and users

2. **Backend API** (port 3000)
   - NestJS application connected to MySQL
   - RESTful API endpoints ready
   - Available at http://localhost:3000/api

3. **Frontend** (port 4200)
   - Angular application with hot reload
   - Connected to backend API
   - Available at http://localhost:4200

## Common Commands

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mysql
```

### Stop Services
```bash
docker-compose down
```

### Restart Services
```bash
docker-compose restart
```

### View Container Status
```bash
docker-compose ps
```

## Using Helper Scripts

We've created helper scripts to make Docker management easier:

### Windows (PowerShell)
```powershell
.\docker.ps1 help          # Show all commands
.\docker.ps1 dev           # Start in background
.\docker.ps1 logs          # View logs
.\docker.ps1 down          # Stop services
.\docker.ps1 status        # Check status
```

### Windows (CMD)
```cmd
docker.bat help
docker.bat dev
docker.bat logs
docker.bat down
```

### Linux/Mac (Makefile)
```bash
make help          # Show all commands
make dev           # Start in background
make logs          # View logs
make down          # Stop services
make status        # Check status
```

## Troubleshooting

### Services won't start

**Check if ports are available:**
```bash
# Check if something is using port 3000, 3306, or 4200
netstat -ano | findstr :3000
netstat -ano | findstr :3306
netstat -ano | findstr :4200
```

**Solution:** Stop the conflicting service or change ports in `docker-compose.yml`

### "Error: Cannot connect to Docker daemon"

**Solution:** Make sure Docker Desktop is running

### Frontend can't reach backend

**Solution:**
- Wait a bit longer for all services to start
- Check backend logs: `docker-compose logs backend`
- Verify backend is running: `docker-compose ps`

### Database connection errors

**Solution:**
```bash
# Restart services in order
docker-compose down
docker-compose up -d mysql
# Wait 10 seconds
docker-compose up -d backend
docker-compose up -d frontend
```

### Fresh start (clean slate)

```bash
# WARNING: This deletes all data!
docker-compose down -v
docker-compose up
```

## Development Workflow

### Code Changes

- **Backend changes**: Files are watched, server auto-restarts
- **Frontend changes**: Hot reload enabled, browser auto-refreshes
- **Dependency changes**: Need to rebuild:
  ```bash
  docker-compose build backend
  docker-compose up -d backend
  ```

### Database Access

Access MySQL directly:
```bash
docker-compose exec mysql mysql -u meetinguser -pmeetingpass meeting_manager
```

Or use a MySQL client:
- Host: localhost
- Port: 3306
- User: meetinguser
- Password: meetingpass
- Database: meeting_manager

### Backup Database

```bash
docker-compose exec mysql mysqldump -u meetinguser -pmeetingpass meeting_manager > backup.sql
```

## Next Steps

Now that your app is running:

1. ✅ Sign in with Google
2. ✅ Explore the home page
3. ✅ Try the dark mode toggle
4. ✅ Check the API at http://localhost:3000/api
5. 📝 Implement the dashboard component
6. 📝 Add meeting recording functionality
7. 🤖 Integrate AI for meeting summaries
8. 📋 Build the Trello-like task board

## Need More Help?

- **Detailed Docker Guide**: See [DOCKER-SETUP.md](DOCKER-SETUP.md)
- **Full Documentation**: See [README.md](README.md)
- **Docker Issues**: Run `docker-compose logs -f` to see what's happening

Happy coding! 🚀
