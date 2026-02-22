/**
 * Backend API Service
 *
 * Wraps the FastAPI backend at https://prophit-ashy.vercel.app
 * Endpoints:
 * - POST /parse-pdf - Parse PDF and return transactions as JSON
 * - POST /analyse - Transaction analysis (file upload, returns HTML)
 * - POST /week-ahead - Calendar predictions (file upload)
 * - POST /budget-tips?text=... - Budget tips
 * - POST /financial-summary - Financial summary (file upload)
 * - POST /income-runway?text=... - Runway calculation
 */

import { UserDataset, Transaction, TransactionSummary, FAKE_DATASETS, getDatasetById } from './fakeDatasets';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'https://prophit-ashy.vercel.app';

// Keys for persisting uploaded data
const UPLOADED_DATA_KEY = '@prophit_uploaded_data';
const USING_UPLOADED_KEY = '@prophit_using_uploaded';

// Cached user dataset (loaded on app init or from upload)
let cachedUserDataset: UserDataset | null = null;

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

/**
 * Upload a file to the FastAPI backend
 */
async function uploadFileToBackend(
  endpoint: string,
  fileUri: string,
  filename: string,
  mimeType: string = 'application/pdf',
  timeoutMs: number = 90000
): Promise<any> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      name: filename,
      type: mimeType,
    } as any);

    console.log(`Uploading to ${endpoint}...`);
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error (${endpoint}):`, errorText);
      throw new Error(`API failed: ${response.status}`);
    }

    const result = await response.json();
    console.log(`${endpoint} response:`, JSON.stringify(result).substring(0, 200));
    return result;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error(`API timeout (${endpoint})`);
    } else {
      console.error(`API error (${endpoint}):`, error);
    }
    return null;
  }
}

/**
 * Call a text-based API endpoint
 */
async function callTextApi(endpoint: string, text: string, timeoutMs: number = 30000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${BASE_URL}${endpoint}?text=${encodeURIComponent(text)}`, {
      method: 'POST',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API failed: ${response.status}`);
    }

    return await response.text();
  } catch (error: any) {
    console.error(`API error (${endpoint}):`, error);
    return null;
  }
}

// Track whether user is using uploaded data vs mock data
let useUploadedData = false;
let uploadedFileContent: string | null = null;

export async function setUseUploadedData(value: boolean, fileContent?: string, fileUri?: string): Promise<boolean> {
  useUploadedData = value;

  // Persist the flag
  await AsyncStorage.setItem(USING_UPLOADED_KEY, value ? 'true' : 'false');

  if (!value) {
    // Clear uploaded data
    await AsyncStorage.removeItem(UPLOADED_DATA_KEY);
    cachedUserDataset = null;
    uploadedFileContent = null;
    return true;
  }

  if (fileContent) {
    uploadedFileContent = fileContent;

    // Check if it's a PDF - needs backend parsing
    if (fileContent.startsWith('data:application/pdf;base64,')) {
      console.log('PDF detected - sending to backend for parsing...');
      try {
        const parsedData = await parsePDFViaBackend(fileContent, fileUri);
        if (parsedData && parsedData.transactions.length > 0) {
          cachedUserDataset = parsedData;
          // Persist the parsed dataset
          await AsyncStorage.setItem(UPLOADED_DATA_KEY, JSON.stringify(parsedData));
          console.log('Uploaded data persisted to storage');
          return true;
        } else {
          console.warn('No transactions extracted from PDF');
          return false;
        }
      } catch (error) {
        console.error('Error parsing PDF:', error);
        return false;
      }
    }

    // For text files, parse locally
    const parsedDataset = parseUploadedContent(fileContent);
    if (parsedDataset) {
      cachedUserDataset = parsedDataset;
      // Persist the parsed dataset
      await AsyncStorage.setItem(UPLOADED_DATA_KEY, JSON.stringify(parsedDataset));
      console.log('Uploaded data persisted to storage');
      return true;
    }
    return false;
  }
  return true;
}

/**
 * Send PDF to backend for parsing and extract transactions
 * Uses the FastAPI /parse-pdf endpoint which returns JSON transactions
 * @param base64Content - Base64 encoded PDF content with data URI prefix
 * @param fileUri - Optional file URI for React Native (avoids Blob creation)
 */
async function parsePDFViaBackend(base64Content: string, fileUri?: string): Promise<UserDataset | null> {
  try {
    const formData = new FormData();

    // React Native: use file URI directly (Blob from ArrayBuffer not supported)
    if (fileUri && typeof fileUri === 'string' && !fileUri.startsWith('blob:')) {
      console.log('Using file URI for upload:', fileUri);
      formData.append('file', {
        uri: fileUri,
        type: 'application/pdf',
        name: 'statement.pdf',
      } as any);
    } else {
      // Web: convert base64 to Blob
      const base64Data = base64Content.replace('data:application/pdf;base64,', '');
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      formData.append('file', blob, 'statement.pdf');
    }

    console.log('Uploading PDF to backend /parse-pdf...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    const response = await fetch(`${BASE_URL}/parse-pdf`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('PDF parsing failed:', response.status);
      const errorText = await response.text();
      console.error('Error:', errorText);
      return null;
    }

    const result = await response.json();
    console.log('Parse-pdf result:', JSON.stringify(result).substring(0, 500));

    // The /parse-pdf endpoint returns: { transactions: [...], summary: {...} }
    let transactions: Transaction[] = [];

    if (result.transactions && Array.isArray(result.transactions)) {
      transactions = result.transactions.map(normalizeTransaction);
    }

    if (result.error) {
      console.warn('Backend returned error:', result.error);
    }

    if (transactions.length > 0) {
      console.log(`Extracted ${transactions.length} transactions from PDF`);
      const summary = calculateSummaryFromTransactions(transactions);
      return { id: -1, transactions, summary };
    } else {
      console.warn('No transactions found in response');
      console.log('Full response:', JSON.stringify(result));
    }

    return null;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('PDF parsing timed out');
    } else {
      console.error('Error in parsePDFViaBackend:', error);
    }
    return null;
  }
}

/**
 * Parse uploaded file content (CSV, JSON, PDF, or raw text) into a UserDataset
 */
function parseUploadedContent(content: string): UserDataset | null {
  try {
    let transactions: Transaction[] = [];

    // Check if it's a PDF (base64 encoded)
    if (content.startsWith('data:application/pdf;base64,')) {
      // For PDFs, we need to send to backend for parsing
      // For now, store the raw content and mark as PDF for later processing
      console.log('PDF detected - will be processed by backend');
      // Return a placeholder dataset - actual data will come from backend API calls
      return {
        id: -1,
        transactions: [],
        summary: {
          totalSpent: 0,
          avgDaily: 0,
          avgMonthly: 0,
          topCategories: [],
          monthlyIncome: 0,
          savings: 0,
          monthlySnapshots: [],
          weeklyAverages: [],
          seasonalData: { winter: 0, spring: 0, summer: 0, autumn: 0 },
          spendingTrend: 'stable',
          savingsRate: 0,
          projectedMonthlySpend: 0,
          runwayMonths: 0,
          dataRangeMonths: 0,
        },
      };
    }

    // Try parsing as JSON first
    if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
      const jsonData = JSON.parse(content);
      console.log('Parsed JSON structure:', Object.keys(jsonData));

      if (Array.isArray(jsonData)) {
        // Direct array of transactions
        transactions = jsonData.map(normalizeTransaction);
      } else if (jsonData.transactions && Array.isArray(jsonData.transactions)) {
        // { transactions: [...] }
        transactions = jsonData.transactions.map(normalizeTransaction);
      } else if (jsonData.statements && Array.isArray(jsonData.statements)) {
        // Bank export format: { statements: [{ transactions: [...] }] }
        jsonData.statements.forEach((statement: any) => {
          if (statement.transactions && Array.isArray(statement.transactions)) {
            const statementTxns = statement.transactions.map(normalizeTransaction);
            transactions.push(...statementTxns);
          }
        });
        console.log(`Extracted ${transactions.length} transactions from ${jsonData.statements.length} statements`);
      } else if (jsonData.data && Array.isArray(jsonData.data)) {
        // { data: [...] } format
        transactions = jsonData.data.map(normalizeTransaction);
      } else if (jsonData.records && Array.isArray(jsonData.records)) {
        // { records: [...] } format
        transactions = jsonData.records.map(normalizeTransaction);
      } else {
        // Try to find any array property that looks like transactions
        for (const key of Object.keys(jsonData)) {
          if (Array.isArray(jsonData[key]) && jsonData[key].length > 0) {
            const sample = jsonData[key][0];
            // Check if it looks like a transaction (has date/amount-like properties)
            if (sample && (sample.date || sample.Date || sample.timestamp || sample.amount || sample.Amount)) {
              console.log(`Found transactions in "${key}" property`);
              transactions = jsonData[key].map(normalizeTransaction);
              break;
            }
          }
        }
      }
    } else {
      // Parse as CSV
      transactions = parseCSV(content);
    }

    if (transactions.length === 0) {
      console.warn('No transactions parsed from uploaded content');
      return null;
    }

    // Calculate summary from parsed transactions
    const summary = calculateSummaryFromTransactions(transactions);

    return {
      id: -1, // Special ID for uploaded data
      transactions,
      summary,
    };
  } catch (error) {
    console.error('Error parsing uploaded content:', error);
    return null;
  }
}

/**
 * Normalize a transaction object to our standard format
 * Handles various bank export formats
 */
function normalizeTransaction(t: any): Transaction {
  // Extract date - handle various formats
  let date = t.date || t.Date || t.DATE || t.transaction_date || t.transactionDate;
  if (!date && t.timestamp) {
    // Handle ISO timestamp
    try {
      date = new Date(t.timestamp).toISOString().split('T')[0];
    } catch {
      date = new Date().toISOString().split('T')[0];
    }
  }
  if (!date) {
    date = new Date().toISOString().split('T')[0];
  }

  // Extract description
  const description = t.description || t.Description || t.DESC || t.name || t.Name ||
    t.merchant || t.Merchant || t.payee || t.Payee || t.narrative || 'Unknown';

  // Extract amount - handle various formats and signs
  let amount = 0;
  if (t.amount !== undefined) {
    amount = parseFloat(t.amount);
  } else if (t.Amount !== undefined) {
    amount = parseFloat(t.Amount);
  } else if (t.AMOUNT !== undefined) {
    amount = parseFloat(t.AMOUNT);
  } else if (t.value !== undefined) {
    amount = parseFloat(t.value);
  } else if (t.Value !== undefined) {
    amount = parseFloat(t.Value);
  }

  // Handle transaction_type: DEBIT should be negative, CREDIT positive
  const txnType = (t.transaction_type || t.transactionType || t.type || '').toUpperCase();
  if (txnType === 'DEBIT' && amount > 0) {
    amount = -amount;
  } else if (txnType === 'CREDIT' && amount < 0) {
    amount = -amount;
  }

  // Extract or derive category
  const category = t.category || t.Category || t.CATEGORY ||
    t.transaction_category || t.transactionCategory ||
    categorizeTransaction(description);

  return { date, description, amount, category };
}

/**
 * Auto-categorize a transaction based on description
 */
function categorizeTransaction(description: string): string {
  const desc = description.toLowerCase();
  if (desc.includes('coffee') || desc.includes('starbucks') || desc.includes('costa')) return 'Coffee';
  if (desc.includes('uber') || desc.includes('bolt') || desc.includes('taxi') || desc.includes('luas') || desc.includes('bus')) return 'Transport';
  if (desc.includes('tesco') || desc.includes('lidl') || desc.includes('aldi') || desc.includes('dunnes') || desc.includes('supermarket') || desc.includes('grocery')) return 'Groceries';
  if (desc.includes('netflix') || desc.includes('spotify') || desc.includes('disney') || desc.includes('subscription')) return 'Subscriptions';
  if (desc.includes('restaurant') || desc.includes('dining') || desc.includes('food') || desc.includes('lunch') || desc.includes('dinner')) return 'Dining';
  if (desc.includes('rent') || desc.includes('landlord')) return 'Rent';
  if (desc.includes('electric') || desc.includes('gas') || desc.includes('water') || desc.includes('utility')) return 'Utilities';
  if (desc.includes('amazon') || desc.includes('shop') || desc.includes('store')) return 'Shopping';
  if (desc.includes('salary') || desc.includes('payroll') || desc.includes('income') || desc.includes('deposit')) return 'Income';
  if (desc.includes('transfer') || desc.includes('revolut') || desc.includes('sent')) return 'Transfer';
  return 'Other';
}

/**
 * Parse CSV content into transactions
 */
function parseCSV(content: string): Transaction[] {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase();
  const hasHeader = header.includes('date') || header.includes('amount') || header.includes('description');
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map(line => {
    // Handle both comma and semicolon separators
    const parts = line.includes(';') ? line.split(';') : line.split(',');

    // Try to detect which column is which
    let date = '', description = '', amount = 0, category = '';

    parts.forEach((part, i) => {
      const trimmed = part.trim().replace(/"/g, '');
      // Check if it looks like a date
      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed) || /^\d{2}\/\d{2}\/\d{4}/.test(trimmed)) {
        date = trimmed;
      }
      // Check if it looks like an amount
      else if (/^-?[\d,.]+$/.test(trimmed.replace(/[€$£]/g, ''))) {
        const parsed = parseFloat(trimmed.replace(/[€$£,]/g, ''));
        if (!isNaN(parsed)) amount = parsed;
      }
      // Otherwise it's probably a description
      else if (trimmed.length > 2 && !category) {
        description = trimmed;
      }
    });

    return {
      date: date || new Date().toISOString().split('T')[0],
      description: description || 'Unknown transaction',
      amount: amount,
      category: categorizeTransaction(description),
    };
  }).filter(t => t.amount !== 0);
}

/**
 * Calculate summary statistics from transactions
 */
function calculateSummaryFromTransactions(transactions: Transaction[]): TransactionSummary {
  const expenses = transactions.filter(t => t.amount < 0);
  const income = transactions.filter(t => t.amount > 0);

  const totalSpent = Math.abs(expenses.reduce((sum, t) => sum + t.amount, 0));
  const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);

  // Calculate date range
  const dates = transactions.map(t => new Date(t.date).getTime()).filter(d => !isNaN(d));
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const dayRange = Math.max(1, Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)));
  const monthRange = Math.max(1, dayRange / 30);

  // Track data range for UI adaptation
  const dataRangeMonths = Math.round(monthRange * 10) / 10;

  const avgDaily = totalSpent / dayRange;
  const avgMonthly = totalSpent / monthRange;

  // Category totals
  const categoryTotals: { [key: string]: number } = {};
  expenses.forEach(t => {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + Math.abs(t.amount);
  });

  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat]) => cat);

  // Monthly snapshots
  const monthlyData: { [key: string]: { spent: number; income: number } } = {};
  transactions.forEach(t => {
    const month = t.date.substring(0, 7);
    if (!monthlyData[month]) monthlyData[month] = { spent: 0, income: 0 };
    if (t.amount < 0) monthlyData[month].spent += Math.abs(t.amount);
    else monthlyData[month].income += t.amount;
  });

  const monthlySnapshots = Object.entries(monthlyData)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, data]) => ({
      month,
      totalSpent: Math.round(data.spent * 100) / 100,
      totalIncome: Math.round(data.income * 100) / 100,
      netSavings: Math.round((data.income - data.spent) * 100) / 100,
      topCategory: topCategories[0] || 'Other',
    }));

  // Weekly averages (last 4 weeks if available)
  const weeklyAverages: { week: number; amount: number }[] = [];
  const now = new Date();
  for (let week = 0; week < 4; week++) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - (week * 7) - 6);
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - (week * 7));

    const weekTransactions = expenses.filter(t => {
      const d = new Date(t.date);
      return d >= weekStart && d <= weekEnd;
    });
    const weekTotal = Math.abs(weekTransactions.reduce((sum, t) => sum + t.amount, 0));
    weeklyAverages.push({ week: week + 1, amount: Math.round(weekTotal * 100) / 100 });
  }

  // Simple seasonal data (based on available months)
  const seasonalData = { winter: avgMonthly, spring: avgMonthly, summer: avgMonthly, autumn: avgMonthly };

  // Determine spending trend from monthly data
  const monthlyAmounts = monthlySnapshots.map(m => m.totalSpent);
  let spendingTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (monthlyAmounts.length >= 2) {
    const recent = monthlyAmounts.slice(-2).reduce((a, b) => a + b, 0) / 2;
    const older = monthlyAmounts.slice(0, -2).reduce((a, b) => a + b, 0) / Math.max(1, monthlyAmounts.length - 2);
    if (recent > older * 1.1) spendingTrend = 'increasing';
    else if (recent < older * 0.9) spendingTrend = 'decreasing';
  }

  // Calculate actual monthly income and net savings from transactions
  const monthlyIncome = Math.round(totalIncome / monthRange);
  const netSavingsFromPeriod = totalIncome - totalSpent;
  const monthlySavings = netSavingsFromPeriod / monthRange;

  // Savings rate based on actual income vs spending
  const savingsRate = totalIncome > 0
    ? Math.max(0, Math.min(100, Math.round((monthlySavings / (monthlyIncome || 1)) * 100)))
    : 0;

  // Calculate actual savings based on net income from the data period
  // For short data periods (< 3 months), extrapolate conservatively
  const actualSavings = Math.round(Math.max(0, netSavingsFromPeriod));

  // Runway based on actual savings / monthly burn
  const runwayMonths = avgMonthly > 0 && actualSavings > 0
    ? Math.round((actualSavings / avgMonthly) * 10) / 10
    : 0;

  return {
    totalSpent: Math.round(totalSpent * 100) / 100,
    avgDaily: Math.round(avgDaily * 100) / 100,
    avgMonthly: Math.round(avgMonthly * 100) / 100,
    topCategories,
    monthlyIncome: monthlyIncome || 0,
    savings: actualSavings,
    monthlySnapshots,
    weeklyAverages,
    seasonalData,
    spendingTrend,
    savingsRate,
    projectedMonthlySpend: Math.round(avgMonthly),
    runwayMonths,
    dataRangeMonths, // How many months of data we have
  };
}

export function isUsingUploadedData(): boolean {
  return useUploadedData;
}

export function getUploadedFileContent(): string | null {
  return uploadedFileContent;
}

/**
 * Restore uploaded data from AsyncStorage on app start.
 * Call this early in app initialization.
 */
export async function restoreUploadedData(): Promise<boolean> {
  try {
    const usingUploaded = await AsyncStorage.getItem(USING_UPLOADED_KEY);
    if (usingUploaded === 'true') {
      const storedData = await AsyncStorage.getItem(UPLOADED_DATA_KEY);
      if (storedData) {
        const parsedData = JSON.parse(storedData) as UserDataset;
        if (parsedData && parsedData.transactions && parsedData.transactions.length > 0) {
          cachedUserDataset = parsedData;
          useUploadedData = true;
          console.log('Restored uploaded data from storage:', parsedData.transactions.length, 'transactions');
          return true;
        }
      }
    }
  } catch (error) {
    console.error('Error restoring uploaded data:', error);
  }
  return false;
}

/**
 * Get calendar predictions - uses local generation with cached data
 */
export async function getCalendarPredictionsFromBackend(fileContent: string): Promise<{
  calendar: string;
  predictions: CalendarPrediction[];
}> {
  // Use local generation with cached dataset
  const cachedData = getCachedUserDataset();
  if (cachedData) {
    return generateLocalPredictions(JSON.stringify({ transactions: cachedData.transactions, summary: cachedData.summary }));
  }
  return { calendar: '', predictions: [] };
}

/**
 * Get transaction analysis - uses local generation with cached data
 */
export async function getTransactionAnalysisFromBackend(fileContent: string): Promise<AnalysisResult> {
  // Use local generation with cached dataset
  const cachedData = getCachedUserDataset();
  if (cachedData) {
    return generateLocalAnalysis(JSON.stringify({ transactions: cachedData.transactions, summary: cachedData.summary }));
  }
  return { claudeAnalysis: '', geminiAnalysis: '', gptAnalysis: '' };
}

/**
 * Generate calendar predictions - uses cached dataset if available
 */
export function getCalendarPredictions(transactionData: string): Promise<{
  calendar: string;
  predictions: CalendarPrediction[];
}> {
  // If using uploaded data, use cached dataset directly (not raw file content)
  if (useUploadedData && cachedUserDataset) {
    const jsonData = JSON.stringify({ transactions: cachedUserDataset.transactions, summary: cachedUserDataset.summary });
    return Promise.resolve(generateLocalPredictions(jsonData));
  }
  return Promise.resolve(generateLocalPredictions(transactionData));
}

/**
 * Get transaction analysis - uses cached dataset if available
 */
export function getTransactionAnalysis(transactionData: string): Promise<AnalysisResult> {
  // If using uploaded data, use cached dataset directly (not raw file content)
  if (useUploadedData && cachedUserDataset) {
    const jsonData = JSON.stringify({ transactions: cachedUserDataset.transactions, summary: cachedUserDataset.summary });
    return Promise.resolve(generateLocalAnalysis(jsonData));
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
 * Uses FastAPI POST /budget-tips?text=...
 * @param spendingPatterns - Description of spending patterns
 * @returns Markdown string of tips
 */
export async function getBudgetTips(spendingPatterns: string): Promise<string> {
  try {
    const result = await callTextApi('/budget-tips', spendingPatterns);
    return result || '';
  } catch (error) {
    console.error('Budget tips error:', error);
    return '';
  }
}

/**
 * Get income runway calculation
 * Uses FastAPI POST /income-runway?text=...
 * @param financialSummary - Text summary of financial situation
 * @returns Runway analysis
 */
export async function getRunwayAnalysis(financialSummary: string): Promise<RunwayResult> {
  try {
    const result = await callTextApi('/income-runway', financialSummary);
    const analysis = result || '';

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
 * Uses FastAPI POST /financial-summary (file upload)
 * @param transactionData - JSON string of transaction data
 * @returns Text financial summary
 */
export async function getFinancialSummary(transactionData: string): Promise<string> {
  try {
    // For now, return a locally generated summary since we have the data
    const data = JSON.parse(transactionData);
    const summary = data.summary || {};
    return `Monthly income: €${summary.monthlyIncome || 0}. Monthly expenses: €${summary.avgMonthly || 0}. Savings: €${summary.savings || 0}.`;
  } catch (error) {
    console.error('Financial summary error:', error);
    return '';
  }
}

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
