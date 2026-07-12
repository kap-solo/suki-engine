/**
 * Build a static frontend upload folder for Stake Engine ACP.
 *
 * Copies game static files plus browser vendor deps (suki-engine, pixi, spine)
 * into a self-contained folder that works without the Node mock server.
 *
 * Usage: node tools/publish-frontend.mjs <gameRoot> [outDir]
 * Example: node tools/publish-frontend.mjs ../Basic-Slot-Pool
 *
 * Default output: <gameRoot>/dist/
 */

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const gameRoot = resolve(process.argv[2] || '.');
const outDir = resolve(process.argv[3] || join(gameRoot, 'dist'));

const GAME_DIRS = ['css', 'js', 'assets'];
const GAME_FILES = ['index.html', 'favicon.ico'];

/**
 * npm vendor files — published as .js (not .mjs) so static hosts serve
 * application/javascript reliably.
 */
const NPM_VENDOR = [
  {
    src: 'pixi.js/dist/pixi.min.mjs',
    dest: 'pixi.js/dist/pixi.min.js',
  },
  {
    src: '@esotericsoftware/spine-pixi-v8/dist/esm/spine-pixi-v8.mjs',
    dest: '@esotericsoftware/spine-pixi-v8/dist/esm/spine-pixi-v8.js',
  },
];

const BOOT_ERROR_SCRIPT = `<script>
(function () {
  function showBootError(text) {
    var shell = document.querySelector('.suki-stake-shell');
    if (shell) shell.classList.remove('suki-shell-booting');
    var box = document.getElementById('boot-error');
    if (!box) {
      box = document.createElement('pre');
      box.id = 'boot-error';
      box.style.cssText = 'position:fixed;inset:12px;z-index:99999;margin:0;background:rgba(10,10,10,0.96);color:#ff8a8a;padding:16px;overflow:auto;font:13px/1.45 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;pointer-events:auto;';
      document.body.appendChild(box);
    }
    box.textContent = String(text);
  }
  window.addEventListener('error', function (e) {
    showBootError('Load error\\n' + (e.filename || '') + '\\n' + (e.message || String(e.error || e)));
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    showBootError('Unhandled promise rejection\\n' + (r && r.stack ? r.stack : (r && r.message ? r.message : String(r))));
  });
})();
</script>`;

function requirePath(path, label) {
  if (!existsSync(path)) {
    throw new Error(`Missing ${label}: ${path}`);
  }
}

function resolveSukiPackageDir(root) {
  const pkgRoot = join(root, 'node_modules', '@kap-solo', 'suki-engine');
  return existsSync(pkgRoot) ? pkgRoot : null;
}

function copyFile(src, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest);
}

function copyDir(src, dest) {
  cpSync(src, dest, { recursive: true });
}

function stakeIndexHtml(sourcePath) {
  let html = readFileSync(sourcePath, 'utf8');

  // Stake / Vite pattern: explicit relative paths from index.html directory.
  html = html.replaceAll('"/vendor/', '"./vendor/');
  html = html.replaceAll("'/vendor/", "'./vendor/");
  html = html.replaceAll('href="/vendor/', 'href="./vendor/');
  html = html.replaceAll('href="css/', 'href="./css/');
  html = html.replaceAll('src="js/', 'src="./js/');

  // Publish vendor libs as .js for MIME compatibility on static CDNs.
  html = html.replaceAll('pixi.min.mjs', 'pixi.min.js');
  html = html.replaceAll('spine-pixi-v8.mjs', 'spine-pixi-v8.js');

  if (!/<base\s/i.test(html)) {
    html = html.replace('<head>', '<head>\n    <base href="./" />');
  }

  if (!html.includes('id="boot-error"') && !html.includes('showBootError')) {
    html = html.replace('<head>', `<head>\n    ${BOOT_ERROR_SCRIPT}`);
  }

  return html;
}

function readPackageVersion(pkgDir) {
  try {
    const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
    return pkg.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function dirSizeBytes(dir) {
  let total = 0;
  for (const entry of readDirRecursive(dir)) {
    total += statSync(entry).size;
  }
  return total;
}

function readDirRecursive(dir) {
  /** @type {string[]} */
  const files = [];
  for (const name of readdirSafe(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...readDirRecursive(path));
    } else {
      files.push(path);
    }
  }
  return files;
}

function readdirSafe(dir) {
  return existsSync(dir) ? readdirSync(dir) : [];
}

function validateBundle(root) {
  const required = [
    'index.html',
    'js/game.js',
    'vendor/suki-engine/client/rgs.js',
    'vendor/npm/pixi.js/dist/pixi.min.js',
    'vendor/npm/@esotericsoftware/spine-pixi-v8/dist/esm/spine-pixi-v8.js',
  ];
  for (const rel of required) {
    requirePath(join(root, rel), `publish artifact ${rel}`);
  }

  const html = readFileSync(join(root, 'index.html'), 'utf8');
  if (html.includes('"/vendor/') || html.includes("'/vendor/")) {
    throw new Error('index.html still contains absolute /vendor/ paths');
  }
  if (!html.includes('<base href="./"')) {
    throw new Error('index.html missing <base href="./" />');
  }
  if (!html.includes('./js/game.js')) {
    throw new Error('index.html missing ./js/game.js module entry');
  }
}

function main() {
  requirePath(gameRoot, 'game root');
  requirePath(join(gameRoot, 'index.html'), 'index.html');
  requirePath(join(gameRoot, 'js'), 'js/');

  const nodeModules = join(gameRoot, 'node_modules');
  requirePath(nodeModules, 'node_modules — run npm install first');

  const sukiDir = resolveSukiPackageDir(gameRoot);
  if (!sukiDir) {
    throw new Error('Missing @kap-solo/suki-engine in node_modules');
  }

  for (const { src } of NPM_VENDOR) {
    requirePath(join(nodeModules, src), `npm vendor ${src}`);
  }

  if (existsSync(outDir)) {
    rmSync(outDir, { recursive: true, force: true });
  }
  mkdirSync(outDir, { recursive: true });

  for (const dir of GAME_DIRS) {
    const src = join(gameRoot, dir);
    if (existsSync(src)) {
      copyDir(src, join(outDir, dir));
    }
  }

  for (const file of GAME_FILES) {
    const src = join(gameRoot, file);
    if (!existsSync(src)) continue;
    if (file === 'index.html') {
      writeFileSync(join(outDir, file), stakeIndexHtml(src));
    } else {
      copyFile(src, join(outDir, file));
    }
  }

  copyDir(sukiDir, join(outDir, 'vendor', 'suki-engine'));

  for (const { src, dest } of NPM_VENDOR) {
    copyFile(join(nodeModules, src), join(outDir, 'vendor', 'npm', dest));
  }

  const manifest = {
    builtAt: new Date().toISOString(),
    gameRoot,
    sukiEngineVersion: readPackageVersion(sukiDir),
    upload: 'Upload the contents of this folder to Stake Engine ACP (frontend files).',
    launch: 'Use the sandbox launch URL from ACP with sessionID and rgs_url — do not use ?dev=true for first live test.',
    notes: 'If the game shows a blank grey screen, open DevTools → Network and check for 404 or blocked .js module loads.',
  };
  writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  validateBundle(outDir);

  const size = dirSizeBytes(outDir);
  const fileCount = readDirRecursive(outDir).length;

  console.log('Stake frontend bundle ready.');
  console.log(`  output: ${outDir}`);
  console.log(`  files:  ${fileCount}`);
  console.log(`  size:   ${formatBytes(size)}`);
  console.log(`  suki:   v${manifest.sukiEngineVersion}`);
  console.log('');
  console.log('Upload the contents of dist/ to Stake Engine ACP (frontend section).');
  console.log('Preview locally: npx --yes serve dist -p 4173');
}

main();
