import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { theme } from './theme';

interface RunwayRingProps {
  months: number;
  maxMonths?: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const RING_SIZE = Math.min(SCREEN_WIDTH * 0.6, 220);
const STROKE_WIDTH = 16;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export const RunwayRing: React.FC<RunwayRingProps> = ({
  months,
  maxMonths = 12
}) => {
  const progress = Math.min(months / maxMonths, 1);
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

  return (
    <View style={styles.container}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Defs>
          <LinearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={theme.colors.hotCoral} />
            <Stop offset="100%" stopColor={theme.colors.midOrange} />
          </LinearGradient>
        </Defs>

        {/* Background circle */}
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          stroke={theme.colors.lightGray}
          strokeWidth={STROKE_WIDTH}
          fill="transparent"
        />

        {/* Progress circle */}
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          stroke="url(#gradient)"
          strokeWidth={STROKE_WIDTH}
          fill="transparent"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90, ${RING_SIZE / 2}, ${RING_SIZE / 2})`}
        />
      </Svg>

      <View style={styles.textContainer}>
        <Text style={styles.valueText}>{months.toFixed(1)}</Text>
        <Text style={styles.labelText}>months</Text>
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
  valueText: {
    fontSize: 42,
    fontWeight: '700',
    color: theme.colors.deepNavy,
  },
  labelText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.gray,
    marginTop: -4,
  },
});
