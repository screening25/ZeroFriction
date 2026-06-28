import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchERPData } from '@/backend/services/erp';

export const dynamic = 'force-dynamic';

/**
 * ERP 데이터 동기화 엔드포인트.
 * erp.fitogether.com에서 대시보드·재고 지표를 스크래핑해 AppState에 캐시한다.
 * GET /api/erp/sync
 */
export async function GET() {
  const data = await fetchERPData();

  if (!data) {
    return NextResponse.json(
      { error: 'ERP_SESSION_TOKEN이 설정되지 않았습니다. .env에 추가하세요.' },
      { status: 401 }
    );
  }

  await prisma.appState.upsert({
    where: { key: 'erp_cache' },
    update: { value: data as any },
    create: { key: 'erp_cache', value: data as any },
  });

  return NextResponse.json(data);
}
