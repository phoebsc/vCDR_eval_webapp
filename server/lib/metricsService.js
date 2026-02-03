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
 * Convert conversation history to vCDR transcript format
 * Creates transcript in format: "AGENT: text\nPARTICIPANT: text\n"
 * @param {Array} conversationHistory - Array of conversation entries
 * @returns {string} Formatted transcript string
 */
function convertToVCDRTranscriptFormat(conversationHistory) {
  return conversationHistory
    .map(entry => {
      const speaker = entry.speaker === 'interviewer' ? 'AGENT' : 'PARTICIPANT';
      return `${speaker}: ${entry.content.trim()}`;
    })
    .join('\n') + '\n';
}

/**
 * Convert conversation history to transcript items array (alternative format)
 * @param {Array} conversationHistory - Array of conversation entries
 * @returns {Array} Array of transcript items
 */
function convertToTranscriptItems(conversationHistory) {
  return conversationHistory.map((entry, index) => ({
    timestamp: entry.timestamp,
    speaker: entry.speaker === 'interviewer' ? 'AGENT' : 'PARTICIPANT',
    text: entry.content.trim(),
    order: index + 1,
    moduleId: null // For vCDR compatibility
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

    // Convert conversation to vCDR transcript format (AGENT: xxx\nPARTICIPANT: xxx\n)
    const vCDRTranscriptString = convertToVCDRTranscriptFormat(conversationHistory);
    console.log(`[METRICS] Created transcript format:\n${vCDRTranscriptString.substring(0, 200)}...`);

    // Save transcript to file for Python script
    const transcriptPath = path.join(workspaceDir, 'transcript.txt');
    fs.writeFileSync(transcriptPath, vCDRTranscriptString);

    // Create survey config (simplified for now)
    const surveyConfig = createSurveyConfig(runId);
    const surveyPath = path.join(workspaceDir, 'survey.json');
    fs.writeFileSync(surveyPath, JSON.stringify(surveyConfig, null, 2));

    // Try to call the actual vCDR scoring system
    try {
      console.log(`[METRICS] Attempting to call vCDR Python scoring...`);
      const vCDRResults = await callVCDRScoring(transcriptPath, surveyPath, runId, workspaceDir);
      console.log(`[METRICS] Successfully got vCDR results for run: ${runId}`);
      return vCDRResults;
    } catch (pythonError) {
      console.warn(`[METRICS] vCDR Python scoring failed, falling back to simplified metrics:`, pythonError.message);

      // Fallback to simplified metrics if Python fails
      const simplifiedMetrics = await generateSimplifiedMetrics(conversationHistory);
      simplifiedMetrics.fallback_reason = pythonError.message;
      simplifiedMetrics.source = "simplified_fallback";

      return simplifiedMetrics;
    }

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
 * Call the vCDR Python scoring system
 * @param {string} transcriptPath - Path to transcript file
 * @param {string} surveyPath - Path to survey config
 * @param {string} runId - The run identifier
 * @param {string} workspaceDir - Working directory for this run
 * @returns {Promise<Object>} vCDR scoring results
 */
async function callVCDRScoring(transcriptPath, surveyPath, runId, workspaceDir) {
  return new Promise((resolve, reject) => {
    const vCDRDir = path.join(__dirname, '..', '..', 'external', 'vCDR');

    // Create a custom Python script to process our data
    const customScriptPath = path.join(workspaceDir, 'run_scoring.py');
    const customScript = `
import sys
import os
import json
from pathlib import Path
from datetime import datetime

# Add vCDR to Python path
vcdr_src = Path("${vCDRDir}") / "src"
sys.path.insert(0, str(vcdr_src))

try:
    from voz_vcdr.processors.individual_scoring import encode_response
    from voz_vcdr.models import SurveyResponse

    # Read the transcript
    with open("${transcriptPath}", "r") as f:
        transcript_text = f.read().strip()

    # Read the survey config
    with open("${surveyPath}", "r") as f:
        survey_config = json.load(f)

    # Convert transcript text to format expected by vCDR
    # The transcript is in format "AGENT: text\\nPARTICIPANT: text\\n"
    transcript_lines = [line.strip() for line in transcript_text.split('\\n') if line.strip()]

    # Create transcript items for vCDR
    transcript_items = []
    for i, line in enumerate(transcript_lines):
        if ':' in line:
            speaker, text = line.split(':', 1)
            transcript_items.append({
                "speaker": speaker.strip(),
                "text": text.strip(),
                "timestamp": f"2024-01-01T00:{i:02d}:00",
                "order": i + 1
            })

    # For now, create a simple survey JSON for the scoring
    simple_survey = {
        "module_id": "${runId}",
        "title": "Benchmark Analysis",
        "questions": [
            {
                "id": "overall_quality",
                "prompt": "Rate the overall conversation quality",
                "type": "analysis"
            }
        ]
    }

    print(f"[PYTHON] Processing {len(transcript_items)} transcript items")
    print(f"[PYTHON] Survey config: {json.dumps(simple_survey, indent=2)}")

    # Call the vCDR scoring function
    # Note: This might need adjustment based on the actual function signature
    try:
        result = encode_response(
            json.dumps(simple_survey, indent=2),
            transcript_items
        )

        # Output the results as JSON
        output = {
            "success": True,
            "computed_at": datetime.utcnow().isoformat() + "Z",
            "version": "vCDR-1.0",
            "source": "vcdr_python_scoring",
            "run_id": "${runId}",
            "transcript_items_processed": len(transcript_items),
            "results": result.model_dump() if hasattr(result, 'model_dump') else result
        }

        print("VCDR_RESULT_START")
        print(json.dumps(output, indent=2))
        print("VCDR_RESULT_END")

    except Exception as e:
        error_output = {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__,
            "run_id": "${runId}"
        }
        print("VCDR_ERROR_START")
        print(json.dumps(error_output, indent=2))
        print("VCDR_ERROR_END")
        sys.exit(1)

except ImportError as e:
    print(f"IMPORT_ERROR: Could not import vCDR modules: {e}")
    sys.exit(2)
except Exception as e:
    print(f"GENERAL_ERROR: {e}")
    sys.exit(3)
`;

    // Write the custom script
    fs.writeFileSync(customScriptPath, customScript);

    console.log(`[METRICS] Calling Python script: ${customScriptPath}`);

    // Execute the custom Python script
    const pythonProcess = spawn('python', [customScriptPath], {
      cwd: workspaceDir,
      env: {
        ...process.env,
        PYTHONPATH: path.join(vCDRDir, 'src'),
        LOCAL_WORKSPACE: workspaceDir
      }
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[PYTHON STDOUT] ${output}`);
      stdout += output;
    });

    pythonProcess.stderr.on('data', (data) => {
      const output = data.toString();
      console.log(`[PYTHON STDERR] ${output}`);
      stderr += output;
    });

    pythonProcess.on('close', (code) => {
      console.log(`[PYTHON] Process exited with code: ${code}`);

      if (code !== 0) {
        reject(new Error(`vCDR Python script failed with code ${code}. STDERR: ${stderr}`));
        return;
      }

      try {
        // Parse the result from stdout
        const resultMatch = stdout.match(/VCDR_RESULT_START\s*(.*?)\s*VCDR_RESULT_END/s);
        const errorMatch = stdout.match(/VCDR_ERROR_START\s*(.*?)\s*VCDR_ERROR_END/s);

        if (errorMatch) {
          const errorData = JSON.parse(errorMatch[1]);
          reject(new Error(`vCDR scoring error: ${errorData.error}`));
          return;
        }

        if (resultMatch) {
          const resultData = JSON.parse(resultMatch[1]);
          console.log(`[METRICS] Successfully parsed vCDR results`);
          resolve(resultData);
          return;
        }

        // Fallback - if no structured output, return what we have
        reject(new Error(`Could not parse vCDR results from output: ${stdout}`));

      } catch (parseError) {
        reject(new Error(`Failed to parse vCDR output: ${parseError.message}. Raw output: ${stdout}`));
      }
    });

    pythonProcess.on('error', (error) => {
      reject(new Error(`Failed to start vCDR Python process: ${error.message}`));
    });

    // Set a timeout
    setTimeout(() => {
      pythonProcess.kill();
      reject(new Error('vCDR Python script timed out after 60 seconds'));
    }, 60000);
  });
}