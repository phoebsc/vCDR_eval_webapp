import { useState, useEffect } from 'react';
import { ArrowLeft, FileText, Clock, Hash, User, Cpu, Activity, Copy, Check, BarChart, RefreshCw } from 'react-feather';
import Button from '../components/Button';

export default function RunDetailPage({ runId }) {
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('transcript');
  const [copied, setCopied] = useState(false);
  const [prompts, setPrompts] = useState({ interviewer: null, user: null });
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [qualityMetrics, setQualityMetrics] = useState(null);
  const [metricsComputing, setMetricsComputing] = useState(false);

  useEffect(() => {
    if (runId) {
      fetchRunDetails();
    }
  }, [runId]);

  // Fetch prompt content when run data is available
  useEffect(() => {
    if (run && run.interviewer_prompt_name && run.simulated_user_prompt_name) {
      fetchPromptContent();
    }
  }, [run]);

  // Set quality metrics from run data if available (no automatic fetching)
  useEffect(() => {
    if (run && run.run_id) {
      if (run.quality_metrics) {
        setQualityMetrics(run.quality_metrics);
      }
      // Note: We do NOT automatically fetch/compute metrics - only when user clicks button
    }
  }, [run]);

  const fetchRunDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/benchmark-runs/${runId}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Run not found: ${runId}`);
        }
        throw new Error(`Failed to fetch run details: ${response.status} ${response.statusText}`);
      }

      const runData = await response.json();
      setRun(runData);
    } catch (err) {
      console.error('Error fetching run details:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPromptContent = async () => {
    try {
      setPromptsLoading(true);

      const [interviewerResponse, userResponse] = await Promise.all([
        fetch(`/api/prompts/${run.interviewer_prompt_name}`),
        fetch(`/api/prompts/${run.simulated_user_prompt_name}`)
      ]);

      let interviewerPrompt = null, userPrompt = null;

      if (interviewerResponse.ok) {
        interviewerPrompt = await interviewerResponse.json();
      }

      if (userResponse.ok) {
        userPrompt = await userResponse.json();
      }

      setPrompts({
        interviewer: interviewerPrompt,
        user: userPrompt
      });
    } catch (err) {
      console.error('Error fetching prompt content:', err);
    } finally {
      setPromptsLoading(false);
    }
  };

  // Note: fetchQualityMetrics removed - we only load metrics from run data or compute on demand

  const computeQualityMetrics = async () => {
    try {
      console.log(`[CLIENT] 🔄 Recompute button clicked for run: ${run.run_id}`);
      console.log(`[CLIENT] 📅 Client timestamp: ${new Date().toISOString()}`);
      setMetricsComputing(true);

      const apiUrl = `/api/benchmark-runs/${run.run_id}/metrics`;
      console.log(`[CLIENT] 🌐 Making POST request to: ${apiUrl}`);

      const response = await fetch(apiUrl, {
        method: 'POST'
      });

      console.log(`[CLIENT] 📊 Response status: ${response.status}`);

      if (response.ok) {
        const data = await response.json();
        console.log(`[CLIENT] ✅ Received metrics data - source: ${data.metrics?.source}`);
        console.log(`[CLIENT] 📋 Full response:`, data);
        setQualityMetrics(data.metrics);
      } else {
        const errorData = await response.json();
        console.error('Error computing quality metrics:', errorData.error);
        alert(`Failed to compute quality metrics: ${errorData.error}`);
      }
    } catch (err) {
      console.error('Error computing quality metrics:', err);
      alert('Failed to compute quality metrics');
    } finally {
      setMetricsComputing(false);
    }
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch (err) {
      return dateString;
    }
  };

  const formatTime = (dateString) => {
    try {
      return new Date(dateString).toLocaleTimeString();
    } catch (err) {
      return dateString;
    }
  };

  const handleBackToResults = () => {
    window.location.href = '/results';
  };

  const copyTranscriptToClipboard = async () => {
    if (!run || !run.conversation_history) return;

    // Format transcript as "AGENT: xxx\nPARTICIPANT: xxx\n..."
    const formattedTranscript = run.conversation_history
      .map(entry => {
        const speaker = entry.speaker === 'interviewer' ? 'AGENT' : 'PARTICIPANT';
        return `${speaker}: ${entry.content}`;
      })
      .join('\n');

    try {
      await navigator.clipboard.writeText(formattedTranscript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
    } catch (error) {
      console.error('Failed to copy transcript:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = formattedTranscript;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackError) {
        console.error('Fallback copy failed:', fallbackError);
      }
      document.body.removeChild(textArea);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading run details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="text-red-800 font-medium">Error loading run details</div>
              <div className="text-red-600 text-sm mt-1">{error}</div>
              <div className="flex gap-2 mt-3">
                <Button onClick={fetchRunDetails} className="bg-red-600 text-sm">
                  Retry
                </Button>
                <Button onClick={handleBackToResults} className="bg-gray-600 text-sm">
                  Back to Results
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="text-center">
            <div className="text-gray-500">No run data found</div>
            <Button onClick={handleBackToResults} className="bg-gray-600 mt-4">
              Back to Results
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <FileText className="text-blue-600" size={32} />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Run Details</h1>
              <div className="text-sm text-gray-600 mt-1">
                Run ID: <span className="font-mono">{run.run_id}</span>
              </div>
            </div>
          </div>

          <Button
            onClick={handleBackToResults}
            icon={<ArrowLeft height={16} />}
            className="bg-gray-600"
          >
            Back to Results
          </Button>
        </div>

        {/* Run Metadata */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Run Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <Clock className="text-gray-400" size={16} />
              <div>
                <div className="text-sm text-gray-500">Created</div>
                <div className="font-medium">{formatDate(run.created_at)}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="text-gray-400" size={16} />
              <div>
                <div className="text-sm text-gray-500">Turns</div>
                <div className="font-medium">{run.num_turns}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Hash className="text-gray-400" size={16} />
              <div>
                <div className="text-sm text-gray-500">Mode</div>
                <div className="font-medium capitalize">{run.mode}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="border-b">
            <div className="flex">
              <button
                onClick={() => setActiveTab('transcript')}
                className={`px-6 py-3 font-medium text-sm border-b-2 ${
                  activeTab === 'transcript'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <User size={16} />
                  Transcript ({run.conversation_history?.length || 0})
                </div>
              </button>
              <button
                onClick={() => setActiveTab('events')}
                className={`px-6 py-3 font-medium text-sm border-b-2 ${
                  activeTab === 'events'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Activity size={16} />
                  Events ({run.event_log?.length || 0})
                </div>
              </button>
              <button
                onClick={() => setActiveTab('prompts')}
                className={`px-6 py-3 font-medium text-sm border-b-2 ${
                  activeTab === 'prompts'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText size={16} />
                  Prompts
                </div>
              </button>
              <button
                onClick={() => setActiveTab('metrics')}
                className={`px-6 py-3 font-medium text-sm border-b-2 ${
                  activeTab === 'metrics'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <BarChart size={16} />
                  Quality Metrics
                  {qualityMetrics && (
                    <span className="bg-green-100 text-green-800 text-xs px-1.5 py-0.5 rounded">✓</span>
                  )}
                </div>
              </button>
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'transcript' && (
              <div>
                {/* Copy Transcript Button */}
                {run.conversation_history && run.conversation_history.length > 0 && (
                  <div className="mb-4 flex justify-end">
                    <Button
                      onClick={copyTranscriptToClipboard}
                      icon={copied ? <Check height={16} /> : <Copy height={16} />}
                      className={`text-sm ${copied ? 'bg-green-600' : 'bg-blue-600'}`}
                    >
                      {copied ? 'Copied!' : 'Copy Transcript'}
                    </Button>
                  </div>
                )}

                {/* Scrollable Transcript Container */}
                <div className="max-h-96 overflow-y-auto space-y-4 pr-2">
                  {run.conversation_history && run.conversation_history.length > 0 ? (
                    run.conversation_history.map((entry, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          {entry.speaker === 'interviewer' ? (
                            <Cpu className="text-green-600" size={16} />
                          ) : (
                            <User className="text-blue-600" size={16} />
                          )}
                          <span className={`text-xs px-2 py-1 rounded font-medium ${
                            entry.speaker === 'interviewer'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {entry.speaker === 'interviewer' ? 'Voice Bot' : 'Simulated User'}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatTime(entry.timestamp)}
                        </span>
                      </div>
                      <div className="bg-gray-50 p-3 rounded border-l-4 border-l-gray-300">
                        <p className="text-gray-800">{entry.content}</p>
                      </div>
                    </div>
                  ))
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      No transcript data available
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'events' && (
              <div className="space-y-2">
                {run.event_log && run.event_log.length > 0 ? (
                  run.event_log.map((entry, index) => (
                    <div key={index} className="border rounded p-3 text-sm">
                      <div className="flex items-center gap-3 mb-1">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          entry.source === 'system' ? 'bg-gray-200 text-gray-800' :
                          entry.source === 'simulated_user' ? 'bg-blue-200 text-blue-800' :
                          'bg-green-200 text-green-800'
                        }`}>
                          {entry.source}
                        </span>
                        <span className="text-gray-500 text-xs">
                          {formatTime(entry.timestamp)}
                        </span>
                      </div>
                      <div className="text-gray-800 font-medium">{entry.action}</div>
                      {entry.data && Object.keys(entry.data).length > 0 && (
                        <div className="mt-2 bg-gray-50 p-2 rounded text-xs">
                          <pre className="text-gray-600 whitespace-pre-wrap">
                            {JSON.stringify(entry.data, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    No event data available
                  </div>
                )}
              </div>
            )}

            {activeTab === 'prompts' && (
              <div className="space-y-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Cpu className="text-green-600" size={16} />
                    <h3 className="font-semibold text-green-800">Voice Bot (Interviewer)</h3>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                      {run.interviewer_prompt_name || 'interviewer'}.txt
                    </span>
                  </div>
                  <div className="bg-white border border-green-200 rounded p-3 text-sm max-h-48 overflow-y-auto">
                    <p className="text-gray-600 italic mb-2">
                      Prompt ID: {run.interviewer_prompt_id}
                    </p>
                    <div className="text-gray-700">
                      {promptsLoading ? (
                        <div className="text-gray-500">Loading prompt content...</div>
                      ) : prompts.interviewer ? (
                        <pre className="whitespace-pre-wrap text-sm">{prompts.interviewer.prompt}</pre>
                      ) : (
                        <div className="text-red-500">Failed to load prompt content</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <User className="text-blue-600" size={16} />
                    <h3 className="font-semibold text-blue-800">Simulated User</h3>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      {run.simulated_user_prompt_name || 'candidate'}.txt
                    </span>
                  </div>
                  <div className="bg-white border border-blue-200 rounded p-3 text-sm max-h-48 overflow-y-auto">
                    <p className="text-gray-600 italic mb-2">
                      Prompt ID: {run.simulated_user_prompt_id}
                    </p>
                    <div className="text-gray-700">
                      {promptsLoading ? (
                        <div className="text-gray-500">Loading prompt content...</div>
                      ) : prompts.user ? (
                        <pre className="whitespace-pre-wrap text-sm">{prompts.user.prompt}</pre>
                      ) : (
                        <div className="text-red-500">Failed to load prompt content</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'metrics' && (
              <div className="space-y-6 max-h-[calc(100vh-24rem)] overflow-y-auto pr-2">
                {/* Metrics Header */}
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Quality Metrics Analysis</h3>
                  <div className="flex gap-2">
                    {qualityMetrics && (
                      <Button
                        onClick={computeQualityMetrics}
                        icon={<RefreshCw height={16} />}
                        className="bg-blue-600 text-sm"
                        disabled={metricsComputing}
                      >
                        {metricsComputing ? 'Recomputing...' : 'Recompute'}
                      </Button>
                    )}
                    {!qualityMetrics && (
                      <Button
                        onClick={computeQualityMetrics}
                        icon={<BarChart height={16} />}
                        className="bg-green-600 text-sm"
                        disabled={metricsComputing}
                      >
                        {metricsComputing ? 'Computing...' : 'Compute Metrics'}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Metrics Content */}
                {metricsComputing && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <RefreshCw className="animate-spin text-blue-600" size={16} />
                      <div className="text-blue-800">
                        Computing quality metrics for this benchmark run...
                      </div>
                    </div>
                  </div>
                )}

                {!qualityMetrics && !metricsComputing && (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <BarChart className="mx-auto text-gray-400 mb-4" size={48} />
                    <div className="text-gray-600 mb-2">Quality metrics not yet computed for this run</div>
                    <div className="text-sm text-gray-500 mb-4">
                      Click the button below to analyze this conversation.<br />
                      <strong>Note:</strong> This will use API resources and may take some time.
                    </div>
                    <Button
                      onClick={computeQualityMetrics}
                      icon={<BarChart height={16} />}
                      className="bg-green-600"
                    >
                      Compute Quality Metrics
                    </Button>
                  </div>
                )}

                {qualityMetrics && (
                  <div className="space-y-6">
                    {/* Metrics Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Activity className="text-green-600" size={16} />
                          <h4 className="font-semibold text-green-800">Engagement Score</h4>
                        </div>
                        <div className="text-2xl font-bold text-green-900">
                          {qualityMetrics.metrics?.participant_engagement?.engagement_score || 'N/A'}
                          {qualityMetrics.metrics?.participant_engagement?.engagement_score && '%'}
                        </div>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Hash className="text-blue-600" size={16} />
                          <h4 className="font-semibold text-blue-800">Total Turns</h4>
                        </div>
                        <div className="text-2xl font-bold text-blue-900">
                          {qualityMetrics.metrics?.conversation_flow?.total_turns || 'N/A'}
                        </div>
                      </div>

                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="text-purple-600" size={16} />
                          <h4 className="font-semibold text-purple-800">Duration</h4>
                        </div>
                        <div className="text-2xl font-bold text-purple-900">
                          {qualityMetrics.metrics?.conversation_flow?.duration_minutes
                            ? `${Math.round(qualityMetrics.metrics.conversation_flow.duration_minutes)}m`
                            : 'N/A'}
                        </div>
                      </div>
                    </div>

                    {/* Detailed Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Conversation Flow */}
                      {qualityMetrics.metrics?.conversation_flow && (
                        <div className="bg-white border rounded-lg p-4">
                          <h4 className="font-semibold text-gray-900 mb-3">Conversation Flow</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Interviewer Turns:</span>
                              <span className="font-medium">{qualityMetrics.metrics.conversation_flow.interviewer_turns}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Participant Turns:</span>
                              <span className="font-medium">{qualityMetrics.metrics.conversation_flow.participant_turns}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Turn Ratio:</span>
                              <span className="font-medium">{qualityMetrics.metrics.conversation_flow.turn_ratio}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Participant Engagement */}
                      {qualityMetrics.metrics?.participant_engagement && (
                        <div className="bg-white border rounded-lg p-4">
                          <h4 className="font-semibold text-gray-900 mb-3">Participant Engagement</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Avg Response Length:</span>
                              <span className="font-medium">{qualityMetrics.metrics.participant_engagement.avg_response_length} chars</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Response Rate:</span>
                              <span className="font-medium">{qualityMetrics.metrics.participant_engagement.response_rate?.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Conversation Quality */}
                      {qualityMetrics.metrics?.conversation_quality && (
                        <div className="bg-white border rounded-lg p-4">
                          <h4 className="font-semibold text-gray-900 mb-3">Conversation Quality</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Completeness Score:</span>
                              <span className="font-medium">{qualityMetrics.metrics.conversation_quality.completeness_score}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Flow Score:</span>
                              <span className="font-medium">{qualityMetrics.metrics.conversation_quality.flow_score}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Naturalness Score:</span>
                              <span className="font-medium">{qualityMetrics.metrics.conversation_quality.naturalness_score}%</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Analysis Details */}
                      {qualityMetrics.details && (
                        <div className="bg-white border rounded-lg p-4">
                          <h4 className="font-semibold text-gray-900 mb-3">Analysis Details</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Questions Analyzed:</span>
                              <span className="font-medium">{qualityMetrics.details.questions_analyzed}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Off-Script Interactions:</span>
                              <span className="font-medium">{qualityMetrics.details.off_script_interactions}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="bg-gray-50 border rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 mb-2">Metrics Information</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Computed At:</span>
                          <div className="font-medium">{formatDate(qualityMetrics.computed_at)}</div>
                        </div>
                        <div>
                          <span className="text-gray-600">Version:</span>
                          <div className="font-medium">{qualityMetrics.version}</div>
                        </div>
                        <div>
                          <span className="text-gray-600">Source:</span>
                          <div className="font-medium capitalize">{qualityMetrics.source?.replace('_', ' ')}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <div className="text-blue-800 text-sm">
            <strong>Run Details:</strong> This page shows the complete transcript and event log for benchmark run {run.run_id}.
            The transcript shows the conversation between the voice bot interviewer and simulated user, while the events tab shows system-level activity during the run.
          </div>
        </div>
      </div>
    </div>
  );
}