import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { theme } from '../../components/theme';

/**
 * Scenario Simulator Screen
 *
 * Interactive "What If..." scenarios with sliders:
 * 1. Quit job - Calculate runway based on savings and expenses
 * 2. Cut eating out - Calculate monthly and yearly savings
 * 3. Move to cheaper area - Calculate rent difference impact
 */

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
}

const ScenarioCard: React.FC<ScenarioCardProps> = ({
  title,
  subtitle,
  children,
  results,
}) => {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        {subtitle && <Text style={styles.cardSubtitle}>{subtitle}</Text>}
      </View>
      <View style={styles.cardContent}>{children}</View>
      <View style={styles.resultsContainer}>
        {results.map((result, index) => (
          <View key={index} style={styles.resultRow}>
            <Text style={styles.resultLabel}>{result.label}</Text>
            <View
              style={[
                styles.resultValueContainer,
                result.isPositive !== undefined && {
                  backgroundColor: result.isPositive
                    ? 'rgba(195, 255, 52, 0.15)'
                    : 'rgba(254, 139, 24, 0.15)',
                },
              ]}
            >
              <Text
                style={[
                  styles.resultValue,
                  result.isPositive !== undefined && {
                    color: result.isPositive
                      ? '#2E7D32'
                      : theme.colors.midOrange,
                  },
                ]}
              >
                {result.value}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

interface SliderRowProps {
  label: string;
  value: number;
  minimumValue: number;
  maximumValue: number;
  step?: number;
  onValueChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
}

const SliderRow: React.FC<SliderRowProps> = ({
  label,
  value,
  minimumValue,
  maximumValue,
  step = 1,
  onValueChange,
  prefix = '',
  suffix = '',
}) => {
  return (
    <View style={styles.sliderContainer}>
      <View style={styles.sliderHeader}>
        <Text style={styles.sliderLabel}>{label}</Text>
        <Text style={styles.sliderValue}>
          {prefix}{value.toLocaleString()}{suffix}
        </Text>
      </View>
      <View style={styles.sliderRow}>
        <Text style={styles.rangeLabel}>
          {prefix}{minimumValue.toLocaleString()}
        </Text>
        <Slider
          style={styles.slider}
          value={value}
          minimumValue={minimumValue}
          maximumValue={maximumValue}
          step={step}
          onValueChange={onValueChange}
          minimumTrackTintColor={theme.colors.hotCoral}
          maximumTrackTintColor={theme.colors.lightGray}
          thumbTintColor={theme.colors.hotCoral}
        />
        <Text style={styles.rangeLabel}>
          {prefix}{maximumValue.toLocaleString()}
        </Text>
      </View>
    </View>
  );
};

export default function SimulatorScreen() {
  // Scenario 1: Quit Job
  const [savings, setSavings] = useState(15000);
  const [monthlyExpenses, setMonthlyExpenses] = useState(2500);

  // Scenario 2: Cut Eating Out
  const currentEatingOut = 320;
  const [eatingOutReduction, setEatingOutReduction] = useState(50);

  // Scenario 3: Move to Cheaper Area
  const currentRent = 1800;
  const [newRent, setNewRent] = useState(1400);

  // Calculate results
  const runwayMonths = monthlyExpenses > 0 ? savings / monthlyExpenses : 0;
  const monthlySavingsEatingOut = (currentEatingOut * eatingOutReduction) / 100;
  const yearlySavingsEatingOut = monthlySavingsEatingOut * 12;
  const monthlyRentDifference = currentRent - newRent;
  const yearlyRentImpact = monthlyRentDifference * 12;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>What If...</Text>
          <Text style={styles.subtitle}>Explore financial scenarios</Text>
        </View>

        {/* Scenario 1: Quit Job */}
        <ScenarioCard
          title="What if I quit my job?"
          subtitle="Calculate your financial runway"
          results={[
            {
              label: 'Runway',
              value: `${runwayMonths.toFixed(1)} months`,
              isPositive: runwayMonths >= 6,
            },
          ]}
        >
          <SliderRow
            label="Current Savings"
            value={savings}
            minimumValue={5000}
            maximumValue={50000}
            step={500}
            onValueChange={setSavings}
            prefix="\u20AC"
          />
          <SliderRow
            label="Monthly Expenses"
            value={monthlyExpenses}
            minimumValue={1500}
            maximumValue={4000}
            step={100}
            onValueChange={setMonthlyExpenses}
            prefix="\u20AC"
          />
        </ScenarioCard>

        {/* Scenario 2: Cut Eating Out */}
        <ScenarioCard
          title="Cut eating out by 50%"
          subtitle={`Current eating out: \u20AC${currentEatingOut}/month`}
          results={[
            {
              label: 'Monthly Savings',
              value: `+\u20AC${monthlySavingsEatingOut.toFixed(0)}`,
              isPositive: true,
            },
            {
              label: 'Yearly Savings',
              value: `+\u20AC${yearlySavingsEatingOut.toFixed(0)}`,
              isPositive: true,
            },
          ]}
        >
          <SliderRow
            label="Reduction"
            value={eatingOutReduction}
            minimumValue={0}
            maximumValue={100}
            step={5}
            onValueChange={setEatingOutReduction}
            suffix="%"
          />
        </ScenarioCard>

        {/* Scenario 3: Move to Cheaper Area */}
        <ScenarioCard
          title="Move to cheaper area"
          subtitle={`Current rent: \u20AC${currentRent}/month`}
          results={[
            {
              label: 'Monthly Difference',
              value: monthlyRentDifference >= 0
                ? `+\u20AC${monthlyRentDifference.toLocaleString()}`
                : `-\u20AC${Math.abs(monthlyRentDifference).toLocaleString()}`,
              isPositive: monthlyRentDifference >= 0,
            },
            {
              label: 'Yearly Impact',
              value: yearlyRentImpact >= 0
                ? `+\u20AC${yearlyRentImpact.toLocaleString()}`
                : `-\u20AC${Math.abs(yearlyRentImpact).toLocaleString()}`,
              isPositive: yearlyRentImpact >= 0,
            },
          ]}
        >
          <SliderRow
            label="New Rent"
            value={newRent}
            minimumValue={800}
            maximumValue={2500}
            step={50}
            onValueChange={setNewRent}
            prefix="\u20AC"
          />
        </ScenarioCard>
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
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  header: {
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.cardShadow,
  },
  cardHeader: {
    marginBottom: theme.spacing.md,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.xs,
  },
  cardSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  cardContent: {
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
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  resultValueContainer: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  resultValue: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.deepNavy,
  },
  sliderContainer: {
    marginVertical: theme.spacing.sm,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  sliderLabel: {
    fontSize: 16,
    color: theme.colors.deepNavy,
  },
  sliderValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.hotCoral,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slider: {
    flex: 1,
    height: 40,
    marginHorizontal: theme.spacing.xs,
  },
  rangeLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    minWidth: 50,
    textAlign: 'center',
  },
});
