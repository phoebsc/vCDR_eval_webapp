import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { getSystemPrompt, getPromptConfig, getInterviewerPromptId, getSimulatedUserPromptId, generatePromptId } from "./lib/promptLoader.js";
import { initializeDatabase, saveBenchmarkRun, getBenchmarkRuns, getBenchmarkRun } from "./server/lib/database.js";
import "dotenv/config";

const app = express();
app.use(express.text());
app.use(express.json());
const port = process.env.PORT || 3000;
const apiKey = process.env.OPENAI_API_KEY;

// Configure Vite middleware for React client
const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: "custom",
});
app.use(vite.middlewares);

// Voice Bot (Interviewer) Configuration
const interviewerConfig = getPromptConfig('interviewer');
const voiceBotSessionConfig = JSON.stringify({
  session: {
    type: "realtime",
    model: "gpt-realtime",
    instructions: interviewerConfig.prompt,
    audio: {
      output: {
        voice: "marin",
      },
    },
  },
});

// Keep original config for backward compatibility
const sessionConfig = voiceBotSessionConfig;

// All-in-one SDP request (experimental)
app.post("/session", async (req, res) => {
  const fd = new FormData();
  console.log(req.body);

  // Check if this is a JSON request with prompt selection
  let sdpData, interviewerPromptName;
  if (req.headers['content-type']?.includes('application/json')) {
    sdpData = req.body.sdp;
    interviewerPromptName = req.body.interviewerPrompt || 'interviewer';
  } else {
    // Backward compatibility - treat body as SDP directly
    sdpData = req.body;
    interviewerPromptName = 'interviewer';
  }

  // Build dynamic session configuration based on selected prompt
  const promptConfig = getPromptConfig(interviewerPromptName);
  const dynamicSessionConfig = JSON.stringify({
    session: {
      type: "realtime",
      model: "gpt-realtime",
      instructions: promptConfig.prompt,
      audio: {
        output: {
          voice: "marin",
        },
      },
    },
  });

  fd.set("sdp", sdpData);
  fd.set("session", dynamicSessionConfig);

  const r = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: {
      "OpenAI-Beta": "realtime=v1",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: fd,
  });
  const sdp = await r.text();
  console.log(sdp);

  // Send back the SDP we received from the OpenAI REST API
  res.send(sdp);
});

// API route for ephemeral token generation
app.get("/token", async (req, res) => {
  try {
    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: sessionConfig,
      },
    );

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Token generation error:", error);
    res.status(500).json({ error: "Failed to generate token" });
  }
});

// API route for OpenAI API key (for simulated user)
app.get("/api/openai-key", async (req, res) => {
  try {
    if (!apiKey) {
      return res.status(500).json({ error: "OpenAI API key not configured" });
    }
    res.json({ key: apiKey });
  } catch (error) {
    console.error("API key retrieval error:", error);
    res.status(500).json({ error: "Failed to retrieve API key" });
  }
});

// API route to list all available prompt files
app.get("/api/prompts", async (req, res) => {
  try {
    const promptsDir = path.join(process.cwd(), 'prompts');
    const files = fs.readdirSync(promptsDir);
    const promptFiles = files
      .filter(file => file.endsWith('.txt'))
      .map(file => ({
        name: file.replace('.txt', ''),
        filename: file
      }));

    console.log(`Found ${promptFiles.length} prompt files`);
    res.json(promptFiles);
  } catch (error) {
    console.error('Error listing prompt files:', error);
    res.status(500).json({ error: 'Failed to list prompt files' });
  }
});

// API route for prompt configurations
app.get("/api/prompts/:promptName", async (req, res) => {
  try {
    const { promptName } = req.params;
    const config = getPromptConfig(promptName);
    res.json(config);
  } catch (error) {
    console.error(`Error loading prompt "${req.params.promptName}":`, error);
    res.status(404).json({ error: `Prompt not found: ${req.params.promptName}` });
  }
});

// Benchmark API endpoints

// POST /api/benchmark-runs - Create new run ID
app.post("/api/benchmark-runs", async (req, res) => {
  try {
    const run_id = crypto.randomUUID();
    const created_at = new Date().toISOString();

    console.log(`Created new benchmark run ID: ${run_id}`);
    res.json({ run_id, created_at });
  } catch (error) {
    console.error("Error creating benchmark run:", error);
    res.status(500).json({ error: "Failed to create benchmark run" });
  }
});

// PUT /api/benchmark-runs/:run_id - Save completed run
app.put("/api/benchmark-runs/:run_id", express.json(), async (req, res) => {
  try {
    const { run_id } = req.params;
    const runData = req.body;

    // Validate required fields
    if (!runData.conversation_history || !runData.event_log) {
      return res.status(400).json({ error: "Missing required fields: conversation_history, event_log" });
    }

    // Generate prompt IDs based on selected prompt names
    const interviewerPromptName = runData.interviewer_prompt_name || 'interviewer';
    const userPromptName = runData.simulated_user_prompt_name || 'candidate';

    const completeRunData = {
      ...runData,
      interviewer_prompt_id: generatePromptId(interviewerPromptName),
      simulated_user_prompt_id: generatePromptId(userPromptName)
    };

    const savedRun = await saveBenchmarkRun(run_id, completeRunData);
    console.log(`Saved benchmark run: ${run_id}`);

    res.json({ ok: true, run: savedRun });
  } catch (error) {
    console.error("Error saving benchmark run:", error);
    res.status(500).json({ error: "Failed to save benchmark run" });
  }
});

// GET /api/benchmark-runs/:run_id - Get full run details (must come before the general route)
app.get("/api/benchmark-runs/:run_id", async (req, res) => {
  try {
    const { run_id } = req.params;
    const run = await getBenchmarkRun(run_id);
    console.log(`Retrieved full details for run: ${run_id}`);
    res.json(run);
  } catch (error) {
    console.error("Error retrieving benchmark run details:", error);
    if (error.message.includes('not found')) {
      res.status(404).json({ error: `Benchmark run not found: ${req.params.run_id}` });
    } else {
      res.status(500).json({ error: "Failed to retrieve benchmark run details" });
    }
  }
});

// GET /api/benchmark-runs - List saved runs (metadata only)
app.get("/api/benchmark-runs", async (req, res) => {
  try {
    const runs = await getBenchmarkRuns();
    console.log(`Retrieved ${runs.length} benchmark runs`);
    res.json(runs);
  } catch (error) {
    console.error("Error retrieving benchmark runs:", error);
    res.status(500).json({ error: "Failed to retrieve benchmark runs" });
  }
});

// Render the React client
app.use("*", async (req, res, next) => {
  const url = req.originalUrl;

  try {
    const template = await vite.transformIndexHtml(
      url,
      fs.readFileSync("./client/index.html", "utf-8"),
    );
    const { render } = await vite.ssrLoadModule("./client/entry-server.jsx");
    const appHtml = await render(url);
    const html = template.replace(`<!--ssr-outlet-->`, appHtml?.html);
    res.status(200).set({ "Content-Type": "text/html" }).end(html);
  } catch (e) {
    vite.ssrFixStacktrace(e);
    next(e);
  }
});

// Initialize database
await initializeDatabase().catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

app.listen(port, () => {
  console.log(`Express server running on *:${port}`);
});
