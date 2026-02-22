/**
 * Arena Settlement Service
 *
 * Handles arena completion, winner determination, and payout processing.
 */

import { supabase } from './supabase';
import { ArenaWithMembers, ArenaMemberWithUser, ArenaMode } from '../types/supabase';

export interface SettlementResult {
  success: boolean;
  winnerId?: string;
  winnerUsername?: string;
  winnerAvatar?: string;
  prizeAmount?: number;
  txSignature?: string;
  explorerUrl?: string;
  error?: string;
}

export interface ArenaStandings {
  members: {
    userId: string;
    username: string;
    avatar: string;
    spend: number;
    savings: number;
    rank: number;
    isEliminated: boolean;
  }[];
  winnerId: string | null;
}

/**
 * Determine the winner of an arena based on its mode
 */
export function determineWinner(arena: ArenaWithMembers): ArenaMemberWithUser | null {
  const members = arena.arena_members || [];
  if (members.length === 0) return null;

  // Filter out eliminated members
  const activeMembers = members.filter(m => !m.is_eliminated);
  if (activeMembers.length === 0) return null;

  // Sort based on mode
  const sorted = [...activeMembers].sort((a, b) => {
    switch (arena.mode) {
      case 'budget_guardian':
        // Winner: Lowest spend under target
        // If both over target, neither wins; if both under, lowest spend wins
        const aUnderTarget = a.current_spend <= arena.target_amount;
        const bUnderTarget = b.current_spend <= arena.target_amount;

        if (aUnderTarget && !bUnderTarget) return -1;
        if (!aUnderTarget && bUnderTarget) return 1;
        return a.current_spend - b.current_spend;

      case 'vice_streak':
        // Winner: Lowest spend in target category (tracked in current_spend)
        return a.current_spend - b.current_spend;

      case 'savings_sprint':
        // Winner: Highest savings
        return b.current_savings - a.current_savings;

      default:
        return a.current_spend - b.current_spend;
    }
  });

  return sorted[0];
}

/**
 * Get final standings for an arena
 */
export function getArenaStandings(arena: ArenaWithMembers): ArenaStandings {
  const members = arena.arena_members || [];

  // Sort members by performance (mode-dependent)
  const sorted = [...members].sort((a, b) => {
    if (a.is_eliminated && !b.is_eliminated) return 1;
    if (!a.is_eliminated && b.is_eliminated) return -1;

    switch (arena.mode) {
      case 'savings_sprint':
        return b.current_savings - a.current_savings;
      default:
        return a.current_spend - b.current_spend;
    }
  });

  const winner = determineWinner(arena);

  return {
    members: sorted.map((m, index) => ({
      userId: m.user_id,
      username: m.users?.username || 'Unknown',
      avatar: m.users?.avatar_url || '',
      spend: m.current_spend,
      savings: m.current_savings,
      rank: index + 1,
      isEliminated: m.is_eliminated,
    })),
    winnerId: winner?.user_id || null,
  };
}

/**
 * Calculate the total prize pool for an arena
 */
export function calculatePrizePool(arena: ArenaWithMembers): number {
  if (!arena.stake_amount) return 0;
  const memberCount = arena.arena_members?.length || 0;
  return arena.stake_amount * memberCount;
}

/**
 * Mark an arena as completed and record the winner
 */
export async function settleArena(arenaId: string): Promise<SettlementResult> {
  try {
    // Fetch the arena with members
    const { data: arena, error: fetchError } = await supabase
      .from('arenas')
      .select(`
        *,
        arena_members (
          *,
          users (*)
        )
      `)
      .eq('id', arenaId)
      .single();

    if (fetchError || !arena) {
      return { success: false, error: 'Arena not found' };
    }

    // Determine winner
    const winner = determineWinner(arena as ArenaWithMembers);
    if (!winner) {
      return { success: false, error: 'No valid winner found' };
    }

    // Update arena status to completed
    const { error: updateError } = await supabase
      .from('arenas')
      .update({
        status: 'completed',
        winner_id: winner.user_id,
      } as any)
      .eq('id', arenaId);

    if (updateError) {
      console.error('Error updating arena:', updateError);
      return { success: false, error: 'Failed to update arena status' };
    }

    const prizePool = calculatePrizePool(arena as ArenaWithMembers);

    return {
      success: true,
      winnerId: winner.user_id,
      winnerUsername: winner.users?.username || 'Unknown',
      winnerAvatar: winner.users?.avatar_url || '',
      prizeAmount: prizePool,
    };
  } catch (error: any) {
    console.error('Error settling arena:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get settlement summary for display
 */
export function getSettlementSummary(arena: ArenaWithMembers): {
  totalParticipants: number;
  eliminated: number;
  remaining: number;
  totalSpent: number;
  avgSpent: number;
  prizePool: number;
  winner: ArenaMemberWithUser | null;
} {
  const members = arena.arena_members || [];
  const eliminated = members.filter(m => m.is_eliminated).length;
  const remaining = members.length - eliminated;
  const totalSpent = members.reduce((sum, m) => sum + m.current_spend, 0);
  const avgSpent = members.length > 0 ? totalSpent / members.length : 0;

  return {
    totalParticipants: members.length,
    eliminated,
    remaining,
    totalSpent,
    avgSpent,
    prizePool: calculatePrizePool(arena),
    winner: determineWinner(arena),
  };
}

/**
 * Check if current user is the arena creator
 */
export function isArenaCreator(arena: ArenaWithMembers, userId: string): boolean {
  return arena.created_by === userId;
}

/**
 * Check if arena can be settled (has at least 2 members and is active)
 */
export function canSettleArena(arena: ArenaWithMembers): boolean {
  return (
    arena.status === 'active' &&
    (arena.arena_members?.length || 0) >= 2
  );
}

export default {
  determineWinner,
  getArenaStandings,
  calculatePrizePool,
  settleArena,
  getSettlementSummary,
  isArenaCreator,
  canSettleArena,
};
