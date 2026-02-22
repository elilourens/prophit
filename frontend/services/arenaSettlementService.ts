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
    budgetExceededAt: string | null;
    targetReachedAt: string | null;
    lastSyncedAt: string | null;
  }[];
  winnerId: string | null;
  allSynced: boolean;
}

/**
 * Extended member type with timestamp fields
 * Note: Uses intersection type to add optional fields that may not be present in base type
 */
type ArenaMemberWithTimestamps = ArenaMemberWithUser & {
  budget_exceeded_at?: string | null;
  target_reached_at?: string | null;
  last_synced_at?: string | null;
};

/**
 * Check if all members have synced their data (for accurate winner determination)
 */
export function allMembersSynced(arena: ArenaWithMembers): boolean {
  const members = arena.arena_members || [];
  if (members.length === 0) return false;

  // Check if all members have synced within the last hour
  // (In production, you might want a tighter window or require explicit sync)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  return members.every(m => {
    const member = m as ArenaMemberWithTimestamps;
    return member.last_synced_at && member.last_synced_at > oneHourAgo;
  });
}

/**
 * Determine the winner of an arena based on its mode
 * Uses timestamps for tiebreaking when applicable
 */
export function determineWinner(arena: ArenaWithMembers): ArenaMemberWithUser | null {
  const members = arena.arena_members || [];
  if (members.length === 0) return null;

  // Filter out eliminated members
  const activeMembers = members.filter(m => !m.is_eliminated);
  if (activeMembers.length === 0) return null;

  // Sort based on mode with timestamp tiebreaking
  const sorted = [...activeMembers].sort((a, b) => {
    const aMember = a as ArenaMemberWithTimestamps;
    const bMember = b as ArenaMemberWithTimestamps;

    switch (arena.mode) {
      case 'budget_guardian':
        // Winner: Under budget
        // If both over budget: First to exceed LOSES (so last to exceed wins)
        // If both under budget: Lowest spend wins
        const aUnderTarget = a.current_spend <= arena.target_amount;
        const bUnderTarget = b.current_spend <= arena.target_amount;

        if (aUnderTarget && !bUnderTarget) return -1; // a wins (under budget)
        if (!aUnderTarget && bUnderTarget) return 1;  // b wins (under budget)

        // Both over budget - first to exceed loses
        if (!aUnderTarget && !bUnderTarget) {
          const aExceeded = aMember.budget_exceeded_at ? new Date(aMember.budget_exceeded_at).getTime() : Infinity;
          const bExceeded = bMember.budget_exceeded_at ? new Date(bMember.budget_exceeded_at).getTime() : Infinity;
          // Later timestamp = better (last to exceed wins)
          return bExceeded - aExceeded;
        }

        // Both under budget - lowest spend wins
        return a.current_spend - b.current_spend;

      case 'vice_streak':
        // Winner: No spending in target category
        // If both have zero spend: Both win (tie)
        // If both have spend: First to spend in forbidden category LOSES
        const aSpent = a.current_spend > 0;
        const bSpent = b.current_spend > 0;

        if (!aSpent && bSpent) return -1; // a wins (no forbidden spending)
        if (aSpent && !bSpent) return 1;  // b wins (no forbidden spending)

        // Both have spent in forbidden category - first to spend loses
        if (aSpent && bSpent) {
          const aExceeded = aMember.budget_exceeded_at ? new Date(aMember.budget_exceeded_at).getTime() : Infinity;
          const bExceeded = bMember.budget_exceeded_at ? new Date(bMember.budget_exceeded_at).getTime() : Infinity;
          // Later timestamp = better (last to fail wins)
          return bExceeded - aExceeded;
        }

        // Both have zero spend - tie (either can win)
        return 0;

      case 'savings_sprint':
        // Winner: First to reach savings target
        // If both reached target: First to reach WINS (earliest timestamp wins)
        // If neither reached target: Highest savings wins
        const aReachedTarget = a.current_savings >= arena.target_amount;
        const bReachedTarget = b.current_savings >= arena.target_amount;

        if (aReachedTarget && !bReachedTarget) return -1; // a wins (reached target)
        if (!aReachedTarget && bReachedTarget) return 1;  // b wins (reached target)

        // Both reached target - first to reach wins
        if (aReachedTarget && bReachedTarget) {
          const aReached = aMember.target_reached_at ? new Date(aMember.target_reached_at).getTime() : Infinity;
          const bReached = bMember.target_reached_at ? new Date(bMember.target_reached_at).getTime() : Infinity;
          // Earlier timestamp = better (first to reach wins)
          return aReached - bReached;
        }

        // Neither reached target - highest savings wins
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

  // Sort members by performance (mode-dependent, using timestamp tiebreaking)
  const sorted = [...members].sort((a, b) => {
    if (a.is_eliminated && !b.is_eliminated) return 1;
    if (!a.is_eliminated && b.is_eliminated) return -1;

    const aMember = a as ArenaMemberWithTimestamps;
    const bMember = b as ArenaMemberWithTimestamps;

    switch (arena.mode) {
      case 'savings_sprint':
        // Higher savings = better rank
        if (b.current_savings !== a.current_savings) {
          return b.current_savings - a.current_savings;
        }
        // Tiebreaker: earlier target_reached_at wins
        const aReached = aMember.target_reached_at ? new Date(aMember.target_reached_at).getTime() : Infinity;
        const bReached = bMember.target_reached_at ? new Date(bMember.target_reached_at).getTime() : Infinity;
        return aReached - bReached;

      case 'budget_guardian':
      case 'vice_streak':
        // Lower spend = better rank (if under target)
        const aUnder = a.current_spend <= arena.target_amount;
        const bUnder = b.current_spend <= arena.target_amount;
        if (aUnder && !bUnder) return -1;
        if (!aUnder && bUnder) return 1;
        if (!aUnder && !bUnder) {
          // Both exceeded - later exceeded_at = better rank
          const aExceeded = aMember.budget_exceeded_at ? new Date(aMember.budget_exceeded_at).getTime() : 0;
          const bExceeded = bMember.budget_exceeded_at ? new Date(bMember.budget_exceeded_at).getTime() : 0;
          return bExceeded - aExceeded;
        }
        return a.current_spend - b.current_spend;

      default:
        return a.current_spend - b.current_spend;
    }
  });

  const winner = determineWinner(arena);

  return {
    members: sorted.map((m, index) => {
      const member = m as ArenaMemberWithTimestamps;
      return {
        userId: m.user_id,
        username: m.users?.username || 'Unknown',
        avatar: m.users?.avatar_url || '',
        spend: m.current_spend,
        savings: m.current_savings,
        rank: index + 1,
        isEliminated: m.is_eliminated,
        budgetExceededAt: member.budget_exceeded_at || null,
        targetReachedAt: member.target_reached_at || null,
        lastSyncedAt: member.last_synced_at || null,
      };
    }),
    winnerId: winner?.user_id || null,
    allSynced: allMembersSynced(arena),
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
 * Check if arena can be settled (has at least 2 members, is active, and all members synced)
 */
export function canSettleArena(arena: ArenaWithMembers): boolean {
  return (
    arena.status === 'active' &&
    (arena.arena_members?.length || 0) >= 2 &&
    allMembersSynced(arena)
  );
}

/**
 * Get reason why arena cannot be settled
 */
export function getSettlementBlockReason(arena: ArenaWithMembers): string | null {
  if (arena.status !== 'active') {
    return 'Arena is not active';
  }
  if ((arena.arena_members?.length || 0) < 2) {
    return 'Arena needs at least 2 members';
  }
  if (!allMembersSynced(arena)) {
    const members = arena.arena_members || [];
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const unsyncedMembers = members.filter(m => {
      const member = m as ArenaMemberWithTimestamps;
      return !member.last_synced_at || member.last_synced_at < oneHourAgo;
    });
    const names = unsyncedMembers.map(m => m.users?.username || 'Unknown').join(', ');
    return `Waiting for members to sync: ${names}`;
  }
  return null;
}

export default {
  determineWinner,
  getArenaStandings,
  calculatePrizePool,
  settleArena,
  getSettlementSummary,
  isArenaCreator,
  canSettleArena,
  allMembersSynced,
  getSettlementBlockReason,
};
