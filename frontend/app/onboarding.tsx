import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { theme } from '../components/theme';
import { parseFileToTransactions, parsePDFToTransactions } from '../services/backendApi';
import { syncUploadedDataToSupabase, loadTransactionsFromSupabase } from '../services/transactionSyncService';
import { syncAllArenaSpending } from '../services/arenaSyncService';
import { useUserData } from '../contexts/UserDataContext';
import { useArena } from '../contexts/ArenaContext';
import { showAlert, readFileAsString, readFileAsBase64 } from '../utils/crossPlatform';
// Sample transactions for demo mode
const sampleTransactions = require('../assets/sample-transactions.json');

const { width } = Dimensions.get('window');

type DataSourceOption = 'demo' | 'upload';

/**
 * Progress Step Indicator Component
 */
const ProgressIndicator = ({
  currentStep,
  totalSteps,
}: {
  currentStep: number;
  totalSteps: number;
}) => {
  return (
    <View style={progressStyles.container}>
      {Array.from({ length: totalSteps }).map((_, index) => (
        <View
          key={index}
          style={[
            progressStyles.step,
            index < currentStep && progressStyles.stepCompleted,
            index === currentStep && progressStyles.stepActive,
          ]}
        />
      ))}
    </View>
  );
};

const progressStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: theme.spacing.lg,
  },
  step: {
    width: 60,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.lightGray,
  },
  stepCompleted: {
    backgroundColor: theme.colors.hotCoral,
  },
  stepActive: {
    backgroundColor: theme.colors.hotCoral,
  },
});

/**
 * Data Source Option Card
 */
const DataSourceCard = ({
  title,
  description,
  icon,
  isSelected,
  isRecommended,
  onSelect,
}: {
  title: string;
  description: string;
  icon: string;
  isSelected: boolean;
  isRecommended?: boolean;
  onSelect: () => void;
}) => {
  return (
    <TouchableOpacity
      style={[styles.optionCard, isSelected && styles.optionCardSelected]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      {isRecommended && (
        <View style={styles.recommendedBadge}>
          <Text style={styles.recommendedText}>Recommended</Text>
        </View>
      )}
      <View style={[styles.optionIcon, isSelected && styles.optionIconSelected]}>
        <Ionicons
          name={icon as any}
          size={32}
          color={isSelected ? theme.colors.white : theme.colors.hotCoral}
        />
      </View>
      <Text style={styles.optionTitle}>{title}</Text>
      <Text style={styles.optionDescription}>{description}</Text>
      <View style={styles.checkContainer}>
        {isSelected ? (
          <Ionicons name="checkmark-circle" size={28} color={theme.colors.hotCoral} />
        ) : (
          <View style={styles.emptyCheck} />
        )}
      </View>
    </TouchableOpacity>
  );
};

/**
 * Onboarding Screen - Data Source Selection
 */
interface SelectedFile {
  name: string;
  size: number;
  uri: string;
  mimeType?: string;
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { reloadUserData } = useUserData();
  const { user } = useArena();
  const [step, setStep] = useState(0);
  const [selectedSource, setSelectedSource] = useState<DataSourceOption | null>(null);
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('Processing...');

  const totalSteps = 2;
  const isPDF = selectedFile?.name?.toLowerCase().endsWith('.pdf');

  const handleSourceSelect = (source: DataSourceOption) => {
    setSelectedSource(source);
  };

  const handleContinue = async () => {
    if (step === 0 && selectedSource) {
      if (selectedSource === 'demo') {
        // Load sample demo data
        if (!user) {
          showAlert('Error', 'Please log in first');
          return;
        }

        setIsUploading(true);
        setUploadMessage('Loading sample data...');

        try {
          console.log('Sample data object:', JSON.stringify(sampleTransactions).substring(0, 200));
          const transactions = sampleTransactions.transactions;
          if (!transactions || transactions.length === 0) {
            console.error('No transactions in sample data!');
            showAlert('Error', 'Sample data is empty');
            setIsUploading(false);
            return;
          }
          console.log('Loading', transactions.length, 'sample transactions...');

          const syncResult = await syncUploadedDataToSupabase(user.id, transactions);
          console.log(`Synced: ${syncResult.added} new, ${syncResult.skipped} duplicates`);

          await reloadUserData();

          // Sync arena spending
          if (syncResult.added > 0) {
            const allTransactions = await loadTransactionsFromSupabase(user.id);
            await syncAllArenaSpending(user.id, allTransactions);
          }

          router.replace('/(tabs)');
        } catch (error) {
          console.error('Error loading sample data:', error);
          showAlert('Error', 'Failed to load sample data');
        } finally {
          setIsUploading(false);
        }
      } else {
        // Go to upload step
        setStep(1);
      }
    }
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*', // Accept any file type
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setSelectedFile({
          name: file.name,
          size: file.size || 0,
          uri: file.uri,
          mimeType: file.mimeType,
        });
      }
    } catch (error) {
      console.error('File picker error:', error);
      showAlert('Error', 'Failed to select file. Please try again.');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      showAlert('Error', 'Please select a file first');
      return;
    }

    if (!user) {
      showAlert('Error', 'Please log in first');
      return;
    }

    const isPDF = selectedFile.name?.toLowerCase().endsWith('.pdf');
    setIsUploading(true);
    setUploadMessage(isPDF ? 'Analyzing PDF...' : 'Processing...');

    try {
      let transactions: { date: string; description: string; amount: number; category: string }[] = [];

      if (isPDF) {
        // Read PDF as base64 and parse via backend
        const base64 = await readFileAsBase64(selectedFile.uri);
        const base64Content = `data:application/pdf;base64,${base64}`;
        transactions = await parsePDFToTransactions(base64Content, selectedFile.uri);
      } else {
        // Read text files and parse locally
        const fileContent = await readFileAsString(selectedFile.uri);
        transactions = parseFileToTransactions(fileContent);
      }

      if (transactions.length === 0) {
        showAlert(
          'Parsing Failed',
          'Could not extract transactions from your file. Please try a CSV or JSON export from your bank.',
          [{ text: 'OK' }]
        );
        setIsUploading(false);
        return;
      }

      // Sync directly to Supabase
      setUploadMessage('Syncing to cloud...');
      const syncResult = await syncUploadedDataToSupabase(user.id, transactions);
      console.log(`Synced: ${syncResult.added} new, ${syncResult.skipped} duplicates`);

      // Reload user data context
      await reloadUserData();

      // Sync arena spending (in case user joined an arena before uploading)
      if (syncResult.added > 0 && user) {
        console.log('Syncing arena spending after onboarding upload...');
        const allTransactions = await loadTransactionsFromSupabase(user.id);
        await syncAllArenaSpending(user.id, allTransactions);
      }

      // Navigate to app
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Upload error:', error);
      showAlert('Error', 'Failed to process your file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleClose = () => {
    // Skip onboarding and go to app
    router.replace('/(tabs)');
  };

  const handleSkipUpload = () => {
    // User changed mind, skip upload
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        {step > 0 ? (
          <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.deepNavy} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backButton} />
        )}
        <TouchableOpacity style={styles.closeButton} onPress={handleClose} activeOpacity={0.7}>
          <Ionicons name="close" size={24} color={theme.colors.deepNavy} />
        </TouchableOpacity>
      </View>

      {/* Progress */}
      <ProgressIndicator currentStep={step} totalSteps={totalSteps} />

      {step === 0 ? (
        /* Step 1: Choose Data Source */
        <>
          <View style={styles.titleSection}>
            <Text style={styles.title}>Get Started</Text>
            <Text style={styles.subtitle}>
              Choose how you want to use Prophit. You can always change this later.
            </Text>
          </View>

          <View style={styles.optionsContainer}>
            <DataSourceCard
              title="Use Demo Data"
              description="Explore Prophit with realistic sample transactions. Perfect for testing features quickly."
              icon="sparkles-outline"
              isSelected={selectedSource === 'demo'}
              isRecommended={true}
              onSelect={() => handleSourceSelect('demo')}
            />

            <DataSourceCard
              title="Upload Your Data"
              description="Paste your transaction CSV or JSON to get personalized insights from our AI backend."
              icon="cloud-upload-outline"
              isSelected={selectedSource === 'upload'}
              onSelect={() => handleSourceSelect('upload')}
            />
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.continueButton, !selectedSource && styles.buttonDisabled]}
              onPress={handleContinue}
              activeOpacity={0.8}
              disabled={!selectedSource}
            >
              <Text style={styles.continueButtonText}>Continue</Text>
              <Ionicons name="arrow-forward" size={20} color={theme.colors.white} />
            </TouchableOpacity>
          </View>
        </>
      ) : (
        /* Step 2: Upload Data */
        <ScrollView style={styles.uploadContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.titleSection}>
            <Text style={styles.title}>Upload Data</Text>
            <Text style={styles.subtitle}>
              Upload your bank statement or transaction file.
            </Text>
          </View>

          <View style={styles.formatHint}>
            <Ionicons name="information-circle-outline" size={20} color={theme.colors.deepTeal} />
            <Text style={styles.formatHintText}>
              Supported: PDF, CSV, JSON bank statements
            </Text>
          </View>

          {/* File Picker Area */}
          <TouchableOpacity
            style={styles.filePickerArea}
            onPress={handlePickFile}
            activeOpacity={0.7}
          >
            {selectedFile ? (
              <View style={styles.selectedFileContainer}>
                <View style={styles.fileIconContainer}>
                  <Ionicons name="document-text" size={32} color={theme.colors.hotCoral} />
                </View>
                <View style={styles.fileInfoContainer}>
                  <Text style={styles.fileName} numberOfLines={1}>{selectedFile.name}</Text>
                  <Text style={styles.fileSize}>{formatFileSize(selectedFile.size)}</Text>
                </View>
                <TouchableOpacity
                  style={styles.removeFileButton}
                  onPress={() => setSelectedFile(null)}
                >
                  <Ionicons name="close-circle" size={24} color={theme.colors.gray} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.emptyPickerContent}>
                <View style={styles.uploadIconContainer}>
                  <Ionicons name="cloud-upload-outline" size={48} color={theme.colors.hotCoral} />
                </View>
                <Text style={styles.uploadPrompt}>Tap to select a file</Text>
                <Text style={styles.uploadHint}>or drag and drop</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.uploadButtonContainer}>
            <TouchableOpacity
              style={[styles.continueButton, (!selectedFile || isUploading) && styles.buttonDisabled]}
              onPress={handleUpload}
              activeOpacity={0.8}
              disabled={!selectedFile || isUploading}
            >
              {isUploading ? (
                <>
                  <ActivityIndicator color={theme.colors.white} size="small" />
                  <Text style={styles.continueButtonText}>{uploadMessage}</Text>
                </>

              ) : (
                <>
                  <Ionicons name="cloud-upload" size={20} color={theme.colors.white} />
                  <Text style={styles.continueButtonText}>Upload & Continue</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipButton} onPress={handleSkipUpload} activeOpacity={0.7}>
              <Text style={styles.skipButtonText}>Use demo data instead</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.securityNote}>
            <Ionicons name="shield-checkmark-outline" size={20} color={theme.colors.deepTeal} />
            <Text style={styles.securityText}>
              Your data is processed securely and not stored permanently. We use it only to generate your personalized insights.
            </Text>
          </View>
        </ScrollView>
      )}
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
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.cardShadow,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.cardShadow,
  },
  titleSection: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    lineHeight: 24,
  },
  optionsContainer: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.md,
  },
  optionCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    ...theme.cardShadow,
  },
  optionCardSelected: {
    borderColor: theme.colors.hotCoral,
  },
  recommendedBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: theme.colors.hotCoral,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.md,
  },
  recommendedText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.white,
  },
  optionIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 79, 64, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  optionIconSelected: {
    backgroundColor: theme.colors.hotCoral,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.xs,
  },
  optionDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: theme.spacing.md,
  },
  checkContainer: {
    position: 'absolute',
    top: theme.spacing.md,
    left: theme.spacing.md,
  },
  emptyCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: theme.colors.lightGray,
  },
  buttonContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.hotCoral,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    gap: theme.spacing.sm,
    ...theme.cardShadow,
  },
  buttonDisabled: {
    backgroundColor: theme.colors.gray,
    opacity: 0.6,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.white,
  },
  // Upload step styles
  uploadContainer: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
  },
  formatHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(0, 78, 96, 0.08)',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  formatHintText: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.deepTeal,
    lineHeight: 18,
  },
  filePickerArea: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 2,
    borderColor: theme.colors.lightGray,
    borderStyle: 'dashed',
    minHeight: 180,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  emptyPickerContent: {
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  uploadIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 79, 64, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  uploadPrompt: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.xs,
  },
  uploadHint: {
    fontSize: 14,
    color: theme.colors.gray,
  },
  selectedFileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.lg,
    width: '100%',
  },
  fileIconContainer: {
    width: 56,
    height: 56,
    borderRadius: theme.borderRadius.md,
    backgroundColor: 'rgba(255, 79, 64, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  fileInfoContainer: {
    flex: 1,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.deepNavy,
    marginBottom: 4,
  },
  fileSize: {
    fontSize: 14,
    color: theme.colors.gray,
  },
  removeFileButton: {
    padding: theme.spacing.sm,
  },
  uploadButtonContainer: {
    marginTop: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  skipButtonText: {
    fontSize: 14,
    color: theme.colors.gray,
    textDecorationLine: 'underline',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  securityText: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
});
