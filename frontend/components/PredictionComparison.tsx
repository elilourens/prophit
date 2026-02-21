import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from './theme';

interface PredictionComparisonProps {
  predictedAmount: number;
  actualAmount: number;
  currency?: string;
}

export const PredictionComparison: React.FC<PredictionComparisonProps> = ({
  predictedAmount,
  actualAmount,
  currency = '\u20AC',
}) => {
  const difference = actualAmount - predictedAmount;
  const percentageDiff = ((difference / predictedAmount) * 100).toFixed(1);
  const isOverBudget = difference > 0;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Predicted vs Actual</Text>

      <View style={styles.comparisonContainer}>
        <View style={styles.column}>
          <Text style={styles.columnLabel}>Predicted</Text>
          <Text style={styles.predictedValue}>
            {currency}{predictedAmount.toLocaleString()}
          </Text>
        </View>

        <View style={styles.vsContainer}>
          <Text style={styles.vsText}>vs</Text>
        </View>

        <View style={styles.column}>
          <Text style={styles.columnLabel}>Actual</Text>
          <Text style={[styles.actualValue, isOverBudget && styles.overBudget]}>
            {currency}{actualAmount.toLocaleString()}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.differenceContainer,
          isOverBudget ? styles.overBudgetBg : styles.underBudgetBg,
        ]}
      >
        <Text
          style={[
            styles.differenceText,
            isOverBudget ? styles.overBudgetText : styles.underBudgetText,
          ]}
        >
          {isOverBudget ? '+' : ''}{currency}{Math.abs(difference).toLocaleString()} ({isOverBudget ? '+' : ''}{percentageDiff}%)
        </Text>
        <Text style={styles.differenceLabel}>
          {isOverBudget ? 'Over predicted spend' : 'Under predicted spend'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.cardShadow,
  },
  title: {
    fontSize: theme.typography.h3.fontSize,
    fontWeight: theme.typography.h3.fontWeight,
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  comparisonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  column: {
    flex: 1,
    alignItems: 'center',
  },
  columnLabel: {
    fontSize: theme.typography.caption.fontSize,
    color: theme.colors.gray,
    marginBottom: theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  predictedValue: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.deepNavy,
  },
  actualValue: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.deepNavy,
  },
  overBudget: {
    color: theme.colors.midOrange,
  },
  vsContainer: {
    paddingHorizontal: theme.spacing.md,
  },
  vsText: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.gray,
    fontWeight: '500',
  },
  differenceContainer: {
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  overBudgetBg: {
    backgroundColor: 'rgba(254, 139, 24, 0.12)',
  },
  underBudgetBg: {
    backgroundColor: 'rgba(195, 255, 52, 0.12)',
  },
  differenceText: {
    fontSize: theme.typography.h3.fontSize,
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
  },
  overBudgetText: {
    color: theme.colors.midOrange,
  },
  underBudgetText: {
    color: '#2E7D32', // Darker green for better readability on yellow background
  },
  differenceLabel: {
    fontSize: theme.typography.caption.fontSize,
    color: theme.colors.gray,
  },
});
