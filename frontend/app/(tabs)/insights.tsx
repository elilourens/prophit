import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../components/theme';
import { RunwayRing } from '../../components/RunwayRing';
import { SeasonalBars } from '../../components/SeasonalBars';
import { SpendTrajectory } from '../../components/SpendTrajectory';
import { usePro } from '../../contexts/ProContext';
import { useUserData } from '../../contexts/UserDataContext';
import { LockedFeatureModal, ProBadge } from '../../components/LockedFeatureModal';
import { getDemoTransactionData } from '../../services/backendApi';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Default/fallback data
const DEFAULT_DATA = {
  runway: {
    months: 8.5,
    maxMonths: 12,
  },
  seasonal: {
    winterSpend: 2450,
    summerSpend: 1890,
  },
  trajectory: {
    historical: [1850, 2100, 1920, 2340, 2180, 2050],
    projected: [2150, 2280, 2100],
    labels: ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'],
  },
  savings: 18500,
  monthlyBurn: 2180,
};

const DEFAULT_WEEKLY_RECAP = {
  thisWeekSpend: 512,
  lastWeekSpend: 485,
  changePercent: 5.6,
  topMerchants: [] as { name: string; amount: number; count: number }[],
  highlights: [
    { text: 'Upload your bank statement for personalized insights', isPositive: true },
  ],
  insight: 'Upload your transactions to see weekly spending analysis.',
};

// Week Comparison Component
interface WeekComparisonProps {
  thisWeek: number;
  lastWeek: number;
  changePercent: number;
}

const WeekComparison: React.FC<WeekComparisonProps> = ({
  thisWeek,
  lastWeek,
  changePercent,
}) => {
  const isUp = changePercent > 0;
  const isSignificant = Math.abs(changePercent) > 5;

  return (
    <View style={styles.weekComparisonContainer}>
      <View style={styles.weekColumn}>
        <Text style={styles.weekLabel}>THIS WEEK</Text>
        <Text style={styles.weekAmount}>€{thisWeek}</Text>
      </View>

      <View style={styles.changeIndicator}>
        <Ionicons
          name={isUp ? 'arrow-up' : 'arrow-down'}
          size={24}
          color={isUp ? theme.colors.hotCoral : theme.colors.deepTeal}
        />
        <Text style={[
          styles.changePercent,
          { color: isUp ? theme.colors.hotCoral : theme.colors.deepTeal }
        ]}>
          {isUp ? '+' : ''}{changePercent}%
        </Text>
      </View>

      <View style={styles.weekColumn}>
        <Text style={styles.weekLabel}>LAST WEEK</Text>
        <Text style={styles.weekAmountSecondary}>€{lastWeek}</Text>
      </View>
    </View>
  );
};

// Top Merchant Row
interface TopMerchantProps {
  rank: number;
  name: string;
  amount: number;
  count: number;
}

const TopMerchantRow: React.FC<TopMerchantProps> = ({ rank, name, amount, count }) => (
  <View style={styles.merchantRow}>
    <View style={styles.merchantRank}>
      <Text style={styles.merchantRankText}>{rank}</Text>
    </View>
    <View style={styles.merchantInfo}>
      <Text style={styles.merchantName} numberOfLines={1}>{name}</Text>
      <Text style={styles.merchantCount}>{count}x this week</Text>
    </View>
    <Text style={styles.merchantAmount}>€{amount.toFixed(0)}</Text>
  </View>
);

// Highlight Item Component
interface HighlightItemProps {
  text: string;
  isPositive: boolean;
}

const HighlightItem: React.FC<HighlightItemProps> = ({ text, isPositive }) => {
  return (
    <View style={styles.highlightItem}>
      <View style={[styles.highlightIcon, isPositive ? styles.positiveIcon : styles.negativeIcon]}>
        <Text style={styles.iconText}>{isPositive ? '✓' : '✗'}</Text>
      </View>
      <Text style={styles.highlightText}>{text}</Text>
    </View>
  );
};

// Insight Card Component
interface InsightCardProps {
  insight: string;
}

const InsightCard: React.FC<InsightCardProps> = ({ insight }) => {
  return (
    <View style={styles.aiInsightCard}>
      <View style={styles.aiInsightIconContainer}>
        <Text style={styles.aiInsightIcon}>💡</Text>
      </View>
      <View style={styles.aiInsightContent}>
        <Text style={styles.aiInsightTitle}>AI INSIGHT</Text>
        <Text style={styles.aiInsightText}>{insight}</Text>
      </View>
    </View>
  );
};

/**
 * Insights Screen - Long Horizon / Insights
 */
export default function InsightsScreen() {
  const { isPro } = usePro();
  const { userDataset, isDataLoaded, transactionsUpdatedAt } = useUserData();
  const [showLockedModal, setShowLockedModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Calculate all data from user's dataset
  const {
    runwayMonths,
    savings,
    monthlyBurn,
    seasonal,
    trajectory,
    weeklyRecap,
    dataRangeMonths,
    hasLimitedData,
  } = useMemo(() => {
    if (!userDataset) {
      return {
        runwayMonths: DEFAULT_DATA.runway.months,
        savings: DEFAULT_DATA.savings,
        monthlyBurn: DEFAULT_DATA.monthlyBurn,
        seasonal: DEFAULT_DATA.seasonal,
        trajectory: DEFAULT_DATA.trajectory,
        weeklyRecap: DEFAULT_WEEKLY_RECAP,
        dataRangeMonths: 24,
        hasLimitedData: false,
      };
    }

    const { transactions, summary } = userDataset;
    const dataRange = summary.dataRangeMonths || 24;
    const limitedData = dataRange < 3;

    // Calculate seasonal spending
    const winterMonths = transactions.filter(t => {
      const month = new Date(t.date).getMonth();
      return t.amount < 0 && (month >= 10 || month <= 2); // Nov-Feb
    });
    const summerMonths = transactions.filter(t => {
      const month = new Date(t.date).getMonth();
      return t.amount < 0 && (month >= 5 && month <= 8); // Jun-Sep
    });

    const winterTotal = winterMonths.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const summerTotal = summerMonths.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Calculate monthly trajectory from user's data
    const monthlySpending: number[] = [];
    const now = new Date('2026-02-21');

    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now);
      monthDate.setMonth(monthDate.getMonth() - i);
      const targetMonth = monthDate.getMonth();
      const targetYear = monthDate.getFullYear();

      const monthTotal = transactions
        .filter(t => {
          const d = new Date(t.date);
          return t.amount < 0 && d.getMonth() === targetMonth && d.getFullYear() === targetYear;
        })
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      monthlySpending.push(Math.round(monthTotal));
    }

    // Project next 3 months based on trend
    const avgSpend = monthlySpending.reduce((a, b) => a + b, 0) / 6;
    const trend = summary.spendingTrend;
    const trendFactor = trend === 'increasing' ? 1.05 : trend === 'decreasing' ? 0.95 : 1.0;

    const projected = [
      Math.round(avgSpend * trendFactor),
      Math.round(avgSpend * trendFactor * trendFactor),
      Math.round(avgSpend * trendFactor * trendFactor * trendFactor),
    ];

    // Generate labels for last 6 months + next 3
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const labels: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      labels.push(monthNames[d.getMonth()]);
    }
    for (let i = 1; i <= 3; i++) {
      const d = new Date(now);
      d.setMonth(d.getMonth() + i);
      labels.push(monthNames[d.getMonth()]);
    }

    // Calculate actual weekly spending from transactions
    const today = new Date();
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    // This week's transactions
    const thisWeekTxns = transactions.filter(t => {
      const d = new Date(t.date);
      return t.amount < 0 && d >= oneWeekAgo && d <= today;
    });
    const thisWeekSpend = thisWeekTxns.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Last week's transactions
    const lastWeekTxns = transactions.filter(t => {
      const d = new Date(t.date);
      return t.amount < 0 && d >= twoWeeksAgo && d < oneWeekAgo;
    });
    const lastWeekSpend = lastWeekTxns.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Calculate week-over-week change
    const changePercent = lastWeekSpend > 0
      ? ((thisWeekSpend - lastWeekSpend) / lastWeekSpend) * 100
      : 0;

    // Get top merchants this week
    const merchantTotals: { [name: string]: { amount: number; count: number } } = {};
    thisWeekTxns.forEach(t => {
      const name = t.description || 'Unknown';
      if (!merchantTotals[name]) {
        merchantTotals[name] = { amount: 0, count: 0 };
      }
      merchantTotals[name].amount += Math.abs(t.amount);
      merchantTotals[name].count += 1;
    });

    const topMerchants = Object.entries(merchantTotals)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Generate meaningful highlights
    const highlights: { text: string; isPositive: boolean }[] = [];

    if (changePercent < -10) {
      highlights.push({ text: `Spent ${Math.abs(changePercent).toFixed(0)}% less than last week`, isPositive: true });
    } else if (changePercent > 10) {
      highlights.push({ text: `Spent ${changePercent.toFixed(0)}% more than last week`, isPositive: false });
    } else {
      highlights.push({ text: 'Spending consistent with last week', isPositive: true });
    }

    if (topMerchants[0]) {
      highlights.push({
        text: `Most spent at: ${topMerchants[0].name} (€${topMerchants[0].amount.toFixed(0)})`,
        isPositive: true,
      });
    }

    const avgTransaction = thisWeekTxns.length > 0 ? thisWeekSpend / thisWeekTxns.length : 0;
    highlights.push({
      text: `${thisWeekTxns.length} transactions, avg €${avgTransaction.toFixed(0)} each`,
      isPositive: true,
    });

    // Generate insight based on actual data
    let insight = '';
    if (thisWeekTxns.length === 0) {
      insight = 'No transactions this week yet. Check back later for insights.';
    } else if (changePercent > 20) {
      insight = `Your spending increased significantly this week. ${topMerchants[0]?.name || 'Your top merchant'} was your biggest expense at €${topMerchants[0]?.amount.toFixed(0) || '0'}.`;
    } else if (changePercent < -20) {
      insight = `Great job cutting back! You spent ${Math.abs(changePercent).toFixed(0)}% less than last week. Keep up the momentum.`;
    } else {
      insight = `Steady week with €${thisWeekSpend.toFixed(0)} total spending across ${thisWeekTxns.length} transactions. ${topMerchants[0] ? `${topMerchants[0].name} was your most frequent spend.` : ''}`;
    }

    // Calculate seasonal divisors based on actual data range
    const winterMonthCount = Math.max(1, Math.ceil(dataRange * (4 / 12)));
    const summerMonthCount = Math.max(1, Math.ceil(dataRange * (4 / 12)));

    return {
      runwayMonths: summary.runwayMonths,
      savings: summary.savings,
      monthlyBurn: Math.round(summary.avgMonthly),
      seasonal: {
        winterSpend: Math.round(winterTotal / winterMonthCount) || DEFAULT_DATA.seasonal.winterSpend,
        summerSpend: Math.round(summerTotal / summerMonthCount) || DEFAULT_DATA.seasonal.summerSpend,
      },
      dataRangeMonths: dataRange,
      hasLimitedData: limitedData,
      trajectory: {
        historical: monthlySpending,
        projected: projected,
        labels: labels,
      },
      weeklyRecap: {
        thisWeekSpend: Math.round(thisWeekSpend),
        lastWeekSpend: Math.round(lastWeekSpend),
        changePercent: Math.round(changePercent),
        topMerchants,
        highlights,
        insight,
      },
    };
  }, [userDataset, transactionsUpdatedAt]);


  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.softWhite} />
      <LockedFeatureModal
        visible={showLockedModal}
        onClose={() => setShowLockedModal(false)}
        featureName="Weekly Recap"
        featureDescription="Get detailed insights on your prediction accuracy and spending patterns every week."
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Insights</Text>
          <Text style={styles.headerSubtitle}>Long-term financial outlook</Text>
        </View>

        {(!isDataLoaded || isLoading) ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.hotCoral} />
            <Text style={styles.loadingText}>Analyzing your financial data...</Text>
          </View>
        ) : (
          <>
            {/* Limited Data Notice */}
            {hasLimitedData && (
              <View style={styles.limitedDataBanner}>
                <Ionicons name="information-circle" size={20} color={theme.colors.deepTeal} />
                <Text style={styles.limitedDataText}>
                  Based on {dataRangeMonths < 1 ? 'less than 1 month' : `~${Math.round(dataRangeMonths)} month${dataRangeMonths >= 1.5 ? 's' : ''}`} of data. Upload more history for better insights.
                </Text>
              </View>
            )}

            {/* Financial Runway Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Financial Runway</Text>
              <View style={styles.card}>
                <Text style={styles.cardSubtitle}>Job Quit Runway</Text>
                <Text style={styles.cardDescription}>
                  Based on your savings and spending patterns
                </Text>
                <View style={styles.runwayContainer}>
                  <RunwayRing
                    months={runwayMonths}
                    maxMonths={12}
                  />
                </View>
                <View style={styles.runwayInfo}>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Current Savings</Text>
                    <Text style={styles.infoValue}>€{savings.toLocaleString()}</Text>
                  </View>
                  <View style={styles.infoDivider} />
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Monthly Burn</Text>
                    <Text style={styles.infoValue}>€{monthlyBurn.toLocaleString()}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Seasonal Patterns Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Seasonal Patterns</Text>
              <View style={styles.card}>
                <Text style={styles.cardSubtitle}>Seasonal Spending Comparison</Text>
                <Text style={styles.cardDescription}>
                  Average monthly spending by season
                </Text>
                <SeasonalBars
                  winterSpend={seasonal.winterSpend}
                  summerSpend={seasonal.summerSpend}
                />
              </View>
            </View>

            {/* Spending Trajectory Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Spending Trajectory</Text>
              <View style={styles.card}>
                <Text style={styles.cardSubtitle}>Monthly Spend Trajectory</Text>
                <Text style={styles.cardDescription}>
                  Past 6 months with 3-month projection
                </Text>
                <SpendTrajectory
                  historicalData={trajectory.historical}
                  projectedData={trajectory.projected}
                  labels={trajectory.labels}
                />
              </View>
            </View>

            {/* Weekly Recap Section */}
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>Weekly Recap</Text>
                {!isPro && <ProBadge />}
              </View>
              <Text style={styles.recapDateRange}>
                {(() => {
                  const now = new Date();
                  const weekAgo = new Date(now);
                  weekAgo.setDate(weekAgo.getDate() - 7);
                  return `${weekAgo.toLocaleDateString('en-IE', { month: 'short', day: 'numeric' })} - ${now.toLocaleDateString('en-IE', { month: 'short', day: 'numeric', year: 'numeric' })}`;
                })()}
              </Text>

              {!isPro ? (
                <TouchableOpacity
                  style={styles.lockedCard}
                  onPress={() => setShowLockedModal(true)}
                  activeOpacity={0.9}
                >
                  <View style={styles.lockedOverlay}>
                    <View style={styles.lockedIconContainer}>
                      <Ionicons name="lock-closed" size={24} color={theme.colors.white} />
                    </View>
                    <Text style={styles.lockedTitle}>Unlock Weekly Recap</Text>
                    <Text style={styles.lockedText}>
                      See spending comparisons and insights
                    </Text>
                    <View style={styles.unlockButton}>
                      <Text style={styles.unlockButtonText}>Upgrade to Pro</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={styles.card}>
                  {/* Week Comparison */}
                  <View style={styles.recapComparisonSection}>
                    <Text style={styles.cardSubtitle}>Week-over-Week</Text>
                    <WeekComparison
                      thisWeek={weeklyRecap.thisWeekSpend}
                      lastWeek={weeklyRecap.lastWeekSpend}
                      changePercent={weeklyRecap.changePercent}
                    />
                  </View>

                  {/* Top Merchants */}
                  {weeklyRecap.topMerchants && weeklyRecap.topMerchants.length > 0 && (
                    <View style={styles.recapMerchantsSection}>
                      <Text style={styles.cardSubtitle}>Top Spending</Text>
                      {weeklyRecap.topMerchants.slice(0, 3).map((merchant, index) => (
                        <TopMerchantRow
                          key={index}
                          rank={index + 1}
                          name={merchant.name}
                          amount={merchant.amount}
                          count={merchant.count}
                        />
                      ))}
                    </View>
                  )}

                  {/* Weekly Highlights */}
                  <View style={styles.recapHighlightsSection}>
                    <Text style={styles.cardSubtitle}>Highlights</Text>
                    {weeklyRecap.highlights.map((highlight, index) => (
                      <HighlightItem
                        key={index}
                        text={highlight.text}
                        isPositive={highlight.isPositive}
                      />
                    ))}
                  </View>

                  {/* Insight */}
                  <InsightCard insight={weeklyRecap.insight} />
                </View>
              )}
            </View>
          </>
        )}

        {/* Bottom spacing for tab bar */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.softWhite,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.softWhite,
  },
  contentContainer: {
    paddingHorizontal: theme.spacing.lg,
  },
  header: {
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.deepNavy,
  },
  headerSubtitle: {
    fontSize: 16,
    color: theme.colors.gray,
    marginTop: theme.spacing.xs,
  },
  loadingContainer: {
    padding: theme.spacing.xxl,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  limitedDataBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(0, 78, 96, 0.08)',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  limitedDataText: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.deepTeal,
    lineHeight: 18,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.md,
  },
  recapDateRange: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
    marginTop: -theme.spacing.sm,
  },
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    ...theme.cardShadow,
  },
  cardSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.xs,
  },
  cardDescription: {
    fontSize: 14,
    color: theme.colors.gray,
    marginBottom: theme.spacing.lg,
  },
  runwayContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
  },
  runwayInfo: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.lightGray,
    marginTop: theme.spacing.lg,
  },
  infoItem: {
    alignItems: 'center',
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: theme.colors.gray,
    marginBottom: theme.spacing.xs,
  },
  infoValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.deepNavy,
  },
  infoDivider: {
    width: 1,
    height: 40,
    backgroundColor: theme.colors.lightGray,
  },
  bottomSpacer: {
    height: 100,
  },
  // Locked state styles
  lockedCard: {
    backgroundColor: theme.colors.deepNavy,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    ...theme.cardShadow,
  },
  lockedOverlay: {
    alignItems: 'center',
  },
  lockedIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.hotCoral,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  lockedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.white,
    marginBottom: theme.spacing.sm,
  },
  lockedText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  unlockButton: {
    backgroundColor: theme.colors.hotCoral,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  unlockButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.white,
  },
  // Weekly Recap sections
  recapComparisonSection: {
    paddingBottom: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.lightGray,
  },
  weekComparisonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.md,
  },
  weekColumn: {
    flex: 1,
    alignItems: 'center',
  },
  weekLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: theme.spacing.xs,
  },
  weekAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.deepNavy,
  },
  weekAmountSecondary: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.gray,
  },
  changeIndicator: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  changePercent: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  recapMerchantsSection: {
    paddingBottom: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.lightGray,
  },
  merchantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  merchantRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.softWhite,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },
  merchantRankText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.deepNavy,
  },
  merchantInfo: {
    flex: 1,
  },
  merchantName: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.deepNavy,
  },
  merchantCount: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  merchantAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.deepNavy,
  },
  recapHighlightsSection: {
    marginBottom: theme.spacing.md,
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  highlightIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  positiveIcon: {
    backgroundColor: 'rgba(195, 255, 52, 0.25)',
  },
  negativeIcon: {
    backgroundColor: 'rgba(254, 139, 24, 0.25)',
  },
  iconText: {
    fontSize: 12,
    fontWeight: '700',
  },
  highlightText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.deepNavy,
    lineHeight: 18,
  },
  // AI Insight styles
  aiInsightCard: {
    backgroundColor: theme.colors.softWhite,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.deepTeal,
  },
  aiInsightIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 78, 96, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  aiInsightIcon: {
    fontSize: 16,
  },
  aiInsightContent: {
    flex: 1,
  },
  aiInsightTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.deepTeal,
    marginBottom: theme.spacing.xs,
    letterSpacing: 0.5,
  },
  aiInsightText: {
    fontSize: 13,
    color: theme.colors.deepNavy,
    lineHeight: 18,
  },
});
