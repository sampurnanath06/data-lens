// MV3 service worker. Per CLAUDE.md section 6.2, every listener must be
// registered synchronously at the top level of this file — never inside an
// async function, callback, or after an await — or it stops firing once the
// worker is terminated and restarted.

import { registerRequestObserver } from './request-observer';

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Data Lens] service worker installed');
});

registerRequestObserver();
