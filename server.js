import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { getSystemPrompt, getPromptConfig, getInterviewerPromptId, getSimulatedUserPromptId, generatePromptId } from "./lib/promptLoader.js";
import { initializeDatabase, saveBenchmarkRun, getBenchmarkRuns, getBenchmarkRun, updateQualityMetrics } from "./server/lib/database.js";
import { computeQualityMetrics } from "./server/lib/metricsService.js";
import "dotenv/config";

const app = express();

const port = process.env.PORT || 3000;
const apiKey = process.env.OPENAI_API_KEY;

// Configure Vite middleware for React client
const vite = await createViteServer({
  server: {
    middlewareMode: true,
    // Try to ensure Vite doesn't interfere with large payloads
    maxPayloadSize: 50 * 1024 * 1024 // 50MB
  },
  appType: "custom",
});
app.use(vite.middlewares);

// Increase payload size limits AFTER Vite middleware to ensure precedence
app.use(express.text({ limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Voice Bot (Interviewer) Configuration
const interviewerConfig = getPromptConfig('interviewer');
const voiceBotSessionConfig = JSON.stringify({
  session: {
    type: "realtime",
    model: "gpt-4o-realtime-preview",
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

// New endpoint: Just return session config based on prompt selection
app.post("/api/session-config", (req, res) => {
  const interviewerPromptName = req.body.interviewerPrompt || 'interviewer';
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

  res.send(dynamicSessionConfig);
});

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
  console.log('Prompt config loaded:', { interviewerPromptName, hasPrompt: !!promptConfig?.prompt });
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

  console.log("Sending to OpenAI:");
  console.log("Session config:", dynamicSessionConfig);

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

// API route for ephemeral token generation with dynamic prompt support
app.get("/token", async (req, res) => {
  try {
    // Get the interviewer prompt from query parameter, default to 'interviewer'
    const interviewerPromptName = req.query.interviewerPrompt || 'interviewer';
    console.log('[TOKEN] Requested prompt:', interviewerPromptName);

    const promptConfig = getPromptConfig(interviewerPromptName);
    console.log('[TOKEN] Prompt config loaded:', {
      name: interviewerPromptName,
      hasPrompt: !!promptConfig?.prompt,
      promptStart: promptConfig?.prompt?.substring(0, 100) + '...'
    });

    // Build dynamic session configuration
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

    console.log('[TOKEN] Sending session config to OpenAI with instructions:',
      promptConfig.prompt.substring(0, 200) + '...');

    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: dynamicSessionConfig,
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
app.put("/api/benchmark-runs/:run_id", async (req, res) => {
  try {
    const { run_id } = req.params;
    const runData = req.body;

    console.log('[SAVE] 📥 Received run data for:', run_id);
    console.log('[SAVE] 📊 Payload size:', JSON.stringify(runData).length, 'characters');
    console.log('[SAVE] 💬 Events count:', runData.event_log?.length || 0);
    console.log('[SAVE] 📝 Transcript length:', runData.conversation_history?.length || 0);

    // Validate required fields
    if (!runData.conversation_history || !runData.event_log) {
      console.log('[SAVE] ❌ Missing required fields');
      return res.status(400).json({ error: "Missing required fields: conversation_history, event_log" });
    }

    // Generate prompt IDs based on selected prompt names
    const interviewerPromptName = runData.interviewer_prompt_name || 'interviewer';
    const userPromptName = runData.simulated_user_prompt_name || 'candidate';

    const completeRunData = {
      ...runData,
      interviewer_prompt_id: generatePromptId(interviewerPromptName),
      simulated_user_prompt_id: generatePromptId(userPromptName),
      interviewer_prompt_name: interviewerPromptName,
      simulated_user_prompt_name: userPromptName
    };

    const savedRun = await saveBenchmarkRun(run_id, completeRunData);
    console.log(`[SAVE] ✅ Successfully saved benchmark run: ${run_id}`);

    res.json({ ok: true, run: savedRun });
  } catch (error) {
    console.error("[SAVE] ❌ Error saving benchmark run:", error.message);
    console.error("[SAVE] 🔍 Stack trace:", error.stack);
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

// POST /api/benchmark-runs/:run_id/metrics - Compute quality metrics for a run
app.post("/api/benchmark-runs/:run_id/metrics", async (req, res) => {
  try {
    const { run_id } = req.params;
    console.log(`[METRICS] Computing metrics for run: ${run_id}`);

    // Get the full run data including conversation history
    const run = await getBenchmarkRun(run_id);

    if (!run.conversation_history || run.conversation_history.length === 0) {
      return res.status(400).json({
        error: "No conversation history found for this run"
      });
    }

    // Compute quality metrics
    const qualityMetrics = await computeQualityMetrics(
      run_id,
      run.conversation_history,
      {
        interviewer_prompt: run.interviewer_prompt_name,
        user_prompt: run.simulated_user_prompt_name
      }
    );

    // Save metrics to database
    await updateQualityMetrics(run_id, qualityMetrics);

    console.log(`[METRICS] ✅ Successfully computed and saved metrics for run: ${run_id}`);
    res.json({
      ok: true,
      metrics: qualityMetrics,
      message: "Quality metrics computed successfully"
    });
  } catch (error) {
    console.error(`[METRICS] ❌ Error computing metrics for run ${req.params.run_id}:`, error);
    res.status(500).json({
      error: "Failed to compute quality metrics",
      details: error.message
    });
  }
});

// GET /api/benchmark-runs/:run_id/metrics - Get quality metrics for a run
app.get("/api/benchmark-runs/:run_id/metrics", async (req, res) => {
  try {
    const { run_id } = req.params;
    const run = await getBenchmarkRun(run_id);

    if (!run.quality_metrics) {
      return res.status(404).json({
        error: "No quality metrics found for this run",
        computed: false
      });
    }

    res.json({
      ok: true,
      computed: true,
      metrics: run.quality_metrics
    });
  } catch (error) {
    console.error(`Error retrieving metrics for run ${req.params.run_id}:`, error);
    if (error.message.includes('not found')) {
      res.status(404).json({ error: `Run not found: ${req.params.run_id}` });
    } else {
      res.status(500).json({ error: "Failed to retrieve quality metrics" });
    }
  }
});

// TEST endpoint for vCDR integration (remove in production)
app.post("/api/test-vcdr-integration", async (req, res) => {
  try {
    console.log(`[TEST] Testing vCDR integration...`);

    // Create sample conversation data
    const sampleConversation = [
      { speaker: 'interviewer', content: 'Hello, can you tell me your name?', timestamp: '2024-01-01T10:00:00Z' },
      { speaker: 'simulated_user', content: 'My name is John Smith.', timestamp: '2024-01-01T10:00:05Z' },
      { speaker: 'interviewer', content: 'How are you feeling today?', timestamp: '2024-01-01T10:00:10Z' },
      { speaker: 'simulated_user', content: 'I am feeling well, thank you for asking.', timestamp: '2024-01-01T10:00:15Z' },
      { speaker: 'interviewer', content: 'Can you tell me about your memory?', timestamp: '2024-01-01T10:00:20Z' },
      { speaker: 'simulated_user', content: 'My memory is generally good. I can remember most things from recent days and years past.', timestamp: '2024-01-01T10:00:25Z' }
    ];

    const testRunId = `test_${Date.now()}`;

    // Test the quality metrics computation
    const qualityMetrics = await computeQualityMetrics(
      testRunId,
      sampleConversation,
      { test_mode: true }
    );

    console.log(`[TEST] ✅ vCDR integration test successful`);
    res.json({
      ok: true,
      test_run_id: testRunId,
      sample_conversation: sampleConversation,
      metrics: qualityMetrics,
      message: "vCDR integration test completed successfully"
    });

  } catch (error) {
    console.error(`[TEST] ❌ vCDR integration test failed:`, error);
    res.status(500).json({
      ok: false,
      error: "vCDR integration test failed",
      details: error.message,
      message: "Check server logs for detailed error information"
    });
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
