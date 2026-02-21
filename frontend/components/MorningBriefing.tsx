import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from './theme';

interface MorningBriefingProps {
  userName?: string;
  temperature?: number;
  location?: string;
  weatherIcon?: string;
  topPrediction?: {
    title: string;
    probability: number;
  };
  nudge?: string;
  onViewFullBriefing?: () => void;
}

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

// Weather icon mapping
const getWeatherSymbol = (icon?: string): string => {
  const iconMap: Record<string, string> = {
    sunny: '\u2600\uFE0F',
    cloudy: '\u2601\uFE0F',
    rainy: '\uD83C\uDF27\uFE0F',
    partlyCloudy: '\u26C5',
    stormy: '\u26C8\uFE0F',
  };
  return iconMap[icon || 'sunny'] || '\u2600\uFE0F';
};

export const MorningBriefing: React.FC<MorningBriefingProps> = ({
  userName = 'Alex',
  temperature = 12,
  location = 'Dublin',
  weatherIcon = 'sunny',
  topPrediction = {
    title: 'Lunch out',
    probability: 80,
  },
  nudge = 'You usually spend more on Fridays',
  onViewFullBriefing,
}) => {
  const greeting = getGreeting();
  const weatherSymbol = getWeatherSymbol(weatherIcon);

  return (
    <View style={styles.card}>
      {/* Accent bar at top */}
      <View style={styles.accentBar} />

      <View style={styles.content}>
        {/* Greeting */}
        <Text style={styles.greeting}>
          {greeting}, {userName}!
        </Text>

        {/* Weather Summary */}
        <View style={styles.weatherRow}>
          <Text style={styles.weatherIcon}>{weatherSymbol}</Text>
          <Text style={styles.weatherText}>
            {temperature}°C, {location}
          </Text>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Top Prediction */}
        <View style={styles.predictionRow}>
          <View style={styles.predictionBadge}>
            <Text style={styles.predictionBadgeText}>Top prediction</Text>
          </View>
          <Text style={styles.predictionText}>
            {topPrediction.probability}% chance of {topPrediction.title.toLowerCase()}
          </Text>
        </View>

        {/* Nudge/Tip */}
        <View style={styles.nudgeContainer}>
          <Text style={styles.nudgeIcon}>{'\uD83D\uDCA1'}</Text>
          <Text style={styles.nudgeText}>{nudge}</Text>
        </View>

        {/* View Full Briefing Link */}
        <TouchableOpacity
          style={styles.linkContainer}
          onPress={onViewFullBriefing}
          activeOpacity={0.7}
        >
          <Text style={styles.linkText}>View full briefing</Text>
          <Text style={styles.linkArrow}>{'\u2192'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.lg,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    overflow: 'hidden',
    ...theme.cardShadow,
  },
  accentBar: {
    height: 4,
    backgroundColor: theme.colors.neonYellow,
  },
  content: {
    padding: theme.spacing.md,
  },
  greeting: {
    ...theme.typography.subheader,
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.sm,
  },
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  weatherIcon: {
    fontSize: 20,
    marginRight: theme.spacing.sm,
  },
  weatherText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.probabilityBarBackground,
    marginBottom: theme.spacing.md,
  },
  predictionRow: {
    marginBottom: theme.spacing.md,
  },
  predictionBadge: {
    backgroundColor: theme.colors.hotCoral,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    alignSelf: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  predictionBadgeText: {
    ...theme.typography.small,
    color: theme.colors.white,
    fontWeight: '600',
  },
  predictionText: {
    ...theme.typography.body,
    color: theme.colors.deepNavy,
    fontWeight: '500',
  },
  nudgeContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.softWhite,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  nudgeIcon: {
    fontSize: 16,
    marginRight: theme.spacing.sm,
  },
  nudgeText: {
    ...theme.typography.bodySmall,
    color: theme.colors.deepTeal,
    flex: 1,
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: {
    ...theme.typography.body,
    color: theme.colors.hotCoral,
    fontWeight: '600',
  },
  linkArrow: {
    fontSize: 18,
    color: theme.colors.hotCoral,
    marginLeft: theme.spacing.sm,
  },
});

export default MorningBriefing;
