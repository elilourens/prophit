import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from './theme';

interface InsightCardProps {
  insight: string;
  icon?: string;
}

export const InsightCard: React.FC<InsightCardProps> = ({
  insight,
  icon = '\uD83D\uDCA1', // Lightbulb emoji
}) => {
  return (
    <View style={styles.card}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <View style={styles.contentContainer}>
        <Text style={styles.title}>AI Insight</Text>
        <Text style={styles.insightText}>{insight}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    ...theme.cardShadow,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.deepTeal,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 78, 96, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  icon: {
    fontSize: 22,
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: theme.typography.caption.fontSize,
    fontWeight: '600',
    color: theme.colors.deepTeal,
    marginBottom: theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  insightText: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.deepNavy,
    lineHeight: 24,
  },
});
