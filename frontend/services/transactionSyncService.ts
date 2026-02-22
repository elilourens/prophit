/**
 * Transaction Sync Service
 *
 * Syncs transactions between local storage and Supabase.
 * Ensures data persists across devices and sessions.
 * ALSO immediately updates arena spending when transactions are added.
 */

import { supabase } from './supabase';
import { Transaction, UserDataset, TransactionSummary } from './fakeDatasets';
import { calculateSummaryFromTransactions, categorizeTransaction } from './transactionService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const UPLOADED_DATA_KEY = '@prophit_uploaded_data';

/**
 * Vice category mappings for vice_streak mode elimination check
 */
const VICE_MAPPINGS: { [viceId: string]: { keywords: string[] } } = {
  coffee: { keywords: ['starbucks', 'costa', 'coffee', 'cafe', 'latte', 'cappuccino', 'espresso', 'nero', 'pret'] },
  fast_food: { keywords: ['mcdonald', 'burger king', 'kfc', 'subway', 'five guys', 'wendy', 'taco bell', 'chipotle', 'domino', 'pizza hut', 'papa john', 'nando'] },
  alcohol: { keywords: ['pub', 'bar', 'beer', 'wine', 'spirits', 'off-licence', 'off license', 'liquor', 'guinness'] },
  takeaway: { keywords: ['deliveroo', 'just eat', 'uber eats', 'doordash', 'grubhub', 'takeaway'] },
  shopping: { keywords: ['amazon', 'asos', 'zara', 'h&m', 'primark', 'penneys'] },
  subscriptions: { keywords: ['netflix', 'spotify', 'disney', 'hulu', 'prime', 'apple music', 'youtube premium'] },
  gambling: { keywords: ['bet365', 'paddy power', 'william hill', 'betfair', 'casino', 'poker', 'lottery'] },
  smoking: { keywords: ['cigarette', 'tobacco', 'vape', 'juul', 'smoke shop'] },
};

/**
 * Check if a transaction matches a vice category
 */
function matchesVice(description: string, category: string, viceId: string): boolean {
  const mapping = VICE_MAPPINGS[viceId];
  if (!mapping) return false;
  const lower = description.toLowerCase();
  return mapping.keywords.some(kw => lower.includes(kw));
}

/**
 * SIMPLE DIRECT UPDATE: After any transaction insert, update arena_members.current_spend
 * This is called IMMEDIATELY after every transaction insert - no background sync needed
 */
export async function updateArenaSpendingDirectly(userId: string): Promise<void> {
  try {
    console.log('Updating arena spending directly for user:', userId);

    // Get all active arenas the user is in
    const { data: memberships, error: fetchError } = await supabase
      .from('arena_members')
      .select(`
        arena_id,
        is_eliminated,
        arenas (
          id,
          created_at,
          status,
          mode,
          target_amount,
          target_category
        )
      `)
      .eq('user_id', userId);

    if (fetchError || !memberships) {
      console.error('Error fetching memberships:', fetchError);
      return;
    }

    // For each active arena, recalculate and update spending
    for (const membership of memberships) {
      const arena = (membership as any).arenas;
      if (!arena || arena.status !== 'active') continue;

      const arenaId = arena.id;
      const arenaStart = new Date(arena.created_at);
      const mode = arena.mode;
      const targetCategory = arena.target_category;
      const targetAmount = arena.target_amount;

      // Sum all transactions for this user since arena started
      const { data: transactions, error: txnError } = await supabase
        .from('transactions')
        .select('amount, description, category, date')
        .eq('user_id', userId)
        .gte('date', arenaStart.toISOString().split('T')[0])
        .lt('amount', 0); // Only expenses

      if (txnError) {
        console.error('Error fetching transactions for arena:', txnError);
        continue;
      }

      // Calculate total spend (for vice_streak, only count matching transactions)
      let totalSpend = 0;
      let isEliminated = membership.is_eliminated || false;

      for (const txn of transactions || []) {
        const amount = Math.abs(txn.amount);

        if (mode === 'vice_streak' && targetCategory) {
          // Only count transactions matching the banned vice
          if (matchesVice(txn.description, txn.category, targetCategory)) {
            totalSpend += amount;
            // For vice_streak: ANY matching transaction = eliminated
            if (!isEliminated) {
              isEliminated = true;
              console.log(`User ${userId} eliminated in vice_streak arena ${arenaId} - spent on ${targetCategory}`);
            }
          }
        } else {
          // Budget guardian / savings sprint: count all expenses
          totalSpend += amount;
        }
      }

      totalSpend = Math.round(totalSpend * 100) / 100;
      console.log(`Arena ${arenaId}: total spend = €${totalSpend}, eliminated = ${isEliminated}`);

      // Update arena_members directly
      const updateData: any = {
        current_spend: totalSpend,
        last_synced_at: new Date().toISOString(),
      };

      // Check budget exceeded for budget_guardian mode
      if (mode === 'budget_guardian' && targetAmount && totalSpend > targetAmount) {
        updateData.budget_exceeded_at = updateData.budget_exceeded_at || new Date().toISOString();
      }

      // Set elimination for vice_streak
      if (mode === 'vice_streak' && isEliminated) {
        updateData.is_eliminated = true;
      }

      const { error: updateError } = await supabase
        .from('arena_members')
        .update(updateData)
        .eq('arena_id', arenaId)
        .eq('user_id', userId);

      if (updateError) {
        console.error('Error updating arena_members:', updateError);
      } else {
        console.log(`Updated arena_members for arena ${arenaId}: €${totalSpend}`);
      }
    }
  } catch (error) {
    console.error('Error in updateArenaSpendingDirectly:', error);
  }
}

export interface SupabaseTransaction {
  id: string;
  user_id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  timestamp: string | null; // Precise transaction time
  created_at: string;
}

/**
 * Load all transactions for a user from Supabase
 */
export async function loadTransactionsFromSupabase(userId: string): Promise<Transaction[]> {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error loading transactions from Supabase:', error);
      return [];
    }

    // Convert to Transaction format
    return (data || []).map((t: SupabaseTransaction) => ({
      date: t.date,
      description: t.description,
      amount: t.amount,
      category: t.category,
      timestamp: t.timestamp || undefined,
    }));
  } catch (error) {
    console.error('Error in loadTransactionsFromSupabase:', error);
    return [];
  }
}

/**
 * Save a single transaction to Supabase
 * IMMEDIATELY updates arena spending after insert
 */
export async function saveTransactionToSupabase(
  userId: string,
  transaction: Transaction
): Promise<boolean> {
  try {
    const insertData = {
      user_id: userId,
      date: transaction.date,
      description: transaction.description,
      amount: transaction.amount,
      category: transaction.category || categorizeTransaction(transaction.description),
      timestamp: transaction.timestamp || new Date().toISOString(),
    };

    console.log('Inserting transaction to Supabase:', insertData);

    const { data, error } = await supabase
      .from('transactions')
      .insert(insertData)
      .select();

    if (error) {
      console.error('Supabase insert error:', error.message, error.details, error.hint);
      return false;
    }

    console.log('Saved transaction to Supabase:', data);

    // IMMEDIATELY update arena spending
    await updateArenaSpendingDirectly(userId);

    return true;
  } catch (error) {
    console.error('Exception in saveTransactionToSupabase:', error);
    return false;
  }
}

/**
 * Save multiple transactions to Supabase (batch insert)
 * IMMEDIATELY updates arena spending after all inserts
 */
export async function saveTransactionsToSupabase(
  userId: string,
  transactions: Transaction[]
): Promise<{ saved: number; errors: number }> {
  let saved = 0;
  let errors = 0;

  console.log(`Batch inserting ${transactions.length} transactions for user ${userId}`);

  // Insert in batches of 50 to avoid timeouts
  const batchSize = 50;
  for (let i = 0; i < transactions.length; i += batchSize) {
    const batch = transactions.slice(i, i + batchSize);
    const insertData = batch.map(t => ({
      user_id: userId,
      date: t.date,
      description: t.description,
      amount: t.amount,
      category: t.category || categorizeTransaction(t.description),
      timestamp: t.timestamp || `${t.date}T12:00:00Z`,
    }));

    console.log(`Inserting batch ${i / batchSize + 1}, ${batch.length} items...`);

    try {
      const { data, error } = await supabase
        .from('transactions')
        .insert(insertData)
        .select();

      if (error) {
        console.error('Batch insert error:', error.message, error.code, error.details);
        errors += batch.length;
      } else {
        console.log(`Batch inserted successfully:`, data?.length || 0, 'rows');
        saved += batch.length;
      }
    } catch (err) {
      console.error('Batch insert exception:', err);
      errors += batch.length;
    }
  }

  console.log(`Batch insert complete: ${saved} saved, ${errors} errors`);

  // IMMEDIATELY update arena spending after all inserts
  if (saved > 0) {
    await updateArenaSpendingDirectly(userId);
  }

  return { saved, errors };
}

/**
 * Delete a transaction from Supabase
 */
export async function deleteTransactionFromSupabase(
  userId: string,
  date: string,
  description: string,
  amount: number
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('user_id', userId)
      .eq('date', date)
      .eq('description', description)
      .eq('amount', amount);

    if (error) {
      console.error('Error deleting transaction from Supabase:', error);
      return false;
    }

    console.log('Deleted transaction from Supabase');
    return true;
  } catch (error) {
    console.error('Error in deleteTransactionFromSupabase:', error);
    return false;
  }
}

/**
 * Sync uploaded data to Supabase (merge, don't replace)
 * Returns the number of new transactions added
 */
export async function syncUploadedDataToSupabase(
  userId: string,
  newTransactions: Transaction[]
): Promise<{ added: number; skipped: number }> {
  console.log('syncUploadedDataToSupabase called with', newTransactions.length, 'transactions');

  try {
    // Load existing transactions from Supabase
    console.log('Loading existing transactions for deduplication...');
    const existingTransactions = await loadTransactionsFromSupabase(userId);
    console.log('Found', existingTransactions.length, 'existing transactions');

    // Find new transactions that don't exist yet
    const transactionsToAdd: Transaction[] = [];
    let skipped = 0;

    for (const newTxn of newTransactions) {
      const isDuplicate = existingTransactions.some(
        existing =>
          existing.date === newTxn.date &&
          existing.description === newTxn.description &&
          existing.amount === newTxn.amount
      );

      if (isDuplicate) {
        skipped++;
      } else {
        transactionsToAdd.push(newTxn);
      }
    }

    console.log('After deduplication:', transactionsToAdd.length, 'to add,', skipped, 'skipped');

    // Save new transactions
    if (transactionsToAdd.length > 0) {
      console.log('Calling saveTransactionsToSupabase...');
      const { saved, errors } = await saveTransactionsToSupabase(userId, transactionsToAdd);
      console.log('saveTransactionsToSupabase returned:', saved, 'saved,', errors, 'errors');
      return { added: saved, skipped: skipped + errors };
    }

    return { added: 0, skipped };
  } catch (error) {
    console.error('Error in syncUploadedDataToSupabase:', error);
    return { added: 0, skipped: newTransactions.length };
  }
}

/**
 * Load user's full dataset from Supabase
 * Creates a UserDataset from the transactions
 */
export async function loadUserDatasetFromSupabase(userId: string): Promise<UserDataset | null> {
  try {
    const transactions = await loadTransactionsFromSupabase(userId);

    if (transactions.length === 0) {
      return null;
    }

    // Calculate summary
    const summary = calculateSummaryFromTransactions(transactions);

    // Extract financial profile from transactions
    const monthlyIncome = summary.monthlyIncome || 0;
    const monthlySavings = Math.max(0, monthlyIncome - summary.avgMonthly);

    const dataset: UserDataset = {
      id: 0, // 0 indicates synced from Supabase
      name: 'Your Data',
      transactions,
      summary,
      financialProfile: {
        monthlyIncome,
        rentAmount: 0, // Can't determine from transactions alone
        savingsBalance: summary.savings,
        creditCards: [],
        loans: [],
        investments: [],
      },
      preferences: {
        currency: 'EUR',
        locale: 'en-IE',
        categories: summary.topCategories,
      },
    };

    // Also save to local storage for offline access
    await AsyncStorage.setItem(UPLOADED_DATA_KEY, JSON.stringify(dataset));

    return dataset;
  } catch (error) {
    console.error('Error in loadUserDatasetFromSupabase:', error);
    return null;
  }
}

/**
 * Clear all transactions for a user (use with caution)
 */
export async function clearAllTransactions(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('Error clearing transactions:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in clearAllTransactions:', error);
    return false;
  }
}

export default {
  loadTransactionsFromSupabase,
  saveTransactionToSupabase,
  saveTransactionsToSupabase,
  deleteTransactionFromSupabase,
  syncUploadedDataToSupabase,
  loadUserDatasetFromSupabase,
  clearAllTransactions,
};
