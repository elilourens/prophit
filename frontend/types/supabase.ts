export type ArenaMode = 'budget_guardian' | 'vice_streak' | 'savings_sprint';
export type ArenaStatus = 'waiting' | 'active' | 'completed';
export type BetStatus = 'pending' | 'won' | 'lost';

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          username: string;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          username: string;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          avatar_url?: string | null;
          created_at?: string;
        };
      };
      arenas: {
        Row: {
          id: string;
          name: string;
          join_code: string;
          mode: ArenaMode;
          target_amount: number;
          target_category: string | null;
          created_by: string;
          status: ArenaStatus;
          stake_amount: number | null;
          created_at: string;
          ends_at: string | null;
          winner_id: string | null;
          payout_tx_signature: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          join_code: string;
          mode: ArenaMode;
          target_amount: number;
          target_category?: string | null;
          created_by: string;
          status?: ArenaStatus;
          stake_amount?: number | null;
          created_at?: string;
          ends_at?: string | null;
          winner_id?: string | null;
          payout_tx_signature?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          join_code?: string;
          mode?: ArenaMode;
          target_amount?: number;
          target_category?: string | null;
          created_by?: string;
          status?: ArenaStatus;
          stake_amount?: number | null;
          created_at?: string;
          ends_at?: string | null;
          winner_id?: string | null;
          payout_tx_signature?: string | null;
        };
      };
      arena_members: {
        Row: {
          id: string;
          arena_id: string;
          user_id: string;
          current_spend: number;
          current_savings: number;
          is_eliminated: boolean;
          joined_at: string;
          budget_exceeded_at: string | null;
          target_reached_at: string | null;
          last_synced_at: string;
        };
        Insert: {
          id?: string;
          arena_id: string;
          user_id: string;
          current_spend?: number;
          current_savings?: number;
          is_eliminated?: boolean;
          joined_at?: string;
          budget_exceeded_at?: string | null;
          target_reached_at?: string | null;
          last_synced_at?: string;
        };
        Update: {
          id?: string;
          arena_id?: string;
          user_id?: string;
          current_spend?: number;
          current_savings?: number;
          is_eliminated?: boolean;
          joined_at?: string;
          budget_exceeded_at?: string | null;
          target_reached_at?: string | null;
          last_synced_at?: string;
        };
      };
      arena_bets: {
        Row: {
          id: string;
          arena_id: string;
          bet_type: string;
          description: string;
          stake_amount: number;
          status: BetStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          arena_id: string;
          bet_type: string;
          description: string;
          stake_amount: number;
          status?: BetStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          arena_id?: string;
          bet_type?: string;
          description?: string;
          stake_amount?: number;
          status?: BetStatus;
          created_at?: string;
        };
      };
    };
  };
}

// Helper types
export type User = Database['public']['Tables']['users']['Row'];
export type Arena = Database['public']['Tables']['arenas']['Row'];
export type ArenaMember = Database['public']['Tables']['arena_members']['Row'];
export type ArenaBet = Database['public']['Tables']['arena_bets']['Row'];

// Extended types with joins
export type ArenaMemberWithUser = ArenaMember & {
  users: User;
};

export type ArenaWithMembers = Arena & {
  arena_members: ArenaMemberWithUser[];
  member_count?: number;
};
