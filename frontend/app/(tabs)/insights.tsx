import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../components/theme';
import { RunwayRing } from '../../components/RunwayRing';
import { SeasonalBars } from '../../components/SeasonalBars';
import { SpendTrajectory } from '../../components/SpendTrajectory';

// Mock data for Insights screen
const MOCK_DATA = {
  runway: {
    months: 8.5,
    maxMonths: 12,
  },
  seasonal: {
    winterSpend: 2450,
    summerSpend: 1890,
  },
  trajectory: {
    historical: [1850, 2100, 1920, 2340, 2180, 2050], // Past 6 months
    projected: [2150, 2280, 2100], // Next 3 months
    labels: ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'],
  },
};

/**
 * Insights Screen - Long Horizon / Insights
 *
 * Screen for detailed spending insights and analytics including:
 * - Job Quit Runway (circular progress ring)
 * - Seasonal Spending Comparison (Winter vs Summer)
 * - Monthly Spend Trajectory (line graph with projection)
 */
export default function InsightsScreen() {
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
          <Text style={styles.headerTitle}>Insights</Text>
          <Text style={styles.headerSubtitle}>Long-term financial outlook</Text>
        </View>

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
                months={MOCK_DATA.runway.months}
                maxMonths={MOCK_DATA.runway.maxMonths}
              />
            </View>
            <View style={styles.runwayInfo}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Current Savings</Text>
                <Text style={styles.infoValue}>€18,500</Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Monthly Burn</Text>
                <Text style={styles.infoValue}>€2,180</Text>
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
              winterSpend={MOCK_DATA.seasonal.winterSpend}
              summerSpend={MOCK_DATA.seasonal.summerSpend}
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
              historicalData={MOCK_DATA.trajectory.historical}
              projectedData={MOCK_DATA.trajectory.projected}
              labels={MOCK_DATA.trajectory.labels}
            />
          </View>
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
});
