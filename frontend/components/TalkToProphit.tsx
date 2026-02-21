import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from './theme';
import { usePro } from '../contexts/ProContext';
import { LockedFeatureModal, ProBadge } from './LockedFeatureModal';

interface TalkToProphitProps {
  onPress?: () => void;
}

export const TalkToProphit: React.FC<TalkToProphitProps> = ({ onPress }) => {
  const { isPro } = usePro();
  const [showLockedModal, setShowLockedModal] = useState(false);

  const handlePress = () => {
    if (!isPro) {
      setShowLockedModal(true);
      return;
    }

    if (onPress) {
      onPress();
    } else {
      router.push('/chat');
    }
  };

  return (
    <>
      <LockedFeatureModal
        visible={showLockedModal}
        onClose={() => setShowLockedModal(false)}
        featureName="AI Chat"
        featureDescription="Chat with your personal AI financial assistant and get instant advice."
      />

      <TouchableOpacity
        style={styles.container}
        onPress={handlePress}
        activeOpacity={0.85}
      >
      {/* Gradient-like background with accent */}
      <View style={styles.accentLine} />

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>🔮</Text>
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title}>Talk to the Prophit</Text>
          <Text style={styles.subtitle}>Ask anything about your finances</Text>
        </View>

        <View style={styles.actionContainer}>
          <View style={styles.micBadge}>
            <Text style={styles.micIcon}>🎤</Text>
          </View>
          <Text style={styles.arrow}>→</Text>
        </View>
      </View>

      {/* Feature tags */}
      <View style={styles.tagsContainer}>
        <View style={styles.tag}>
          <Text style={styles.tagText}>Voice</Text>
        </View>
        <View style={styles.tag}>
          <Text style={styles.tagText}>Chat</Text>
        </View>
        <View style={styles.tag}>
          <Text style={styles.tagText}>AI Powered</Text>
        </View>
        {!isPro && (
          <View style={styles.proTag}>
            <Ionicons name="lock-closed" size={10} color={theme.colors.deepNavy} />
            <Text style={styles.proTagText}>PRO</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.deepNavy,
    borderRadius: theme.borderRadius.lg,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    overflow: 'hidden',
    ...theme.cardShadowLarge,
  },
  accentLine: {
    height: 3,
    backgroundColor: theme.colors.neonYellow,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  icon: {
    fontSize: 24,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    ...theme.typography.subheader,
    color: theme.colors.white,
    marginBottom: 2,
  },
  subtitle: {
    ...theme.typography.bodySmall,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  micBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.hotCoral,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  micIcon: {
    fontSize: 16,
  },
  arrow: {
    fontSize: 24,
    color: theme.colors.white,
    fontWeight: '300',
  },
  tagsContainer: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  tag: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  tagText: {
    ...theme.typography.small,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  proTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.neonYellow,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    gap: 4,
  },
  proTagText: {
    ...theme.typography.small,
    fontWeight: '700',
    color: theme.colors.deepNavy,
  },
});

export default TalkToProphit;
