import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSukiHost, resolveSukiPackageDir } from '@kap-solo/suki-engine/server/host.mjs';
import { createGameMockRgs } from './server/game-rgs.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

createSukiHost({
  rootDir: __dirname,
  rgs: createGameMockRgs(),
  sukiPackageDir: resolveSukiPackageDir(__dirname),
  label: 'My Game',
}).listen();
