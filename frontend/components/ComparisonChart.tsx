import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Rect, Text as SvgText, Line } from 'react-native-svg';
import { theme } from './theme';

interface ComparisonData {
  label: string;
  thisWeek: number;
  lastWeek: number;
}

interface ComparisonChartProps {
  data: ComparisonData[];
  title?: string;
}

const CHART_HEIGHT = 200;
const PADDING_LEFT = 44;
const PADDING_RIGHT = 16;
const PADDING_TOP = 30;
const PADDING_BOTTOM = 50;
const BAR_GAP = 8; // gap between the two bars in a group
const MIN_BAR_WIDTH = 6;
const MAX_BAR_WIDTH = 22;

export const ComparisonChart: React.FC<ComparisonChartProps> = ({
  data,
  title
}) => {
  const { width: windowWidth } = useWindowDimensions();
  // Account for content padding (lg*2) + card padding (lg*2) so chart fits on mobile
  const chartWidth = Math.max(260, windowWidth - 96);
  const availableWidth = chartWidth - PADDING_LEFT - PADDING_RIGHT;

  // Guard against empty data or all zeros
  if (!data || data.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.legendText}>No data available</Text>
      </View>
    );
  }

  const n = data.length;
  // Fit bars in available width: n * groupWidth + (n-1) * groupGap <= availableWidth
  const totalBarSpan = 3 * n - 1; // coefficient of barWidth when groupGap = barWidth
  const barWidth = Math.max(
    MIN_BAR_WIDTH,
    Math.min(MAX_BAR_WIDTH, (availableWidth - BAR_GAP * n) / totalBarSpan)
  );
  const groupWidth = 2 * barWidth + BAR_GAP;
  const groupGap = n > 1
    ? Math.max(2, (availableWidth - n * groupWidth) / (n - 1))
    : 0;

  const allValues = data.flatMap(d => [d.thisWeek || 0, d.lastWeek || 0]);
  const rawMax = Math.max(...allValues);
  const maxValue = (rawMax > 0 ? rawMax : 100) * 1.1; // Default to 100 if all zeros

  const graphHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const startX = PADDING_LEFT;

  const getBarHeight = (value: number) => {
    return (value / maxValue) * graphHeight;
  };

  const formatCurrency = (value: number) => {
    return `€${value}`;
  };

  // Y-axis labels
  const yLabels = [maxValue, maxValue * 0.5, 0].map(v => Math.round(v));

  return (
    <View style={[styles.container, { maxWidth: '100%' }]}>
      {title && <Text style={styles.title}>{title}</Text>}

      <Svg width={chartWidth} height={CHART_HEIGHT}>
        {/* Y-axis labels and grid lines */}
        {yLabels.map((label, index) => {
          const y = PADDING_TOP + (index / (yLabels.length - 1)) * graphHeight;
          return (
            <React.Fragment key={index}>
              <Line
                x1={PADDING_LEFT}
                y1={y}
                x2={chartWidth - PADDING_RIGHT}
                y2={y}
                stroke={theme.colors.lightGray}
                strokeWidth={1}
                strokeDasharray={index > 0 ? "4,4" : "0"}
              />
              <SvgText
                x={PADDING_LEFT - 6}
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

        {/* Bar groups - scale to fit available width */}
        {data.map((item, index) => {
          const groupX = startX + index * (groupWidth + groupGap);
          const lastWeekHeight = getBarHeight(item.lastWeek);
          const thisWeekHeight = getBarHeight(item.thisWeek);

          return (
            <React.Fragment key={index}>
              {/* Last week bar */}
              <Rect
                x={groupX}
                y={PADDING_TOP + graphHeight - lastWeekHeight}
                width={barWidth}
                height={lastWeekHeight}
                fill={theme.colors.deepTeal}
                rx={4}
                ry={4}
              />

              {/* This week bar */}
              <Rect
                x={groupX + barWidth + BAR_GAP}
                y={PADDING_TOP + graphHeight - thisWeekHeight}
                width={barWidth}
                height={thisWeekHeight}
                fill={theme.colors.hotCoral}
                rx={4}
                ry={4}
              />

              {/* X-axis label */}
              <SvgText
                x={groupX + groupWidth / 2}
                y={CHART_HEIGHT - 20}
                fontSize={11}
                fill={theme.colors.deepNavy}
                textAnchor="middle"
                fontWeight="500"
              >
                {item.label}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.colors.deepTeal }]} />
          <Text style={styles.legendText}>Last Week</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.colors.hotCoral }]} />
          <Text style={styles.legendText}>This Week</Text>
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
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.md,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: theme.spacing.md,
    gap: theme.spacing.xl,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: theme.colors.gray,
  },
});
