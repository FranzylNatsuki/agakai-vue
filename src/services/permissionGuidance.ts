export type OnboardingPermission = 'microphone' | 'location';

/** Android uses runtime permission buttons; other builds currently use web prompts.
 * Do not give native iOS location instructions until native location requests exist.
 */
export function permissionGuidance(permission: OnboardingPermission, nativePlatform: string) {
  const android = nativePlatform === 'android';
  const key = permission === 'microphone' ? 'onboarding_mic_prompt' : 'onboarding_location_prompt';
  return {
    textKey: `${key}${android ? '_android' : ''}`,
    audioName: `${permission}${android ? '-android' : ''}-v2`,
  };
}
