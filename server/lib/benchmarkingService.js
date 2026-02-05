import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Benchmarking Tests Service
 *
 * Provides benchmarking test functionality for benchmark runs.
 * Each test is powered by Python code and returns JSON with title and variables.
 * Similar to vCDR analysis but for benchmarking purposes.
 *
 * 🕒 Module loaded at: ${new Date().toISOString()}
 */

console.log(`[BENCHMARKING] 🔄 Module loaded at: ${new Date().toISOString()}`);

/**
 * Compute benchmarking tests for a benchmark run
 * @param {string} runId - The run identifier
 * @param {Array} conversationHistory - The conversation transcript
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Benchmarking tests data
 */
export async function computeBenchmarkTests(runId, conversationHistory, options = {}) {
  const startTime = Date.now();

  try {
    console.log(`[BENCHMARKING] Computing benchmarking tests for run: ${runId}`);

    // Create working directory for this run
    const workspaceDir = path.join(__dirname, '..', '..', 'data', 'benchmarks', runId);
    fs.mkdirSync(workspaceDir, { recursive: true });

    // Convert conversation to transcript format for Python processing
    const transcriptString = convertToTranscriptFormat(conversationHistory);

    // Save transcript to file for Python script
    const transcriptPath = path.join(workspaceDir, 'transcript.txt');
    fs.writeFileSync(transcriptPath, transcriptString);

    // Run benchmarking tests via Python
    const testResults = await runBenchmarkingTests(runId, transcriptPath, workspaceDir, options);

    // Structure the complete result
    const combinedResults = {
      computed_at: new Date().toISOString(),
      run_id: runId,
      tests: testResults,
      metadata: {
        version: "1.0.0",
        computation_time_ms: Date.now() - startTime,
        total_tests: testResults.length
      }
    };

    console.log(`[BENCHMARKING] Completed ${testResults.length} tests for run: ${runId} in ${combinedResults.metadata.computation_time_ms}ms`);
    return combinedResults;

  } catch (error) {
    console.error('[BENCHMARKING] ERROR in computeBenchmarkTests:', error);
    throw new Error(`Failed to compute benchmark tests: ${error.message}`);
  }
}

/**
 * Convert conversation history to transcript format
 * Creates transcript in format: "AGENT: text\nPARTICIPANT: text\n"
 * @param {Array} conversationHistory - Array of conversation entries
 * @returns {string} Formatted transcript string
 */
function convertToTranscriptFormat(conversationHistory) {
  return conversationHistory
    .map(entry => {
      const speaker = entry.speaker === 'interviewer' ? 'AGENT' : 'PARTICIPANT';
      return `${speaker}: ${entry.content.trim()}`;
    })
    .join('\n') + '\n';
}

/**
 * Run benchmarking tests via Python scripts
 * @param {string} runId - The run identifier
 * @param {string} transcriptPath - Path to transcript file
 * @param {string} workspaceDir - Working directory for this run
 * @param {Object} options - Additional options
 * @returns {Promise<Array>} Array of test results
 */
async function runBenchmarkingTests(runId, transcriptPath, workspaceDir, options = {}) {
  return new Promise((resolve, reject) => {
    // Create a custom Python script to run our benchmarking tests
    const customScriptPath = path.join(workspaceDir, 'run_benchmarking.py');
    const customScript = `
import sys
import os
import json
from pathlib import Path
from datetime import datetime

# Read the transcript
# Use raw string to handle Windows backslashes properly
with open(r"${transcriptPath}", "r") as f:
    transcript_text = f.read().strip()

def run_conversation_flow_test(transcript):
    """Test 1: Conversation Flow Analysis"""
    lines = transcript.split('\\n')
    agent_lines = [line for line in lines if line.startswith('AGENT:')]
    participant_lines = [line for line in lines if line.startswith('PARTICIPANT:')]

    total_turns = len(lines)
    agent_turns = len(agent_lines)
    participant_turns = len(participant_lines)

    turn_balance = participant_turns / agent_turns if agent_turns > 0 else 0
    avg_turn_length = sum(len(line) for line in lines) / total_turns if total_turns > 0 else 0

    variables = [
        {"metric": "Total Turns", "value": total_turns, "status": "good" if total_turns >= 10 else "warning" if total_turns >= 5 else "poor"},
        {"metric": "Agent Turns", "value": agent_turns, "status": "good" if agent_turns >= 3 else "warning"},
        {"metric": "Participant Turns", "value": participant_turns, "status": "good" if participant_turns >= 3 else "warning"},
        {"metric": "Turn Balance", "value": f"{turn_balance:.2f}", "status": "good" if 0.8 <= turn_balance <= 1.2 else "warning" if 0.5 <= turn_balance <= 1.5 else "poor"},
        {"metric": "Avg Turn Length", "value": f"{int(avg_turn_length)} chars", "status": "good" if 50 <= avg_turn_length <= 200 else "warning" if avg_turn_length >= 20 else "poor"}
    ]

    return {"title": "Conversation Flow Test", "variables": variables}

def run_engagement_test(transcript):
    """Test 2: Engagement Analysis"""
    lines = transcript.split('\\n')
    participant_lines = [line for line in lines if line.startswith('PARTICIPANT:')]

    if not participant_lines:
        variables = [{"metric": "No Data", "value": "No participant responses found", "status": "poor"}]
        return {"title": "Engagement Test", "variables": variables}

    avg_response_length = sum(len(line) for line in participant_lines) / len(participant_lines)
    short_responses = sum(1 for line in participant_lines if len(line) < 50)
    long_responses = sum(1 for line in participant_lines if len(line) > 150)
    question_responses = sum(1 for line in participant_lines if '?' in line)

    variables = [
        {"metric": "Avg Response Length", "value": f"{int(avg_response_length)} chars", "status": "good" if avg_response_length >= 80 else "warning" if avg_response_length >= 40 else "poor"},
        {"metric": "Short Responses", "value": short_responses, "status": "good" if short_responses <= len(participant_lines) * 0.3 else "warning"},
        {"metric": "Long Responses", "value": long_responses, "status": "good" if long_responses >= len(participant_lines) * 0.2 else "warning"},
        {"metric": "Question Responses", "value": question_responses, "status": "good" if question_responses >= 1 else "warning"},
        {"metric": "Engagement Score", "value": f"{min(100, int(avg_response_length / 2 + long_responses * 10))}%", "status": "good" if avg_response_length >= 60 and long_responses >= 1 else "warning"}
    ]

    return {"title": "Engagement Test", "variables": variables}

def run_response_quality_test(transcript):
    """Test 3: Response Quality Analysis"""
    lines = transcript.split('\\n')
    participant_lines = [line for line in lines if line.startswith('PARTICIPANT:')]

    if not participant_lines:
        variables = [{"metric": "No Data", "value": "No participant responses found", "status": "poor"}]
        return {"title": "Response Quality Test", "variables": variables}

    # Simple quality metrics (placeholder analysis)
    word_count = sum(len(line.split()) for line in participant_lines)
    avg_words = word_count / len(participant_lines)
    repeated_responses = len(participant_lines) - len(set(line.lower().strip() for line in participant_lines))
    exclamations = sum(1 for line in participant_lines if '!' in line)

    variables = [
        {"metric": "Avg Words per Response", "value": f"{avg_words:.1f}", "status": "good" if avg_words >= 8 else "warning" if avg_words >= 4 else "poor"},
        {"metric": "Total Word Count", "value": word_count, "status": "good" if word_count >= 100 else "warning" if word_count >= 50 else "poor"},
        {"metric": "Repeated Responses", "value": repeated_responses, "status": "good" if repeated_responses <= 2 else "warning" if repeated_responses <= 4 else "poor"},
        {"metric": "Expressive Responses", "value": exclamations, "status": "good" if exclamations >= 1 else "warning"},
        {"metric": "Quality Score", "value": f"{min(100, int(avg_words * 5 + (len(participant_lines) - repeated_responses) * 2))}%", "status": "good" if avg_words >= 6 and repeated_responses <= 2 else "warning"}
    ]

    return {"title": "Response Quality Test", "variables": variables}

def run_conversation_health_test(transcript):
    """Test 4: Conversation Health Check"""
    lines = transcript.split('\\n')

    # Health metrics
    empty_lines = sum(1 for line in lines if len(line.strip()) <= 10)
    error_indicators = sum(1 for line in lines if any(word in line.lower() for word in ['error', 'sorry', 'cannot', "don't understand"]))
    participant_lines = [line for line in lines if line.startswith('PARTICIPANT:')]

    # Check for conversation loops (very simple)
    loops_detected = 0
    if len(participant_lines) >= 3:
        for i in range(len(participant_lines) - 2):
            if participant_lines[i].lower() == participant_lines[i+1].lower() == participant_lines[i+2].lower():
                loops_detected += 1

    total_issues = empty_lines + error_indicators + loops_detected
    health_score = max(0, 100 - total_issues * 10)

    variables = [
        {"metric": "Empty/Short Lines", "value": empty_lines, "status": "good" if empty_lines == 0 else "warning" if empty_lines <= 2 else "poor"},
        {"metric": "Error Indicators", "value": error_indicators, "status": "good" if error_indicators == 0 else "warning" if error_indicators <= 1 else "poor"},
        {"metric": "Loops Detected", "value": loops_detected, "status": "good" if loops_detected == 0 else "poor"},
        {"metric": "Total Issues", "value": total_issues, "status": "good" if total_issues == 0 else "warning" if total_issues <= 3 else "poor"},
        {"metric": "Health Score", "value": f"{health_score}%", "status": "good" if health_score >= 80 else "warning" if health_score >= 60 else "poor"}
    ]

    return {"title": "Conversation Health Test", "variables": variables}

# Run all tests
try:
    test_results = [
        run_conversation_flow_test(transcript_text),
        run_engagement_test(transcript_text),
        run_response_quality_test(transcript_text),
        run_conversation_health_test(transcript_text)
    ]

    result = {
        "success": True,
        "tests": test_results,
        "run_id": "${runId}",
        "timestamp": datetime.now().isoformat()
    }

    print("BENCHMARK_RESULT_START")
    print(json.dumps(result, indent=2))
    print("BENCHMARK_RESULT_END")

except Exception as e:
    error_output = {
        "success": False,
        "error": str(e),
        "error_type": type(e).__name__,
        "run_id": "${runId}"
    }
    print("BENCHMARK_ERROR_START")
    print(json.dumps(error_output, indent=2))
    print("BENCHMARK_ERROR_END")
    sys.exit(1)
`;

    // Write the custom script
    fs.writeFileSync(customScriptPath, customScript);
    console.log(`[BENCHMARKING] Created Python script: ${customScriptPath}`);

    // Execute the custom Python script
    const pythonProcess = spawn('python', [customScriptPath], {
      cwd: workspaceDir
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
        reject(new Error(`Benchmarking Python script failed with code ${code}. STDERR: ${stderr}`));
        return;
      }

      try {
        // Parse the result from stdout
        const resultMatch = stdout.match(/BENCHMARK_RESULT_START\s*(.*?)\s*BENCHMARK_RESULT_END/s);
        const errorMatch = stdout.match(/BENCHMARK_ERROR_START\s*(.*?)\s*BENCHMARK_ERROR_END/s);

        if (errorMatch) {
          const errorData = JSON.parse(errorMatch[1]);
          reject(new Error(`Benchmarking test error: ${errorData.error}`));
          return;
        }

        if (resultMatch) {
          const resultData = JSON.parse(resultMatch[1]);
          console.log(`[BENCHMARKING] Successfully parsed ${resultData.tests.length} test results`);
          resolve(resultData.tests);
          return;
        }

        // Fallback - if no structured output, return error
        reject(new Error(`Could not parse benchmarking results from output: ${stdout}`));

      } catch (parseError) {
        reject(new Error(`Failed to parse benchmarking output: ${parseError.message}. Raw output: ${stdout}`));
      }
    });

    pythonProcess.on('error', (error) => {
      reject(new Error(`Failed to start benchmarking Python process: ${error.message}`));
    });

    // Set a timeout
    setTimeout(() => {
      pythonProcess.kill();
      reject(new Error('Benchmarking Python script timed out after 30 seconds'));
    }, 30000);
  });
}