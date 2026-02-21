import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../components/theme';
import { usePro } from '../../contexts/ProContext';
import { LockedFeatureModal, ProBadge } from '../../components/LockedFeatureModal';

/**
 * Weekly Recap Screen (Profile Tab)
 *
 * Shows AI prediction accuracy and weekly highlights:
 * - Large circular accuracy indicator
 * - Predicted vs Actual comparison
 * - Weekly highlights with checkmarks
 * - AI insights card
 */

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Accuracy Ring Component
interface AccuracyRingProps {
  percentage: number;
  label?: string;
}

const AccuracyRing: React.FC<AccuracyRingProps> = ({
  percentage,
  label = 'Prediction Accuracy',
}) => {
  const size = Math.min(SCREEN_WIDTH * 0.45, 160);
  const STROKE_WIDTH = 12;
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
    <View style={styles.comparisonCard}>
      <Text style={styles.comparisonTitle}>Predicted vs Actual</Text>
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
      <View style={[styles.diffContainer, isOver ? styles.diffOver : styles.diffUnder]}>
        <Text style={[styles.diffText, isOver ? styles.diffTextOver : styles.diffTextUnder]}>
          {isOver ? '+' : ''}€{Math.abs(difference)} ({isOver ? '+' : ''}{percentDiff}%)
        </Text>
        <Text style={styles.diffLabel}>
          {isOver ? 'Over predicted spend' : 'Under predicted spend'}
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
        <Text style={styles.iconText}>{isPositive ? '\u2713' : '\u2717'}</Text>
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
    <View style={styles.insightCard}>
      <View style={styles.insightIconContainer}>
        <Text style={styles.insightIcon}>{'\uD83D\uDCA1'}</Text>
      </View>
      <View style={styles.insightContent}>
        <Text style={styles.insightTitle}>AI INSIGHT</Text>
        <Text style={styles.insightText}>{insight}</Text>
      </View>
    </View>
  );
};

export default function ProfileScreen() {
  const { isPro } = usePro();
  const [showLockedModal, setShowLockedModal] = useState(false);

  // Hardcoded data for weekly recap
  const accuracyPercentage = 78;
  const predictedSpend = 485;
  const actualSpend = 512;

  const highlights = [
    { text: 'Correctly predicted 3/4 coffee runs', isPositive: true },
    { text: 'Caught Friday drinks spending', isPositive: true },
    { text: 'Missed grocery trip on Tuesday', isPositive: false },
  ];

  const aiInsight =
    'Your spending was 6% higher than predicted. Rain on Thursday led to 2 unexpected Uber rides.';

  const handleLockedPress = () => {
    setShowLockedModal(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LockedFeatureModal
        visible={showLockedModal}
        onClose={() => setShowLockedModal(false)}
        featureName="Weekly Recap"
        featureDescription="Get detailed insights on your prediction accuracy and spending patterns every week."
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Weekly Recap</Text>
            {!isPro && <ProBadge style={styles.proBadge} />}
          </View>
          <Text style={styles.subtitle}>Feb 14 - Feb 21, 2026</Text>
        </View>

        {/* Locked Overlay for non-Pro users */}
        {!isPro ? (
          <TouchableOpacity style={styles.lockedContainer} onPress={handleLockedPress} activeOpacity={0.9}>
            <View style={styles.lockedOverlay}>
              <View style={styles.lockedContent}>
                <View style={styles.lockedIconContainer}>
                  <Ionicons name="lock-closed" size={32} color={theme.colors.white} />
                </View>
                <Text style={styles.lockedTitle}>Unlock Weekly Recap</Text>
                <Text style={styles.lockedText}>See how accurate your predictions were and get AI insights</Text>
                <View style={styles.unlockButton}>
                  <Text style={styles.unlockButtonText}>Upgrade to Pro</Text>
                </View>
              </View>
            </View>

            {/* Blurred Preview */}
            <View style={styles.blurredPreview}>
              <AccuracyRing percentage={accuracyPercentage} />
            </View>
          </TouchableOpacity>
        ) : (
          <>
            {/* AI Accuracy Score */}
            <View style={styles.accuracySection}>
              <AccuracyRing percentage={accuracyPercentage} />
            </View>

            {/* Predicted vs Actual */}
            <PredictionComparison predicted={predictedSpend} actual={actualSpend} />

            {/* Weekly Highlights */}
            <View style={styles.highlightsSection}>
              <Text style={styles.sectionTitle}>Weekly Highlights</Text>
              {highlights.map((highlight, index) => (
                <HighlightItem
                  key={index}
                  text={highlight.text}
                  isPositive={highlight.isPositive}
                />
              ))}
            </View>

            {/* AI Insight */}
            <InsightCard insight={aiInsight} />
          </>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  header: {
    marginBottom: theme.spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.xs,
  },
  proBadge: {
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  // Locked State
  lockedContainer: {
    position: 'relative',
    minHeight: 400,
  },
  lockedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(17, 34, 49, 0.9)',
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: theme.borderRadius.lg,
  },
  lockedContent: {
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  lockedIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.hotCoral,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  lockedTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.white,
    marginBottom: theme.spacing.sm,
  },
  lockedText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
    lineHeight: 20,
  },
  unlockButton: {
    backgroundColor: theme.colors.hotCoral,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  unlockButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.white,
  },
  blurredPreview: {
    opacity: 0.2,
    alignItems: 'center',
    paddingTop: theme.spacing.xl,
  },
  // Accuracy Ring Styles
  accuracySection: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
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
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.deepNavy,
  },
  ringLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    textAlign: 'center',
    maxWidth: 80,
    marginTop: 2,
  },
  // Comparison Card Styles
  comparisonCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.cardShadow,
  },
  comparisonTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  comparisonColumn: {
    flex: 1,
    alignItems: 'center',
  },
  comparisonLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: theme.spacing.xs,
  },
  comparisonPredicted: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.deepNavy,
  },
  comparisonActual: {
    fontSize: 24,
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
  diffContainer: {
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  diffOver: {
    backgroundColor: 'rgba(254, 139, 24, 0.12)',
  },
  diffUnder: {
    backgroundColor: 'rgba(195, 255, 52, 0.12)',
  },
  diffText: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
  },
  diffTextOver: {
    color: theme.colors.midOrange,
  },
  diffTextUnder: {
    color: '#2E7D32',
  },
  diffLabel: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  // Highlights Section Styles
  highlightsSection: {
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.md,
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    ...theme.cardShadow,
    shadowOpacity: 0.05,
  },
  highlightIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
    fontSize: 14,
    fontWeight: '700',
  },
  highlightText: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.deepNavy,
    lineHeight: 20,
  },
  // Insight Card Styles
  insightCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    ...theme.cardShadow,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.deepTeal,
  },
  insightIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 78, 96, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  insightIcon: {
    fontSize: 20,
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.deepTeal,
    marginBottom: theme.spacing.xs,
    letterSpacing: 0.5,
  },
  insightText: {
    fontSize: 15,
    color: theme.colors.deepNavy,
    lineHeight: 22,
  },
});
