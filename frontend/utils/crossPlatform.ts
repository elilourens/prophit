/**
 * Cross-platform utilities for web and native compatibility
 */

import { Alert, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Show an alert that works on both web and native
 */
export function showAlert(
  title: string,
  message?: string,
  buttons?: { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[]
) {
  if (Platform.OS === 'web') {
    // On web, use window.alert or window.confirm
    const fullMessage = message ? `${title}\n\n${message}` : title;

    if (buttons && buttons.length > 1) {
      // If there are multiple buttons, use confirm for simple yes/no
      const confirmed = window.confirm(fullMessage);
      if (confirmed) {
        const okButton = buttons.find(b => b.style !== 'cancel');
        okButton?.onPress?.();
      } else {
        const cancelButton = buttons.find(b => b.style === 'cancel');
        cancelButton?.onPress?.();
      }
    } else {
      window.alert(fullMessage);
      // Call the single button's onPress if it exists
      if (buttons && buttons[0]?.onPress) {
        buttons[0].onPress();
      }
    }
  } else {
    // On native, use Alert.alert
    Alert.alert(title, message, buttons);
  }
}

/**
 * Copy text to clipboard - works on both web and native
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      await navigator.clipboard.writeText(text);
    } else {
      await Clipboard.setStringAsync(text);
    }
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Show a toast/snackbar message (simplified version)
 * On web: uses alert, on native: could use a toast library
 */
export function showToast(message: string) {
  if (Platform.OS === 'web') {
    // Simple web notification - could be replaced with a toast library
    console.log('Toast:', message);
  } else {
    // On native, just log for now - could integrate with a toast library
    console.log('Toast:', message);
  }
}

/**
 * Share content - works on both web and native
 * Falls back to copying to clipboard on web if Web Share API isn't available
 */
export async function shareContent(message: string, title?: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    // Check if Web Share API is available (requires HTTPS and supported browser)
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: title || 'Share',
          text: message,
        });
        return true;
      } catch (error) {
        // User cancelled or error occurred
        console.log('Web Share failed, falling back to clipboard');
      }
    }

    // Fallback: copy to clipboard
    const copied = await copyToClipboard(message);
    if (copied) {
      showAlert('Copied!', 'Content copied to clipboard. You can paste it anywhere to share.');
    }
    return copied;
  } else {
    // Native: use React Native Share
    const { Share } = require('react-native');
    try {
      await Share.share({ message });
      return true;
    } catch (error) {
      console.error('Share failed:', error);
      return false;
    }
  }
}

/**
 * Read a file as a string - works on both web and native
 * @param uri File URI from DocumentPicker
 * @returns File content as string
 */
export async function readFileAsString(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    // On web, fetch the blob URL and read as text
    const response = await fetch(uri);
    return await response.text();
  } else {
    // On native, use expo-file-system
    return await FileSystem.readAsStringAsync(uri);
  }
}

/**
 * Read a file as base64 - works on both web and native
 * @param uri File URI from DocumentPicker
 * @returns File content as base64 string
 */
export async function readFileAsBase64(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    // On web, fetch the blob and convert to base64
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } else {
    // On native, use expo-file-system
    return await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }
}
