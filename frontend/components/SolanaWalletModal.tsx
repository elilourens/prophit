import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from './theme';
import { useSolana } from '../contexts/SolanaContext';

interface SolanaWalletModalProps {
  visible: boolean;
  onClose: () => void;
  onConnect: () => void;
}

type WalletStep = 'initializing' | 'ready' | 'airdropping' | 'success' | 'error';

export const SolanaWalletModal: React.FC<SolanaWalletModalProps> = ({
  visible,
  onClose,
  onConnect,
}) => {
  const { wallet, isLoading, isInitialized, error, requestAirdrop, getExplorerAddressUrl } = useSolana();
  const [step, setStep] = useState<WalletStep>('initializing');
  const [airdropError, setAirdropError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      if (isLoading) {
        setStep('initializing');
      } else if (wallet && wallet.balance >= 0.1) {
        setStep('ready');
      } else if (wallet && wallet.balance < 0.1) {
        setStep('ready');
      } else if (error) {
        setStep('error');
      }
    }
  }, [visible, isLoading, wallet, error]);

  const handleAirdrop = async () => {
    setStep('airdropping');
    setAirdropError(null);

    const result = await requestAirdrop();

    if (result.success) {
      setStep('success');
      setTimeout(() => {
        handleConnect();
      }, 1500);
    } else {
      setAirdropError(result.error || 'Airdrop failed');
      setStep('ready');
    }
  };

  const handleConnect = () => {
    onConnect();
    onClose();
  };

  const handleClose = () => {
    setStep('initializing');
    setAirdropError(null);
    onClose();
  };

  const renderInitializing = () => (
    <View style={styles.loadingContainer}>
      <View style={styles.loadingIcon}>
        <Text style={styles.loadingIconText}>{'\u25C8'}</Text>
      </View>
      <Text style={styles.loadingTitle}>Initializing Wallet</Text>
      <ActivityIndicator size="large" color="#9945FF" />
      <Text style={styles.loadingSubtitle}>
        Setting up your devnet wallet...
      </Text>
    </View>
  );

  const renderReady = () => (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>Solana Wallet</Text>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={theme.colors.deepNavy} />
        </TouchableOpacity>
      </View>

      <View style={styles.walletCard}>
        <View style={styles.walletIconLarge}>
          <Text style={styles.walletIconText}>{'\u25C8'}</Text>
        </View>
        <Text style={styles.walletLabel}>Devnet Wallet</Text>

        {wallet && (
          <>
            <View style={styles.addressContainer}>
              <Text style={styles.addressLabel}>Address</Text>
              <TouchableOpacity
                onPress={() => wallet && Linking.openURL(getExplorerAddressUrl(wallet.publicKey))}
              >
                <Text style={styles.addressValue}>
                  {wallet.publicKey.slice(0, 12)}...{wallet.publicKey.slice(-12)}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.balanceContainer}>
              <Text style={styles.balanceLabel}>Balance</Text>
              <Text style={styles.balanceValue}>{wallet.balance.toFixed(6)} SOL</Text>
            </View>
          </>
        )}

        {wallet?.isNew && (
          <View style={styles.newWalletBadge}>
            <Ionicons name="sparkles" size={14} color="#9945FF" />
            <Text style={styles.newWalletText}>New Wallet Created</Text>
          </View>
        )}
      </View>

      {airdropError && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={16} color={theme.colors.hotCoral} />
          <Text style={styles.errorText}>{airdropError}</Text>
        </View>
      )}

      {/* Always show airdrop button */}
      <TouchableOpacity style={styles.airdropButton} onPress={handleAirdrop}>
        <Ionicons name="water" size={20} color={theme.colors.white} />
        <Text style={styles.airdropButtonText}>Get 0.15 SOL (Free)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.connectButton} onPress={handleConnect}>
        <Text style={styles.connectButtonText}>Continue</Text>
      </TouchableOpacity>

      <Text style={styles.disclaimer}>
        This wallet uses Solana Devnet. No real funds are involved.
      </Text>
    </>
  );

  const renderAirdropping = () => (
    <View style={styles.loadingContainer}>
      <View style={styles.loadingIcon}>
        <Ionicons name="water" size={40} color="#9945FF" />
      </View>
      <Text style={styles.loadingTitle}>Requesting Airdrop</Text>
      <ActivityIndicator size="large" color="#9945FF" />
      <Text style={styles.loadingSubtitle}>
        Getting devnet SOL from the faucet...
      </Text>
    </View>
  );

  const renderSuccess = () => (
    <View style={styles.loadingContainer}>
      <View style={styles.successIcon}>
        <Ionicons name="checkmark" size={48} color="#2E7D32" />
      </View>
      <Text style={styles.successTitle}>Wallet Ready!</Text>
      <Text style={styles.successBalance}>
        Balance: {wallet?.balance.toFixed(6)} SOL
      </Text>
    </View>
  );

  const renderError = () => (
    <View style={styles.loadingContainer}>
      <View style={styles.errorIcon}>
        <Ionicons name="alert-circle" size={48} color={theme.colors.hotCoral} />
      </View>
      <Text style={styles.errorTitle}>Connection Error</Text>
      <Text style={styles.errorMessage}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={handleClose}>
        <Text style={styles.retryButtonText}>Close</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {step === 'initializing' && renderInitializing()}
          {step === 'ready' && renderReady()}
          {step === 'airdropping' && renderAirdropping()}
          {step === 'success' && renderSuccess()}
          {step === 'error' && renderError()}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    minHeight: 400,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.deepNavy,
  },
  closeButton: {
    padding: theme.spacing.sm,
  },
  // Wallet Card
  walletCard: {
    backgroundColor: '#9945FF10',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: '#9945FF30',
  },
  walletIconLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#9945FF20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  walletIconText: {
    fontSize: 32,
    color: '#9945FF',
  },
  walletLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#9945FF',
    marginBottom: theme.spacing.md,
  },
  addressContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    width: '100%',
  },
  addressLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  addressValue: {
    fontSize: 13,
    fontFamily: 'monospace',
    color: theme.colors.deepTeal,
    textDecorationLine: 'underline',
  },
  balanceContainer: {
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    width: '100%',
  },
  balanceLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#9945FF',
  },
  newWalletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#9945FF20',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    marginTop: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  newWalletText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9945FF',
  },
  // Buttons
  airdropButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9945FF',
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  airdropButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.white,
  },
  connectButton: {
    backgroundColor: theme.colors.hotCoral,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  connectButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.white,
  },
  disclaimer: {
    fontSize: 12,
    color: theme.colors.gray,
    textAlign: 'center',
  },
  // Loading States
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  loadingIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#9945FF20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  loadingIconText: {
    fontSize: 40,
    color: '#9945FF',
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.deepNavy,
    marginBottom: theme.spacing.lg,
  },
  loadingSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.lg,
    textAlign: 'center',
  },
  // Success
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2E7D3220',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2E7D32',
    marginBottom: theme.spacing.sm,
  },
  successBalance: {
    fontSize: 16,
    color: theme.colors.deepNavy,
  },
  // Error
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.hotCoral + '20',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  errorText: {
    fontSize: 14,
    color: theme.colors.hotCoral,
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.hotCoral + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.hotCoral,
    marginBottom: theme.spacing.sm,
  },
  errorMessage: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  retryButton: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.deepTeal,
  },
});
