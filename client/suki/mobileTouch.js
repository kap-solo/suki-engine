/**
 * Mobile touch policy — disable double-tap zoom (Stake iframe requirement).
 *
 * Uses viewport meta + touch-action: manipulation on the document shell.
 * Call once at game bootstrap (createGameBootstrap does this automatically).
 */

/** Recommended viewport content for Stake-shaped game iframes. */
export const SUKI_VIEWPORT_CONTENT =
  'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';

/**
 * Apply mobile zoom/touch guards. Safe to call multiple times.
 */
export function applyMobileTouchPolicy() {
  if (typeof document === 'undefined') return;

  let meta = document.querySelector('meta[name="viewport"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'viewport');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', SUKI_VIEWPORT_CONTENT);

  const touch = 'manipulation';
  document.documentElement.style.touchAction = touch;
  document.documentElement.style.overflow = 'hidden';
  document.documentElement.style.overscrollBehavior = 'none';
  if (document.body) {
    document.body.style.touchAction = touch;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.body.style.height = '100%';
    document.body.style.width = '100%';
  }
}
