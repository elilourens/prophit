import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Line, Circle, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { theme } from './theme';

interface SpendTrajectoryProps {
  historicalData: number[];  // Past 6 months
  projectedData: number[];   // Next 3 months projection
  labels?: string[];
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 64;
const CHART_HEIGHT = 180;
const PADDING_LEFT = 50;
const PADDING_RIGHT = 20;
const PADDING_TOP = 20;
const PADDING_BOTTOM = 40;

export const SpendTrajectory: React.FC<SpendTrajectoryProps> = ({
  historicalData,
  projectedData,
  labels = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May']
}) => {
  const allData = [...historicalData, ...projectedData];
  const maxValue = Math.max(...allData) * 1.1;
  const minValue = Math.min(...allData) * 0.9;
  const range = maxValue - minValue;

  const graphWidth = CHART_WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const graphHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  const getX = (index: number) => {
    return PADDING_LEFT + (index / (allData.length - 1)) * graphWidth;
  };

  const getY = (value: number) => {
    return PADDING_TOP + graphHeight - ((value - minValue) / range) * graphHeight;
  };

  // Create path for historical data
  const createPath = (data: number[], startIndex: number = 0) => {
    return data
      .map((value, index) => {
        const x = getX(startIndex + index);
        const y = getY(value);
        return index === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
      })
      .join(' ');
  };

  const historicalPath = createPath(historicalData, 0);
  const projectedPath = createPath([historicalData[historicalData.length - 1], ...projectedData], historicalData.length - 1);

  // Y-axis labels
  const yLabels = [maxValue, (maxValue + minValue) / 2, minValue].map(v => Math.round(v));

  const formatCurrency = (value: number) => {
    if (value >= 1000) {
      return `€${(value / 1000).toFixed(1)}k`;
    }
    return `€${value}`;
  };

  return (
    <View style={styles.container}>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        <Defs>
          <LinearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={theme.colors.hotCoral} />
            <Stop offset="100%" stopColor={theme.colors.midOrange} />
          </LinearGradient>
        </Defs>

        {/* Y-axis grid lines */}
        {yLabels.map((label, index) => {
          const y = getY(label);
          return (
            <React.Fragment key={index}>
              <Line
                x1={PADDING_LEFT}
                y1={y}
                x2={CHART_WIDTH - PADDING_RIGHT}
                y2={y}
                stroke={theme.colors.lightGray}
                strokeWidth={1}
                strokeDasharray="4,4"
              />
              <SvgText
                x={PADDING_LEFT - 8}
                y={y + 4}
                fontSize={10}
                fill={theme.colors.gray}
                textAnchor="end"
              >
                {formatCurrency(label)}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Historical line (solid) */}
        <Path
          d={historicalPath}
          stroke="url(#lineGradient)"
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Projected line (dashed) */}
        <Path
          d={projectedPath}
          stroke={theme.colors.deepTeal}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="8,6"
        />

        {/* Data points - Historical */}
        {historicalData.map((value, index) => (
          <Circle
            key={`hist-${index}`}
            cx={getX(index)}
            cy={getY(value)}
            r={5}
            fill={theme.colors.white}
            stroke={theme.colors.hotCoral}
            strokeWidth={2}
          />
        ))}

        {/* Data points - Projected */}
        {projectedData.map((value, index) => (
          <Circle
            key={`proj-${index}`}
            cx={getX(historicalData.length + index)}
            cy={getY(value)}
            r={5}
            fill={theme.colors.white}
            stroke={theme.colors.deepTeal}
            strokeWidth={2}
          />
        ))}

        {/* X-axis labels */}
        {labels.map((label, index) => (
          <SvgText
            key={index}
            x={getX(index)}
            y={CHART_HEIGHT - 10}
            fontSize={10}
            fill={index >= historicalData.length ? theme.colors.deepTeal : theme.colors.gray}
            textAnchor="middle"
            fontWeight={index >= historicalData.length ? '600' : '400'}
          >
            {label}
          </SvgText>
        ))}
      </Svg>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, styles.historicalLine]} />
          <Text style={styles.legendText}>Actual</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, styles.projectedLine]} />
          <Text style={styles.legendText}>Projected</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: theme.spacing.md,
    gap: theme.spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  legendLine: {
    width: 24,
    height: 3,
    borderRadius: 2,
  },
  historicalLine: {
    backgroundColor: theme.colors.hotCoral,
  },
  projectedLine: {
    backgroundColor: theme.colors.deepTeal,
    borderStyle: 'dashed',
  },
  legendText: {
    fontSize: 12,
    color: theme.colors.gray,
  },
});
