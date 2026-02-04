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
 *
 * ⚠️ FALLBACK DISABLED - Will fail hard if vCDR fails (no simplified metrics fallback)
 * 🕒 Module loaded at: ${new Date().toISOString()}
 */

console.log(`[METRICSSERVICE] 🔄 Module loaded at: ${new Date().toISOString()}`);
console.log(`[METRICSSERVICE] ⚠️  FALLBACK DISABLED - vCDR will fail hard if there are issues`);

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

// Survey config creation removed - no longer needed for vCDR integration

/**
 * Compute quality metrics for a benchmark run
 * @param {string} runId - The run identifier
 * @param {Array} conversationHistory - The conversation transcript
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Quality metrics data
 */
export async function computeQualityMetrics(runId, conversationHistory, options = {}) {
  try {
    console.log(`[METRICS] 🚀 METRICSSERVICE LOADED - Version: ${new Date().toISOString()}`);
    console.log(`[METRICS] 💾 Computing quality metrics for run: ${runId}`);
    console.log(`[METRICS] 🎯 Options received:`, JSON.stringify(options));

    // Create working directory for this run
    const workspaceDir = path.join(__dirname, '..', '..', 'data', 'metrics', runId);
    fs.mkdirSync(workspaceDir, { recursive: true });

    // Convert conversation to vCDR transcript format (AGENT: xxx\nPARTICIPANT: xxx\n)
    const vCDRTranscriptString = convertToVCDRTranscriptFormat(conversationHistory);
    console.log(`[METRICS] Created transcript format:\n${vCDRTranscriptString.substring(0, 200)}...`);

    // Save transcript to file for Python script
    const transcriptPath = path.join(workspaceDir, 'transcript.txt');
    fs.writeFileSync(transcriptPath, vCDRTranscriptString);

    // Get interviewer prompt name for vCDR scoring
    const interviewerPrompt = options.interviewer_prompt || 'interviewer';
    console.log(`[METRICS] Using interviewer prompt: ${interviewerPrompt}`);

    // Try to call the actual vCDR scoring system (NO FALLBACK - FAIL HARD)
    console.log(`[METRICS] 🚨 FALLBACK DISABLED - vCDR will fail hard if there are issues`);
    console.log(`[METRICS] Attempting to call vCDR Python scoring...`);
    const vCDRResults = await callVCDRScoring(transcriptPath, runId, workspaceDir, interviewerPrompt);
    console.log(`[METRICS] Successfully got vCDR results for run: ${runId}`);
    return vCDRResults;
    // } catch (pythonError) {
    //   console.warn(`[METRICS] vCDR Python scoring failed, falling back to simplified metrics:`, pythonError.message);

    //   // Fallback to simplified metrics if Python fails
    //   const simplifiedMetrics = await generateSimplifiedMetrics(conversationHistory);
    //   simplifiedMetrics.fallback_reason = pythonError.message;
    //   simplifiedMetrics.source = "simplified_fallback";

    //   return simplifiedMetrics;
    // }

  } catch (error) {
    console.error('[METRICS] 💥 FATAL ERROR in computeQualityMetrics:', error);
    console.error('[METRICS] 📋 Error stack:', error.stack);
    console.error('[METRICS] 🔍 Error type:', typeof error);
    console.error('[METRICS] 📊 Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
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
      }
    }
  };
}

/**
 * Call the vCDR Python scoring system
 * @param {string} transcriptPath - Path to transcript file
 * @param {string} runId - The run identifier
 * @param {string} workspaceDir - Working directory for this run
 * @param {string} interviewerPrompt - Name of the interviewer prompt
 * @returns {Promise<Object>} vCDR scoring results
 */
async function callVCDRScoring(transcriptPath, runId, workspaceDir, interviewerPrompt) {
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
# Use raw string to handle Windows backslashes properly
vcdr_src = Path(r"${vCDRDir}") / "src"
sys.path.insert(0, str(vcdr_src))

try:
    from voz_vcdr.extract_responses import extract_responses_benchmark
    from voz_vcdr.models import SurveyResponse
    from ulid import ULID
    def moduleTitle2ID(title: str) -> str:
        mapping = {
            'Subject - Memory - Part 1': '01KEWNHMWCMHQZMW901TZY3V2W',
            'Subject - Memory - Part 2': '01KEWNHMX47Z4D9FQ4HD15BAV4',
            'Subject - Orientation': '01KEWNHMX47R4ZANXZB72XQZDX',
            'Subject - Judgement & Problem Solving': '01KEWNHMX44EKVHD18NXMZZ16V',
            'Partner - Memory - Part 1': '01KEWNHMX4SH8HEN1E4YTATQF2',
            'Partner - Memory - Part 2': '01KEWNHMX417VK0YR2YEVX9B75',
            'Partner - Orientation': '01KEWNHMX5R7Y0Z86K4XBNR1YW',
            'Partner - Judgement & Problem Solving': '01KEWNHMX5BJK9H4XRD9KNF29W',
            'Partner - Community Affairs': '01KEWNHMX56WKPKG1CDPESEQVQ',
            'Partner - Home & Hobbies': '01KEWNHMX5JD91W5R3DSWEH8X4',
            'Partner - Personal Care': '01KEWNHMX5A9EEHF9TTXBP98V3',
        }

        matches = [v for k, v in mapping.items() if k in title]

        if len(matches) != 1:
            raise ValueError(
                f"Expected exactly one match for title '{title}', found {len(matches)}"
            )

        return matches[0]
    # Read the transcript
    # Use raw string to handle Windows backslashes properly
    with open(r"${transcriptPath}", "r") as f:
        transcript_text = f.read().strip()

    # Use the interviewer prompt for module ID mapping
    interviewer_prompt = "${interviewerPrompt}"
    conversation_id = "${runId}"

    print(f"[PYTHON] Processing transcript for interviewer prompt: {interviewer_prompt}")
    print(f"[PYTHON] Conversation ID: {conversation_id}")
    print(f"[PYTHON] Transcript length: {len(transcript_text)} characters")

    # Call the vCDR scoring function
    try:
        module_id_string = moduleTitle2ID(interviewer_prompt)
        module_id = ULID.from_str(module_id_string)
        result = extract_responses_benchmark(conversation_id, transcript_text, module_id)

        # Convert result to dict if it's a Pydantic model
        if hasattr(result, 'model_dump'):
            result_dict = result.model_dump()
        elif hasattr(result, 'dict'):
            result_dict = result.dict()
        else:
            result_dict = result

        print("VCDR_RESULT_START")
        print(json.dumps(result_dict, indent=2, default=str))
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