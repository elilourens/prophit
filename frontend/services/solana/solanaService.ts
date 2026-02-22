// Crypto polyfill - MUST be before @solana/web3.js
import 'react-native-get-random-values';

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer';
import { PROGRAM_ID } from './idl';

// Polyfill Buffer for React Native
global.Buffer = global.Buffer || Buffer;

// Constants
const DEVNET_URL = 'https://api.devnet.solana.com';
const WALLET_STORAGE_KEY = '@prophit_solana_wallet';
const AIRDROP_AMOUNT = 2 * LAMPORTS_PER_SOL; // 2 SOL for testing
const NEW_USER_AIRDROP = 150000000; // 0.15 SOL in lamports (150,000,000 lamports)

// Faucet wallet with 5 SOL (funds new users)
// Public key: 555qw2ptWiijsYw1ZnD7Ryk5wo1QasVTcM2eUYK3fgJs
const FAUCET_WALLET_SECRET = new Uint8Array([12,14,45,250,23,243,134,77,62,202,242,165,235,73,18,50,47,33,251,213,3,159,111,25,104,201,82,136,255,13,212,75,60,122,140,52,56,153,43,182,23,30,196,69,205,110,215,6,125,2,14,82,152,100,163,157,79,214,42,200,135,99,10,24]);

// Explorer URLs
export const getExplorerUrl = (signature: string, type: 'tx' | 'address' = 'tx') => {
  return `https://explorer.solana.com/${type}/${signature}?cluster=devnet`;
};

export const getExplorerAddressUrl = (address: string) => {
  return `https://explorer.solana.com/address/${address}?cluster=devnet`;
};

// Wallet interface
export interface SolanaWallet {
  publicKey: string;
  secretKey: string; // Base64 encoded
  balance: number;
  isNew: boolean;
}

// Arena escrow account data
export interface ArenaEscrowData {
  arenaId: string;
  creator: string;
  stakeAmount: number;
  maxPlayers: number;
  playerCount: number;
  status: 'Active' | 'Completed';
  players: string[];
  winner: string | null;
  escrowBalance: number;
  pdaAddress: string;
}

// Transaction result
export interface TransactionResult {
  success: boolean;
  signature?: string;
  explorerUrl?: string;
  error?: string;
}

class SolanaService {
  private connection: Connection;
  private wallet: Keypair | null = null;
  private faucetWallet: Keypair;
  private programId: PublicKey;

  constructor() {
    this.connection = new Connection(DEVNET_URL, 'confirmed');
    this.programId = new PublicKey(PROGRAM_ID);
    // Initialize faucet wallet
    this.faucetWallet = Keypair.fromSecretKey(FAUCET_WALLET_SECRET);
  }

  // Fund a new wallet from the faucet (0.15 SOL)
  private async fundFromFaucet(newWalletPubkey: PublicKey): Promise<TransactionResult> {
    try {
      console.log('Funding new wallet from faucet...');
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.faucetWallet.publicKey,
          toPubkey: newWalletPubkey,
          lamports: NEW_USER_AIRDROP,
        })
      );

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.faucetWallet]
      );

      console.log('Funded new wallet:', signature);
      return {
        success: true,
        signature: signature,
        explorerUrl: getExplorerUrl(signature),
      };
    } catch (error: any) {
      console.error('Faucet funding error:', error);
      return {
        success: false,
        error: error.message || 'Failed to fund wallet',
      };
    }
  }

  // Initialize wallet - load from storage or create new
  async initializeWallet(): Promise<SolanaWallet> {
    try {
      // Try to load existing wallet
      const stored = await AsyncStorage.getItem(WALLET_STORAGE_KEY);

      if (stored) {
        const { secretKey } = JSON.parse(stored);
        const secretKeyArray = Uint8Array.from(Buffer.from(secretKey, 'base64'));
        this.wallet = Keypair.fromSecretKey(secretKeyArray);

        const balance = await this.getBalance();

        return {
          publicKey: this.wallet.publicKey.toString(),
          secretKey: secretKey,
          balance: balance,
          isNew: false,
        };
      }

      // Create new wallet
      this.wallet = Keypair.generate();
      const secretKeyBase64 = Buffer.from(this.wallet.secretKey).toString('base64');

      // Store wallet
      await AsyncStorage.setItem(
        WALLET_STORAGE_KEY,
        JSON.stringify({ secretKey: secretKeyBase64 })
      );

      // Fund new wallet from our faucet (0.15 SOL)
      await this.fundFromFaucet(this.wallet.publicKey);
      const balance = await this.getBalance();

      return {
        publicKey: this.wallet.publicKey.toString(),
        secretKey: secretKeyBase64,
        balance: balance,
        isNew: true,
      };
    } catch (error) {
      console.error('Error initializing wallet:', error);
      throw error;
    }
  }

  // Get wallet public key
  getPublicKey(): string | null {
    return this.wallet?.publicKey.toString() || null;
  }

  // Get SOL balance
  async getBalance(): Promise<number> {
    if (!this.wallet) return 0;
    try {
      const balance = await this.connection.getBalance(this.wallet.publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error('Error getting balance:', error);
      return 0;
    }
  }

  // Request airdrop - uses our faucet wallet instead of rate-limited public faucet
  async requestAirdrop(): Promise<TransactionResult> {
    if (!this.wallet) {
      return { success: false, error: 'Wallet not initialized' };
    }

    try {
      console.log('Requesting airdrop from Prophit faucet...');

      // Use our faucet wallet to send 0.1 SOL
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.faucetWallet.publicKey,
          toPubkey: this.wallet.publicKey,
          lamports: NEW_USER_AIRDROP,
        })
      );

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.faucetWallet]
      );

      console.log('Airdrop confirmed:', signature);

      return {
        success: true,
        signature: signature,
        explorerUrl: getExplorerUrl(signature),
      };
    } catch (error: any) {
      console.error('Airdrop error:', error);
      return {
        success: false,
        error: error.message || 'Airdrop failed',
      };
    }
  }

  // Get Arena PDA address
  getArenaPda(arenaId: string): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('arena'), Buffer.from(arenaId)],
      this.programId
    );
  }

  // Create arena with stake (simplified for hackathon - transfer to faucet as escrow)
  async createArenaEscrow(
    arenaId: string,
    stakeAmountSol: number,
    maxPlayers: number
  ): Promise<TransactionResult> {
    if (!this.wallet) {
      return { success: false, error: 'Wallet not initialized' };
    }

    try {
      const stakeAmountLamports = Math.floor(stakeAmountSol * LAMPORTS_PER_SOL);

      // For hackathon demo: Transfer stake to faucet wallet (acts as escrow)
      // The faucet wallet will pay out the winner later
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.wallet.publicKey,
          toPubkey: this.faucetWallet.publicKey,
          lamports: stakeAmountLamports,
        })
      );

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.wallet]
      );

      console.log('Arena escrow created (stake sent to escrow):', signature);

      return {
        success: true,
        signature: signature,
        explorerUrl: getExplorerUrl(signature),
      };
    } catch (error: any) {
      console.error('Create arena error:', error);
      return {
        success: false,
        error: error.message || 'Failed to create arena escrow',
      };
    }
  }

  // Join arena with stake (transfer to faucet wallet as escrow)
  async joinArenaEscrow(arenaId: string, stakeAmountSol: number): Promise<TransactionResult> {
    if (!this.wallet) {
      return { success: false, error: 'Wallet not initialized' };
    }

    try {
      const stakeAmountLamports = Math.floor(stakeAmountSol * LAMPORTS_PER_SOL);

      // For hackathon demo: Transfer stake to faucet wallet (acts as escrow)
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.wallet.publicKey,
          toPubkey: this.faucetWallet.publicKey,
          lamports: stakeAmountLamports,
        })
      );

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.wallet]
      );

      console.log('Joined arena escrow (stake sent to escrow):', signature);

      return {
        success: true,
        signature: signature,
        explorerUrl: getExplorerUrl(signature),
      };
    } catch (error: any) {
      console.error('Join arena error:', error);
      return {
        success: false,
        error: error.message || 'Failed to join arena',
      };
    }
  }

  // Get escrow balance for arena
  async getEscrowBalance(arenaId: string): Promise<number> {
    try {
      const [arenaPda] = this.getArenaPda(arenaId);
      const balance = await this.connection.getBalance(arenaPda);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error('Error getting escrow balance:', error);
      return 0;
    }
  }

  // Get escrow info
  async getEscrowInfo(arenaId: string): Promise<{
    pdaAddress: string;
    balance: number;
    explorerUrl: string;
  }> {
    const [arenaPda] = this.getArenaPda(arenaId);
    const balance = await this.getEscrowBalance(arenaId);

    return {
      pdaAddress: arenaPda.toString(),
      balance: balance,
      explorerUrl: getExplorerAddressUrl(arenaPda.toString()),
    };
  }

  // Resolve arena and pay winner (for hackathon, simplified transfer)
  async resolveArenaEscrow(
    arenaId: string,
    winnerAddress: string
  ): Promise<TransactionResult> {
    if (!this.wallet) {
      return { success: false, error: 'Wallet not initialized' };
    }

    try {
      // Note: In production, this would be done by the on-chain program
      // For hackathon demo, we simulate the payout

      // For a real implementation, the program would:
      // 1. Verify caller is the creator
      // 2. Verify winner is a participant
      // 3. Transfer funds from PDA to winner
      // 4. Mark arena as completed

      console.log(`Resolving arena ${arenaId} - Winner: ${winnerAddress}`);

      // Since we can't sign for the PDA without the program,
      // we return success for demo purposes
      return {
        success: true,
        signature: 'demo-resolve-' + Date.now(),
        explorerUrl: getExplorerAddressUrl(winnerAddress),
      };
    } catch (error: any) {
      console.error('Resolve arena error:', error);
      return {
        success: false,
        error: error.message || 'Failed to resolve arena',
      };
    }
  }

  /**
   * Resolve arena escrow with real SOL payout to winner
   * Uses faucet wallet to pay the winner (hackathon solution - no on-chain program needed)
   */
  async resolveArenaEscrowWithPayout(
    arenaId: string,
    winnerAddress: string,
    prizeAmountSol: number
  ): Promise<TransactionResult> {
    try {
      console.log(`Paying out ${prizeAmountSol} SOL to winner ${winnerAddress}`);

      const winnerPubkey = new PublicKey(winnerAddress);
      const prizeAmountLamports = Math.floor(prizeAmountSol * LAMPORTS_PER_SOL);

      // Check faucet wallet balance
      const faucetBalance = await this.connection.getBalance(this.faucetWallet.publicKey);
      if (faucetBalance < prizeAmountLamports) {
        console.error('Faucet wallet has insufficient funds');
        return {
          success: false,
          error: 'Insufficient funds in prize pool',
        };
      }

      // Create and send the transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.faucetWallet.publicKey,
          toPubkey: winnerPubkey,
          lamports: prizeAmountLamports,
        })
      );

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.faucetWallet]
      );

      console.log('Prize payout confirmed:', signature);

      return {
        success: true,
        signature: signature,
        explorerUrl: getExplorerUrl(signature),
      };
    } catch (error: any) {
      console.error('Prize payout error:', error);
      return {
        success: false,
        error: error.message || 'Failed to pay out prize',
      };
    }
  }

  // Simple SOL transfer
  async transferSol(toAddress: string, amountSol: number): Promise<TransactionResult> {
    if (!this.wallet) {
      return { success: false, error: 'Wallet not initialized' };
    }

    try {
      const toPubkey = new PublicKey(toAddress);
      const lamports = amountSol * LAMPORTS_PER_SOL;

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.wallet.publicKey,
          toPubkey: toPubkey,
          lamports: lamports,
        })
      );

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.wallet]
      );

      return {
        success: true,
        signature: signature,
        explorerUrl: getExplorerUrl(signature),
      };
    } catch (error: any) {
      console.error('Transfer error:', error);
      return {
        success: false,
        error: error.message || 'Transfer failed',
      };
    }
  }

  // Export wallet (for backup)
  async exportWallet(): Promise<string | null> {
    try {
      const stored = await AsyncStorage.getItem(WALLET_STORAGE_KEY);
      return stored;
    } catch (error) {
      console.error('Error exporting wallet:', error);
      return null;
    }
  }

  // Import wallet
  async importWallet(secretKeyBase64: string): Promise<SolanaWallet> {
    try {
      const secretKeyArray = Uint8Array.from(Buffer.from(secretKeyBase64, 'base64'));
      this.wallet = Keypair.fromSecretKey(secretKeyArray);

      await AsyncStorage.setItem(
        WALLET_STORAGE_KEY,
        JSON.stringify({ secretKey: secretKeyBase64 })
      );

      const balance = await this.getBalance();

      return {
        publicKey: this.wallet.publicKey.toString(),
        secretKey: secretKeyBase64,
        balance: balance,
        isNew: false,
      };
    } catch (error) {
      console.error('Error importing wallet:', error);
      throw error;
    }
  }

  // Clear wallet from storage
  async clearWallet(): Promise<void> {
    this.wallet = null;
    await AsyncStorage.removeItem(WALLET_STORAGE_KEY);
  }
}

// Export singleton instance
export const solanaService = new SolanaService();
export default solanaService;
