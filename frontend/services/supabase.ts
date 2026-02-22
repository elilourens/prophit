import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: AsyncStorage,
    // Disable lock to prevent timeout issues on React Native
    lock: async (name, acquireTimeout, fn) => {
      return await fn();
    },
  },
});

export default supabase;
