const CACHE_NAME = 'diem-danh-scyc-v1';

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    self.clients.claim()
  );
});

self.addEventListener('fetch', function (event) {
  // Không can thiệp vào request API / Apps Script.
  if (
    event.request.url.includes('script.google.com')
  ) {
    return;
  }
});
