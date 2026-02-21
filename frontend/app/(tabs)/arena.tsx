import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../components/theme';
import { useArena } from '../../contexts/ArenaContext';
import { ArenaWithMembers } from '../../types/supabase';

const getModeInfo = (mode: string) => {
  switch (mode) {
    case 'budget_guardian':
      return { icon: '\uD83D\uDEE1\uFE0F', label: 'Budget Guardian', color: theme.colors.deepTeal };
    case 'vice_streak':
      return { icon: '\uD83D\uDD25', label: 'Vice Streak', color: theme.colors.hotCoral };
    case 'savings_sprint':
      return { icon: '\uD83D\uDCB0', label: 'Savings Sprint', color: theme.colors.neonYellow };
    default:
      return { icon: '\uD83C\uDFC6', label: 'Arena', color: theme.colors.deepTeal };
  }
};

const ArenaCard: React.FC<{ arena: ArenaWithMembers; onPress: () => void }> = ({
  arena,
  onPress,
}) => {
  const modeInfo = getModeInfo(arena.mode);
  const memberCount = arena.arena_members?.length || 0;

  return (
    <TouchableOpacity style={styles.arenaCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.arenaHeader}>
        <View style={[styles.modeIcon, { backgroundColor: modeInfo.color + '20' }]}>
          <Text style={styles.modeEmoji}>{modeInfo.icon}</Text>
        </View>
        <View style={styles.arenaInfo}>
          <Text style={styles.arenaName}>{arena.name}</Text>
          <Text style={styles.arenaMode}>{modeInfo.label}</Text>
        </View>
        <View style={[
          styles.statusBadge,
          { backgroundColor: arena.status === 'active' ? '#2E7D3220' : theme.colors.midOrange + '20' }
        ]}>
          <Text style={[
            styles.statusText,
            { color: arena.status === 'active' ? '#2E7D32' : theme.colors.midOrange }
          ]}>
            {arena.status === 'active' ? 'Live' : arena.status === 'waiting' ? 'Waiting' : 'Ended'}
          </Text>
        </View>
      </View>

      <View style={styles.arenaStats}>
        <View style={styles.stat}>
          <Ionicons name="people" size={16} color={theme.colors.textSecondary} />
          <Text style={styles.statText}>{memberCount} players</Text>
        </View>
        <View style={styles.stat}>
          <Ionicons name="flag" size={16} color={theme.colors.textSecondary} />
          <Text style={styles.statText}>€{arena.target_amount}</Text>
        </View>
        {arena.stake_amount && (
          <View style={styles.stat}>
            <Text style={styles.solanaIcon}>{'\u25C8'}</Text>
            <Text style={styles.statText}>{arena.stake_amount} SOL</Text>
          </View>
        )}
      </View>

      {/* Member Avatars */}
      <View style={styles.memberAvatars}>
        {arena.arena_members?.slice(0, 5).map((member, index) => (
          <View
            key={member.id}
            style={[styles.memberAvatar, { marginLeft: index > 0 ? -12 : 0, zIndex: 5 - index }]}
          >
            <Text style={styles.memberAvatarEmoji}>
              {member.users?.avatar_url || '\uD83D\uDE00'}
            </Text>
          </View>
        ))}
        {memberCount > 5 && (
          <View style={[styles.memberAvatar, styles.memberAvatarMore, { marginLeft: -12 }]}>
            <Text style={styles.memberAvatarMoreText}>+{memberCount - 5}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

export default function ArenaHubScreen() {
  const { user, isLoading, myArenas, fetchMyArenas, signOut } = useArena();
  const [refreshing, setRefreshing] = React.useState(false);

  const handleLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMyArenas();
    setRefreshing(false);
  };

  const activeArenas = myArenas.filter((a) => a.status !== 'completed');
  const completedArenas = myArenas.filter((a) => a.status === 'completed');

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
          <View>
            <Text style={styles.title}>Prophit Arena</Text>
            <Text style={styles.subtitle}>Compete with friends</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.userBadge}>
              <Text style={styles.userAvatar}>{user?.avatar_url || '😀'}</Text>
              <Text style={styles.userName}>{user?.username}</Text>
            </View>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={22} color={theme.colors.hotCoral} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/arena-create')}
          >
            <View style={[styles.actionIcon, { backgroundColor: theme.colors.hotCoral + '20' }]}>
              <Ionicons name="add" size={24} color={theme.colors.hotCoral} />
            </View>
            <Text style={styles.actionTitle}>Create Arena</Text>
            <Text style={styles.actionSubtitle}>Start a new challenge</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/arena-join')}
          >
            <View style={[styles.actionIcon, { backgroundColor: theme.colors.deepTeal + '20' }]}>
              <Ionicons name="enter" size={24} color={theme.colors.deepTeal} />
            </View>
            <Text style={styles.actionTitle}>Join Arena</Text>
            <Text style={styles.actionSubtitle}>Enter with code</Text>
          </TouchableOpacity>
        </View>

        {/* Active Arenas */}
        {activeArenas.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active Arenas</Text>
            {activeArenas.map((arena) => (
              <ArenaCard
                key={arena.id}
                arena={arena}
                onPress={() => router.push(`/arena-detail?id=${arena.id}`)}
              />
            ))}
          </View>
        )}

        {/* Completed Arenas */}
        {completedArenas.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Past Arenas</Text>
            {completedArenas.map((arena) => (
              <ArenaCard
                key={arena.id}
                arena={arena}
                onPress={() => router.push(`/arena-results?id=${arena.id}`)}
              />
            ))}
          </View>
        )}

        {/* Empty State */}
        {myArenas.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>{'\uD83C\uDFC6'}</Text>
            <Text style={styles.emptyTitle}>No Arenas Yet</Text>
            <Text style={styles.emptyText}>
              Create a new arena or join one with a code to start competing!
            </Text>
          </View>
        )}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.deepNavy,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.hotCoral + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    ...theme.cardShadow,
  },
  userAvatar: {
    fontSize: 20,
    marginRight: theme.spacing.sm,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.deepNavy,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  actionButton: {
    flex: 1,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    ...theme.cardShadow,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.deepNavy,
  },
  actionSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.md,
  },
  arenaCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.cardShadow,
  },
  arenaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  modeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  modeEmoji: {
    fontSize: 22,
  },
  arenaInfo: {
    flex: 1,
  },
  arenaName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.deepNavy,
  },
  arenaMode: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  arenaStats: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  statText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  solanaIcon: {
    fontSize: 14,
    color: '#9945FF',
  },
  memberAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.softWhite,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  memberAvatarEmoji: {
    fontSize: 16,
  },
  memberAvatarMore: {
    backgroundColor: theme.colors.lightGray,
  },
  memberAvatarMoreText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: theme.spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
});
