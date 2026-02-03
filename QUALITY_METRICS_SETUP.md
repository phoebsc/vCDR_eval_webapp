# Quality Metrics Integration Setup

This document explains how to set up and use the quality metrics feature that integrates with the vCDR repository.

## Overview

The quality metrics feature uses a git submodule to integrate the Brain Health Registry's vCDR quality assessment scripts without duplicating code. This allows you to:

- Compute quality metrics for benchmark runs
- Analyze conversation flow, participant engagement, and overall quality
- View detailed metrics in the UI
- Keep metrics scripts synchronized with the external repository

## Setup Instructions

### 1. Initialize Git Submodules

When cloning this repository or setting up locally, initialize the git submodule:

```bash
# Initialize and update submodules
git submodule init
git submodule update

# Or clone with submodules in one step
git clone --recurse-submodules https://github.com/your-repo/openai-realtime-console
```

### 2. Update Submodules (Regular Maintenance)

To update the vCDR submodule to the latest version:

```bash
cd external/vCDR
git pull origin main
cd ../..
git add external/vCDR
git commit -m "Update vCDR submodule to latest version"
```

### 3. Python Environment Setup (Future)

When integrating with the full vCDR Python scoring system, you'll need to set up the Python environment:

```bash
cd external/vCDR
# Follow the setup instructions in the vCDR repository
# This typically involves:
# - Installing Python dependencies
# - Setting up environment variables
# - Configuring API keys if needed
```

## Architecture

### Database Schema
The `benchmark_runs` table has been extended with:
- `interviewer_prompt_name`: Name of the interviewer prompt file
- `simulated_user_prompt_name`: Name of the simulated user prompt file
- `quality_metrics_json`: JSON blob storing computed quality metrics

### API Endpoints
- `POST /api/benchmark-runs/:id/metrics` - Compute quality metrics for a run
- `GET /api/benchmark-runs/:id/metrics` - Retrieve quality metrics for a run

### Quality Metrics Structure
```json
{
  "computed_at": "2024-02-03T13:30:00.000Z",
  "version": "1.0.0",
  "source": "simplified_analysis",
  "metrics": {
    "conversation_flow": {
      "total_turns": 20,
      "interviewer_turns": 10,
      "participant_turns": 10,
      "turn_ratio": 1.0,
      "duration_minutes": 15.5
    },
    "participant_engagement": {
      "avg_response_length": 125,
      "response_rate": 0.95,
      "engagement_score": 85
    },
    "conversation_quality": {
      "completeness_score": 90,
      "flow_score": 85,
      "naturalness_score": 78
    }
  },
  "details": {
    "questions_analyzed": 3,
    "off_script_interactions": 0,
    "technical_issues": 0
  }
}
```

## Usage

### 1. Run a Benchmark
Complete a benchmark run as usual using the main application interface.

### 2. Compute Quality Metrics
Navigate to the run details page and:
1. Click on the "Quality Metrics" tab
2. Click "Compute Quality Metrics" button
3. Wait for the analysis to complete
4. View the detailed metrics dashboard

### 3. Recompute Metrics
If you've updated the vCDR submodule or want to regenerate metrics:
1. Go to the "Quality Metrics" tab
2. Click the "Recompute" button

## Implementation Status

### ✅ Completed
- Git submodule integration with vCDR repository
- Database schema extensions for quality metrics storage
- API endpoints for computing and retrieving metrics
- UI components for displaying quality metrics
- Simplified metrics computation (conversation analysis)

### 🚧 In Progress / Future Enhancements
- Full vCDR Python script integration
- Advanced LLM-based quality scoring
- Custom quality assessment parameters
- Bulk metrics computation for multiple runs
- Export quality metrics to CSV/JSON

## Troubleshooting

### Submodule Not Initialized
If the `external/vCDR` directory is empty:
```bash
git submodule update --init --recursive
```

### Python Environment Issues
Future Python integration may require:
- Python 3.8+ with required packages
- OpenAI API key configuration
- Virtual environment setup

### Database Migration Issues
If you encounter database errors, the schema migration should happen automatically. If not:
```bash
# Manually add the new columns
sqlite3 server/data/benchmarks.sqlite "ALTER TABLE benchmark_runs ADD COLUMN quality_metrics_json TEXT;"
```

## Development Notes

### File Structure
```
external/
└── vCDR/                           # Git submodule
    └── src/voz_vcdr/
        └── extract_responses.py    # Main quality assessment script

server/
├── lib/
│   ├── database.js                 # Extended with quality metrics functions
│   └── metricsService.js           # Quality metrics computation service
└── server.js                       # API endpoints for metrics

client/pages/
└── RunDetailPage.jsx               # Extended with Quality Metrics tab
```

### Adding Custom Metrics
To add new quality metrics:
1. Update the `generateSimplifiedMetrics()` function in `metricsService.js`
2. Add corresponding UI components in `RunDetailPage.jsx`
3. Update the database schema if needed

## Future Integration with vCDR

The current implementation uses simplified metrics computation. To integrate with the full vCDR scoring system:

1. Set up Python environment in the vCDR submodule
2. Update `callVCDRScoring()` function in `metricsService.js`
3. Map conversation data to vCDR input format
4. Process vCDR output and store results
5. Update UI to display full vCDR metrics

This approach ensures clean separation between repositories while providing full access to the vCDR quality assessment capabilities.