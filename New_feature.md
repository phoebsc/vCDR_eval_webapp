
## Context

This repository (`openai-realtime-console/`) is a React + Vite frontend with an Express backend (`server.js`) that integrates with the OpenAI Realtime API via WebRTC.

Benchmarking is initiated via `BenchmarkPanel.jsx` and orchestrated by `client/lib/BenchmarkingService.js`, which interacts with a simulated user (`client/lib/SimulatedUser.js`). Benchmark run persistence is currently limited (e.g., localStorage).

This feature reorganizes responsibility so that:

* the **server** becomes the source of truth for benchmark persistence and retrieval, and
* the **client** acts purely as a UI/control plane.

A results viewer page is added to inspect previously saved benchmark runs.

---

## Primary Goals

1. **Server–client reorganization**

   * Server manages persistence and retrieval of benchmark runs
   * Client triggers run start/end and submits completed run data to server

2. **Database persistence**

   * Each benchmark run is saved to a **server-managed SQLite database**
   * Runs persist across browser reloads and server restarts

3. **Results viewer**

   * Add **View Results** button in `BenchmarkPanel.jsx`
   * Add a `/results` page listing all saved runs

---

## Non-Goals (This Iteration)

* No scoring, evaluation, or analytics
* No filtering, search, pagination, or tagging
* No per-run detail view
* No editing, deletion, or export
* No telephony / audio work

---

## Server / Client Responsibilities

### Client (UI / Control Plane)

* Runs the live benchmark session as it does today
* Displays live transcript and event log during a run
* Calls server APIs to:

  * allocate a new `run_id`
  * persist a completed run
  * fetch a list of saved runs for the results page

**Important constraint:**
The client must NOT be the authoritative store for benchmark runs. localStorage may exist as a temporary cache during a live run, but persisted runs must come from the server database.

The client must NOT be required to know or transmit sensitive server-side configuration (e.g., full system prompts).

---

### Server (Persistence Source of Truth)

* Owns the benchmark database
* Persists completed benchmark runs
* Computes derived fields (e.g., `num_turns`)
* Serves metadata about runs to the client

The server is the **authoritative owner of prompts and configuration**. The browser must never be relied upon to return full prompt text back to the server.

---

## Feature 1 — Persistent Benchmark Run Storage (Server DB)

### Objective

Persist all relevant data from a benchmark run so it can be inspected later.

### Data to Persist (One Record per Run)

Each benchmark run MUST be saved as a single record with:

* `run_id` (string, UUID v4 or equivalent)
* `created_at` (ISO timestamp)
* `mode` (string, always `"benchmark"`)
* `conversation_history`

  * ordered list of turns
  * each turn includes:

    * `speaker` (`"interviewer"` | `"simulated_user"`)
    * `content` (string)
    * `timestamp` (ISO timestamp)
* `event_log`

  * ordered list of raw system/OpenAI events
  * raw payloads preserved server-side
* `interviewer_prompt_id` (string)

  * identifier or hash of the interviewer system prompt
* `simulated_user_prompt_id` (string)

  * identifier or hash of the simulated user configuration
* `num_turns`

  * integer derived from `conversation_history.length`

**Note:**
Full prompt text is owned and stored server-side only (e.g., from config files or environment). The client must never be required to send full prompt text back to the server.

---

### Trigger Conditions

A benchmark run is persisted when:

* the run ends naturally (termination cue detected), OR
* the user clicks **End Run** in the benchmark UI

---

## Feature 2 — Results Viewer UI

### Objective

Allow users to view saved benchmark runs.

### UI Changes

#### BenchmarkPanel.jsx

Add a new button:

* Label: **View Results**
* Placement: near existing benchmark control buttons
* Behavior: navigate to `/results`

#### `/results` Page

Create a new page component (e.g., `client/pages/results.jsx`).

The page must:

* fetch all saved runs from the server
* render a list/table showing:

  * `run_id`
  * `created_at`
  * `num_turns`
* be read-only (clicking a row does nothing in this iteration)

**Important constraint:**
This page must only display **metadata**. It must not request or display transcripts, prompts, or raw event payloads.

---

## Server Implementation Requirements (Express + SQLite)

### Database

Use SQLite (file-backed) so results persist across restarts.

Suggested path:

```
server/data/benchmarks.sqlite
```

### Schema (Minimum Viable)

Single-table schema storing JSON blobs is acceptable.

Table: `benchmark_runs`

* `run_id` TEXT PRIMARY KEY
* `created_at` TEXT NOT NULL
* `mode` TEXT NOT NULL
* `num_turns` INTEGER NOT NULL
* `interviewer_prompt_id` TEXT NOT NULL
* `simulated_user_prompt_id` TEXT NOT NULL
* `conversation_history_json` TEXT NOT NULL
* `event_log_json` TEXT NOT NULL

---

## Server API Endpoints

All endpoints must be implemented in `server.js` and treated as **internal / dev-only APIs** (e.g., enabled only when a benchmark flag is set or bound to localhost).

### 1) Create Run ID (Recommended)

`POST /api/benchmark-runs`

Response:

```json
{
  "run_id": "uuid",
  "created_at": "ISO timestamp"
}
```

The server generates the `run_id` so it is authoritative.

---

### 2) Save / Complete Run (Required)

`PUT /api/benchmark-runs/:run_id`

Request body:

```json
{
  "mode": "benchmark",
  "conversation_history": [...],
  "event_log": [...],
  "interviewer_prompt_id": "...",
  "simulated_user_prompt_id": "..."
}
```

Server responsibilities:

* validate required fields
* compute `num_turns`
* write record to DB
* store raw artifacts server-side only

Response:

```json
{ "ok": true }
```

---

### 3) List Runs (Required)

`GET /api/benchmark-runs`

Response:

```json
[
  {
    "run_id": "uuid",
    "created_at": "ISO timestamp",
    "num_turns": 12
  }
]
```

**Constraint:**
This endpoint must return **metadata only**. No transcripts, prompts, or raw event payloads.

---

## Client Integration Requirements

### BenchmarkingService.js

Refactor persistence behavior so the server is authoritative.

#### On Start Run

* call `POST /api/benchmark-runs`
* store returned `run_id` in memory for the active run

#### On End Run or Termination Cue

* assemble payload:

  * `conversation_history`
  * `event_log`
  * `interviewer_prompt_id`
  * `simulated_user_prompt_id`
  * `mode: "benchmark"`
* call `PUT /api/benchmark-runs/:run_id`

**Prompt handling rule:**
If the interviewer prompt is defined in `server.js`, the server must associate the correct `interviewer_prompt_id` internally. The client must not reconstruct or resend the full prompt text.

localStorage may remain temporarily for live-run buffering, but it must not be used as the persistence source for the Results page.

---

## Routing

Add routing for `/results` following the project’s existing routing pattern (`client/pages/index.jsx` and SSR entries). Do not introduce a new routing framework.

---

## Acceptance Criteria

* Ending a benchmark run creates a persistent SQLite DB record on the server
* Saved runs persist across browser reloads and server restarts
* BenchmarkPanel includes a **View Results** button
* `/results` lists all runs with `run_id`, `created_at`, and `num_turns`
* No raw prompts, transcripts, or event payloads are exposed to the browser outside of the live benchmark session
* Existing benchmark execution behavior (live transcript and event log during a run) remains intact

---

## Implementation Checklist

### Server

* [ ] Add SQLite dependency
* [ ] Initialize DB on startup
* [ ] Create `benchmark_runs` table if missing
* [ ] Implement:

  * [ ] `POST /api/benchmark-runs`
  * [ ] `PUT /api/benchmark-runs/:run_id`
  * [ ] `GET /api/benchmark-runs`
* [ ] Ensure endpoints are gated to benchmark/dev usage

### Client

* [ ] Add **View Results** button to `BenchmarkPanel.jsx`
* [ ] Add `/results` page
* [ ] Update `BenchmarkingService.js` to persist runs via server APIs
* [ ] Ensure Results page fetches only metadata from server

