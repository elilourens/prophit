import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Keyboard,
  Platform,
} from 'react-native';
import { theme } from './theme';

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  isRecording: boolean;
  isLoading?: boolean;
  placeholder?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onStartRecording,
  onStopRecording,
  isRecording,
  isLoading = false,
  placeholder = 'Message the Prophit...',
}) => {
  const [text, setText] = useState('');
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for recording
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, pulseAnim]);

  const handleSend = () => {
    if (text.trim() && !isLoading) {
      onSendMessage(text.trim());
      setText('');
      Keyboard.dismiss();
    }
  };

  const handleMicPress = () => {
    if (isRecording) {
      onStopRecording();
    } else {
      onStartRecording();
    }
  };

  const showSendButton = text.trim().length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        {/* Mic Button */}
        <TouchableOpacity
          style={[styles.micButton, isRecording && styles.micButtonRecording]}
          onPress={handleMicPress}
          disabled={isLoading}
        >
          <Animated.Text
            style={[
              styles.micIcon,
              isRecording && styles.micIconRecording,
              { transform: [{ scale: pulseAnim }] },
            ]}
          >
            {isRecording ? '⏹' : '🎤'}
          </Animated.Text>
        </TouchableOpacity>

        {/* Text Input */}
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={isRecording ? 'Listening...' : placeholder}
          placeholderTextColor={theme.colors.textSecondary}
          multiline
          maxLength={500}
          editable={!isRecording && !isLoading}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />

        {/* Send Button */}
        <TouchableOpacity
          style={[
            styles.sendButton,
            showSendButton ? styles.sendButtonActive : styles.sendButtonInactive,
          ]}
          onPress={handleSend}
          disabled={!showSendButton || isLoading}
        >
          <Animated.Text style={styles.sendIcon}>
            {isLoading ? '⏳' : '↑'}
          </Animated.Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.probabilityBarBackground,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: theme.colors.white,
    borderRadius: 24,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: Platform.OS === 'ios' ? theme.spacing.xs : 0,
    ...theme.cardShadow,
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.softWhite,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.xs,
  },
  micButtonRecording: {
    backgroundColor: theme.colors.hotCoral,
  },
  micIcon: {
    fontSize: 20,
  },
  micIconRecording: {
    color: theme.colors.white,
  },
  input: {
    flex: 1,
    ...theme.typography.body,
    color: theme.colors.deepNavy,
    paddingVertical: Platform.OS === 'ios' ? theme.spacing.sm : theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    maxHeight: 100,
    minHeight: 40,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: theme.spacing.xs,
  },
  sendButtonActive: {
    backgroundColor: theme.colors.hotCoral,
  },
  sendButtonInactive: {
    backgroundColor: theme.colors.probabilityBarBackground,
  },
  sendIcon: {
    fontSize: 18,
    color: theme.colors.white,
    fontWeight: '700',
  },
});

export default ChatInput;
