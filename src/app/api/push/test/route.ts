import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { prisma } from '@/lib/prisma';
import { VAPID_PUBLIC_KEY } from '@/lib/vapid';

export const dynamic = 'force-dynamic';

/**
 * 즉시 테스트 푸시 발송.
 * 등록된 모든 기기(PushSubscription)로 지금 바로 1건 발송한다.
 * 앱/브라우저가 닫혀 있어도 OS 배너가 뜨는지 확인하는 용도.
 * GET /api/push/test
 */
export async function GET() {
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!priv) {
    return NextResponse.json({ error: 'VAPID_PRIVATE_KEY 미설정' }, { status: 500 });
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:sangyoung.yun@fitogether.com', VAPID_PUBLIC_KEY, priv);

  try {
    const row = await prisma.appState.findUnique({ where: { key: 'push_subscriptions' } });
    const subs: any[] = Array.isArray(row?.value) ? (row!.value as any[]) : [];
    if (!subs.length) {
      return NextResponse.json({ ok: false, error: '등록된 구독 기기가 없습니다. 앱에서 알림 권한을 허용해 구독하세요.', subs: 0 });
    }

    const payload = JSON.stringify({ title: 'FitoDesk 푸시 테스트', body: '앱이 닫혀 있어도 이 알림이 보이면 성공입니다! ✅', url: '/' });
    let sent = 0;
    const dead = new Set<string>();
    await Promise.all(subs.map(async (s) => {
      try { await webpush.sendNotification(s, payload); sent++; }
      catch (err: any) { if (err?.statusCode === 404 || err?.statusCode === 410) dead.add(s.endpoint); }
    }));

    if (dead.size) {
      const alive = subs.filter(s => !dead.has(s.endpoint));
      await prisma.appState.upsert({ where: { key: 'push_subscriptions' }, update: { value: alive }, create: { key: 'push_subscriptions', value: alive } });
    }

    return NextResponse.json({ ok: true, subs: subs.length, sent });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
