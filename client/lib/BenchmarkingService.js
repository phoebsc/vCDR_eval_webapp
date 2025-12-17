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
    this.responseDelay = 3000; // 3 second delay between responses
    this.maxResponseWaitTime = 10000; // 10 seconds max wait for AI response

    // Callbacks for UI updates
    this.onTranscriptUpdate = null;
    this.onLogUpdate = null;
    this.onRunComplete = null;

    // Setup console capture
    this.setupConsoleCapture();
  }

  /**
   * Setup console capture to redirect logs to the UI
   */
  setupConsoleCapture() {
    // Store original console.log
    this.originalConsoleLog = console.log;

    // Override console.log to capture logs for the UI
    console.log = (...args) => {
      // Still log to browser console
      this.originalConsoleLog(...args);

      // If we have an active run and this is a BenchmarkingService or SimulatedUser log
      if (this.currentRun && args.length > 0) {
        const message = args.join(' ');
        if (message.includes('[BenchmarkingService]') || message.includes('[SimulatedUser]')) {
          // Extract the clean message without the prefix
          const cleanMessage = message.replace(/^\[.*?\]\s*/, '');
          this.logEvent('debug', cleanMessage, { originalMessage: message });
        }
      }
    };
  }

  /**
   * Restore original console.log
   */
  restoreConsole() {
    if (this.originalConsoleLog) {
      console.log = this.originalConsoleLog;
    }
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

    // Add test transcript entries to verify UI is working
    this.addToTranscript('user', 'TEST: User message added manually');
    this.addToTranscript('interviewer', 'TEST: Interviewer message added manually');

    // Update UI immediately to test
    if (this.onTranscriptUpdate) {
      console.log('[BenchmarkingService] TEST: Calling onTranscriptUpdate with test entries');
      this.onTranscriptUpdate([...this.currentRun.transcript]);
    }

    // Send initial greeting to start the conversation
    setTimeout(() => {
      if (this.isRunning) {
        console.log('[BenchmarkingService] Sending initial greeting to start conversation');
        this.sendTextMessage("Hello, I'm ready for the interview.");
        this.addToTranscript('user', "Hello, I'm ready for the interview.");

        // Update UI after adding greeting
        if (this.onTranscriptUpdate) {
          this.onTranscriptUpdate([...this.currentRun.transcript]);
        }
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

    // Restore console logging
    this.restoreConsole();

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
      const timeSinceLastResponse = lastLog && lastLog.source === 'simulated_user'
        ? new Date() - new Date(lastLog.timestamp)
        : this.responseDelay + 1000;

      console.log('[BenchmarkingService] Time since last response:', timeSinceLastResponse, 'ms');
      console.log('[BenchmarkingService] Response delay:', this.responseDelay, 'ms');

      if (timeSinceLastResponse > this.responseDelay) {
        console.log('[BenchmarkingService] Scheduling response in', this.responseDelay, 'ms');
        setTimeout(() => {
          if (this.isRunning) {
            this.generateSimulatedResponse();
          }
        }, this.responseDelay);
      } else {
        console.log('[BenchmarkingService] Too soon to respond, waiting...');
      }
    } else {
      console.log('[BenchmarkingService] Simulated user should NOT respond');
    }
  }

  /**
   * Generate and send a simulated user response
   */
  generateSimulatedResponse() {
    console.log('[BenchmarkingService] Generating simulated response...');
    const response = this.simulatedUser.generateResponse();

    if (response) {
      console.log('[BenchmarkingService] Generated response:', response);

      // Add to transcript
      this.addToTranscript('user', response);

      // Log the simulated response
      this.logEvent('simulated_user', 'Generated response', {
        text: response,
        questionIndex: this.simulatedUser.currentQuestionIndex - 1
      });

      // Send the response
      console.log('[BenchmarkingService] Sending text message:', response);
      this.sendTextMessage(response);

      // Update UI
      if (this.onTranscriptUpdate) {
        this.onTranscriptUpdate(this.currentRun.transcript);
      }
    } else {
      console.log('[BenchmarkingService] No response generated');
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
    console.log('[BenchmarkingService] updateEventLog called with', events.length, 'events');

    // Process only new events that we haven't seen before
    const newEvents = events.filter(event => {
      return !this.currentRun.processedEventIds?.includes(event.event_id);
    });

    // Track processed event IDs
    if (!this.currentRun.processedEventIds) {
      this.currentRun.processedEventIds = [];
    }

    // Process new events and extract transcript information
    newEvents.forEach(event => {
      console.log('[BenchmarkingService] Processing NEW event for transcript:', event.type);
      console.log('[BenchmarkingService] Full event object:', JSON.stringify(event, null, 2));

      // Mark as processed
      this.currentRun.processedEventIds.push(event.event_id);

      // Extract text content for transcript
      let textContent = '';
      let role = 'interviewer';

      // Handle various event types that contain text - improved parsing
      if (event.type === 'response.audio_transcript.done' && event.transcript) {
        textContent = event.transcript;
        console.log('[BenchmarkingService] Found audio transcript:', textContent);
      }
      else if (event.type === 'response.text.done' && event.text) {
        textContent = event.text;
        console.log('[BenchmarkingService] Found text response:', textContent);
      }
      else if (event.type === 'response.output_item.done' && event.item) {
        // Handle output item events (common in realtime API)
        if (event.item.type === 'message' && event.item.content) {
          for (const content of event.item.content) {
            if (content.type === 'text' && content.text) {
              textContent += content.text;
            }
          }
        }
        console.log('[BenchmarkingService] Found output item text:', textContent);
      }
      else if (event.type === 'response.done' && event.response?.output) {
        // Extract text from structured response
        for (const output of event.response.output) {
          if (output.type === 'message' && output.content) {
            for (const content of output.content) {
              if (content.type === 'text' && content.text) {
                textContent += content.text;
              }
            }
          }
        }
        console.log('[BenchmarkingService] Found structured response text:', textContent);
      }
      else if (event.type === 'conversation.item.created' && event.item) {
        // Handle user messages (text input)
        if (event.item.role === 'user' && event.item.content) {
          for (const content of event.item.content) {
            if (content.type === 'input_text' && content.text) {
              textContent = content.text;
              role = 'user';
            }
          }
        }
        console.log('[BenchmarkingService] Found user input text:', textContent);
      }
      // Additional event type - sometimes transcript comes in different formats
      else if (event.type === 'session.update' && event.session) {
        // Log session updates but don't extract transcript
        console.log('[BenchmarkingService] Session update event');
      }
      else {
        // Log other event types for debugging
        console.log('[BenchmarkingService] Unhandled event type:', event.type, 'Available keys:', Object.keys(event));
      }

      // Add to transcript if we found text content
      if (textContent && textContent.trim()) {
        const cleanText = textContent.trim();
        console.log('[BenchmarkingService] Processing text for transcript:', role, cleanText);

        // Check if this is already in our transcript to avoid duplicates
        const exists = this.currentRun.transcript.some(entry =>
          entry.message === cleanText &&
          entry.role === role &&
          Math.abs(new Date(entry.timestamp) - new Date()) < 30000 // Within 30 seconds
        );

        if (!exists) {
          this.addToTranscript(role, cleanText);
          console.log('[BenchmarkingService] Added to transcript - total entries:', this.currentRun.transcript.length);

          // Update UI immediately
          if (this.onTranscriptUpdate) {
            console.log('[BenchmarkingService] Calling onTranscriptUpdate with', this.currentRun.transcript.length, 'entries');
            this.onTranscriptUpdate([...this.currentRun.transcript]); // Create a new array reference
          } else {
            console.warn('[BenchmarkingService] onTranscriptUpdate callback not set!');
          }
        } else {
          console.log('[BenchmarkingService] Duplicate transcript entry, skipping');
        }
      }

      // Log the raw event to the event log
      this.logEvent('realtime_api', event.type, {
        eventId: event.event_id,
        hasText: !!textContent
      });
    });

    console.log('[BenchmarkingService] Current transcript has', this.currentRun.transcript.length, 'entries');
  }

  /**
   * Save run data to localStorage for persistence
   */
  saveRunData() {
    if (!this.currentRun) return;

    try {
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