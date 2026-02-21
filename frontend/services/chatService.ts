import Constants from 'expo-constants';

// Groq API configuration (OpenAI-compatible)
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionResponse {
  id: string;
  choices: {
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
}

// System prompt for the Prophit AI
const PROPHIT_SYSTEM_PROMPT = `You are "The Prophit" - a friendly, witty AI financial assistant in a personal spending prediction app. Your personality:

- Warm and approachable, like a knowledgeable friend who's good with money
- Use light humor when appropriate, but stay helpful
- Give concise, actionable advice
- Reference the user's spending patterns and predictions when relevant
- Location context: Dublin, Ireland
- Currency: Always use Euros (€)
- Keep responses brief (2-3 sentences for simple questions, up to a paragraph for complex ones)
- NEVER use emojis in your responses

You have access to the user's spending data:
- Current spending predictions: 80% chance of lunch out (€12-15), 50% coffee (€4-5), 46% after-work drinks (€18-25), 20% Uber due to rain (€12-18)
- Weekly spending: €512 actual vs €485 predicted
- Monthly average: ~€2,100
- Top categories: Food & Dining (€145/week), Bills (€210/week), Shopping (€124/week)
- Job quit runway: 8.5 months with current savings
- The user tends to spend more on Fridays

Help users understand their finances, make better decisions, and feel empowered about their money.`;

class ChatService {
  private apiKey: string | null = null;
  private conversationHistory: ChatMessage[] = [];

  constructor() {
    // Get Groq API key from environment
    this.apiKey = Constants.expoConfig?.extra?.GROQ_API_KEY ||
                  process.env.EXPO_PUBLIC_GROQ_API_KEY ||
                  null;

    // Initialize with system prompt
    this.conversationHistory = [
      { role: 'system', content: PROPHIT_SYSTEM_PROMPT }
    ];
  }

  /**
   * Set the API key manually
   */
  setApiKey(key: string): void {
    this.apiKey = key;
  }

  /**
   * Check if the service is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Send a message and get a response
   */
  async sendMessage(userMessage: string): Promise<string> {
    if (!this.apiKey) {
      // Return a mock response if no API key
      return this.getMockResponse(userMessage);
    }

    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: this.conversationHistory,
          max_tokens: 300,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Groq API error:', errorText);
        throw new Error(`API error: ${response.status}`);
      }

      const data: ChatCompletionResponse = await response.json();
      const assistantMessage = data.choices[0]?.message?.content || 'I apologize, but I couldn\'t generate a response. Please try again.';

      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: assistantMessage,
      });

      // Keep conversation history manageable (last 20 messages + system prompt)
      if (this.conversationHistory.length > 21) {
        this.conversationHistory = [
          this.conversationHistory[0], // Keep system prompt
          ...this.conversationHistory.slice(-20),
        ];
      }

      return assistantMessage;
    } catch (error) {
      console.error('Chat error:', error);
      // Remove the user message if we failed
      this.conversationHistory.pop();
      throw error;
    }
  }

  /**
   * Get a mock response when no API key is configured
   */
  private getMockResponse(userMessage: string): string {
    const lowerMessage = userMessage.toLowerCase();

    if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
      return "Hey there, I'm the Prophit, your personal spending oracle. I can see you've got an 80% chance of lunch out today. What's on your mind?";
    }

    if (lowerMessage.includes('spend') || lowerMessage.includes('budget')) {
      return "Looking at your patterns, you're averaging about €2,100/month. This week you're at €512 vs the €485 I predicted - those unexpected Uber rides from the rain added up. Want me to break down where you can save?";
    }

    if (lowerMessage.includes('save') || lowerMessage.includes('saving')) {
      return "Based on your data, cutting eating out by 50% could save you €160/month - that's €1,920/year. Your scenario simulator shows you'd extend your job-quit runway by almost 2 months. Worth considering.";
    }

    if (lowerMessage.includes('quit') || lowerMessage.includes('job') || lowerMessage.includes('runway')) {
      return "Your current runway is 8.5 months if you quit today. With your €2,100/month spend rate and current savings, that's actually pretty solid. Want to explore what happens if you cut some expenses?";
    }

    if (lowerMessage.includes('friday') || lowerMessage.includes('weekend')) {
      return "Ah yes, Fridays - your spending kryptonite. You tend to spend 30% more on Fridays, usually on after-work drinks and dining. Today's prediction shows 46% chance of drinks. Maybe set a €25 limit?";
    }

    if (lowerMessage.includes('lunch') || lowerMessage.includes('food') || lowerMessage.includes('eat')) {
      return "I'm seeing an 80% chance you'll grab lunch out today - you usually spend €12-15. Your food & dining is €145/week, which is about 7% of your monthly spend. That's pretty reasonable for Dublin.";
    }

    if (lowerMessage.includes('weather') || lowerMessage.includes('rain') || lowerMessage.includes('uber')) {
      return "It's 12°C in Dublin with clouds rolling in. I've flagged a 20% chance you'll need an Uber (€12-18) if it rains. Pro tip: the rain usually hits around 4pm - maybe leave a bit early.";
    }

    if (lowerMessage.includes('month') || lowerMessage.includes('doing')) {
      return "You've spent €847 so far this month, which is 15% less than this time last month. Your biggest category is food at €320. You're on track to come in under your monthly average of €2,100. Nice work.";
    }

    return "Great question. Based on your spending patterns and predictions, I'd say you're doing pretty well overall. Your runway is solid at 8.5 months, and you've got a good handle on your €2,100/month average. Anything specific you'd like to dive into?";
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [
      { role: 'system', content: PROPHIT_SYSTEM_PROMPT }
    ];
  }

  /**
   * Get conversation history (excluding system prompt)
   */
  getHistory(): ChatMessage[] {
    return this.conversationHistory.slice(1);
  }
}

// Export singleton instance
export const chatService = new ChatService();
export default chatService;
