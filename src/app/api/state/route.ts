import { getState, putState } from '@/backend/services/state';

// 항상 최신 데이터를 반환하도록 캐시 비활성화 (기기 간 실시간 동기화)
export const dynamic = 'force-dynamic';

export async function GET() { return getState(); }
export async function PUT(req: Request) { return putState(req); }
