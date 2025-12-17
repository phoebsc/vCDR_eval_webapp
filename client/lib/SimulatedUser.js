/**
 * Simulated User Agent for Automated Benchmarking
 *
 * This class simulates a job candidate responding to interview questions.
 * It uses a predefined system prompt and can generate both expected and
 * off-topic responses to test the interviewer's handling capabilities.
 */

export class SimulatedUser {
  constructor() {
    this.systemPrompt = `You are a job candidate being interviewed. Your background:
- Software engineer with 3 years experience
- Worked at tech startups on web applications
- Interested in AI/ML and full-stack development
- Enthusiastic but sometimes gets carried away with tangents

Respond naturally to interview questions. Occasionally (20% of the time) provide off-topic or unexpected responses to test the interviewer's handling, such as:
- Going into excessive technical detail
- Asking questions back to the interviewer
- Mentioning unrelated personal interests
- Being overly brief or evasive

Keep responses conversational and realistic. Vary your response length and style.`;

    this.responses = [
      // Responses for "Tell me about yourself"
      [
        "I'm a software engineer with about 3 years of experience, mostly working at startups building web applications. I got into programming in college and really fell in love with the problem-solving aspect of it.",
        "Well, I've been coding for 3 years now, started right after college. I work mainly on full-stack development, you know, React, Node.js, that kind of stuff. Oh, and I have this hobby where I collect vintage keyboards - did you know some mechanical keyboards from the 80s are worth thousands now?",
        "Software engineer, 3 years experience. Next question?"
      ],

      // Responses for "What interests you most about this field?"
      [
        "I'm really excited about AI and machine learning integration in web applications. The way we can now build more intelligent, responsive user experiences is incredible.",
        "Honestly, what gets me most excited is how fast everything changes. Like, just this year we've seen so many developments in AI... Actually, what's your company's stance on using AI tools in development?",
        "The constant learning. There's always something new to figure out."
      ],

      // Responses for "Describe a challenging project"
      [
        "Last year I worked on a real-time collaboration platform, kind of like Google Docs but for code. The biggest challenge was handling concurrent edits without conflicts. We ended up implementing operational transforms, which was complex but really satisfying when it worked.",
        "Oh boy, where do I start? We had this project where the database was completely denormalized, and I spent weeks trying to optimize these queries that were taking like 30 seconds each. I rewrote the entire schema, added proper indexing... Actually, have you ever worked with PostgreSQL's EXPLAIN ANALYZE? It's fascinating how you can see exactly where the bottlenecks are...",
        "Built a chat app. It was hard. Used WebSockets."
      ],

      // Responses for "Where do you see yourself in 5 years?"
      [
        "I'd love to be leading a small team, working on products that really make a difference. Maybe something in the intersection of AI and accessibility - I think there's huge potential there to help people.",
        "Definitely want to grow into more senior roles, maybe tech lead or engineering manager. Though honestly, I'm also considering starting my own company someday. I have this idea for an app that helps people find lost pets using computer vision - do you think that's a viable market?",
        "Senior engineer, I guess. Maybe management."
      ],

      // Responses for "Do you have any questions for me?"
      [
        "Yes, what does a typical day look like for someone in this role? And what are the biggest technical challenges the team is currently facing?",
        "Actually, I'm curious - what's the company culture like? Do you do pair programming? Also, random question, but what's the coffee situation like here? I'm kind of a coffee snob.",
        "Not really, no."
      ]
    ];

    this.currentQuestionIndex = 0;
    this.isActive = false;
  }

  start() {
    this.isActive = true;
    this.currentQuestionIndex = 0;
  }

  stop() {
    this.isActive = false;
  }

  reset() {
    this.currentQuestionIndex = 0;
    this.isActive = false;
  }

  /**
   * Generate a response to the current interview question
   * @returns {string} The simulated user's response
   */
  generateResponse() {
    console.log('[SimulatedUser] generateResponse called');
    console.log('[SimulatedUser] isActive:', this.isActive);
    console.log('[SimulatedUser] currentQuestionIndex:', this.currentQuestionIndex);
    console.log('[SimulatedUser] responses.length:', this.responses.length);

    if (!this.isActive || this.currentQuestionIndex >= this.responses.length) {
      console.log('[SimulatedUser] Cannot generate response - inactive or no more questions');
      return null;
    }

    const responseOptions = this.responses[this.currentQuestionIndex];
    const randomIndex = Math.floor(Math.random() * responseOptions.length);
    const response = responseOptions[randomIndex];

    console.log('[SimulatedUser] Selected response option', randomIndex, 'of', responseOptions.length, ':', response);

    this.currentQuestionIndex++;
    return response;
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
    const latestEvents = events.slice(0, 1); // Check last 1 events
    console.log('[SimulatedUser] Checking latest events:', latestEvents.map(e => e.type));

    for (const event of latestEvents) {
      console.log('[SimulatedUser] Processing event:', event.type, event);

      if (event.type === 'response.audio_transcript.done' ||
          event.type === 'response.text.done' ||
          event.type === 'response.audio_transcript.delta' ||
          event.type === 'response.text.delta' ||
          event.type === 'response.output_item.done' ||
          (event.type === 'response.done' && event.response?.output)) {

        // Extract text content from the event
        let content = '';
        if (event.transcript) {
          content = event.transcript;
          console.log('[SimulatedUser] Found transcript content:', content);
        } else if (event.text) {
          content = event.text;
          console.log('[SimulatedUser] Found text content:', content);
        } else if (event.delta) {
          content = event.delta;
          console.log('[SimulatedUser] Found delta content:', content);
        } else if (event.item && event.item.content) {
          // Handle output item events
          for (const contentPart of event.item.content) {
            if (contentPart.type === 'text') {
              content += contentPart.text || '';
            }
          }
          console.log('[SimulatedUser] Found item content:', content);
        } else if (event.response?.output) {
          // Handle structured response output
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
          console.log('[SimulatedUser] Found structured content:', content);
        }

        // if (content.trim()) {
        //   console.log('[SimulatedUser] Analyzing content for response triggers:', content);

        //   // Check if it's a question or if it contains interview-related keywords
        //   const hasQuestion = content.includes('?');
        //   const hasTellMe = content.toLowerCase().includes('tell me');
        //   const hasDescribe = content.toLowerCase().includes('describe');
        //   const hasWhat = content.toLowerCase().includes('what');
        //   const hasWhere = content.toLowerCase().includes('where');
        //   const hasHow = content.toLowerCase().includes('how');

        //   console.log('[SimulatedUser] Content analysis:', {
        //     hasQuestion, hasTellMe, hasDescribe, hasWhat, hasWhere, hasHow
        //   });

        //   if (hasQuestion || hasTellMe || hasDescribe || hasWhat || hasWhere || hasHow) {
        //     console.log('[SimulatedUser] Should respond: TRUE');
        //     return true;
        //   }
        // }
      }
    }

    console.log('[SimulatedUser] always responds');
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