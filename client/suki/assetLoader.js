/**
 * Front-load images and audio before gameplay. Reports 0–100 progress.
 */

/** @typedef {'image' | 'audio'} PreloadAssetType */

/**
 * @typedef {object} PreloadAsset
 * @property {string} src
 * @property {PreloadAssetType} [type]
 */

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function inferType(src) {
  const path = src.split('?')[0].toLowerCase();
  if (/\.(mp3|ogg|wav|m4a|aac|webm)$/.test(path)) return 'audio';
  return 'image';
}

/**
 * @param {PreloadAsset} asset
 * @returns {Promise<void>}
 */
function loadOne(asset) {
  const type = asset.type ?? inferType(asset.src);

  if (type === 'audio') {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.preload = 'auto';
      const done = () => {
        audio.removeEventListener('canplaythrough', done);
        audio.removeEventListener('error', onError);
        resolve();
      };
      const onError = () => {
        audio.removeEventListener('canplaythrough', done);
        audio.removeEventListener('error', onError);
        reject(new Error(`Failed to load audio: ${asset.src}`));
      };
      audio.addEventListener('canplaythrough', done);
      audio.addEventListener('error', onError);
      audio.src = asset.src;
      audio.load();
    });
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load image: ${asset.src}`));
    img.src = asset.src;
  });
}

/**
 * @param {PreloadAsset[]} [assets]
 * @param {(percent: number) => void} [onProgress]
 */
export async function preloadAssets(assets = [], onProgress) {
  const list = assets.filter((asset) => asset?.src);
  if (!list.length) {
    onProgress?.(0);
    onProgress?.(100);
    return;
  }

  let completed = 0;
  onProgress?.(0);

  await Promise.all(
    list.map((asset) =>
      loadOne(asset)
        .catch((err) => {
          console.warn('[Suki] preload', err);
        })
        .finally(() => {
          completed += 1;
          onProgress?.(Math.round((completed / list.length) * 100));
        }),
    ),
  );
}

/**
 * @param {object} [options]
 * @param {PreloadAsset[]} [options.assets]
 */
export function createAssetLoader(options = {}) {
  const assets = options.assets ?? [];

  return {
    assets,
    load(onProgress) {
      return preloadAssets(assets, onProgress);
    },
  };
}

export { sleep };
