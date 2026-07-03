importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

if (workbox) {
  console.log('Workbox is loaded');

  // Cache HTML pages
  workbox.routing.registerRoute(
    ({request}) => request.destination === 'document',
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'html-cache',
    })
  );

  // Cache CSS, JS
  workbox.routing.registerRoute(
    ({request}) => request.destination === 'script' || request.destination === 'style',
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'static-resources',
    })
  );

  // Cache Images
  workbox.routing.registerRoute(
    ({request}) => request.destination === 'image',
    new workbox.strategies.CacheFirst({
      cacheName: 'image-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        }),
      ],
    })
  );

  // Cache External CDNs (Tailwind, Firebase, etc)
  workbox.routing.registerRoute(
    ({url}) => url.origin === 'https://unpkg.com' || 
               url.origin === 'https://cdn.tailwindcss.com' || 
               url.origin === 'https://cdnjs.cloudflare.com' || 
               url.origin === 'https://cdn.sheetjs.com' ||
               url.origin === 'https://www.gstatic.com', // Firebase JS SDKs
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'cdn-cache',
    })
  );

} else {
  console.log('Workbox failed to load');
}
