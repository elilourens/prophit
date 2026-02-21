import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { theme } from './theme';

interface TTSToggleProps {
  isEnabled: boolean;
  onToggle: () => void;
}

export const TTSToggle: React.FC<TTSToggleProps> = ({ isEnabled, onToggle }) => {
  return (
    <TouchableOpacity
      style={[styles.container, isEnabled && styles.containerActive]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <Text style={styles.icon}>{isEnabled ? '🔊' : '🔇'}</Text>
      <View style={[styles.indicator, isEnabled && styles.indicatorActive]} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 44,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.probabilityBarBackground,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 4,
  },
  containerActive: {
    backgroundColor: theme.colors.deepTeal,
  },
  icon: {
    fontSize: 16,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.textSecondary,
    marginLeft: 4,
  },
  indicatorActive: {
    backgroundColor: theme.colors.neonYellow,
  },
});

export default TTSToggle;
