import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { theme } from './theme';
import { SoundWave } from './SoundWave';
import { TypingIndicator } from './TypingIndicator';

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  isVoice?: boolean;
  state?: 'typing' | 'speaking' | 'complete';
}

interface ChatBubbleProps {
  message: ChatMessage;
  isSpeaking?: boolean;
  showTimestamp?: boolean;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  message,
  isSpeaking = false,
  showTimestamp = true,
}) => {
  const isUser = message.sender === 'user';
  const state = message.state || 'complete';

  // Animation for morphing from waveform to text
  const textOpacity = useRef(new Animated.Value(state === 'complete' ? 1 : 0)).current;
  const waveOpacity = useRef(new Animated.Value(state === 'speaking' ? 1 : 0)).current;
  const bubbleScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (state === 'complete') {
      // Morph from waveform/typing to text
      Animated.parallel([
        Animated.timing(waveOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(100),
          Animated.timing(textOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
        // Subtle scale pulse on reveal
        Animated.sequence([
          Animated.timing(bubbleScale, {
            toValue: 1.02,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(bubbleScale, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    } else if (state === 'speaking') {
      // Show waveform
      Animated.parallel([
        Animated.timing(waveOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(textOpacity, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (state === 'typing') {
      // Reset for typing state
      waveOpacity.setValue(0);
      textOpacity.setValue(0);
    }
  }, [state, textOpacity, waveOpacity, bubbleScale]);

  const renderContent = () => {
    if (isUser) {
      return (
        <>
          {message.isVoice && (
            <Text style={[styles.voiceIndicator, styles.userVoiceIndicator]}>
              🎤
            </Text>
          )}
          <Text style={[styles.text, styles.userText]}>{message.text}</Text>
        </>
      );
    }

    // AI message with states
    return (
      <View style={styles.aiContentContainer}>
        {/* Typing indicator */}
        {state === 'typing' && (
          <View style={styles.typingContainer}>
            <TypingIndicator color={theme.colors.deepTeal} size={8} />
          </View>
        )}

        {/* Sound wave for speaking state */}
        {(state === 'speaking' || (state === 'typing' && isSpeaking)) && (
          <Animated.View style={[styles.waveContainer, { opacity: waveOpacity }]}>
            <SoundWave
              isPlaying={true}
              barCount={5}
              color={theme.colors.hotCoral}
              height={28}
              barWidth={4}
            />
          </Animated.View>
        )}

        {/* Text content */}
        <Animated.View
          style={[
            styles.textWrapper,
            {
              opacity: textOpacity,
              position: state === 'complete' ? 'relative' : 'absolute',
            },
          ]}
        >
          <Text style={[styles.text, styles.aiText]}>{message.text}</Text>
        </Animated.View>
      </View>
    );
  };

  // Hide bubble completely for typing/speaking if we want minimal height
  const showFullBubble = state === 'complete' || state === 'speaking' || state === 'typing';

  if (!showFullBubble) return null;

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.aiContainer]}>
      <Animated.View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.aiBubble,
          { transform: [{ scale: bubbleScale }] },
          // Adjust min width/height for different states
          state !== 'complete' && !isUser && styles.bubbleMinSize,
        ]}
      >
        {renderContent()}
      </Animated.View>
      {showTimestamp && state === 'complete' && (
        <Text style={[styles.timestamp, isUser && styles.userTimestamp]}>
          {formatTime(message.timestamp)}
        </Text>
      )}
    </View>
  );
};

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const styles = StyleSheet.create({
  container: {
    marginVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    maxWidth: '85%',
  },
  userContainer: {
    alignSelf: 'flex-end',
  },
  aiContainer: {
    alignSelf: 'flex-start',
  },
  bubble: {
    paddingVertical: theme.spacing.sm + 2,
    paddingHorizontal: theme.spacing.md,
    borderRadius: 20,
    minHeight: 44,
    justifyContent: 'center',
  },
  bubbleMinSize: {
    minWidth: 80,
    minHeight: 48,
  },
  userBubble: {
    backgroundColor: theme.colors.hotCoral,
    borderBottomRightRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiBubble: {
    backgroundColor: theme.colors.white,
    borderBottomLeftRadius: 4,
    ...theme.cardShadow,
  },
  aiContentContainer: {
    minHeight: 24,
    justifyContent: 'center',
  },
  typingContainer: {
    paddingVertical: 4,
  },
  waveContainer: {
    paddingVertical: 4,
  },
  textWrapper: {
    flexShrink: 1,
  },
  text: {
    ...theme.typography.body,
    lineHeight: 22,
    flexShrink: 1,
  },
  userText: {
    color: theme.colors.white,
  },
  aiText: {
    color: theme.colors.deepNavy,
  },
  voiceIndicator: {
    fontSize: 14,
    marginRight: theme.spacing.xs,
  },
  userVoiceIndicator: {
    opacity: 0.8,
  },
  timestamp: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
    marginTop: 4,
    marginHorizontal: 4,
  },
  userTimestamp: {
    textAlign: 'right',
  },
});

export default ChatBubble;
