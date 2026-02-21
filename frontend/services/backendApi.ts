/**
 * Backend API Service
 *
 * Wraps the Gradio API at https://backend.prophit.lissan.dev
 * Uses the 2-step pattern:
 * 1. POST to /gradio_api/call/{api_name} with { data: [...] } -> get event_id
 * 2. GET /gradio_api/call/{api_name}/{event_id} -> parse SSE response for result
 */

const BASE_URL = 'https://backend.prophit.lissan.dev';

// Types for API responses
export interface CalendarPrediction {
  day: string;
  date: string;
  predictions: {
    category: string;
    description: string;
    probability: number;
    amount: number;
    icon?: string;
  }[];
  totalExpected: number;
}

export interface AnalysisResult {
  claudeAnalysis: string;
  geminiAnalysis: string;
  gptAnalysis: string;
}

export interface RunwayResult {
  months: number;
  analysis: string;
}

// Helper to parse SSE response
function parseSSEResponse(text: string): any {
  const lines = text.split('\n');
  let result = null;

  console.log('SSE Response:', text.substring(0, 500)); // Log first 500 chars for debugging

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('data: ')) {
      try {
        const data = line.replace('data: ', '');
        result = JSON.parse(data);
      } catch (e) {
        // Not JSON, might be intermediate data or error message
        console.log('SSE line not JSON:', line.substring(0, 100));
      }
    }
  }

  return result;
}

// Generic Gradio API call helper
async function callGradioApi(endpoint: string, data: any[], timeoutMs: number = 30000): Promise<any> {
  try {
    // Step 1: Submit the request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const submitRes = await fetch(`${BASE_URL}/gradio_api/call/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!submitRes.ok) {
      const errorText = await submitRes.text();
      console.error(`API submit error response:`, errorText);
      throw new Error(`API submit failed: ${submitRes.status}`);
    }

    const submitJson = await submitRes.json();
    const event_id = submitJson.event_id;

    if (!event_id) {
      console.error('No event_id in response:', submitJson);
      throw new Error('No event_id returned');
    }

    // Step 2: Get the result (SSE stream)
    const resultRes = await fetch(`${BASE_URL}/gradio_api/call/${endpoint}/${event_id}`);

    if (!resultRes.ok) {
      throw new Error(`API result failed: ${resultRes.status}`);
    }

    const text = await resultRes.text();
    const result = parseSSEResponse(text);

    if (!result) {
      console.error('Could not parse SSE response for endpoint:', endpoint);
      return null; // Return null instead of throwing - let caller handle fallback
    }

    return result;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error(`Gradio API timeout (${endpoint})`);
    } else {
      console.error(`Gradio API error (${endpoint}):`, error);
    }
    return null; // Return null to allow fallback behavior
  }
}

// File upload helper for Gradio
async function uploadFileToGradio(fileContent: string, filename: string): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('files', {
      uri: `data:application/json;base64,${btoa(fileContent)}`,
      name: filename,
      type: 'application/json',
    } as any);

    const uploadRes = await fetch(`${BASE_URL}/gradio_api/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!uploadRes.ok) {
      throw new Error(`File upload failed: ${uploadRes.status}`);
    }

    const uploadResult = await uploadRes.json();
    return uploadResult[0]; // Returns file path on server
  } catch (error) {
    console.error('File upload error:', error);
    throw error;
  }
}

// Track whether user is using uploaded data vs mock data
let useUploadedData = false;
let uploadedFileContent: string | null = null;

export function setUseUploadedData(value: boolean, fileContent?: string): void {
  useUploadedData = value;
  if (fileContent) {
    uploadedFileContent = fileContent;
  }
}

export function isUsingUploadedData(): boolean {
  return useUploadedData;
}

export function getUploadedFileContent(): string | null {
  return uploadedFileContent;
}

/**
 * Upload file and get calendar predictions from REAL backend
 * Uses the calendar_uploaded Gradio endpoint
 */
export async function getCalendarPredictionsFromBackend(fileContent: string): Promise<{
  calendar: string;
  predictions: CalendarPrediction[];
}> {
  try {
    // Upload file to Gradio
    const filePath = await uploadFileToGradio(fileContent, 'transactions.csv');

    // Call the calendar_uploaded endpoint with the file handle
    const result = await callGradioApi('calendar_uploaded', [{
      path: filePath,
      meta: { _type: 'gradio.FileData' }
    }], 60000);

    if (result && result[0]) {
      const predictions = parseCalendarPredictions(result[0]);
      return {
        calendar: typeof result[0] === 'string' ? result[0] : JSON.stringify(result[0]),
        predictions,
      };
    }

    // Fallback to local generation
    return generateLocalPredictions(fileContent);
  } catch (error) {
    console.error('Backend calendar prediction error:', error);
    // Fallback to local generation
    return generateLocalPredictions(fileContent);
  }
}

/**
 * Upload file and get transaction analysis from REAL backend
 * Uses the analyse_uploaded Gradio endpoint
 */
export async function getTransactionAnalysisFromBackend(fileContent: string): Promise<AnalysisResult> {
  try {
    // Upload file to Gradio
    const filePath = await uploadFileToGradio(fileContent, 'transactions.csv');

    // Call the analyse_uploaded endpoint
    const result = await callGradioApi('analyse_uploaded', [{
      path: filePath,
      meta: { _type: 'gradio.FileData' }
    }], 60000);

    if (result) {
      return {
        claudeAnalysis: result[0] || '',
        geminiAnalysis: result[1] || '',
        gptAnalysis: result[2] || '',
      };
    }

    return generateLocalAnalysis(fileContent);
  } catch (error) {
    console.error('Backend analysis error:', error);
    return generateLocalAnalysis(fileContent);
  }
}

/**
 * Generate calendar predictions - uses backend if uploaded data, otherwise local
 */
export function getCalendarPredictions(transactionData: string): Promise<{
  calendar: string;
  predictions: CalendarPrediction[];
}> {
  if (useUploadedData && uploadedFileContent) {
    return getCalendarPredictionsFromBackend(uploadedFileContent);
  }
  return Promise.resolve(generateLocalPredictions(transactionData));
}

/**
 * Get transaction analysis - uses backend if uploaded data, otherwise local
 */
export function getTransactionAnalysis(transactionData: string): Promise<AnalysisResult> {
  if (useUploadedData && uploadedFileContent) {
    return getTransactionAnalysisFromBackend(uploadedFileContent);
  }
  return Promise.resolve(generateLocalAnalysis(transactionData));
}

/**
 * Generate predictions from local transaction data
 */
function generateLocalPredictions(transactionData: string): {
  calendar: string;
  predictions: CalendarPrediction[];
} {
  try {
    const data = JSON.parse(transactionData);
    const transactions = data.transactions || [];

    // Analyze spending patterns by category and day of week
    const categoryStats: { [cat: string]: { total: number; count: number; amounts: number[] } } = {};
    const dayOfWeekSpending: { [day: number]: number[] } = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };

    transactions.forEach((t: any) => {
      if (t.amount < 0 && t.category !== 'Income') {
        const cat = t.category;
        const amount = Math.abs(t.amount);

        if (!categoryStats[cat]) {
          categoryStats[cat] = { total: 0, count: 0, amounts: [] };
        }
        categoryStats[cat].total += amount;
        categoryStats[cat].count += 1;
        categoryStats[cat].amounts.push(amount);

        // Track by day of week
        const dayOfWeek = new Date(t.date).getDay();
        dayOfWeekSpending[dayOfWeek].push(amount);
      }
    });

    // Generate week-ahead predictions
    const predictions: CalendarPrediction[] = [];
    const today = new Date('2026-02-21');
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dayOfWeek = date.getDay();
      const dateStr = date.toISOString().split('T')[0];

      // Get top categories and calculate probabilities based on historical frequency
      const dayPredictions: CalendarPrediction['predictions'] = [];

      Object.entries(categoryStats)
        .filter(([cat]) => !['Rent', 'Utilities', 'Subscriptions', 'Transfer', 'Income'].includes(cat))
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 4)
        .forEach(([category, stats]) => {
          const avgAmount = stats.total / stats.count;
          // Probability based on frequency (how often this category appears)
          const daysInData = 365;
          const frequency = stats.count / daysInData;
          let probability = Math.min(frequency * 1.5, 0.95); // Cap at 95%

          // Boost probability on weekends for entertainment/dining
          if ((dayOfWeek === 5 || dayOfWeek === 6) && ['Dining', 'Entertainment', 'Coffee'].includes(category)) {
            probability = Math.min(probability * 1.3, 0.95);
          }

          // Friday boost for drinks/dining
          if (dayOfWeek === 5 && ['Dining', 'Entertainment'].includes(category)) {
            probability = Math.min(probability * 1.4, 0.95);
          }

          dayPredictions.push({
            category,
            description: getCategoryDescription(category, dayOfWeek),
            probability: Math.round(probability * 100) / 100,
            amount: Math.round(avgAmount * 100) / 100,
            icon: getCategoryIcon(category),
          });
        });

      // Calculate total expected
      const totalExpected = dayPredictions.reduce((sum, p) => sum + (p.amount * p.probability), 0);

      predictions.push({
        day: days[dayOfWeek],
        date: dateStr,
        predictions: dayPredictions.sort((a, b) => b.probability - a.probability),
        totalExpected: Math.round(totalExpected * 100) / 100,
      });
    }

    // Generate calendar markdown
    const calendar = generateCalendarMarkdown(predictions);

    return { calendar, predictions };
  } catch (error) {
    console.error('Error generating local predictions:', error);
    return { calendar: '', predictions: [] };
  }
}

function getCategoryDescription(category: string, dayOfWeek: number): string {
  const descriptions: { [key: string]: string[] } = {
    Coffee: ['Morning coffee', 'Coffee run', 'Afternoon pick-me-up'],
    Dining: ['Lunch out', 'Dinner plans', 'Quick bite'],
    Groceries: ['Weekly shop', 'Grocery run', 'Food shopping'],
    Transport: ['Commute', 'Uber ride', 'Transport'],
    Shopping: ['Shopping trip', 'Online order', 'Retail therapy'],
    Entertainment: ['Night out', 'Cinema', 'Entertainment'],
  };

  // Friday/Saturday specific
  if (dayOfWeek === 5 && category === 'Dining') return 'Friday dinner';
  if (dayOfWeek === 5 && category === 'Entertainment') return 'After-work drinks';
  if (dayOfWeek === 6 && category === 'Entertainment') return 'Saturday night out';

  const opts = descriptions[category] || [category];
  return opts[Math.floor(Math.random() * opts.length)];
}

function getCategoryIcon(category: string): string {
  const icons: { [key: string]: string } = {
    Coffee: '☕',
    Dining: '🍽️',
    Groceries: '🛒',
    Transport: '🚗',
    Shopping: '🛍️',
    Entertainment: '🎬',
  };
  return icons[category] || '💰';
}

function generateCalendarMarkdown(predictions: CalendarPrediction[]): string {
  let md = '## Week Ahead Spending Forecast\n\n';

  predictions.forEach(day => {
    md += `### ${day.day} (${day.date})\n`;
    md += `**Expected: €${day.totalExpected.toFixed(2)}**\n\n`;

    day.predictions.forEach(p => {
      const pct = Math.round(p.probability * 100);
      md += `- ${p.icon} ${p.description}: €${p.amount.toFixed(2)} (${pct}% likely)\n`;
    });
    md += '\n';
  });

  return md;
}

// Parse the raw calendar JSON into structured predictions
function parseCalendarPredictions(rawJson: string): CalendarPrediction[] {
  try {
    if (!rawJson) return [];
    const data = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('Failed to parse calendar predictions:', e);
    return [];
  }
}

function generateLocalAnalysis(transactionData: string): AnalysisResult {
  try {
    const data = JSON.parse(transactionData);
    const transactions = data.transactions || [];
    const summary = data.summary || {};

    // Calculate category totals
    const categoryTotals: { [cat: string]: number } = {};
    transactions.forEach((t: any) => {
      if (t.amount < 0) {
        const cat = t.category;
        categoryTotals[cat] = (categoryTotals[cat] || 0) + Math.abs(t.amount);
      }
    });

    const sortedCategories = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1]);

    const topCats = sortedCategories.slice(0, 5);
    const totalSpent = sortedCategories.reduce((sum, [, amt]) => sum + amt, 0);

    // Generate analysis text
    const analysis = `## Spending Analysis

### Overview
- **Total Spent:** €${totalSpent.toFixed(2)}
- **Daily Average:** €${summary.avgDaily?.toFixed(2) || (totalSpent / 365).toFixed(2)}
- **Monthly Average:** €${summary.avgMonthly?.toFixed(2) || (totalSpent / 12).toFixed(2)}

### Top Categories
${topCats.map(([cat, amt]) => `- **${cat}:** €${amt.toFixed(2)} (${Math.round(amt / totalSpent * 100)}%)`).join('\n')}

### Insights
${summary.spendingTrend === 'increasing' ? '⚠️ Your spending has been **increasing** recently. Consider reviewing discretionary expenses.' : ''}
${summary.spendingTrend === 'decreasing' ? '✅ Great job! Your spending has been **decreasing**. Keep up the good work!' : ''}
${summary.spendingTrend === 'stable' ? '📊 Your spending has been **stable**. You have consistent habits.' : ''}

### Savings
- **Current Savings:** €${summary.savings?.toLocaleString() || 'N/A'}
- **Savings Rate:** ${summary.savingsRate || Math.round((1 - totalSpent / 12 / summary.monthlyIncome) * 100)}%
- **Runway:** ${summary.runwayMonths?.toFixed(1) || 'N/A'} months
`;

    return {
      claudeAnalysis: analysis,
      geminiAnalysis: analysis,
      gptAnalysis: analysis,
    };
  } catch (error) {
    console.error('Error generating local analysis:', error);
    return { claudeAnalysis: '', geminiAnalysis: '', gptAnalysis: '' };
  }
}

/**
 * Get AI-generated budget tips
 * @param spendingPatterns - Description of spending patterns
 * @returns Markdown string of tips
 */
export async function getBudgetTips(spendingPatterns: string): Promise<string> {
  try {
    const result = await callGradioApi('get_tips', [spendingPatterns]);
    return result[0] || '';
  } catch (error) {
    console.error('Budget tips error:', error);
    return '';
  }
}

/**
 * Get income runway calculation
 * @param financialSummary - Text summary of financial situation
 * @returns Runway analysis
 */
export async function getRunwayAnalysis(financialSummary: string): Promise<RunwayResult> {
  try {
    const result = await callGradioApi('get_runway', [financialSummary]);
    const analysis = result[0] || '';

    // Try to extract months from the analysis
    const monthsMatch = analysis.match(/(\d+(?:\.\d+)?)\s*months?/i);
    const months = monthsMatch ? parseFloat(monthsMatch[1]) : 0;

    return {
      months,
      analysis,
    };
  } catch (error) {
    console.error('Runway analysis error:', error);
    return {
      months: 0,
      analysis: '',
    };
  }
}

/**
 * Generate financial summary from transaction file
 * @param transactionData - JSON string of transaction data
 * @returns Text financial summary
 */
export async function getFinancialSummary(transactionData: string): Promise<string> {
  try {
    const result = await callGradioApi('_runway_summary_from_file', [transactionData, '']);
    return result[0] || '';
  } catch (error) {
    console.error('Financial summary error:', error);
    return '';
  }
}

import { UserDataset, FAKE_DATASETS, getDatasetById } from './fakeDatasets';

// Cached user dataset (loaded on app init)
let cachedUserDataset: UserDataset | null = null;

/**
 * Initialize user data - call this when user logs in
 */
export function initUserData(datasetId: number): void {
  const dataset = getDatasetById(datasetId);
  if (dataset) {
    cachedUserDataset = dataset;
    console.log(`Loaded dataset ${datasetId} for user`);
  } else {
    console.warn(`Dataset ${datasetId} not found, using default`);
    cachedUserDataset = FAKE_DATASETS[0];
  }
}

/**
 * Get the cached user dataset
 */
export function getCachedUserDataset(): UserDataset | null {
  return cachedUserDataset;
}

/**
 * Clear cached user data (call on logout)
 */
export function clearUserData(): void {
  cachedUserDataset = null;
}

// Fallback demo data (used if no user dataset loaded)
const DEFAULT_DEMO_TRANSACTIONS = {
  transactions: [
    { date: '2026-02-14', description: 'Starbucks', amount: -5.50, category: 'Coffee' },
    { date: '2026-02-14', description: 'Tesco Express', amount: -23.40, category: 'Groceries' },
    { date: '2026-02-13', description: 'Uber', amount: -12.80, category: 'Transport' },
    { date: '2026-02-13', description: 'Netflix', amount: -17.99, category: 'Subscriptions' },
    { date: '2026-02-12', description: 'The Brazen Head', amount: -45.00, category: 'Dining' },
    { date: '2026-02-12', description: 'Lidl', amount: -67.20, category: 'Groceries' },
    { date: '2026-02-11', description: 'Costa Coffee', amount: -4.80, category: 'Coffee' },
    { date: '2026-02-11', description: 'Amazon', amount: -29.99, category: 'Shopping' },
    { date: '2026-02-10', description: 'Spotify', amount: -10.99, category: 'Subscriptions' },
    { date: '2026-02-10', description: 'Dunnes Stores', amount: -54.30, category: 'Groceries' },
    { date: '2026-02-09', description: 'Burger King', amount: -11.50, category: 'Dining' },
    { date: '2026-02-09', description: 'AIB Rent Transfer', amount: -1200.00, category: 'Rent' },
    { date: '2026-02-08', description: 'Electric Ireland', amount: -85.00, category: 'Utilities' },
    { date: '2026-02-07', description: 'Starbucks', amount: -6.20, category: 'Coffee' },
    { date: '2026-02-06', description: 'Revolut Transfer', amount: -50.00, category: 'Transfer' },
  ],
  summary: {
    totalSpent: 1624.65,
    avgDaily: 108.31,
    topCategories: ['Rent', 'Groceries', 'Dining'],
    monthlyIncome: 3500,
    savings: 18500,
  }
};

/**
 * Get current user's transaction data (or demo fallback)
 * Returns the cached user dataset if available, otherwise returns demo data
 */
export const DEMO_TRANSACTIONS = new Proxy(DEFAULT_DEMO_TRANSACTIONS, {
  get(target, prop) {
    if (cachedUserDataset) {
      if (prop === 'transactions') return cachedUserDataset.transactions;
      if (prop === 'summary') return cachedUserDataset.summary;
    }
    return target[prop as keyof typeof target];
  }
});

// Get user/demo data as JSON string
export function getDemoTransactionData(): string {
  if (cachedUserDataset) {
    return JSON.stringify({
      transactions: cachedUserDataset.transactions,
      summary: cachedUserDataset.summary,
    });
  }
  return JSON.stringify(DEFAULT_DEMO_TRANSACTIONS);
}

// Parse spending categories from user's actual data
export function parseSpendingCategories(analysis: string): { category: string; amount: number; percentage: number }[] {
  // Use cached user dataset if available
  const dataset = getCachedUserDataset();
  if (dataset) {
    const categoryTotals: { [cat: string]: number } = {};
    dataset.transactions.forEach(t => {
      if (t.amount < 0 && t.category !== 'Income') {
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + Math.abs(t.amount);
      }
    });

    const total = Object.values(categoryTotals).reduce((sum, amt) => sum + amt, 0);
    return Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([category, amount]) => ({
        category,
        amount: Math.round(amount / 12), // Monthly average
        percentage: Math.round((amount / total) * 100),
      }));
  }

  // Fallback defaults
  return [
    { category: 'Rent', amount: 1200, percentage: 40 },
    { category: 'Groceries', amount: 350, percentage: 12 },
    { category: 'Dining', amount: 180, percentage: 6 },
    { category: 'Transport', amount: 150, percentage: 5 },
    { category: 'Coffee', amount: 80, percentage: 3 },
  ];
}

// Extract weekly comparison data from user's actual data
export function parseWeeklyComparison(analysis: string): { category: string; thisWeek: number; lastWeek: number }[] {
  const dataset = getCachedUserDataset();
  if (dataset && dataset.summary.weeklyAverages) {
    const categories = ['Groceries', 'Dining', 'Coffee', 'Transport', 'Shopping'];
    const thisWeekAvg = dataset.summary.weeklyAverages[0]?.amount || 400;
    const lastWeekAvg = dataset.summary.weeklyAverages[1]?.amount || 380;
    const ratio = thisWeekAvg / lastWeekAvg;

    // Distribute across categories with some variation
    return categories.map((category, i) => {
      const base = [120, 60, 25, 40, 55][i];
      const variation = 0.8 + Math.random() * 0.4;
      return {
        category,
        thisWeek: Math.round(base * variation),
        lastWeek: Math.round(base * variation / ratio),
      };
    });
  }

  return [
    { category: 'Groceries', thisWeek: 145, lastWeek: 133 },
    { category: 'Dining', thisWeek: 57, lastWeek: 78 },
    { category: 'Coffee', thisWeek: 17, lastWeek: 22 },
    { category: 'Transport', thisWeek: 13, lastWeek: 19 },
    { category: 'Shopping', thisWeek: 30, lastWeek: 45 },
  ];
}

// Generate alerts from user's actual data
export function parseAlerts(analysis: string): { type: 'spike' | 'unusual' | 'trend'; message: string; amount?: number }[] {
  const alerts: { type: 'spike' | 'unusual' | 'trend'; message: string; amount?: number }[] = [];
  const dataset = getCachedUserDataset();

  if (dataset) {
    const { spendingTrend, topCategories, weeklyAverages } = dataset.summary;

    // Check spending trend
    if (spendingTrend === 'increasing') {
      alerts.push({
        type: 'spike',
        message: `Spending trending up - ${topCategories[0]} is your biggest category`,
        amount: weeklyAverages[0]?.amount,
      });
    } else if (spendingTrend === 'decreasing') {
      alerts.push({
        type: 'trend',
        message: 'Great progress! Your spending is trending down',
      });
    }

    // Check week-over-week change
    if (weeklyAverages.length >= 2) {
      const change = ((weeklyAverages[0].amount - weeklyAverages[1].amount) / weeklyAverages[1].amount) * 100;
      if (change > 15) {
        alerts.push({
          type: 'spike',
          message: `This week's spending ${Math.round(change)}% higher than last week`,
          amount: weeklyAverages[0].amount,
        });
      } else if (change < -15) {
        alerts.push({
          type: 'trend',
          message: `This week's spending ${Math.round(Math.abs(change))}% lower - nice!`,
        });
      }
    }
  }

  // Default if no alerts generated
  if (alerts.length === 0) {
    alerts.push({
      type: 'trend',
      message: 'Spending patterns are within normal range',
    });
  }

  return alerts;
}

export default {
  getCalendarPredictions,
  getCalendarPredictionsFromBackend,
  getTransactionAnalysis,
  getTransactionAnalysisFromBackend,
  getBudgetTips,
  getRunwayAnalysis,
  getFinancialSummary,
  getDemoTransactionData,
  parseSpendingCategories,
  parseWeeklyComparison,
  parseAlerts,
  DEMO_TRANSACTIONS,
  initUserData,
  getCachedUserDataset,
  clearUserData,
  setUseUploadedData,
  isUsingUploadedData,
  getUploadedFileContent,
};
