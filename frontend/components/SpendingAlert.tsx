import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from './theme';

type AlertSeverity = 'warning' | 'critical' | 'info';

interface SpendingAlertProps {
  category: string;
  percentageChange: number;
  message?: string;
  severity?: AlertSeverity;
}

const getSeverityConfig = (severity: AlertSeverity) => {
  switch (severity) {
    case 'critical':
      return {
        backgroundColor: '#FFF0F0',
        borderColor: theme.colors.hotCoral,
        iconColor: theme.colors.hotCoral,
        icon: '!!',
      };
    case 'warning':
      return {
        backgroundColor: '#FFF8F0',
        borderColor: theme.colors.midOrange,
        iconColor: theme.colors.midOrange,
        icon: '!',
      };
    case 'info':
    default:
      return {
        backgroundColor: '#F0F8FF',
        borderColor: theme.colors.deepTeal,
        iconColor: theme.colors.deepTeal,
        icon: 'i',
      };
  }
};

export const SpendingAlert: React.FC<SpendingAlertProps> = ({
  category,
  percentageChange,
  message,
  severity = 'warning',
}) => {
  const config = getSeverityConfig(severity);

  const defaultMessage = `${category} spending is ${Math.abs(percentageChange)}% ${
    percentageChange > 0 ? 'higher' : 'lower'
  } than usual`;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: config.backgroundColor,
          borderLeftColor: config.borderColor,
        },
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: config.borderColor }]}>
        <Text style={styles.iconText}>{config.icon}</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.alertText}>{message || defaultMessage}</Text>
        <Text style={styles.categoryText}>{category}</Text>
      </View>
      <View style={styles.percentageContainer}>
        <Text
          style={[
            styles.percentageText,
            { color: percentageChange > 0 ? theme.colors.hotCoral : theme.colors.deepTeal },
          ]}
        >
          {percentageChange > 0 ? '+' : ''}
          {percentageChange}%
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderLeftWidth: 4,
    marginBottom: theme.spacing.md,
    ...theme.cardShadow,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  iconText: {
    color: theme.colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  alertText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.deepNavy,
    lineHeight: 20,
  },
  categoryText: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 2,
  },
  percentageContainer: {
    marginLeft: theme.spacing.md,
  },
  percentageText: {
    fontSize: 18,
    fontWeight: '700',
  },
});
