import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from './theme';
import { ttsService } from '../services/ttsService';
import { usePro } from '../contexts/ProContext';
import { LockedFeatureModal } from './LockedFeatureModal';

interface MorningBriefingProps {
  userName?: string;
  temperature?: number;
  location?: string;
  weatherIcon?: string;
  topPrediction?: {
    title: string;
    probability: number;
  };
  nudge?: string;
  onViewFullBriefing?: () => void;
}

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

// Weather icon mapping
const getWeatherSymbol = (icon?: string): string => {
  const iconMap: Record<string, string> = {
    sunny: '\u2600\uFE0F',
    cloudy: '\u2601\uFE0F',
    rainy: '\uD83C\uDF27\uFE0F',
    partlyCloudy: '\u26C5',
    stormy: '\u26C8\uFE0F',
  };
  return iconMap[icon || 'sunny'] || '\u2600\uFE0F';
};

type PlaybackState = 'idle' | 'loading' | 'playing' | 'error';

export const MorningBriefing: React.FC<MorningBriefingProps> = ({
  userName = 'Alex',
  temperature = 12,
  location = 'Dublin',
  weatherIcon = 'sunny',
  topPrediction = {
    title: 'Lunch out',
    probability: 80,
  },
  nudge = 'You usually spend more on Fridays',
  onViewFullBriefing,
}) => {
  const { isPro } = usePro();
  const greeting = getGreeting();
  const weatherSymbol = getWeatherSymbol(weatherIcon);

  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showLockedModal, setShowLockedModal] = useState(false);

  const handlePlayBriefing = useCallback(async () => {
    // Check if user is Pro
    if (!isPro) {
      setShowLockedModal(true);
      return;
    }

    // If already playing, stop
    if (playbackState === 'playing') {
      await ttsService.stop();
      setPlaybackState('idle');
      return;
    }

    // Check if API is configured
    if (!ttsService.isConfigured()) {
      setErrorMessage('TTS not configured. Add EXPO_PUBLIC_ELEVENLABS_API_KEY to .env');
      setPlaybackState('error');
      setTimeout(() => {
        setPlaybackState('idle');
        setErrorMessage(null);
      }, 3000);
      return;
    }

    setPlaybackState('loading');
    setErrorMessage(null);

    try {
      // Generate briefing text
      const briefingText = ttsService.generateBriefingText({
        userName,
        temperature,
        location,
        topPrediction,
        nudge,
      });

      // Speak the briefing
      await ttsService.speakText(briefingText);
      setPlaybackState('playing');

      // Set up a check for when playback completes
      const checkPlayback = setInterval(async () => {
        const isPlaying = await ttsService.isPlaying();
        if (!isPlaying) {
          setPlaybackState('idle');
          clearInterval(checkPlayback);
        }
      }, 500);

      // Cleanup interval after reasonable max duration (60 seconds)
      setTimeout(() => {
        clearInterval(checkPlayback);
        setPlaybackState('idle');
      }, 60000);

    } catch (error) {
      console.error('Failed to play briefing:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to play briefing');
      setPlaybackState('error');
      setTimeout(() => {
        setPlaybackState('idle');
        setErrorMessage(null);
      }, 3000);
    }
  }, [playbackState, userName, temperature, location, topPrediction, nudge, isPro]);

  const getPlayButtonText = (): string => {
    switch (playbackState) {
      case 'loading':
        return 'Loading...';
      case 'playing':
        return 'Stop Briefing';
      case 'error':
        return 'Error';
      default:
        return 'Play Briefing';
    }
  };

  const getPlayButtonIcon = (): string => {
    switch (playbackState) {
      case 'playing':
        return '\u23F9'; // Stop symbol
      case 'error':
        return '\u26A0'; // Warning symbol
      default:
        return '\uD83D\uDD0A'; // Speaker symbol
    }
  };

  return (
    <>
      <LockedFeatureModal
        visible={showLockedModal}
        onClose={() => setShowLockedModal(false)}
        featureName="Voice Briefings"
        featureDescription="Listen to personalized daily briefings with AI-generated voice updates."
      />

      <View style={styles.card}>
        {/* Accent bar at top */}
        <View style={styles.accentBar} />

      <View style={styles.content}>
        {/* Card Title */}
        <Text style={styles.cardTitle}>Today's Briefing</Text>

        {/* Top Prediction */}
        <View style={styles.predictionRow}>
          <View style={styles.predictionBadge}>
            <Text style={styles.predictionBadgeText}>Top prediction</Text>
          </View>
          <Text style={styles.predictionText}>
            {topPrediction.probability}% chance of {topPrediction.title.toLowerCase()}
          </Text>
        </View>

        {/* Nudge/Tip */}
        <View style={styles.nudgeContainer}>
          <Text style={styles.nudgeIcon}>{'\uD83D\uDCA1'}</Text>
          <Text style={styles.nudgeText}>{nudge}</Text>
        </View>

        {/* Play Briefing Button */}
        <TouchableOpacity
          style={[
            styles.playButton,
            playbackState === 'playing' && styles.playButtonActive,
            playbackState === 'error' && styles.playButtonError,
            playbackState === 'loading' && styles.playButtonLoading,
          ]}
          onPress={handlePlayBriefing}
          activeOpacity={0.7}
          disabled={playbackState === 'loading'}
        >
          {playbackState === 'loading' ? (
            <ActivityIndicator size="small" color={theme.colors.white} style={styles.playButtonLoader} />
          ) : !isPro ? (
            <Ionicons name="lock-closed" size={16} color={theme.colors.white} style={styles.playButtonIcon} />
          ) : (
            <Text style={styles.playButtonIcon}>{getPlayButtonIcon()}</Text>
          )}
          <Text style={styles.playButtonText}>{!isPro ? 'Play Briefing (Pro)' : getPlayButtonText()}</Text>
        </TouchableOpacity>

        {/* Error Message */}
        {errorMessage && (
          <Text style={styles.errorText}>{errorMessage}</Text>
        )}

        {/* View Full Briefing Link */}
        <TouchableOpacity
          style={styles.linkContainer}
          onPress={onViewFullBriefing}
          activeOpacity={0.7}
        >
          <Text style={styles.linkText}>View full briefing</Text>
          <Text style={styles.linkArrow}>{'\u2192'}</Text>
        </TouchableOpacity>
      </View>
    </View>
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.lg,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    overflow: 'hidden',
    ...theme.cardShadow,
  },
  accentBar: {
    height: 4,
    backgroundColor: theme.colors.neonYellow,
  },
  content: {
    padding: theme.spacing.md,
  },
  cardTitle: {
    ...theme.typography.subheader,
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.md,
  },
  predictionRow: {
    marginBottom: theme.spacing.md,
  },
  predictionBadge: {
    backgroundColor: theme.colors.hotCoral,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    alignSelf: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  predictionBadgeText: {
    ...theme.typography.small,
    color: theme.colors.white,
    fontWeight: '600',
  },
  predictionText: {
    ...theme.typography.body,
    color: theme.colors.deepNavy,
    fontWeight: '500',
  },
  nudgeContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.softWhite,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  nudgeIcon: {
    fontSize: 16,
    marginRight: theme.spacing.sm,
  },
  nudgeText: {
    ...theme.typography.bodySmall,
    color: theme.colors.deepTeal,
    flex: 1,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.deepTeal,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  playButtonActive: {
    backgroundColor: theme.colors.hotCoral,
  },
  playButtonError: {
    backgroundColor: theme.colors.midOrange,
  },
  playButtonLoading: {
    backgroundColor: theme.colors.textSecondary,
  },
  playButtonIcon: {
    fontSize: 18,
    marginRight: theme.spacing.sm,
  },
  playButtonText: {
    ...theme.typography.body,
    color: theme.colors.white,
    fontWeight: '600',
  },
  playButtonLoader: {
    marginRight: theme.spacing.sm,
  },
  errorText: {
    ...theme.typography.small,
    color: theme.colors.hotCoral,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: {
    ...theme.typography.body,
    color: theme.colors.hotCoral,
    fontWeight: '600',
  },
  linkArrow: {
    fontSize: 18,
    color: theme.colors.hotCoral,
    marginLeft: theme.spacing.sm,
  },
});

export default MorningBriefing;
