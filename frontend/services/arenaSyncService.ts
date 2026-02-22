/**
 * Arena Sync Service
 *
 * Synchronizes transaction data with arena spending tracking.
 * Calculates spending for arena periods and updates member stats.
 */

import { Transaction } from './fakeDatasets';
import { supabase } from './supabase';
import { Arena, ArenaMember } from '../types/supabase';

export interface ArenaPeriodSpending {
  totalSpend: number;
  categoryBreakdown: { [category: string]: number };
  transactionCount: number;
  dailyAverage: number;
}

/**
 * Vice category mappings - maps vice IDs to transaction categories/keywords
 */
const VICE_CATEGORY_MAPPINGS: { [viceId: string]: { categories: string[]; keywords: string[] } } = {
  coffee: {
    categories: ['Coffee'],
    keywords: ['starbucks', 'costa', 'coffee', 'cafe', 'latte', 'cappuccino', 'espresso', 'nero', 'pret'],
  },
  fast_food: {
    categories: ['Dining'],
    keywords: ['mcdonald', 'burger king', 'kfc', 'subway', 'five guys', 'wendy', 'taco bell', 'chipotle', 'domino', 'pizza hut', 'papa john', 'nando'],
  },
  alcohol: {
    categories: ['Dining', 'Entertainment'],
    keywords: ['pub', 'bar', 'beer', 'wine', 'spirits', 'off-licence', 'off license', 'liquor', 'guinness'],
  },
  takeaway: {
    categories: ['Dining'],
    keywords: ['deliveroo', 'just eat', 'uber eats', 'doordash', 'grubhub', 'takeaway'],
  },
  shopping: {
    categories: ['Shopping'],
    keywords: ['amazon', 'asos', 'zara', 'h&m', 'primark', 'penneys', 'shop', 'store'],
  },
  subscriptions: {
    categories: ['Subscriptions', 'Entertainment'],
    keywords: ['netflix', 'spotify', 'disney', 'hulu', 'prime', 'apple music', 'youtube premium'],
  },
  gambling: {
    categories: ['Entertainment', 'Other'],
    keywords: ['bet365', 'paddy power', 'william hill', 'betfair', 'casino', 'poker', 'lottery'],
  },
  smoking: {
    categories: ['Other'],
    keywords: ['cigarette', 'tobacco', 'vape', 'juul', 'smoke shop'],
  },
};

/**
 * Check if a transaction matches a vice category
 */
function transactionMatchesVice(transaction: Transaction, viceId: string): boolean {
  const mapping = VICE_CATEGORY_MAPPINGS[viceId];
  if (!mapping) return false;

  const description = transaction.description.toLowerCase();
  const category = transaction.category.toLowerCase();

  // Check if category matches
  for (const cat of mapping.categories) {
    if (category.includes(cat.toLowerCase())) {
      return true;
    }
  }

  // Check if description contains any keywords
  for (const keyword of mapping.keywords) {
    if (description.includes(keyword.toLowerCase())) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate spending for a specific arena period
 * @param transactions - User's transaction array
 * @param arenaStartDate - Arena start date (created_at or joined_at)
 * @param arenaEndDate - Optional arena end date (for completed arenas)
 * @param targetCategory - Optional category filter (for vice_streak mode) - uses vice ID like 'coffee', 'fast_food', etc.
 */
export function calculateArenaPeriodSpend(
  transactions: Transaction[],
  arenaStartDate: Date,
  arenaEndDate?: Date,
  targetCategory?: string
): ArenaPeriodSpending {
  const endDate = arenaEndDate || new Date();

  // Normalize arena start to beginning of day so same-day transactions are included
  // Arena created_at is a full ISO timestamp (e.g. 2026-02-22T08:22:00Z)
  // but transaction dates are YYYY-MM-DD strings (parsed as midnight)
  const normalizedStart = new Date(arenaStartDate);
  normalizedStart.setHours(0, 0, 0, 0);

  // Filter transactions within the arena period
  const periodTransactions = transactions.filter(t => {
    const txnDate = new Date(t.date);
    return (
      txnDate >= normalizedStart &&
      txnDate <= endDate &&
      t.amount < 0 && // Only expenses
      t.category !== 'Transfer' && // Exclude transfers
      t.category !== 'Income' // Exclude income
    );
  });

  // If target category specified (vice_streak mode), filter by vice matching
  const filteredTransactions = targetCategory
    ? periodTransactions.filter(t => transactionMatchesVice(t, targetCategory))
    : periodTransactions;

  // Calculate totals
  const totalSpend = Math.abs(
    filteredTransactions.reduce((sum, t) => sum + t.amount, 0)
  );

  // Category breakdown
  const categoryBreakdown: { [category: string]: number } = {};
  filteredTransactions.forEach(t => {
    categoryBreakdown[t.category] = (categoryBreakdown[t.category] || 0) + Math.abs(t.amount);
  });

  // Calculate daily average
  const daysDiff = Math.max(1, Math.ceil((endDate.getTime() - arenaStartDate.getTime()) / (1000 * 60 * 60 * 24)));
  const dailyAverage = totalSpend / daysDiff;

  return {
    totalSpend: Math.round(totalSpend * 100) / 100,
    categoryBreakdown,
    transactionCount: filteredTransactions.length,
    dailyAverage: Math.round(dailyAverage * 100) / 100,
  };
}

export interface SyncResult {
  success: boolean;
  newSpend: number;
  budgetExceeded: boolean;
  targetReached: boolean;
  error?: string;
}

/**
 * Sync member's spending to Supabase for a specific arena
 * Also tracks when budget is exceeded or target is reached for timestamp-based winner determination
 */
export async function syncMemberSpending(
  arenaId: string,
  userId: string,
  transactions: Transaction[],
  arenaCreatedAt: string,
  targetAmount?: number,
  mode?: string,
  targetCategory?: string
): Promise<SyncResult> {
  try {
    const arenaStart = new Date(arenaCreatedAt);
    // For vice_streak mode, filter by the target category (vice)
    const spending = calculateArenaPeriodSpend(
      transactions,
      arenaStart,
      undefined,
      mode === 'vice_streak' ? targetCategory : undefined
    );

    // Get current member data to check existing timestamps
    const { data: currentMember } = await supabase
      .from('arena_members')
      .select('budget_exceeded_at, target_reached_at')
      .eq('arena_id', arenaId)
      .eq('user_id', userId)
      .single();

    // Prepare update data
    const updateData: Record<string, any> = {
      current_spend: spending.totalSpend,
      current_savings: mode === 'savings_sprint' ? spending.totalSpend : 0,
      last_synced_at: new Date().toISOString(),
    };

    let budgetExceeded = false;
    let targetReached = false;

    // Check if budget was exceeded for the first time (Budget Guardian & Vice Streak modes)
    if (targetAmount && (mode === 'budget_guardian' || mode === 'vice_streak')) {
      const memberBudgetExceededAt = currentMember?.budget_exceeded_at ?? null;
      if (spending.totalSpend > targetAmount && !memberBudgetExceededAt) {
        // Find the exact transaction that pushed over the limit
        const exceededTimestamp = findBudgetExceededTimestamp(transactions, arenaStart, targetAmount);
        updateData.budget_exceeded_at = exceededTimestamp;
        budgetExceeded = true;
        console.log(`Budget exceeded at ${exceededTimestamp} for user ${userId}`);
      }
    }

    // Check if savings target was reached for the first time (Savings Sprint mode)
    if (targetAmount && mode === 'savings_sprint') {
      // For savings sprint, current_spend actually tracks savings
      // TODO: Implement proper savings tracking
      const memberTargetReachedAt = currentMember?.target_reached_at ?? null;
      if (spending.totalSpend >= targetAmount && !memberTargetReachedAt) {
        updateData.target_reached_at = new Date().toISOString();
        targetReached = true;
        console.log(`Target reached for user ${userId}`);
      }
    }

    // Update the arena_members table
    const { error } = await supabase
      .from('arena_members')
      .update(updateData)
      .eq('arena_id', arenaId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error syncing arena spending:', error);
      return { success: false, newSpend: spending.totalSpend, budgetExceeded, targetReached, error: error.message };
    }

    console.log(`Synced spending for arena ${arenaId}: €${spending.totalSpend}`);
    return { success: true, newSpend: spending.totalSpend, budgetExceeded, targetReached };
  } catch (error: any) {
    console.error('Error in syncMemberSpending:', error);
    return { success: false, newSpend: 0, budgetExceeded: false, targetReached: false, error: error.message };
  }
}

/**
 * Find the exact timestamp when budget was exceeded by examining transactions in order
 */
function findBudgetExceededTimestamp(
  transactions: Transaction[],
  arenaStart: Date,
  targetAmount: number
): string {
  // Filter and sort transactions by date/timestamp
  const periodTransactions = transactions
    .filter(t => {
      const txnDate = new Date(t.date);
      return txnDate >= arenaStart && t.amount < 0 && t.category !== 'Transfer' && t.category !== 'Income';
    })
    .sort((a, b) => {
      // Sort by timestamp if available, otherwise by date
      const aTime = a.timestamp ? new Date(a.timestamp).getTime() : new Date(a.date).getTime();
      const bTime = b.timestamp ? new Date(b.timestamp).getTime() : new Date(b.date).getTime();
      return aTime - bTime;
    });

  // Find the transaction that pushed the total over the limit
  let runningTotal = 0;
  for (const txn of periodTransactions) {
    runningTotal += Math.abs(txn.amount);
    if (runningTotal > targetAmount) {
      // Return the timestamp of this transaction
      return txn.timestamp || `${txn.date}T12:00:00Z`;
    }
  }

  // Fallback to current time if somehow we can't find it
  return new Date().toISOString();
}

/**
 * Sync spending for all active arenas the user is in
 */
export async function syncAllArenaSpending(
  userId: string,
  transactions: Transaction[]
): Promise<{ synced: number; errors: number }> {
  let synced = 0;
  let errors = 0;

  try {
    // Get all active arenas the user is a member of
    const { data: memberships, error: fetchError } = await supabase
      .from('arena_members')
      .select(`
        arena_id,
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

    if (fetchError) {
      console.error('Error fetching memberships:', fetchError);
      return { synced: 0, errors: 1 };
    }

    // Sync each active arena
    for (const membership of memberships || []) {
      const arena = (membership as any).arenas;
      if (arena && arena.status === 'active') {
        const result = await syncMemberSpending(
          arena.id,
          userId,
          transactions,
          arena.created_at,
          arena.target_amount,
          arena.mode,
          arena.target_category
        );
        if (result.success) {
          synced++;
        } else {
          errors++;
        }
      }
    }

    console.log(`Arena sync complete: ${synced} synced, ${errors} errors`);
    return { synced, errors };
  } catch (error) {
    console.error('Error in syncAllArenaSpending:', error);
    return { synced, errors: errors + 1 };
  }
}

/**
 * Get real-time spending comparison with other arena members
 */
export async function getArenaLeaderboard(
  arenaId: string
): Promise<{ userId: string; username: string; avatar: string; spend: number; rank: number }[]> {
  try {
    const { data: members, error } = await supabase
      .from('arena_members')
      .select(`
        user_id,
        current_spend,
        users (
          username,
          avatar_url
        )
      `)
      .eq('arena_id', arenaId)
      .order('current_spend', { ascending: true });

    if (error || !members) {
      console.error('Error fetching leaderboard:', error);
      return [];
    }

    return members.map((m: any, index) => ({
      userId: m.user_id,
      username: m.users?.username || 'Unknown',
      avatar: m.users?.avatar_url || '',
      spend: m.current_spend || 0,
      rank: index + 1,
    }));
  } catch (error) {
    console.error('Error in getArenaLeaderboard:', error);
    return [];
  }
}

/**
 * Check if user is at risk of elimination (spending approaching target)
 */
export function checkEliminationRisk(
  currentSpend: number,
  targetAmount: number,
  daysRemaining: number
): { atRisk: boolean; riskLevel: 'low' | 'medium' | 'high'; message: string } {
  const spendPercentage = (currentSpend / targetAmount) * 100;

  if (spendPercentage >= 100) {
    return {
      atRisk: true,
      riskLevel: 'high',
      message: 'You have exceeded your budget limit!',
    };
  }

  if (spendPercentage >= 80) {
    return {
      atRisk: true,
      riskLevel: 'high',
      message: `You've used ${spendPercentage.toFixed(0)}% of your budget with ${daysRemaining} days left`,
    };
  }

  if (spendPercentage >= 60 && daysRemaining <= 3) {
    return {
      atRisk: true,
      riskLevel: 'medium',
      message: `${spendPercentage.toFixed(0)}% spent with only ${daysRemaining} days remaining`,
    };
  }

  return {
    atRisk: false,
    riskLevel: 'low',
    message: 'On track to stay within budget',
  };
}

export default {
  calculateArenaPeriodSpend,
  syncMemberSpending,
  syncAllArenaSpending,
  getArenaLeaderboard,
  checkEliminationRisk,
};
