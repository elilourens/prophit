import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  solanaService,
  SolanaWallet,
  TransactionResult,
  getExplorerUrl,
  getExplorerAddressUrl,
} from '../services/solana';

interface SolanaContextType {
  // Wallet state
  wallet: SolanaWallet | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Wallet methods
  initializeWallet: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  requestAirdrop: () => Promise<TransactionResult>;

  // Escrow methods
  createArenaEscrow: (arenaId: string, stakeAmount: number, maxPlayers: number) => Promise<TransactionResult>;
  joinArenaEscrow: (arenaId: string, stakeAmount: number) => Promise<TransactionResult>;
  resolveArenaEscrow: (arenaId: string, winnerAddress: string) => Promise<TransactionResult>;
  resolveArenaEscrowWithPayout: (arenaId: string, winnerAddress: string, prizeAmount: number) => Promise<TransactionResult>;
  getEscrowInfo: (arenaId: string) => Promise<{ pdaAddress: string; balance: number; explorerUrl: string }>;

  // Utility
  getExplorerUrl: typeof getExplorerUrl;
  getExplorerAddressUrl: typeof getExplorerAddressUrl;
}

const SolanaContext = createContext<SolanaContextType | undefined>(undefined);

export const useSolana = () => {
  const context = useContext(SolanaContext);
  if (!context) {
    throw new Error('useSolana must be used within a SolanaProvider');
  }
  return context;
};

interface SolanaProviderProps {
  children: ReactNode;
}

export const SolanaProvider: React.FC<SolanaProviderProps> = ({ children }) => {
  const [wallet, setWallet] = useState<SolanaWallet | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize wallet on mount
  useEffect(() => {
    initializeWallet();
  }, []);

  const initializeWallet = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const walletData = await solanaService.initializeWallet();
      setWallet(walletData);
      setIsInitialized(true);

      if (walletData.isNew) {
        console.log('New wallet created and airdropped!');
      }
    } catch (err: any) {
      console.error('Failed to initialize wallet:', err);
      setError(err.message || 'Failed to initialize wallet');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshBalance = async () => {
    if (!wallet) return;

    try {
      const balance = await solanaService.getBalance();
      setWallet({ ...wallet, balance });
    } catch (err: any) {
      console.error('Failed to refresh balance:', err);
    }
  };

  const requestAirdrop = async (): Promise<TransactionResult> => {
    setIsLoading(true);
    try {
      const result = await solanaService.requestAirdrop();
      if (result.success) {
        await refreshBalance();
      }
      return result;
    } finally {
      setIsLoading(false);
    }
  };

  const createArenaEscrow = async (
    arenaId: string,
    stakeAmount: number,
    maxPlayers: number
  ): Promise<TransactionResult> => {
    setIsLoading(true);
    try {
      const result = await solanaService.createArenaEscrow(arenaId, stakeAmount, maxPlayers);
      if (result.success) {
        await refreshBalance();
      }
      return result;
    } finally {
      setIsLoading(false);
    }
  };

  const joinArenaEscrow = async (
    arenaId: string,
    stakeAmount: number
  ): Promise<TransactionResult> => {
    setIsLoading(true);
    try {
      const result = await solanaService.joinArenaEscrow(arenaId, stakeAmount);
      if (result.success) {
        await refreshBalance();
      }
      return result;
    } finally {
      setIsLoading(false);
    }
  };

  const resolveArenaEscrow = async (
    arenaId: string,
    winnerAddress: string
  ): Promise<TransactionResult> => {
    setIsLoading(true);
    try {
      const result = await solanaService.resolveArenaEscrow(arenaId, winnerAddress);
      return result;
    } finally {
      setIsLoading(false);
    }
  };

  const resolveArenaEscrowWithPayout = async (
    arenaId: string,
    winnerAddress: string,
    prizeAmount: number
  ): Promise<TransactionResult> => {
    setIsLoading(true);
    try {
      const result = await solanaService.resolveArenaEscrowWithPayout(arenaId, winnerAddress, prizeAmount);
      if (result.success) {
        await refreshBalance();
      }
      return result;
    } finally {
      setIsLoading(false);
    }
  };

  const getEscrowInfo = async (arenaId: string) => {
    return solanaService.getEscrowInfo(arenaId);
  };

  return (
    <SolanaContext.Provider
      value={{
        wallet,
        isLoading,
        isInitialized,
        error,
        initializeWallet,
        refreshBalance,
        requestAirdrop,
        createArenaEscrow,
        joinArenaEscrow,
        resolveArenaEscrow,
        resolveArenaEscrowWithPayout,
        getEscrowInfo,
        getExplorerUrl,
        getExplorerAddressUrl,
      }}
    >
      {children}
    </SolanaContext.Provider>
  );
};
