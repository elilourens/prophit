import { Audio } from 'expo-av';
import Constants from 'expo-constants';

// Groq Whisper API for speech-to-text
const GROQ_WHISPER_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

class VoiceService {
  private recording: Audio.Recording | null = null;
  private apiKey: string | null = null;

  constructor() {
    this.apiKey = Constants.expoConfig?.extra?.GROQ_API_KEY ||
                  process.env.EXPO_PUBLIC_GROQ_API_KEY ||
                  null;
  }

  /**
   * Set the API key
   */
  setApiKey(key: string): void {
    this.apiKey = key;
  }

  /**
   * Check if voice service is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Request microphone permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting audio permissions:', error);
      return false;
    }
  }

  /**
   * Start recording audio
   */
  async startRecording(): Promise<void> {
    try {
      // Request permissions if needed
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Microphone permission not granted');
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      // Create and start recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      this.recording = recording;
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }

  /**
   * Stop recording and return the audio URI
   */
  async stopRecording(): Promise<string | null> {
    if (!this.recording) {
      return null;
    }

    try {
      await this.recording.stopAndUnloadAsync();

      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      const uri = this.recording.getURI();
      this.recording = null;
      return uri;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      this.recording = null;
      throw error;
    }
  }

  /**
   * Cancel recording without saving
   */
  async cancelRecording(): Promise<void> {
    if (this.recording) {
      try {
        await this.recording.stopAndUnloadAsync();
      } catch (e) {
        // Ignore errors when canceling
      }
      this.recording = null;
    }
  }

  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this.recording !== null;
  }

  /**
   * Transcribe audio using Groq Whisper API
   */
  async transcribeAudio(audioUri: string): Promise<string> {
    if (!this.apiKey) {
      return "Voice transcription requires a Groq API key. Please add EXPO_PUBLIC_GROQ_API_KEY to your .env file.";
    }

    try {
      // Create form data with the audio file
      const formData = new FormData();

      // Get the file extension
      const uriParts = audioUri.split('.');
      const fileExtension = uriParts[uriParts.length - 1];

      // Append the audio file
      formData.append('file', {
        uri: audioUri,
        type: `audio/${fileExtension === 'm4a' ? 'mp4' : fileExtension}`,
        name: `recording.${fileExtension}`,
      } as any);

      formData.append('model', 'whisper-large-v3');
      formData.append('language', 'en');

      const response = await fetch(GROQ_WHISPER_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Groq Whisper API error:', errorText);
        throw new Error(`Transcription failed: ${response.status}`);
      }

      const data = await response.json();
      return data.text || '';
    } catch (error) {
      console.error('Transcription error:', error);
      throw error;
    }
  }

  /**
   * Record and transcribe in one step
   */
  async recordAndTranscribe(): Promise<string> {
    const audioUri = await this.stopRecording();
    if (!audioUri) {
      throw new Error('No recording to transcribe');
    }
    return this.transcribeAudio(audioUri);
  }
}

// Export singleton instance
export const voiceService = new VoiceService();
export default voiceService;
