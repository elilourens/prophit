import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../components/theme';
import { useUserData } from '../contexts/UserDataContext';
import { getCalendarPredictions, getDemoTransactionData, CalendarPrediction } from '../services/backendApi';

// Category icons
const categoryIcons: { [key: string]: string } = {
  Coffee: 'cafe-outline',
  Dining: 'restaurant-outline',
  Groceries: 'cart-outline',
  Transport: 'car-outline',
  Shopping: 'bag-outline',
  Entertainment: 'film-outline',
  Subscriptions: 'card-outline',
  Other: 'ellipsis-horizontal-outline',
};

// Category colors
const categoryColors: { [key: string]: string } = {
  Coffee: '#8B4513',
  Dining: '#FF6B6B',
  Groceries: '#4CAF50',
  Transport: '#2196F3',
  Shopping: '#9C27B0',
  Entertainment: '#FF9800',
  Subscriptions: '#607D8B',
  Other: '#9E9E9E',
};

interface DayCardProps {
  day: CalendarPrediction;
  isToday: boolean;
}

function DayCard({ day, isToday }: DayCardProps) {
  const [expanded, setExpanded] = useState(isToday);

  return (
    <TouchableOpacity
      style={[styles.dayCard, isToday && styles.todayCard]}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.8}
    >
      <View style={styles.dayHeader}>
        <View style={styles.dayInfo}>
          <Text style={[styles.dayName, isToday && styles.todayText]}>
            {isToday ? 'Today' : day.day}
          </Text>
          <Text style={styles.dayDate}>{formatDate(day.date)}</Text>
        </View>
        <View style={styles.dayTotal}>
          <Text style={styles.totalLabel}>Expected</Text>
          <Text style={[styles.totalAmount, isToday && styles.todayAmount]}>
            €{day.totalExpected.toFixed(0)}
          </Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={theme.colors.textSecondary}
        />
      </View>

      {expanded && day.predictions.length > 0 && (
        <View style={styles.predictionsContainer}>
          {day.predictions.map((pred, index) => (
            <View key={index} style={styles.predictionRow}>
              <View style={[styles.predictionIcon, { backgroundColor: categoryColors[pred.category] || categoryColors.Other }]}>
                <Ionicons
                  name={(categoryIcons[pred.category] || categoryIcons.Other) as any}
                  size={16}
                  color="#FFF"
                />
              </View>
              <View style={styles.predictionInfo}>
                <Text style={styles.predictionTitle}>{pred.description}</Text>
                <Text style={styles.predictionCategory}>{pred.category}</Text>
              </View>
              <View style={styles.predictionStats}>
                <Text style={styles.predictionAmount}>€{pred.amount.toFixed(0)}</Text>
                <View style={styles.probabilityContainer}>
                  <View
                    style={[
                      styles.probabilityBar,
                      { width: `${Math.min(pred.probability * 100, 100)}%` },
                      pred.probability > 0.7 && styles.highProbability,
                      pred.probability <= 0.3 && styles.lowProbability,
                    ]}
                  />
                </View>
                <Text style={styles.probabilityText}>{Math.round(pred.probability * 100)}%</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {expanded && day.predictions.length === 0 && (
        <View style={styles.noPredictions}>
          <Text style={styles.noPredictionsText}>No predictions for this day</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IE', { month: 'short', day: 'numeric' });
}

export default function BriefingScreen() {
  const router = useRouter();
  const { isDataLoaded } = useUserData();
  const [predictions, setPredictions] = useState<CalendarPrediction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [weekTotal, setWeekTotal] = useState(0);

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
        setPredictions(result.predictions);
        const total = result.predictions.reduce((sum, day) => sum + day.totalExpected, 0);
        setWeekTotal(total);
      }
    } catch (error) {
      console.error('Failed to fetch predictions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.deepNavy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Week Ahead</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Week Summary */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryContent}>
          <Text style={styles.summaryLabel}>Projected Week Spending</Text>
          <Text style={styles.summaryAmount}>€{weekTotal.toFixed(0)}</Text>
          <Text style={styles.summarySubtext}>Based on your spending patterns</Text>
        </View>
        <View style={styles.summaryIcon}>
          <Ionicons name="calendar-outline" size={40} color={theme.colors.hotCoral} />
        </View>
      </View>

      {/* Days List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.hotCoral} />
            <Text style={styles.loadingText}>Generating predictions...</Text>
          </View>
        ) : predictions.length > 0 ? (
          predictions.map((day, index) => (
            <DayCard key={day.date} day={day} isToday={index === 0} />
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={48} color={theme.colors.textSecondary} />
            <Text style={styles.emptyText}>No predictions available</Text>
            <Text style={styles.emptySubtext}>Upload your bank statement to get personalized predictions</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.lightGray,
    backgroundColor: theme.colors.white,
  },
  backButton: {
    padding: theme.spacing.xs,
  },
  headerTitle: {
    ...theme.typography.subheader,
    color: theme.colors.deepNavy,
  },
  placeholder: {
    width: 32,
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
    margin: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryContent: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  summaryAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: theme.colors.deepNavy,
  },
  summarySubtext: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  summaryIcon: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
  dayCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  todayCard: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.hotCoral,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayInfo: {
    flex: 1,
  },
  dayName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.deepNavy,
  },
  todayText: {
    color: theme.colors.hotCoral,
  },
  dayDate: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  dayTotal: {
    alignItems: 'flex-end',
    marginRight: theme.spacing.sm,
  },
  totalLabel: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.deepNavy,
  },
  todayAmount: {
    color: theme.colors.hotCoral,
  },
  predictionsContainer: {
    marginTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.lightGray,
    paddingTop: theme.spacing.md,
  },
  predictionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  predictionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  predictionInfo: {
    flex: 1,
    marginLeft: theme.spacing.sm,
  },
  predictionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.deepNavy,
  },
  predictionCategory: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  predictionStats: {
    alignItems: 'flex-end',
  },
  predictionAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.deepNavy,
  },
  probabilityContainer: {
    width: 50,
    height: 4,
    backgroundColor: theme.colors.lightGray,
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  probabilityBar: {
    height: '100%',
    backgroundColor: theme.colors.hotCoral,
    borderRadius: 2,
  },
  highProbability: {
    backgroundColor: '#4CAF50',
  },
  lowProbability: {
    backgroundColor: '#FFC107',
  },
  probabilityText: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  noPredictions: {
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  noPredictionsText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  loadingContainer: {
    padding: theme.spacing.xxl,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  emptyContainer: {
    padding: theme.spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.deepNavy,
    marginTop: theme.spacing.md,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
});
