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
   */
  startRun(sendTextMessage, events = []) {
    console.log('[BenchmarkingService] Starting benchmark run...');

    if (this.isRunning) {
      console.warn('[BenchmarkingService] Benchmark run already in progress');
      return;
    }

    this.isRunning = true;
    this.sendTextMessage = sendTextMessage;

    // Initialize new run data
    this.currentRun = {
      id: crypto.randomUUID(),
      startTime: new Date(),
      endTime: null,
      transcript: [],
      eventLog: [],
      status: 'running'
    };

    console.log('[BenchmarkingService] Created run:', this.currentRun.id);

    // Start the simulated user
    this.simulatedUser.start();
    console.log('[BenchmarkingService] Started simulated user');

    // Log run start
    this.logEvent('system', 'Benchmark run started', { runId: this.currentRun.id });

    // Begin monitoring the conversation
    console.log('[BenchmarkingService] Starting to monitor conversation with', events.length, 'initial events');

    // Send initial greeting to start the conversation
    setTimeout(() => {
      if (this.isRunning) {
        console.log('[BenchmarkingService] Sending initial greeting to start conversation');
        this.sendTextMessage("Hello, I'm ready for the interview.");
      }
    }, 1000);

    this.monitorConversation(events);
  }

  /**
   * End the current benchmark run
   */
  endRun() {
    if (!this.isRunning || !this.currentRun) {
      return;
    }

    this.isRunning = false;
    this.simulatedUser.stop();

    this.currentRun.endTime = new Date();
    this.currentRun.status = 'completed';

    // Log run end
    this.logEvent('system', 'Benchmark run ended', {
      runId: this.currentRun.id,
      duration: this.currentRun.endTime - this.currentRun.startTime
    });

    // Save the run data
    this.saveRunData();

    // Notify completion
    if (this.onRunComplete) {
      this.onRunComplete(this.currentRun);
    }
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
      this.logEvent('system', 'Termination cue detected', { cue: 'This is the end of this part' });
      setTimeout(() => this.endRun(), 1000);
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
   * Save run data to localStorage for persistence
   */
  saveRunData() {
    if (!this.currentRun) return;

    try {
      console.log('Saving to path', JSON.stringify(localStorage))
      const savedRuns = JSON.parse(localStorage.getItem('benchmarkRuns') || '[]');
      savedRuns.push(this.currentRun);

      // Keep only the last 10 runs to avoid storage bloat
      if (savedRuns.length > 10) {
        savedRuns.splice(0, savedRuns.length - 10);
      }

      localStorage.setItem('benchmarkRuns', JSON.stringify(savedRuns));
    } catch (error) {
      console.error('Failed to save benchmark run data:', error);
    }
  }

  /**
   * Get all saved benchmark runs
   * @returns {Array} Array of saved benchmark runs
   */
  getSavedRuns() {
    try {
      return JSON.parse(localStorage.getItem('benchmarkRuns') || '[]');
    } catch (error) {
      console.error('Failed to load benchmark runs:', error);
      return [];
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