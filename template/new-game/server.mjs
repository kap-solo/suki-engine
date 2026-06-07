import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMockRgs } from '@kap-solo/suki-engine/server/mock-rgs/create-mock-rgs.mjs';
import { createSukiHost, resolveSukiPackageDir } from '@kap-solo/suki-engine/server/host.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GAME_ID = 'my-game';
const REPLAY_VERSION = '1';

const rgs = createMockRgs({
  gameId: GAME_ID,
  replayVersion: REPLAY_VERSION,
  resolvePlay() {
    return { error: { code: 'ERR_GEN', message: 'Implement resolvePlay in server/game-rgs.mjs' } };
  },
  resolveReplay() {
    return null;
  },
});

createSukiHost({
  rootDir: __dirname,
  rgs,
  sukiPackageDir: resolveSukiPackageDir(__dirname),
  label: 'My game',
}).listen();
