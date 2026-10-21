const CACHE_NAME = 'diem-danh-scyc-v2';

// Danh sách các file tĩnh cần lưu trong máy để dùng khi mất mạng
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './member/index.html',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  const url = event.request.url;

  // 1. Tuyệt đối không can thiệp vào các API động (Google Script, Cloudflare Worker)
  if (
    url.includes('script.google.com') ||
    url.includes('workers.dev') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // 2. Với file giao diện (HTML, JS, CSS, CDN QR): ưu tiên nạp mạng, nếu mất mạng thì lấy từ cache
  event.respondWith(
    fetch(event.request)
      .then(function (response) {
        // Nếu tải từ mạng thành công, tự động cập nhật bản mới vào cache
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(function () {
        // Khi mất mạng: lấy từ bộ nhớ đệm đã lưu
        return caches.match(event.request).then(function (cachedResponse) {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Trường hợp truy cập đường dẫn thư mục /member/ khi offline
          if (event.request.mode === 'navigate') {
            return caches.match('./member/index.html') || caches.match('./index.html');
          }
        });
      })
  );
});
