import React from 'react';
import { View, ScrollView, StyleSheet, Text, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WeatherHeader } from '../../components/WeatherHeader';
import { MorningBriefing } from '../../components/MorningBriefing';
import { PredictionCard, Prediction } from '../../components/PredictionCard';
import { TalkToProphit } from '../../components/TalkToProphit';
import { UpgradeBanner } from '../../components/UpgradeBanner';
import { theme } from '../../components/theme';

// Mock data for predictions
const MOCK_PREDICTIONS: Prediction[] = [
  {
    id: '1',
    type: 'food',
    title: 'Lunch out',
    probability: 80,
    estimatedMin: 12,
    estimatedMax: 15,
  },
  {
    id: '2',
    type: 'coffee',
    title: 'Coffee run',
    probability: 50,
    estimatedMin: 4,
    estimatedMax: 5,
  },
  {
    id: '3',
    type: 'drinks',
    title: 'After work drinks',
    probability: 46,
    estimatedMin: 18,
    estimatedMax: 25,
  },
  {
    id: '4',
    type: 'transport',
    title: 'Rain \u2192 Uber home',
    probability: 20,
    estimatedMin: 12,
    estimatedMax: 18,
  },
];

// Mock weather data
const MOCK_WEATHER = {
  location: 'Dublin, IE',
  temperature: 12,
  weatherIcon: 'partlyCloudy' as const,
};

// User data
const USER_NAME = 'Alex';

export default function HomeScreen() {
  const handleViewFullBriefing = () => {
    // Navigate to full briefing screen
    console.log('Navigate to full briefing');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Weather Header */}
        <WeatherHeader
          location={MOCK_WEATHER.location}
          temperature={MOCK_WEATHER.temperature}
          weatherIcon={MOCK_WEATHER.weatherIcon}
          userName={USER_NAME}
        />

        {/* Morning Briefing Card */}
        <MorningBriefing
          userName={USER_NAME}
          temperature={MOCK_WEATHER.temperature}
          location="Dublin"
          weatherIcon="sunny"
          topPrediction={{
            title: 'Lunch out',
            probability: 80,
          }}
          nudge="You usually spend more on Fridays"
          onViewFullBriefing={handleViewFullBriefing}
        />

        {/* Talk to the Prophit - AI Chat Button */}
        <TalkToProphit />

        {/* Upgrade Banner for non-Pro users */}
        <UpgradeBanner />

        {/* Section Title */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Predictions</Text>
        </View>

        {/* Prediction Cards */}
        <View style={styles.predictionsContainer}>
          {MOCK_PREDICTIONS.map((prediction) => (
            <PredictionCard key={prediction.id} prediction={prediction} />
          ))}
        </View>
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
    paddingBottom: theme.spacing.xxl,
  },
  sectionHeader: {
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    ...theme.typography.subheader,
    color: theme.colors.deepNavy,
  },
  predictionsContainer: {
    paddingHorizontal: theme.spacing.md,
  },
});
