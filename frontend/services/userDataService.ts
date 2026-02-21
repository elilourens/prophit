/**
 * User Data Service
 *
 * Manages assigning fake datasets to users on signup.
 * Tracks which datasets are used via Supabase.
 */

import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatasetById, getRandomAvailableDatasetId, UserDataset, FAKE_DATASETS } from './fakeDatasets';

const LOCAL_DATASET_KEY = '@prophit_user_dataset_id';

/**
 * Get all used dataset IDs from Supabase
 */
export const getUsedDatasetIds = async (): Promise<number[]> => {
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

/**
 * Assign a random dataset to a user on signup
 */
export const assignDatasetToUser = async (userId: string): Promise<number | null> => {
  try {
    // Get currently used dataset IDs
    const usedIds = await getUsedDatasetIds();

    // Get a random available dataset ID
    const datasetId = getRandomAvailableDatasetId(usedIds);

    if (datasetId === null) {
      console.warn('No available datasets left! Using random fallback.');
      // If all 100 are used, just pick a random one (for demo purposes)
      return Math.floor(Math.random() * 100) + 1;
    }

    // Update user record with assigned dataset
    const { error } = await supabase
      .from('users')
      .update({ dataset_id: datasetId })
      .eq('id', userId);

    if (error) {
      console.error('Error assigning dataset to user:', error);
      // Still store locally as fallback
      await AsyncStorage.setItem(LOCAL_DATASET_KEY, String(datasetId));
      return datasetId;
    }

    // Also store locally for quick access
    await AsyncStorage.setItem(LOCAL_DATASET_KEY, String(datasetId));

    console.log(`Assigned dataset ${datasetId} to user ${userId}`);
    return datasetId;
  } catch (error) {
    console.error('Error in assignDatasetToUser:', error);
    return null;
  }
};

/**
 * Get the current user's dataset ID
 */
export const getUserDatasetId = async (userId?: string): Promise<number | null> => {
  try {
    // Try local storage first (fastest)
    const localId = await AsyncStorage.getItem(LOCAL_DATASET_KEY);
    if (localId) {
      return parseInt(localId, 10);
    }

    // If we have a userId, fetch from Supabase
    if (userId) {
      const { data, error } = await supabase
        .from('users')
        .select('dataset_id')
        .eq('id', userId)
        .single();

      if (!error && data?.dataset_id) {
        // Cache locally
        await AsyncStorage.setItem(LOCAL_DATASET_KEY, String(data.dataset_id));
        return data.dataset_id;
      }
    }

    return null;
  } catch (error) {
    console.error('Error getting user dataset ID:', error);
    return null;
  }
};

/**
 * Get the current user's full dataset
 */
export const getUserDataset = async (userId?: string): Promise<UserDataset | null> => {
  const datasetId = await getUserDatasetId(userId);

  if (datasetId === null) {
    console.warn('No dataset assigned to user, using default');
    // Return first dataset as default fallback
    return FAKE_DATASETS[0];
  }

  const dataset = getDatasetById(datasetId);

  if (!dataset) {
    console.error(`Dataset ${datasetId} not found`);
    return FAKE_DATASETS[0];
  }

  return dataset;
};

/**
 * Clear locally cached dataset (for logout)
 */
export const clearUserDataset = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(LOCAL_DATASET_KEY);
  } catch (error) {
    console.error('Error clearing user dataset:', error);
  }
};

/**
 * Get dataset as JSON string (for API calls)
 */
export const getUserTransactionData = async (userId?: string): Promise<string> => {
  const dataset = await getUserDataset(userId);

  if (!dataset) {
    // Return empty default
    return JSON.stringify({ transactions: [], summary: {} });
  }

  return JSON.stringify({
    transactions: dataset.transactions,
    summary: dataset.summary,
  });
};

export default {
  getUsedDatasetIds,
  assignDatasetToUser,
  getUserDatasetId,
  getUserDataset,
  clearUserDataset,
  getUserTransactionData,
};
