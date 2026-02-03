import { useState, useEffect } from "react";
import { Play, Square, RotateCcw, Settings, FileText } from "react-feather";
import Button from "./Button";

function TranscriptView({ transcript }) {
  if (!transcript || transcript.length === 0) {
    return (
      <div className="text-gray-500 text-sm">
        Transcript will appear here during the benchmark run...
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-60 overflow-y-auto">
      {transcript.map((entry) => (
        <div key={entry.id} className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded ${
              entry.role === 'interviewer'
                ? 'bg-green-100 text-green-800'
                : 'bg-blue-100 text-blue-800'
            }`}>
              {entry.role === 'interviewer' ? 'Voice Bot' : 'Simulated User'}
            </span>
            <span className="text-xs text-gray-500">
              {new Date(entry.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <div className="text-sm bg-gray-50 p-2 rounded border-l-2 border-gray-300">
            {entry.message}
          </div>
        </div>
      ))}
    </div>
  );
}

function LogView({ log }) {
  if (!log || log.length === 0) {
    return (
      <div className="text-gray-500 text-sm">
        Event log will appear here during the benchmark run...
      </div>
    );
  }

  const recentLogs = log.slice(-20); // Show last 20 entries

  return (
    <div className="space-y-1 max-h-40 overflow-y-auto text-xs">
      {recentLogs.map((entry) => (
        <div key={entry.id} className="flex flex-col gap-1 p-1 bg-gray-50 rounded">
          <div className="flex items-center gap-2">
            <span className={`px-1 py-0.5 rounded text-xs ${
              entry.source === 'system' ? 'bg-gray-200 text-gray-800' :
              entry.source === 'simulated_user' ? 'bg-blue-200 text-blue-800' :
              'bg-green-200 text-green-800'
            }`}>
              {entry.source}
            </span>
            <span className="text-gray-500">
              {new Date(entry.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <div className="text-gray-700">
            {entry.action}
          </div>
        </div>
      ))}
    </div>
  );
}

function SimulatedUserPromptView({ prompt }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-blue-50 p-3 rounded-md">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h4 className="font-semibold text-blue-800">Simulated User Prompt</h4>
        <span className="text-blue-600 text-sm">
          {isExpanded ? 'Hide' : 'Show'}
        </span>
      </div>

      {isExpanded && (
        <div className="mt-2 p-2 bg-white rounded text-sm border border-blue-200">
          <pre className="whitespace-pre-wrap text-gray-700">{prompt}</pre>
        </div>
      )}
    </div>
  );
}

export default function BenchmarkPanel({
  isSessionActive,
  isBenchmarkActive,
  benchmarkTranscript,
  benchmarkLog,
  simulatedUserPrompt,
  selectedInterviewerPrompt,
  selectedUserPrompt,
  onInterviewerPromptChange,
  onUserPromptChange,
  onStartBenchmark,
  onEndBenchmark,
  onResetBenchmark,
  onToggleMode
}) {
  const [activeTab, setActiveTab] = useState('transcript');
  const [availablePrompts, setAvailablePrompts] = useState([]);
  const [promptsLoading, setPromptsLoading] = useState(true);

  // Load available prompts on component mount
  useEffect(() => {
    fetchAvailablePrompts();
  }, []);

  const fetchAvailablePrompts = async () => {
    try {
      setPromptsLoading(true);
      const response = await fetch('/api/prompts');
      if (response.ok) {
        const prompts = await response.json();
        setAvailablePrompts(prompts);
      }
    } catch (error) {
      console.error('Failed to load available prompts:', error);
    } finally {
      setPromptsLoading(false);
    }
  };

  const handleStartBenchmark = () => {
    // Pass selected prompts to the parent component
    onStartBenchmark(selectedInterviewerPrompt, selectedUserPrompt);
  };

  return (
    <section className="h-full w-full flex flex-col gap-4">
      {/* Header with mode toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Benchmark Mode</h2>
        <Button
          onClick={onToggleMode}
          icon={<Settings height={16} />}
          className="bg-gray-600 text-xs"
        >
          Normal Mode
        </Button>
      </div>

      {/* Prompt Selection */}
      <div className="bg-gray-50 rounded-md p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Prompt Selection</h3>

        {/* Interviewer Prompt */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">
            Voice Bot (Interviewer)
          </label>
          <select
            value={selectedInterviewerPrompt}
            onChange={(e) => onInterviewerPromptChange(e.target.value)}
            disabled={isBenchmarkActive || promptsLoading}
            className="w-full text-sm border border-gray-300 rounded px-3 py-2 bg-white disabled:bg-gray-100"
          >
            {promptsLoading ? (
              <option>Loading prompts...</option>
            ) : (
              availablePrompts.map((prompt) => (
                <option key={prompt.name} value={prompt.name}>
                  {prompt.filename}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Simulated User Prompt */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">
            Simulated User
          </label>
          <select
            value={selectedUserPrompt}
            onChange={(e) => onUserPromptChange(e.target.value)}
            disabled={isBenchmarkActive || promptsLoading}
            className="w-full text-sm border border-gray-300 rounded px-3 py-2 bg-white disabled:bg-gray-100"
          >
            {promptsLoading ? (
              <option>Loading prompts...</option>
            ) : (
              availablePrompts.map((prompt) => (
                <option key={prompt.name} value={prompt.name}>
                  {prompt.filename}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={handleStartBenchmark}
          disabled={!isSessionActive || isBenchmarkActive}
          icon={<Play height={16} />}
          className={`flex-1 ${
            !isSessionActive || isBenchmarkActive
              ? 'bg-gray-400'
              : 'bg-green-600'
          }`}
        >
          {isBenchmarkActive ? 'Running...' : 'Start Run'}
        </Button>

        <Button
          onClick={onEndBenchmark}
          disabled={!isBenchmarkActive}
          icon={<Square height={16} />}
          className={`flex-1 ${
            !isBenchmarkActive ? 'bg-gray-400' : 'bg-red-600'
          }`}
        >
          End Run
        </Button>

        <Button
          onClick={onResetBenchmark}
          icon={<RotateCcw height={16} />}
          className="bg-orange-600"
        >
          Reset
        </Button>
      </div>

      {/* View Results Button */}
      <div className="flex">
        <Button
          onClick={() => window.location.href = '/results'}
          icon={<FileText height={16} />}
          className="bg-blue-600 w-full"
        >
          View Results
        </Button>
      </div>

      {/* Status Indicator */}
      <div className="flex items-center gap-2 p-2 rounded bg-gray-50">
        <div className={`w-3 h-3 rounded-full ${
          isBenchmarkActive ? 'bg-green-500' :
          isSessionActive ? 'bg-yellow-500' : 'bg-red-500'
        }`} />
        <span className="text-sm">
          {isBenchmarkActive ? 'Benchmark Running' :
           isSessionActive ? 'Session Active - Ready to Benchmark' : 'Start Session First'}
        </span>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('transcript')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'transcript'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Transcript
        </button>
        <button
          onClick={() => setActiveTab('log')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'log'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Event Log
        </button>
        <button
          onClick={() => setActiveTab('prompt')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'prompt'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          User Prompt
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'transcript' && (
          <div>
            <h3 className="font-semibold mb-2">Real-time Transcript</h3>
            <TranscriptView transcript={benchmarkTranscript} />
          </div>
        )}

        {activeTab === 'log' && (
          <div>
            <h3 className="font-semibold mb-2">Event Log</h3>
            <LogView log={benchmarkLog} />
          </div>
        )}

        {activeTab === 'prompt' && (
          <SimulatedUserPromptView prompt={simulatedUserPrompt} />
        )}
      </div>

      {/* Instructions */}
      {!isSessionActive && (
        <div className="text-sm text-gray-600 bg-yellow-50 p-3 rounded border border-yellow-200">
          <strong>Instructions:</strong>
          <ol className="mt-1 ml-4 list-decimal">
            <li>Start a session first</li>
            <li>Click "Start Run" to begin automated benchmark</li>
            <li>Watch the transcript and logs in real-time</li>
            <li>The run will end automatically when the voice bot says "This is the end of this part"</li>
          </ol>
        </div>
      )}
    </section>
  );
}