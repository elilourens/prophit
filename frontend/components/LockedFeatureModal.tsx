import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { theme } from './theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface LockedFeatureModalProps {
  visible: boolean;
  onClose: () => void;
  featureName: string;
  featureDescription?: string;
}

export const LockedFeatureModal: React.FC<LockedFeatureModalProps> = ({
  visible,
  onClose,
  featureName,
  featureDescription = 'This feature is available with Prophit Pro subscription.',
}) => {
  const handleUpgrade = () => {
    onClose();
    router.push('/upgrade' as any);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.bottomSheet}>
              {/* Handle */}
              <View style={styles.handle} />

              {/* Lock Icon */}
              <View style={styles.lockIconContainer}>
                <Ionicons name="lock-closed" size={32} color={theme.colors.white} />
              </View>

              {/* Content */}
              <Text style={styles.title}>Unlock {featureName}</Text>
              <Text style={styles.description}>{featureDescription}</Text>

              {/* Pro Benefits */}
              <View style={styles.benefitsContainer}>
                <View style={styles.benefitRow}>
                  <Ionicons name="checkmark-circle" size={20} color={theme.colors.hotCoral} />
                  <Text style={styles.benefitText}>Unlimited scenario simulations</Text>
                </View>
                <View style={styles.benefitRow}>
                  <Ionicons name="checkmark-circle" size={20} color={theme.colors.hotCoral} />
                  <Text style={styles.benefitText}>Voice briefings with AI</Text>
                </View>
                <View style={styles.benefitRow}>
                  <Ionicons name="checkmark-circle" size={20} color={theme.colors.hotCoral} />
                  <Text style={styles.benefitText}>Weekly recap insights</Text>
                </View>
              </View>

              {/* Price */}
              <View style={styles.priceContainer}>
                <Text style={styles.priceLabel}>Only</Text>
                <Text style={styles.price}>{'\u20AC'}1.99</Text>
                <Text style={styles.pricePeriod}>/month</Text>
              </View>

              {/* Buttons */}
              <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgrade}>
                <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.laterButton} onPress={onClose}>
                <Text style={styles.laterButtonText}>Maybe Later</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

interface LockBadgeProps {
  size?: 'small' | 'medium' | 'large';
  onPress?: () => void;
}

export const LockBadge: React.FC<LockBadgeProps> = ({ size = 'small', onPress }) => {
  const iconSize = size === 'small' ? 10 : size === 'medium' ? 14 : 18;
  const badgeSize = size === 'small' ? 18 : size === 'medium' ? 24 : 32;

  const badge = (
    <View style={[styles.lockBadge, { width: badgeSize, height: badgeSize, borderRadius: badgeSize / 2 }]}>
      <Ionicons name="lock-closed" size={iconSize} color={theme.colors.white} />
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress}>
        {badge}
      </TouchableOpacity>
    );
  }

  return badge;
};

interface ProBadgeProps {
  style?: object;
}

export const ProBadge: React.FC<ProBadgeProps> = ({ style }) => (
  <View style={[styles.proBadge, style]}>
    <Text style={styles.proBadgeText}>PRO</Text>
  </View>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    paddingTop: theme.spacing.md,
    maxHeight: SCREEN_HEIGHT * 0.7,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.lightGray,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: theme.spacing.lg,
  },
  lockIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.hotCoral,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.deepNavy,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  description: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: theme.spacing.lg,
  },
  benefitsContainer: {
    backgroundColor: theme.colors.softWhite,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  benefitText: {
    fontSize: 14,
    color: theme.colors.deepNavy,
    marginLeft: theme.spacing.sm,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  priceLabel: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginRight: theme.spacing.xs,
  },
  price: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.hotCoral,
  },
  pricePeriod: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.xs,
  },
  upgradeButton: {
    backgroundColor: theme.colors.hotCoral,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.white,
  },
  laterButton: {
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  laterButtonText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  lockBadge: {
    backgroundColor: theme.colors.hotCoral,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: -4,
    right: -4,
  },
  proBadge: {
    backgroundColor: theme.colors.neonYellow,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  proBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.deepNavy,
    letterSpacing: 0.5,
  },
});

export default LockedFeatureModal;
