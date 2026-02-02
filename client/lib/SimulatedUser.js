/**
 * Simulated User Agent for Automated Benchmarking
 *
 * This class simulates a job candidate responding to interview questions.
 * It uses a predefined system prompt and can generate both expected and
 * off-topic responses to test the interviewer's handling capabilities.
 */

export class SimulatedUser {
  constructor() {
    this.candidateConfig = null;
    this.systemPrompt = '';
    this.initialized = false;

    this.conversationHistory = [];
    this.isActive = false;
    this.lastInterviewerMessage = '';
  }

  /**
   * Initialize the simulated user by loading the candidate config from server
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const response = await fetch('/api/prompts/candidate');
      if (!response.ok) {
        throw new Error(`Failed to load candidate config: ${response.status}`);
      }

      this.candidateConfig = await response.json();
      this.systemPrompt = this.candidateConfig.prompt;
      this.initialized = true;
    } catch (error) {
      console.error('[SimulatedUser] Failed to initialize:', error);
      // Fallback to a basic config if server is unavailable
      this.candidateConfig = {
        name: 'Candidate',
        model: 'gpt-4',
        role: 'candidate',
        generation_settings: {
          max_tokens: 150,
          temperature: 0,
          presence_penalty: 0.1
        }
      };
      this.systemPrompt = `You are a job candidate being interviewed. Your background:
- nurse with 3 years experience
- Worked at pediatric hospitals

Keep responses conversational and realistic but very short. Please respond only with what you say and not the entire conversation history.`;
      this.initialized = true;
    }
  }

  async start() {
    await this.initialize();
    this.isActive = true;
    this.conversationHistory = [];
    this.lastInterviewerMessage = '';
  }

  stop() {
    this.isActive = false;
  }

  reset() {
    this.conversationHistory = [];
    this.lastInterviewerMessage = '';
    this.isActive = false;
  }

  /**
   * Generate a response to the current interview question
   * @param {string} interviewerMessage - The latest message from the interviewer
   * @returns {Promise<string>} The simulated user's response
   */
  async generateResponse(interviewerMessage = '') {
    console.log('[SimulatedUser] generateResponse called');
    console.log('[SimulatedUser] isActive:', this.isActive);

    // Ensure we're initialized
    await this.initialize();

    if (!this.isActive) {
      console.log('[SimulatedUser] Cannot generate response - inactive');
      return null;
    }

    // Update conversation history
    if (interviewerMessage) {
      this.lastInterviewerMessage = interviewerMessage;
      this.conversationHistory.push({
        role: 'interviewer',
        message: interviewerMessage
      });
    }

    try {
      // Generate response using AI
      const response = await this.generateAIResponse();

      if (response) {
        // Add our response to conversation history
        this.conversationHistory.push({
          role: 'candidate',
          message: response
        });
      }

      return response;
    } catch (error) {
      console.error('[SimulatedUser] Error generating AI response:', error);
      // Fallback to a simple response
      return "Could you please repeat the question?";
    }
  }

  /**
   * Generate AI-based response using OpenAI API
   * @returns {Promise<string>} Generated response
   */
  async generateAIResponse() {
    // Build conversation context
    const messages = [
      { role: 'system', content: this.systemPrompt }
    ];

    // Add conversation history
    this.conversationHistory.forEach(entry => {
      messages.push({
        role: entry.role === 'interviewer' ? 'user' : 'assistant',
        content: entry.message
      });
    });

    // // Add current interviewer message if we haven't processed it yet
    // if (this.lastInterviewerMessage && !messages.some(m => m.content === this.lastInterviewerMessage)) {
    //   messages.push({
    //     role: 'user',
    //     content: this.lastInterviewerMessage
    //   });
    // }

    console.log('[SimulatedUser] Sending request to OpenAI with messages:', messages);

    try {
      // Make API call to generate response
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await this.getOpenAIKey()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.candidateConfig.model || 'gpt-4',
          messages: messages,
          max_tokens: this.candidateConfig.generation_settings?.max_tokens || 150,
          temperature: this.candidateConfig.generation_settings?.temperature || 0,
          presence_penalty: this.candidateConfig.generation_settings?.presence_penalty || 0.1,
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content.trim();
    } catch (error) {
      console.error('[SimulatedUser] OpenAI API call failed:', error);
      throw error;
    }
  }

  /**
   * Get OpenAI API key from server
   * @returns {Promise<string>} API key
   */
  async getOpenAIKey() {
    // For now, we'll need to get the API key from the server
    // In a real implementation, you'd want to proxy this through your server
    // to keep the API key secure
    try {
      const response = await fetch('/api/openai-key');
      const data = await response.json();
      return data.key;
    } catch (error) {
      // Fallback - this would need to be implemented on the server side
      console.warn('[SimulatedUser] Could not get API key from server, using environment');
      throw new Error('OpenAI API key not available');
    }
  }

  /**
   * Extract the latest interviewer message from events
   * @param {Array} events - Array of conversation events
   * @returns {string} Latest interviewer message
   */
  extractLatestInterviewerMessage(events) {
    console.log('[SimulatedUser] Extracting latest interviewer message from', events.length, 'events');

    // Look for the most recent interviewer message
    const recentEvents = events.slice(0, 10); // Check last 10 events

    for (const event of recentEvents) {
      let content = '';

      if (event.type === 'response.output_audio_transcript.done' && event.transcript) {
        content = event.transcript;
      } 

      if (content.trim()) {
        return content.trim();
      }
    }

    return '';
  }

  /**
   * Check if we should generate a response based on the latest events
   * @param {Array} events - Array of conversation events
   * @returns {boolean} Whether to generate a response
   */
  shouldRespond(events) {
    console.log('[SimulatedUser] shouldRespond called with events:', events.length);
    console.log('[SimulatedUser] isActive:', this.isActive);

    if (!this.isActive || events.length === 0) {
      console.log('[SimulatedUser] Not responding - inactive or no events');
      return false;
    }

    // Look for the latest AI response that contains a question
    const latestEvents = events.slice(0, 5); // Check last 1 events
    console.log('[SimulatedUser] Checking latest event:', latestEvents.map(e => e.type));
    const latestEvent = events[events.length-1]
    // todo: in the future add content restraints for response by checking the content of response.audio_output_transcript.done
    if (latestEvent.type === 'response.output_audio.done') {
      return true
    }
    return true;
  }

  /**
   * Check if the interviewer has ended the conversation
   * @param {Array} events - Array of conversation events
   * @returns {boolean} Whether the conversation has ended
   */
  isConversationEnded(events) {
    const recentEvents = events.slice(0, 10);

    for (const event of recentEvents) {
      let content = '';

      if (event.transcript) {
        content = event.transcript;
      } 

      if (content.toLowerCase().includes('that completes the interview')) {
        return true;
      }
    }

    return false;
  }
}