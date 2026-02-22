import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../services/supabase';
import { User, Arena, ArenaMember, ArenaWithMembers, ArenaMemberWithUser } from '../types/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Transaction } from '../services/fakeDatasets';
import { syncMemberSpending, calculateArenaPeriodSpend } from '../services/arenaSyncService';
import { determineWinner as determineArenaWinner } from '../services/arenaSettlementService';

interface ArenaContextType {
  // User state
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Auth methods
  signUp: (email: string, password: string, username: string, avatarUrl: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;

  // Arena state
  myArenas: ArenaWithMembers[];
  currentArena: ArenaWithMembers | null;

  // Arena methods
  createArena: (name: string, mode: string, targetAmount: number, stakeAmount?: number, endsAt?: string) => Promise<Arena>;
  joinArena: (joinCode: string) => Promise<Arena>;
  fetchArenaByCode: (joinCode: string) => Promise<ArenaWithMembers | null>;
  fetchArenaById: (id: string) => Promise<ArenaWithMembers | null>;
  fetchMyArenas: () => Promise<void>;
  setCurrentArena: (arena: ArenaWithMembers | null) => void;
  updateMemberSpend: (memberId: string, spend: number) => Promise<void>;
  subscribeToArena: (arenaId: string) => RealtimeChannel;
  unsubscribeFromArena: (channel: RealtimeChannel) => void;

  // Sync methods
  syncMyArenaSpending: (arenaId: string, transactions: Transaction[]) => Promise<void>;
  endArena: (arenaId: string) => Promise<{ winnerId: string; winnerUsername: string } | null>;
  getArenaWinner: (arena: ArenaWithMembers) => ArenaMemberWithUser | null;
}

const ArenaContext = createContext<ArenaContextType | undefined>(undefined);

export const useArena = () => {
  const context = useContext(ArenaContext);
  if (!context) {
    throw new Error('useArena must be used within an ArenaProvider');
  }
  return context;
};

interface ArenaProviderProps {
  children: ReactNode;
}

export const ArenaProvider: React.FC<ArenaProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [myArenas, setMyArenas] = useState<ArenaWithMembers[]>([]);
  const [currentArena, setCurrentArena] = useState<ArenaWithMembers | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    checkUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        await loadUserProfile(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setMyArenas([]);
        setCurrentArena(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Try to load profile
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profile) {
          setUser(profile);
        } else {
          // Profile missing, create it
          const email = session.user.email || '';
          const username = email.split('@')[0] || 'user';
          const { data: newProfile } = await supabase
            .from('users')
            .insert({
              id: session.user.id,
              username: username,
              avatar_url: '😎',
            })
            .select()
            .single();

          if (newProfile) {
            setUser(newProfile);
          }
        }
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserProfile = async (userId: string) => {
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (profile) {
      setUser(profile);
    }
  };

  const signUp = async (email: string, password: string, username: string, avatarUrl: string) => {
    setIsLoading(true);
    try {
      // Sign up with email/password
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('No user returned');

      // Create user profile
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          username,
          avatar_url: avatarUrl,
        })
        .select()
        .single();

      if (profileError) throw profileError;

      setUser(profile);
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('No user returned');

      // Try to load user profile
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profile) {
        setUser(profile);
      } else {
        // Profile doesn't exist, create it with email as username
        const username = email.split('@')[0];
        const { data: newProfile, error: profileError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            username: username,
            avatar_url: '😎',
          })
          .select()
          .single();

        if (profileError) throw profileError;
        setUser(newProfile);
      }
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setMyArenas([]);
    setCurrentArena(null);
  };

  const generateJoinCode = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const createArena = async (
    name: string,
    mode: string,
    targetAmount: number,
    stakeAmount?: number,
    endsAt?: string
  ): Promise<Arena> => {
    if (!user) throw new Error('Must be signed in');

    const joinCode = generateJoinCode();

    const { data: arena, error } = await supabase
      .from('arenas')
      .insert({
        name,
        join_code: joinCode,
        mode: mode as any,
        target_amount: targetAmount,
        created_by: user.id,
        stake_amount: stakeAmount || null,
        status: 'active', // Start as active immediately
        ends_at: endsAt || null,
      })
      .select()
      .single();

    if (error) throw error;

    // Auto-join the arena as creator
    await supabase.from('arena_members').insert({
      arena_id: arena.id,
      user_id: user.id,
    });

    await fetchMyArenas();
    return arena;
  };

  const joinArena = async (joinCode: string): Promise<Arena> => {
    if (!user) throw new Error('Must be signed in');

    // Find arena by code
    const { data: arena, error: findError } = await supabase
      .from('arenas')
      .select('*')
      .eq('join_code', joinCode)
      .single();

    if (findError || !arena) throw new Error('Arena not found');

    // Check if already a member
    const { data: existingMember } = await supabase
      .from('arena_members')
      .select('*')
      .eq('arena_id', arena.id)
      .eq('user_id', user.id)
      .single();

    if (existingMember) throw new Error('Already in this arena');

    // Join the arena
    const { error: joinError } = await supabase.from('arena_members').insert({
      arena_id: arena.id,
      user_id: user.id,
    });

    if (joinError) throw joinError;

    await fetchMyArenas();
    return arena;
  };

  const fetchArenaByCode = async (joinCode: string): Promise<ArenaWithMembers | null> => {
    const { data: arena, error } = await supabase
      .from('arenas')
      .select(`
        *,
        arena_members (
          *,
          users (*)
        )
      `)
      .eq('join_code', joinCode)
      .single();

    if (error) return null;
    return arena as ArenaWithMembers;
  };

  const fetchArenaById = async (id: string): Promise<ArenaWithMembers | null> => {
    const { data: arena, error } = await supabase
      .from('arenas')
      .select(`
        *,
        arena_members (
          *,
          users (*)
        )
      `)
      .eq('id', id)
      .single();

    if (error) return null;
    return arena as ArenaWithMembers;
  };

  const fetchMyArenas = async () => {
    if (!user) return;

    const { data: memberships, error } = await supabase
      .from('arena_members')
      .select(`
        arena_id,
        arenas (
          *,
          arena_members (
            *,
            users (*)
          )
        )
      `)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching arenas:', error);
      return;
    }

    const arenas = memberships
      ?.map((m: any) => m.arenas)
      .filter(Boolean) as ArenaWithMembers[];

    setMyArenas(arenas || []);
  };

  const updateMemberSpend = async (memberId: string, spend: number) => {
    const { error } = await supabase
      .from('arena_members')
      .update({ current_spend: spend })
      .eq('id', memberId);

    if (error) throw error;
  };

  const subscribeToArena = (arenaId: string): RealtimeChannel => {
    const channel = supabase
      .channel(`arena-${arenaId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'arena_members',
          filter: `arena_id=eq.${arenaId}`,
        },
        async () => {
          const updated = await fetchArenaById(arenaId);
          if (updated) {
            setCurrentArena(updated);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'arenas',
          filter: `id=eq.${arenaId}`,
        },
        async () => {
          const updated = await fetchArenaById(arenaId);
          if (updated) {
            setCurrentArena(updated);
          }
        }
      )
      .subscribe();

    return channel;
  };

  const unsubscribeFromArena = (channel: RealtimeChannel) => {
    supabase.removeChannel(channel);
  };

  /**
   * Sync current user's spending for a specific arena
   */
  const syncMyArenaSpending = async (arenaId: string, transactions: Transaction[]) => {
    if (!user) return;

    const arena = await fetchArenaById(arenaId);
    if (!arena) return;

    const result = await syncMemberSpending(
      arenaId,
      user.id,
      transactions,
      arena.created_at,
      arena.target_amount,
      arena.mode
    );

    if (result.success) {
      // Refresh arena data to reflect new spending
      const updated = await fetchArenaById(arenaId);
      if (updated && currentArena?.id === arenaId) {
        setCurrentArena(updated);
      }
      await fetchMyArenas();
    }
  };

  /**
   * Determine the winner of an arena based on mode (uses centralized settlement logic)
   */
  const getArenaWinner = (arena: ArenaWithMembers): ArenaMemberWithUser | null => {
    return determineArenaWinner(arena);
  };

  /**
   * End an arena and determine the winner
   */
  const endArena = async (arenaId: string): Promise<{ winnerId: string; winnerUsername: string } | null> => {
    if (!user) return null;

    const arena = await fetchArenaById(arenaId);
    if (!arena) {
      console.error('Arena not found');
      return null;
    }

    // Only creator can end the arena
    if (arena.created_by !== user.id) {
      console.error('Only arena creator can end the arena');
      return null;
    }

    // Determine winner
    const winner = getArenaWinner(arena);
    if (!winner) {
      console.error('No valid winner found');
      return null;
    }

    // Update arena status to completed and set winner
    const { error } = await supabase
      .from('arenas')
      .update({
        status: 'completed',
        winner_id: winner.user_id,
      } as any)
      .eq('id', arenaId);

    if (error) {
      console.error('Error ending arena:', error);
      return null;
    }

    // Refresh arena data
    const updated = await fetchArenaById(arenaId);
    if (updated) {
      setCurrentArena(updated);
    }
    await fetchMyArenas();

    return {
      winnerId: winner.user_id,
      winnerUsername: winner.users?.username || 'Unknown',
    };
  };

  // Fetch arenas when user changes
  useEffect(() => {
    if (user) {
      fetchMyArenas();
    }
  }, [user]);

  return (
    <ArenaContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        signUp,
        signIn,
        signOut,
        myArenas,
        currentArena,
        createArena,
        joinArena,
        fetchArenaByCode,
        fetchArenaById,
        fetchMyArenas,
        setCurrentArena,
        updateMemberSpend,
        subscribeToArena,
        unsubscribeFromArena,
        syncMyArenaSpending,
        endArena,
        getArenaWinner,
      }}
    >
      {children}
    </ArenaContext.Provider>
  );
};
