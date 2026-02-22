import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Text, SafeAreaView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WeatherHeader } from '../../components/WeatherHeader';
import { MorningBriefing } from '../../components/MorningBriefing';
import { PredictionCard, Prediction } from '../../components/PredictionCard';
import { TalkToProphit } from '../../components/TalkToProphit';
import { UpgradeBanner } from '../../components/UpgradeBanner';
import { theme } from '../../components/theme';
import { useArena } from '../../contexts/ArenaContext';
import { useUserData } from '../../contexts/UserDataContext';
import { getWeekAheadPredictions, CalendarPrediction, JudgeOutput } from '../../services/backendApi';

// Weather data for Dublin (could be fetched from a weather API)
const DUBLIN_WEATHER = {
  location: 'Dublin, IE',
  temperature: 12,
  weatherIcon: 'partlyCloudy' as const,
};

// Map behavior/category to prediction types
function mapBehaviorToType(behavior: string): 'food' | 'coffee' | 'drinks' | 'transport' | 'shopping' | 'other' {
  const lower = behavior.toLowerCase();
  if (lower.includes('coffee') || lower.includes('cafe')) {
    return 'coffee';
  }
  if (lower.includes('lunch') || lower.includes('dinner') || lower.includes('food') || lower.includes('dining') || lower.includes('casual')) {
    return 'food';
  }
  if (lower.includes('drink') || lower.includes('bar') || lower.includes('pub') || lower.includes('going out') || lower.includes('evening')) {
    return 'drinks';
  }
  if (lower.includes('uber') || lower.includes('taxi') || lower.includes('transport') || lower.includes('ride') || lower.includes('hailing')) {
    return 'transport';
  }
  if (lower.includes('shop') || lower.includes('amazon') || lower.includes('store')) {
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
  if (!today?.predictions || today.predictions.length === 0) {
    return getDefaultPredictions();
  }

  return today.predictions.slice(0, 4).map((pred, index) => ({
    id: String(index + 1),
    type: mapBehaviorToType(pred.description || pred.category),
    title: pred.description || pred.category,
    probability: pred.probability > 1 ? pred.probability : Math.round(pred.probability * 100), // Handle both 0-1 and 0-100 formats
    estimatedMin: Math.floor(pred.amount * 0.9),
    estimatedMax: Math.ceil(pred.amount * 1.1),
    agreedBy: pred.agreedBy,
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
  const { isDataLoaded, userDataset } = useUserData();
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
      // Use user's actual transaction data
      if (!userDataset?.transactions || userDataset.transactions.length === 0) {
        console.log('No transactions available');
        setPredictions([]);
        setTopPrediction(null);
        setIsLoading(false);
        return;
      }

      console.log('Fetching week-ahead predictions from backend with', userDataset.transactions.length, 'transactions...');
      const result = await getWeekAheadPredictions(userDataset.transactions);

      if (result.predictions && result.predictions.length > 0) {
        console.log('Got', result.predictions.length, 'days of predictions from judge');
        const converted = convertToPredictions(result.predictions);
        setPredictions(converted);

        // Set top prediction (highest probability)
        if (converted.length > 0) {
          const topPred = [...converted].sort((a, b) => b.probability - a.probability)[0];
          setTopPrediction({
            title: topPred.title,
            probability: topPred.probability,
          });
        }
      } else {
        console.log('No predictions from backend');
        setPredictions([]);
        setTopPrediction(null);
      }
    } catch (error) {
      console.error('Failed to fetch predictions:', error);
      setPredictions([]);
      setTopPrediction(null);
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
          ) : predictions.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <View style={styles.emptyStateIcon}>
                <Ionicons name="wallet-outline" size={48} color={theme.colors.deepTeal} />
              </View>
              <Text style={styles.emptyStateTitle}>No Transaction Data</Text>
              <Text style={styles.emptyStateText}>
                Upload your bank statement or add transactions to see personalized spending predictions.
              </Text>
              <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={() => router.push('/add-transaction')}
              >
                <Ionicons name="add-circle-outline" size={20} color={theme.colors.white} />
                <Text style={styles.emptyStateButtonText}>Add Transactions</Text>
              </TouchableOpacity>
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
  emptyStateContainer: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    ...theme.cardShadow,
  },
  emptyStateIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.deepTeal + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.sm,
  },
  emptyStateText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
    lineHeight: 20,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.hotCoral,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
  },
  emptyStateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.white,
  },
});
