import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 동기화 대상 키 — 클라이언트 localStorage 키와 1:1 대응한다.
const SYNC_KEYS = ['universal_records', 'archived_records', 'zero_settings', 'zero_activities'] as const;

/**
 * 전체 공유 상태를 반환한다.
 * 모든 기기가 이 엔드포인트로 같은 데이터를 읽는다 → 동일 화면 보장.
 * 반환 형태: { universal_records: [...], archived_records: [...], zero_settings: {...}, zero_activities: [...] }
 */
export async function getState(): Promise<NextResponse> {
  try {
    const rows = await prisma.appState.findMany();
    const out: Record<string, unknown> = {};
    rows.forEach((r: { key: string; value: unknown }) => { out[r.key] = r.value; });
    return NextResponse.json(out);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * 단일 키의 값을 upsert 한다 (last-write-wins).
 * body: { key: string, value: any }
 */
export async function putState(req: Request): Promise<NextResponse> {
  try {
    const { key, value } = await req.json();
    if (typeof key !== 'string' || !SYNC_KEYS.includes(key as any)) {
      return NextResponse.json({ error: 'invalid key' }, { status: 400 });
    }
    await prisma.appState.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
