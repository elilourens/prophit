import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../components/theme';
import { useArena } from '../contexts/ArenaContext';
import { useSolana } from '../contexts/SolanaContext';
import { ArenaMemberWithUser } from '../types/supabase';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const getModeInfo = (mode: string) => {
  switch (mode) {
    case 'budget_guardian':
      return { icon: '\uD83D\uDEE1\uFE0F', label: 'Budget Guardian' };
    case 'vice_streak':
      return { icon: '\uD83D\uDD25', label: 'Vice Streak' };
    case 'savings_sprint':
      return { icon: '\uD83D\uDCB0', label: 'Savings Sprint' };
    default:
      return { icon: '\uD83C\uDFC6', label: 'Arena' };
  }
};

// Confetti-style celebration component
const Celebration: React.FC<{ isWinner: boolean }> = ({ isWinner }) => {
  if (!isWinner) return null;

  return (
    <View style={styles.celebrationContainer}>
      <Text style={styles.confetti}>{'\uD83C\uDF89'}</Text>
      <Text style={[styles.confetti, { top: 20, left: 40 }]}>{'\u2728'}</Text>
      <Text style={[styles.confetti, { top: 10, right: 30 }]}>{'\uD83C\uDF8A'}</Text>
      <Text style={[styles.confetti, { bottom: 20, left: 60 }]}>{'\u2B50'}</Text>
      <Text style={[styles.confetti, { bottom: 10, right: 50 }]}>{'\uD83C\uDF1F'}</Text>
    </View>
  );
};

// Trophy podium display
const TrophyDisplay: React.FC<{ winner: ArenaMemberWithUser; mode: string }> = ({
  winner,
  mode,
}) => {
  const size = 160;
  const STROKE_WIDTH = 8;
  const RADIUS = (size - STROKE_WIDTH) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  return (
    <View style={styles.trophyContainer}>
      <View style={styles.trophyRing}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id="trophyGradient" x1="0%" y1="0%" x2="100%">
              <Stop offset="0%" stopColor={theme.colors.neonYellow} />
              <Stop offset="100%" stopColor="#FFD700" />
            </LinearGradient>
          </Defs>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={RADIUS}
            stroke="url(#trophyGradient)"
            strokeWidth={STROKE_WIDTH}
            fill="transparent"
          />
        </Svg>
        <View style={styles.trophyAvatarContainer}>
          <Text style={styles.trophyAvatar}>{winner.users?.avatar_url || '\uD83D\uDE00'}</Text>
        </View>
      </View>
      <Text style={styles.winnerName}>{winner.users?.username}</Text>
      <View style={styles.winnerBadge}>
        <Text style={styles.winnerBadgeText}>{'\uD83C\uDFC6'} Champion</Text>
      </View>
    </View>
  );
};

// Results row
const ResultRow: React.FC<{
  member: ArenaMemberWithUser;
  rank: number;
  mode: string;
  isCurrentUser: boolean;
}> = ({ member, rank, mode, isCurrentUser }) => {
  const value = mode === 'savings_sprint' ? member.current_savings : member.current_spend;
  const medals = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'];

  return (
    <View style={[styles.resultRow, isCurrentUser && styles.resultRowCurrent]}>
      <View style={styles.resultRankContainer}>
        {rank <= 3 ? (
          <Text style={styles.resultMedal}>{medals[rank - 1]}</Text>
        ) : (
          <Text style={styles.resultRank}>{rank}</Text>
        )}
      </View>
      <View style={styles.resultAvatar}>
        <Text style={styles.resultAvatarEmoji}>
          {member.users?.avatar_url || '\uD83D\uDE00'}
        </Text>
      </View>
      <View style={styles.resultInfo}>
        <Text style={styles.resultName}>
          {member.users?.username}
          {isCurrentUser && ' (You)'}
        </Text>
        {member.is_eliminated && (
          <Text style={styles.resultEliminated}>Eliminated</Text>
        )}
      </View>
      <Text style={styles.resultValue}>€{value.toFixed(0)}</Text>
    </View>
  );
};

export default function ArenaResultsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, fetchArenaById, currentArena, setCurrentArena, getArenaWinner } = useArena();
  const { wallet, resolveArenaEscrowWithPayout, getExplorerUrl, getEscrowInfo } = useSolana();
  const [loading, setLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [payoutTxSignature, setPayoutTxSignature] = useState<string | null>(null);
  const [escrowBalance, setEscrowBalance] = useState<number>(0);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);

  useEffect(() => {
    loadArena();
  }, [id]);

  const loadArena = async () => {
    if (!id) return;
    const arena = await fetchArenaById(id);
    if (arena) {
      setCurrentArena(arena);
      // Load escrow info if staked arena
      if (arena.stake_amount && arena.join_code) {
        try {
          const escrow = await getEscrowInfo(arena.join_code);
          setEscrowBalance(escrow.balance);
        } catch (e) {
          console.log('Escrow not found or already resolved');
        }
      }
    }
    setLoading(false);
  };

  const handleClaimPrize = async () => {
    if (!currentArena || !wallet) return;

    setIsClaiming(true);
    setPayoutError(null);

    try {
      // Calculate prize amount
      const prizeAmount = (currentArena.stake_amount || 0) * members.length;

      const result = await resolveArenaEscrowWithPayout(
        currentArena.join_code,
        wallet.publicKey,
        prizeAmount
      );

      if (result.success && result.signature) {
        setPayoutTxSignature(result.signature);
        setHasClaimed(true);
        console.log('Prize claimed:', result.explorerUrl);

        // Update arena with payout tx signature
        // Note: In production, this would be stored in the database
      } else {
        setPayoutError(result.error || 'Failed to claim prize');
        console.error('Claim failed:', result.error);
      }
    } catch (e: any) {
      setPayoutError(e.message || 'Failed to claim prize');
      console.error('Claim error:', e);
    } finally {
      setIsClaiming(false);
    }
  };

  if (loading || !currentArena) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading results...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const modeInfo = getModeInfo(currentArena.mode);
  const members = currentArena.arena_members || [];

  // Sort by performance
  const sortedMembers = [...members].sort((a, b) => {
    if (a.is_eliminated && !b.is_eliminated) return 1;
    if (!a.is_eliminated && b.is_eliminated) return -1;
    if (currentArena.mode === 'savings_sprint') {
      return b.current_savings - a.current_savings;
    }
    return a.current_spend - b.current_spend;
  });

  const winner = sortedMembers[0];
  const isCurrentUserWinner = winner?.user_id === user?.id;

  // Calculate stats
  const totalSpent = members.reduce((sum, m) => sum + m.current_spend, 0);
  const avgSpent = members.length > 0 ? totalSpent / members.length : 0;
  const eliminated = members.filter((m) => m.is_eliminated).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Celebration isWinner={isCurrentUserWinner} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.deepNavy} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerEmoji}>{modeInfo.icon}</Text>
            <Text style={styles.headerTitle}>{currentArena.name}</Text>
            <Text style={styles.headerSubtitle}>Arena Complete</Text>
          </View>
          <View style={styles.backButton} />
        </View>

        {/* Winner Trophy */}
        {winner && <TrophyDisplay winner={winner} mode={currentArena.mode} />}

        {/* Your Result */}
        {isCurrentUserWinner ? (
          <View style={styles.yourResultCard}>
            <Text style={styles.yourResultEmoji}>{'\uD83C\uDF89'}</Text>
            <Text style={styles.yourResultTitle}>Congratulations!</Text>
            <Text style={styles.yourResultText}>You won this arena!</Text>
            {currentArena.stake_amount && currentArena.stake_amount > 0 && (
              <>
                <View style={styles.prizeBadge}>
                  <Text style={styles.prizeIcon}>{'\u25C8'}</Text>
                  <Text style={styles.prizeText}>
                    +{(currentArena.stake_amount * members.length).toFixed(2)} SOL
                  </Text>
                </View>

                {/* Claim Prize Button or Transaction Info */}
                {payoutTxSignature ? (
                  <View style={styles.claimedSection}>
                    <View style={styles.claimedBadge}>
                      <Ionicons name="checkmark-circle" size={18} color="#2E7D32" />
                      <Text style={styles.claimedText}>Prize Claimed!</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.explorerButton}
                      onPress={() => Linking.openURL(getExplorerUrl(payoutTxSignature))}
                    >
                      <Ionicons name="open-outline" size={16} color="#9945FF" />
                      <Text style={styles.explorerButtonText}>View on Solana Explorer</Text>
                    </TouchableOpacity>
                    <Text style={styles.txSignature}>
                      TX: {payoutTxSignature.slice(0, 8)}...{payoutTxSignature.slice(-8)}
                    </Text>
                  </View>
                ) : escrowBalance > 0 && !hasClaimed ? (
                  <>
                    <TouchableOpacity
                      style={[styles.claimButton, isClaiming && styles.claimButtonDisabled]}
                      onPress={handleClaimPrize}
                      disabled={isClaiming}
                    >
                      {isClaiming ? (
                        <ActivityIndicator color={theme.colors.white} size="small" />
                      ) : (
                        <>
                          <Ionicons name="wallet" size={20} color={theme.colors.white} />
                          <Text style={styles.claimButtonText}>Claim Prize</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    {payoutError && (
                      <Text style={styles.errorText}>{payoutError}</Text>
                    )}
                  </>
                ) : null}
              </>
            )}
          </View>
        ) : (
          <View style={styles.yourResultCardLoss}>
            <Text style={styles.yourResultText}>Better luck next time!</Text>
            <Text style={styles.yourResultSubtext}>Keep practicing to improve your spending habits.</Text>
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{members.length}</Text>
            <Text style={styles.statLabel}>Players</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>€{avgSpent.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Avg Spent</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{eliminated}</Text>
            <Text style={styles.statLabel}>Eliminated</Text>
          </View>
        </View>

        {/* Final Standings */}
        <View style={styles.standingsSection}>
          <Text style={styles.sectionTitle}>Final Standings</Text>
          {sortedMembers.map((member, index) => (
            <ResultRow
              key={member.id}
              member={member}
              rank={index + 1}
              mode={currentArena.mode}
              isCurrentUser={member.user_id === user?.id}
            />
          ))}
        </View>

        {/* Action Buttons */}
        <TouchableOpacity
          style={styles.newArenaButton}
          onPress={() => router.replace('/arena-create')}
        >
          <Ionicons name="add" size={20} color={theme.colors.white} />
          <Text style={styles.newArenaButtonText}>Create New Arena</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backToHubButton}
          onPress={() => router.replace('/(tabs)/arena')}
        >
          <Text style={styles.backToHubButtonText}>Back to Arena Hub</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  celebrationContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    pointerEvents: 'none',
  },
  confetti: {
    position: 'absolute',
    fontSize: 32,
    top: 100,
    left: 20,
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
    marginBottom: theme.spacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerEmoji: {
    fontSize: 32,
    marginBottom: theme.spacing.xs,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.deepNavy,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  trophyContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  trophyRing: {
    position: 'relative',
    marginBottom: theme.spacing.md,
  },
  trophyAvatarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophyAvatar: {
    fontSize: 64,
  },
  winnerName: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.sm,
  },
  winnerBadge: {
    backgroundColor: '#FFD70030',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
  },
  winnerBadgeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#B8860B',
  },
  yourResultCard: {
    backgroundColor: theme.colors.neonYellow + '30',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    borderWidth: 2,
    borderColor: theme.colors.neonYellow,
  },
  yourResultEmoji: {
    fontSize: 48,
    marginBottom: theme.spacing.sm,
  },
  yourResultTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.xs,
  },
  yourResultText: {
    fontSize: 16,
    color: theme.colors.deepNavy,
  },
  yourResultCardLoss: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    ...theme.cardShadow,
  },
  yourResultSubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },
  prizeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#9945FF20',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  prizeIcon: {
    fontSize: 18,
    color: '#9945FF',
  },
  prizeText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#9945FF',
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    ...theme.cardShadow,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.deepNavy,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  standingsSection: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.md,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    ...theme.cardShadow,
    shadowOpacity: 0.05,
  },
  resultRowCurrent: {
    borderWidth: 2,
    borderColor: theme.colors.hotCoral,
  },
  resultRankContainer: {
    width: 32,
    alignItems: 'center',
  },
  resultMedal: {
    fontSize: 20,
  },
  resultRank: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  resultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.softWhite,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  resultAvatarEmoji: {
    fontSize: 20,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.deepNavy,
  },
  resultEliminated: {
    fontSize: 12,
    color: theme.colors.hotCoral,
    marginTop: 2,
  },
  resultValue: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.deepNavy,
  },
  newArenaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.hotCoral,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  newArenaButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.white,
  },
  backToHubButton: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  backToHubButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.deepTeal,
  },
  // Claim Prize
  claimedSection: {
    marginTop: theme.spacing.md,
    alignItems: 'center',
    width: '100%',
  },
  claimedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  claimedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
  },
  explorerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#9945FF20',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
  },
  explorerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9945FF',
  },
  claimButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9945FF',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    width: '100%',
  },
  claimButtonDisabled: {
    backgroundColor: '#9945FF80',
  },
  claimButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.white,
  },
  txSignature: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    fontFamily: 'monospace',
  },
  errorText: {
    fontSize: 14,
    color: theme.colors.hotCoral,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
});
