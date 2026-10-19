import { Capacitor, registerPlugin } from '@capacitor/core';

interface PermissionSettingsPlugin {
  checkPermission(options: { permission: 'microphone' | 'location' }): Promise<{ granted: boolean }>;
  requestMicrophonePermission(): Promise<{ granted: boolean }>;
  openAppSettings(): Promise<void>;
}

const PermissionSettings = registerPlugin<PermissionSettingsPlugin>('PermissionSettings');

/** Read the native runtime permission state without prompting the senior. */
export async function hasNativePermission(permission: 'microphone' | 'location'): Promise<boolean | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    return (await PermissionSettings.checkPermission({ permission })).granted;
  } catch {
    return null;
  }
}

/** Request Android microphone permission directly without starting audio capture. */
export async function requestNativeMicrophonePermission(): Promise<boolean | null> {
  if (Capacitor.getPlatform() !== 'android') return null;
  try {
    return (await PermissionSettings.requestMicrophonePermission()).granted;
  } catch {
    return null;
  }
}

/** Open this app's Android settings so a permanently denied permission can be enabled. */
export async function openPermissionSettings(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    await PermissionSettings.openAppSettings();
    return true;
  } catch {
    return false;
  }
}
