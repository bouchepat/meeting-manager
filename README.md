# AI-Powered Meeting Manager

A full-stack application for recording meetings, generating AI-powered summaries, real-time transcription with speaker diarization, and task management.

## Tech Stack

### Frontend (Port 4200)
- **Angular 21** - Modern web framework
- **Bootstrap 5.3** - UI components with Bootstrap Icons
- **Firebase Authentication** - Google sign-in
- **TypeScript** - Type-safe development

### Backend (Port 3000)
- **NestJS 11** - Progressive Node.js framework
- **TypeORM** - Database ORM
- **MySQL 8.0** - Relational database
- **FFmpeg** - Audio conversion (WebM to M4A)
- **Firebase Admin SDK** - Token verification
- **Passport JWT** - API authentication

### AI/ML Services
- **Google Cloud Speech-to-Text** - Real-time transcription
- **Pyannote.audio** - Speaker diarization (GPU-accelerated)
- **OpenAI GPT-4** - Meeting summarization & action item extraction

## Features

### Implemented
- **Authentication**
  - Firebase Google sign-in
  - JWT token-based API authentication
  - Automatic token refresh

- **Meeting Recording**
  - Browser-based audio recording (MediaRecorder API)
  - Pause/resume functionality
  - Chunked upload for large files (5MB chunks)
  - Automatic WebM to M4A conversion (FFmpeg)
  - Recording timer and progress tracking

- **Real-time Transcription**
  - WebSocket-based audio streaming
  - Google Cloud Speech-to-Text integration
  - Live transcript display during recording
  - Automatic stream restart on 5-minute limit

- **Speaker Diarization**
  - Pyannote.audio 4.x with GPU support (NVIDIA CUDA)
  - Post-processing speaker assignment
  - Consecutive segment merging by speaker
  - Speaker enrollment with name extraction
  - Support for spelled names (e.g., "J-O-H-N", NATO alphabet)

- **AI Summarization**
  - OpenAI GPT-4 integration
  - Automatic summary generation
  - Action items extraction (auto-creates tasks)
  - Key decisions identification

- **Dashboard**
  - Meeting list with status indicators
  - Recording duration display
  - Responsive grid layout
  - Quick access to recordings and details

- **Task Management**
  - AI-generated tasks from transcripts
  - Status tracking (todo, in_progress, done)
  - Task assignment to users
  - Meeting-linked tasks

- **Theme Support**
  - Light/Dark mode toggle
  - System preference detection
  - Persisted in localStorage

### Database Schema
- **users** - Firebase-authenticated users
- **meetings** - Meeting records with recordings
- **guests** - Meeting participants
- **tasks** - Task management with AI generation
- **meeting_summaries** - AI-generated summaries
- **transcript_segments** - Real-time transcripts with speaker tags
- **speaker_mappings** - Speaker name assignments

## Quick Start with Docker

### Prerequisites
- Docker & Docker Compose
- NVIDIA GPU with CUDA (for speaker diarization)
- Google Cloud credentials (Speech-to-Text API)
- Firebase project
- OpenAI API key (for summarization)

### 1. Clone and Configure

```bash
git clone git@github.com:bouchepat/meeting-manager.git
cd meeting-manager
```

### 2. Set Up Environment Files

**Backend** (`backend/.env`):
```env
DATABASE_HOST=mysql
DATABASE_PORT=3306
DATABASE_USER=meetinguser
DATABASE_PASSWORD=meetingpass
DATABASE_NAME=meeting_manager
JWT_SECRET=your-secret-key-change-in-production
OPENAI_API_KEY=your-openai-api-key
```

**Frontend** (`frontend/src/environments/environment.local.ts`):
```typescript
export const environment = {
  production: false,
  firebase: {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID",
    measurementId: "YOUR_MEASUREMENT_ID"
  },
  apiUrl: 'http://localhost:3000/api'
};
```

**Google Cloud credentials** (`backend/google-credentials.json`):
- Create a service account with "Cloud Speech Client" role
- Download the JSON key file

**Diarization** (`.env` in project root):
```env
HUGGINGFACE_TOKEN=your-huggingface-token
```
Note: Accept pyannote model license at https://huggingface.co/pyannote/speaker-diarization-3.1

### 3. Start Services

```bash
docker-compose up -d
```

### 4. Access the Application

- **Frontend**: http://localhost:4200
- **Backend API**: http://localhost:3000/api
- **Database**: localhost:3306

## Docker Services

| Service | Port | Description |
|---------|------|-------------|
| frontend | 4200 | Angular dev server with hot-reload |
| backend | 3000 | NestJS API with hot-reload |
| mysql | 3306 | MySQL 8.0 database |
| diarization | 5000 | Pyannote speaker diarization (GPU) |

### Common Commands

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f [service-name]

# Restart a service
docker-compose restart [service-name]

# Reset database (runs all migrations fresh)
docker-compose down
docker volume rm manager_mysql_data
docker-compose up -d

# Rebuild containers
docker-compose build --no-cache [service-name]
```

## Database Migrations

Migrations are stored in `migrations/schema/` and run automatically on fresh database init:
- `001-099` - Schema migrations
- `100+` - Seed data

To reset and re-run all migrations:
```bash
docker volume rm manager_mysql_data
docker-compose up -d mysql
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Exchange Firebase token for JWT

### Users
- `POST /api/users` - Create user
- `GET /api/users/firebase/:uid` - Get by Firebase UID
- `GET/PATCH/DELETE /api/users/:id` - CRUD operations

### Meetings
- `GET/POST /api/meetings` - List/Create meetings
- `GET/PATCH/DELETE /api/meetings/:id` - CRUD operations
- `POST /api/meetings/:id/end` - End meeting
- `POST /api/meetings/:id/guests` - Add guests
- `POST /api/meetings/:id/summary` - Add summary

### Tasks
- `GET/POST /api/tasks` - List/Create tasks
- `GET /api/tasks/meeting/:id` - Get by meeting
- `GET /api/tasks/assignee/:id` - Get by assignee
- `PATCH/DELETE /api/tasks/:id` - Update/Delete

### Uploads
- `POST /api/uploads/audio/chunk` - Chunked upload
- `POST /api/uploads/audio/complete` - Complete file upload

### Transcription (WebSocket)
- Namespace: `/transcription`
- Events: `startTranscription`, `audioData`, `transcript`, `stopTranscription`
- Speaker events: `enrollSpeaker`, `removeSpeakerMapping`, `speakerMappingUpdated`

## Project Structure

```
manager/
├── frontend/              # Angular 21 application
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/   # UI components
│   │   │   ├── services/     # Business logic
│   │   │   └── models/       # TypeScript interfaces
│   │   └── environments/     # Environment configs
│   └── angular.json
│
├── backend/               # NestJS 11 application
│   ├── src/
│   │   ├── auth/            # JWT authentication
│   │   ├── users/           # User management
│   │   ├── meetings/        # Meeting CRUD
│   │   ├── tasks/           # Task management
│   │   ├── uploads/         # File upload handling
│   │   ├── transcription/   # WebSocket & Speech-to-Text
│   │   └── utils/           # Utilities (name extractor, etc.)
│   └── google-credentials.json
│
├── diarization/           # Pyannote service (Python/Flask)
│   └── app.py
│
├── migrations/
│   └── schema/            # SQL migrations (auto-run on init)
│
└── docker-compose.yml
```

## Development Notes

### Hot Reload
Both frontend and backend support hot-reload in Docker. Changes to source files are automatically detected.

### Environment Files
- `environment.ts` - Template with placeholders (committed)
- `environment.local.ts` - Local dev config (gitignored)
- `environment.prod.ts` - Production config (set via CI/CD)

### Diarization Service
The diarization Docker image is ~24GB due to ML models. It's cached after first build. The HuggingFace token is only needed for initial model download; all inference runs locally on GPU.

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License.
