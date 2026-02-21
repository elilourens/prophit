import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../components/theme';
import { ToggleTabs, TabOption } from '../../components/ToggleTabs';
import { ComparisonChart } from '../../components/ComparisonChart';
import { CategoryDonut } from '../../components/CategoryDonut';
import { SpendingAlert } from '../../components/SpendingAlert';

// Mock data for spending categories
const CATEGORY_DATA = [
  { name: 'Food & Dining', value: 145, color: theme.colors.hotCoral },
  { name: 'Transport', value: 67, color: theme.colors.deepTeal },
  { name: 'Entertainment', value: 89, color: theme.colors.midOrange },
  { name: 'Shopping', value: 124, color: theme.colors.neonYellow },
  { name: 'Bills', value: 210, color: theme.colors.deepNavy },
];

// Mock data for comparison chart
const COMPARISON_DATA = [
  { label: 'Mon', thisWeek: 45, lastWeek: 38 },
  { label: 'Tue', thisWeek: 32, lastWeek: 42 },
  { label: 'Wed', thisWeek: 58, lastWeek: 35 },
  { label: 'Thu', thisWeek: 48, lastWeek: 52 },
  { label: 'Fri', thisWeek: 72, lastWeek: 45 },
  { label: 'Sat', thisWeek: 95, lastWeek: 88 },
  { label: 'Sun', thisWeek: 65, lastWeek: 55 },
];

// Mock alerts data
const ALERTS_DATA = [
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
 * - This Week vs Last Week comparison chart
 * - Category Breakdown donut chart
 * - Unusual Spike Alerts
 */
export default function HistoryScreen() {
  const [activeTab, setActiveTab] = useState<TabOption>('week');

  const handleTabChange = (tab: TabOption) => {
    setActiveTab(tab);
  };

  // Calculate total spending
  const totalThisWeek = COMPARISON_DATA.reduce((sum, day) => sum + day.thisWeek, 0);
  const totalLastWeek = COMPARISON_DATA.reduce((sum, day) => sum + day.lastWeek, 0);
  const weekDifference = ((totalThisWeek - totalLastWeek) / totalLastWeek * 100).toFixed(0);

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

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>This {activeTab}</Text>
            <Text style={styles.summaryValue}>€{totalThisWeek}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Last {activeTab}</Text>
            <Text style={styles.summaryValue}>€{totalLastWeek}</Text>
          </View>
          <View style={[styles.summaryCard, styles.changeCard]}>
            <Text style={styles.summaryLabel}>Change</Text>
            <Text style={[
              styles.changeValue,
              { color: Number(weekDifference) > 0 ? theme.colors.hotCoral : theme.colors.deepTeal }
            ]}>
              {Number(weekDifference) > 0 ? '+' : ''}{weekDifference}%
            </Text>
          </View>
        </View>

        {/* This Week vs Last Week Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>This Week vs Last Week</Text>
          <View style={styles.card}>
            <ComparisonChart data={COMPARISON_DATA} />
          </View>
        </View>

        {/* Category Breakdown Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Category Breakdown</Text>
          <View style={styles.card}>
            <CategoryDonut data={CATEGORY_DATA} />
          </View>
        </View>

        {/* Unusual Spike Alerts Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Unusual Spike Alerts</Text>
          {ALERTS_DATA.map((alert, index) => (
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
});
