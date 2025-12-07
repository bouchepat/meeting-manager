# AI-Powered Meeting Manager

A full-stack application for recording meetings, generating AI-powered summaries, detecting participants, and managing tasks with a Trello-like interface.

## Tech Stack

### Frontend
- **Angular 21** - Modern web framework
- **Firebase Authentication** - Google sign-in
- **Angular Material** - UI components
- **RxJS** - Reactive programming
- **TypeScript** - Type-safe development

### Backend
- **NestJS** - Progressive Node.js framework
- **TypeORM** - Database ORM
- **MySQL** - Relational database
- **Class Validator** - DTO validation

## Project Structure

```
manager/
├── frontend/           # Angular application
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/    # UI components
│   │   │   ├── services/      # Business logic services
│   │   │   ├── models/        # TypeScript interfaces
│   │   │   └── ...
│   │   ├── environments/      # Environment configs
│   │   └── styles.scss        # Global styles with theme support
│   └── package.json
│
└── backend/            # NestJS application
    ├── src/
    │   ├── entities/          # TypeORM entities
    │   ├── users/             # User module
    │   ├── meetings/          # Meetings module
    │   ├── tasks/             # Tasks module
    │   └── ...
    ├── .env                   # Environment variables
    └── package.json
```

## Features

### Implemented
- ✅ User authentication with Firebase (Google sign-in)
- ✅ Light/Dark theme toggle
- ✅ Modern, responsive home page
- ✅ Database schema for:
  - Users
  - Meetings
  - Guests
  - Tasks
  - Meeting summaries
- ✅ RESTful API endpoints for all resources
- ✅ TypeORM integration with MySQL
- ✅ Full CRUD operations for meetings and tasks

### Database Schema

**Users**
- id, email, displayName, photoURL, firebaseUid
- Relations: createdMeetings, assignedTasks

**Meetings**
- id, title, description, status, recordingUrl, recordingDuration
- startedAt, endedAt, creatorId
- Relations: creator, guests, tasks, summaries

**Guests**
- id, name, email, role, isAiDetected
- Relations: meeting

**Tasks**
- id, title, description, status, priority, dueDate
- isAiGenerated, meetingId, assigneeId
- Relations: meeting, assignee

**MeetingSummary**
- id, summary, keyPoints, decisions, actionItems
- isAiGenerated, meetingId
- Relations: meeting

## Quick Start with Docker 🐳 (Recommended)

The easiest way to run the entire stack is using Docker Compose. **New to the project? See [QUICK-START.md](QUICK-START.md) for a step-by-step guide!**

### Using Docker Compose Directly

```bash
# Start all services (MySQL, Backend, Frontend)
docker-compose up
```

### Using Helper Scripts

We've included convenient scripts for managing Docker:

**Windows (PowerShell):**
```powershell
.\docker.ps1 up        # Start services
.\docker.ps1 dev       # Start in background
.\docker.ps1 logs      # View logs
.\docker.ps1 help      # See all commands
```

**Windows (CMD):**
```cmd
docker.bat up          # Start services
docker.bat help        # See all commands
```

**Linux/Mac:**
```bash
make up                # Start services
make dev               # Start in background
make logs              # View logs
make help              # See all commands
```

### Access the Application

- **Frontend**: http://localhost:4200
- **Backend API**: http://localhost:3000/api
- **Database**: localhost:3306 (user: `meetinguser`, password: `meetingpass`)

**Important**: Before running, update `frontend/src/environments/environment.ts` with your Firebase credentials.

### Documentation

- 🚀 **New Users**: [QUICK-START.md](QUICK-START.md) - Get running in 5 minutes
- 🐳 **Docker Details**: [DOCKER-SETUP.md](DOCKER-SETUP.md) - Full Docker documentation
- 📖 **Full Documentation**: See below for manual setup and API reference

---

## Manual Setup (Without Docker)

### Prerequisites
- Node.js (v18 or higher)
- MySQL Server
- Firebase project (for authentication)

### 1. Database Setup

Create a MySQL database:
```sql
CREATE DATABASE meeting_manager;
```

### 2. Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Update `.env` file with your credentials:
```env
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_USER=root
DATABASE_PASSWORD=your_password
DATABASE_NAME=meeting_manager
JWT_SECRET=your-secret-key
PORT=3000
```

4. Start the backend server:
```bash
npm run start:dev
```

The backend will run on `http://localhost:3000` and automatically create database tables.

### 3. Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Configure Firebase:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project
   - Enable Google authentication
   - Get your Firebase config

4. Update `frontend/src/environments/environment.ts`:
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

5. Start the development server:
```bash
npm start
```

The frontend will run on `http://localhost:4200`

## API Endpoints

### Users
- `POST /api/users` - Create a new user
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `GET /api/users/firebase/:firebaseUid` - Get user by Firebase UID
- `PATCH /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Meetings
- `POST /api/meetings` - Create a meeting
- `GET /api/meetings` - Get all meetings
- `GET /api/meetings/:id` - Get meeting by ID
- `GET /api/meetings/user/:userId` - Get user's meetings
- `PATCH /api/meetings/:id` - Update meeting
- `POST /api/meetings/:id/end` - End a meeting
- `POST /api/meetings/:id/guests` - Add guest to meeting
- `POST /api/meetings/:id/summary` - Add summary to meeting
- `DELETE /api/meetings/:id` - Delete meeting

### Tasks
- `POST /api/tasks` - Create a task
- `GET /api/tasks` - Get all tasks
- `GET /api/tasks/:id` - Get task by ID
- `GET /api/tasks/meeting/:meetingId` - Get tasks by meeting
- `GET /api/tasks/assignee/:assigneeId` - Get tasks by assignee
- `PATCH /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

## Theme Support

The application includes a fully functional light/dark theme system:
- Theme toggle button in the navbar
- Persists theme preference in localStorage
- Respects system preferences by default
- CSS variables for easy customization

## Development

### Running Tests

Backend:
```bash
cd backend
npm run test
```

Frontend:
```bash
cd frontend
npm test
```

### Building for Production

Backend:
```bash
cd backend
npm run build
```

Frontend:
```bash
cd frontend
npm run build
```

## Next Steps (To Be Implemented)

1. **Meeting Recording**
   - Integrate audio/video recording functionality
   - Upload recordings to cloud storage

2. **AI Integration**
   - Implement AI service for meeting transcription
   - Auto-detect participants from audio
   - Generate meeting summaries
   - Extract action items and decisions

3. **Dashboard Component**
   - Display user's meetings
   - Show assigned tasks
   - Statistics and insights

4. **Meeting Detail Component**
   - Recording interface
   - Real-time recording status
   - Display meeting summary
   - Show detected guests

5. **Task Board (Trello-like)**
   - Drag-and-drop task cards
   - Task status columns (To Do, In Progress, Done)
   - Task assignment
   - Due date management

6. **Notifications**
   - Email notifications for task assignments
   - Meeting reminders

7. **Search and Filters**
   - Search meetings by title, participants
   - Filter tasks by status, priority, assignee

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License.
