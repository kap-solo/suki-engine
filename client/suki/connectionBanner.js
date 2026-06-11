/**
 * Persistent connection-lost bar with manual retry (re-authenticate via game.start()).
 */

/**
 * @param {object} options
 * @param {HTMLElement} options.root — typically `.suki-stake-shell`
 * @param {() => void | Promise<void>} options.onRetry
 * @param {(key: string) => string} [options.t] — i18n term lookup
 */
export function createConnectionBanner({ root, onRetry, t = (key) => key }) {
  const el = document.createElement('div');
  el.className = 'suki-connection-banner';
  el.setAttribute('role', 'alert');
  el.hidden = true;

  const text = document.createElement('span');
  text.className = 'suki-connection-banner__text';

  const retryBtn = document.createElement('button');
  retryBtn.type = 'button';
  retryBtn.className = 'suki-connection-banner__retry';

  function refreshCopy() {
    text.textContent = t('connectionLost');
    retryBtn.textContent = t('connectionRetry');
  }

  refreshCopy();

  let retrying = false;

  retryBtn.addEventListener('click', async () => {
    if (retrying) return;
    retrying = true;
    retryBtn.disabled = true;
    try {
      await onRetry();
    } finally {
      retrying = false;
      retryBtn.disabled = false;
    }
  });

  el.append(text, retryBtn);
  root.prepend(el);

  return {
    element: el,
    show() {
      el.hidden = false;
    },
    hide() {
      el.hidden = true;
    },
    refreshCopy,
    destroy() {
      el.remove();
    },
  };
}
