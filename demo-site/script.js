// The Daily Byte — demo third-party request generator.
//
// Fires a fixed spread of real, recognizable third-party requests so the
// Data Lens extension has genuine tracker-dataset domains to observe and
// classify. Requests are intentionally allowed to fail or be blocked —
// the extension's observer fires on the request attempt itself, not on a
// successful response. Nothing here reads page content or user input.

(function () {
  function firePixel(url, label) {
    var img = new Image();
    img.referrerPolicy = 'no-referrer-when-downgrade';
    img.src = url;
    console.log('[demo] image request ->', label, url);
  }

  function fireScript(url, label) {
    var s = document.createElement('script');
    s.src = url;
    s.async = true;
    s.onerror = function () {
      console.log('[demo] script request failed (expected in some cases) ->', label);
    };
    document.head.appendChild(s);
    console.log('[demo] script request ->', label, url);
  }

  function fireBeacon(url, label) {
    fetch(url, { mode: 'no-cors', cache: 'no-store', credentials: 'omit' })
      .catch(function () {
        // Expected: cross-origin beacons often reject or get blocked.
      });
    console.log('[demo] fetch/xhr request ->', label, url);
  }

  function runDemoRequests() {
    // Analytics #1 — image pixel, no tracking parameter.
    firePixel(
      'https://www.google-analytics.com/collect?v=1&t=pageview&tid=UA-00000000-1&cid=555555555&dp=%2Fthedailybyte',
      'google-analytics.com (Analytics)'
    );

    // Advertising — image pixel carrying a gclid tracking parameter.
    firePixel(
      'https://ad.doubleclick.net/ddm/trackimp/N123.456thedailybyte/B0.0?dc_trk_aid=1&gclid=Tester_gclid_abc123',
      'doubleclick.net (Advertising, gclid)'
    );

    // Social — real script (Facebook's fbevents.js) carrying an fbclid parameter.
    fireScript(
      'https://connect.facebook.net/en_US/fbevents.js?fbclid=IwAR_Tester_fbclid_xyz789',
      'connect.facebook.net (Social, fbclid)'
    );

    // CDN — a real, loadable library file. No tracking parameter: CDNs are
    // benign infrastructure, not a tracking surface.
    fireScript(
      'https://cdnjs.cloudflare.com/ajax/libs/dayjs/1.11.10/dayjs.min.js',
      'cdnjs.cloudflare.com (CDN)'
    );

    // Analytics #2 — beacon request carrying a utm_source parameter.
    fireBeacon(
      'https://sb.scorecardresearch.com/beacon.js?c1=2&c2=1234567&utm_source=newsletter',
      'scorecardresearch.com (Analytics, utm_source)'
    );
  }

  if (document.readyState === 'complete') {
    runDemoRequests();
  } else {
    window.addEventListener('load', runDemoRequests);
  }
})();
