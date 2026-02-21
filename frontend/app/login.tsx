import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../components/theme';
import { useArena } from '../contexts/ArenaContext';

const AVATARS = [
  { id: '1', emoji: '😎', color: '#FF4F40' },
  { id: '2', emoji: '🤩', color: '#004E60' },
  { id: '3', emoji: '👻', color: '#C3FF34' },
  { id: '4', emoji: '🤖', color: '#FE8B18' },
  { id: '5', emoji: '🦊', color: '#FF4F40' },
  { id: '6', emoji: '🦁', color: '#004E60' },
  { id: '7', emoji: '🐲', color: '#C3FF34' },
  { id: '8', emoji: '🧙', color: '#FE8B18' },
];

export default function ArenaOnboardingScreen() {
  const { signUp, signIn, isLoading } = useArena();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async () => {
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Email and password are required');
      return;
    }

    if (mode === 'signup' && username.trim().length < 2) {
      setError('Username must be at least 2 characters');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      if (mode === 'signup') {
        await signUp(email.trim(), password, username.trim(), selectedAvatar.emoji);
      } else {
        await signIn(email.trim(), password);
      }
      router.replace('/(tabs)');
    } catch (err: any) {
      console.error('Auth error:', err);
      if (err.message?.includes('User already registered')) {
        setError('Email already registered. Try signing in!');
      } else if (err.message?.includes('Invalid login')) {
        setError('Invalid email or password');
      } else if (err.message?.includes('duplicate')) {
        setError('Username already taken. Try another!');
      } else {
        setError(err.message || 'Something went wrong. Try again!');
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.emoji}>💰</Text>
            <Text style={styles.title}>Prophit</Text>
            <Text style={styles.subtitle}>
              {mode === 'signin'
                ? 'Sign in to track your spending'
                : 'Create your account'}
            </Text>
          </View>

          {/* Mode Toggle */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'signin' && styles.modeButtonActive]}
              onPress={() => { setMode('signin'); setError(''); }}
            >
              <Text style={[styles.modeButtonText, mode === 'signin' && styles.modeButtonTextActive]}>
                Sign In
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'signup' && styles.modeButtonActive]}
              onPress={() => { setMode('signup'); setError(''); }}
            >
              <Text style={[styles.modeButtonText, mode === 'signup' && styles.modeButtonTextActive]}>
                Sign Up
              </Text>
            </TouchableOpacity>
          </View>

          {/* Email Input */}
          <View style={styles.inputSection}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color={theme.colors.gray} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor={theme.colors.gray}
                value={email}
                onChangeText={(text) => { setEmail(text); setError(''); }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputSection}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={theme.colors.gray} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={theme.colors.gray}
                value={password}
                onChangeText={(text) => { setPassword(text); setError(''); }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={theme.colors.gray}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Sign Up Only Fields */}
          {mode === 'signup' && (
            <>
              {/* Username Input */}
              <View style={styles.inputSection}>
                <Text style={styles.label}>Display Name</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="person-outline" size={20} color={theme.colors.gray} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Your display name"
                    placeholderTextColor={theme.colors.gray}
                    value={username}
                    onChangeText={(text) => { setUsername(text); setError(''); }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={20}
                  />
                </View>
              </View>

              {/* Avatar Picker */}
              <View style={styles.avatarSection}>
                <Text style={styles.label}>Choose Your Avatar</Text>
                <View style={styles.avatarGrid}>
                  {AVATARS.map((avatar) => (
                    <TouchableOpacity
                      key={avatar.id}
                      style={[
                        styles.avatarItem,
                        selectedAvatar.id === avatar.id && styles.avatarSelected,
                        { backgroundColor: avatar.color + '20' },
                      ]}
                      onPress={() => setSelectedAvatar(avatar)}
                    >
                      <Text style={styles.avatarEmoji}>{avatar.emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}

          {/* Error */}
          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={16} color={theme.colors.hotCoral} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={theme.colors.white} />
            ) : (
              <Text style={styles.submitButtonText}>
                {mode === 'signin' ? 'Sign In' : 'Create Account'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Switch Mode Link */}
          <TouchableOpacity
            style={styles.switchMode}
            onPress={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}
          >
            <Text style={styles.switchModeText}>
              {mode === 'signin'
                ? "Don't have an account? Sign Up"
                : "Already have an account? Sign In"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
  },
  emoji: {
    fontSize: 64,
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: theme.colors.lightGray,
    borderRadius: theme.borderRadius.md,
    padding: 4,
    marginBottom: theme.spacing.xl,
  },
  modeButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    borderRadius: theme.borderRadius.sm,
  },
  modeButtonActive: {
    backgroundColor: theme.colors.white,
    ...theme.cardShadow,
  },
  modeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  modeButtonTextActive: {
    color: theme.colors.deepNavy,
  },
  inputSection: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    ...theme.cardShadow,
  },
  inputIcon: {
    marginLeft: theme.spacing.md,
  },
  input: {
    flex: 1,
    padding: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.deepNavy,
  },
  eyeButton: {
    padding: theme.spacing.md,
  },
  avatarSection: {
    marginBottom: theme.spacing.lg,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  avatarItem: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  avatarSelected: {
    borderColor: theme.colors.hotCoral,
  },
  avatarEmoji: {
    fontSize: 32,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.hotCoral + '15',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  errorText: {
    flex: 1,
    color: theme.colors.hotCoral,
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: theme.colors.hotCoral,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  submitButtonDisabled: {
    backgroundColor: theme.colors.gray,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.white,
  },
  switchMode: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  switchModeText: {
    fontSize: 14,
    color: theme.colors.deepTeal,
    fontWeight: '600',
  },
});
