import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { theme } from '../components/theme';
import { ChatBubble, ChatMessage } from '../components/ChatBubble';
import { ChatInput } from '../components/ChatInput';
import { TTSToggle } from '../components/TTSToggle';
import { chatService } from '../services/chatService';
import { voiceService } from '../services/voiceService';
import { ttsService } from '../services/ttsService';

// Initial greeting
const INITIAL_MESSAGE: ChatMessage = {
  id: 'welcome',
  text: "Hey there, I'm the Prophit, your personal spending oracle. I can see your predictions, patterns, and help you make smarter money moves. What's on your mind?",
  sender: 'ai',
  timestamp: new Date(),
  state: 'complete',
};

// Timing constants
const SPEAKING_DURATION = 2500;

export default function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTTSEnabled, setIsTTSEnabled] = useState(true);
  const [currentSpeakingId, setCurrentSpeakingId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const handleSendMessage = useCallback(async (text: string, isVoice: boolean = false) => {
    if (!text.trim() || isLoading) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: text.trim(),
      sender: 'user',
      timestamp: new Date(),
      isVoice,
      state: 'complete',
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Create AI response placeholder with typing state
    const aiMessageId = (Date.now() + 1).toString();
    const typingMessage: ChatMessage = {
      id: aiMessageId,
      text: '',
      sender: 'ai',
      timestamp: new Date(),
      state: 'typing',
    };

    setMessages(prev => [...prev, typingMessage]);

    try {
      // Get AI response
      const response = await chatService.sendMessage(text.trim());

      // If TTS enabled, transition to speaking
      if (isTTSEnabled) {
        setCurrentSpeakingId(aiMessageId);
        setMessages(prev =>
          prev.map(m =>
            m.id === aiMessageId
              ? { ...m, text: response, state: 'speaking' as const }
              : m
          )
        );

        // Play TTS
        if (ttsService.isConfigured()) {
          try {
            await ttsService.speakText(response);
          } catch (e) {
            console.log('TTS error, skipping');
            await sleep(SPEAKING_DURATION);
          }
        } else {
          await sleep(SPEAKING_DURATION);
        }

        setCurrentSpeakingId(null);
      }

      // Complete the message
      setMessages(prev =>
        prev.map(m =>
          m.id === aiMessageId
            ? { ...m, text: response, state: 'complete' as const }
            : m
        )
      );
    } catch (error) {
      console.error('Chat error:', error);

      // Show error message
      setMessages(prev =>
        prev.map(m =>
          m.id === aiMessageId
            ? {
                ...m,
                text: "Oops! I had a bit of a brain freeze there. Could you try again?",
                state: 'complete' as const,
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, isTTSEnabled]);

  const handleStartRecording = useCallback(async () => {
    try {
      await voiceService.startRecording();
      setIsRecording(true);
    } catch (error) {
      console.error('Recording error:', error);
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        text: "I couldn't access the microphone. Please check your permissions and try again.",
        sender: 'ai',
        timestamp: new Date(),
        state: 'complete',
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  }, []);

  const handleStopRecording = useCallback(async () => {
    setIsRecording(false);
    setIsLoading(true);

    try {
      const audioUri = await voiceService.stopRecording();

      if (audioUri) {
        const transcription = await voiceService.transcribeAudio(audioUri);

        if (transcription.trim()) {
          await handleSendMessage(transcription, true);
        } else {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Transcription error:', error);
      setIsLoading(false);

      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        text: "I couldn't understand that recording. Try speaking a bit louder or clearer, or just type your message!",
        sender: 'ai',
        timestamp: new Date(),
        state: 'complete',
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  }, [handleSendMessage]);

  const handleClose = () => {
    ttsService.stop();
    router.back();
  };

  const handleToggleTTS = () => {
    if (isTTSEnabled) {
      ttsService.stop();
    }
    setIsTTSEnabled(!isTTSEnabled);
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <ChatBubble
      message={item}
      isSpeaking={currentSpeakingId === item.id}
      showTimestamp={item.state === 'complete'}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>The Prophit</Text>
          <Text style={styles.headerSubtitle}>
            {isRecording
              ? '🔴 Listening...'
              : currentSpeakingId
              ? '🔊 Speaking...'
              : 'Your financial oracle'}
          </Text>
        </View>

        {/* TTS Toggle */}
        <TTSToggle isEnabled={isTTSEnabled} onToggle={handleToggleTTS} />
      </View>

      {/* Chat Messages */}
      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Chat Input */}
        <ChatInput
          onSendMessage={(text) => handleSendMessage(text, false)}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          isRecording={isRecording}
          isLoading={isLoading}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.probabilityBarBackground,
    backgroundColor: theme.colors.white,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.softWhite,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    fontSize: 18,
    color: theme.colors.textSecondary,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: theme.spacing.sm,
  },
  headerTitle: {
    ...theme.typography.subheader,
    color: theme.colors.deepNavy,
  },
  headerSubtitle: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    paddingVertical: theme.spacing.md,
  },
});
