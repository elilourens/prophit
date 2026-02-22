/**
 * Transaction Service
 *
 * Handles manual transaction entry, deletion, and persistence.
 * Integrates with the existing user dataset system.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Transaction, TransactionSummary, UserDataset } from './fakeDatasets';
import { v4 as uuidv4 } from 'uuid';

const TRANSACTIONS_STORAGE_KEY = '@prophit_manual_transactions';
const UPLOADED_DATA_KEY = '@prophit_uploaded_data';

// Extended transaction type with ID
export interface TransactionWithId extends Transaction {
  id: string;
  createdAt: string;
  isManual: boolean;
}

/**
 * Auto-categorize a transaction based on description
 */
export function categorizeTransaction(description: string): string {
  const desc = description.toLowerCase();
  if (desc.includes('coffee') || desc.includes('starbucks') || desc.includes('costa') || desc.includes('cafe')) return 'Coffee';
  if (desc.includes('uber') || desc.includes('bolt') || desc.includes('taxi') || desc.includes('luas') || desc.includes('bus') || desc.includes('dart')) return 'Transport';
  if (desc.includes('tesco') || desc.includes('lidl') || desc.includes('aldi') || desc.includes('dunnes') || desc.includes('supermarket') || desc.includes('grocery') || desc.includes('supervalu')) return 'Groceries';
  if (desc.includes('netflix') || desc.includes('spotify') || desc.includes('disney') || desc.includes('subscription') || desc.includes('apple') || desc.includes('youtube')) return 'Subscriptions';
  if (desc.includes('restaurant') || desc.includes('dining') || desc.includes('food') || desc.includes('lunch') || desc.includes('dinner') || desc.includes('breakfast') || desc.includes('eat')) return 'Dining';
  if (desc.includes('rent') || desc.includes('landlord') || desc.includes('accommodation')) return 'Rent';
  if (desc.includes('electric') || desc.includes('gas') || desc.includes('water') || desc.includes('utility') || desc.includes('bord gais') || desc.includes('energia')) return 'Utilities';
  if (desc.includes('amazon') || desc.includes('shop') || desc.includes('store') || desc.includes('penneys') || desc.includes('zara') || desc.includes('h&m')) return 'Shopping';
  if (desc.includes('salary') || desc.includes('payroll') || desc.includes('income') || desc.includes('deposit') || desc.includes('wages')) return 'Income';
  if (desc.includes('transfer') || desc.includes('revolut') || desc.includes('sent') || desc.includes('received')) return 'Transfer';
  if (desc.includes('drink') || desc.includes('pub') || desc.includes('bar') || desc.includes('beer') || desc.includes('wine')) return 'Entertainment';
  return 'Other';
}

/**
 * Calculate summary statistics from transactions
 */
export function calculateSummaryFromTransactions(transactions: Transaction[]): TransactionSummary {
  const expenses = transactions.filter(t => t.amount < 0);
  const income = transactions.filter(t => t.amount > 0);

  const totalSpent = Math.abs(expenses.reduce((sum, t) => sum + t.amount, 0));
  const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);

  // Calculate date range
  const dates = transactions.map(t => new Date(t.date).getTime()).filter(d => !isNaN(d));
  const minDate = dates.length > 0 ? Math.min(...dates) : Date.now();
  const maxDate = dates.length > 0 ? Math.max(...dates) : Date.now();
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
    dataRangeMonths,
  };
}

/**
 * Generate a unique transaction ID
 */
function generateTransactionId(): string {
  // Simple UUID generation for React Native
  return 'txn_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Add a new transaction to the dataset
 */
export async function addTransaction(
  transactionData: Omit<TransactionWithId, 'id' | 'createdAt' | 'isManual'>
): Promise<TransactionWithId> {
  const newTransaction: TransactionWithId = {
    ...transactionData,
    id: generateTransactionId(),
    createdAt: new Date().toISOString(),
    isManual: true,
    category: transactionData.category || categorizeTransaction(transactionData.description),
  };

  // Load existing manual transactions
  const manualTxns = await loadManualTransactions();
  manualTxns.push(newTransaction);

  // Persist manual transactions
  await AsyncStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(manualTxns));

  // Also update the uploaded data key to include this transaction
  await updateUploadedDataWithTransaction(newTransaction);

  console.log('Added transaction:', newTransaction.id, newTransaction.description, newTransaction.amount);

  return newTransaction;
}

/**
 * Delete a transaction by ID
 */
export async function deleteTransaction(transactionId: string): Promise<boolean> {
  try {
    // Remove from manual transactions
    const manualTxns = await loadManualTransactions();
    const updatedManualTxns = manualTxns.filter(t => t.id !== transactionId);
    await AsyncStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(updatedManualTxns));

    // Also remove from uploaded data
    await removeTransactionFromUploadedData(transactionId);

    console.log('Deleted transaction:', transactionId);
    return true;
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return false;
  }
}

/**
 * Load manual transactions from storage
 */
export async function loadManualTransactions(): Promise<TransactionWithId[]> {
  try {
    const stored = await AsyncStorage.getItem(TRANSACTIONS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error loading manual transactions:', error);
  }
  return [];
}

/**
 * Update the uploaded data to include a new transaction
 */
async function updateUploadedDataWithTransaction(transaction: TransactionWithId): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(UPLOADED_DATA_KEY);
    if (stored) {
      const dataset: UserDataset = JSON.parse(stored);

      // Add transaction to the beginning (most recent)
      const baseTransaction: Transaction = {
        date: transaction.date,
        description: transaction.description,
        amount: transaction.amount,
        category: transaction.category,
      };

      dataset.transactions.unshift(baseTransaction);

      // Recalculate summary
      dataset.summary = calculateSummaryFromTransactions(dataset.transactions);

      await AsyncStorage.setItem(UPLOADED_DATA_KEY, JSON.stringify(dataset));
    }
  } catch (error) {
    console.error('Error updating uploaded data:', error);
  }
}

/**
 * Remove a transaction from uploaded data
 */
async function removeTransactionFromUploadedData(transactionId: string): Promise<void> {
  try {
    // We need to find and remove the transaction
    // Since base transactions don't have IDs, we need to match by other fields
    // For manual transactions, we track them separately in TRANSACTIONS_STORAGE_KEY
    // Here we just need to ensure consistency

    const stored = await AsyncStorage.getItem(UPLOADED_DATA_KEY);
    if (stored) {
      const dataset: UserDataset = JSON.parse(stored);

      // Get manual transactions to find which one to remove
      const manualTxns = await loadManualTransactions();
      const removedTxn = manualTxns.find(t => t.id === transactionId);

      if (removedTxn) {
        // Remove the matching transaction
        dataset.transactions = dataset.transactions.filter(t =>
          !(t.date === removedTxn.date &&
            t.description === removedTxn.description &&
            t.amount === removedTxn.amount)
        );

        // Recalculate summary
        dataset.summary = calculateSummaryFromTransactions(dataset.transactions);

        await AsyncStorage.setItem(UPLOADED_DATA_KEY, JSON.stringify(dataset));
      }
    }
  } catch (error) {
    console.error('Error removing from uploaded data:', error);
  }
}

/**
 * Get transactions for a specific date range (useful for arena sync)
 */
export function getTransactionsInRange(
  transactions: Transaction[],
  startDate: Date,
  endDate: Date
): Transaction[] {
  return transactions.filter(t => {
    const txnDate = new Date(t.date);
    return txnDate >= startDate && txnDate <= endDate;
  });
}

/**
 * Calculate total spending for a date range
 */
export function calculateSpendingInRange(
  transactions: Transaction[],
  startDate: Date,
  endDate: Date
): number {
  const rangeTransactions = getTransactionsInRange(transactions, startDate, endDate);
  return Math.abs(
    rangeTransactions
      .filter(t => t.amount < 0 && t.category !== 'Transfer')
      .reduce((sum, t) => sum + t.amount, 0)
  );
}

/**
 * Get spending by category for a date range
 */
export function getSpendingByCategory(
  transactions: Transaction[],
  startDate: Date,
  endDate: Date
): { [category: string]: number } {
  const rangeTransactions = getTransactionsInRange(transactions, startDate, endDate);
  const categorySpending: { [category: string]: number } = {};

  rangeTransactions
    .filter(t => t.amount < 0 && t.category !== 'Transfer')
    .forEach(t => {
      categorySpending[t.category] = (categorySpending[t.category] || 0) + Math.abs(t.amount);
    });

  return categorySpending;
}

export default {
  addTransaction,
  deleteTransaction,
  loadManualTransactions,
  categorizeTransaction,
  calculateSummaryFromTransactions,
  getTransactionsInRange,
  calculateSpendingInRange,
  getSpendingByCategory,
};
