import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Quality Metrics Service
 *
 * Interfaces with the vCDR Python scripts to compute quality metrics for benchmark runs.
 * Uses the git submodule at external/vCDR/ to access the scoring functionality.
 */

/**
 * Convert conversation history to vCDR-compatible transcript format
 * @param {Array} conversationHistory - Array of conversation entries
 * @returns {Array} Formatted transcript entries
 */
function convertToVCDRFormat(conversationHistory) {
  return conversationHistory.map((entry, index) => ({
    timestamp: entry.timestamp,
    speaker: entry.speaker === 'interviewer' ? 'agent' : 'participant',
    content: entry.content,
    order: index + 1
  }));
}

/**
 * Create a minimal survey configuration for quality analysis
 * @param {string} runId - The run identifier
 * @returns {Object} Basic survey configuration
 */
function createSurveyConfig(runId) {
  return {
    module_id: `benchmark_${runId}`,
    title: "Benchmark Analysis",
    questions: [
      {
        id: "conversation_quality",
        prompt: "Overall conversation quality assessment",
        type: "analysis",
        instructions: "Analyze the overall quality of the conversation"
      },
      {
        id: "participant_engagement",
        prompt: "Participant engagement level",
        type: "analysis",
        instructions: "Assess how engaged the participant was"
      },
      {
        id: "interviewer_performance",
        prompt: "Interviewer performance evaluation",
        type: "analysis",
        instructions: "Evaluate how well the interviewer conducted the session"
      }
    ]
  };
}

/**
 * Compute quality metrics for a benchmark run
 * @param {string} runId - The run identifier
 * @param {Array} conversationHistory - The conversation transcript
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Quality metrics data
 */
export async function computeQualityMetrics(runId, conversationHistory, options = {}) {
  try {
    console.log(`[METRICS] Computing quality metrics for run: ${runId}`);

    // Create working directory for this run
    const workspaceDir = path.join(__dirname, '..', '..', 'data', 'metrics', runId);
    fs.mkdirSync(workspaceDir, { recursive: true });

    // Convert conversation to vCDR format
    const vCDRTranscript = convertToVCDRFormat(conversationHistory);

    // Create transcript file
    const transcriptPath = path.join(workspaceDir, 'transcript.json');
    fs.writeFileSync(transcriptPath, JSON.stringify(vCDRTranscript, null, 2));

    // Create survey config
    const surveyConfig = createSurveyConfig(runId);
    const surveyPath = path.join(workspaceDir, 'survey.json');
    fs.writeFileSync(surveyPath, JSON.stringify(surveyConfig, null, 2));

    // For now, return simplified metrics
    // TODO: Integrate with actual vCDR Python scoring once environment is set up
    const mockMetrics = await generateSimplifiedMetrics(conversationHistory);

    console.log(`[METRICS] Generated metrics for run: ${runId}`);
    return mockMetrics;

  } catch (error) {
    console.error('[METRICS] Error computing quality metrics:', error);
    throw new Error(`Failed to compute quality metrics: ${error.message}`);
  }
}

/**
 * Generate simplified quality metrics until full vCDR integration is complete
 * @param {Array} conversationHistory - The conversation transcript
 * @returns {Promise<Object>} Simplified metrics
 */
async function generateSimplifiedMetrics(conversationHistory) {
  // Basic conversation analysis
  const totalTurns = conversationHistory.length;
  const interviewerTurns = conversationHistory.filter(entry => entry.speaker === 'interviewer').length;
  const participantTurns = conversationHistory.filter(entry => entry.speaker === 'simulated_user').length;

  // Calculate average response length
  const participantResponses = conversationHistory.filter(entry => entry.speaker === 'simulated_user');
  const avgResponseLength = participantResponses.length > 0
    ? participantResponses.reduce((sum, entry) => sum + entry.content.length, 0) / participantResponses.length
    : 0;

  // Calculate conversation duration (if timestamps are available)
  let durationMinutes = null;
  if (conversationHistory.length > 1) {
    const start = new Date(conversationHistory[0].timestamp);
    const end = new Date(conversationHistory[conversationHistory.length - 1].timestamp);
    durationMinutes = (end - start) / (1000 * 60); // Convert to minutes
  }

  return {
    computed_at: new Date().toISOString(),
    version: "1.0.0",
    source: "simplified_analysis",
    metrics: {
      conversation_flow: {
        total_turns: totalTurns,
        interviewer_turns: interviewerTurns,
        participant_turns: participantTurns,
        turn_ratio: interviewerTurns > 0 ? (participantTurns / interviewerTurns).toFixed(2) : 0,
        duration_minutes: durationMinutes
      },
      participant_engagement: {
        avg_response_length: Math.round(avgResponseLength),
        response_rate: participantTurns / Math.max(interviewerTurns, 1),
        engagement_score: Math.min(100, Math.round(avgResponseLength / 50 * 100)) // Simple heuristic
      },
      conversation_quality: {
        completeness_score: Math.min(100, Math.round(totalTurns / 10 * 100)), // Simple heuristic
        flow_score: 85, // Placeholder
        naturalness_score: 78 // Placeholder
      }
    },
    details: {
      questions_analyzed: 3,
      off_script_interactions: 0, // Placeholder
      technical_issues: 0 // Placeholder
    }
  };
}

/**
 * Call the actual vCDR Python scoring system (future implementation)
 * @param {string} transcriptPath - Path to transcript file
 * @param {string} surveyPath - Path to survey config
 * @returns {Promise<Object>} vCDR scoring results
 */
async function callVCDRScoring(transcriptPath, surveyPath) {
  return new Promise((resolve, reject) => {
    const vCDRDir = path.join(__dirname, '..', '..', 'external', 'vCDR');
    const pythonScript = path.join(vCDRDir, 'src', 'voz_vcdr', 'extract_responses.py');

    // This would call the actual Python script
    // For now, this is a placeholder for future implementation
    const pythonProcess = spawn('python', [
      pythonScript,
      '--conversation_id', 'benchmark',
      '--module_id', 'analysis',
      '--verbose'
    ], {
      cwd: vCDRDir,
      env: { ...process.env, PYTHONPATH: path.join(vCDRDir, 'src') }
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python script failed with code ${code}: ${stderr}`));
      } else {
        try {
          // Parse the output from the Python script
          resolve({ stdout, stderr });
        } catch (error) {
          reject(new Error(`Failed to parse Python script output: ${error.message}`));
        }
      }
    });

    pythonProcess.on('error', (error) => {
      reject(new Error(`Failed to start Python script: ${error.message}`));
    });
  });
}