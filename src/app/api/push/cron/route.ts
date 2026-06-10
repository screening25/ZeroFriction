import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { prisma } from '@/lib/prisma';
import { VAPID_PUBLIC_KEY } from '@/lib/vapid';

export const dynamic = 'force-dynamic';

/**
 * 예약 알림 발송 엔드포인트.
 * 1분마다 호출(외부 크론 cron-job.org/GitHub Actions, 또는 Vercel Pro Cron)되면
 * 발송 시각이 도달한 일정을 찾아 등록된 모든 기기(PushSubscription)로 Web Push 발송.
 * (앱/브라우저가 꺼져 있어도 OS가 수신) 중복은 push_sent로 방지.
 * 참고: Vercel Hobby 플랜은 분 단위 Cron 불가 → vercel.json crons 대신 외부 크론 사용.
 */
export async function GET() {
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!priv) {
    return NextResponse.json({ error: 'VAPID_PRIVATE_KEY 미설정' }, { status: 500 });
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@zero-friction.app', VAPID_PUBLIC_KEY, priv);

  try {
    const rows = await prisma.appState.findMany();
    const map: Record<string, any> = {};
    rows.forEach((r: { key: string; value: unknown }) => { map[r.key] = r.value; });

    const records: any[] = Array.isArray(map['universal_records']) ? map['universal_records'] : [];
    const settings: any = map['zero_settings'] || {};
    const subs: any[] = Array.isArray(map['push_subscriptions']) ? map['push_subscriptions'] : [];
    const sent = new Set<string>(Array.isArray(map['push_sent']) ? map['push_sent'] : []);

    const defOffset = typeof settings.defaultNotifyOffset === 'number' ? settings.defaultNotifyOffset : 0;
    const now = Date.now();
    const due: { key: string; title: string; body: string }[] = [];

    records.filter(r => r && r.type === 'event').forEach(r => {
      const a = r.attrs || {};
      if (a.completed || a.allDay || !a.date || !a.time) return;
      const offset = typeof a.notifyOffset === 'number' ? a.notifyOffset : defOffset;
      if (offset < 0) return;
      const fireAt = new Date(`${a.date}T${a.time}`).getTime() - offset * 60000;
      if (isNaN(fireAt)) return;
      const key = `${r.id}_${a.date}_${a.time}`;
      // 발송 시각 이후 0~2분(크론 지연 대비) 윈도, 아직 안 보낸 건
      if (now >= fireAt && now < fireAt + 120000 && !sent.has(key)) {
        due.push({ key, title: r.title || '일정 알림', body: `${a.time}${a.memo ? ' · ' + a.memo : ''}` });
      }
    });

    let sentCount = 0;
    const deadEndpoints = new Set<string>();
    for (const d of due) {
      const payload = JSON.stringify({ title: d.title, body: d.body, url: '/' });
      await Promise.all(subs.map(async (s) => {
        try { await webpush.sendNotification(s, payload); sentCount++; }
        catch (err: any) { if (err?.statusCode === 404 || err?.statusCode === 410) deadEndpoints.add(s.endpoint); }
      }));
      sent.add(d.key);
    }

    // push_sent 정리(최근 500개) + 만료 구독 제거
    if (due.length) {
      await prisma.appState.upsert({ where: { key: 'push_sent' }, update: { value: Array.from(sent).slice(-500) }, create: { key: 'push_sent', value: Array.from(sent).slice(-500) } });
    }
    if (deadEndpoints.size) {
      const alive = subs.filter(s => !deadEndpoints.has(s.endpoint));
      await prisma.appState.upsert({ where: { key: 'push_subscriptions' }, update: { value: alive }, create: { key: 'push_subscriptions', value: alive } });
    }

    return NextResponse.json({ ok: true, due: due.length, sent: sentCount, subs: subs.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
