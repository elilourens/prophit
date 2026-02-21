import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from './theme';
import { usePro } from '../contexts/ProContext';

interface UpgradeBannerProps {
  style?: object;
}

export const UpgradeBanner: React.FC<UpgradeBannerProps> = ({ style }) => {
  const { isPro } = usePro();

  if (isPro) {
    return null;
  }

  const handleUpgrade = () => {
    router.push('/upgrade' as any);
  };

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={handleUpgrade}
      activeOpacity={0.9}
    >
      <View style={styles.iconContainer}>
        <Ionicons name="sparkles" size={20} color={theme.colors.deepNavy} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.title}>Unlock Pro Features</Text>
        <Text style={styles.subtitle}>Simulator, Voice, AI Chat & more</Text>
      </View>
      <View style={styles.priceContainer}>
        <Text style={styles.price}>{'\u20AC'}1.99</Text>
        <Text style={styles.period}>/mo</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.colors.deepNavy} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.neonYellow,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(17, 34, 49, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.deepNavy,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(17, 34, 49, 0.7)',
    marginTop: 2,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginRight: theme.spacing.sm,
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.deepNavy,
  },
  period: {
    fontSize: 12,
    color: 'rgba(17, 34, 49, 0.7)',
  },
});

export default UpgradeBanner;
