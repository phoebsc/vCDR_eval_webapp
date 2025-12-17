# OpenAI Realtime Console - Benchmarking System Architecture

## Overview

This project has been transformed from a basic OpenAI Realtime API console into an automated benchmarking harness for voice bot evaluation. The system enables automated AI-to-AI conversations between a voice bot interviewer and a simulated text-based user.

## Project Structure

```
openai-realtime-console/
├── server.js                           # Express server with OpenAI Realtime API integration
├── package.json                        # Project dependencies and scripts
├── nodemon.json                        # Development server configuration
├── vite.config.js                      # Vite build configuration
├── tailwind.config.js                  # TailwindCSS styling configuration
├── client/                             # React frontend application
│   ├── index.html                      # HTML template
│   ├── index.js                        # Client entry point
│   ├── entry-client.jsx               # Client-side rendering entry
│   ├── entry-server.jsx               # Server-side rendering entry
│   ├── components/                     # React components
│   │   ├── App.jsx                     # Main application component
│   │   ├── SessionControls.jsx         # Session start/stop and text input controls
│   │   ├── EventLog.jsx                # Real-time event display
│   │   ├── ToolPanel.jsx               # Original tool demo (color palette)
│   │   ├── BenchmarkPanel.jsx          # NEW: Benchmarking UI with tabs
│   │   └── Button.jsx                  # Reusable button component
│   ├── lib/                            # Business logic modules
│   │   ├── BenchmarkingService.js      # NEW: Core benchmarking orchestration
│   │   └── SimulatedUser.js            # NEW: Automated user response generation
│   └── pages/
│       └── index.jsx                   # Main page component
└── assets/                             # Static assets
    └── openai-logomark.svg             # OpenAI logo
```

## Core Components Detailed

### Backend (Server-side)

#### `server.js`
- **Purpose**: Express server that handles OpenAI Realtime API communication
- **Key Features**:
  - Voice bot configuration with structured interview prompts
  - WebRTC session management via `/token` endpoint
  - Server-side rendering with Vite
- **Benchmarking Changes**:
  - Added interviewer system prompt with 5 structured questions
  - Configured for audio output with text input support
  - Termination cue: "This is the end of this part"

### Frontend (Client-side)

#### Core Application

##### `App.jsx`
- **Purpose**: Main application state management and WebRTC connection handling
- **Key Features**:
  - Session lifecycle management (start/stop)
  - Real-time event processing from OpenAI API
  - Mode switching between normal and benchmark modes
- **Benchmarking Integration**:
  - Disables microphone input during benchmark mode
  - Integrates BenchmarkingService for automated conversations
  - Manages benchmark transcript and event log state
  - Conditional UI rendering based on mode

##### `SessionControls.jsx`
- **Purpose**: User interface for session management and text input
- **Features**:
  - Start/stop session buttons
  - Text message input and sending
  - Session status display
- **Usage**: Used in normal mode for human interaction

#### Benchmarking System

##### `BenchmarkPanel.jsx` (NEW)
- **Purpose**: Complete UI for automated benchmarking
- **Features**:
  - **Control Buttons**: Start Run, End Run, Reset
  - **Status Indicator**: Visual feedback on system state
  - **Tabbed Interface**:
    - **Transcript Tab**: Real-time conversation display
    - **Event Log Tab**: System events and debugging info
    - **User Prompt Tab**: Simulated user configuration
  - **Mode Toggle**: Switch between benchmark and normal modes

##### `BenchmarkingService.js` (NEW)
- **Purpose**: Core orchestration engine for automated conversations
- **Key Responsibilities**:
  - **Conversation Management**: Start/stop automated runs
  - **Event Processing**: Parse OpenAI Realtime API events
  - **Transcript Capture**: Extract text from audio and text events
  - **Turn Detection**: Determine when simulated user should respond
  - **Data Persistence**: Save benchmark runs to localStorage
- **Event Types Handled**:
  - `response.audio_transcript.done` - Voice bot speech
  - `response.output_item.done` - Structured responses
  - `conversation.item.created` - User text input
  - `response.done` - Complete response cycles

##### `SimulatedUser.js` (NEW)
- **Purpose**: Automated user agent that responds to interview questions
- **Features**:
  - **Predefined Responses**: 3 variants per interview question
  - **Behavioral Variation**: 20% off-topic responses for robustness testing
  - **Response Detection**: Analyzes events to determine when to respond
  - **Turn Management**: Tracks conversation progress through question sequence
- **Response Categories**:
  - Expected professional answers
  - Off-topic tangential responses
  - Brief/evasive responses

#### Supporting Components

##### `EventLog.jsx`
- **Purpose**: Real-time display of OpenAI Realtime API events
- **Features**: Expandable event viewer with client/server distinction
- **Usage**: Debugging and monitoring API interactions

##### `ToolPanel.jsx`
- **Purpose**: Original demonstration tool (color palette generator)
- **Benchmarking Changes**: Added mode toggle button to switch to benchmark mode

## Data Flow Architecture

### Normal Mode Flow
```
User Input → SessionControls → App → WebRTC → OpenAI API → Audio Output
                               ↓
                         EventLog ← Real-time Events
```

### Benchmark Mode Flow
```
BenchmarkPanel → BenchmarkingService → SimulatedUser → Text Messages
     ↓                    ↓                               ↓
Transcript Display ← Event Processing ← OpenAI API ← WebRTC Connection
     ↓                    ↓
Event Log Display ← System Logging
```

## Key Technologies

- **Frontend**: React 18, Vite, TailwindCSS
- **Backend**: Express.js, Node.js
- **Real-time Communication**: WebRTC, OpenAI Realtime API
- **State Management**: React useState/useRef hooks
- **Persistence**: localStorage for benchmark run storage

## Configuration

### Voice Bot Interview Questions (server.js)
1. "Please tell me about yourself and your background"
2. "What interests you most about this field?"
3. "Describe a challenging project you've worked on"
4. "Where do you see yourself in 5 years?"
5. "Do you have any questions for me?"

### Simulated User Personas (SimulatedUser.js)
- Professional software engineer with 3 years experience
- Startup background in web applications
- Interest in AI/ML and full-stack development
- Occasionally provides off-topic responses for testing

## Development Scripts

```json
{
  "dev": "node server.js --dev",     // Development with hot reload
  "start": "node server.js",         // Production server
  "build": "npm run build:client && npm run build:server"
}
```

## Environment Requirements

- Node.js (ES modules support)
- OpenAI API key (set in .env as OPENAI_API_KEY)
- Modern browser with WebRTC support

## Future Enhancement Areas

1. **Multiple Interview Scenarios**: Easy to swap different question sets
2. **Advanced Analytics**: Conversation quality metrics
3. **Response Variations**: Dynamic simulated user personalities
4. **Export Capabilities**: CSV/JSON transcript export
5. **Real-time Monitoring**: Enhanced debugging interfaces

## Debugging Features

- Comprehensive console logging with prefixed tags:
  - `[BenchmarkingService]` - Core orchestration logs
  - `[SimulatedUser]` - Response detection and generation
  - `[App]` - Session management and mode switching
- Real-time event log display
- Transcript duplicate detection and prevention
- Turn-taking timing analysis

This architecture enables fully automated voice bot evaluation with minimal human intervention while maintaining the flexibility to switch back to manual testing mode.