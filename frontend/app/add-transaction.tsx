import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { theme } from '../components/theme';
import { useUserData } from '../contexts/UserDataContext';
import { useArena } from '../contexts/ArenaContext';
import { categorizeTransaction, parseFileToTransactions, parsePDFToTransactions } from '../services/backendApi';
import { syncUploadedDataToSupabase, loadTransactionsFromSupabase } from '../services/transactionSyncService';
import { syncAllArenaSpending } from '../services/arenaSyncService';
import { showAlert, readFileAsString, readFileAsBase64 } from '../utils/crossPlatform';

// Common merchants for autocomplete
const COMMON_MERCHANTS = [
  'Tesco', 'Lidl', 'Aldi', 'Dunnes', 'SuperValu',
  'Starbucks', 'Costa', 'Cafe Nero',
  'Uber', 'Bolt', 'Irish Rail', 'Dublin Bus', 'Luas',
  'Netflix', 'Spotify', 'Amazon Prime',
  'Amazon', 'Penneys', 'Zara', 'H&M',
];

// Category options
const CATEGORIES = [
  { name: 'Groceries', icon: 'cart' },
  { name: 'Dining', icon: 'restaurant' },
  { name: 'Coffee', icon: 'cafe' },
  { name: 'Transport', icon: 'car' },
  { name: 'Shopping', icon: 'bag' },
  { name: 'Subscriptions', icon: 'repeat' },
  { name: 'Entertainment', icon: 'film' },
  { name: 'Utilities', icon: 'flash' },
  { name: 'Rent', icon: 'home' },
  { name: 'Other', icon: 'ellipsis-horizontal' },
];

export default function AddTransactionScreen() {
  const { addTransaction, reloadUserData, userDataset } = useUserData();
  const { user } = useArena();

  // Form state - expenses only (for arena tracking)
  const now = new Date();
  const [date, setDate] = useState(now.toISOString().split('T')[0]);
  const [time, setTime] = useState(now.toTimeString().slice(0, 5)); // HH:MM format
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [showMerchantSuggestions, setShowMerchantSuggestions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Handle file upload - parses directly and syncs to Supabase (no local cache)
  const handleUploadFile = async () => {
    if (!user) {
      showAlert('Error', 'Please log in first');
      return;
    }

    try {
      console.log('Opening document picker...');
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/json', 'text/csv', 'text/plain'],
        copyToCacheDirectory: true,
      });

      console.log('Document picker result:', result);

      if (result.canceled || !result.assets?.[0]) {
        console.log('Document picker cancelled');
        return;
      }

      setIsUploading(true);
      const file = result.assets[0];
      console.log('Selected file:', file.name, file.mimeType, file.uri);

      const isPDF = file.mimeType === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');

      let transactions: { date: string; description: string; amount: number; category: string }[] = [];

      try {
        if (isPDF) {
          // Read PDF as base64 and parse via backend
          console.log('Reading PDF as base64...');
          const base64 = await readFileAsBase64(file.uri);
          console.log('Base64 length:', base64.length);
          const base64Content = `data:application/pdf;base64,${base64}`;
          console.log('Parsing PDF via backend...');
          transactions = await parsePDFToTransactions(base64Content, file.uri);
        } else {
          // Read text files and parse locally
          console.log('Reading text file...');
          const fileContent = await readFileAsString(file.uri);
          console.log('File content length:', fileContent.length);
          console.log('File preview:', fileContent.substring(0, 200));
          transactions = parseFileToTransactions(fileContent);
        }
      } catch (readError) {
        console.error('File read error:', readError);
        showAlert('Read Error', `Could not read file: ${readError}`);
        setIsUploading(false);
        return;
      }

      console.log('Parsed transactions:', transactions.length);

      if (transactions.length === 0) {
        showAlert('Upload Failed', 'Could not extract transactions from your file. Make sure it contains valid transaction data.');
        setIsUploading(false);
        return;
      }

      // Sync directly to Supabase (will deduplicate with existing)
      console.log('Syncing', transactions.length, 'transactions to Supabase...');
      const syncResult = await syncUploadedDataToSupabase(user.id, transactions);
      console.log(`Synced: ${syncResult.added} new, ${syncResult.skipped} duplicates`);

      // Reload user data from Supabase
      await reloadUserData();

      // Sync arena spending with ALL transactions (load fresh from Supabase)
      console.log('Syncing arena spending after file upload...');
      const allTransactions = await loadTransactionsFromSupabase(user.id);
      console.log('Loaded', allTransactions.length, 'total transactions for arena sync');
      await syncAllArenaSpending(user.id, allTransactions);
      console.log('Arena sync complete');

      showAlert('Success', `${syncResult.added} new transactions imported!${syncResult.skipped > 0 ? ` (${syncResult.skipped} duplicates skipped)` : ''}`);
      router.canGoBack() ? router.back() : router.replace('/(tabs)/history');
    } catch (error) {
      console.error('Upload error:', error);
      showAlert('Error', `Failed to upload file: ${error}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Auto-categorize based on description
  const suggestedCategory = useMemo(() => {
    if (description.length > 2) {
      return categorizeTransaction(description);
    }
    return '';
  }, [description]);

  // Filter merchants for autocomplete
  const filteredMerchants = useMemo(() => {
    if (!description || description.length < 2) return [];
    const lower = description.toLowerCase();
    return COMMON_MERCHANTS.filter(m => m.toLowerCase().includes(lower));
  }, [description]);

  const handleSubmit = async () => {
    if (!user) {
      showAlert('Error', 'Please log in first');
      return;
    }

    if (!description.trim()) {
      showAlert('Missing Info', 'Please enter a description');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showAlert('Missing Info', 'Please enter a valid amount');
      return;
    }

    setIsSubmitting(true);

    try {
      // Always negative for expenses (this is for arena spending tracking)
      const finalAmount = -Math.abs(parsedAmount);

      // Use selected category or suggested category
      const finalCategory = category || suggestedCategory || 'Other';

      // Create timestamp from date and time inputs
      const timestamp = `${date}T${time}:00.000Z`;

      console.log('Adding transaction:', { date, description: description.trim(), amount: finalAmount, category: finalCategory });

      await addTransaction({
        date,
        description: description.trim(),
        amount: finalAmount,
        category: finalCategory,
        timestamp,
      });

      showAlert('Success', `Added €${parsedAmount.toFixed(2)} expense for ${description.trim()}`);

      // Navigate back
      router.canGoBack() ? router.back() : router.replace('/(tabs)/history');
    } catch (error) {
      console.error('Error adding transaction:', error);
      showAlert('Error', 'Failed to save transaction. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMerchantSelect = (merchant: string) => {
    setDescription(merchant);
    setShowMerchantSuggestions(false);
  };

  const handleDateChange = (value: string) => {
    // Simple date validation
    setDate(value);
  };

  const isValid = description.trim().length > 0 && parseFloat(amount) > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="always"
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              onPress={() => {
                Keyboard.dismiss();
                router.canGoBack() ? router.back() : router.replace('/(tabs)/history');
              }}
              style={styles.backButton}
            >
              <Ionicons name="close" size={24} color={theme.colors.deepNavy} />
            </Pressable>
            <Text style={styles.headerTitle}>Log Expense</Text>
            <View style={styles.backButton} />
          </View>

          {/* Upload File Section */}
          <Pressable
            style={styles.uploadSection}
            onPress={() => {
              Keyboard.dismiss();
              handleUploadFile();
            }}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator color={theme.colors.deepTeal} />
            ) : (
              <>
                <View style={styles.uploadIconContainer}>
                  <Ionicons name="cloud-upload-outline" size={28} color={theme.colors.deepTeal} />
                </View>
                <View style={styles.uploadTextContainer}>
                  <Text style={styles.uploadTitle}>Import from File</Text>
                  <Text style={styles.uploadSubtitle}>PDF, JSON, or CSV - merges with existing data</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.gray} />
              </>
            )}
          </Pressable>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or add manually</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Amount Input */}
          <View style={styles.amountContainer}>
            <Text style={styles.currencySymbol}>€</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={theme.colors.gray}
              keyboardType="decimal-pad"
            />
          </View>
          <Text style={styles.expenseHint}>All transactions are logged as expenses</Text>

          {/* Date & Time Input */}
          <View style={styles.dateTimeRow}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Date</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="calendar-outline" size={20} color={theme.colors.gray} />
                <TextInput
                  style={styles.textInput}
                  value={date}
                  onChangeText={handleDateChange}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.colors.gray}
                />
              </View>
            </View>
            <View style={[styles.inputGroup, { flex: 0.6 }]}>
              <Text style={styles.inputLabel}>Time</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="time-outline" size={20} color={theme.colors.gray} />
                <TextInput
                  style={styles.textInput}
                  value={time}
                  onChangeText={setTime}
                  placeholder="HH:MM"
                  placeholderTextColor={theme.colors.gray}
                />
              </View>
            </View>
          </View>

          {/* Description Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Description</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="document-text-outline" size={20} color={theme.colors.gray} />
              <TextInput
                style={styles.textInput}
                value={description}
                onChangeText={(text) => {
                  setDescription(text);
                  setShowMerchantSuggestions(true);
                }}
                onFocus={() => setShowMerchantSuggestions(true)}
                placeholder="e.g., Tesco, Starbucks, Uber"
                placeholderTextColor={theme.colors.gray}
              />
            </View>

            {/* Merchant Suggestions */}
            {showMerchantSuggestions && filteredMerchants.length > 0 && (
              <View style={styles.suggestionsContainer}>
                {filteredMerchants.slice(0, 4).map((merchant) => (
                  <Pressable
                    key={merchant}
                    style={styles.suggestionItem}
                    onPress={() => handleMerchantSelect(merchant)}
                  >
                    <Text style={styles.suggestionText}>{merchant}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Category Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              Category
              {suggestedCategory && !category && (
                <Text style={styles.suggestedLabel}> - Suggested: {suggestedCategory}</Text>
              )}
            </Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => (
                <Pressable
                  key={cat.name}
                  style={[
                    styles.categoryChip,
                    (category === cat.name || (!category && suggestedCategory === cat.name)) &&
                      styles.categoryChipActive,
                  ]}
                  onPress={() => {
                    Keyboard.dismiss();
                    setCategory(cat.name);
                  }}
                >
                  <Ionicons
                    name={cat.icon as any}
                    size={16}
                    color={
                      category === cat.name || (!category && suggestedCategory === cat.name)
                        ? theme.colors.white
                        : theme.colors.deepNavy
                    }
                  />
                  <Text
                    style={[
                      styles.categoryChipText,
                      (category === cat.name || (!category && suggestedCategory === cat.name)) &&
                        styles.categoryChipTextActive,
                    ]}
                  >
                    {cat.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Submit Button */}
          <Pressable
            style={[styles.submitButton, (!isValid || isSubmitting) && styles.submitButtonDisabled]}
            onPress={() => {
              Keyboard.dismiss();
              handleSubmit();
            }}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={theme.colors.white} />
            ) : (
              <>
                <Ionicons name="add-circle" size={24} color={theme.colors.white} />
                <Text style={styles.submitButtonText}>Add Expense</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.softWhite,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.deepNavy,
    textAlign: 'center',
  },
  uploadSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    ...theme.cardShadow,
  },
  uploadIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.deepTeal + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  uploadTextContainer: {
    flex: 1,
  },
  uploadTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.deepNavy,
  },
  uploadSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.lightGray,
  },
  dividerText: {
    paddingHorizontal: theme.spacing.md,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xl,
  },
  currencySymbol: {
    fontSize: 48,
    fontWeight: '700',
    color: theme.colors.deepNavy,
    marginRight: theme.spacing.xs,
  },
  amountInput: {
    fontSize: 48,
    fontWeight: '700',
    color: theme.colors.deepNavy,
    minWidth: 150,
    textAlign: 'center',
  },
  expenseHint: {
    textAlign: 'center',
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  inputGroup: {
    marginBottom: theme.spacing.lg,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.sm,
  },
  suggestedLabel: {
    fontWeight: '400',
    color: theme.colors.deepTeal,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.md,
    ...theme.cardShadow,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.deepNavy,
  },
  suggestionsContainer: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.sm,
    ...theme.cardShadow,
    overflow: 'hidden',
  },
  suggestionItem: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.lightGray,
  },
  suggestionText: {
    fontSize: 16,
    color: theme.colors.deepNavy,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.lightGray,
  },
  categoryChipActive: {
    backgroundColor: theme.colors.deepTeal,
    borderColor: theme.colors.deepTeal,
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.deepNavy,
  },
  categoryChipTextActive: {
    color: theme.colors.white,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.hotCoral,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginTop: theme.spacing.xl,
  },
  submitButtonDisabled: {
    backgroundColor: theme.colors.gray,
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.white,
  },
});
