import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Linking, Clipboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../components/theme';
import { usePro } from '../../contexts/ProContext';
import { useArena } from '../../contexts/ArenaContext';
import { useSolana } from '../../contexts/SolanaContext';

/**
 * Account Screen (Profile Tab)
 *
 * Shows user account information and stats:
 * - Profile card with avatar and username
 * - Account facts (date joined, stats)
 * - Subscription status
 * - Sign out option
 */

// Stat Item Component
interface StatItemProps {
  icon: string;
  label: string;
  value: string | number;
  color?: string;
}

const StatItem: React.FC<StatItemProps> = ({ icon, label, value, color = theme.colors.deepTeal }) => {
  return (
    <View style={styles.statItem}>
      <View style={[styles.statIconContainer, { backgroundColor: color + '15' }]}>
        <Text style={styles.statIcon}>{icon}</Text>
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
};

// Info Row Component
interface InfoRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}

const InfoRow: React.FC<InfoRowProps> = ({ icon, label, value }) => {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLeft}>
        <Ionicons name={icon} size={20} color={theme.colors.textSecondary} />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
};

export default function ProfileScreen() {
  const { isPro } = usePro();
  const { user, isAuthenticated, signOut, myArenas } = useArena();
  const { wallet, requestAirdrop, refreshBalance, getExplorerAddressUrl } = useSolana();
  const [isTopping, setIsTopping] = useState(false);

  const handleTopUp = async () => {
    setIsTopping(true);
    try {
      const result = await requestAirdrop();
      if (result.success) {
        await refreshBalance();
        Alert.alert('Success', 'Added 0.15 SOL to your wallet!');
      } else {
        Alert.alert('Error', result.error || 'Failed to top up');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to top up wallet');
    } finally {
      setIsTopping(false);
    }
  };

  const handleCopyAddress = () => {
    if (wallet) {
      Clipboard.setString(wallet.publicKey);
      Alert.alert('Copied', 'Wallet address copied to clipboard');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/login');
          },
        },
      ]
    );
  };

  // Mock stats - in real app these would come from backend
  const stats = {
    predictionsThisWeek: 12,
    currentStreak: 5,
    totalArenas: myArenas.length,
    winsCount: 3,
  };

  // Format date joined
  const dateJoined = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : 'February 2026';

  if (!isAuthenticated || !user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.notLoggedIn}>
          <Text style={styles.notLoggedInEmoji}>👤</Text>
          <Text style={styles.notLoggedInTitle}>Not Signed In</Text>
          <Text style={styles.notLoggedInText}>Sign in to view your account</Text>
          <TouchableOpacity
            style={styles.signInButton}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.signInButtonText}>Sign In</Text>
          </TouchableOpacity>
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
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Account</Text>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeEmoji}>{user.avatar_url || '😀'}</Text>
          </View>
          <Text style={styles.username}>{user.username}</Text>
          <View style={styles.subscriptionBadge}>
            <Text style={[styles.subscriptionText, isPro && styles.subscriptionTextPro]}>
              {isPro ? '⭐ Pro Member' : 'Free Plan'}
            </Text>
          </View>
          {!isPro && (
            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={() => router.push('/upgrade')}
            >
              <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Stats Grid */}
        <View style={styles.statsCard}>
          <Text style={styles.sectionTitle}>Your Stats</Text>
          <View style={styles.statsGrid}>
            <StatItem
              icon="🎯"
              label="Predictions this week"
              value={stats.predictionsThisWeek}
              color={theme.colors.deepTeal}
            />
            <StatItem
              icon="🔥"
              label="Day streak"
              value={stats.currentStreak}
              color={theme.colors.hotCoral}
            />
            <StatItem
              icon="🏆"
              label="Arenas joined"
              value={stats.totalArenas}
              color={theme.colors.midOrange}
            />
            <StatItem
              icon="👑"
              label="Arena wins"
              value={stats.winsCount}
              color={theme.colors.neonYellow}
            />
          </View>
        </View>

        {/* Solana Wallet */}
        {wallet && (
          <View style={styles.walletCard}>
            <View style={styles.walletHeader}>
              <View style={styles.walletIconContainer}>
                <Text style={styles.walletIcon}>◈</Text>
              </View>
              <View style={styles.walletInfo}>
                <Text style={styles.walletTitle}>Solana Wallet</Text>
                <TouchableOpacity onPress={handleCopyAddress}>
                  <Text style={styles.walletAddress}>
                    {wallet.publicKey.slice(0, 8)}...{wallet.publicKey.slice(-8)} (tap to copy)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.balanceSection}>
              <Text style={styles.balanceLabel}>Balance</Text>
              <Text style={styles.balanceAmount}>{wallet.balance.toFixed(6)} SOL</Text>
            </View>

            <TouchableOpacity
              style={[styles.topUpButton, isTopping && styles.topUpButtonDisabled]}
              onPress={handleTopUp}
              disabled={isTopping}
            >
              {isTopping ? (
                <ActivityIndicator color={theme.colors.white} size="small" />
              ) : (
                <>
                  <Ionicons name="add-circle" size={20} color={theme.colors.white} />
                  <Text style={styles.topUpButtonText}>Top Up (+0.15 SOL)</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.walletDisclaimer}>Devnet SOL for Arena stakes</Text>
          </View>
        )}

        {/* Account Info */}
        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Account Info</Text>
          <InfoRow
            icon="calendar-outline"
            label="Member since"
            value={dateJoined}
          />
          <InfoRow
            icon="person-outline"
            label="Username"
            value={user.username}
          />
          <InfoRow
            icon="shield-checkmark-outline"
            label="Account status"
            value="Verified"
          />
        </View>

        {/* Actions */}
        <View style={styles.actionsCard}>
          <TouchableOpacity style={styles.actionRow} onPress={() => router.push('/upgrade')}>
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: theme.colors.neonYellow + '20' }]}>
                <Ionicons name="star" size={20} color={theme.colors.deepNavy} />
              </View>
              <Text style={styles.actionText}>Manage Subscription</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.gray} />
          </TouchableOpacity>

          <View style={styles.actionDivider} />

          <TouchableOpacity style={styles.actionRow} onPress={handleLogout}>
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: theme.colors.hotCoral + '20' }]}>
                <Ionicons name="log-out-outline" size={20} color={theme.colors.hotCoral} />
              </View>
              <Text style={[styles.actionText, styles.logoutText]}>Sign Out</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.gray} />
          </TouchableOpacity>
        </View>

        {/* App Version */}
        <Text style={styles.versionText}>Prophit v1.0.0</Text>

        {/* Bottom spacing */}
        <View style={styles.bottomSpacer} />
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
  },
  header: {
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.deepNavy,
  },
  // Profile Card
  profileCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    ...theme.cardShadow,
  },
  avatarLarge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: theme.colors.softWhite,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  avatarLargeEmoji: {
    fontSize: 44,
  },
  username: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.sm,
  },
  subscriptionBadge: {
    backgroundColor: theme.colors.softWhite,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
    marginBottom: theme.spacing.md,
  },
  subscriptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  subscriptionTextPro: {
    color: theme.colors.midOrange,
  },
  upgradeButton: {
    backgroundColor: theme.colors.hotCoral,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  upgradeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.white,
  },
  // Stats Card
  statsCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    ...theme.cardShadow,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  statItem: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIcon: {
    fontSize: 18,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.deepNavy,
  },
  statLabel: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  // Info Card
  infoCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    ...theme.cardShadow,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  infoLabel: {
    fontSize: 15,
    color: theme.colors.textSecondary,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.deepNavy,
  },
  // Actions Card
  actionsCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    ...theme.cardShadow,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.deepNavy,
  },
  logoutText: {
    color: theme.colors.hotCoral,
  },
  actionDivider: {
    height: 1,
    backgroundColor: theme.colors.lightGray,
    marginVertical: theme.spacing.xs,
    marginHorizontal: theme.spacing.sm,
  },
  // Version
  versionText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  // Not Logged In State
  notLoggedIn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  notLoggedInEmoji: {
    fontSize: 64,
    marginBottom: theme.spacing.md,
  },
  notLoggedInTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.sm,
  },
  notLoggedInText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xl,
  },
  signInButton: {
    backgroundColor: theme.colors.hotCoral,
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.white,
  },
  bottomSpacer: {
    height: 80,
  },
  // Wallet Card
  walletCard: {
    backgroundColor: '#9945FF10',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: '#9945FF30',
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  walletIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#9945FF20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  walletIcon: {
    fontSize: 24,
    color: '#9945FF',
  },
  walletInfo: {
    flex: 1,
  },
  walletTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#9945FF',
  },
  walletAddress: {
    fontSize: 12,
    color: theme.colors.deepTeal,
    fontFamily: 'monospace',
    textDecorationLine: 'underline',
    marginTop: 2,
  },
  balanceSection: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  balanceLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: '700',
    color: '#9945FF',
    fontFamily: 'monospace',
  },
  topUpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9945FF',
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  topUpButtonDisabled: {
    backgroundColor: '#9945FF80',
  },
  topUpButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.white,
  },
  walletDisclaimer: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
});
