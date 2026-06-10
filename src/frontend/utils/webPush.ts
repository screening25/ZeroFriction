import { VAPID_PUBLIC_KEY } from '@/lib/vapid';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/**
 * 웹 푸시 구독 — 서비스워커에 PushSubscription을 만들고 서버에 등록한다.
 * 그러면 서버 크론이 예약 시각에 이 기기로 푸시를 보내, 브라우저/PWA가 꺼져 있어도 알림이 뜬다.
 * - 안드로이드 네이티브 앱(Capacitor)은 로컬 알림을 쓰므로 웹푸시는 스킵.
 * - 알림 권한이 없으면 요청 후 진행.
 */
export async function subscribeWebPush(): Promise<void> {
  try {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;

    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) return; // 안드로이드 앱은 로컬 알림 사용

    if (Notification.permission === 'denied') return;
    if (Notification.permission !== 'granted') {
      const p = await Notification.requestPermission();
      if (p !== 'granted') return;
    }

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
      });
    }
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub),
    });
  } catch {
    /* SW 미등록(dev 등)·권한 거부 시 조용히 무시 */
  }
}
