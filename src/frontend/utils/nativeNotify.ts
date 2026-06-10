// 안드로이드(Capacitor) 로컬 알림 — 앱이 꺼져 있어도 OS가 예약된 시각에 알림을 띄운다.
// 웹/Electron 등 비네이티브 환경에서는 아무 일도 하지 않는다(동적 import + 네이티브 가드).

/** 문자열 id → 32비트 양수 정수(LocalNotifications는 숫자 id 필요) */
function numericId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return Math.abs(h) % 2000000000 || 1;
}

/**
 * 현재 일정(events)을 기준으로 OS 로컬 알림을 예약한다.
 * - 기존 예약을 모두 취소하고 미래 일정만 다시 예약(상태 일관성).
 * - allDay/완료/알림없음(-1)은 제외. notifyOffset(분) 반영.
 */
export async function syncLocalNotifications(records: any[], settings: any): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return; // 안드로이드 앱에서만 동작
    const { LocalNotifications } = await import('@capacitor/local-notifications');

    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      const req = await LocalNotifications.requestPermissions();
      if (req.display !== 'granted') return;
    }

    // 기존 예약 취소(우리가 건 것 정리)
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
    }

    const defOffset = typeof settings?.defaultNotifyOffset === 'number' ? settings.defaultNotifyOffset : 0;
    const now = Date.now();
    const toSchedule: any[] = [];
    (records || []).filter(r => r && r.type === 'event').forEach(r => {
      const a = r.attrs || {};
      if (a.completed || a.allDay || !a.date || !a.time) return;
      const offset = typeof a.notifyOffset === 'number' ? a.notifyOffset : defOffset;
      if (offset < 0) return; // 알림 없음
      const fireAt = new Date(`${a.date}T${a.time}`).getTime() - offset * 60000;
      if (isNaN(fireAt) || fireAt <= now + 5000) return; // 미래 일정만
      toSchedule.push({
        id: numericId(r.id),
        title: r.title || '일정 알림',
        body: `${a.time}${a.memo ? ' · ' + a.memo : ''}`,
        schedule: { at: new Date(fireAt) },
      });
    });

    if (toSchedule.length) {
      await LocalNotifications.schedule({ notifications: toSchedule });
    }
  } catch {
    /* 비네이티브이거나 플러그인 미설치 시 조용히 무시 */
  }
}
