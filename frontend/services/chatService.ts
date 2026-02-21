import Constants from 'expo-constants';
import { DEMO_TRANSACTIONS, CalendarPrediction } from './backendApi';

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

interface UserFinancialContext {
  predictions?: CalendarPrediction[];
  runwayMonths?: number;
  weeklySpending?: number;
  userName?: string;
}

// Build dynamic system prompt based on user data
const buildSystemPrompt = (context?: UserFinancialContext): string => {
  const { summary, transactions } = DEMO_TRANSACTIONS;

  // Calculate spending by category
  const categorySpending: { [key: string]: number } = {};
  transactions.forEach(t => {
    if (t.amount < 0) {
      const cat = t.category;
      categorySpending[cat] = (categorySpending[cat] || 0) + Math.abs(t.amount);
    }
  });

  // Format top categories
  const topCats = Object.entries(categorySpending)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat, amount]) => `${cat} (€${amount.toFixed(0)})`)
    .join(', ');

  // Calculate runway
  const monthlyBurn = summary.avgDaily * 30;
  const runwayMonths = context?.runwayMonths || (summary.savings / monthlyBurn);

  // Build predictions text
  let predictionsText = 'Today\'s predictions: Likely spending on groceries, dining, and coffee.';
  if (context?.predictions && context.predictions.length > 0) {
    const todayPreds = context.predictions[0]?.predictions?.slice(0, 4) || [];
    if (todayPreds.length > 0) {
      predictionsText = 'Today\'s predictions: ' + todayPreds.map(p =>
        `${Math.round(p.probability * 100)}% ${p.category} (€${p.amount.toFixed(0)})`
      ).join(', ');
    }
  }

  const userName = context?.userName || 'there';

  return `You are "The Prophit" - a friendly, witty AI financial assistant in a personal spending prediction app. Your personality:

- Warm and approachable, like a knowledgeable friend who's good with money
- Use light humor when appropriate, but stay helpful
- Give concise, actionable advice
- Reference the user's spending patterns and predictions when relevant
- Location context: Dublin, Ireland
- Currency: Always use Euros (€)
- Keep responses brief (2-3 sentences for simple questions, up to a paragraph for complex ones)
- NEVER use emojis in your responses

The user's name is ${userName}.

You have access to the user's spending data:
- ${predictionsText}
- Total recent spending: €${summary.totalSpent.toFixed(0)}
- Average daily spending: €${summary.avgDaily.toFixed(2)}
- Monthly income: €${summary.monthlyIncome.toLocaleString()}
- Current savings: €${summary.savings.toLocaleString()}
- Top spending categories: ${topCats}
- Job quit runway: ${runwayMonths.toFixed(1)} months with current savings
- The user tends to spend more on Fridays

Help users understand their finances, make better decisions, and feel empowered about their money.`;
};

class ChatService {
  private apiKey: string | null = null;
  private conversationHistory: ChatMessage[] = [];
  private userContext: UserFinancialContext = {};

  constructor() {
    // Get Groq API key from environment
    this.apiKey = Constants.expoConfig?.extra?.GROQ_API_KEY ||
                  process.env.EXPO_PUBLIC_GROQ_API_KEY ||
                  null;

    // Initialize with system prompt
    this.conversationHistory = [
      { role: 'system', content: buildSystemPrompt() }
    ];
  }

  /**
   * Update user context and refresh system prompt
   */
  updateContext(context: Partial<UserFinancialContext>): void {
    this.userContext = { ...this.userContext, ...context };
    // Update the system prompt with new context
    if (this.conversationHistory.length > 0) {
      this.conversationHistory[0] = {
        role: 'system',
        content: buildSystemPrompt(this.userContext)
      };
    }
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
    const { summary } = DEMO_TRANSACTIONS;
    const monthlySpend = Math.round(summary.avgDaily * 30);
    const runwayMonths = (summary.savings / monthlySpend).toFixed(1);

    if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
      return "Hey there, I'm the Prophit, your personal spending oracle. Looking at your patterns, you've got some spending predictions lined up for today. What's on your mind?";
    }

    if (lowerMessage.includes('spend') || lowerMessage.includes('budget')) {
      return `Looking at your patterns, you're averaging about €${monthlySpend}/month with daily spending around €${summary.avgDaily.toFixed(0)}. Your top categories are ${summary.topCategories.join(', ')}. Want me to break down where you can save?`;
    }

    if (lowerMessage.includes('save') || lowerMessage.includes('saving')) {
      return `Based on your data, cutting dining out by 50% could save you around €95/month - that's over €1,100/year. Your scenario simulator shows you'd extend your job-quit runway significantly. Worth considering.`;
    }

    if (lowerMessage.includes('quit') || lowerMessage.includes('job') || lowerMessage.includes('runway')) {
      return `Your current runway is ${runwayMonths} months if you quit today. With your €${monthlySpend}/month spend rate and €${summary.savings.toLocaleString()} savings, that's decent coverage. Want to explore what happens if you cut some expenses?`;
    }

    if (lowerMessage.includes('friday') || lowerMessage.includes('weekend')) {
      return "Ah yes, Fridays - your spending kryptonite. You tend to spend more on Fridays, usually on after-work drinks and dining. Maybe set a spending limit before heading out?";
    }

    if (lowerMessage.includes('lunch') || lowerMessage.includes('food') || lowerMessage.includes('eat')) {
      return `Your food spending is one of your bigger categories. Dining out typically runs €12-15 per meal. That's pretty reasonable for Dublin, but those coffee runs add up too.`;
    }

    if (lowerMessage.includes('weather') || lowerMessage.includes('rain') || lowerMessage.includes('uber')) {
      return "It's 12°C in Dublin with clouds rolling in. Transport costs can spike when it rains - maybe check the forecast and leave a bit early to avoid surge pricing.";
    }

    if (lowerMessage.includes('month') || lowerMessage.includes('doing')) {
      return `You've spent €${summary.totalSpent.toFixed(0)} recently. Your biggest categories are ${summary.topCategories.slice(0, 2).join(' and ')}. You're tracking close to your monthly average of €${monthlySpend}. Not bad at all.`;
    }

    return `Great question. Based on your spending patterns, you're doing reasonably well. Your runway is solid at ${runwayMonths} months, and you've got a good handle on your €${monthlySpend}/month average. Anything specific you'd like to dive into?`;
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [
      { role: 'system', content: buildSystemPrompt(this.userContext) }
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
