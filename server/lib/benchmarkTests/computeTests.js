import fs from "fs";
import path from "path";
import { runBenchmarkPython } from "./pythonrunner.js";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function computeBenchmarkTests(
  runId,
  conversationHistory,
  options = {}
) {
  const workspaceDir = path.join(__dirname, '..' ,'..', '..', 'data', 'benchmarks', runId);

  fs.mkdirSync(workspaceDir, { recursive: true });

  const transcriptPath = path.join(workspaceDir, "transcript.txt");
  fs.writeFileSync(
    transcriptPath,
    convertToTranscript(conversationHistory)
  );

  const pythonProcess = runBenchmarkPython({
    runId,
    transcriptPath,
    workspaceDir,
    options
  });

  return await collectPythonResult(pythonProcess);
}

function convertToTranscript(conversationHistory) {
  return (
    conversationHistory
      .map(({ speaker, content }) => {
        const label = speaker === "interviewer" ? "AGENT" : "PARTICIPANT";
        return `${label}: ${content.trim()}`;
      })
      .join("\n") + "\n"
  );
}

function collectPythonResult(proc) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", d => (stdout += d.toString()));
    proc.stderr.on("data", d => (stderr += d.toString()));

    proc.on("close", code => {
      if (code !== 0) {
        reject(new Error(stderr || `Python exited ${code}`));
        return;
      }

      const match = stdout.match(
        /BENCHMARK_RESULT_START\s*(.*?)\s*BENCHMARK_RESULT_END/s
      );

      if (!match) {
        reject(new Error(`Unparseable output:\n${stdout}`));
        return;
      }

      resolve(JSON.parse(match[1]).tests);
    });
  });
}
