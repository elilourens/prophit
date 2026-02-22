import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../components/theme';
import { usePro } from '../contexts/ProContext';
import { showAlert } from '../utils/crossPlatform';

interface FeatureRowProps {
  text: string;
  included: boolean;
  isPro?: boolean;
}

const FeatureRow: React.FC<FeatureRowProps> = ({ text, included, isPro = false }) => (
  <View style={styles.featureRow}>
    <View style={[styles.featureIcon, included && (isPro ? styles.featureIconPro : styles.featureIconFree)]}>
      {included ? (
        <Ionicons name="checkmark" size={14} color={isPro ? theme.colors.white : theme.colors.deepTeal} />
      ) : (
        <Ionicons name="close" size={14} color={theme.colors.gray} />
      )}
    </View>
    <Text style={[styles.featureText, !included && styles.featureTextDisabled]}>{text}</Text>
  </View>
);

interface TierCardProps {
  title: string;
  price: string;
  period: string;
  features: { text: string; included: boolean }[];
  isPro?: boolean;
  isPopular?: boolean;
  onSelect: () => void;
  isSelected?: boolean;
  isLoading?: boolean;
}

const TierCard: React.FC<TierCardProps> = ({
  title,
  price,
  period,
  features,
  isPro = false,
  isPopular = false,
  onSelect,
  isSelected = false,
  isLoading = false,
}) => (
  <View style={[
    styles.tierCard,
    isPro && styles.tierCardPro,
    isSelected && styles.tierCardSelected,
  ]}>
    {isPopular && (
      <View style={styles.popularBadge}>
        <Text style={styles.popularBadgeText}>Most Popular</Text>
      </View>
    )}

    <Text style={[styles.tierTitle, isPro && styles.tierTitlePro]}>{title}</Text>

    <View style={styles.priceContainer}>
      <Text style={[styles.priceText, isPro && styles.priceTextPro]}>{price}</Text>
      <Text style={[styles.periodText, isPro && styles.periodTextPro]}>{period}</Text>
    </View>

    <View style={styles.featuresContainer}>
      {features.map((feature, index) => (
        <FeatureRow key={index} text={feature.text} included={feature.included} isPro={isPro} />
      ))}
    </View>

    <TouchableOpacity
      style={[styles.selectButton, isPro && styles.selectButtonPro]}
      onPress={onSelect}
      disabled={isLoading}
    >
      {isLoading ? (
        <ActivityIndicator color={isPro ? theme.colors.white : theme.colors.hotCoral} />
      ) : (
        <Text style={[styles.selectButtonText, isPro && styles.selectButtonTextPro]}>
          {isPro ? 'Upgrade Now' : 'Current Plan'}
        </Text>
      )}
    </TouchableOpacity>
  </View>
);

// Format card number with spaces
const formatCardNumber = (value: string) => {
  const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
  const matches = v.match(/\d{4,16}/g);
  const match = (matches && matches[0]) || '';
  const parts = [];
  for (let i = 0, len = match.length; i < len; i += 4) {
    parts.push(match.substring(i, i + 4));
  }
  return parts.length ? parts.join(' ') : v;
};

// Format expiry date
const formatExpiry = (value: string) => {
  const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
  if (v.length >= 2) {
    return v.substring(0, 2) + '/' + v.substring(2, 4);
  }
  return v;
};

export default function UpgradeScreen() {
  const { isPro, upgradeToPro } = usePro();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Card form state
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');

  const handleClose = () => {
    router.back();
  };

  const handleUpgrade = () => {
    setShowPaymentModal(true);
  };

  const isCardValid = () => {
    const cleanNumber = cardNumber.replace(/\s/g, '');
    return cleanNumber.length === 16 && expiry.length === 5 && cvc.length >= 3;
  };

  const handlePayment = async () => {
    if (!isCardValid()) {
      showAlert('Incomplete', 'Please fill in all card details');
      return;
    }

    setIsProcessing(true);

    try {
      // Simulate Stripe API call
      console.log('Processing payment with Stripe...');
      console.log('Card:', cardNumber.replace(/\d(?=\d{4})/g, '*'));

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Success!
      setShowPaymentModal(false);
      upgradeToPro();
      setShowSuccessModal(true);
    } catch (error) {
      showAlert('Payment Failed', 'There was an issue processing your payment. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    handleClose();
  };

  const freeFeatures = [
    { text: 'Daily spending predictions', included: true },
    { text: 'Basic spending history', included: true },
    { text: 'Weekly recap summary', included: false },
    { text: 'Scenario simulator', included: false },
    { text: 'Voice briefings', included: false },
    { text: 'AI chat assistant', included: false },
  ];

  const proFeatures = [
    { text: 'Daily spending predictions', included: true },
    { text: 'Full spending history', included: true },
    { text: 'Weekly recap summary', included: true },
    { text: 'Scenario simulator', included: true },
    { text: 'Voice briefings', included: true },
    { text: 'AI chat assistant', included: true },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Choose Your Plan</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>Unlock Your Financial Future</Text>
          <Text style={styles.heroSubtitle}>
            Get personalized predictions, scenarios, and AI-powered insights
          </Text>
        </View>

        {/* Tier Cards */}
        <View style={styles.tiersContainer}>
          <TierCard
            title="Pro"
            price={'\u20AC1.99'}
            period="/month"
            features={proFeatures}
            isPro
            isPopular
            onSelect={handleUpgrade}
            isSelected={isPro}
          />

          <TierCard
            title="Free"
            price="Free"
            period="forever"
            features={freeFeatures}
            onSelect={() => {}}
            isSelected={!isPro}
          />
        </View>

        {/* Guarantee Section */}
        <View style={styles.guaranteeSection}>
          <Ionicons name="shield-checkmark" size={24} color={theme.colors.deepTeal} />
          <Text style={styles.guaranteeText}>
            Cancel anytime. 7-day free trial for new subscribers.
          </Text>
        </View>
      </ScrollView>

      {/* Payment Modal */}
      <Modal
        visible={showPaymentModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.paymentModal}>
            {/* Modal Handle */}
            <View style={styles.modalHandle} />

            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Complete Payment</Text>
              <TouchableOpacity
                onPress={() => setShowPaymentModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Price Summary */}
            <View style={styles.priceSummary}>
              <View>
                <Text style={styles.priceSummaryLabel}>Prophit Pro Monthly</Text>
                <Text style={styles.priceSummaryDesc}>Billed monthly, cancel anytime</Text>
              </View>
              <Text style={styles.priceSummaryAmount}>{'\u20AC'}1.99</Text>
            </View>

            {/* Card Form */}
            <View style={styles.cardForm}>
              <Text style={styles.cardFormLabel}>Card information</Text>

              {/* Card Number */}
              <View style={styles.cardNumberContainer}>
                <Ionicons name="card-outline" size={20} color={theme.colors.gray} style={styles.cardIcon} />
                <TextInput
                  style={styles.cardNumberInput}
                  placeholder="4242 4242 4242 4242"
                  placeholderTextColor={theme.colors.gray}
                  value={cardNumber}
                  onChangeText={(text) => setCardNumber(formatCardNumber(text))}
                  keyboardType="number-pad"
                  maxLength={19}
                />
              </View>

              {/* Expiry and CVC */}
              <View style={styles.cardRow}>
                <View style={styles.expiryContainer}>
                  <TextInput
                    style={styles.expiryInput}
                    placeholder="MM/YY"
                    placeholderTextColor={theme.colors.gray}
                    value={expiry}
                    onChangeText={(text) => setExpiry(formatExpiry(text))}
                    keyboardType="number-pad"
                    maxLength={5}
                  />
                </View>
                <View style={styles.cvcContainer}>
                  <TextInput
                    style={styles.cvcInput}
                    placeholder="CVC"
                    placeholderTextColor={theme.colors.gray}
                    value={cvc}
                    onChangeText={setCvc}
                    keyboardType="number-pad"
                    maxLength={4}
                    secureTextEntry
                  />
                  <Ionicons name="help-circle-outline" size={18} color={theme.colors.gray} />
                </View>
              </View>
            </View>

            {/* Test Card Info */}
            <View style={styles.testCardInfo}>
              <Ionicons name="information-circle-outline" size={16} color={theme.colors.deepTeal} />
              <Text style={styles.testCardText}>
                Test card: 4242 4242 4242 4242, any future date, any CVC
              </Text>
            </View>

            {/* Pay Button */}
            <TouchableOpacity
              style={[
                styles.payButton,
                !isCardValid() && styles.payButtonDisabled,
              ]}
              onPress={handlePayment}
              disabled={!isCardValid() || isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color={theme.colors.white} />
              ) : (
                <>
                  <Ionicons name="lock-closed" size={18} color={theme.colors.white} />
                  <Text style={styles.payButtonText}>Pay {'\u20AC'}1.99</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Powered by Stripe */}
            <View style={styles.stripeFooter}>
              <Text style={styles.stripeFooterText}>Powered by</Text>
              <Text style={styles.stripeLogo}>stripe</Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Success Modal - works on both web and native */}
      <Modal
        visible={showSuccessModal}
        animationType="fade"
        transparent
        onRequestClose={handleSuccessClose}
      >
        <View style={styles.successModalOverlay}>
          <View style={styles.successModal}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark-circle" size={64} color={theme.colors.deepTeal} />
            </View>
            <Text style={styles.successTitle}>Welcome to Pro!</Text>
            <Text style={styles.successMessage}>
              Payment successful! Your subscription is now active.
            </Text>
            <TouchableOpacity
              style={styles.successButton}
              onPress={handleSuccessClose}
            >
              <Text style={styles.successButtonText}>Get Started</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.probabilityBarBackground,
    backgroundColor: theme.colors.white,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.softWhite,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...theme.typography.subheader,
    color: theme.colors.deepNavy,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.deepNavy,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  heroSubtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  tiersContainer: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  tierCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    ...theme.cardShadow,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tierCardPro: {
    backgroundColor: theme.colors.hotCoral,
    borderColor: theme.colors.hotCoral,
  },
  tierCardSelected: {
    borderColor: theme.colors.deepTeal,
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    right: theme.spacing.md,
    backgroundColor: theme.colors.neonYellow,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  popularBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.deepNavy,
  },
  tierTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.sm,
  },
  tierTitlePro: {
    color: theme.colors.white,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: theme.spacing.lg,
  },
  priceText: {
    fontSize: 36,
    fontWeight: '700',
    color: theme.colors.deepNavy,
  },
  priceTextPro: {
    color: theme.colors.white,
  },
  periodText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.xs,
  },
  periodTextPro: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  featuresContainer: {
    marginBottom: theme.spacing.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  featureIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  featureIconFree: {
    backgroundColor: 'rgba(0, 78, 96, 0.15)',
  },
  featureIconPro: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  featureText: {
    fontSize: 14,
    color: theme.colors.deepNavy,
    flex: 1,
  },
  featureTextDisabled: {
    color: theme.colors.gray,
  },
  selectButton: {
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.hotCoral,
    backgroundColor: 'transparent',
  },
  selectButtonPro: {
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.white,
  },
  selectButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.hotCoral,
  },
  selectButtonTextPro: {
    color: theme.colors.hotCoral,
  },
  guaranteeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 78, 96, 0.08)',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
  },
  guaranteeText: {
    fontSize: 14,
    color: theme.colors.deepTeal,
    marginLeft: theme.spacing.sm,
    flex: 1,
  },
  // Payment Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  paymentModal: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.lightGray,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: theme.spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.deepNavy,
  },
  modalCloseButton: {
    padding: theme.spacing.xs,
  },
  priceSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.softWhite,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
  },
  priceSummaryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.deepNavy,
  },
  priceSummaryDesc: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  priceSummaryAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.hotCoral,
  },
  // Card Form
  cardForm: {
    marginBottom: theme.spacing.md,
  },
  cardFormLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.sm,
  },
  cardNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.lightGray,
    borderTopLeftRadius: theme.borderRadius.md,
    borderTopRightRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
  },
  cardIcon: {
    marginRight: theme.spacing.sm,
  },
  cardNumberInput: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: theme.colors.deepNavy,
  },
  cardRow: {
    flexDirection: 'row',
  },
  expiryContainer: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.lightGray,
    borderTopWidth: 0,
    borderBottomLeftRadius: theme.borderRadius.md,
    borderRightWidth: 0,
  },
  expiryInput: {
    height: 50,
    fontSize: 16,
    color: theme.colors.deepNavy,
    paddingHorizontal: theme.spacing.md,
  },
  cvcContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.lightGray,
    borderTopWidth: 0,
    borderBottomRightRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
  },
  cvcInput: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: theme.colors.deepNavy,
  },
  testCardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 78, 96, 0.08)',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.lg,
  },
  testCardText: {
    fontSize: 12,
    color: theme.colors.deepTeal,
    marginLeft: theme.spacing.xs,
    flex: 1,
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.hotCoral,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  payButtonDisabled: {
    backgroundColor: theme.colors.gray,
  },
  payButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.white,
  },
  stripeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  stripeFooterText: {
    fontSize: 12,
    color: theme.colors.gray,
  },
  stripeLogo: {
    fontSize: 18,
    fontWeight: '700',
    color: '#635BFF',
    fontStyle: 'italic',
  },
  // Success Modal
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  successModal: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  successIconContainer: {
    marginBottom: theme.spacing.md,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.sm,
  },
  successMessage: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
    lineHeight: 22,
  },
  successButton: {
    backgroundColor: theme.colors.hotCoral,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.md,
    width: '100%',
    alignItems: 'center',
  },
  successButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.white,
  },
});
