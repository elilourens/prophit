import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Share,
  Dimensions,
  Animated,
  Clipboard,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../components/theme';
import { useArena } from '../contexts/ArenaContext';
import { useSolana } from '../contexts/SolanaContext';
import { ArenaMemberWithUser } from '../types/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const getModeInfo = (mode: string) => {
  switch (mode) {
    case 'budget_guardian':
      return { icon: '🛡️', label: 'Budget Guardian', color: theme.colors.deepTeal };
    case 'vice_streak':
      return { icon: '🔥', label: 'Vice Streak', color: theme.colors.hotCoral };
    case 'savings_sprint':
      return { icon: '💰', label: 'Savings Sprint', color: '#2E7D32' };
    default:
      return { icon: '🏆', label: 'Arena', color: theme.colors.deepTeal };
  }
};

// Pulsing Live Dot Component
const PulsingDot: React.FC = () => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.4,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <View style={styles.liveDotContainer}>
      <Animated.View
        style={[
          styles.liveDotPulse,
          { transform: [{ scale: pulseAnim }], opacity: pulseAnim.interpolate({
            inputRange: [1, 1.4],
            outputRange: [0.6, 0],
          }) },
        ]}
      />
      <View style={styles.liveDot} />
    </View>
  );
};

// Progress Bar Component
const ProgressBar: React.FC<{ current: number; target: number; color?: string }> = ({
  current,
  target,
  color = theme.colors.deepTeal,
}) => {
  const progress = Math.min((current / target) * 100, 100);
  const isOverLimit = current > target;

  return (
    <View style={styles.progressBarContainer}>
      <View style={styles.progressBarBackground}>
        <View
          style={[
            styles.progressBarFill,
            {
              width: `${progress}%`,
              backgroundColor: isOverLimit ? theme.colors.hotCoral : color,
            },
          ]}
        />
      </View>
    </View>
  );
};

// Podium Component for Top 3
const Podium: React.FC<{ members: ArenaMemberWithUser[]; mode: string }> = ({ members, mode }) => {
  const sortedMembers = [...members].sort((a, b) => {
    if (mode === 'savings_sprint') {
      return b.current_savings - a.current_savings;
    }
    return a.current_spend - b.current_spend;
  });

  const top3 = sortedMembers.slice(0, 3);

  // If only 2 players, show them side by side
  if (members.length === 2) {
    return (
      <View style={styles.twoPlayersContainer}>
        {top3.map((member, index) => (
          <View key={member.id} style={styles.twoPlayerSpot}>
            <View style={[styles.podiumAvatar, member.is_eliminated && styles.podiumAvatarEliminated]}>
              <Text style={styles.podiumAvatarEmoji}>
                {member.users?.avatar_url || '😀'}
              </Text>
            </View>
            <Text style={styles.podiumName} numberOfLines={1}>
              {member.users?.username}
            </Text>
            <Text style={styles.podiumValue}>
              {mode === 'savings_sprint'
                ? `€${member.current_savings}`
                : `€${member.current_spend}`}
            </Text>
            <View style={[styles.rankBadge, index === 0 ? styles.rankBadgeFirst : styles.rankBadgeSecond]}>
              <Text style={styles.rankBadgeText}>{index === 0 ? '🥇' : '🥈'}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  }

  // Normal podium with 3+ players
  const [first, second, third] = [top3[0], top3[1], top3[2]];

  const renderPodiumSpot = (
    member: ArenaMemberWithUser | undefined,
    place: number,
    blockHeight: number
  ) => {
    if (!member) return <View style={styles.podiumSpot} />;

    const medals = ['🥇', '🥈', '🥉'];
    const blockColors = ['#FFD700', '#C0C0C0', '#CD7F32'];

    return (
      <View style={styles.podiumSpot}>
        <View style={[styles.podiumAvatar, member.is_eliminated && styles.podiumAvatarEliminated]}>
          <Text style={styles.podiumAvatarEmoji}>
            {member.users?.avatar_url || '😀'}
          </Text>
          {member.is_eliminated && (
            <View style={styles.eliminatedBadge}>
              <Text style={styles.eliminatedBadgeText}>❌</Text>
            </View>
          )}
        </View>
        <Text style={styles.podiumName} numberOfLines={1}>
          {member.users?.username}
        </Text>
        <Text style={styles.podiumValue}>
          {mode === 'savings_sprint'
            ? `€${member.current_savings}`
            : `€${member.current_spend}`}
        </Text>
        <View style={[styles.podiumBlock, { height: blockHeight, backgroundColor: blockColors[place - 1] }]}>
          <Text style={styles.podiumMedal}>{medals[place - 1]}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.podiumContainer}>
      {/* 2nd place - left, shorter */}
      {renderPodiumSpot(second, 2, 50)}
      {/* 1st place - center, tallest */}
      {renderPodiumSpot(first, 1, 70)}
      {/* 3rd place - right, shortest */}
      {renderPodiumSpot(third, 3, 35)}
    </View>
  );
};

// Leaderboard Row Component
const LeaderboardRow: React.FC<{
  member: ArenaMemberWithUser;
  rank: number;
  mode: string;
  isCurrentUser: boolean;
  targetAmount: number;
}> = ({ member, rank, mode, isCurrentUser, targetAmount }) => {
  const value = mode === 'savings_sprint' ? member.current_savings : member.current_spend;
  const isWinning = rank <= 3 && !member.is_eliminated;

  return (
    <View style={[
      styles.leaderboardRow,
      isCurrentUser && styles.leaderboardRowCurrent,
      member.is_eliminated && styles.leaderboardRowEliminated,
    ]}>
      <Text style={[styles.leaderboardRank, isWinning && styles.leaderboardRankWinning]}>
        {rank}
      </Text>
      <View style={styles.leaderboardAvatar}>
        <Text style={styles.leaderboardAvatarEmoji}>
          {member.users?.avatar_url || '😀'}
        </Text>
      </View>
      <View style={styles.leaderboardInfo}>
        <View style={styles.leaderboardNameRow}>
          <Text style={[
            styles.leaderboardName,
            member.is_eliminated && styles.leaderboardNameEliminated,
          ]}>
            {member.users?.username}
          </Text>
          {isCurrentUser && <Text style={styles.youTag}>(You)</Text>}
        </View>
        <ProgressBar current={value} target={targetAmount} color={isWinning ? '#2E7D32' : theme.colors.deepTeal} />
        {member.is_eliminated && (
          <View style={styles.eliminatedTag}>
            <Text style={styles.eliminatedTagText}>Eliminated</Text>
          </View>
        )}
      </View>
      <Text style={[
        styles.leaderboardValue,
        isWinning && styles.leaderboardValueWinning,
        member.is_eliminated && styles.leaderboardValueEliminated,
      ]}>
        €{value.toFixed(0)}
      </Text>
    </View>
  );
};

// Escrow Info Type
interface EscrowInfo {
  pdaAddress: string;
  balance: number;
  explorerUrl: string;
}

export default function ArenaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    user,
    currentArena,
    fetchArenaById,
    setCurrentArena,
    subscribeToArena,
    unsubscribeFromArena,
  } = useArena();
  const { getEscrowInfo, wallet } = useSolana();

  const [refreshing, setRefreshing] = useState(false);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [escrowInfo, setEscrowInfo] = useState<EscrowInfo | null>(null);

  // Fetch arena data
  useEffect(() => {
    if (id) {
      loadArena();
    }
  }, [id]);

  // Fetch escrow info when arena has stakes
  useEffect(() => {
    const fetchEscrow = async () => {
      if (currentArena?.stake_amount && currentArena.join_code) {
        try {
          const info = await getEscrowInfo(currentArena.join_code);
          setEscrowInfo(info);
        } catch (error) {
          console.log('Escrow info not available:', error);
        }
      }
    };
    fetchEscrow();
  }, [currentArena]);

  // Set up realtime subscription
  useEffect(() => {
    if (id && !channel) {
      const newChannel = subscribeToArena(id);
      setChannel(newChannel);
    }

    return () => {
      if (channel) {
        unsubscribeFromArena(channel);
      }
    };
  }, [id]);

  const loadArena = async () => {
    if (!id) return;
    const arena = await fetchArenaById(id);
    if (arena) {
      setCurrentArena(arena);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadArena();
    setRefreshing(false);
  };

  const handleShare = async () => {
    if (!currentArena) return;
    try {
      await Share.share({
        message: `Join my Prophit Arena! 🏆\n\nCode: ${currentArena.join_code}\n\nDownload Prophit and enter the code to compete!`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleCopyCode = () => {
    if (!currentArena) return;
    Clipboard.setString(currentArena.join_code);
    Alert.alert('Copied!', 'Arena code copied to clipboard');
  };

  if (!currentArena) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading arena...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const modeInfo = getModeInfo(currentArena.mode);
  const members = currentArena.arena_members || [];
  const sortedMembers = [...members].sort((a, b) => {
    if (currentArena.mode === 'savings_sprint') {
      return b.current_savings - a.current_savings;
    }
    return a.current_spend - b.current_spend;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.mainContent}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={theme.colors.deepNavy} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>{currentArena.name}</Text>
              <View style={[styles.modeBadge, { backgroundColor: modeInfo.color + '15' }]}>
                <Text style={styles.modeIcon}>{modeInfo.icon}</Text>
                <Text style={[styles.modeText, { color: modeInfo.color }]}>
                  {modeInfo.label}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
              <Ionicons name="share-outline" size={24} color={theme.colors.deepNavy} />
            </TouchableOpacity>
          </View>

          {/* Live Badge */}
          {currentArena.status === 'active' && (
            <View style={styles.liveBadge}>
              <PulsingDot />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}

          {/* Target Display */}
          <View style={styles.targetCard}>
            <Text style={styles.targetLabel}>
              {currentArena.mode === 'savings_sprint' ? 'Savings Target' : 'Spending Limit'}
            </Text>
            <Text style={styles.targetAmount}>€{currentArena.target_amount}</Text>
            {currentArena.stake_amount && (
              <View style={styles.stakeBadge}>
                <Text style={styles.stakeIcon}>◈</Text>
                <Text style={styles.stakeText}>{currentArena.stake_amount} SOL at stake</Text>
              </View>
            )}
          </View>

          {/* Escrow Info Card */}
          {currentArena.stake_amount && escrowInfo && (
            <TouchableOpacity
              style={styles.escrowCard}
              onPress={() => Linking.openURL(escrowInfo.explorerUrl)}
              activeOpacity={0.8}
            >
              <View style={styles.escrowIconContainer}>
                <Ionicons name="lock-closed" size={20} color="#9945FF" />
              </View>
              <View style={styles.escrowInfo}>
                <Text style={styles.escrowTitle}>Escrow: {escrowInfo.balance.toFixed(3)} SOL locked</Text>
                <Text style={styles.escrowSubtitle}>
                  {members.length} player{members.length !== 1 ? 's' : ''} × {currentArena.stake_amount} SOL
                </Text>
              </View>
              <View style={styles.escrowExplorer}>
                <Ionicons name="open-outline" size={16} color={theme.colors.textSecondary} />
                <Text style={styles.escrowExplorerText}>Explorer</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Podium */}
          {members.length >= 2 && (
            <View style={styles.podiumSection}>
              <Text style={styles.sectionTitle}>Leaderboard</Text>
              <View style={styles.podiumCard}>
                <Podium members={members} mode={currentArena.mode} />
              </View>
            </View>
          )}

          {/* Full Leaderboard */}
          <View style={styles.leaderboardSection}>
            <Text style={styles.sectionTitle}>All Players</Text>
            <View style={styles.leaderboardCard}>
              {sortedMembers.map((member, index) => (
                <LeaderboardRow
                  key={member.id}
                  member={member}
                  rank={index + 1}
                  mode={currentArena.mode}
                  isCurrentUser={member.user_id === user?.id}
                  targetAmount={currentArena.target_amount}
                />
              ))}
            </View>
          </View>

          {/* Waiting State */}
          {currentArena.status === 'waiting' && (
            <View style={styles.waitingCard}>
              <Text style={styles.waitingEmoji}>⏳</Text>
              <Text style={styles.waitingTitle}>Waiting for Players</Text>
              <Text style={styles.waitingText}>
                Share the code with friends to start the competition!
              </Text>
            </View>
          )}

          {/* Bottom spacing for footer */}
          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Sticky Footer - Arena Code */}
        <View style={styles.stickyFooter}>
          <View style={styles.footerContent}>
            <View style={styles.footerCodeSection}>
              <Text style={styles.footerLabel}>Arena Code</Text>
              <Text style={styles.footerCode}>{currentArena.join_code}</Text>
            </View>
            <TouchableOpacity style={styles.copyButton} onPress={handleCopyCode}>
              <Ionicons name="copy-outline" size={20} color={theme.colors.white} />
              <Text style={styles.copyButtonText}>Copy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.softWhite,
  },
  mainContent: {
    flex: 1,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
  },
  bottomSpacer: {
    height: 100,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: 22,
    ...theme.cardShadow,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.sm,
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
    gap: theme.spacing.xs,
  },
  modeIcon: {
    fontSize: 14,
  },
  modeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  shareButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: 22,
    ...theme.cardShadow,
  },
  // Live Badge
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
    backgroundColor: '#2E7D3215',
    alignSelf: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
  },
  liveDotContainer: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDotPulse: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#2E7D32',
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2E7D32',
  },
  liveText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2E7D32',
    letterSpacing: 2,
  },
  // Target Card
  targetCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    ...theme.cardShadow,
  },
  targetLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  targetAmount: {
    fontSize: 56,
    fontWeight: '800',
    color: theme.colors.deepNavy,
  },
  stakeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#9945FF20',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  stakeIcon: {
    fontSize: 16,
    color: '#9945FF',
  },
  stakeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9945FF',
  },
  // Escrow Card
  escrowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: '#9945FF30',
    ...theme.cardShadow,
  },
  escrowIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#9945FF15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  escrowInfo: {
    flex: 1,
  },
  escrowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.deepNavy,
  },
  escrowSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  escrowExplorer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    backgroundColor: theme.colors.softWhite,
    borderRadius: theme.borderRadius.sm,
  },
  escrowExplorerText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  // Podium Section
  podiumSection: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.md,
  },
  podiumCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    ...theme.cardShadow,
  },
  podiumContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: theme.spacing.md,
    paddingTop: theme.spacing.md,
  },
  podiumSpot: {
    alignItems: 'center',
    width: (SCREEN_WIDTH - theme.spacing.lg * 4 - theme.spacing.md * 2) / 3,
  },
  podiumAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.softWhite,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xs,
  },
  podiumAvatarEliminated: {
    opacity: 0.5,
  },
  podiumAvatarEmoji: {
    fontSize: 26,
  },
  eliminatedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
  },
  eliminatedBadgeText: {
    fontSize: 14,
  },
  podiumName: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.deepNavy,
    textAlign: 'center',
    marginBottom: 2,
  },
  podiumValue: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.sm,
  },
  podiumBlock: {
    width: '100%',
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xs,
  },
  podiumMedal: {
    fontSize: 24,
  },
  // Two players layout
  twoPlayersContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
  },
  twoPlayerSpot: {
    alignItems: 'center',
  },
  rankBadge: {
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
  },
  rankBadgeFirst: {
    backgroundColor: '#FFD70030',
  },
  rankBadgeSecond: {
    backgroundColor: '#C0C0C030',
  },
  rankBadgeText: {
    fontSize: 20,
  },
  // Leaderboard Section
  leaderboardSection: {
    marginBottom: theme.spacing.lg,
  },
  leaderboardCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.sm,
    gap: theme.spacing.sm,
    ...theme.cardShadow,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.softWhite,
  },
  leaderboardRowCurrent: {
    backgroundColor: theme.colors.hotCoral + '08',
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.hotCoral,
  },
  leaderboardRowEliminated: {
    opacity: 0.6,
  },
  leaderboardRank: {
    width: 28,
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  leaderboardRankWinning: {
    color: theme.colors.deepTeal,
  },
  leaderboardAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  leaderboardAvatarEmoji: {
    fontSize: 20,
  },
  leaderboardInfo: {
    flex: 1,
  },
  leaderboardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  leaderboardName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.deepNavy,
  },
  leaderboardNameEliminated: {
    textDecorationLine: 'line-through',
  },
  youTag: {
    fontSize: 13,
    color: theme.colors.hotCoral,
    fontWeight: '600',
  },
  eliminatedTag: {
    backgroundColor: theme.colors.hotCoral + '20',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  eliminatedTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.hotCoral,
  },
  leaderboardValue: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.deepNavy,
  },
  leaderboardValueWinning: {
    color: '#2E7D32',
  },
  leaderboardValueEliminated: {
    color: theme.colors.hotCoral,
  },
  // Progress Bar
  progressBarContainer: {
    height: 6,
    marginBottom: 2,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: theme.colors.lightGray,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  // Waiting Card
  waitingCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    ...theme.cardShadow,
  },
  waitingEmoji: {
    fontSize: 48,
    marginBottom: theme.spacing.md,
  },
  waitingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.sm,
  },
  waitingText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  // Sticky Footer
  stickyFooter: {
    backgroundColor: theme.colors.white,
    borderTopWidth: 1,
    borderTopColor: theme.colors.lightGray,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    ...theme.cardShadow,
    shadowOffset: { width: 0, height: -4 },
  },
  footerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerCodeSection: {
    flex: 1,
  },
  footerLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  footerCode: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.deepNavy,
    letterSpacing: 3,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.deepTeal,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.white,
  },
});
