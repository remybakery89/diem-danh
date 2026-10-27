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
// Lắng nghe tín hiệu Push từ Cloudflare
self.addEventListener('push', function(event) {
  let data = { title: 'Thông báo SCYC', body: 'Bạn có thông báo mới từ ca đoàn!' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch(e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: 'icons/icon-192.png',     // Icon thông báo
    badge: 'icons/icon-192.png',    // Icon nhỏ trên thanh trạng thái
    vibrate: [100, 50, 100],        // Rung máy
    data: { url: data.url || '/member/' }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Khi ca viên bấm vào thông báo trên thanh trạng thái -> Mở App
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (client.url.includes('/member/') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url || '/member/');
      }
    })
  );
});
