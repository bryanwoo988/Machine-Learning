/* The share sheet: a QR code anyone can scan to open the app in a browser,
   the system share sheet where there is one, and copy-link everywhere.
   The QR code is drawn offline by js/qrcode.js (verified by tools/verify-qr.py). */

import { toSVG } from './qrcode.js';
import { t } from './i18n.js';
import { el } from './content.js';

export function renderShare(host, { url, lang }) {
  const qr = el('div', { class: 'qr', 'aria-label': url }, toSVG(url, { quiet: 4, dark: '#111827', light: '#ffffff' }));

  const status = el('span', { class: 'share-status', role: 'status' });
  const copy = el('button', { type: 'button', class: 'button button-quiet', 'data-share': 'copy' }, t('copyLink', null, lang));
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // No clipboard permission (older browsers, http): select the visible URL instead.
      const range = document.createRange();
      const node = host.parentElement?.querySelector('.share-url');
      if (node) { range.selectNodeContents(node); getSelection().removeAllRanges(); getSelection().addRange(range); }
    }
    status.textContent = t('copied', null, lang);
    setTimeout(() => { status.textContent = ''; }, 2000);
  });

  const native = el('button', { type: 'button', class: 'button', 'data-share': 'native' }, t('shareButton', null, lang));
  if (!navigator.share) native.hidden = true;
  native.addEventListener('click', () => navigator.share({ title: t('appName', null, lang), url }).catch(() => {}));

  host.replaceChildren(qr, el('div', { class: 'share-actions' }, native, copy, status));
}
