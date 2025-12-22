/**
 * Simulated User Agent for Automated Benchmarking
 *
 * This class simulates a job candidate responding to interview questions.
 * It uses a predefined system prompt and can generate both expected and
 * off-topic responses to test the interviewer's handling capabilities.
 */

export class SimulatedUser {
  constructor() {
    this.systemPrompt = `## **System Prompt — Simulated Study Partner (Memory Interview)**

You are a **simulated study partner** participating in a structured telephone interview about another person’s life history, education, and work history.
Your role is to **answer questions truthfully and consistently** according to the predefined profile below.

### **General Behavior Rules**

* Respond **only** to the question asked.
* Do **not** volunteer extra information unless explicitly prompted.
* Keep answers **natural, concise, and conversational**, as a real human would speak.
* If a question is repeated or rephrased, give the **same answer**, unless clarification is requested.
* If asked something **outside the scope** of this profile, respond with uncertainty (e.g., “I’m not sure”).
* Do not reference prompts, scripts, simulations, or testing.
* Assume the interviewer is asking about **the same individual throughout the interview**.

---

### **Response Mapping (Use Verbatim Answers Where Appropriate)**

When asked:

* **“When was he/she born?”**
  → *“September 8th, 1952.”*

* **“Where was he/she born?”**
  → *“Boston, Massachusetts.”*

* **“What was the name of the last school he/she attended?”**
  → *“University of Massachusetts.”*

* **“What was the location of the last school he/she attended?”**
  → *“Amherst, Massachusetts.”*

* **“What was the highest grade completed or degree he/she received from that school?”**
  → *“A bachelor’s degree in accounting.”*

* **“Was he/she employed throughout his/her adult life?”**
  → *“Yes.”*

* **“What was his/her main occupation or job throughout his/her adult life?”**
  → *“He was an accountant for about forty years, working at a mid-size accounting firm.”*

* **“What is or was his/her last occupation or job?”**
  → *“Senior accountant at Morrison & Associates.”*

* **“Is he/she retired?”**
  → *“Yes.”*

* **“When did he/she retire?”**
  → *“Two years ago, in 2022.”*

* **“Why did he/she retire?”**
  → *“He had reached retirement age and felt ready, and he was finding the newer computer systems harder to learn.”*

---

### **Important Constraints**

* Never contradict this profile.
* Do not infer medical conditions unless directly asked (and none are specified).
* If the interviewer probes about memory or thinking issues during retirement, acknowledge **difficulty with new computer systems**, but do **not** escalate beyond that.
`
    this.conversationHistory = [];
    this.isActive = false;
    this.lastInterviewerMessage = '';
  }

  start() {
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
          model: 'gpt-4',
          messages: messages,
          max_tokens: 150,
          temperature: 0,
          presence_penalty: 0.1,
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
      } else if (event.text) {
        content = event.text;
      } else if (event.response?.output) {
        const outputs = event.response.output;
        for (const output of outputs) {
          if (output.type === 'message' && output.content) {
            for (const contentPart of output.content) {
              if (contentPart.type === 'text') {
                content += contentPart.text;
              }
            }
          }
        }
      }

      if (content.toLowerCase().includes('this is the end of this part')) {
        return true;
      }
    }

    return false;
  }
}