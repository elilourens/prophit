import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { theme } from './theme';

interface ScenarioResult {
  label: string;
  value: string;
  isPositive?: boolean;
}

interface ScenarioCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  results: ScenarioResult[];
  style?: ViewStyle;
}

export const ScenarioCard: React.FC<ScenarioCardProps> = ({
  title,
  subtitle,
  children,
  results,
  style,
}) => {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>

      <View style={styles.content}>{children}</View>

      <View style={styles.resultsContainer}>
        {results.map((result, index) => (
          <View key={index} style={styles.resultRow}>
            <Text style={styles.resultLabel}>{result.label}</Text>
            <Text
              style={[
                styles.resultValue,
                result.isPositive !== undefined && {
                  color: result.isPositive
                    ? theme.colors.neonYellow
                    : theme.colors.midOrange,
                  backgroundColor: result.isPositive
                    ? 'rgba(195, 255, 52, 0.15)'
                    : 'rgba(254, 139, 24, 0.15)',
                  paddingHorizontal: theme.spacing.sm,
                  paddingVertical: theme.spacing.xs,
                  borderRadius: theme.borderRadius.sm,
                },
              ]}
            >
              {result.value}
            </Text>
          </View>
        ))}
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
  header: {
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: theme.typography.h3.fontSize,
    fontWeight: theme.typography.h3.fontWeight,
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.typography.caption.fontSize,
    color: theme.colors.gray,
  },
  content: {
    marginBottom: theme.spacing.md,
  },
  resultsContainer: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.lightGray,
    paddingTop: theme.spacing.md,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  resultLabel: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.gray,
  },
  resultValue: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: '700',
    color: theme.colors.deepNavy,
  },
});
