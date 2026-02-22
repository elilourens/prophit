import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from './theme';

interface SeasonalBarsProps {
  winterSpend: number;
  summerSpend: number;
}

export const SeasonalBars: React.FC<SeasonalBarsProps> = ({
  winterSpend,
  summerSpend
}) => {
  const maxSpend = Math.max(winterSpend, summerSpend, 1);
  const winterPct = (winterSpend / maxSpend) * 100;
  const summerPct = (summerSpend / maxSpend) * 100;

  const formatCurrency = (value: number) => {
    return `€${value.toLocaleString('en-EU')}`;
  };

  return (
    <View style={styles.container}>
      {/* Winter Bar */}
      <View style={styles.barContainer}>
        <View style={styles.labelRow}>
          <Text style={styles.seasonLabel}>Winter</Text>
          <Text style={styles.valueLabel}>{formatCurrency(winterSpend)}</Text>
        </View>
        <View style={styles.barBackground}>
          <View
            style={[
              styles.bar,
              styles.winterBar,
              { width: `${winterPct}%` }
            ]}
          />
        </View>
      </View>

      {/* Summer Bar */}
      <View style={styles.barContainer}>
        <View style={styles.labelRow}>
          <Text style={styles.seasonLabel}>Summer</Text>
          <Text style={styles.valueLabel}>{formatCurrency(summerSpend)}</Text>
        </View>
        <View style={styles.barBackground}>
          <View
            style={[
              styles.bar,
              styles.summerBar,
              { width: `${summerPct}%` }
            ]}
          />
        </View>
      </View>

      {/* Comparison */}
      <View style={styles.comparisonContainer}>
        <Text style={styles.comparisonText}>
          {winterSpend > summerSpend
            ? `Winter spending is ${((winterSpend - summerSpend) / summerSpend * 100).toFixed(0)}% higher`
            : `Summer spending is ${((summerSpend - winterSpend) / winterSpend * 100).toFixed(0)}% higher`
          }
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: theme.spacing.md,
  },
  barContainer: {
    marginBottom: theme.spacing.lg,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  seasonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.deepNavy,
  },
  valueLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.deepNavy,
  },
  barBackground: {
    height: 24,
    backgroundColor: theme.colors.lightGray,
    borderRadius: 12,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 12,
  },
  winterBar: {
    backgroundColor: theme.colors.deepTeal,
  },
  summerBar: {
    backgroundColor: theme.colors.hotCoral,
  },
  comparisonContainer: {
    marginTop: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.softWhite,
    borderRadius: theme.borderRadius.md,
  },
  comparisonText: {
    fontSize: 14,
    color: theme.colors.gray,
    textAlign: 'center',
  },
});
