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
 * Calculate spending for a specific arena period
 * @param transactions - User's transaction array
 * @param arenaStartDate - Arena start date (created_at or joined_at)
 * @param arenaEndDate - Optional arena end date (for completed arenas)
 * @param targetCategory - Optional category filter (for vice_streak mode)
 */
export function calculateArenaPeriodSpend(
  transactions: Transaction[],
  arenaStartDate: Date,
  arenaEndDate?: Date,
  targetCategory?: string
): ArenaPeriodSpending {
  const endDate = arenaEndDate || new Date();

  // Filter transactions within the arena period
  const periodTransactions = transactions.filter(t => {
    const txnDate = new Date(t.date);
    return (
      txnDate >= arenaStartDate &&
      txnDate <= endDate &&
      t.amount < 0 && // Only expenses
      t.category !== 'Transfer' && // Exclude transfers
      t.category !== 'Income' // Exclude income
    );
  });

  // If target category specified (vice_streak mode), filter further
  const filteredTransactions = targetCategory
    ? periodTransactions.filter(t => t.category.toLowerCase() === targetCategory.toLowerCase())
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

/**
 * Sync member's spending to Supabase for a specific arena
 */
export async function syncMemberSpending(
  arenaId: string,
  userId: string,
  transactions: Transaction[],
  arenaCreatedAt: string
): Promise<{ success: boolean; newSpend: number; error?: string }> {
  try {
    const arenaStart = new Date(arenaCreatedAt);
    const spending = calculateArenaPeriodSpend(transactions, arenaStart);

    // Update the arena_members table
    const { error } = await supabase
      .from('arena_members')
      .update({ current_spend: spending.totalSpend } as any)
      .eq('arena_id', arenaId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error syncing arena spending:', error);
      return { success: false, newSpend: spending.totalSpend, error: error.message };
    }

    console.log(`Synced spending for arena ${arenaId}: €${spending.totalSpend}`);
    return { success: true, newSpend: spending.totalSpend };
  } catch (error: any) {
    console.error('Error in syncMemberSpending:', error);
    return { success: false, newSpend: 0, error: error.message };
  }
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
          status
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
          arena.created_at
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
