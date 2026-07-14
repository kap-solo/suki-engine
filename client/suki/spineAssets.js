/**
 * Suki Engine conventions for Spine symbol textures (Pixi slot games).
 *
 * Export symbol art at {@link SPINE_TEXTURE_CANVAS_SIZE}×{@link SPINE_TEXTURE_CANVAS_SIZE}
 * with tight crops (no large transparent margins). Wire packed atlas bounds into each
 * game's `designSize` — see `template/new-game/assets/spine/README.md`.
 */

/** Standard Spine export canvas for symbol attachments (pixels). */
export const SPINE_TEXTURE_CANVAS_SIZE = 256;

/** Default fraction of reel cell used when fitting symbols on the board. */
export const SPINE_SYMBOL_FIT_RATIO = 0.82;
