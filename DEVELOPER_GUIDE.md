# Developer Guide: Benchmarking System Architecture

## Project Overview

This project transforms OpenAI's Realtime Console from a simple API demonstration into a comprehensive **voice-based AI benchmarking platform**. It enables automated conversations between AI agents for research and evaluation purposes.

### Core Concept
- **Voice Bot (Interviewer)**: OpenAI Realtime API agent conducting structured interviews
- **Simulated User (Participant)**: OpenAI GPT API agent responding as research participant
- **Benchmarking System**: Orchestrates conversations, captures data, enables analysis

### Technology Stack
```
Frontend: React 18 + Vite SSR + Tailwind CSS
Backend: Node.js + Express.js + SQLite3
AI Integration: OpenAI Realtime API (GA) + OpenAI GPT API
Real-time: WebRTC + Server-Sent Events
```

### System Architecture

```
┌─────────────────────────────────────┐
│             Client Layer            │
├─────────────────┬───────────────────┤
│  React Frontend │   Results Viewer  │
│  • App.jsx     │   • ResultsPage   │
│  • Benchmark   │   • RunDetail     │
│    Panel       │     Page          │
└─────────────────┴───────────────────┘
           │                    │
           ▼                    ▼
┌─────────────────────────────────────┐
│           Server Layer              │
├─────────────────┬───────────────────┤
│  Express APIs   │   SSR Rendering   │
│  • /api/runs    │   • /results      │
│  • /api/prompts │   • /results/:id  │
│  • /token       │                   │
└─────────────────┴───────────────────┘
           │                    │
           ▼                    ▼
┌─────────────────┬───────────────────┐
│ Database Layer  │  Prompt System    │
│ • SQLite DB     │  • /prompts/*.txt │
│ • CRUD Ops      │  • Dynamic Loading│
└─────────────────┴───────────────────┘
           │                    │
           ▼                    ▼
┌─────────────────┬───────────────────┐
│ OpenAI Realtime │  OpenAI GPT API   │
│ (Voice Bot)     │  (Simulated User) │
└─────────────────┴───────────────────┘
```

### Data Flow Architecture

**1. Session Initialization**
```
User selects prompts → App.jsx state → /token API → OpenAI Realtime session
```

**2. Benchmark Execution**
```
Start benchmark → Create run_id → Initialize agents → Monitor conversation →
Real-time transcript updates → Natural/manual ending → Save to database
```

**3. Results Analysis**
```
/results page → Fetch run metadata → Click run_id → Fetch full transcript →
Display with copy/scroll functionality
```

### Key Directories Structure
```
├── client/                    # React frontend
│   ├── components/           # UI components
│   ├── lib/                  # Client business logic
│   └── pages/                # Results viewer pages
├── server/                   # Backend infrastructure
│   └── lib/                  # Database operations
├── lib/                      # Shared utilities
│   └── promptLoader.js       # Dynamic prompt system
├── prompts/                  # Conversation scenarios (.txt files)
└── server.js                 # Main Express server
```

## New Components Added

### 1. Database Layer (`server/lib/database.js`)
**Purpose**: SQLite persistence replacing localStorage
**Key Functions**:
- `initializeDatabase()` - Creates tables on startup
- `saveBenchmarkRun(runId, runData)` - Persists completed runs
- `getBenchmarkRuns()` - Lists all runs (metadata only)
- `getBenchmarkRun(runId)` - Full run details with transcript

**Extension Points**:
- Add indexes for performance: `CREATE INDEX idx_created_at ON benchmark_runs(created_at)`
- Add run metadata fields: `ALTER TABLE benchmark_runs ADD COLUMN tags TEXT`
- Add query filters: modify `getBenchmarkRuns()` to accept WHERE clauses

### 2. Dynamic Prompt System (`lib/promptLoader.js`)
**Purpose**: File-based prompt configuration with ID generation
**Key Functions**:
- `getPromptConfig(promptName)` - Loads prompt from `/prompts/{name}.txt`
- `generatePromptId(promptName)` - Creates hash-based IDs for prompts
- `getInterviewerPromptId()`, `getSimulatedUserPromptId()` - Helper functions

### 3. API Layer (server.js)
**New Endpoints**:

```javascript
POST /api/benchmark-runs          // Create run ID
PUT /api/benchmark-runs/:run_id   // Save completed run
GET /api/benchmark-runs           // List runs
GET /api/benchmark-runs/:run_id   // Get full run details
GET /api/prompts                  // List available prompts
```

### 4. Client Refactoring
**BenchmarkingService.js**: Replaced localStorage with API calls
**App.jsx**: Added prompt selection state management
**New Pages**: ResultsPage.jsx, RunDetailPage.jsx for data viewing

## Current Architecture Flow

```
1. Prompt Selection (BenchmarkPanel) → App state
2. Start Session → Token request with selected interviewer prompt
3. Start Benchmark → API creates run_id, initializes simulated user with selected prompt
4. Monitor Conversation → Real-time transcript building
5. End Run → API saves full data to SQLite
6. View Results → Results pages query database
```

## Critical Files for new feature developement

**Database Changes**: `server/lib/database.js`
**API Changes**: `server.js` (endpoints section)
**Prompt System**: `lib/promptLoader.js`
**Client Logic**: `client/lib/BenchmarkingService.js`
**UI Components**: `client/components/BenchmarkPanel.jsx`, results pages
**Quality Metrics**: `server/lib/metricsService.js` (vCDR Python integration)

## Quality Metrics System (Added)

### Architecture Overview
The quality metrics system integrates with the vCDR repository (scoring_edits branch) via git submodule to provide LLM-based conversation analysis.

**Key Components:**
- `server/lib/metricsService.js` - Core integration logic with vCDR Python scripts
- `external/vCDR/` - Git submodule pointing to vCDR scoring_edits branch
- Database extension with `quality_metrics_json`, `interviewer_prompt_name`, `simulated_user_prompt_name` columns
- UI integration in RunDetailPage.jsx with Quality Metrics tab

### Integration Flow
```
1. User clicks "Compute Quality Metrics" → Manual trigger only (cost control)
2. Node.js converts conversation to "AGENT: xxx\nPARTICIPANT: xxx\n" format
3. Dynamic Python script generated with vCDR imports and user's actual interviewer prompt
4. Python calls extract_responses_benchmark(conversation_id, transcript, module_id)
5. Results parsed from Python output and stored in database
6. Future views load from database (no recomputation unless requested)
```

### Key Implementation Details

**Windows Path Handling**: All Python script paths use raw strings `r"${path}"` to handle backslashes
**Dynamic Prompt Selection**: Uses actual `interviewer_prompt_name` from database (stored when user selects prompt)
**Fallback System**: Commented out for testing - can be re-enabled for production resilience
**Error Handling**: Comprehensive logging with `[METRICS]`, `[RECOMPUTE]`, `[PYTHON]` tags for debugging

### Database Schema Extensions
```sql
-- Added columns for prompt names and quality metrics storage
ALTER TABLE benchmark_runs ADD COLUMN interviewer_prompt_name TEXT;
ALTER TABLE benchmark_runs ADD COLUMN simulated_user_prompt_name TEXT;
ALTER TABLE benchmark_runs ADD COLUMN quality_metrics_json TEXT;
```

### API Endpoints Added
```javascript
POST /api/benchmark-runs/:run_id/metrics  // Compute quality metrics
GET  /api/benchmark-runs/:run_id/metrics   // Retrieve quality metrics
POST /api/test-vcdr-integration           // Test endpoint (uses real DB prompts)
```

### Critical Files Modified
- `server/lib/metricsService.js` - Main vCDR integration logic
- `server/lib/database.js` - Schema extensions and updateQualityMetrics()
- `server.js` - New API endpoints with comprehensive logging
- `client/pages/RunDetailPage.jsx` - Quality Metrics tab UI
- `.gitmodules` - vCDR submodule configuration for scoring_edits branch

### Python Integration Notes
- Creates dynamic Python script per run with proper Windows path handling
- Imports from `voz_vcdr.extract_responses.extract_responses_benchmark`
- Maps interviewer prompt name to module ID via `moduleTitle2ID()` function
- Returns structured JSON via `VCDR_RESULT_START/VCDR_RESULT_END` markers
- Timeout protection (60 seconds) and comprehensive error logging

### Testing & Debugging
- Use test endpoint: `POST /api/test-vcdr-integration` (uses real prompts from DB)
- Monitor both browser console (`[CLIENT]` logs) and terminal (`[METRICS]` logs)
- Check `data/metrics/[run_id]/` for generated Python scripts and transcripts
- Module loading logs: `[METRICSSERVICE] 🔄 Module loaded at: [timestamp]`

## Testing New Features

1. **Database**: Test with `sqlite3 server/data/benchmarks.sqlite` CLI
2. **API**: Use curl or Postman against localhost:3000/api/*
3. **Prompts**: Add test .txt file to /prompts/, verify in dropdown
4. **End-to-end**: Complete benchmark run, verify data persistence

## Configuration Points

- **Database Path**: `server/data/benchmarks.sqlite` (configurable)
- **Prompts Directory**: `./prompts/` (hardcoded)
- **API Prefix**: `/api/` (consistent across all endpoints)
- **Payload Limits**: 50MB (set in server.js middleware)