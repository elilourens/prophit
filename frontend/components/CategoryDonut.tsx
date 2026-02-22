import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { theme } from './theme';

interface CategoryData {
  name: string;
  value: number;
  color: string;
}

interface CategoryDonutProps {
  data: CategoryData[];
  size?: number;
}

export const CategoryDonut: React.FC<CategoryDonutProps> = ({
  data,
  size: sizeProp
}) => {
  const { width: windowWidth } = useWindowDimensions();
  // Fit within viewport: leave room for card padding and avoid overflow on narrow screens
  const size = sizeProp ?? Math.min(windowWidth - 96, 200);
  // Guard against empty data
  if (!data || data.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.totalLabel}>No data available</Text>
      </View>
    );
  }

  const total = data.reduce((sum, item) => sum + (item.value || 0), 0);

  // Guard against zero total (would cause division by zero)
  if (total === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.totalLabel}>No spending data</Text>
      </View>
    );
  }
  const cx = size / 2;
  const cy = size / 2;
  const outerRadius = size / 2 - 10;
  const innerRadius = outerRadius * 0.55;

  // Calculate arc paths
  let startAngle = -90; // Start from top

  const arcs = data.map((item) => {
    const percentage = (item.value || 0) / total;
    const angle = percentage * 360;
    const endAngle = startAngle + angle;

    // Convert angles to radians
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    // Calculate arc points
    const x1Outer = cx + outerRadius * Math.cos(startRad);
    const y1Outer = cy + outerRadius * Math.sin(startRad);
    const x2Outer = cx + outerRadius * Math.cos(endRad);
    const y2Outer = cy + outerRadius * Math.sin(endRad);

    const x1Inner = cx + innerRadius * Math.cos(startRad);
    const y1Inner = cy + innerRadius * Math.sin(startRad);
    const x2Inner = cx + innerRadius * Math.cos(endRad);
    const y2Inner = cy + innerRadius * Math.sin(endRad);

    const largeArcFlag = angle > 180 ? 1 : 0;

    const path = `
      M ${x1Outer} ${y1Outer}
      A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2Outer} ${y2Outer}
      L ${x2Inner} ${y2Inner}
      A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x1Inner} ${y1Inner}
      Z
    `;

    const arc = {
      path,
      color: item.color,
      percentage,
      name: item.name,
      value: item.value,
    };

    startAngle = endAngle;
    return arc;
  });

  const formatCurrency = (value: number) => {
    return `€${value.toLocaleString('en-EU')}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.chartContainer}>
        <Svg width={size} height={size}>
          <G>
            {arcs.map((arc, index) => (
              <Path
                key={index}
                d={arc.path}
                fill={arc.color}
                stroke={theme.colors.white}
                strokeWidth={2}
              />
            ))}
          </G>
        </Svg>

        {/* Center text */}
        <View style={[styles.centerText, { width: innerRadius * 2, height: innerRadius * 2 }]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {data.map((item, index) => (
          <View key={index} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
            <Text style={styles.legendName}>{item.name}</Text>
            <Text style={styles.legendValue}>{formatCurrency(item.value)}</Text>
            <Text style={styles.legendPercent}>
              {((item.value / total) * 100).toFixed(0)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  chartContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalLabel: {
    fontSize: 12,
    color: theme.colors.gray,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.deepNavy,
  },
  legend: {
    marginTop: theme.spacing.lg,
    width: '100%',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendName: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.deepNavy,
  },
  legendValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.deepNavy,
    width: 70,
    textAlign: 'right',
  },
  legendPercent: {
    fontSize: 12,
    color: theme.colors.gray,
    width: 40,
    textAlign: 'right',
  },
});
