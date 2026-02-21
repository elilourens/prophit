-- =============================================
-- PROPHIT ARENA SCHEMA
-- Copy and paste this into Supabase SQL Editor
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- USERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can read all users (for leaderboards)
CREATE POLICY "Users are viewable by everyone" ON public.users
  FOR SELECT USING (true);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- =============================================
-- ARENAS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.arenas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  join_code TEXT NOT NULL UNIQUE,
  mode TEXT NOT NULL CHECK (mode IN ('budget_guardian', 'vice_streak', 'savings_sprint')),
  target_amount DECIMAL(10, 2) NOT NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'completed')),
  stake_amount DECIMAL(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ends_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.arenas ENABLE ROW LEVEL SECURITY;

-- Arenas are viewable by everyone
CREATE POLICY "Arenas are viewable by everyone" ON public.arenas
  FOR SELECT USING (true);

-- Authenticated users can create arenas
CREATE POLICY "Authenticated users can create arenas" ON public.arenas
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Arena creators can update their arenas
CREATE POLICY "Creators can update arenas" ON public.arenas
  FOR UPDATE USING (auth.uid() = created_by);

-- =============================================
-- ARENA MEMBERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.arena_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  arena_id UUID REFERENCES public.arenas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  current_spend DECIMAL(10, 2) DEFAULT 0,
  current_savings DECIMAL(10, 2) DEFAULT 0,
  is_eliminated BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(arena_id, user_id)
);

-- Enable RLS
ALTER TABLE public.arena_members ENABLE ROW LEVEL SECURITY;

-- Arena members are viewable by everyone (for leaderboards)
CREATE POLICY "Arena members are viewable by everyone" ON public.arena_members
  FOR SELECT USING (true);

-- Authenticated users can join arenas
CREATE POLICY "Authenticated users can join arenas" ON public.arena_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Members can update their own data
CREATE POLICY "Members can update own data" ON public.arena_members
  FOR UPDATE USING (auth.uid() = user_id);

-- =============================================
-- ARENA BETS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.arena_bets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  arena_id UUID REFERENCES public.arenas(id) ON DELETE CASCADE,
  bet_type TEXT NOT NULL,
  description TEXT NOT NULL,
  stake_amount DECIMAL(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.arena_bets ENABLE ROW LEVEL SECURITY;

-- Bets are viewable by everyone
CREATE POLICY "Bets are viewable by everyone" ON public.arena_bets
  FOR SELECT USING (true);

-- Authenticated users can create bets
CREATE POLICY "Authenticated users can create bets" ON public.arena_bets
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================
-- ENABLE REALTIME
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.arena_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.arenas;

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX IF NOT EXISTS idx_arenas_join_code ON public.arenas(join_code);
CREATE INDEX IF NOT EXISTS idx_arenas_status ON public.arenas(status);
CREATE INDEX IF NOT EXISTS idx_arena_members_arena_id ON public.arena_members(arena_id);
CREATE INDEX IF NOT EXISTS idx_arena_members_user_id ON public.arena_members(user_id);

-- =============================================
-- FUNCTION: Generate unique 6-digit join code
-- =============================================
CREATE OR REPLACE FUNCTION generate_join_code()
RETURNS TEXT AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    new_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    SELECT EXISTS(SELECT 1 FROM public.arenas WHERE join_code = new_code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;
