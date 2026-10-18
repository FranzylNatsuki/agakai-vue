import { hasNativePermission } from '@/services/permissionSettings';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** Request a one-time foreground location. Coordinates are returned only to the caller. */
export function getCurrentLocation(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Location is not available on this device.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      (error) => reject(error),
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 15_000 },
    );
  });
}

/** Check location permission without opening an OS prompt when supported. */
export async function hasLocationPermission(): Promise<boolean | null> {
  const nativePermission = await hasNativePermission('location');
  if (nativePermission !== null) return nativePermission;
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) return null;
  try {
    const permission = await navigator.permissions.query({ name: 'geolocation' });
    return permission.state === 'granted';
  } catch {
    return null;
  }
}

/** Permission primer: request one location fix, then discard the coordinates. */
export async function requestLocationPermission(): Promise<boolean> {
  try {
    await getCurrentLocation();
    return true;
  } catch {
    // A granted permission can still fail to produce a fix (for example, indoors).
    return (await hasLocationPermission()) === true;
  }
}
