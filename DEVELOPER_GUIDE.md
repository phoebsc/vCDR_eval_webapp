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
**Benchmark tets**: `server/lib/benchmarkTests`

## Quality Metrics System

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

can you actually make a document like this but for the benchmarking tests? 
## Quality Metrics System

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

## Benchmarking Tests System

### Architecture Overview

The benchmarking tests system provides **lightweight, deterministic analysis of benchmark conversations** using a dedicated Python analysis pipeline. Unlike the quality metrics system, it does **not** depend on external repositories or LLM calls and is designed to run automatically as part of each benchmark run.

**Key design goals:**

* Fast, reproducible computation
* Clear separation between orchestration (Node.js) and analysis (Python)
* One test per file for modularity and extensibility

**Key Components:**

* `server/lib/benchmarkTests/computeTests.js` – Orchestrates benchmarking test runs
* `server/lib/benchmarkTests/pythonRunner.js` – Spawns Python process and parses results
* `pycode_benchmarking/run_benchmarking.py` – Python CLI entrypoint
* `pycode_benchmarking/tests/*.py` – Individual benchmarking tests (one per file)
* Workspace output under `data/benchmarks/<run_id>/`

---

### Integration Flow

```
1. Benchmark run completes → run_id finalized
2. Node.js converts conversation to "AGENT: xxx\nPARTICIPANT: xxx\n" transcript
3. Transcript written to data/benchmarks/<run_id>/transcript.txt
4. Node spawns Python runner (run_benchmarking.py)
5. Python imports and executes each test module
6. Python prints structured JSON to stdout
7. Node parses results and attaches them to benchmark output
```

---

### Key Implementation Details

**Static Python Modules**
Benchmarking logic lives in real Python files committed to the repo. No Python code is generated dynamically at runtime.

**One Test = One File**
Each benchmarking test is implemented as a standalone Python module exporting a single `run()` function.

**Node ↔ Python Contract**

* Node is responsible for I/O, process control, and parsing output
* Python is responsible for all test computation
* Communication occurs strictly via JSON printed to stdout

**ES Module Imports (Node.js)**
The server uses ES Modules. All local imports must:

* Use relative paths (`./` or `../`)
* Include file extensions

Example:

```js
import { runBenchmarkPython } from "./pythonRunner.js";
```

---

### Directory Structure

```
server/
  lib/
    benchmarkTests/
      computeTests.js   # Orchestrates benchmarking runs
      pythonRunner.js           # Spawns Python + parses stdout

pycode_benchmarking/
run_benchmarking.py        # Python CLI entrypoint
tests/
    conversation_flow.py     # Conversation structure analysis
```

---

### Python Test Contract

Each Python test file exports a single function:

```python
def run(transcript: str) -> dict:
```

The function must return an object of the form:

```json
{
  "title": "Test Name",
  "variables": [
    { "metric": "...", "value": "...", "status": "good|warning|poor" }
  ]
}
```

No side effects or external dependencies are expected.

---

### Python Runner Contract

The Python entrypoint `run_benchmarking.py`:

* Accepts `--run-id` and `--transcript` CLI arguments
* Imports each test module explicitly
* Executes each test’s `run()` function
* Aggregates results
* Emits structured JSON wrapped in markers:

```
BENCHMARK_RESULT_START
{ ... }
BENCHMARK_RESULT_END
```

Node parses **only** the JSON between these markers.

---

### API Integration

The benchmarking tests system is invoked internally as part of a benchmark run and does not expose standalone public API endpoints.

Results are included in the benchmark computation output and can be stored or displayed alongside run metadata as needed.

---

### Critical Files Modified / Added

* `server/lib/benchmarkTests/computeTests.js` – Main orchestration logic
* `server/lib/benchmarkTests/pythonRunner.js` – Python process execution
* `pycode_benchmarking/run_benchmarking.py` – Python runner entrypoint
* `pycode_benchmarking/tests/*.py` – Individual benchmark tests

---

### Extending the Benchmarking System

To add a new benchmarking test:

1. Create a new file in `pycode_benchmarking/tests/`
2. Implement `run(transcript: str) -> dict`
3. Import and call the test in `run_benchmarking.py`


## Configuration Points

- **Database Path**: `server/data/benchmarks.sqlite` (configurable)
- **Prompts Directory**: `./prompts/` (hardcoded)
- **API Prefix**: `/api/` (consistent across all endpoints)
- **Payload Limits**: 50MB (set in server.js middleware)