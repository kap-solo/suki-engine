/**
 * Game menu modals — replace stub copy and paytable per title.
 */

import { GAME } from './config.js';

/**
 * @param {object} ctx
 * @param {ReturnType<import('@kap-solo/suki-engine/client/rgs.js').createModalHost>} ctx.modalHost
 * @param {ReturnType<import('@kap-solo/suki-engine/client/rgs.js').createRecentResultsStore>} ctx.recentResults
 * @param {object} ctx.game — bootstrap return (after bind)
 * @param {() => string} [ctx.formatCurrency]
 */
export function registerGameModals(ctx) {
  const { modalHost, recentResults, game, formatCurrency = (n) => String(n) } = ctx;

  modalHost.register('how-to-play', {
    title: 'How to Play',
    render(body) {
      const p = document.createElement('p');
      p.textContent =
        'Choose a bet, press Play, and watch the outcome. Results come from the RGS — the animation is presentation only. Replace this copy in js/menu.js.';
      body.appendChild(p);
    },
  });

  modalHost.register('paytable', {
    title: 'Paytable',
    render(body) {
      const p = document.createElement('p');
      p.textContent =
        'Starter math: 0×, 1×, and 2× outcomes with equal weight. Publish your lookup tables and document pays here.';
      body.appendChild(p);
      if (game?.controls?.showRtp) {
        const rtp = document.createElement('p');
        rtp.style.marginTop = '0.75rem';
        rtp.style.fontSize = '0.8rem';
        rtp.style.color = '#8b97a8';
        rtp.textContent = `Target RTP ${GAME.targetRtpPercent}%`;
        body.appendChild(rtp);
      }
    },
  });

  modalHost.register('stats', {
    title: 'Stats',
    render(body) {
      const p = document.createElement('p');
      p.textContent = 'Session stats will appear here once you wire record-keeping in your game loop.';
      body.appendChild(p);
    },
  });

  modalHost.register('recent-results', {
    title: 'Recent Results',
    render(body) {
      recentResults.renderList(
        body,
        (entry) => {
          const d = entry.data ?? entry;
          const mult = d.multiplier ?? '—';
          const payout = d.payout != null ? formatCurrency(d.payout) : '—';
          return `${d.symbol ?? '?'} · ${mult}× → ${payout}`;
        },
        'No rounds yet — play to populate history.',
      );
    },
  });
}
