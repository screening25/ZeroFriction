// Zero-Friction 푸시 전용 서비스워커.
// 페이지/리소스를 캐싱하지 않는다(= 안드로이드 WebView 업데이트 막힘 문제 없음).
// 오직 Web Push 수신과 알림 클릭만 처리한다.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch { data = { title: 'Zero-Friction', body: event.data ? event.data.text() : '새 알림' }; }

  const title = data.title || 'Zero-Friction';
  const options = {
    body: data.body || '새로운 알림이 도착했습니다.',
    icon: '/icon.png',
    badge: '/icon.png',
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) { client.navigate(targetUrl); return client.focus(); }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
