import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../components/theme';

const { width } = Dimensions.get('window');

/**
 * Bank type definition
 */
interface Bank {
  id: string;
  name: string;
  iconLetter: string;
  iconColor: string;
}

/**
 * Available banks for connection
 */
const BANKS: Bank[] = [
  {
    id: 'monzo',
    name: 'Monzo',
    iconLetter: 'M',
    iconColor: '#FF4F40',
  },
  {
    id: 'revolut',
    name: 'Revolut',
    iconLetter: 'R',
    iconColor: '#0666EB',
  },
  {
    id: 'aib',
    name: 'AIB',
    iconLetter: 'A',
    iconColor: '#6B2D5B',
  },
  {
    id: 'boi',
    name: 'Bank of Ireland',
    iconLetter: 'B',
    iconColor: '#00529B',
  },
  {
    id: 'bos',
    name: 'Bank of Scotland',
    iconLetter: 'S',
    iconColor: '#003399',
  },
];

/**
 * Progress Step Indicator Component
 */
const ProgressIndicator = ({
  currentStep,
  totalSteps,
}: {
  currentStep: number;
  totalSteps: number;
}) => {
  return (
    <View style={progressStyles.container}>
      {Array.from({ length: totalSteps }).map((_, index) => (
        <View
          key={index}
          style={[
            progressStyles.step,
            index < currentStep && progressStyles.stepCompleted,
            index === currentStep && progressStyles.stepActive,
          ]}
        />
      ))}
    </View>
  );
};

const progressStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: theme.spacing.lg,
  },
  step: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.lightGray,
  },
  stepCompleted: {
    backgroundColor: theme.colors.hotCoral,
  },
  stepActive: {
    backgroundColor: theme.colors.hotCoral,
  },
});

/**
 * Bank List Item Component
 */
const BankItem = ({
  bank,
  isSelected,
  onSelect,
}: {
  bank: Bank;
  isSelected: boolean;
  onSelect: () => void;
}) => {
  return (
    <TouchableOpacity
      style={[bankItemStyles.container, isSelected && bankItemStyles.selected]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      <View
        style={[
          bankItemStyles.iconContainer,
          { backgroundColor: bank.iconColor },
        ]}
      >
        <Text style={bankItemStyles.iconLetter}>{bank.iconLetter}</Text>
      </View>
      <Text style={bankItemStyles.name}>{bank.name}</Text>
      <View style={bankItemStyles.checkContainer}>
        {isSelected ? (
          <Ionicons
            name="checkmark-circle"
            size={24}
            color={theme.colors.hotCoral}
          />
        ) : (
          <View style={bankItemStyles.emptyCheck} />
        )}
      </View>
    </TouchableOpacity>
  );
};

const bankItemStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    ...theme.cardShadow,
  },
  selected: {
    borderWidth: 2,
    borderColor: theme.colors.hotCoral,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  iconLetter: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.white,
  },
  name: {
    flex: 1,
    ...theme.typography.body,
    fontWeight: '600',
    color: theme.colors.deepNavy,
  },
  checkContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.lightGray,
  },
});

/**
 * Onboarding Screen - Connect Bank Account
 *
 * Screen 6: Bank selection and secure connection flow
 */
export default function OnboardingScreen() {
  const router = useRouter();
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const currentStep = 1; // This is step 2 of 3 (0-indexed would be 1)
  const totalSteps = 3;

  const handleBankSelect = (bankId: string) => {
    setSelectedBank(bankId);
  };

  const handleConnectSecurely = () => {
    if (selectedBank) {
      // In a real app, this would initiate the Open Banking flow
      console.log(`Connecting to bank: ${selectedBank}`);
      // Navigate to the next step or home
      router.back();
    }
  };

  const handleClose = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header with close button */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleClose}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={24} color={theme.colors.deepNavy} />
        </TouchableOpacity>
      </View>

      {/* Progress Indicator */}
      <ProgressIndicator currentStep={currentStep} totalSteps={totalSteps} />

      {/* Title Section */}
      <View style={styles.titleSection}>
        <Text style={styles.title}>Connect Your Bank</Text>
        <Text style={styles.subtitle}>
          Select your bank to securely connect your account and start tracking
          your spending.
        </Text>
      </View>

      {/* Bank List */}
      <FlatList
        data={BANKS}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <BankItem
            bank={item}
            isSelected={selectedBank === item.id}
            onSelect={() => handleBankSelect(item.id)}
          />
        )}
        contentContainerStyle={styles.bankList}
        showsVerticalScrollIndicator={false}
      />

      {/* Security Note */}
      <View style={styles.securityNote}>
        <Ionicons
          name="shield-checkmark-outline"
          size={20}
          color={theme.colors.deepTeal}
        />
        <Text style={styles.securityText}>
          Your data is encrypted and secure. We use Open Banking to read-only
          access your transactions.
        </Text>
      </View>

      {/* Connect Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.connectButton,
            !selectedBank && styles.connectButtonDisabled,
          ]}
          onPress={handleConnectSecurely}
          activeOpacity={0.8}
          disabled={!selectedBank}
        >
          <Ionicons
            name="lock-closed-outline"
            size={20}
            color={theme.colors.white}
            style={styles.buttonIcon}
          />
          <Text style={styles.connectButtonText}>Connect Securely</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.cardShadow,
  },
  titleSection: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    lineHeight: 24,
  },
  bankList: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  securityText: {
    flex: 1,
    ...theme.typography.small,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  buttonContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.hotCoral,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    ...theme.cardShadow,
  },
  connectButtonDisabled: {
    backgroundColor: theme.colors.gray,
    opacity: 0.6,
  },
  buttonIcon: {
    marginRight: theme.spacing.sm,
  },
  connectButtonText: {
    ...theme.typography.body,
    fontWeight: '700',
    color: theme.colors.white,
  },
});
