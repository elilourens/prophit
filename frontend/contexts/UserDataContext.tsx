/**
 * User Data Context
 *
 * Watches for auth changes and manages user's fake dataset assignment.
 * Works alongside ArenaContext without modifying it.
 * Also handles manual transaction entry and deletion.
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useArena } from './ArenaContext';
import { supabase } from '../services/supabase';
import {
  initUserData,
  clearUserData,
  getCachedUserDataset,
  isUsingUploadedData,
  restoreUploadedData,
  addTransactionToDataset,
  removeTransactionFromDataset,
  categorizeTransaction,
} from '../services/backendApi';
import { UserDataset, Transaction, getRandomAvailableDatasetId, getDatasetById } from '../services/fakeDatasets';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadUserDatasetFromSupabase,
  saveTransactionToSupabase,
  deleteTransactionFromSupabase,
  syncUploadedDataToSupabase,
} from '../services/transactionSyncService';

const LOCAL_DATASET_KEY = '@prophit_user_dataset_id';

interface UserDataContextType {
  userDataset: UserDataset | null;
  isDataLoaded: boolean;
  transactionsUpdatedAt: number; // Timestamp to trigger re-renders
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

  // Watch for user changes
  useEffect(() => {
    if (isAuthenticated && user) {
      loadOrAssignDataset(user.id);
    } else {
      // User logged out
      clearUserData();
      setUserDataset(null);
      setIsDataLoaded(false);
      AsyncStorage.removeItem(LOCAL_DATASET_KEY);
    }
  }, [isAuthenticated, user?.id]);

  const loadOrAssignDataset = async (userId: string) => {
    try {
      setIsDataLoaded(false);

      // Only check Supabase for transactions - that's the single source of truth
      console.log('Checking Supabase for transactions...');
      const supabaseDataset = await loadUserDatasetFromSupabase(userId);
      if (supabaseDataset && supabaseDataset.transactions.length > 0) {
        console.log('Loaded', supabaseDataset.transactions.length, 'transactions from Supabase');
        setUserDataset(supabaseDataset);
        setIsDataLoaded(true);
        return;
      }

      // No data found - user needs to upload data
      console.log('No transaction data found - user needs to upload data');
      setUserDataset(null);
      setIsDataLoaded(true);
    } catch (error) {
      console.error('Error loading user dataset:', error);
      setUserDataset(null);
      setIsDataLoaded(true);
    }
  };

  const assignDatasetToUser = async (userId: string, datasetId: number) => {
    try {
      // Update Supabase
      const { error } = await supabase
        .from('users')
        .update({ dataset_id: datasetId })
        .eq('id', userId);

      if (error) {
        console.error('Error assigning dataset:', error);
        // Column might not exist yet, continue anyway
      }

      // Store locally
      await AsyncStorage.setItem(LOCAL_DATASET_KEY, String(datasetId));

      // Load the dataset
      initUserData(datasetId);
      const dataset = getCachedUserDataset();
      setUserDataset(dataset);
      setIsDataLoaded(true);

      // Sync mock dataset transactions to Supabase so arenas work
      if (dataset && dataset.transactions.length > 0) {
        console.log(`Syncing mock dataset ${datasetId} (${dataset.transactions.length} txns) to Supabase...`);
        syncUploadedDataToSupabase(userId, dataset.transactions).then(result => {
          console.log(`Mock data synced: ${result.added} new, ${result.skipped} skipped`);
        }).catch(err => {
          console.error('Failed to sync mock data:', err);
        });
      }

      console.log(`Assigned dataset ${datasetId} to user ${userId}`);
    } catch (error) {
      console.error('Error in assignDatasetToUser:', error);
      // Still load the dataset locally
      initUserData(datasetId);
      setUserDataset(getCachedUserDataset());
      setIsDataLoaded(true);
    }
  };

  const getUsedDatasetIds = async (): Promise<number[]> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('dataset_id')
        .not('dataset_id', 'is', null);

      if (error) {
        console.error('Error fetching used datasets:', error);
        return [];
      }

      return data?.map(row => row.dataset_id).filter(Boolean) || [];
    } catch (error) {
      console.error('Error in getUsedDatasetIds:', error);
      return [];
    }
  };

  const reloadUserData = async () => {
    // Just reload from the main loader which checks Supabase first
    if (user) {
      await loadOrAssignDataset(user.id);
      setTransactionsUpdatedAt(Date.now());
    } else {
      setUserDataset(null);
      setIsDataLoaded(true);
    }
  };

  /**
   * Add a new transaction to the dataset
   */
  const addTransaction = async (transactionData: {
    date: string;
    description: string;
    amount: number;
    category?: string;
    timestamp?: string;
  }) => {
    const transaction: Transaction = {
      date: transactionData.date,
      description: transactionData.description,
      amount: transactionData.amount,
      category: transactionData.category || categorizeTransaction(transactionData.description),
      timestamp: transactionData.timestamp || new Date().toISOString(),
    };

    // Add to local storage first
    const updatedDataset = await addTransactionToDataset(transaction);
    if (updatedDataset) {
      setUserDataset(updatedDataset);
      setTransactionsUpdatedAt(Date.now());
      console.log('Transaction added, updated timestamp:', Date.now());
    }

    // Sync to Supabase (async, don't block UI)
    if (user) {
      saveTransactionToSupabase(user.id, transaction).catch(err => {
        console.error('Failed to sync transaction to Supabase:', err);
      });
    }
  };

  /**
   * Delete a transaction from the dataset
   */
  const deleteTransaction = async (date: string, description: string, amount: number) => {
    // Remove from local storage first
    const updatedDataset = await removeTransactionFromDataset(date, description, amount);
    if (updatedDataset) {
      setUserDataset(updatedDataset);
      setTransactionsUpdatedAt(Date.now());
      console.log('Transaction deleted, updated timestamp:', Date.now());
    }

    // Sync to Supabase (async, don't block UI)
    if (user) {
      deleteTransactionFromSupabase(user.id, date, description, amount).catch(err => {
        console.error('Failed to delete transaction from Supabase:', err);
      });
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
