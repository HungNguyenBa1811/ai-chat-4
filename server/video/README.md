# Video Processing System

This directory contains a **completely isolated** video processing system that is **separate from the Q&A functionality**.

## Purpose
- Process video files with FFmpeg and Whisper
- Extract transcripts from videos
- Store video metadata and transcript chunks
- Provide video search functionality

## Easy Removal
This entire system can be easily removed by:
1. Deleting the `server/video/` directory
2. Removing video imports from `server/index.ts`
3. Removing video schema exports from `shared/schema.ts`
4. Running `npm run db:push` to remove video tables

## Architecture

### Core Components
- **VideoProcessor.ts**: Handles FFmpeg and Whisper operations
- **VideoStorage.ts**: Database operations for videos and chunks
- **VideoService.ts**: Business logic and transcript chunking
- **VideoRoutes.ts**: API endpoints for video operations
- **video-schema.ts**: Database schema definitions

### API Endpoints
- `POST /api/videos/upload` - Upload and process video
- `GET /api/videos/subject/:id` - Get videos by subject
- `GET /api/videos/:id` - Get video details with chunks
- `DELETE /api/videos/:id` - Delete video
- `POST /api/videos/search` - Search video transcripts

### Optimizations
- Timeout protection (30s for duration, 2min for audio extraction, 3min for transcription)
- Memory-efficient processing with temporary file cleanup
- Chunked transcripts for better search performance
- Mono audio at 16kHz for optimal Whisper performance

### Dependencies
- **System**: FFmpeg (for video/audio processing)
- **Python**: openai-whisper, moviepy
- **Node**: multer (for file uploads)

## Isolation from Q&A System
- Uses separate database tables (`videos`, `video_chunks`)
- Independent routing and service layer
- No shared components with document Q&A system
- Can be completely removed without affecting chat functionality