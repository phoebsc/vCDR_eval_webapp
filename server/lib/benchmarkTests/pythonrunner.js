import { spawn } from "child_process";
import path from "path";

export function runBenchmarkPython({ runId, transcriptPath, workspaceDir, options }) {
  const pythonRoot = path.resolve("pycode_benchmarking");
  const runner = path.join(
    pythonRoot,
    "run_benchmarking.py"
  );

  return spawn(
    "python",
    [runner, "--run-id", runId, "--transcript", transcriptPath, "--workspace", workspaceDir, "--options", options],
    {
      cwd: workspaceDir,
      env: {
        ...process.env,
        PYTHONPATH: pythonRoot,
      },
    }
  );
}
