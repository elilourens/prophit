import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../components/theme';
import { useUserData } from '../contexts/UserDataContext';
import { categorizeTransaction } from '../services/backendApi';

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
  const { addTransaction } = useUserData();

  // Form state
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [isExpense, setIsExpense] = useState(true);
  const [category, setCategory] = useState('');
  const [showMerchantSuggestions, setShowMerchantSuggestions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    if (!description.trim()) {
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Calculate final amount (negative for expenses)
      const finalAmount = isExpense ? -Math.abs(parsedAmount) : Math.abs(parsedAmount);

      // Use selected category or suggested category
      const finalCategory = category || suggestedCategory || 'Other';

      await addTransaction({
        date,
        description: description.trim(),
        amount: finalAmount,
        category: finalCategory,
      });

      // Navigate back
      router.back();
    } catch (error) {
      console.error('Error adding transaction:', error);
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
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="close" size={24} color={theme.colors.deepNavy} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Add Transaction</Text>
            <View style={styles.backButton} />
          </View>

          {/* Transaction Type Toggle */}
          <View style={styles.typeToggle}>
            <TouchableOpacity
              style={[styles.typeButton, isExpense && styles.typeButtonActive]}
              onPress={() => setIsExpense(true)}
            >
              <Ionicons
                name="arrow-down-circle"
                size={24}
                color={isExpense ? theme.colors.white : theme.colors.hotCoral}
              />
              <Text style={[styles.typeButtonText, isExpense && styles.typeButtonTextActive]}>
                Expense
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, !isExpense && styles.typeButtonActiveIncome]}
              onPress={() => setIsExpense(false)}
            >
              <Ionicons
                name="arrow-up-circle"
                size={24}
                color={!isExpense ? theme.colors.white : theme.colors.deepTeal}
              />
              <Text style={[styles.typeButtonText, !isExpense && styles.typeButtonTextActive]}>
                Income
              </Text>
            </TouchableOpacity>
          </View>

          {/* Amount Input */}
          <View style={styles.amountContainer}>
            <Text style={styles.currencySymbol}>-</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={theme.colors.gray}
              keyboardType="decimal-pad"
              autoFocus
            />
          </View>

          {/* Date Input */}
          <View style={styles.inputGroup}>
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
                  <TouchableOpacity
                    key={merchant}
                    style={styles.suggestionItem}
                    onPress={() => handleMerchantSelect(merchant)}
                  >
                    <Text style={styles.suggestionText}>{merchant}</Text>
                  </TouchableOpacity>
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
                <TouchableOpacity
                  key={cat.name}
                  style={[
                    styles.categoryChip,
                    (category === cat.name || (!category && suggestedCategory === cat.name)) &&
                      styles.categoryChipActive,
                  ]}
                  onPress={() => setCategory(cat.name)}
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
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, !isValid && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={theme.colors.white} />
            ) : (
              <>
                <Ionicons name="add-circle" size={24} color={theme.colors.white} />
                <Text style={styles.submitButtonText}>Add Transaction</Text>
              </>
            )}
          </TouchableOpacity>
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
  typeToggle: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.white,
    borderWidth: 2,
    borderColor: theme.colors.lightGray,
  },
  typeButtonActive: {
    backgroundColor: theme.colors.hotCoral,
    borderColor: theme.colors.hotCoral,
  },
  typeButtonActiveIncome: {
    backgroundColor: theme.colors.deepTeal,
    borderColor: theme.colors.deepTeal,
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.deepNavy,
  },
  typeButtonTextActive: {
    color: theme.colors.white,
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
