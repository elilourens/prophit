import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from './theme';

export type PredictionType = 'food' | 'coffee' | 'drinks' | 'transport' | 'shopping' | 'other';

export interface Prediction {
  id: string;
  type: PredictionType;
  title: string;
  probability: number;
  estimatedMin: number;
  estimatedMax: number;
  agreedBy?: string[];
}

interface PredictionCardProps {
  prediction: Prediction;
}

// Icon mapping using Unicode symbols
const getIconForType = (type: PredictionType): string => {
  const iconMap: Record<PredictionType, string> = {
    food: '🍽️',
    coffee: '☕',
    drinks: '🍻',
    transport: '🚗',
    shopping: '🛍️',
    other: '💳',
  };
  return iconMap[type] || '💳';
};

// Get LLM display name
const getLLMLabel = (llm: string): string => {
  const labels: Record<string, string> = {
    claude: 'Claude',
    openai: 'GPT',
    gemini: 'Gemini',
  };
  return labels[llm.toLowerCase()] || llm;
};

// Get color based on probability
const getProbabilityColor = (probability: number): string => {
  if (probability >= 70) return theme.colors.hotCoral;
  if (probability >= 40) return theme.colors.midOrange;
  return theme.colors.deepTeal;
};

export const PredictionCard: React.FC<PredictionCardProps> = ({ prediction }) => {
  const { type, title, probability, estimatedMin, estimatedMax, agreedBy } = prediction;
  const icon = getIconForType(type);
  const probabilityColor = getProbabilityColor(probability);

  return (
    <View style={styles.card}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <View style={styles.contentContainer}>
        <View style={styles.headerRow}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={[styles.probability, { color: probabilityColor }]}>
            {probability}%
          </Text>
        </View>
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${Math.min(probability, 100)}%`,
                backgroundColor: probabilityColor,
              },
            ]}
          />
        </View>
        <View style={styles.footerRow}>
          <Text style={styles.estimate}>
            €{estimatedMin.toFixed(0)}-{estimatedMax.toFixed(0)} estimated
          </Text>
          {agreedBy && agreedBy.length > 0 && (
            <View style={styles.agreedByContainer}>
              {agreedBy.map((llm, idx) => (
                <View key={llm} style={[styles.llmBadge, idx > 0 && { marginLeft: 4 }]}>
                  <Text style={styles.llmBadgeText}>{getLLMLabel(llm)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
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
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  estimate: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
  },
  agreedByContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  llmBadge: {
    backgroundColor: theme.colors.deepTeal + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  llmBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.deepTeal,
  },
});

export default PredictionCard;
