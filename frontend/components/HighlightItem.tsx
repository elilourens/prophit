import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from './theme';

interface HighlightItemProps {
  text: string;
  isPositive: boolean;
}

export const HighlightItem: React.FC<HighlightItemProps> = ({
  text,
  isPositive,
}) => {
  return (
    <View style={styles.container}>
      <View
        style={[
          styles.iconContainer,
          isPositive ? styles.positiveIcon : styles.negativeIcon,
        ]}
      >
        <Text style={styles.icon}>{isPositive ? '\u2713' : '\u2717'}</Text>
      </View>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    ...theme.cardShadow,
    shadowOpacity: 0.05,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  positiveIcon: {
    backgroundColor: 'rgba(195, 255, 52, 0.2)',
  },
  negativeIcon: {
    backgroundColor: 'rgba(254, 139, 24, 0.2)',
  },
  icon: {
    fontSize: 16,
    fontWeight: '700',
  },
  text: {
    flex: 1,
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.deepNavy,
    lineHeight: 22,
  },
});
