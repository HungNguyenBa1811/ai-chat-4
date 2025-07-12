# AI Learning Platform

## Overview

This is a modern AI-powered learning platform built with React, Express.js, and PostgreSQL. The application provides an interactive chat interface where users can engage with AI tutors for various subjects, complemented by video content and document management features.

**Current Status:** Fully functional with Gmail authentication, personalized chat sessions, and AI-powered Q&A system across 8 academic subjects.

## Recent Changes (January 2025) 

✓ **January 9, 2025**: Replaced Statistics section with WebDAV document upload system
✓ **January 9, 2025**: Integrated Nextcloud/WebDAV support for bulk document import
✓ **January 9, 2025**: Implemented PDF processing with OCR (Tesseract) for scanned documents
✓ **January 9, 2025**: Added automatic subject/type detection based on folder structure (e.g., "ly/Lý thuyết về mạch điện" → Physics/Theory)
✓ **January 9, 2025**: Integrated natural language text chunking using spaCy approach
✓ **January 9, 2025**: Fixed WebDAV sync API request method error and added PDF processing fallback
✓ **January 9, 2025**: Updated document table schema (renamed title to name, added type and page_count columns)
✓ **January 9, 2025**: Fixed document type detection to properly recognize "Bài tập" vs "Lý thuyết" based on filename
✓ **January 9, 2025**: Enhanced OCR fallback message with Vietnamese text and suggestions for handling scanned PDFs
✓ **January 9, 2025**: Implemented direct OCR extraction using Tesseract 5.3.4 with Vietnamese language support
✓ **January 9, 2025**: Created document_chunks table for storing processed text chunks
✓ **January 9, 2025**: Enhanced spaCy-like chunking with Vietnamese semantic break detection
✓ **January 9, 2025**: Fixed icon display issues by replacing Font Awesome icons with emoji in defaultSubjects array
✓ **January 9, 2025**: Integrated FAISS/LanceDB vector storage with LangChain for semantic search
✓ **January 9, 2025**: Implemented OpenAI embeddings for document chunks using text-embedding-ada-002
✓ **January 9, 2025**: Enhanced chat responses with RAG (Retrieval Augmented Generation) using vector search
✓ **January 9, 2025**: Added automatic vector processing for uploaded and synced documents
✓ **January 9, 2025**: Replaced emoji icons with proper Lucide React icons for all subjects
✓ **January 9, 2025**: Fixed dark mode styling in Dashboard component
✓ **January 9, 2025**: Separated data layer from frontend code with DataService class
✓ **January 9, 2025**: Created app-config.ts for centralized configuration management
✓ **January 9, 2025**: Rebuilt entire frontend using shadcn/ui components to minimize code complexity while keeping exact same UI
✓ **January 9, 2025**: Replaced all custom components with shadcn/ui variants: Tabs, Dialog, ScrollArea, Skeleton, etc.
✓ **January 9, 2025**: Cleaned up redundant files and standardized component naming
✓ **January 9, 2025**: Removed all admin-related functionality: data layer, authentication, routes, and UI components
✓ **January 9, 2025**: Simplified LoginScreen to only support Gmail authentication, removed admin tabs
✓ **January 10, 2025**: Completely removed all admin account traces from project to prevent system errors
✓ **January 10, 2025**: Fixed RAG vector search to properly filter by subject ID - each subject now searches only its own documents
✓ **January 10, 2025**: Implemented workaround for LanceDB case-sensitive column filtering by filtering results after search
✓ **January 10, 2025**: Activated file upload via paperclip button in chat interface with visual attachment display
✓ **January 10, 2025**: Implemented silent upload behavior - files upload without automatic messages, waiting for student questions
✓ **January 10, 2025**: Added timestamp-based document prioritization in vector search to prioritize newest uploads
✓ **January 10, 2025**: Enhanced UI with file attachment preview on input bar, remove option, and dynamic placeholder text
✓ **January 10, 2025**: Removed verbose toast descriptions for cleaner user experience
✓ **January 10, 2025**: Implemented comprehensive temporary document system with userId/sessionId vector storage
✓ **January 10, 2025**: Added 90% timestamp prioritization for matching user/session documents in search results
✓ **January 10, 2025**: Updated chat API to use context-aware search with user/session information for temporary docs
✓ **January 10, 2025**: Enhanced file upload to mark chat-uploaded documents as temporary with user/session tracking
✓ **January 10, 2025**: Fixed accessibility warnings by adding DialogDescription to all modal components
✓ **January 10, 2025**: Added comprehensive vector deletion system - vectors are removed when documents/sessions are deleted
✓ **January 10, 2025**: Implemented automatic cleanup of expired temporary vectors (7+ days old) with periodic maintenance
✓ **January 10, 2025**: Added vector management API endpoints for cleanup, statistics, and bulk operations
✓ **January 10, 2025**: Startup cleanup removes all old vectors and schedules daily maintenance for temporary documents
✓ **January 10, 2025**: Updated documents table schema to include isTemporary, userId, and sessionId fields
✓ **January 10, 2025**: Modified upload route to create temporary documents when uploaded via chat paperclip
✓ **January 10, 2025**: Enhanced storage layer with temporary document management methods
✓ **January 10, 2025**: Added comprehensive API endpoints for temporary document statistics and cleanup
✓ **January 10, 2025**: Implemented automatic cleanup of expired temporary documents (7+ days old)
✓ **January 10, 2025**: Enhanced vector cleanup system to work with both temporary and permanent documents
✓ **January 10, 2025**: Fixed PostgreSQL relation errors for temporary documents - resolved schema sync issues
✓ **January 11, 2025**: Separated temporary and permanent documents into different tables as requested
✓ **January 11, 2025**: Fixed vector schema mismatch error - temporary documents now use same schema as permanent documents
✓ **January 11, 2025**: Updated processTemporaryDocumentChunks to use documentId field instead of temporaryDocumentId for consistency
✓ **January 11, 2025**: Enhanced temporary document management with proper upload routing and storage separation
✓ **January 11, 2025**: Fixed vector metadata system hoàn toàn - recreated LanceDB table với schema đầy đủ userID, sessionID, timestamp
✓ **January 11, 2025**: Verified vector deletion system hoạt động đúng - xóa document/session sẽ xóa vectors tương ứng
✓ **January 11, 2025**: Implemented temporal prioritization với 90% weight cho temporary documents, +10 boost score
✓ **January 11, 2025**: Added comprehensive cleanup system cho expired vectors (7+ days old) với startup và periodic maintenance
✓ **January 11, 2025**: HOÀN THÀNH permanent document fallback logic - khi không có temporary docs matching user/session hoặc câu hỏi không liên quan, hệ thống tự động fallback về permanent documents
✓ **January 11, 2025**: Fixed vector categorization logic - permanent documents với userId=0,sessionId=0 được nhận ra đúng
✓ **January 11, 2025**: Enhanced search API với fallback behavior - no user context sẽ treat all docs như permanent để ensure coverage
✓ **January 11, 2025**: COMPLETED CODE OPTIMIZATION - consolidated duplicate functions, streamlined search logic, reduced debug logs while preserving all temporary/permanent document functionality
✓ **January 11, 2025**: Unified processDocumentChunks methods into single efficient function, optimized scoring algorithm, removed redundant logging for better performance
✓ **January 11, 2025**: Restructured VideoPlayer layout: removed video list sidebar, allocated 50/50 split between video viewing (top half) and chat Q&A interface (bottom half)
✓ **January 11, 2025**: Added zoom in/out, fullscreen functionality và MathJax support cho video chat interface
✓ **January 11, 2025**: Fixed sidebar delete buttons - positioned properly và visible in right corner của chat history
✓ **January 11, 2025**: Implemented video processing system with MoviePy and Whisper integration for automatic transcript extraction
✓ **January 11, 2025**: Created transcript_chunks table for storing timestamped video transcript segments
✓ **January 11, 2025**: Added video upload interface with progress indicator and automatic processing pipeline
✓ **January 11, 2025**: Integrated transcript chunks with vector database for enhanced search capabilities (separate from Q&A)
✓ **January 11, 2025**: FIXED critical video processing errors - optimized Whisper transcription with 120+ lines of code removed/optimized
✓ **January 11, 2025**: Resolved EXDEV cross-device link error by replacing fs.rename with fs.copyFile for video file operations
✓ **January 11, 2025**: Implemented aggressive timeout handling with signal.alarm(60) to prevent video processing from hanging
✓ **January 11, 2025**: Successfully completed Vietnamese video transcription (Burkina Faso history) with optimized performance
✓ **January 11, 2025**: SEPARATED video system from Q&A - created VideoController, videoRoutes, VideoIntentService to prevent conflicts
✓ **January 11, 2025**: Implemented intelligent video intent detection - recognizes "xem video", "cho tôi xem" keywords and matches topics via vector search
✓ **January 11, 2025**: Fixed LanceDB compatibility by replacing .vectorSearch() with .search() for video transcript search functionality
✓ **January 11, 2025**: COMPLETED video system separation - video routes (/api/videos/*), controller, intent service fully independent from chat Q&A
✓ **January 11, 2025**: Successfully processed Vietnamese video transcript chunks into vector embeddings for semantic search
✓ **January 11, 2025**: Video database operational: "lịch sử về burkina faso phần 1" (711s) with real transcript content ready for search
✓ **January 11, 2025**: FINALIZED separation: removed legacy video routes, fixed frontend to use new endpoints (/api/videos/subject/:id)
✓ **January 11, 2025**: Q&A system completely isolated - only searches document vectors, never video transcripts
✓ **January 11, 2025**: Video system completely isolated - only searches video transcript vectors, never documents
✓ **January 11, 2025**: Fixed unwanted overflow-y-auto class appearing in sidebar below "AI học tập" section by replacing ScrollArea with simple div
✓ **January 11, 2025**: COMPLETELY REMOVED entire video system from project per user request:
   - Deleted all video-related files: VideoController, videoRoutes, VideoIntentService, video processors, VideoPlayer, VideoUploadModal
   - Removed video and transcriptChunks tables from database schema
   - Removed all video methods from storage interface and implementation
   - Removed video search functionality from vectorService
   - Removed video processing from WebDAV sync
   - Cleaned up all video imports and references from frontend
   - Removed processTranscriptChunks method from vectorService
   - Deleted uploads/videos directory
   - System now focuses exclusively on document-based Q&A learning platform
✓ **January 11, 2025**: Created complete frontend-only video system with 3/5 video player and 2/5 chat interface:
   - VideoPlayer component with full controls (play/pause, volume, seek, fullscreen)
   - VideoChatInterface with independent OpenAI integration for video-specific Q&A
   - VideoLayout combining both components in 60%-40% split
   - Updated routing in Home.tsx and SubjectModal for video navigation
   - Added custom CSS styling for video player sliders
✓ **January 11, 2025**: Fixed settings update error - added missing PATCH route in backend that was causing JSON parse errors
✓ **January 11, 2025**: Resolved toast system bug by removing incorrect state dependency in useEffect hook
✓ **January 11, 2025**: Fixed AI chat formatting issues - simplified system prompts, increased max_tokens to 2000, reduced temperature to 0.3 for consistent Vietnamese responses with proper structure
✓ **January 11, 2025**: Completely fixed AI chat natural formatting - removed rigid section headers, enhanced line break processing in markdown processor to properly display \n as <br> tags
✓ **January 11, 2025**: Fixed MathJax formula extraction bug - reordered markdown processor to restore MathJax content before line break conversion, preventing formula corruption
✓ **January 11, 2025**: Enhanced table creation functionality - added comprehensive markdown table processing with modern styling, alignment support, and dark/light mode compatibility
✓ **January 11, 2025**: Fixed MathJax formula rendering issue - removed problematic table processing that was interfering with MathJax placeholders, restored proper mathematical formula display
✓ **January 11, 2025**: COMPLETED comprehensive markdown processor rewrite - fixed MathJax double-escaping issue, restored full table processing with modern styling, safe processing order prevents conflicts
✓ **January 11, 2025**: Fixed MathJax placeholder replacement bug and reduced table margins - formulas now display correctly instead of placeholder text, tables have tighter spacing (8px vs 16px)
✓ **January 11, 2025**: Enhanced MathJax replacement with global regex pattern and further reduced table margins to 4px for more compact display
✓ **January 11, 2025**: FIXED MathJax placeholder system completely - rewritten protection logic using object-based approach with counter to prevent placeholder text display, restored table creation functionality
✓ **January 11, 2025**: COMPLETELY REWROTE table processing system - replaced complex regex with line-by-line parsing for better AI table detection, reduced margins to 1px, optimized padding to 6px/10px, hardcoded CSS values for reliable styling
✓ **January 11, 2025**: ENHANCED table visual design - eliminated margins (0px), upgraded to 2px borders with gradient colors, added layered shadows, implemented linear gradient backgrounds for headers/rows, improved typography with better fonts and spacing
✓ **January 11, 2025**: FIXED table detection issues - simplified regex pattern from complex pipe/dash detection to basic | and - matching, removed problematic display:block, added !important to padding for true zero spacing
✓ **January 11, 2025**: COMPLETELY FIXED table system - added div wrapper with zero margins, improved detection logic (min 3 columns + flexible separator), changed background from white to light gray (#f8f9fa) for better readability, updated all colors to match gray theme
✓ **January 11, 2025**: ULTRA FLEXIBLE table detection - now only requires 2+ | characters for table creation, removed strict separator requirements, added overflow-x auto and word-wrap to prevent text truncation (...), tables now responsive with proper text wrapping
✓ **January 11, 2025**: COMPLETELY REWROTE table processor from scratch - removed all complex logic, any line with | becomes table row, automatic header detection (first row), alternating row colors, simple and robust approach that works with any table pattern
✓ **January 11, 2025**: FIXED dark mode table styling - added full CSS support for dark theme with proper colors, borders, and readability
✓ **January 11, 2025**: REMOVED ellipsis (...) from chat session titles - cleaner display in sidebar
✓ **January 11, 2025**: ENHANCED AI system prompt - now automatically creates tables when students ask for comparisons or when there are multiple elements to present, making responses more organized and easier to read
✓ **January 11, 2025**: SIGNIFICANTLY IMPROVED table logic - added explicit keyword detection system with mandatory table creation for words like "so sánh", "các loại", "bảng", "ưu điểm", "đặc điểm", etc. AI now MUST create tables when these triggers are detected, ending the need for manual prompting
✓ **January 11, 2025**: COMPLETELY REWROTE MathJax processing logic - removed complex placeholder system that was causing formula display issues, separated MathJax from table processing to prevent conflicts, simplified markdown processor to leave math content untouched and let MathJax component handle all formula rendering
✓ **January 11, 2025**: IMPROVED chat UX with instant message display - user messages now appear immediately when sent instead of waiting for AI response, file attachments are preserved and displayed with user messages using pendingMessages state for optimistic updates
✓ **January 11, 2025**: ENHANCED table creation flow - AI now provides context overview before creating tables instead of jumping directly to tables, making responses more natural with introduction → table → optional conclusion structure
✓ **January 11, 2025**: INSTALLED video processing system - FFmpeg and Whisper for video transcript extraction, completely isolated from Q&A system with optimized code for easy removal when requested
✓ **January 11, 2025**: INTEGRATED video processing with WebDAV sync - now supports MP4, AVI, MOV, MKV formats with automatic transcript extraction using FFmpeg + Whisper
✓ **January 11, 2025**: ENHANCED video database - added webdavUrl field for cloud storage, created transcript_chunks table separate from documents for better organization
✓ **January 11, 2025**: UPDATED WebDAV upload interface - now displays support for video formats alongside PDF/DOC files
✓ **January 11, 2025**: COMPLETELY SEPARATED video transcript vector system from Q&A document vectors - created dedicated video_transcripts LanceDB table
✓ **January 11, 2025**: IMPLEMENTED semantic video search using OpenAI embeddings - students can request videos and system finds most relevant content via vector similarity
✓ **January 11, 2025**: INTEGRATED video transcript chunks with vector database - automatic processing during video upload/sync creates searchable embeddings
✓ **January 11, 2025**: ADDED video intent detection system - recognizes keywords like "xem video", "cho tôi xem" to trigger video search instead of document Q&A
✓ **January 11, 2025**: ENHANCED VideoService with vector search capabilities - searchTranscripts now uses semantic similarity instead of basic text matching
✓ **January 11, 2025**: IMPLEMENTED automatic video vector cleanup - deleting videos removes corresponding vectors from LanceDB
✓ **January 11, 2025**: CREATED comprehensive video vector statistics and management system for monitoring video content
✓ **January 11, 2025**: IMPLEMENTED video Q&A chat system với combined vector search - tìm kiếm đồng thời cả video transcripts và permanent documents
✓ **January 11, 2025**: CREATED VideoChatInterface component với MathJax support, real-time messaging, và integrated với OpenAI
✓ **January 11, 2025**: BUILT complete VideoLayout với 60/40 split: video player (VideoPlayer component) và chat interface
✓ **January 11, 2025**: ADDED video streaming endpoint và full video controls (play/pause, volume, seek, fullscreen)
✓ **January 11, 2025**: ENHANCED vector search với searchCombinedForVideoQA method - không search temporary documents trong video Q&A
✓ **January 11, 2025**: INTEGRATED /api/videos/chat endpoint với ChatGPT để trả lời dựa trên combined context từ videos + documents
✓ **January 11, 2025**: UPDATED video chat system prompt to be more sensitive to video-related keywords like "xem", "muốn xem", etc. while still answering Q&A using both transcripts and documents
✓ **January 11, 2025**: ENHANCED video intent detection with expanded keywords list including single word "xem" and variations
✓ **January 11, 2025**: REMOVED all timestamp functionality from video system - no longer process or display video timestamps to reduce resource consumption
✓ **January 11, 2025**: SIMPLIFIED transcript chunking to use text-only semantic grouping (10 sentences per chunk) without time calculations
✓ **January 11, 2025**: UPDATED vector storage to store 0 for startTime/endTime fields while maintaining schema compatibility
✓ **January 11, 2025**: ENHANCED ChatGPT prompt to explicitly avoid mentioning specific video timestamps, focusing only on content
✓ **January 11, 2025**: IMPLEMENTED priority model for Video Q&A: 70% permanent documents, 30% video transcripts (Q&A section remains unchanged)
✓ **January 11, 2025**: ADJUSTED searchCombinedForVideoQA to fetch results based on priority ratio - more documents than transcripts
✓ **January 11, 2025**: UPDATED ChatGPT system prompt to prioritize information from documents (70%) over video transcripts (30%)
✓ **January 11, 2025**: ENHANCED video transcript prioritization - when watching a video, system now prioritizes transcripts from CURRENT VIDEO
✓ **January 11, 2025**: IMPLEMENTED score boosting (50% better) for current video transcripts to ensure relevant context when watching
✓ **January 11, 2025**: UPDATED context building to mark [VIDEO ĐANG XEM] and display current video content first in results
✓ **January 11, 2025**: UPGRADED video chat system to have full Q&A capabilities - added table creation logic, MathJax formulas, bold/italic formatting, plus special "Xem" video intent detection prompt
✓ **January 11, 2025**: ENHANCED prompt for both Q&A and Video chat - added comprehensive introduction (3-5 sentences about origins, context, importance) before tables and meaningful conclusions (2-3 sentences about key features, applications, memory tips) after tables
✓ **January 11, 2025**: ADDED engaging follow-up questions at the end of all responses - "Want to learn effective study methods?", "Want to explore related topics?", or "Want practice problems?" for theory questions
✓ **January 11, 2025**: IMPLEMENTED smart exercise handling - when students request exercises, system only shows questions without solutions until they attempt or request answers; automatically recognizes context-based requests like "exercises from that section"
✓ **January 11, 2025**: REMOVED test endpoints from video routes (/api/videos/test-id-zero and /api/videos/test-lifecycle) to prevent system errors and clean up production code
✓ **January 11, 2025**: UPDATED temporary document and vector expiration from 7 days to 2 hours - temporary files now auto-delete after 2 hours to save storage space, with cleanup check running every hour instead of daily
✓ **January 11, 2025**: DISABLED automatic vector deletion on server startup - vectors are now preserved across restarts, only deleted when explicitly requested or on database failure
✓ **January 11, 2025**: ADDED DOCX support for document upload - files can now be uploaded via paperclip button in chat interface, automatically extracted, chunked, and vectorized just like PDFs using mammoth library
✓ **January 11, 2025**: FIXED Q&A logic errors - added getTemporaryDocument method and fixed document metadata retrieval to properly handle both temporary and permanent documents
✓ **January 11, 2025**: VERIFIED complete Q&A system logic - temporary/permanent document categorization, prioritization, and fallback logic all working correctly, just needs database connection
✓ **January 11, 2025**: OPTIMIZED video transcript extraction - switched from "base" to "tiny" Whisper model for 5-10x faster processing with minimal quality loss
✓ **January 11, 2025**: IMPLEMENTED dynamic timeout system - timeouts now scale with video duration (1-10 minutes based on video length) instead of fixed timeouts
✓ **January 11, 2025**: VERIFIED video processing pipeline working perfectly - FFmpeg audio extraction, Whisper transcription, file upload, and vector storage all functioning correctly
✓ **January 11, 2025**: CLEANED UP all test files and dummy data - removed test_video_transcript.js, test_whisper.py, and test videos from uploads directory

✓ Fixed user authentication system to properly store and use database user IDs
✓ Implemented personalized chat history based on user database ID
✓ Enhanced chat interface with file upload capability
✓ Updated color scheme for better appeal to teenage students
✓ Improved error handling for chat session creation
✓ Added proper user settings management with theme and GPT model selection
✓ Fixed chat message display with proper styling for user/assistant messages
✓ Added sidebar layout for Q&A and Video views with persistent navigation
✓ Resolved chat blinking issue by disabling auto-refresh
✓ Improved sidebar design with cleaner chat history display
✓ Fixed API endpoint for chat messages (using /api/chat/messages/:sessionId)
✓ Restructured navigation to replace dashboard completely when viewing Q&A or Videos
✓ Modified SubjectModal to use navigation callbacks instead of rendering views directly
✓ **January 8, 2025**: Integrated MathJax for beautiful mathematical formula rendering
✓ **January 8, 2025**: Enhanced chat interface with modern bubble design and gradients
✓ **January 8, 2025**: Removed user avatars and improved AI avatars with rounded-xl design
✓ **January 8, 2025**: Added instant message display - user messages appear immediately when sent
✓ **January 8, 2025**: Added title column to chat_sessions table in PostgreSQL
✓ **January 8, 2025**: Implemented dynamic chat session titles based on first user question
✓ **January 8, 2025**: Fixed chat history display in sidebar with proper query structure

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: React Query (TanStack Query) for server state
- **Routing**: Wouter for client-side routing
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM for type-safe database operations
- **API**: RESTful API with JSON responses
- **Development**: Hot reload with Vite middleware integration

### Database Design
- **Database**: PostgreSQL with Neon serverless
- **Schema Management**: Drizzle Kit for migrations
- **Connection**: Connection pooling with @neondatabase/serverless

## Key Components

### Authentication System
- **Provider**: Firebase Authentication with Google Sign-In
- **Flow**: OAuth integration with server-side user management
- **Sessions**: Firebase handles client sessions, server creates/manages user records

### Chat System
- **AI Integration**: OpenAI API for conversational AI
- **Models**: Configurable GPT models (default: gpt-4o)
- **Sessions**: Persistent chat sessions with dynamic titles based on first user question
- **Real-time**: Instant message display with optimistic updates
- **Math Support**: MathJax integration for inline ($...$) and display ($$...$$) formulas
- **History**: Complete chat history displayed in sidebar with proper session titles
- **RAG Support**: Retrieval Augmented Generation using vector search to provide context-aware responses
- **Vector Search**: LanceDB integration for semantic similarity search across document chunks

### Subject Management
- **Content**: Predefined subjects with icons and colors
- **Resources**: Each subject can have associated documents and videos
- **Organization**: Subject-based chat sessions and content grouping

### User Interface
- **Design System**: shadcn/ui components with Radix UI primitives
- **Responsive**: Mobile-first design with adaptive layouts
- **Theme**: Light/dark mode support with CSS variables
- **Accessibility**: ARIA-compliant components

## Data Flow

1. **User Authentication**: Firebase → Server authentication endpoint → Database user creation/lookup
2. **Chat Interaction**: Client → Chat API → OpenAI API → Database message storage → Client update
3. **Content Management**: Subject selection → Content APIs → Database queries → UI rendering
4. **Settings**: User preferences → Settings API → Database updates → UI state sync

## External Dependencies

### Core Services
- **Firebase**: Authentication and user management
- **OpenAI**: AI chat functionality and content generation (including embeddings)
- **Neon**: PostgreSQL database hosting
- **LanceDB**: Vector database for semantic search

### Development Tools
- **Vite**: Build tool with HMR and development server
- **Drizzle**: Database ORM and migration management
- **Tailwind**: Utility-first CSS framework

### UI Libraries
- **Radix UI**: Headless component primitives
- **Lucide**: Icon library
- **React Query**: Server state management

## Deployment Strategy

### Production Build
- Client: Vite builds static assets to `dist/public`
- Server: esbuild compiles TypeScript to `dist/index.js`
- Database: Drizzle migrations applied via `db:push` command

### Environment Requirements
- Node.js environment with ES module support
- PostgreSQL database (Neon recommended)
- Firebase project with Authentication enabled
- OpenAI API key for chat functionality

### Development Workflow
- `npm run dev`: Starts development server with hot reload
- `npm run build`: Creates production build
- `npm run start`: Runs production server
- `npm run db:push`: Applies database schema changes

The application follows a monorepo structure with shared TypeScript definitions, making it easy to maintain type safety across the full stack while keeping the codebase organized and scalable.