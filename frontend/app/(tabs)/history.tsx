import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../components/theme';
import { ToggleTabs, TabOption } from '../../components/ToggleTabs';
import { ComparisonChart } from '../../components/ComparisonChart';
import { CategoryDonut } from '../../components/CategoryDonut';
import { SpendingAlert } from '../../components/SpendingAlert';
import { getCachedUserDataset } from '../../services/backendApi';

// Color mapping for categories
const CATEGORY_COLORS: { [key: string]: string } = {
  'Groceries': theme.colors.hotCoral,
  'Dining': theme.colors.midOrange,
  'Coffee': theme.colors.neonYellow,
  'Transport': theme.colors.deepTeal,
  'Subscriptions': theme.colors.deepNavy,
  'Shopping': theme.colors.hotCoral,
  'Rent': theme.colors.deepNavy,
  'Utilities': theme.colors.deepTeal,
  'Food & Dining': theme.colors.hotCoral,
  'Entertainment': theme.colors.midOrange,
  'Bills': theme.colors.deepNavy,
};

// Default category data as fallback
const DEFAULT_CATEGORY_DATA = [
  { name: 'Food & Dining', value: 145, color: theme.colors.hotCoral },
  { name: 'Transport', value: 67, color: theme.colors.deepTeal },
  { name: 'Entertainment', value: 89, color: theme.colors.midOrange },
  { name: 'Shopping', value: 124, color: theme.colors.neonYellow },
  { name: 'Bills', value: 210, color: theme.colors.deepNavy },
];

// Default comparison data as fallback
const DEFAULT_COMPARISON_DATA = [
  { label: 'Mon', thisWeek: 45, lastWeek: 38 },
  { label: 'Tue', thisWeek: 32, lastWeek: 42 },
  { label: 'Wed', thisWeek: 58, lastWeek: 35 },
  { label: 'Thu', thisWeek: 48, lastWeek: 52 },
  { label: 'Fri', thisWeek: 72, lastWeek: 45 },
  { label: 'Sat', thisWeek: 95, lastWeek: 88 },
  { label: 'Sun', thisWeek: 65, lastWeek: 55 },
];

// Default alerts data as fallback
const DEFAULT_ALERTS_DATA = [
  {
    category: 'Entertainment',
    percentageChange: 40,
    message: 'Entertainment spending 40% higher than usual',
    severity: 'warning' as const,
  },
  {
    category: 'Food & Dining',
    percentageChange: 25,
    message: 'Food spending trending 25% above average',
    severity: 'info' as const,
  },
];

/**
 * History Screen - Spending History / Patterns
 *
 * Screen for viewing transaction history and past spending including:
 * - Toggle tabs (Week/Month/Year)
 * - This Period vs Last Period comparison chart
 * - Category Breakdown donut chart
 * - Unusual Spike Alerts
 */
export default function HistoryScreen() {
  const [activeTab, setActiveTab] = useState<TabOption>('week');
  const [isLoading, setIsLoading] = useState(false);

  const handleTabChange = (tab: TabOption) => {
    setActiveTab(tab);
  };

  // Get user's transaction data with error handling
  let dataset = null;
  let transactions: any[] = [];
  let dataRangeMonths = 24;

  try {
    dataset = getCachedUserDataset();
    transactions = dataset?.transactions || [];
    dataRangeMonths = dataset?.summary?.dataRangeMonths || 24;
  } catch (error) {
    console.error('Error loading dataset in history:', error);
  }

  const hasLimitedData = dataRangeMonths < 3;

  // Calculate data based on selected time period
  const { categoryData, comparisonData, alertsData, totalThis, totalLast, insufficientData } = useMemo(() => {
    try {
    // Use the latest transaction date as reference, or today if no transactions
    let now = new Date();
    if (transactions.length > 0) {
      const dates = transactions.map(t => new Date(t.date).getTime()).filter(d => !isNaN(d));
      if (dates.length > 0) {
        now = new Date(Math.max(...dates));
      }
    }
    let periodDays: number;
    let labels: string[];
    let periodCount: number;

    if (activeTab === 'week') {
      periodDays = 7;
      labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      periodCount = 7;
    } else if (activeTab === 'month') {
      periodDays = 30;
      labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
      periodCount = 4;
    } else {
      periodDays = 365;
      // Generate labels for last 12 months (rolling window)
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      labels = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now);
        d.setMonth(d.getMonth() - i);
        labels.push(monthNames[d.getMonth()]);
      }
      periodCount = 12;
    }

    // Filter transactions for this period and last period
    const thisPeriodStart = new Date(now);
    thisPeriodStart.setDate(thisPeriodStart.getDate() - periodDays);
    const lastPeriodStart = new Date(thisPeriodStart);
    lastPeriodStart.setDate(lastPeriodStart.getDate() - periodDays);

    const thisPeriodTxns = transactions.filter(t => {
      const d = new Date(t.date);
      return t.amount < 0 && d >= thisPeriodStart && d <= now;
    });

    const lastPeriodTxns = transactions.filter(t => {
      const d = new Date(t.date);
      return t.amount < 0 && d >= lastPeriodStart && d < thisPeriodStart;
    });

    // Category breakdown for this period
    const categoryTotals: { [cat: string]: number } = {};
    thisPeriodTxns.forEach(t => {
      if (t.category !== 'Income') {
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + Math.abs(t.amount);
      }
    });

    const catData = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({
        name,
        value: Math.round(value),
        color: CATEGORY_COLORS[name] || theme.colors.gray,
      }));

    // Comparison data
    const compData: { label: string; thisWeek: number; lastWeek: number }[] = [];

    for (let i = 0; i < periodCount; i++) {
      let thisAmount = 0;
      let lastAmount = 0;

      if (activeTab === 'week') {
        // Daily breakdown
        const targetDay = (now.getDay() + 7 - periodDays + i + 1) % 7;
        thisPeriodTxns.forEach(t => {
          const d = new Date(t.date);
          if (d.getDay() === targetDay) thisAmount += Math.abs(t.amount);
        });
        lastPeriodTxns.forEach(t => {
          const d = new Date(t.date);
          if (d.getDay() === targetDay) lastAmount += Math.abs(t.amount);
        });
      } else if (activeTab === 'month') {
        // Weekly breakdown
        const weekStart = new Date(thisPeriodStart);
        weekStart.setDate(weekStart.getDate() + (i * 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        thisPeriodTxns.forEach(t => {
          const d = new Date(t.date);
          if (d >= weekStart && d < weekEnd) thisAmount += Math.abs(t.amount);
        });

        const lastWeekStart = new Date(lastPeriodStart);
        lastWeekStart.setDate(lastWeekStart.getDate() + (i * 7));
        const lastWeekEnd = new Date(lastWeekStart);
        lastWeekEnd.setDate(lastWeekEnd.getDate() + 7);

        lastPeriodTxns.forEach(t => {
          const d = new Date(t.date);
          if (d >= lastWeekStart && d < lastWeekEnd) lastAmount += Math.abs(t.amount);
        });
      } else {
        // Monthly breakdown - compare last 12 months vs previous 12 months
        // i=0 is 12 months ago, i=11 is current month
        const thisMonthDate = new Date(now);
        thisMonthDate.setMonth(thisMonthDate.getMonth() - (11 - i));
        const thisMonth = thisMonthDate.getMonth();
        const thisYear = thisMonthDate.getFullYear();

        const lastMonthDate = new Date(thisMonthDate);
        lastMonthDate.setFullYear(lastMonthDate.getFullYear() - 1);
        const lastMonth = lastMonthDate.getMonth();
        const lastYear = lastMonthDate.getFullYear();

        transactions.forEach(t => {
          const d = new Date(t.date);
          if (t.amount < 0 && d.getMonth() === thisMonth && d.getFullYear() === thisYear) {
            thisAmount += Math.abs(t.amount);
          }
          if (t.amount < 0 && d.getMonth() === lastMonth && d.getFullYear() === lastYear) {
            lastAmount += Math.abs(t.amount);
          }
        });
      }

      compData.push({
        label: labels[i],
        thisWeek: Math.round(thisAmount),
        lastWeek: Math.round(lastAmount),
      });
    }

    // Calculate totals
    const totalThis = thisPeriodTxns.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const totalLast = lastPeriodTxns.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Generate alerts based on comparison
    const alerts: typeof DEFAULT_ALERTS_DATA = [];
    const change = totalLast > 0 ? ((totalThis - totalLast) / totalLast) * 100 : 0;

    if (change > 10) {
      alerts.push({
        category: 'Spending',
        percentageChange: Math.round(change),
        message: `Spending up ${Math.round(change)}% vs last ${activeTab}`,
        severity: 'warning',
      });
    } else if (change < -10) {
      alerts.push({
        category: 'Savings',
        percentageChange: Math.round(Math.abs(change)),
        message: `Spending down ${Math.round(Math.abs(change))}% - great progress!`,
        severity: 'info',
      });
    }

    // Find biggest category change
    if (catData.length > 0) {
      const topCat = catData[0];
      alerts.push({
        category: topCat.name,
        percentageChange: Math.round((topCat.value / totalThis) * 100),
        message: `${topCat.name} is ${Math.round((topCat.value / totalThis) * 100)}% of your spending`,
        severity: 'info',
      });
    }

    if (alerts.length === 0) {
      alerts.push({
        category: 'Status',
        percentageChange: 0,
        message: 'Spending patterns are within normal range',
        severity: 'info',
      });
    }

    // Check if we have sufficient data for the selected period
    const requiredMonths = activeTab === 'week' ? 0.5 : activeTab === 'month' ? 2 : 12;
    const hasInsufficientData = dataRangeMonths < requiredMonths;

    return {
      categoryData: catData.length > 0 ? catData : DEFAULT_CATEGORY_DATA,
      comparisonData: compData,
      alertsData: alerts,
      totalThis: Math.round(totalThis),
      totalLast: Math.round(totalLast),
      insufficientData: hasInsufficientData,
    };
    } catch (error) {
      console.error('Error calculating history data:', error);
      return {
        categoryData: DEFAULT_CATEGORY_DATA,
        comparisonData: DEFAULT_COMPARISON_DATA,
        alertsData: DEFAULT_ALERTS_DATA,
        totalThis: 0,
        totalLast: 0,
        insufficientData: true,
      };
    }
  }, [activeTab, transactions, dataRangeMonths]);

  const periodDifference = totalLast > 0
    ? ((totalThis - totalLast) / totalLast * 100).toFixed(0)
    : '0';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.softWhite} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>History</Text>
          <Text style={styles.headerSubtitle}>Your spending patterns</Text>
        </View>

        {/* Toggle Tabs */}
        <View style={styles.tabsContainer}>
          <ToggleTabs activeTab={activeTab} onTabChange={handleTabChange} />
        </View>

        {/* Limited Data Notice */}
        {(hasLimitedData || insufficientData) && (
          <View style={styles.limitedDataBanner}>
            <Ionicons name="information-circle" size={20} color={theme.colors.deepTeal} />
            <Text style={styles.limitedDataText}>
              {insufficientData
                ? `Not enough data for ${activeTab}ly comparison. You have ~${Math.round(dataRangeMonths)} month${dataRangeMonths >= 1.5 ? 's' : ''} of data.`
                : `Based on ~${Math.round(dataRangeMonths)} month${dataRangeMonths >= 1.5 ? 's' : ''} of data.`
              }
            </Text>
          </View>
        )}

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>This {activeTab}</Text>
            <Text style={styles.summaryValue}>€{totalThis.toLocaleString()}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Last {activeTab}</Text>
            <Text style={styles.summaryValue}>€{totalLast.toLocaleString()}</Text>
          </View>
          <View style={[styles.summaryCard, styles.changeCard]}>
            <Text style={styles.summaryLabel}>Change</Text>
            <Text style={[
              styles.changeValue,
              { color: Number(periodDifference) > 0 ? theme.colors.hotCoral : theme.colors.deepTeal }
            ]}>
              {Number(periodDifference) > 0 ? '+' : ''}{periodDifference}%
            </Text>
          </View>
        </View>

        {/* This Period vs Last Period Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            This {activeTab === 'week' ? 'Week' : activeTab === 'month' ? 'Month' : 'Year'} vs Last {activeTab === 'week' ? 'Week' : activeTab === 'month' ? 'Month' : 'Year'}
          </Text>
          <View style={styles.card}>
            <ComparisonChart data={comparisonData} />
          </View>
        </View>

        {/* Category Breakdown Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Category Breakdown</Text>
          <View style={styles.card}>
            <CategoryDonut data={categoryData} />
          </View>
        </View>

        {/* Spending Alerts Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Spending Insights</Text>
          {alertsData.map((alert, index) => (
            <SpendingAlert
              key={index}
              category={alert.category}
              percentageChange={alert.percentageChange}
              message={alert.message}
              severity={alert.severity}
            />
          ))}
        </View>

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
    paddingBottom: theme.spacing.md,
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
  tabsContainer: {
    marginBottom: theme.spacing.lg,
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
  summaryRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    alignItems: 'center',
    ...theme.cardShadow,
  },
  changeCard: {
    backgroundColor: theme.colors.softWhite,
    borderWidth: 1,
    borderColor: theme.colors.lightGray,
  },
  summaryLabel: {
    fontSize: 12,
    color: theme.colors.gray,
    marginBottom: theme.spacing.xs,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.deepNavy,
  },
  changeValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    ...theme.cardShadow,
  },
  bottomSpacer: {
    height: 100,
  },
  loadingContainer: {
    padding: theme.spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.gray,
  },
});
