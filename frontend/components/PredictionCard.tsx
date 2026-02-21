import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from './theme';

export type PredictionType = 'food' | 'coffee' | 'drinks' | 'transport';

export interface Prediction {
  id: string;
  type: PredictionType;
  title: string;
  probability: number;
  estimatedMin: number;
  estimatedMax: number;
}

interface PredictionCardProps {
  prediction: Prediction;
}

// Icon mapping using Unicode symbols
const getIconForType = (type: PredictionType): string => {
  const iconMap: Record<PredictionType, string> = {
    food: '\uD83C\uDF7D\uFE0F',     // Fork and knife
    coffee: '\u2615',               // Hot beverage
    drinks: '\uD83C\uDF7B',         // Clinking beer mugs
    transport: '\uD83D\uDE97',      // Car
  };
  return iconMap[type];
};

// Get color based on probability
const getProbabilityColor = (probability: number): string => {
  if (probability >= 70) return theme.colors.hotCoral;
  if (probability >= 40) return theme.colors.midOrange;
  return theme.colors.deepTeal;
};

export const PredictionCard: React.FC<PredictionCardProps> = ({ prediction }) => {
  const { type, title, probability, estimatedMin, estimatedMax } = prediction;
  const icon = getIconForType(type);
  const probabilityColor = getProbabilityColor(probability);

  return (
    <View style={styles.card}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <View style={styles.contentContainer}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{title}</Text>
          <Text style={[styles.probability, { color: probabilityColor }]}>
            {probability}%
          </Text>
        </View>
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${probability}%`,
                backgroundColor: probabilityColor,
              },
            ]}
          />
        </View>
        <Text style={styles.estimate}>
          {'\u20AC'}{estimatedMin}-{estimatedMax} estimated
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...theme.cardShadow,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.softWhite,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  icon: {
    fontSize: 24,
  },
  contentContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  title: {
    ...theme.typography.body,
    color: theme.colors.deepNavy,
    fontWeight: '600',
  },
  probability: {
    ...theme.typography.body,
    fontWeight: '700',
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: theme.colors.probabilityBarBackground,
    borderRadius: theme.borderRadius.full,
    marginBottom: theme.spacing.sm,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: theme.borderRadius.full,
  },
  estimate: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
  },
});

export default PredictionCard;
