import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../components/theme';
import { useArena } from '../contexts/ArenaContext';
import { useSolana } from '../contexts/SolanaContext';
import { SolanaWalletModal } from '../components/SolanaWalletModal';
import { showAlert, shareContent } from '../utils/crossPlatform';

type ArenaMode = 'budget_guardian' | 'vice_streak' | 'savings_sprint';

interface ModeOption {
  id: ArenaMode;
  icon: string;
  title: string;
  description: string;
  color: string;
  example: string;
}

const MODES: ModeOption[] = [
  {
    id: 'budget_guardian',
    icon: '\uD83D\uDEE1\uFE0F',
    title: 'Budget Guardian',
    description: 'Stay under a spending limit',
    color: theme.colors.deepTeal,
    example: 'First to exceed the limit loses!',
  },
  {
    id: 'vice_streak',
    icon: '\uD83D\uDD25',
    title: 'Vice Streak',
    description: 'Avoid spending at a specific place',
    color: theme.colors.hotCoral,
    example: 'First to spend at Starbucks loses!',
  },
  {
    id: 'savings_sprint',
    icon: '\uD83D\uDCB0',
    title: 'Savings Sprint',
    description: 'Race to save a target amount',
    color: '#2E7D32',
    example: 'First to save €500 wins!',
  },
];

type DurationOption = '1_week' | '2_weeks' | '1_month' | 'custom';

const DURATION_OPTIONS: { id: DurationOption; label: string; days: number }[] = [
  { id: '1_week', label: '1 Week', days: 7 },
  { id: '2_weeks', label: '2 Weeks', days: 14 },
  { id: '1_month', label: '1 Month', days: 30 },
];

export default function CreateArenaScreen() {
  const { createArena } = useArena();
  const { wallet, isInitialized, createArenaEscrow, requestAirdrop, getExplorerUrl } = useSolana();
  const [step, setStep] = useState<'mode' | 'details' | 'stake' | 'created'>('mode');
  const [selectedMode, setSelectedMode] = useState<ArenaMode | null>(null);
  const [arenaName, setArenaName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [selectedDuration, setSelectedDuration] = useState<DurationOption>('1_week');
  const [stakeEnabled, setStakeEnabled] = useState(false);
  const [stakeAmount, setStakeAmount] = useState('');
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createdCode, setCreatedCode] = useState('');
  const [createdArenaId, setCreatedArenaId] = useState('');
  const [escrowTxSignature, setEscrowTxSignature] = useState<string | null>(null);

  const handleModeSelect = (mode: ArenaMode) => {
    setSelectedMode(mode);
    setStep('details');
  };

  const handleDetailsNext = () => {
    if (!arenaName.trim() || !targetAmount) return;
    setStep('stake');
  };

  const handleCreateArena = async () => {
    if (!selectedMode || !arenaName.trim() || !targetAmount) return;

    if (stakeEnabled && !walletConnected) {
      setShowWalletModal(true);
      return;
    }

    setIsCreating(true);
    try {
      // Calculate end date based on selected duration
      const durationDays = DURATION_OPTIONS.find(d => d.id === selectedDuration)?.days || 7;
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + durationDays);

      // First create the arena in Supabase
      const arena = await createArena(
        arenaName.trim(),
        selectedMode,
        parseFloat(targetAmount),
        stakeEnabled ? parseFloat(stakeAmount) : undefined,
        endDate.toISOString()
      );

      // If stakes are enabled, create the escrow on Solana
      if (stakeEnabled && parseFloat(stakeAmount) > 0) {
        const escrowResult = await createArenaEscrow(
          arena.join_code,
          parseFloat(stakeAmount),
          10 // max players
        );

        if (escrowResult.success && escrowResult.signature) {
          setEscrowTxSignature(escrowResult.signature);
          console.log('Escrow created:', escrowResult.explorerUrl);
        } else {
          console.warn('Escrow creation failed:', escrowResult.error);
        }
      }

      setCreatedCode(arena.join_code);
      setCreatedArenaId(arena.id);
      setStep('created');
    } catch (error) {
      showAlert('Error', 'Failed to create arena. Try again!');
    } finally {
      setIsCreating(false);
    }
  };

  const handleShare = async () => {
    await shareContent(
      `Join my Prophit Arena! 🏆\n\nCode: ${createdCode}\n\nDownload Prophit and enter the code to compete!`,
      'Join my Arena'
    );
  };

  const handleWalletConnect = async () => {
    // Wallet is auto-initialized by SolanaProvider
    if (wallet && wallet.balance > 0) {
      setWalletConnected(true);
      setShowWalletModal(false);
    } else if (wallet) {
      // Request airdrop if balance is low
      const result = await requestAirdrop();
      if (result.success) {
        setWalletConnected(true);
        setShowWalletModal(false);
      } else {
        showAlert('Airdrop Failed', 'Could not get devnet SOL. Try again later.');
      }
    }
  };

  // Auto-connect wallet if already initialized
  React.useEffect(() => {
    if (isInitialized && wallet && wallet.balance > 0) {
      setWalletConnected(true);
    }
  }, [isInitialized, wallet]);

  const renderModeSelection = () => (
    <>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/arena')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.deepNavy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Choose Mode</Text>
        <View style={styles.backButton} />
      </View>

      <Text style={styles.stepSubtitle}>What type of challenge do you want?</Text>

      {MODES.map((mode) => (
        <TouchableOpacity
          key={mode.id}
          style={styles.modeCard}
          onPress={() => handleModeSelect(mode.id)}
          activeOpacity={0.8}
        >
          <View style={[styles.modeIconContainer, { backgroundColor: mode.color + '20' }]}>
            <Text style={styles.modeIcon}>{mode.icon}</Text>
          </View>
          <View style={styles.modeContent}>
            <Text style={styles.modeTitle}>{mode.title}</Text>
            <Text style={styles.modeDescription}>{mode.description}</Text>
            <View style={[styles.modeExample, { backgroundColor: mode.color + '15' }]}>
              <Text style={[styles.modeExampleText, { color: mode.color }]}>
                {mode.example}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.gray} />
        </TouchableOpacity>
      ))}
    </>
  );

  const renderDetailsForm = () => {
    const modeInfo = MODES.find((m) => m.id === selectedMode);

    return (
      <>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep('mode')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.deepNavy} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Arena Details</Text>
          <View style={styles.backButton} />
        </View>

        {/* Selected Mode Badge */}
        <View style={[styles.selectedModeBadge, { backgroundColor: modeInfo?.color + '20' }]}>
          <Text style={styles.selectedModeIcon}>{modeInfo?.icon}</Text>
          <Text style={[styles.selectedModeText, { color: modeInfo?.color }]}>
            {modeInfo?.title}
          </Text>
        </View>

        {/* Arena Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Arena Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Friday Night Challenge"
            placeholderTextColor={theme.colors.gray}
            value={arenaName}
            onChangeText={setArenaName}
            maxLength={30}
          />
        </View>

        {/* Target Amount */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            {selectedMode === 'savings_sprint' ? 'Savings Target' : 'Spending Limit'}
          </Text>
          <View style={styles.amountInputContainer}>
            <Text style={styles.currencySymbol}>€</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0"
              placeholderTextColor={theme.colors.gray}
              value={targetAmount}
              onChangeText={setTargetAmount}
              keyboardType="numeric"
              maxLength={6}
            />
          </View>
          <Text style={styles.inputHint}>
            {selectedMode === 'savings_sprint'
              ? 'First to save this amount wins'
              : 'First to exceed this amount loses'}
          </Text>
        </View>

        {/* Duration */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Arena Duration</Text>
          <View style={styles.durationContainer}>
            {DURATION_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.durationOption,
                  selectedDuration === option.id && styles.durationOptionSelected,
                ]}
                onPress={() => setSelectedDuration(option.id)}
              >
                <Text
                  style={[
                    styles.durationOptionText,
                    selectedDuration === option.id && styles.durationOptionTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.inputHint}>
            Arena ends {DURATION_OPTIONS.find(d => d.id === selectedDuration)?.days || 7} days from creation
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.nextButton,
            (!arenaName.trim() || !targetAmount) && styles.nextButtonDisabled,
          ]}
          onPress={handleDetailsNext}
          disabled={!arenaName.trim() || !targetAmount}
        >
          <Text style={styles.nextButtonText}>Continue</Text>
        </TouchableOpacity>
      </>
    );
  };

  const renderStakeOptions = () => (
    <>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setStep('details')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.deepNavy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Stakes</Text>
        <View style={styles.backButton} />
      </View>

      <Text style={styles.stepSubtitle}>Make it interesting with Solana stakes (optional)</Text>

      {/* No Stakes Option */}
      <TouchableOpacity
        style={[styles.stakeOption, !stakeEnabled && styles.stakeOptionSelected]}
        onPress={() => setStakeEnabled(false)}
      >
        <View style={styles.stakeOptionContent}>
          <Text style={styles.stakeOptionIcon}>{'\uD83C\uDFAE'}</Text>
          <View>
            <Text style={styles.stakeOptionTitle}>Just for Fun</Text>
            <Text style={styles.stakeOptionDescription}>No money on the line</Text>
          </View>
        </View>
        <View style={[styles.radioButton, !stakeEnabled && styles.radioButtonSelected]}>
          {!stakeEnabled && <View style={styles.radioButtonInner} />}
        </View>
      </TouchableOpacity>

      {/* With Stakes Option */}
      <TouchableOpacity
        style={[styles.stakeOption, stakeEnabled && styles.stakeOptionSelected]}
        onPress={() => setStakeEnabled(true)}
      >
        <View style={styles.stakeOptionContent}>
          <Text style={styles.stakeOptionIcon}>{'\u25C8'}</Text>
          <View>
            <Text style={styles.stakeOptionTitle}>Solana Stakes</Text>
            <Text style={styles.stakeOptionDescription}>Winner takes all</Text>
          </View>
        </View>
        <View style={[styles.radioButton, stakeEnabled && styles.radioButtonSelected]}>
          {stakeEnabled && <View style={styles.radioButtonInner} />}
        </View>
      </TouchableOpacity>

      {/* Stake Amount Input */}
      {stakeEnabled && (
        <View style={styles.stakeAmountSection}>
          <Text style={styles.label}>Stake Amount per Player</Text>
          <View style={styles.solanaInputContainer}>
            <Text style={styles.solanaSymbol}>{'\u25C8'}</Text>
            <TextInput
              style={styles.solanaInput}
              placeholder="0.1"
              placeholderTextColor={theme.colors.gray}
              value={stakeAmount}
              onChangeText={setStakeAmount}
              keyboardType="decimal-pad"
            />
            <Text style={styles.solanaLabel}>SOL</Text>
          </View>

          {/* Wallet Status */}
          {walletConnected && wallet ? (
            <View style={styles.walletConnectedContainer}>
              <View style={styles.walletConnected}>
                <Ionicons name="checkmark-circle" size={20} color="#2E7D32" />
                <Text style={styles.walletConnectedText}>Wallet Connected</Text>
              </View>
              <View style={styles.walletBalanceRow}>
                <Text style={styles.walletBalanceLabel}>Balance:</Text>
                <Text style={styles.walletBalanceValue}>{wallet.balance.toFixed(3)} SOL</Text>
              </View>
              <Text style={styles.walletAddressText} numberOfLines={1}>
                {wallet.publicKey.slice(0, 8)}...{wallet.publicKey.slice(-8)}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.connectWalletButton}
              onPress={() => setShowWalletModal(true)}
            >
              <Text style={styles.connectWalletText}>Connect Solana Wallet</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <TouchableOpacity
        style={[styles.createButton, isCreating && styles.createButtonDisabled]}
        onPress={handleCreateArena}
        disabled={isCreating}
      >
        {isCreating ? (
          <ActivityIndicator color={theme.colors.white} />
        ) : (
          <Text style={styles.createButtonText}>Create Arena</Text>
        )}
      </TouchableOpacity>
    </>
  );

  const renderCreatedScreen = () => (
    <View style={styles.createdContainer}>
      <Text style={styles.createdEmoji}>{'\uD83C\uDF89'}</Text>
      <Text style={styles.createdTitle}>Arena Created!</Text>
      <Text style={styles.createdSubtitle}>Share this code with friends</Text>

      <View style={styles.codeContainer}>
        <Text style={styles.codeText}>{createdCode}</Text>
      </View>

      {/* Escrow Transaction Info */}
      {escrowTxSignature && (
        <View style={styles.escrowInfoCard}>
          <View style={styles.escrowInfoHeader}>
            <Ionicons name="lock-closed" size={20} color="#9945FF" />
            <Text style={styles.escrowInfoTitle}>Stake Secured on Solana</Text>
          </View>
          <Text style={styles.escrowTxLabel}>Transaction:</Text>
          <Text style={styles.escrowTxSignature} numberOfLines={1}>
            {escrowTxSignature.slice(0, 20)}...{escrowTxSignature.slice(-20)}
          </Text>
          <TouchableOpacity
            style={styles.explorerButton}
            onPress={() => Linking.openURL(getExplorerUrl(escrowTxSignature))}
          >
            <Ionicons name="open-outline" size={16} color="#9945FF" />
            <Text style={styles.explorerButtonText}>View on Solana Explorer</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
        <Ionicons name="share-outline" size={20} color={theme.colors.white} />
        <Text style={styles.shareButtonText}>Share Code</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.viewArenaButton}
        onPress={() => router.replace(`/arena-detail?id=${createdArenaId}`)}
      >
        <Text style={styles.viewArenaButtonText}>View Arena</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <SolanaWalletModal
        visible={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        onConnect={handleWalletConnect}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {step === 'mode' && renderModeSelection()}
        {step === 'details' && renderDetailsForm()}
        {step === 'stake' && renderStakeOptions()}
        {step === 'created' && renderCreatedScreen()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.deepNavy,
  },
  stepSubtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  // Mode Selection
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.cardShadow,
  },
  modeIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  modeIcon: {
    fontSize: 28,
  },
  modeContent: {
    flex: 1,
  },
  modeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.deepNavy,
  },
  modeDescription: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
    marginBottom: theme.spacing.sm,
  },
  modeExample: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    alignSelf: 'flex-start',
  },
  modeExampleText: {
    fontSize: 12,
    fontWeight: '500',
  },
  // Details Form
  selectedModeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    marginBottom: theme.spacing.xl,
  },
  selectedModeIcon: {
    fontSize: 20,
    marginRight: theme.spacing.sm,
  },
  selectedModeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.sm,
  },
  input: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.deepNavy,
    ...theme.cardShadow,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    ...theme.cardShadow,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '600',
    color: theme.colors.deepNavy,
    marginRight: theme.spacing.sm,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    color: theme.colors.deepNavy,
  },
  inputHint: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
  },
  durationContainer: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  durationOption: {
    flex: 1,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    ...theme.cardShadow,
  },
  durationOptionSelected: {
    borderColor: theme.colors.hotCoral,
    backgroundColor: theme.colors.hotCoral + '10',
  },
  durationOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  durationOptionTextSelected: {
    color: theme.colors.hotCoral,
  },
  nextButton: {
    backgroundColor: theme.colors.hotCoral,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  nextButtonDisabled: {
    backgroundColor: theme.colors.gray,
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.white,
  },
  // Stake Options
  stakeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
    ...theme.cardShadow,
  },
  stakeOptionSelected: {
    borderColor: theme.colors.hotCoral,
  },
  stakeOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stakeOptionIcon: {
    fontSize: 32,
    marginRight: theme.spacing.md,
  },
  stakeOptionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.deepNavy,
  },
  stakeOptionDescription: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.gray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderColor: theme.colors.hotCoral,
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.hotCoral,
  },
  stakeAmountSection: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    ...theme.cardShadow,
  },
  solanaInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.softWhite,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  solanaSymbol: {
    fontSize: 24,
    color: '#9945FF',
    marginRight: theme.spacing.sm,
  },
  solanaInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    color: theme.colors.deepNavy,
  },
  solanaLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  connectWalletButton: {
    backgroundColor: '#9945FF',
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  connectWalletText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.white,
  },
  walletConnectedContainer: {
    marginTop: theme.spacing.md,
  },
  walletConnected: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  walletConnectedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
  },
  walletBalanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  walletBalanceLabel: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  walletBalanceValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9945FF',
  },
  walletAddressText: {
    fontSize: 11,
    color: theme.colors.gray,
    textAlign: 'center',
    marginTop: 4,
  },
  createButton: {
    backgroundColor: theme.colors.hotCoral,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  createButtonDisabled: {
    backgroundColor: theme.colors.gray,
  },
  createButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.white,
  },
  // Created Screen
  createdContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  createdEmoji: {
    fontSize: 80,
    marginBottom: theme.spacing.lg,
  },
  createdTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.sm,
  },
  createdSubtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xl,
  },
  codeContainer: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
    ...theme.cardShadow,
  },
  codeText: {
    fontSize: 48,
    fontWeight: '700',
    color: theme.colors.deepNavy,
    letterSpacing: 8,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.hotCoral,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  shareButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.white,
  },
  viewArenaButton: {
    paddingVertical: theme.spacing.md,
  },
  viewArenaButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.deepTeal,
  },
  // Escrow Info
  escrowInfoCard: {
    backgroundColor: '#9945FF10',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: '#9945FF30',
    width: '100%',
  },
  escrowInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  escrowInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9945FF',
  },
  escrowTxLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  escrowTxSignature: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.md,
  },
  explorerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9945FF20',
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  explorerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9945FF',
  },
});
