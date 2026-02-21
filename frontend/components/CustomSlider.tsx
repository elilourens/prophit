import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { theme } from './theme';

interface CustomSliderProps {
  label: string;
  value: number;
  minimumValue: number;
  maximumValue: number;
  step?: number;
  onValueChange: (value: number) => void;
  formatValue?: (value: number) => string;
  prefix?: string;
  suffix?: string;
}

export const CustomSlider: React.FC<CustomSliderProps> = ({
  label,
  value,
  minimumValue,
  maximumValue,
  step = 1,
  onValueChange,
  formatValue,
  prefix = '',
  suffix = '',
}) => {
  const displayValue = formatValue
    ? formatValue(value)
    : `${prefix}${value.toLocaleString()}${suffix}`;

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{displayValue}</Text>
      </View>
      <View style={styles.sliderContainer}>
        <Text style={styles.rangeLabel}>
          {prefix}{minimumValue.toLocaleString()}{suffix}
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
          {prefix}{maximumValue.toLocaleString()}{suffix}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: theme.spacing.sm,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  label: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: theme.typography.body.fontWeight,
    color: theme.colors.deepNavy,
  },
  value: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
    color: theme.colors.hotCoral,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slider: {
    flex: 1,
    height: 40,
    marginHorizontal: theme.spacing.xs,
  },
  rangeLabel: {
    fontSize: theme.typography.small.fontSize,
    color: theme.colors.gray,
    minWidth: 60,
    textAlign: 'center',
  },
});
