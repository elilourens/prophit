import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Keyboard,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../components/theme';
import { useArena } from '../contexts/ArenaContext';
import { useSolana } from '../contexts/SolanaContext';
import { ArenaWithMembers } from '../types/supabase';
import { SolanaWalletModal } from '../components/SolanaWalletModal';

const getModeInfo = (mode: string) => {
  switch (mode) {
    case 'budget_guardian':
      return { icon: '\uD83D\uDEE1\uFE0F', label: 'Budget Guardian', color: theme.colors.deepTeal };
    case 'vice_streak':
      return { icon: '\uD83D\uDD25', label: 'Vice Streak', color: theme.colors.hotCoral };
    case 'savings_sprint':
      return { icon: '\uD83D\uDCB0', label: 'Savings Sprint', color: '#2E7D32' };
    default:
      return { icon: '\uD83C\uDFC6', label: 'Arena', color: theme.colors.deepTeal };
  }
};

export default function JoinArenaScreen() {
  const { fetchArenaByCode, joinArena, user } = useArena();
  const { wallet, isInitialized, joinArenaEscrow, requestAirdrop, getExplorerUrl } = useSolana();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isSearching, setIsSearching] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [foundArena, setFoundArena] = useState<ArenaWithMembers | null>(null);
  const [error, setError] = useState('');
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [joinTxSignature, setJoinTxSignature] = useState<string | null>(null);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Auto-connect wallet if already initialized with balance
  useEffect(() => {
    if (isInitialized && wallet && wallet.balance > 0) {
      setWalletConnected(true);
    }
  }, [isInitialized, wallet]);

  const handleWalletConnect = async () => {
    if (wallet && wallet.balance > 0) {
      setWalletConnected(true);
      setShowWalletModal(false);
    } else if (wallet) {
      const result = await requestAirdrop();
      if (result.success) {
        setWalletConnected(true);
        setShowWalletModal(false);
      } else {
        Alert.alert('Airdrop Failed', 'Could not get devnet SOL. Try again later.');
      }
    }
  };

  const handleCodeChange = (value: string, index: number) => {
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newCode = [...code];
      digits.forEach((digit, i) => {
        if (index + i < 6) {
          newCode[index + i] = digit;
        }
      });
      setCode(newCode);
      setError('');

      const nextIndex = Math.min(index + digits.length, 5);
      inputRefs.current[nextIndex]?.focus();

      // Auto-search if complete
      if (newCode.every((d) => d !== '')) {
        searchArena(newCode.join(''));
      }
    } else {
      const newCode = [...code];
      newCode[index] = value.replace(/\D/g, '');
      setCode(newCode);
      setError('');

      // Move to next input
      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }

      // Auto-search when complete
      if (newCode.every((d) => d !== '')) {
        searchArena(newCode.join(''));
      }
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const searchArena = async (joinCode: string) => {
    Keyboard.dismiss();
    setIsSearching(true);
    setFoundArena(null);
    setError('');

    try {
      const arena = await fetchArenaByCode(joinCode);
      if (arena) {
        // Check if already a member
        const isMember = arena.arena_members?.some((m) => m.user_id === user?.id);
        if (isMember) {
          setError('You are already in this arena!');
        } else {
          setFoundArena(arena);
        }
      } else {
        setError('Arena not found. Check the code and try again.');
      }
    } catch (err) {
      setError('Something went wrong. Try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleJoin = async () => {
    if (!foundArena) return;

    // Check if this is a staked arena and wallet isn't connected
    if (foundArena.stake_amount && !walletConnected) {
      setShowWalletModal(true);
      return;
    }

    setIsJoining(true);
    try {
      // If staked arena, join the escrow first
      if (foundArena.stake_amount && foundArena.stake_amount > 0) {
        const escrowResult = await joinArenaEscrow(
          foundArena.join_code,
          foundArena.stake_amount
        );

        if (escrowResult.success && escrowResult.signature) {
          setJoinTxSignature(escrowResult.signature);
          console.log('Joined escrow:', escrowResult.explorerUrl);
        } else {
          Alert.alert('Escrow Error', escrowResult.error || 'Failed to join escrow');
          setIsJoining(false);
          return;
        }
      }

      // Join the arena in Supabase
      await joinArena(foundArena.join_code);
      router.replace(`/arena-detail?id=${foundArena.id}`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to join arena');
    } finally {
      setIsJoining(false);
    }
  };

  const resetSearch = () => {
    setCode(['', '', '', '', '', '']);
    setFoundArena(null);
    setError('');
    inputRefs.current[0]?.focus();
  };

  return (
    <SafeAreaView style={styles.container}>
      <SolanaWalletModal
        visible={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        onConnect={handleWalletConnect}
      />

      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.deepNavy} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Join Arena</Text>
          <View style={styles.backButton} />
        </View>

        <Text style={styles.subtitle}>Enter the 6-digit code to join</Text>

        {/* Code Input */}
        <View style={styles.codeContainer}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputRefs.current[index] = ref)}
              style={[
                styles.codeInput,
                digit && styles.codeInputFilled,
                error && styles.codeInputError,
              ]}
              value={digit}
              onChangeText={(value) => handleCodeChange(value, index)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
              keyboardType="number-pad"
              maxLength={6}
              selectTextOnFocus
            />
          ))}
        </View>

        {/* Error */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={16} color={theme.colors.hotCoral} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Loading */}
        {isSearching && (
          <View style={styles.searchingContainer}>
            <ActivityIndicator color={theme.colors.hotCoral} />
            <Text style={styles.searchingText}>Searching for arena...</Text>
          </View>
        )}

        {/* Found Arena */}
        {foundArena && (
          <View style={styles.foundArenaCard}>
            <View style={styles.foundArenaHeader}>
              <View style={[
                styles.modeIcon,
                { backgroundColor: getModeInfo(foundArena.mode).color + '20' }
              ]}>
                <Text style={styles.modeEmoji}>{getModeInfo(foundArena.mode).icon}</Text>
              </View>
              <View style={styles.foundArenaInfo}>
                <Text style={styles.foundArenaName}>{foundArena.name}</Text>
                <Text style={styles.foundArenaMode}>
                  {getModeInfo(foundArena.mode).label}
                </Text>
              </View>
            </View>

            <View style={styles.foundArenaStats}>
              <View style={styles.stat}>
                <Ionicons name="people" size={18} color={theme.colors.textSecondary} />
                <Text style={styles.statText}>
                  {foundArena.arena_members?.length || 0} players
                </Text>
              </View>
              <View style={styles.stat}>
                <Ionicons name="flag" size={18} color={theme.colors.textSecondary} />
                <Text style={styles.statText}>€{foundArena.target_amount}</Text>
              </View>
              {foundArena.stake_amount && (
                <View style={styles.stat}>
                  <Text style={styles.solanaIcon}>{'\u25C8'}</Text>
                  <Text style={styles.statText}>{foundArena.stake_amount} SOL</Text>
                </View>
              )}
            </View>

            {/* Players Preview */}
            <View style={styles.playersPreview}>
              <Text style={styles.playersLabel}>Current Players</Text>
              <View style={styles.playersList}>
                {foundArena.arena_members?.slice(0, 4).map((member) => (
                  <View key={member.id} style={styles.playerChip}>
                    <Text style={styles.playerAvatar}>
                      {member.users?.avatar_url || '\uD83D\uDE00'}
                    </Text>
                    <Text style={styles.playerName}>{member.users?.username}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Wallet Status for Staked Arenas */}
            {foundArena.stake_amount && foundArena.stake_amount > 0 && (
              <View style={styles.stakeSection}>
                <View style={styles.stakeWarning}>
                  <Ionicons name="warning" size={18} color="#9945FF" />
                  <Text style={styles.stakeWarningText}>
                    This arena requires {foundArena.stake_amount} SOL stake
                  </Text>
                </View>
                {walletConnected && wallet ? (
                  <View style={styles.walletStatus}>
                    <Ionicons name="checkmark-circle" size={18} color="#2E7D32" />
                    <Text style={styles.walletStatusText}>
                      Wallet ready ({wallet.balance.toFixed(3)} SOL)
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.connectWalletButton}
                    onPress={() => setShowWalletModal(true)}
                  >
                    <Text style={styles.connectWalletText}>Connect Wallet First</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.joinButton,
                isJoining && styles.joinButtonDisabled,
                foundArena.stake_amount && foundArena.stake_amount > 0 && styles.joinButtonStaked,
              ]}
              onPress={handleJoin}
              disabled={isJoining}
            >
              {isJoining ? (
                <ActivityIndicator color={theme.colors.white} />
              ) : (
                <Text style={styles.joinButtonText}>
                  {foundArena.stake_amount && foundArena.stake_amount > 0
                    ? `Join & Stake ${foundArena.stake_amount} SOL`
                    : 'Join Arena'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.resetButton} onPress={resetSearch}>
              <Text style={styles.resetButtonText}>Try Different Code</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
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
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  codeInput: {
    width: 48,
    height: 64,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    color: theme.colors.deepNavy,
    ...theme.cardShadow,
  },
  codeInputFilled: {
    backgroundColor: theme.colors.softWhite,
    borderWidth: 2,
    borderColor: theme.colors.deepTeal,
  },
  codeInputError: {
    borderWidth: 2,
    borderColor: theme.colors.hotCoral,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  errorText: {
    fontSize: 14,
    color: theme.colors.hotCoral,
  },
  searchingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  searchingText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  foundArenaCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    ...theme.cardShadow,
  },
  foundArenaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  modeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  modeEmoji: {
    fontSize: 28,
  },
  foundArenaInfo: {
    flex: 1,
  },
  foundArenaName: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.deepNavy,
  },
  foundArenaMode: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  foundArenaStats: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.lightGray,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  statText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  solanaIcon: {
    fontSize: 16,
    color: '#9945FF',
  },
  playersPreview: {
    marginBottom: theme.spacing.lg,
  },
  playersLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.sm,
  },
  playersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  playerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.softWhite,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
    gap: theme.spacing.xs,
  },
  playerAvatar: {
    fontSize: 16,
  },
  playerName: {
    fontSize: 14,
    color: theme.colors.deepNavy,
  },
  joinButton: {
    backgroundColor: theme.colors.hotCoral,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  joinButtonDisabled: {
    backgroundColor: theme.colors.gray,
  },
  joinButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.white,
  },
  resetButton: {
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 14,
    color: theme.colors.deepTeal,
    fontWeight: '600',
  },
  // Stake Section
  stakeSection: {
    backgroundColor: '#9945FF10',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: '#9945FF30',
  },
  stakeWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  stakeWarningText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9945FF',
  },
  walletStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  walletStatusText: {
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: '500',
  },
  connectWalletButton: {
    backgroundColor: '#9945FF',
    borderRadius: theme.borderRadius.sm,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  connectWalletText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.white,
  },
  joinButtonStaked: {
    backgroundColor: '#9945FF',
  },
});
