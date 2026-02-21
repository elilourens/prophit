import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { theme } from './theme';

type TabOption = 'week' | 'month' | 'year';

interface ToggleTabsProps {
  activeTab: TabOption;
  onTabChange: (tab: TabOption) => void;
}

const TABS: { key: TabOption; label: string }[] = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
];

export const ToggleTabs: React.FC<ToggleTabsProps> = ({
  activeTab,
  onTabChange,
}) => {
  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              isActive && styles.activeTab,
            ]}
            onPress={() => onTabChange(tab.key)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabText,
                isActive && styles.activeTabText,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: theme.colors.lightGray,
    borderRadius: theme.borderRadius.full,
    padding: 4,
    alignSelf: 'center',
  },
  tab: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.full,
    minWidth: 80,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: theme.colors.hotCoral,
    ...theme.cardShadow,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.gray,
  },
  activeTabText: {
    color: theme.colors.white,
  },
});

export type { TabOption };
