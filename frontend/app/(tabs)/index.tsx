import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Text, SafeAreaView, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { WeatherHeader } from '../../components/WeatherHeader';
import { MorningBriefing } from '../../components/MorningBriefing';
import { PredictionCard, Prediction } from '../../components/PredictionCard';
import { TalkToProphit } from '../../components/TalkToProphit';
import { UpgradeBanner } from '../../components/UpgradeBanner';
import { theme } from '../../components/theme';
import { useArena } from '../../contexts/ArenaContext';
import { useUserData } from '../../contexts/UserDataContext';
import { getCalendarPredictions, getDemoTransactionData, CalendarPrediction } from '../../services/backendApi';

// Weather data for Dublin (could be fetched from a weather API)
const DUBLIN_WEATHER = {
  location: 'Dublin, IE',
  temperature: 12,
  weatherIcon: 'partlyCloudy' as const,
};

// Map backend categories to prediction types
function mapCategoryToType(category: string): 'food' | 'coffee' | 'drinks' | 'transport' | 'shopping' | 'other' {
  const lowerCategory = category.toLowerCase();
  if (lowerCategory.includes('lunch') || lowerCategory.includes('dinner') || lowerCategory.includes('food') || lowerCategory.includes('dining')) {
    return 'food';
  }
  if (lowerCategory.includes('coffee') || lowerCategory.includes('cafe')) {
    return 'coffee';
  }
  if (lowerCategory.includes('drink') || lowerCategory.includes('bar') || lowerCategory.includes('pub')) {
    return 'drinks';
  }
  if (lowerCategory.includes('uber') || lowerCategory.includes('taxi') || lowerCategory.includes('transport') || lowerCategory.includes('bus')) {
    return 'transport';
  }
  if (lowerCategory.includes('shop') || lowerCategory.includes('amazon') || lowerCategory.includes('store')) {
    return 'shopping';
  }
  return 'other';
}

// Convert API predictions to component format
function convertToPredictions(calendarPredictions: CalendarPrediction[]): Prediction[] {
  if (!calendarPredictions || calendarPredictions.length === 0) {
    return getDefaultPredictions();
  }

  // Get today's predictions
  const today = calendarPredictions[0];
  if (!today?.predictions) {
    return getDefaultPredictions();
  }

  return today.predictions.slice(0, 4).map((pred, index) => ({
    id: String(index + 1),
    type: mapCategoryToType(pred.category),
    title: pred.description || pred.category,
    probability: Math.round(pred.probability * 100),
    estimatedMin: Math.floor(pred.amount * 0.8),
    estimatedMax: Math.ceil(pred.amount * 1.2),
  }));
}

// Default predictions when API fails or no data
function getDefaultPredictions(): Prediction[] {
  return [
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
      title: 'Rain → Uber home',
      probability: 20,
      estimatedMin: 12,
      estimatedMax: 18,
    },
  ];
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useArena();
  const { isDataLoaded } = useUserData();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [topPrediction, setTopPrediction] = useState<{ title: string; probability: number } | null>(null);

  // Get username from context or default
  const userName = user?.username || 'there';

  // Fetch predictions when user data is loaded
  useEffect(() => {
    if (isDataLoaded) {
      fetchPredictions();
    }
  }, [isDataLoaded]);

  const fetchPredictions = async () => {
    setIsLoading(true);
    try {
      const demoData = getDemoTransactionData();
      const result = await getCalendarPredictions(demoData);

      if (result.predictions && result.predictions.length > 0) {
        const converted = convertToPredictions(result.predictions);
        setPredictions(converted);

        // Set top prediction
        if (converted.length > 0) {
          setTopPrediction({
            title: converted[0].title,
            probability: converted[0].probability,
          });
        }
      } else {
        // Fall back to defaults
        const defaults = getDefaultPredictions();
        setPredictions(defaults);
        setTopPrediction({
          title: defaults[0].title,
          probability: defaults[0].probability,
        });
      }
    } catch (error) {
      console.error('Failed to fetch predictions:', error);
      // Fall back to defaults
      const defaults = getDefaultPredictions();
      setPredictions(defaults);
      setTopPrediction({
        title: defaults[0].title,
        probability: defaults[0].probability,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewFullBriefing = () => {
    router.push('/briefing');
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
          location={DUBLIN_WEATHER.location}
          temperature={DUBLIN_WEATHER.temperature}
          weatherIcon={DUBLIN_WEATHER.weatherIcon}
          userName={userName}
        />

        {/* Morning Briefing Card */}
        <MorningBriefing
          userName={userName}
          temperature={DUBLIN_WEATHER.temperature}
          location="Dublin"
          weatherIcon="sunny"
          topPrediction={topPrediction || { title: 'Loading...', probability: 0 }}
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
          {(!isDataLoaded || isLoading) ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.hotCoral} />
              <Text style={styles.loadingText}>Analyzing your spending patterns...</Text>
            </View>
          ) : (
            predictions.map((prediction) => (
              <PredictionCard key={prediction.id} prediction={prediction} />
            ))
          )}
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
  loadingContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
});
