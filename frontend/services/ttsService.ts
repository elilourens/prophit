import { Audio } from 'expo-av';
import Constants from 'expo-constants';

// ElevenLabs API configuration
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

// Default voice ID - "Rachel" (warm, friendly voice good for briefings)
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

// Model options for free tier: eleven_turbo_v2_5, eleven_flash_v2_5
// The old eleven_monolingual_v1 and eleven_multilingual_v1 are deprecated for free tier
const DEFAULT_MODEL_ID = 'eleven_turbo_v2_5';

interface TTSOptions {
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
}

interface TTSResult {
  sound: Audio.Sound;
  duration?: number;
}

class TTSService {
  private apiKey: string | null = null;
  private currentSound: Audio.Sound | null = null;

  constructor() {
    // API key is resolved lazily in getApiKey() since env vars
    // may not be available at import/construction time
  }

  /**
   * Get the API key, resolving lazily from environment if needed
   */
  private getApiKey(): string | null {
    if (!this.apiKey) {
      this.apiKey = Constants.expoConfig?.extra?.ELEVENLABS_API_KEY ||
        process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY ||
        null;
    }
    return this.apiKey;
  }

  /**
   * Set the API key manually (useful for runtime configuration)
   */
  setApiKey(key: string): void {
    this.apiKey = key;
  }

  /**
   * Check if the service is configured with an API key
   */
  isConfigured(): boolean {
    return !!this.getApiKey();
  }

  /**
   * Generate speech from text using ElevenLabs API
   */
  async generateSpeech(text: string, options: TTSOptions = {}): Promise<TTSResult> {
    const key = this.getApiKey();
    if (!key) {
      throw new Error('ElevenLabs API key not configured. Set EXPO_PUBLIC_ELEVENLABS_API_KEY in your .env file.');
    }

    const {
      voiceId = DEFAULT_VOICE_ID,
      modelId = DEFAULT_MODEL_ID,
      stability = 0.5,
      similarityBoost = 0.75,
    } = options;

    const url = `${ELEVENLABS_API_URL}/${voiceId}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': key,
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: {
            stability,
            similarity_boost: similarityBoost,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      // Get audio data as blob
      const audioBlob = await response.blob();

      // Convert blob to base64 data URI
      const base64Audio = await this.blobToBase64(audioBlob);

      // Create and load the sound
      const { sound } = await Audio.Sound.createAsync(
        { uri: base64Audio },
        { shouldPlay: false }
      );

      return { sound };
    } catch (error) {
      console.error('TTS generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate speech and play it immediately
   */
  async speakText(text: string, options: TTSOptions = {}): Promise<void> {
    // Stop any currently playing audio
    await this.stop();

    // Configure audio mode for playback
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });

    const { sound } = await this.generateSpeech(text, options);
    this.currentSound = sound;

    // Set up playback status listener for cleanup
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        this.cleanup(sound);
      }
    });

    // Play the audio
    await sound.playAsync();
  }

  /**
   * Stop current playback
   */
  async stop(): Promise<void> {
    if (this.currentSound) {
      try {
        await this.currentSound.stopAsync();
        await this.currentSound.unloadAsync();
      } catch (e) {
        // Sound might already be unloaded
      }
      this.currentSound = null;
    }
  }

  /**
   * Pause current playback
   */
  async pause(): Promise<void> {
    if (this.currentSound) {
      await this.currentSound.pauseAsync();
    }
  }

  /**
   * Resume paused playback
   */
  async resume(): Promise<void> {
    if (this.currentSound) {
      await this.currentSound.playAsync();
    }
  }

  /**
   * Check if audio is currently playing
   */
  async isPlaying(): Promise<boolean> {
    if (!this.currentSound) return false;

    const status = await this.currentSound.getStatusAsync();
    return status.isLoaded && status.isPlaying;
  }

  /**
   * Generate a morning briefing text from the briefing data
   */
  generateBriefingText(data: {
    userName: string;
    temperature: number;
    location: string;
    topPrediction: { title: string; probability: number };
    nudge: string;
  }): string {
    const hour = new Date().getHours();
    let greeting = 'Good morning';
    if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
    if (hour >= 17) greeting = 'Good evening';

    // Handle case when there's no transaction data
    const hasData = data.topPrediction.probability > 0 &&
      !data.topPrediction.title.toLowerCase().includes('no data') &&
      !data.topPrediction.title.toLowerCase().includes('loading');

    if (!hasData) {
      return `${greeting}, ${data.userName}! ` +
        `It's currently ${data.temperature} degrees in ${data.location}. ` +
        `I don't have any transaction data yet to make predictions. ` +
        `Upload your bank statement to get personalized spending forecasts. ` +
        `Have a great day!`;
    }

    return `${greeting}, ${data.userName}! ` +
      `It's currently ${data.temperature} degrees in ${data.location}. ` +
      `Your top prediction for today: there's a ${data.topPrediction.probability} percent chance of ${data.topPrediction.title.toLowerCase()}. ` +
      `Quick tip: ${data.nudge}. ` +
      `Have a great day!`;
  }

  /**
   * Convert blob to base64 data URI
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Cleanup sound resources
   */
  private async cleanup(sound: Audio.Sound): Promise<void> {
    try {
      await sound.unloadAsync();
      if (this.currentSound === sound) {
        this.currentSound = null;
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

// Export singleton instance
export const ttsService = new TTSService();
export default ttsService;
