import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../components/theme';
import { RunwayRing } from '../../components/RunwayRing';
import { SeasonalBars } from '../../components/SeasonalBars';
import { SpendTrajectory } from '../../components/SpendTrajectory';
import { usePro } from '../../contexts/ProContext';
import { LockedFeatureModal, ProBadge } from '../../components/LockedFeatureModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

// Weekly Recap mock data
const WEEKLY_RECAP_DATA = {
  accuracyPercentage: 78,
  predictedSpend: 485,
  actualSpend: 512,
  highlights: [
    { text: 'Correctly predicted 3/4 coffee runs', isPositive: true },
    { text: 'Caught Friday drinks spending', isPositive: true },
    { text: 'Missed grocery trip on Tuesday', isPositive: false },
  ],
  aiInsight: 'Your spending was 6% higher than predicted. Rain on Thursday led to 2 unexpected Uber rides.',
};

// Accuracy Ring Component
interface AccuracyRingProps {
  percentage: number;
  label?: string;
}

const AccuracyRing: React.FC<AccuracyRingProps> = ({
  percentage,
  label = 'Prediction Accuracy',
}) => {
  const size = Math.min(SCREEN_WIDTH * 0.4, 140);
  const STROKE_WIDTH = 10;
  const RADIUS = (size - STROKE_WIDTH) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  const clampedPercentage = Math.min(Math.max(percentage, 0), 100);
  const progress = clampedPercentage / 100;
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

  return (
    <View style={styles.ringContainer}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="accuracyGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={theme.colors.neonYellow} />
            <Stop offset="100%" stopColor={theme.colors.deepTeal} />
          </LinearGradient>
        </Defs>

        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={RADIUS}
          stroke={theme.colors.lightGray}
          strokeWidth={STROKE_WIDTH}
          fill="transparent"
        />

        {/* Progress circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={RADIUS}
          stroke="url(#accuracyGradient)"
          strokeWidth={STROKE_WIDTH}
          fill="transparent"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90, ${size / 2}, ${size / 2})`}
        />
      </Svg>

      <View style={styles.ringTextContainer}>
        <Text style={styles.ringPercentage}>{Math.round(clampedPercentage)}%</Text>
        <Text style={styles.ringLabel}>{label}</Text>
      </View>
    </View>
  );
};

// Prediction Comparison Component
interface PredictionComparisonProps {
  predicted: number;
  actual: number;
}

const PredictionComparison: React.FC<PredictionComparisonProps> = ({
  predicted,
  actual,
}) => {
  const difference = actual - predicted;
  const percentDiff = ((difference / predicted) * 100).toFixed(1);
  const isOver = difference > 0;

  return (
    <View style={styles.comparisonRow}>
      <View style={styles.comparisonColumn}>
        <Text style={styles.comparisonLabel}>PREDICTED</Text>
        <Text style={styles.comparisonPredicted}>€{predicted}</Text>
      </View>
      <Text style={styles.vsText}>vs</Text>
      <View style={styles.comparisonColumn}>
        <Text style={styles.comparisonLabel}>ACTUAL</Text>
        <Text style={[styles.comparisonActual, isOver && styles.overBudget]}>
          €{actual}
        </Text>
      </View>
    </View>
  );
};

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
 *
 * Screen for detailed spending insights and analytics including:
 * - Job Quit Runway (circular progress ring)
 * - Seasonal Spending Comparison (Winter vs Summer)
 * - Monthly Spend Trajectory (line graph with projection)
 * - Weekly Recap (Pro feature)
 */
export default function InsightsScreen() {
  const { isPro } = usePro();
  const [showLockedModal, setShowLockedModal] = useState(false);

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

        {/* Weekly Recap Section */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Weekly Recap</Text>
            {!isPro && <ProBadge />}
          </View>
          <Text style={styles.recapDateRange}>Feb 14 - Feb 21, 2026</Text>

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
                  See prediction accuracy and get AI insights
                </Text>
                <View style={styles.unlockButton}>
                  <Text style={styles.unlockButtonText}>Upgrade to Pro</Text>
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.card}>
              {/* Accuracy Ring */}
              <View style={styles.recapAccuracySection}>
                <AccuracyRing percentage={WEEKLY_RECAP_DATA.accuracyPercentage} />
              </View>

              {/* Predicted vs Actual */}
              <View style={styles.recapComparisonSection}>
                <Text style={styles.cardSubtitle}>Predicted vs Actual</Text>
                <PredictionComparison
                  predicted={WEEKLY_RECAP_DATA.predictedSpend}
                  actual={WEEKLY_RECAP_DATA.actualSpend}
                />
              </View>

              {/* Weekly Highlights */}
              <View style={styles.recapHighlightsSection}>
                <Text style={styles.cardSubtitle}>Highlights</Text>
                {WEEKLY_RECAP_DATA.highlights.map((highlight, index) => (
                  <HighlightItem
                    key={index}
                    text={highlight.text}
                    isPositive={highlight.isPositive}
                  />
                ))}
              </View>

              {/* AI Insight */}
              <InsightCard insight={WEEKLY_RECAP_DATA.aiInsight} />
            </View>
          )}
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
  // Accuracy Ring styles
  ringContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ringTextContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPercentage: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.deepNavy,
  },
  ringLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    textAlign: 'center',
    maxWidth: 70,
    marginTop: 2,
  },
  // Weekly Recap sections
  recapAccuracySection: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.lightGray,
  },
  recapComparisonSection: {
    paddingBottom: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.lightGray,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.sm,
  },
  comparisonColumn: {
    flex: 1,
    alignItems: 'center',
  },
  comparisonLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: theme.spacing.xs,
  },
  comparisonPredicted: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.deepNavy,
  },
  comparisonActual: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.deepNavy,
  },
  overBudget: {
    color: theme.colors.midOrange,
  },
  vsText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    paddingHorizontal: theme.spacing.sm,
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
