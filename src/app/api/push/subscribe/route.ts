import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const KEY = 'push_subscriptions';

/** 푸시 구독 등록 — 기기의 PushSubscription을 공유 DB(AppState)에 저장(endpoint로 중복 제거). */
export async function POST(req: Request) {
  try {
    const sub = await req.json();
    if (!sub || !sub.endpoint) {
      return NextResponse.json({ error: 'invalid subscription' }, { status: 400 });
    }
    const row = await prisma.appState.findUnique({ where: { key: KEY } });
    const list: any[] = Array.isArray(row?.value) ? (row!.value as any[]) : [];
    const next = list.filter(s => s && s.endpoint !== sub.endpoint);
    next.push(sub);
    await prisma.appState.upsert({
      where: { key: KEY },
      update: { value: next },
      create: { key: KEY, value: next },
    });
    return NextResponse.json({ ok: true, count: next.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** 구독 해제(선택) — endpoint 기준 제거. */
export async function DELETE(req: Request) {
  try {
    const { endpoint } = await req.json();
    const row = await prisma.appState.findUnique({ where: { key: KEY } });
    const list: any[] = Array.isArray(row?.value) ? (row!.value as any[]) : [];
    const next = list.filter(s => s && s.endpoint !== endpoint);
    await prisma.appState.upsert({ where: { key: KEY }, update: { value: next }, create: { key: KEY, value: next } });
    return NextResponse.json({ ok: true, count: next.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
