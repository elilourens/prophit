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

      // PRIORITY 1: Check Supabase for synced transactions (persists across devices)
      console.log('Checking Supabase for synced transactions...');
      const supabaseDataset = await loadUserDatasetFromSupabase(userId);
      if (supabaseDataset && supabaseDataset.transactions.length > 0) {
        console.log('Loaded', supabaseDataset.transactions.length, 'transactions from Supabase');
        setUserDataset(supabaseDataset);
        setIsDataLoaded(true);
        return;
      }

      // PRIORITY 2: Try to restore uploaded data from local storage (survives app reload)
      const restoredUploaded = await restoreUploadedData();
      if (restoredUploaded) {
        const uploadedDataset = getCachedUserDataset();
        if (uploadedDataset && uploadedDataset.transactions.length > 0) {
          console.log('Using restored uploaded data:', uploadedDataset.transactions.length, 'transactions');
          // Sync to Supabase for persistence across devices
          await syncUploadedDataToSupabase(userId, uploadedDataset.transactions);
          setUserDataset(uploadedDataset);
          setIsDataLoaded(true);
          return;
        }
      }

      // PRIORITY 3: If user uploaded their own data (PDF/CSV) in memory, use that
      if (isUsingUploadedData()) {
        const uploadedDataset = getCachedUserDataset();
        if (uploadedDataset && uploadedDataset.transactions.length > 0) {
          console.log('Using uploaded user data instead of fake dataset');
          // Sync to Supabase
          await syncUploadedDataToSupabase(userId, uploadedDataset.transactions);
          setUserDataset(uploadedDataset);
          setIsDataLoaded(true);
          return;
        }
      }

      // No data found - user needs to upload data or has cleared their data
      // Don't auto-assign mock data anymore
      console.log('No transaction data found - user needs to upload data');
      setUserDataset(null);
      setIsDataLoaded(true);
    } catch (error) {
      console.error('Error loading user dataset:', error);
      // Fall back to default dataset
      initUserData(1);
      setUserDataset(getCachedUserDataset());
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
    // First try to restore from storage
    const restoredUploaded = await restoreUploadedData();
    if (restoredUploaded) {
      const uploadedDataset = getCachedUserDataset();
      if (uploadedDataset && uploadedDataset.transactions.length > 0) {
        console.log('Reloaded uploaded data from storage');
        setUserDataset(uploadedDataset);
        setIsDataLoaded(true);
        setTransactionsUpdatedAt(Date.now());
        // Sync to Supabase in background
        if (user) {
          syncUploadedDataToSupabase(user.id, uploadedDataset.transactions).then(result => {
            console.log(`Synced to Supabase: ${result.added} new, ${result.skipped} skipped`);
          }).catch(err => {
            console.error('Failed to sync to Supabase:', err);
          });
        }
        return;
      }
    }
    // If using uploaded data in memory, just refresh from cache
    if (isUsingUploadedData()) {
      const uploadedDataset = getCachedUserDataset();
      if (uploadedDataset && uploadedDataset.transactions.length > 0) {
        setUserDataset(uploadedDataset);
        setIsDataLoaded(true);
        setTransactionsUpdatedAt(Date.now());
        // Sync to Supabase in background
        if (user) {
          syncUploadedDataToSupabase(user.id, uploadedDataset.transactions).then(result => {
            console.log(`Synced to Supabase: ${result.added} new, ${result.skipped} skipped`);
          }).catch(err => {
            console.error('Failed to sync to Supabase:', err);
          });
        }
        return;
      }
    }
    if (user) {
      await loadOrAssignDataset(user.id);
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
  }) => {
    const transaction: Transaction = {
      date: transactionData.date,
      description: transactionData.description,
      amount: transactionData.amount,
      category: transactionData.category || categorizeTransaction(transactionData.description),
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
