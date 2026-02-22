/**
 * User Data Context
 *
 * Manages user transaction data with Supabase as the single source of truth.
 * Handles manual transaction entry, deletion, and arena spending sync.
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useArena } from './ArenaContext';
import { UserDataset, Transaction } from '../services/fakeDatasets';
import { categorizeTransaction } from '../services/backendApi';
import {
  loadUserDatasetFromSupabase,
  saveTransactionToSupabase,
  deleteTransactionFromSupabase,
} from '../services/transactionSyncService';
import { syncAllArenaSpending } from '../services/arenaSyncService';

interface UserDataContextType {
  userDataset: UserDataset | null;
  isDataLoaded: boolean;
  transactionsUpdatedAt: number;
  reloadUserData: () => Promise<void>;
  addTransaction: (transaction: {
    date: string;
    description: string;
    amount: number;
    category?: string;
    timestamp?: string;
  }) => Promise<void>;
  deleteTransaction: (date: string, description: string, amount: number) => Promise<void>;
}

const UserDataContext = createContext<UserDataContextType | undefined>(undefined);

export const useUserData = () => {
  const context = useContext(UserDataContext);
  if (!context) {
    throw new Error('useUserData must be used within a UserDataProvider');
  }
  return context;
};

interface UserDataProviderProps {
  children: ReactNode;
}

export const UserDataProvider: React.FC<UserDataProviderProps> = ({ children }) => {
  const { user, isAuthenticated } = useArena();
  const [userDataset, setUserDataset] = useState<UserDataset | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [transactionsUpdatedAt, setTransactionsUpdatedAt] = useState<number>(Date.now());

  // Load data when user changes
  useEffect(() => {
    if (isAuthenticated && user) {
      loadUserData(user.id);
    } else {
      setUserDataset(null);
      setIsDataLoaded(false);
    }
  }, [isAuthenticated, user?.id]);

  /**
   * Load user's transaction data from Supabase
   */
  const loadUserData = async (userId: string) => {
    try {
      setIsDataLoaded(false);
      console.log('Loading transactions from Supabase...');

      const dataset = await loadUserDatasetFromSupabase(userId);
      if (dataset && dataset.transactions.length > 0) {
        console.log('Loaded', dataset.transactions.length, 'transactions');
        setUserDataset(dataset);
      } else {
        console.log('No transactions found - user needs to add data');
        setUserDataset(null);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      setUserDataset(null);
    } finally {
      setIsDataLoaded(true);
    }
  };

  /**
   * Reload user data from Supabase
   */
  const reloadUserData = async () => {
    if (user) {
      await loadUserData(user.id);
      setTransactionsUpdatedAt(Date.now());
    }
  };

  /**
   * Add a new transaction
   * Throws error on failure for the caller to handle
   */
  const addTransaction = async (transactionData: {
    date: string;
    description: string;
    amount: number;
    category?: string;
    timestamp?: string;
  }) => {
    if (!user) {
      throw new Error('No user logged in');
    }

    const transaction: Transaction = {
      date: transactionData.date,
      description: transactionData.description,
      amount: transactionData.amount,
      category: transactionData.category || categorizeTransaction(transactionData.description),
      timestamp: transactionData.timestamp || new Date().toISOString(),
    };

    console.log('Saving transaction to Supabase...', transaction);
    const saved = await saveTransactionToSupabase(user.id, transaction);

    if (!saved) {
      throw new Error('Failed to save transaction to database');
    }

    console.log('Transaction saved! Reloading...');

    // Reload from Supabase
    const freshDataset = await loadUserDatasetFromSupabase(user.id);
    if (freshDataset) {
      setUserDataset(freshDataset);
      setTransactionsUpdatedAt(Date.now());

      // Sync arena spending
      console.log('Syncing arena spending...');
      await syncAllArenaSpending(user.id, freshDataset.transactions);
      console.log('Done!');
    }
  };

  /**
   * Delete a transaction
   */
  const deleteTransaction = async (date: string, description: string, amount: number) => {
    if (!user) {
      console.error('No user logged in');
      return;
    }

    try {
      const deleted = await deleteTransactionFromSupabase(user.id, date, description, amount);

      if (deleted) {
        // Reload from Supabase
        const freshDataset = await loadUserDatasetFromSupabase(user.id);
        if (freshDataset) {
          setUserDataset(freshDataset);
          setTransactionsUpdatedAt(Date.now());
          await syncAllArenaSpending(user.id, freshDataset.transactions);
        } else {
          setUserDataset(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete transaction:', err);
    }
  };

  return (
    <UserDataContext.Provider
      value={{
        userDataset,
        isDataLoaded,
        transactionsUpdatedAt,
        reloadUserData,
        addTransaction,
        deleteTransaction,
      }}
    >
      {children}
    </UserDataContext.Provider>
  );
};

export default UserDataContext;
