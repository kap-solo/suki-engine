/**
 * In-memory recent round history for the Recent Results modal.
 */

/**
 * @typedef {object} RecentResultEntry
 * @property {number} [at] — timestamp ms
 * @property {*} [data] — game-specific payload
 */

/**
 * @param {object} [options]
 * @param {number} [options.max=20]
 */
export function createRecentResultsStore(options = {}) {
  const max = Math.max(1, options.max ?? 20);
  /** @type {RecentResultEntry[]} */
  let items = [];

  return {
    get items() {
      return [...items];
    },
    get length() {
      return items.length;
    },
    /** @param {RecentResultEntry | object} entry */
    push(entry) {
      items.unshift({
        at: Date.now(),
        ...entry,
      });
      if (items.length > max) {
        items.length = max;
      }
    },
    clear() {
      items = [];
    },
    /**
     * @param {HTMLElement} container
     * @param {(entry: RecentResultEntry, index: number) => string | HTMLElement} renderRow
     * @param {string} [emptyText='No rounds yet.']
     */
    renderList(container, renderRow, emptyText = 'No rounds yet.') {
      container.innerHTML = '';
      if (!items.length) {
        const empty = document.createElement('p');
        empty.className = 'suki-recent-empty';
        empty.textContent = emptyText;
        container.appendChild(empty);
        return;
      }

      const list = document.createElement('ul');
      list.className = 'suki-recent-list';
      for (let i = 0; i < items.length; i += 1) {
        const li = document.createElement('li');
        const row = renderRow(items[i], i);
        if (typeof row === 'string') {
          li.textContent = row;
        } else {
          li.appendChild(row);
        }
        list.appendChild(li);
      }
      container.appendChild(list);
    },
  };
}
