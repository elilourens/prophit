import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { theme } from './theme';

interface AccuracyRingProps {
  percentage: number;
  label?: string;
  size?: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const AccuracyRing: React.FC<AccuracyRingProps> = ({
  percentage,
  label = 'Prediction Accuracy',
  size = Math.min(SCREEN_WIDTH * 0.5, 180),
}) => {
  const STROKE_WIDTH = 14;
  const RADIUS = (size - STROKE_WIDTH) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  const clampedPercentage = Math.min(Math.max(percentage, 0), 100);
  const progress = clampedPercentage / 100;
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

  // Determine color based on accuracy
  const getAccuracyColor = () => {
    if (clampedPercentage >= 70) return theme.colors.neonYellow;
    if (clampedPercentage >= 50) return theme.colors.midOrange;
    return theme.colors.hotCoral;
  };

  const accuracyColor = getAccuracyColor();

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="accuracyGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={accuracyColor} />
            <Stop offset="100%" stopColor={theme.colors.deepTeal} />
          </LinearGradient>
        </Defs>

        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={RADIUS}
          stroke={theme.colors.lightGray}
          strokeWidth={STROKE_WIDTH}
          fill="transparent"
        />

        {/* Progress circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={RADIUS}
          stroke="url(#accuracyGradient)"
          strokeWidth={STROKE_WIDTH}
          fill="transparent"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90, ${size / 2}, ${size / 2})`}
        />
      </Svg>

      <View style={styles.textContainer}>
        <Text style={styles.percentageText}>{Math.round(clampedPercentage)}%</Text>
        <Text style={styles.labelText}>{label}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  textContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentageText: {
    fontSize: 36,
    fontWeight: '700',
    color: theme.colors.deepNavy,
  },
  labelText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.gray,
    marginTop: 2,
    textAlign: 'center',
    maxWidth: 100,
  },
});
