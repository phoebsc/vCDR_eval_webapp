# New Feature Specification: Benchmark Persistence + Results Viewer

## Context

This project is an automated benchmarking harness built on top of the OpenAI Realtime Console. It supports AI-to-AI conversations between:
- an interviewer voice bot, and
- a simulated text-based user.

Benchmarking is currently initiated via the `BenchmarkPanel` and orchestrated by `BenchmarkingService`, with transient transcript state and limited persistence.

This feature introduces:
1. **Full benchmark run persistence to a database**
2. **A results viewer UI reachable from the benchmarking interface**

---

## Feature 1: Persistent Benchmark Run Storage

### Objective
Persist all relevant data from a benchmark run so it can be inspected later outside the live session.

### Data to Persist (per benchmark run)

Each benchmark run MUST be saved as a single database record with:

- `run_id` (string, UUID v4 or equivalent)
- `created_at` (ISO timestamp)
- `mode` (string, always `"benchmark"`)
- `conversation_history`
  - ordered list of turns
  - each turn includes:
    - `speaker` (`"interviewer"` | `"simulated_user"`)
    - `content` (string)
    - `timestamp` (ISO timestamp)
- `event_log`
  - ordered list of system / OpenAI events
  - raw event payloads preserved
- `interviewer_prompt`
  - full system prompt used by the interviewer agent
- `simulated_user_prompt`
  - full system prompt or configuration used by the simulated user agent
- `num_turns`
  - integer, derived from `conversation_history.length`

### Trigger Conditions

- A benchmark run is persisted when:
  - the run ends naturally (termination cue detected), OR
  - the user explicitly clicks **End Run**

### Non-Goals (for this iteration)

- No editing or deletion of runs
- No analytics or scoring
- No filtering or search

---

## Feature 2: “View Results” UI

### Objective
Allow users to inspect previously saved benchmark runs in a separate interface.

### UI Changes

#### BenchmarkPanel

- Add a new button:
  - Label: **View Results**
  - Placement: Adjacent to the existing benchmarking controls
  - Behavior: Navigates to a new route/page

### New Route / Page

#### `/results` (or equivalent)

A new page that displays persisted benchmark runs.

### Results Page Requirements

- Fetch all benchmark run records from the database
- Display a list view where:
  - each entry corresponds to one benchmark run
  - each entry shows:
    - `run_id`
    - `created_at`
    - `num_turns`

Example (conceptual):

Run ID: 8f2a…
Created: 2026-01-19 14:03
Turns: 12

### Interaction Model (Initial)

- Read-only
- No pagination required initially
- Clicking an entry is NOT required to do anything yet

---

## Architecture Constraints

- Must integrate cleanly with:
  - `BenchmarkingService` (data capture)
  - `BenchmarkPanel` (UI control)
- Persistence layer may be:
  - local database
  - file-backed store
  - server-managed database
- Exact storage technology is left to the implementing agent

---

## Acceptance Criteria

- Running a benchmark produces a persistent database entry
- Reloading the app does not erase saved benchmark runs
- “View Results” button navigates to a new page
- Results page lists all runs with unique IDs and turn counts
- No regression to existing benchmark behavior

---

## Future Extensions (Explicitly Deferred)

- Per-run detail view
- Transcript playback
- CSV / JSON export
- Search, filtering, or tagging
- Metrics, scoring, or evaluation

