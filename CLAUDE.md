# Meeting Manager - Claude Context Document

**Last Updated**: 2025-12-07

## Project Overview
AI-Powered Meeting Manager - A full-stack application for managing meetings, recording sessions, tracking tasks, and generating AI-powered summaries.

## Claude
`claude --dangerously-skip-permissions`

## Tech Stack

### Backend (Port 3000)
- **Framework**: NestJS 11.0
- **Database**: MySQL 8.0 with TypeORM
- **Language**: TypeScript
- **Key Dependencies**:
  - TypeORM for database management
  - Class-validator & Class-transformer for validation
  - Passport JWT for authentication
  - Multer for file uploads
  - Firebase Admin SDK for token verification

### Frontend (Port 4200)
- **Framework**: Angular 21.0
- **UI Library**: Bootstrap 5.3 with Bootstrap Icons
- **Authentication**: Firebase Auth (@angular/fire 20.0)
- **Language**: TypeScript
- **Testing**: Vitest

### Database (Port 3306)
- **Database**: MySQL 8.0
- **Container**: meeting-manager-db
- **Credentials** (dev):
  - User: meetinguser
  - Password: meetingpass
  - Database: meeting_manager

## Application Architecture

### Database Schema
1. **users**: User management with Firebase authentication
2. **meetings**: Meeting records with recording URLs and status tracking
3. **guests**: Meeting participants and guests
4. **tasks**: Task management with AI-generated tasks
5. **meeting_summaries**: AI-generated meeting summaries with key points and decisions
6. **transcript_segments**: Real-time transcript segments with speaker diarization

### Key Features
- User authentication via Firebase
- Meeting recording and management
- Guest tracking (with AI detection capability)
- Task management (todo, in_progress, done)
- AI-generated meeting summaries
- Action items extraction
- Decision tracking
- **Real-time transcription** with speaker diarization (Google Cloud Speech-to-Text)

## Docker Setup

### Services
- **mysql**: Database service with health checks
- **backend**: NestJS API with hot-reload
- **frontend**: Angular dev server
- **diarization**: Pyannote speaker diarization service (GPU-accelerated)

### Commands
```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f [service-name]

# Restart a service
docker-compose restart [service-name]
```

## Project Status

### Current State (2025-11-23)
- ✅ Docker environment configured and running
- ✅ Database schema defined and tables created
- ✅ Backend API fully operational with all endpoints mapped
- ✅ Frontend dependencies installed and running
- ✅ All three services healthy and accessible
- ⚠️ Fixed zone.js version conflict (0.16.0 → 0.15.0)
- ⚠️ Using --legacy-peer-deps for @angular/fire compatibility with Angular 21

### Development Credentials
- Database: meetinguser / meetingpass
- JWT Secret: your-secret-key-change-this-in-production

### API Endpoints Available
- GET /api - Health check (public)
- **Auth**:
  - POST /api/auth/login - Exchange Firebase token for JWT (public)
- **Users**:
  - POST /api/users - Create user (public)
  - GET /api/users/firebase/:uid - Get user by Firebase UID (public)
  - GET, PATCH, DELETE /api/users - All require JWT authentication
- **Meetings**:
  - GET, POST, PATCH, DELETE /api/meetings - All require JWT authentication
  - POST /api/meetings/:id/end - End meeting
  - POST /api/meetings/:id/guests - Add guests
  - POST /api/meetings/:id/summary - Add summary
- **Tasks**:
  - GET, POST, PATCH, DELETE /api/tasks - All require JWT authentication
  - GET /api/tasks/meeting/:id - Get tasks by meeting
  - GET /api/tasks/assignee/:id - Get tasks by assignee
- **Uploads**:
  - POST /api/uploads/audio/chunk - Upload audio chunk (chunked upload, JWT required)
  - POST /api/uploads/audio/complete - Upload complete audio file (JWT required)

## Directory Structure
```
E:\Repositories\manager\
├── backend/           # NestJS API
├── frontend/          # Angular application
├── migrations/        # Database migrations
│   ├── schema/        # All SQL files (mounted to docker-entrypoint-initdb.d)
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_transcript_segments.sql
│   │   ├── 003_speaker_mappings.sql
│   │   ├── 004_user_settings.sql
│   │   ├── 005_recording_file_size.sql
│   │   └── 100_seed_data.sql   # Seeds use 100+ numbering
│   ├── run_migrations.bat
│   └── run_migrations.sh
├── diarization/       # Pyannote speaker diarization service
├── .claude/           # Claude Code configuration
├── .vscode/           # VS Code settings
├── docker-compose.yml  # Development environment
├── docker-compose.prod.yml # Production environment
└── CLAUDE.md          # This file
```

## Architecture Details

### Authentication Flow
1. User signs in with Google via Firebase Auth
2. Frontend gets Firebase ID token
3. Frontend exchanges Firebase token for JWT at `/api/auth/login`
4. JWT is cached in AuthService
5. HTTP interceptor automatically adds JWT to all requests (Authorization: Bearer {token})
6. Backend validates JWT using Passport JWT strategy
7. JWT expires after 7 days

### Chunked Upload Flow
1. User records audio using MediaRecorder API
2. Recording creates Blob in browser memory
3. On stop, UploadService automatically chooses upload method:
   - Files > 50MB: Chunked upload (5MB chunks)
   - Files ≤ 50MB: Complete upload
4. **Chunked Upload Process**:
   - Split Blob into 5MB chunks
   - Upload sequentially to `/api/uploads/audio/chunk`
   - Track progress (current chunk, percentage)
   - Backend saves chunks to `uploads/temp/{uploadId}/chunk-{index}`
   - Last chunk triggers automatic merge
   - Merged file saved to `uploads/audio/audio-{timestamp}.webm`
   - Temp chunks cleaned up
5. **Complete Upload Process**:
   - Upload entire Blob to `/api/uploads/audio/complete`
   - File saved directly to `uploads/audio/`
6. Backend validates meeting ownership
7. Backend updates meeting with `recordingUrl`
8. Backend queues meeting for processing (placeholder)

### Recording & Post-Processing Flow (Complete Pipeline)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           RECORDING PHASE (Real-time)                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌──────────┐    WebSocket     ┌──────────┐    Stream    ┌─────────────────┐    │
│  │ Browser  │ ──────────────── │ Backend  │ ──────────── │ Deepgram/Google │    │
│  │ (Audio)  │   audioData      │ Gateway  │   LINEAR16   │ Speech-to-Text  │    │
│  └──────────┘                  └──────────┘              └─────────────────┘    │
│       │                             │                            │              │
│       │                             │                            │              │
│       │                             ▼                            │              │
│       │                    ┌──────────────┐                      │              │
│       │                    │  transcript  │◄─────────────────────┘              │
│       │                    │   segments   │   Real-time results                 │
│       │                    │   (DB save)  │   with speaker tags                 │
│       │                    └──────────────┘                                     │
│       │                                                                         │
│       ▼                                                                         │
│  ┌──────────┐                                                                   │
│  │ WebM Blob│  (Recording stored in browser memory)                             │
│  └──────────┘                                                                   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ User clicks "Stop Recording"
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              UPLOAD PHASE                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌──────────┐   POST /api/uploads/audio/complete   ┌──────────────────────┐     │
│  │ Frontend │ ──────────────────────────────────── │ UploadsController    │     │
│  │ (WebM)   │          multipart/form-data         │ (Multer middleware)  │     │
│  └──────────┘                                      └──────────────────────┘     │
│                                                              │                  │
│                                                              ▼                  │
│                                                    ┌──────────────────────┐     │
│                                                    │ FfmpegService        │     │
│                                                    │ WebM → M4A (AAC)     │     │
│                                                    │ 64kbps, mono, 44.1k  │     │
│                                                    └──────────────────────┘     │
│                                                              │                  │
│                                                              ▼                  │
│                                                    ┌──────────────────────┐     │
│                                                    │ uploads/audio/       │     │
│                                                    │ audio-{ts}-{id}.m4a  │     │
│                                                    └──────────────────────┘     │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Upload complete, triggers post-processing
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         POST-PROCESSING PHASE                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌────────────────────────┐                                                     │
│  │ BatchDiarizationService│                                                     │
│  └────────────────────────┘                                                     │
│              │                                                                  │
│              ▼                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐     │
│  │ 1. Convert M4A → WAV (for pyannote compatibility)                      │     │
│  └────────────────────────────────────────────────────────────────────────┘     │
│              │                                                                  │
│              ▼                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐     │
│  │ 2. Call Pyannote Diarization Service (GPU)                             │     │
│  │    POST http://diarization:5000/diarize                                │     │
│  │    → Returns: [{speaker: "SPEAKER_00", start: 0.5, end: 3.2}, ...]     │     │
│  └────────────────────────────────────────────────────────────────────────┘     │
│              │                                                                  │
│              ▼                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐     │
│  │ 3. Assign Speakers to Transcript Segments                              │     │
│  │    - Match each segment's midpoint to pyannote speaker timeline        │     │
│  │    - Map SPEAKER_00 → 1, SPEAKER_01 → 2, etc.                          │     │
│  └────────────────────────────────────────────────────────────────────────┘     │
│              │                                                                  │
│              ▼                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐     │
│  │ 4. Merge Consecutive Same-Speaker Segments                             │     │
│  │    Before: [S1:"Hello"] [S1:"World"] [S2:"Hi"] [S1:"Thanks"]           │     │
│  │    After:  [S1:"Hello World"] [S2:"Hi"] [S1:"Thanks"]                  │     │
│  └────────────────────────────────────────────────────────────────────────┘     │
│              │                                                                  │
│              ▼                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐     │
│  │ 5. Save Merged Segments to Database                                    │     │
│  │    - Delete old segments, insert merged ones                           │     │
│  └────────────────────────────────────────────────────────────────────────┘     │
│              │                                                                  │
│              ▼                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐     │
│  │ 6. AI Summarization (OpenAI GPT-4)                                     │     │
│  │    - Generate meeting summary                                          │     │
│  │    - Extract action items as tasks                                     │     │
│  │    - Identify key decisions                                            │     │
│  └────────────────────────────────────────────────────────────────────────┘     │
│              │                                                                  │
│              ▼                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐     │
│  │ 7. Update Meeting Status → "completed"                                 │     │
│  │    Clean up temporary WAV file                                         │     │
│  └────────────────────────────────────────────────────────────────────────┘     │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Key Services Involved:**
| Service | Port | Description |
|---------|------|-------------|
| Frontend | 4200 | Angular app, recorder UI |
| Backend | 3000 | NestJS API, WebSocket gateway |
| Diarization | 5000 | Pyannote speaker diarization (Python/Flask) |
| MySQL | 3306 | Database for meetings, segments, tasks |

**Files Modified:**
- `diarization/app.py` - Pyannote API wrapper (volume-mounted for live updates)
- `backend/src/transcription/batch-diarization.service.ts` - Post-processing orchestration
- `backend/src/transcription/transcription.gateway.ts` - WebSocket for live transcription

### Audio Conversion Flow (FFmpeg)
1. Browser records audio in WebM format (best browser support)
2. WebM file uploaded to server (chunked or complete)
3. Backend automatically converts WebM to M4A using FFmpeg:
   - AAC codec for universal compatibility
   - 64kbps bitrate (optimized for voice)
   - Mono audio (voice recordings)
   - 44.1kHz sample rate
4. Original WebM file deleted after successful conversion
5. Meeting updated with M4A file URL
6. Conversion typically takes 1-2 seconds

**Benefits:**
- ✅ Smaller file sizes (40-60% reduction)
- ✅ Universal playback compatibility (all devices/players)
- ✅ Better quality preservation for voice
- ✅ Automatic cleanup of originals

### File Storage Structure
```
uploads/
├── temp/              # Temporary chunk storage
│   └── {uploadId}/
│       ├── chunk-0
│       ├── chunk-1
│       └── ...
└── audio/             # Final audio files (M4A format)
    ├── audio-{timestamp}-{random}.m4a
    └── ...
```

**Volume Mount:**
- Host: `E:\Repositories\manager-uploads`
- Container: `/app/uploads`
- Persists across container restarts/recreations

## Important Notes

### Security
- Firebase authentication integration implemented
- **Firebase Admin SDK** for token verification (production mode)
- JWT_SECRET must be changed in production
- CORS settings need production domain configuration
- All sensitive endpoints protected with JWT guard
- Meeting ownership validated before file operations
- **All meeting operations verify user ownership** (prevents accessing other users' data)
- Dashboard only shows current user's meetings

**Firebase Admin SDK Setup:**
Firebase reuses the same `google-credentials.json` file as Speech-to-Text. No additional configuration needed - just ensure the service account has the necessary Firebase permissions.

### AI Features (Planned)
- Meeting summaries will be AI-generated
- Tasks can be auto-generated from meetings
- Guests can be detected via AI
- Key points and decisions extraction
- Speech-to-text transcription needed
- Speaker diarization for multi-person meetings

## Dependencies & Updates

### Last Checked: 2025-11-26

**Backend Dependencies:**
- ✅ All packages up to date
- ✅ No security vulnerabilities
- ✅ @types/node aligned with Node 22 runtime (22.10.7)
- ✅ FFmpeg 6.1.2 (Alpine package)
- Node Runtime: v22.21.1 (LTS)

**Frontend Dependencies:**
- ✅ All packages up to date (with intentional constraints)
- ✅ No security vulnerabilities
- ⚠️ zone.js kept at ~0.15.0 (Angular 21 requires this, not 0.16.0)
- ⚠️ @angular/fire@20.0.1 (v21 not available yet, using --legacy-peer-deps)
- Node Runtime: v22.21.1 (LTS)

**Recent Updates:**
- 2025-11-23: Upgraded from Node 20 to Node 22 (LTS) in both containers
- Updated both Dockerfiles to use node:22-alpine base image
- Confirmed @types/node@22.x compatibility

**Update Policy:**
- Check for updates at start of each work session
- Align @types/node with Node runtime version (22.x)
- Do NOT update zone.js beyond 0.15.x until Angular supports it
- Run `npm audit` regularly for security checks

### Update Commands
```bash
# Check for outdated packages
docker-compose exec backend npm outdated
docker-compose exec frontend npm outdated

# Security audit
docker-compose exec backend npm audit
docker-compose exec frontend npm audit

# Update dependencies (when needed)
docker-compose exec backend npm update
docker-compose exec frontend npm update --legacy-peer-deps
```

## Recent Development

### 2025-11-30
**Pyannote Speaker Diarization Service:**
- ✅ Added dedicated diarization Docker service (`diarization/`)
- ✅ Pyannote.audio 4.x with GPU support (NVIDIA CUDA)
- ✅ Flask API wrapper at `http://diarization:5000`
- ✅ Fixed pyannote 4.x API compatibility (`DiarizeOutput.speaker_diarization`)
- ✅ Fixed PyTorch 2.6+ `weights_only` breaking change with monkey-patch
- ✅ Volume mount for live code updates without rebuild

**Post-Processing Pipeline:**
- ✅ Automatic speaker assignment from pyannote to live transcript segments
- ✅ **Segment merging**: Consecutive same-speaker segments are now concatenated
- ✅ WAV conversion for pyannote compatibility (M4A → WAV temp file)
- ✅ Cleanup of temporary files after processing

**UI Fixes:**
- ✅ Fixed task assignment/status dropdown buttons (switched to ng-bootstrap)
- ✅ Enhanced live transcript styling with card segments and hover effects

**Diarization Service Setup:**
1. Requires NVIDIA GPU with CUDA support
2. Set `HUGGINGFACE_TOKEN` in `.env` file
3. Accept model license at https://huggingface.co/pyannote/speaker-diarization-3.1
4. Service auto-starts with `docker-compose up -d`

**Diarization Docker Image Caching:**
The diarization image is 24GB+ due to ML models. To avoid long rebuilds:

```bash
# Image is automatically cached - these commands use the cached image:
docker-compose up -d              # Uses cached image (fast)
docker-compose build diarization  # Uses Docker layer cache (fast if no Dockerfile changes)

# Only this triggers a full rebuild (slow - avoid unless necessary):
docker-compose build --no-cache diarization

# The image is tagged for safekeeping:
# - manager-diarization:latest
# - manager-diarization:v1.0-pyannote4

# HuggingFace models are cached in a Docker volume:
# - manager_hf_cache (persists even if image is deleted)

# If you need to restore from the tagged version:
docker tag manager-diarization:v1.0-pyannote4 manager-diarization:latest

# To export the image for backup/transfer to another machine:
docker save -o E:/Repositories/backups/diarization-v1.0.tar manager-diarization:v1.0-pyannote4
# Later restore with: docker load -i E:/Repositories/backups/diarization-v1.0.tar

# Backup location: E:/Repositories/backups/diarization-v1.0.tar (~24GB)
```

**Note on HUGGINGFACE_TOKEN:**
The token is only needed for **initial model download** from HuggingFace (pyannote requires license acceptance). Once models are cached in `manager_hf_cache` volume, **all inference runs 100% locally on your GPU** with no external API calls.

### 2025-11-29
**Real-time Transcription with Speaker Diarization:**
- ✅ WebSocket gateway for audio streaming (`/transcription` namespace)
- ✅ Google Cloud Speech-to-Text integration with streaming API
- ✅ Speaker diarization (identifies 2 speakers by default)
- ✅ Real-time transcript display in recorder UI
- ✅ Transcript segments stored in database with speaker tags
- ✅ Audio conversion from browser format (WebM) to LINEAR16 for Google
- ✅ Automatic stream restart on Google's 5-minute limit
- ✅ Frontend TranscriptionService with reactive signals
- ✅ Visual speaker differentiation with color-coded badges

**Setup Required for Transcription:**
1. Create Google Cloud project
2. Enable Speech-to-Text API
3. Create service account with "Cloud Speech Client" role
4. Download JSON key file
5. Place at `backend/google-credentials.json`
6. Restart backend container

**WebSocket Events:**
- `startTranscription` - Start streaming with meetingId
- `audioData` - Send audio chunks (LINEAR16 format)
- `transcript` - Receive transcript segments with speaker tags
- `stopTranscription` - End streaming session

### 2025-11-26
**Audio Conversion with FFmpeg:**
- ✅ Installed FFmpeg in Docker containers (Alpine package)
- ✅ Created FfmpegService for audio conversion
- ✅ Automatic WebM to M4A conversion after upload
- ✅ Optimized settings for voice recordings (64kbps AAC, mono)
- ✅ Original WebM files cleaned up after conversion
- ✅ Uploads now mounted to host directory (../manager-uploads)

**Hot Reload Fix:**
- ✅ Fixed hot reload for Docker on Windows
- ✅ Added `watchOptions` to `tsconfig.json` with `fixedPollingInterval`
- ✅ Backend now auto-reloads on file changes

**Database Migrations:**
- ✅ Created migrations folder structure
- ✅ Scripts for fresh migrations and incremental changes
- ✅ Seed data separated from schema (100+ numbering)
- ✅ Cross-platform migration runners (.bat and .sh)
- ✅ Auto-runs on fresh DB init via docker-entrypoint-initdb.d

### 2025-11-23

### Implemented Features

**Dashboard Component:**
- ✅ Displays list of all recorded meetings
- ✅ Shows meeting status, duration, and creator info
- ✅ Responsive grid layout with Bootstrap 5
- ✅ Loading and error states
- ✅ Navigate to meeting details or start new recording

**Meeting Recorder Component:**
- ✅ Microphone permission request with user-friendly UI
- ✅ Real-time recording with pause/resume functionality
- ✅ Recording timer display
- ✅ Meeting title and description input
- ✅ Audio recording using MediaRecorder API
- ✅ Download recording as WebM file
- ✅ **NEW**: Chunked upload to backend with progress tracking
- ✅ **NEW**: Automatic upload after recording (if authenticated)
- ✅ **NEW**: Upload progress visualization (chunks, percentage)
- ✅ Post-recording actions (download, new recording, dashboard)
- ✅ Support for multiple audio codecs (WebM, Ogg, MP4)

**Authentication System (JWT + Firebase):**
- ✅ JWT authentication guard protecting all backend endpoints
- ✅ @Public() decorator for public routes
- ✅ Firebase token exchange for JWT
- ✅ HTTP interceptor auto-adds JWT to all requests
- ✅ Token expiration: 7 days
- ✅ CurrentUser decorator for extracting authenticated user

**Chunked Upload System:**
- ✅ Backend chunked upload endpoint (10MB chunks)
- ✅ Backend complete upload endpoint (100MB limit)
- ✅ Automatic chunk merging on server
- ✅ Frontend upload service with progress tracking
- ✅ Automatic selection between chunked/complete upload (50MB threshold)
- ✅ Sequential chunk upload with error handling
- ✅ Visual progress indicator in recorder UI
- ✅ Audio file storage in uploads/audio directory
- ✅ Meeting ownership validation before upload
- ✅ Placeholder for audio processing queue (STT, diarization, etc.)

**Database:**
- ✅ Seeded with sample meeting data for testing
- ✅ Test user created (test@example.com)
- ✅ 6 sample meetings with various statuses

### Component Routes
- `/` - Home page
- `/dashboard` - Meeting list dashboard
- `/meeting/record` - Audio recorder interface
- `/meeting/:id` - Meeting details (placeholder)

### Technical Implementation
- Uses Angular 21 standalone components
- Bootstrap 5.3 with Bootstrap Icons for UI
- Custom dark mode support with CSS variables
- MediaRecorder API for audio capture
- Firebase Authentication + JWT tokens
- HTTP interceptor for automatic token injection
- TypeORM backend with MySQL database
- Multer for multipart file uploads
- Chunked upload pattern for large files (5MB chunks)
- File streaming and chunk merging on backend

### UI Framework Migration (2025-11-23)
- ✅ Migrated from Angular Material to Bootstrap 5.3
- ✅ Added Bootstrap Icons for iconography
- ✅ Implemented dark mode theming with custom CSS variables
- ✅ Responsive grid layout for all screen sizes
- ✅ Custom toast notification system (replaced Material Snackbar)

## Next Steps / TODO

### Completed (2025-11-23)
- ✅ Add authentication guards to protect routes
- ✅ Implement audio file upload with chunked upload support
- ✅ JWT authentication system
- ✅ HTTP interceptor for automatic auth headers
- ✅ Upload progress tracking

### High Priority
- [x] ~~Speech-to-text transcription (Google Cloud)~~ ✅ Implemented 2025-11-29
- [x] ~~Speaker diarization (identify who's speaking)~~ ✅ Implemented 2025-11-29
- [x] ~~Pyannote speaker diarization post-processing~~ ✅ Implemented 2025-11-30
- [x] ~~Segment merging by speaker~~ ✅ Implemented 2025-11-30
- [x] ~~Meeting summary generation~~ ✅ Implemented (OpenAI GPT-4)
- [x] ~~Action items extraction~~ ✅ Implemented (auto-creates tasks from transcript)
- [ ] Add route guards on frontend (AuthGuard)
- [ ] Integrate job queue for background processing (Bull/BullMQ)

### Medium Priority
- [ ] Add local model alternatives (fully offline pipeline):
  - [ ] Ollama + Llama 3.1 8B for summarization (replace OpenAI)
  - [ ] Faster-Whisper for live transcription (replace Google Speech-to-Text)
  - [ ] Make providers configurable (cloud vs local)
- [ ] Implement guest management
- [ ] Add search and filter functionality to dashboard
- [ ] Add retry mechanism for failed uploads
- [ ] Add audio playback in meeting details
- [ ] Implement user settings page

### Low Priority
- [ ] Add meeting edit/delete functionality
- [ ] Export meetings as PDF/CSV
- [ ] Add meeting sharing functionality
- [ ] Implement notifications system

## Development Workflow
1. Start stack: `docker-compose up -d`
2. Backend hot-reloads on changes in ./backend
3. Frontend hot-reloads on changes in ./frontend
4. Database persists via Docker volume: mysql_data

### Database Reset (Dev)
To reset the database to a fresh state with all migrations and seed data:
```bash
docker-compose down
docker volume rm manager_mysql_data
docker-compose up -d
```
MySQL's `docker-entrypoint-initdb.d` automatically runs all migration scripts in alphabetical order on fresh init.

### Adding New Migrations
1. Create new file in `migrations/schema/` with next number:
   - Schema changes: `006_your_migration.sql` (001-099 range)
   - Seed data: `101_more_seeds.sql` (100+ range)
2. The folder is mounted directly to `docker-entrypoint-initdb.d`, so no docker-compose changes needed
3. For idempotent ALTER statements, use stored procedure pattern:
   ```sql
   DROP PROCEDURE IF EXISTS add_column_xyz;
   DELIMITER //
   CREATE PROCEDURE add_column_xyz()
   BEGIN
       IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = 'meeting_manager' AND TABLE_NAME = 'table' AND COLUMN_NAME = 'xyz') THEN
           ALTER TABLE table ADD COLUMN xyz VARCHAR(255);
       END IF;
   END //
   DELIMITER ;
   CALL add_column_xyz();
   DROP PROCEDURE IF EXISTS add_column_xyz;
   ```

## Useful Links
- Backend: http://localhost:3000
- Frontend: http://localhost:4200
- MySQL: localhost:3306

---
*This document should be updated as the project evolves*
