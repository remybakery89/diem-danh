const CACHE_NAME = 'diem-danh-scyc-v3';

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

  // 1. Không can thiệp vào các API động (Google Script, Cloudflare Worker)
  if (
    url.includes('script.google.com') ||
    url.includes('workers.dev') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // 2. Giao diện tĩnh: ưu tiên mạng, mất mạng lấy từ cache
  event.respondWith(
    fetch(event.request)
      .then(function (response) {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(function () {
        return caches.match(event.request).then(function (cachedResponse) {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.mode === 'navigate') {
            return caches.match('./member/index.html') || caches.match('./index.html');
          }
        });
      })
  );
});

// LẮNG NGHE TÍN HIỆU PUSH TỪ CLOUDFLARE WORKER
self.addEventListener('push', function (event) {
  event.waitUntil(
    fetch('https://diem-danh-api.remybakery89.workers.dev/?api=bulletin_list')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        let title = 'Thông báo SCYC';
        let body = 'Có thông báo mới từ Ban Điều Hành!';

        if (data && data.success && data.notices && data.notices.length > 0) {
          const latest = data.notices[0];
          title = (latest.loai === 'IMPORTANT' ? '🚨 ' : '📢 ') + latest.tieu_de;
          body = latest.noi_dung;
        }

        const options = {
          body: body,
          icon: 'icons/icon-192.png',
          badge: 'icons/icon-192.png',
          vibrate: [200, 100, 200],
          data: { url: './member/index.html' }
        };

        return self.registration.showNotification(title, options);
      })
      .catch(function () {
        return self.registration.showNotification('Thông báo SCYC', {
          body: 'Bạn có thông báo mới từ ca đoàn!',
          icon: 'icons/icon-192.png'
        });
      })
  );
});

// KHI BẤM VÀO THÔNG BÁO TRÊN THANH TRẠNG THÁI -> MỞ APP
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const targetUrl = event.notification.data ? event.notification.data.url : './member/index.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (client.url.includes('/member/') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
