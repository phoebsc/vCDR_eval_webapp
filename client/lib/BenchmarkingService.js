/**
 * Benchmarking Service for Automated AI-to-AI Conversations
 *
 * This service orchestrates conversations between the voice bot interviewer
 * and simulated user, capturing transcripts and event logs for analysis.
 */

import { SimulatedUser } from './SimulatedUser.js';

export class BenchmarkingService {
  constructor() {
    this.simulatedUser = new SimulatedUser();
    this.isRunning = false;
    this.currentRun = null;
    this.responseDelay = 200; // delay from receiving audio_buffer_stopped to sending the text message
    this.maxResponseWaitTime = 10000; // 10 seconds max wait for AI response

    // Callbacks for UI updates
    this.onTranscriptUpdate = null;
    this.onLogUpdate = null;
    this.onRunComplete = null;
  }

  /**
   * Start a new benchmark run
   * @param {Function} sendTextMessage - Function to send text messages to the voice bot
   * @param {Array} events - Current events array
   * @param {string} interviewerPrompt - Name of the interviewer prompt to use
   * @param {string} userPrompt - Name of the simulated user prompt to use
   */
  async startRun(sendTextMessage, events = [], interviewerPrompt = 'interviewer', userPrompt = 'candidate') {
    console.log('[BenchmarkingService] Starting benchmark run...');

    if (this.isRunning) {
      console.warn('[BenchmarkingService] Benchmark run already in progress');
      return;
    }

    try {
      // Get new run ID from server
      const runInfo = await this.createNewRun();

      this.isRunning = true;
      this.sendTextMessage = sendTextMessage;

      // Initialize new run data with server-generated ID
      this.currentRun = {
        id: runInfo.run_id,
        startTime: new Date(runInfo.created_at),
        endTime: null,
        transcript: [],
        eventLog: [],
        status: 'running',
        processedEventIds: [], // Track processed events for deduplication
        selectedInterviewerPrompt: interviewerPrompt,
        selectedUserPrompt: userPrompt
      };

      console.log('[BenchmarkingService] Created run:', this.currentRun.id);
    } catch (error) {
      console.error('[BenchmarkingService] Failed to start benchmark run:', error);
      throw error;
    }

    // Start the simulated user with the selected prompt
    await this.simulatedUser.initialize(userPrompt);
    this.simulatedUser.start();
    console.log('[BenchmarkingService] Started simulated user with prompt:', userPrompt);

    // Log run start
    this.logEvent('system', 'Benchmark run started', { runId: this.currentRun.id });

    // Begin monitoring the conversation
    console.log('[BenchmarkingService] Starting to monitor conversation with', events.length, 'initial events');

    // Send initial greeting to start the conversation
    setTimeout(() => {
      if (this.isRunning) {
        console.log('[BenchmarkingService] Sending initial greeting to start conversation');
        this.sendTextMessage("Hello, I'm ready.");
      }
    }, 1000);

    this.monitorConversation(events);
  }

  /**
   * End the current benchmark run
   */
  async endRun() {
    console.log('[BenchmarkingService] 🏁 endRun() called');
    if (!this.isRunning || !this.currentRun) {
      console.log('[BenchmarkingService] ⏹️ No active run or not running - skipping');
      return;
    }

    console.log('[BenchmarkingService] 📊 Ending run:', this.currentRun.id);
    console.log('[BenchmarkingService] 💬 Final transcript length:', this.currentRun.transcript?.length || 0);
    console.log('[BenchmarkingService] 📝 Final events count:', this.currentRun.events?.length || 0);

    this.isRunning = false;
    this.simulatedUser.stop();

    this.currentRun.endTime = new Date();
    this.currentRun.status = 'completed';

    // Log run end
    this.logEvent('system', 'Benchmark run ended', {
      runId: this.currentRun.id,
      duration: this.currentRun.endTime - this.currentRun.startTime
    });

    // Save the run data to server
    try {
      await this.saveRunToServer();
      console.log('[BenchmarkingService] Run saved to server successfully');
    } catch (error) {
      console.error('[BenchmarkingService] Failed to save run to server:', error);
      // Continue with completion callback even if save fails
    }

    // Notify completion - this should update UI state
    if (this.onRunComplete) {
      this.onRunComplete(this.currentRun);
    }

    console.log('[BenchmarkingService] ✅ Run ending completed successfully');
  }

  /**
   * Monitor conversation events and trigger simulated user responses
   * @param {Array} events - Array of conversation events
   */
  monitorConversation(events) {
    console.log('[BenchmarkingService] monitorConversation called with', events.length, 'events');

    if (!this.isRunning) {
      console.log('[BenchmarkingService] Not running, stopping monitoring');
      return;
    }

    // Store current events for use by generateSimulatedResponse
    this.currentEvents = events;

    // Update event log with new events
    this.updateEventLog(events);

    // Check if conversation should end
    if (this.simulatedUser.isConversationEnded(events)) {
      console.log('[BenchmarkingService] Conversation ended detected');
      this.logEvent('system', 'Termination cue detected', { cue: 'That completes the interview' });
      console.log('[BenchmarkingService] 🔚 Natural ending detected - scheduling endRun()');

      // Properly handle async endRun with error handling
      setTimeout(() => {
        console.log('[BenchmarkingService] 🚀 Executing natural endRun()');
        this.endRun().catch(error => {
          console.error('[BenchmarkingService] ❌ Error during natural run ending:', error);
        });
      }, 1000);
      return;
    }

    // Check if simulated user should respond
    console.log('[BenchmarkingService] Checking if simulated user should respond...');
    if (this.simulatedUser.shouldRespond(events)) {
      console.log('[BenchmarkingService] Simulated user should respond');
      // Only respond if we haven't already responded recently
      const lastLog = this.currentRun.eventLog[this.currentRun.eventLog.length - 1];
      // const timeSinceLastResponse = lastLog && lastLog.source === 'simulated_user'
      //   ? new Date() - new Date(lastLog.timestamp)
      //   : this.responseDelay + 1000;
      console.log('[BenchmarkingService] lastLog:', JSON.stringify(lastLog))
      // console.log('[BenchmarkingService] Time since last response:', timeSinceLastResponse, 'ms');
      // console.log('[BenchmarkingService] Response delay:', this.responseDelay, 'ms');

      // New mechanism: only respond if the audio is finished (plus a delay)
      // if (timeSinceLastResponse > this.responseDelay) {
      if (lastLog.action=='output_audio_buffer.stopped') {
        console.log('[BenchmarkingService] Scheduling response in', this.responseDelay, 'ms');
        setTimeout(() => {
          if (this.isRunning) {
            this.generateSimulatedResponse();
          }
        }, this.responseDelay);
      }
    } else {
      console.log('[BenchmarkingService] Simulated user should NOT respond');
    }
  }

  /**
   * Generate and send a simulated user response
   */
  async generateSimulatedResponse() {
    console.log('[BenchmarkingService] Generating simulated response...');

    // Extract the latest interviewer message from current events
    const interviewerMessage = this.simulatedUser.extractLatestInterviewerMessage(this.currentEvents || []);
    this.addToTranscript('interviewer', interviewerMessage);
    this.updateTranscriptUI();
    console.log('[BenchmarkingService] Extracted interviewer message:', interviewerMessage);

    try {
      const response = await this.simulatedUser.generateResponse(interviewerMessage);

      if (response) {
        // Log the simulated response
        this.logEvent('simulated_user', 'Generated response');
        this.addToTranscript('simulated_user', response);
        this.updateTranscriptUI();

        // Send the response (transcript will be updated when we see the conversation.item.created event)
        console.log('[BenchmarkingService] Simulated user sending text message:', response);
        this.sendTextMessage(response);
      } else {
        console.log('[BenchmarkingService] Simulated user no response generated');
      }
    } catch (error) {
      console.error('[BenchmarkingService] Error generating simulated response:', error);
      this.logEvent('simulated_user', 'Response generation failed', {
        error: error.message,
        interviewerMessage: interviewerMessage
      });
    }
  }

  /**
   * Add an entry to the conversation transcript
   * @param {string} role - 'interviewer' or 'user'
   * @param {string} message - The message content
   */
  addToTranscript(role, message) {
    if (!this.currentRun) return;

    const entry = {
      timestamp: new Date(),
      role: role,
      message: message,
      id: crypto.randomUUID()
    };

    this.currentRun.transcript.push(entry);
  }

  /**
   * Log a system event
   * @param {string} source - Event source ('system', 'interviewer', 'simulated_user')
   * @param {string} action - Action description
   * @param {Object} data - Additional event data
   */
  logEvent(source, action, data = {}) {
    if (!this.currentRun) return;

    const logEntry = {
      timestamp: new Date(),
      source: source,
      action: action,
      data: data,
      id: crypto.randomUUID()
    };

    this.currentRun.eventLog.push(logEntry);

    // Update UI
    if (this.onLogUpdate) {
      this.onLogUpdate(this.currentRun.eventLog);
    }
  }

  /**
   * Update event log with conversation events
   * @param {Array} events - Conversation events from the realtime API
   */
  updateEventLog(events) {
    console.log('[BenchmarkingService] updateEventLog processing', events.length, 'events');

    // Process only new events to avoid duplicates
    const newEvents = events.filter(event => {
      return !this.currentRun.processedEventIds?.includes(event.event_id);
    });

    if (!this.currentRun.processedEventIds) {
      this.currentRun.processedEventIds = [];
    }

    console.log('[BenchmarkingService] Processing', newEvents.length, 'new events for transcript');

    newEvents.forEach(event => {
      // Mark as processed
      if (event.event_id) {
        this.currentRun.processedEventIds.push(event.event_id);
      }

      // ONLY handle transcript updates for these specific event types:

      // 1. Server/Interviewer audio responses
      // if (event.type === 'response.output_audio_transcript.done' && event.transcript) {
      //   console.log('[BenchmarkingService] Adding interviewer transcript:', event.transcript);
      //   // this.addToTranscript('interviewer', event.transcript);
      //   // this.updateTranscriptUI();
      // }

      // // 2. User text input (from simulated user)
      // else if (event.type === 'conversation.item.created' && event.item.content) {
      //   let userText = '';
      //   for (const content of event.item.content) {
      //     if (content.type === 'input_text' && content.text) {
      //       userText = content.text;
      //       break;
      //     }
      //   }
      //   if (userText) {
      //     console.log('[BenchmarkingService] Adding user transcript:', userText);
      //     this.addToTranscript('user', userText);
      //     this.updateTranscriptUI();
      //   }
      // }

      // Log all events for debugging (but don't extract transcript from them)
      this.logEvent('realtime_api', event.type, {
        eventId: event.event_id,
        hasTranscript: !!event.transcript
      });
    });
  }

  /**
   * Update the transcript UI
   */
  updateTranscriptUI() {
    if (this.onTranscriptUpdate) {
      console.log('[BenchmarkingService] Updating transcript UI with', this.currentRun.transcript.length, 'entries');
      this.onTranscriptUpdate([...this.currentRun.transcript]);
    }
  }

  /**
   * Create a new run ID from the server
   * @returns {Promise<Object>} Run info with run_id and created_at
   */
  async createNewRun() {
    try {
      const response = await fetch('/api/benchmark-runs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to create run: ${response.status} ${response.statusText}`);
      }

      const runInfo = await response.json();
      console.log('[BenchmarkingService] Created new run ID:', runInfo.run_id);
      return runInfo;
    } catch (error) {
      console.error('[BenchmarkingService] Error creating new run:', error);
      throw error;
    }
  }

  /**
   * Save completed run data to server
   * @returns {Promise<void>}
   */
  async saveRunToServer() {
    if (!this.currentRun) {
      throw new Error('No current run to save');
    }

    try {
      // Transform transcript to conversation_history format
      const conversation_history = this.currentRun.transcript.map(entry => ({
        speaker: entry.role === 'interviewer' ? 'interviewer' : 'simulated_user',
        content: entry.message,
        timestamp: entry.timestamp
      }));

      // Transform eventLog to server format
      const event_log = this.currentRun.eventLog.map(entry => ({
        timestamp: entry.timestamp,
        source: entry.source,
        action: entry.action,
        data: entry.data || {}
      }));

      const payload = {
        mode: 'benchmark',
        conversation_history,
        event_log,
        interviewer_prompt_name: this.currentRun.selectedInterviewerPrompt,
        simulated_user_prompt_name: this.currentRun.selectedUserPrompt
      };

      const response = await fetch(`/api/benchmark-runs/${this.currentRun.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Failed to save run: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('[BenchmarkingService] Run saved successfully:', result);
    } catch (error) {
      console.error('[BenchmarkingService] Error saving run to server:', error);
      throw error;
    }
  }

  /**
   * Get all saved benchmark runs from server
   * @returns {Promise<Array>} Array of saved benchmark runs metadata
   */
  async getSavedRuns() {
    try {
      const response = await fetch('/api/benchmark-runs');

      if (!response.ok) {
        throw new Error(`Failed to fetch runs: ${response.status} ${response.statusText}`);
      }

      const runs = await response.json();
      console.log('[BenchmarkingService] Retrieved saved runs:', runs.length);
      return runs;
    } catch (error) {
      console.error('[BenchmarkingService] Error fetching saved runs:', error);
      return []; // Return empty array on error to maintain compatibility
    }
  }

  /**
   * Get the current run data
   * @returns {Object|null} Current run data or null if no run active
   */
  getCurrentRun() {
    return this.currentRun;
  }

  /**
   * Check if a benchmark run is currently active
   * @returns {boolean} True if a run is active
   */
  isActive() {
    return this.isRunning;
  }

  /**
   * Get the simulated user's system prompt for display
   * @returns {string} The system prompt
   */
  getSimulatedUserPrompt() {
    return this.simulatedUser.systemPrompt;
  }
}