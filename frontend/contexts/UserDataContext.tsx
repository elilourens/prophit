/**
 * User Data Context
 *
 * Watches for auth changes and manages user's fake dataset assignment.
 * Works alongside ArenaContext without modifying it.
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useArena } from './ArenaContext';
import { supabase } from '../services/supabase';
import { initUserData, clearUserData, getCachedUserDataset } from '../services/backendApi';
import { UserDataset, getRandomAvailableDatasetId, getDatasetById } from '../services/fakeDatasets';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCAL_DATASET_KEY = '@prophit_user_dataset_id';

interface UserDataContextType {
  userDataset: UserDataset | null;
  isDataLoaded: boolean;
  reloadUserData: () => Promise<void>;
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

      // First check local storage (fastest)
      const localId = await AsyncStorage.getItem(LOCAL_DATASET_KEY);
      if (localId) {
        const id = parseInt(localId, 10);
        initUserData(id);
        setUserDataset(getCachedUserDataset());
        setIsDataLoaded(true);
        return;
      }

      // Check if user already has a dataset assigned in Supabase
      const { data: userData, error } = await supabase
        .from('users')
        .select('dataset_id')
        .eq('id', userId)
        .single();

      if (!error && userData?.dataset_id) {
        // User has a dataset, load it
        await AsyncStorage.setItem(LOCAL_DATASET_KEY, String(userData.dataset_id));
        initUserData(userData.dataset_id);
        setUserDataset(getCachedUserDataset());
        setIsDataLoaded(true);
        return;
      }

      // No dataset assigned - assign one now
      const usedIds = await getUsedDatasetIds();
      const newDatasetId = getRandomAvailableDatasetId(usedIds);

      if (newDatasetId === null) {
        // All datasets used, assign random one
        const randomId = Math.floor(Math.random() * 100) + 1;
        await assignDatasetToUser(userId, randomId);
        return;
      }

      await assignDatasetToUser(userId, newDatasetId);
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
      setUserDataset(getCachedUserDataset());
      setIsDataLoaded(true);

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
    if (user) {
      await loadOrAssignDataset(user.id);
    }
  };

  return (
    <UserDataContext.Provider
      value={{
        userDataset,
        isDataLoaded,
        reloadUserData,
      }}
    >
      {children}
    </UserDataContext.Provider>
  );
};

export default UserDataContext;
