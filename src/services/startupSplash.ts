let complete!: () => void;

/** Resolves when the first-load brand splash has finished displaying. */
export const startupSplashHidden = new Promise<void>((resolve) => {
  complete = resolve;
});

export function markStartupSplashHidden(): void {
  complete();
}
