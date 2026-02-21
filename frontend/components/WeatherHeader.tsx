import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from './theme';

interface WeatherHeaderProps {
  location?: string;
  temperature?: number;
  weatherIcon?: string;
  userName?: string;
}

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

// Weather icon mapping using Unicode symbols
const getWeatherSymbol = (icon?: string): string => {
  const iconMap: Record<string, string> = {
    sunny: '\u2600\uFE0F',      // Sun
    cloudy: '\u2601\uFE0F',     // Cloud
    rainy: '\uD83C\uDF27\uFE0F', // Cloud with rain
    partlyCloudy: '\u26C5',     // Sun behind cloud
    stormy: '\u26C8\uFE0F',     // Cloud with lightning
  };
  return iconMap[icon || 'partlyCloudy'] || '\u26C5';
};

export const WeatherHeader: React.FC<WeatherHeaderProps> = ({
  location = 'Dublin, IE',
  temperature = 12,
  weatherIcon = 'partlyCloudy',
  userName = 'Alex',
}) => {
  const greeting = getGreeting();
  const weatherSymbol = getWeatherSymbol(weatherIcon);

  return (
    <View style={styles.container}>
      <View style={styles.weatherRow}>
        <View style={styles.locationContainer}>
          <Text style={styles.locationIcon}>{'\uD83D\uDCCD'}</Text>
          <Text style={styles.locationText}>{location}</Text>
        </View>
        <View style={styles.temperatureContainer}>
          <Text style={styles.weatherIcon}>{weatherSymbol}</Text>
          <Text style={styles.temperatureText}>{temperature}°C</Text>
        </View>
      </View>
      <Text style={styles.greeting}>
        {greeting}, {userName}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  weatherRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationIcon: {
    fontSize: 16,
    marginRight: theme.spacing.xs,
  },
  locationText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
  },
  temperatureContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weatherIcon: {
    fontSize: 20,
    marginRight: theme.spacing.xs,
  },
  temperatureText: {
    ...theme.typography.body,
    color: theme.colors.deepNavy,
    fontWeight: '600',
  },
  greeting: {
    ...theme.typography.header,
    color: theme.colors.deepNavy,
  },
});

export default WeatherHeader;
