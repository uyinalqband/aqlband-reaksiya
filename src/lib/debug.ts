/**
 * Records a named checkpoint into the diagnostic panel set up in index.html
 * (before the app bundle even loads). Safe to call from anywhere; a no-op
 * if the boot script somehow isn't present.
 */
export function checkpoint(name: string): void {
  (window as unknown as { __checkersOnlineCheckpoint?: (n: string) => void }).__checkersOnlineCheckpoint?.(name);
}
