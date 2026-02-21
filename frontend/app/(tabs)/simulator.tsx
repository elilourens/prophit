import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../components/theme';
import { usePro } from '../../contexts/ProContext';
import { LockedFeatureModal, ProBadge } from '../../components/LockedFeatureModal';

/**
 * Scenario Simulator Screen - Dynamic What-If Questions
 */

interface WhatIfResponse {
  id: string;
  question: string;
  outcome: string;
  savingsAmount: number;
  savingsPeriod: string;
  isPositive: boolean;
  beforeValue: number;
  afterValue: number;
  beforeLabel: string;
  afterLabel: string;
  confidence: number;
  details: string;
  timestamp: Date;
  isExpanded: boolean;
}

// Suggested what-if chips
const SUGGESTED_QUESTIONS = [
  'Quit my job',
  'Cut eating out by half',
  'Cancel all subscriptions',
  'Move somewhere cheaper',
  'Start saving €200/month',
];

// Mock AI response generator
const generateMockResponse = (question: string): Omit<WhatIfResponse, 'id' | 'timestamp' | 'isExpanded'> => {
  const lowerQuestion = question.toLowerCase();

  if (lowerQuestion.includes('quit') && lowerQuestion.includes('job')) {
    return {
      question,
      outcome: "Based on your current savings of €18,500 and monthly expenses of €2,100, you'd have a runway of 8.8 months before needing income again.",
      savingsAmount: 0,
      savingsPeriod: '',
      isPositive: false,
      beforeValue: 2100,
      afterValue: 0,
      beforeLabel: 'Monthly income',
      afterLabel: 'Monthly income',
      confidence: 87,
      details: "Your emergency fund covers 8.8 months of expenses. Consider reducing discretionary spending to extend this to 11+ months. Your biggest expense categories are rent (€1,200) and food (€380). If you picked up freelance work at even 50% of your current salary, you could sustain indefinitely.",
    };
  }

  if (lowerQuestion.includes('eating out') || lowerQuestion.includes('restaurants') || lowerQuestion.includes('food')) {
    return {
      question,
      outcome: "Cutting restaurant spending by 50% would save you €190/month based on your average dining spend of €380.",
      savingsAmount: 190,
      savingsPeriod: 'month',
      isPositive: true,
      beforeValue: 380,
      afterValue: 190,
      beforeLabel: 'Current dining',
      afterLabel: 'After cutting',
      confidence: 92,
      details: "You eat out an average of 12 times per month, spending €31.67 per meal. Reducing to 6 meals out would save €2,280 annually. This could fund a nice vacation or add 1.1 months to your emergency runway.",
    };
  }

  if (lowerQuestion.includes('subscription') || lowerQuestion.includes('netflix') || lowerQuestion.includes('spotify')) {
    return {
      question,
      outcome: "Canceling all subscriptions would save you €67/month. You currently have 8 active subscriptions.",
      savingsAmount: 67,
      savingsPeriod: 'month',
      isPositive: true,
      beforeValue: 67,
      afterValue: 0,
      beforeLabel: 'Current subs',
      afterLabel: 'After cancel',
      confidence: 98,
      details: "Your subscriptions: Netflix (€13), Spotify (€11), iCloud (€3), Gym (€25), NYT (€4), Adobe (€6), LinkedIn (€3), Headspace (€2). The gym membership is your most expensive but also most used. Consider keeping essentials and cutting unused services for €42/month savings.",
    };
  }

  if (lowerQuestion.includes('move') || lowerQuestion.includes('relocate') || lowerQuestion.includes('cheaper') || lowerQuestion.includes('rent')) {
    return {
      question,
      outcome: "Moving to a cheaper area could save you €350/month if you find a place at €850 vs your current €1,200 rent.",
      savingsAmount: 350,
      savingsPeriod: 'month',
      isPositive: true,
      beforeValue: 1200,
      afterValue: 850,
      beforeLabel: 'Current rent',
      afterLabel: 'New rent',
      confidence: 73,
      details: "Areas like Tallaght, Blanchardstown, or Swords have average rents €300-400 lower than city center. Factor in potential transport cost increases of €80-120/month. Net savings would be €230-270/month. Moving costs estimate: €800-1,200 one-time.",
    };
  }

  if (lowerQuestion.includes('saving') || lowerQuestion.includes('save') || lowerQuestion.includes('€200') || lowerQuestion.includes('200')) {
    return {
      question,
      outcome: "Saving €200/month would grow to €2,520 in one year with 5% interest, adding 1.2 months to your runway.",
      savingsAmount: 2520,
      savingsPeriod: 'year',
      isPositive: true,
      beforeValue: 18500,
      afterValue: 21020,
      beforeLabel: 'Current savings',
      afterLabel: 'After 1 year',
      confidence: 95,
      details: "At €200/month with 5% annual interest compounded monthly, you'd have €2,520 after 1 year, €5,155 after 2 years, and €7,912 after 3 years. This could come from cutting dining (€95), subscriptions (€45), and impulse shopping (€60).",
    };
  }

  if (lowerQuestion.includes('cycling') || lowerQuestion.includes('bike') || lowerQuestion.includes('commute')) {
    return {
      question,
      outcome: "Cycling to work instead of taking the Luas would save you €105/month on transport costs.",
      savingsAmount: 105,
      savingsPeriod: 'month',
      isPositive: true,
      beforeValue: 105,
      afterValue: 0,
      beforeLabel: 'Luas monthly',
      afterLabel: 'Cycling cost',
      confidence: 88,
      details: "Your current Luas monthly pass is €105. A decent commuter bike costs €300-500 one-time, paying for itself in 3-5 months. Additional benefits: 30 mins daily exercise, no delays. Consider: Dublin weather means you might still need transport 20% of the time.",
    };
  }

  if (lowerQuestion.includes('london') || lowerQuestion.includes('abroad') || lowerQuestion.includes('uk')) {
    return {
      question,
      outcome: "Moving to London would likely increase your expenses by €650/month due to higher rent and cost of living.",
      savingsAmount: -650,
      savingsPeriod: 'month',
      isPositive: false,
      beforeValue: 2100,
      afterValue: 2750,
      beforeLabel: 'Dublin expenses',
      afterLabel: 'London estimate',
      confidence: 71,
      details: "London rent averages 35% higher than Dublin for similar areas. Transport costs are higher (£160/month tube pass). Food costs similar but eating out is 15% more expensive. However, salaries are typically 20-30% higher for tech roles. Net impact depends heavily on your job offer.",
    };
  }

  if (lowerQuestion.includes('coffee') || lowerQuestion.includes('latte')) {
    return {
      question,
      outcome: "Making coffee at home instead of buying would save you €78/month based on your 18 coffee shop visits.",
      savingsAmount: 78,
      savingsPeriod: 'month',
      isPositive: true,
      beforeValue: 81,
      afterValue: 3,
      beforeLabel: 'Coffee shops',
      afterLabel: 'Home coffee',
      confidence: 94,
      details: "You spend an average of €4.50 per coffee shop visit, 18 times per month (€81). Good beans and a simple setup costs €30/month max. That's €936/year in savings - enough for a weekend trip or nice dinner out each month.",
    };
  }

  // Generic response for other questions
  return {
    question,
    outcome: "Based on your spending patterns, this change could save you approximately €120/month if implemented consistently.",
    savingsAmount: 120,
    savingsPeriod: 'month',
    isPositive: true,
    beforeValue: 2100,
    afterValue: 1980,
    beforeLabel: 'Current spend',
    afterLabel: 'Projected',
    confidence: 65,
    details: "This is a rough estimate based on similar scenarios. For a more accurate projection, try being more specific about the change you're considering. Include details like specific amounts, frequencies, or alternatives you're considering.",
  };
};

// Thinking Animation Component
const ThinkingAnimation: React.FC = () => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animateDot = (dot: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 300,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    animateDot(dot1, 0);
    animateDot(dot2, 150);
    animateDot(dot3, 300);
  }, []);

  const dotStyle = (anim: Animated.Value) => ({
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -8],
        }),
      },
    ],
  });

  return (
    <View style={styles.thinkingContainer}>
      <View style={styles.thinkingCard}>
        <Text style={styles.thinkingText}>Analyzing your scenario</Text>
        <View style={styles.dotsContainer}>
          <Animated.View style={[styles.dot, dotStyle(dot1)]} />
          <Animated.View style={[styles.dot, dotStyle(dot2)]} />
          <Animated.View style={[styles.dot, dotStyle(dot3)]} />
        </View>
      </View>
    </View>
  );
};

// Confidence Indicator Component
const ConfidenceIndicator: React.FC<{ confidence: number }> = ({ confidence }) => {
  const getColor = () => {
    if (confidence >= 85) return '#2E7D32';
    if (confidence >= 70) return theme.colors.midOrange;
    return theme.colors.hotCoral;
  };

  return (
    <View style={styles.confidenceContainer}>
      <View style={styles.confidenceBar}>
        <View
          style={[
            styles.confidenceFill,
            { width: `${confidence}%`, backgroundColor: getColor() },
          ]}
        />
      </View>
      <Text style={[styles.confidenceText, { color: getColor() }]}>
        {confidence}% confidence
      </Text>
    </View>
  );
};

// Response Card Component
const ResponseCard: React.FC<{
  response: WhatIfResponse;
  onToggleExpand: () => void;
}> = ({ response, onToggleExpand }) => {
  return (
    <TouchableOpacity
      style={styles.responseCard}
      onPress={onToggleExpand}
      activeOpacity={0.9}
    >
      {/* Question */}
      <Text style={styles.responseQuestion}>"{response.question}"</Text>

      {/* Outcome */}
      <View style={styles.outcomeContainer}>
        <View style={[
          styles.outcomeIcon,
          { backgroundColor: response.isPositive ? 'rgba(46, 125, 50, 0.15)' : 'rgba(254, 139, 24, 0.15)' }
        ]}>
          <Ionicons
            name={response.isPositive ? 'trending-up' : 'trending-down'}
            size={20}
            color={response.isPositive ? '#2E7D32' : theme.colors.midOrange}
          />
        </View>
        <Text style={styles.outcomeText}>{response.outcome}</Text>
      </View>

      {/* Before/After Visual */}
      <View style={styles.comparisonContainer}>
        <View style={styles.comparisonItem}>
          <Text style={styles.comparisonLabel}>{response.beforeLabel}</Text>
          <Text style={styles.comparisonValue}>€{response.beforeValue.toLocaleString()}</Text>
        </View>
        <View style={styles.comparisonArrow}>
          <Ionicons name="arrow-forward" size={20} color={theme.colors.gray} />
        </View>
        <View style={styles.comparisonItem}>
          <Text style={styles.comparisonLabel}>{response.afterLabel}</Text>
          <Text style={[
            styles.comparisonValue,
            { color: response.isPositive ? '#2E7D32' : theme.colors.midOrange }
          ]}>
            €{response.afterValue.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Savings Badge */}
      {response.savingsAmount !== 0 && (
        <View style={[
          styles.savingsBadge,
          { backgroundColor: response.isPositive ? 'rgba(46, 125, 50, 0.15)' : 'rgba(254, 139, 24, 0.15)' }
        ]}>
          <Text style={[
            styles.savingsBadgeText,
            { color: response.isPositive ? '#2E7D32' : theme.colors.midOrange }
          ]}>
            {response.isPositive ? '+' : '-'}€{Math.abs(response.savingsAmount).toLocaleString()}/{response.savingsPeriod}
          </Text>
        </View>
      )}

      {/* Confidence */}
      <ConfidenceIndicator confidence={response.confidence} />

      {/* Expanded Details */}
      {response.isExpanded && (
        <View style={styles.expandedDetails}>
          <View style={styles.detailsDivider} />
          <Text style={styles.detailsTitle}>Analysis Details</Text>
          <Text style={styles.detailsText}>{response.details}</Text>
        </View>
      )}

      {/* Expand Hint */}
      <View style={styles.expandHint}>
        <Ionicons
          name={response.isExpanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={theme.colors.gray}
        />
        <Text style={styles.expandHintText}>
          {response.isExpanded ? 'Tap to collapse' : 'Tap for details'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export default function SimulatorScreen() {
  const { isPro } = usePro();
  const [showLockedModal, setShowLockedModal] = useState(false);
  const [question, setQuestion] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [responses, setResponses] = useState<WhatIfResponse[]>([]);
  const [freeQuestionsUsed, setFreeQuestionsUsed] = useState(0);

  const FREE_QUESTION_LIMIT = 1;

  const handleSubmit = async () => {
    if (!question.trim()) return;

    // Check Pro limit
    if (!isPro && freeQuestionsUsed >= FREE_QUESTION_LIMIT) {
      setShowLockedModal(true);
      return;
    }

    setIsThinking(true);

    // Simulate AI thinking time
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));

    const mockResponse = generateMockResponse(question);
    const newResponse: WhatIfResponse = {
      ...mockResponse,
      id: Date.now().toString(),
      timestamp: new Date(),
      isExpanded: false,
    };

    setResponses(prev => [newResponse, ...prev]);
    setQuestion('');
    setIsThinking(false);

    if (!isPro) {
      setFreeQuestionsUsed(prev => prev + 1);
    }
  };

  const handleChipPress = (chip: string) => {
    if (!isPro && freeQuestionsUsed >= FREE_QUESTION_LIMIT) {
      setShowLockedModal(true);
      return;
    }
    setQuestion(`What if I ${chip.toLowerCase()}?`);
  };

  const toggleExpand = (id: string) => {
    setResponses(prev =>
      prev.map(r => (r.id === id ? { ...r, isExpanded: !r.isExpanded } : r))
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LockedFeatureModal
        visible={showLockedModal}
        onClose={() => setShowLockedModal(false)}
        featureName="Unlimited What-Ifs"
        featureDescription="Ask unlimited what-if questions and get AI-powered financial projections."
      />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>What If...</Text>
              {!isPro && <ProBadge style={styles.proBadge} />}
            </View>
            <Text style={styles.subtitle}>Explore financial scenarios with AI</Text>
          </View>

          {/* Input Section */}
          <View style={styles.inputSection}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Ask a what-if question..."
                placeholderTextColor={theme.colors.gray}
                value={question}
                onChangeText={setQuestion}
                multiline
                maxLength={200}
                editable={!isThinking}
              />
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (!question.trim() || isThinking) && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={!question.trim() || isThinking}
              >
                <Ionicons name="arrow-up" size={20} color={theme.colors.white} />
              </TouchableOpacity>
            </View>

            {/* Free tier indicator */}
            {!isPro && (
              <Text style={styles.freeIndicator}>
                {freeQuestionsUsed}/{FREE_QUESTION_LIMIT} free question used
              </Text>
            )}
          </View>

          {/* Suggested Chips */}
          <View style={styles.chipsContainer}>
            <Text style={styles.chipsLabel}>Try asking:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsScroll}
            >
              {SUGGESTED_QUESTIONS.map((chip, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.chip}
                  onPress={() => handleChipPress(chip)}
                  disabled={isThinking}
                >
                  <Text style={styles.chipText}>{chip}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Thinking Animation */}
          {isThinking && <ThinkingAnimation />}

          {/* Responses */}
          {responses.length > 0 && (
            <View style={styles.responsesSection}>
              <Text style={styles.sectionTitle}>Your Scenarios</Text>
              {responses.map(response => (
                <ResponseCard
                  key={response.id}
                  response={response}
                  onToggleExpand={() => toggleExpand(response.id)}
                />
              ))}
            </View>
          )}

          {/* Empty State */}
          {responses.length === 0 && !isThinking && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="bulb-outline" size={40} color={theme.colors.hotCoral} />
              </View>
              <Text style={styles.emptyTitle}>Explore Your Future</Text>
              <Text style={styles.emptyText}>
                Ask any financial what-if question and get AI-powered insights on how it would impact your finances.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardView: {
    flex: 1,
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.xs,
  },
  proBadge: {
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  // Input Section
  inputSection: {
    marginBottom: theme.spacing.md,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.sm,
    ...theme.cardShadow,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.deepNavy,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    maxHeight: 100,
    minHeight: 44,
  },
  submitButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.hotCoral,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: theme.colors.gray,
  },
  freeIndicator: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
  // Chips
  chipsContainer: {
    marginBottom: theme.spacing.lg,
  },
  chipsLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  chipsScroll: {
    gap: theme.spacing.sm,
  },
  chip: {
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.lightGray,
    marginRight: theme.spacing.sm,
  },
  chipText: {
    fontSize: 14,
    color: theme.colors.deepNavy,
  },
  // Thinking Animation
  thinkingContainer: {
    marginBottom: theme.spacing.lg,
  },
  thinkingCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    ...theme.cardShadow,
  },
  thinkingText: {
    fontSize: 16,
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.md,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.hotCoral,
  },
  // Responses
  responsesSection: {
    marginTop: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.md,
  },
  responseCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.cardShadow,
  },
  responseQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.deepNavy,
    fontStyle: 'italic',
    marginBottom: theme.spacing.md,
  },
  outcomeContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  outcomeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  outcomeText: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.deepNavy,
    lineHeight: 22,
  },
  // Comparison
  comparisonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.softWhite,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  comparisonItem: {
    flex: 1,
    alignItems: 'center',
  },
  comparisonLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  comparisonValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.deepNavy,
  },
  comparisonArrow: {
    paddingHorizontal: theme.spacing.md,
  },
  // Savings Badge
  savingsBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  savingsBadgeText: {
    fontSize: 16,
    fontWeight: '700',
  },
  // Confidence
  confidenceContainer: {
    marginBottom: theme.spacing.sm,
  },
  confidenceBar: {
    height: 6,
    backgroundColor: theme.colors.lightGray,
    borderRadius: 3,
    marginBottom: theme.spacing.xs,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 3,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '500',
  },
  // Expanded Details
  expandedDetails: {
    marginTop: theme.spacing.sm,
  },
  detailsDivider: {
    height: 1,
    backgroundColor: theme.colors.lightGray,
    marginBottom: theme.spacing.md,
  },
  detailsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.sm,
  },
  detailsText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  // Expand Hint
  expandHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
  },
  expandHintText: {
    fontSize: 12,
    color: theme.colors.gray,
    marginLeft: theme.spacing.xs,
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 79, 64, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: theme.spacing.lg,
  },
});
