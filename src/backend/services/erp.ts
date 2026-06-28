// ERP 연동 서비스 — erp.fitogether.com HTML 스크래핑
// 세션 쿠키(ERP_SESSION_TOKEN)로 대시보드·재고 페이지를 fetch하고 핵심 지표를 파싱한다.

export interface ERPDashboard {
  pendingApprovals: number;    // 승인 대기
  pendingShipments: number;    // 출고 등록 대기
  inProgressShipments: number; // 출고 진행 중
}

export interface ERPStockItem {
  code: string;
  name: string;
  category: string;
  qty: number;       // 실재고
  safeStock: number; // 안전재고
  available: number; // 출고가능
}

export interface ERPCache {
  fetchedAt: string;
  ok: boolean;
  dashboard: ERPDashboard;
  lowStock: ERPStockItem[];
  totalItems: number;
}

const ERP_BASE = 'https://erp.fitogether.com';

function extractCount(html: string, label: string): number {
  // Tailwind Shadcn 패턴: "<label>N<!-- -->건" — React 하이드레이션 주석 포함
  const re = new RegExp(label + '[\\s\\S]{0,400}?(\\d+)<!--[\\s\\S]*?-->건');
  const m = html.match(re);
  if (m) return parseInt(m[1], 10);
  // 폴백: 주석 없이 단순 "N건"
  const re2 = new RegExp(label + '[\\s\\S]{0,400}?(\\d+)건');
  const m2 = html.match(re2);
  return m2 ? parseInt(m2[1], 10) : 0;
}

function cellText(raw: string): string {
  return raw.replace(/<[^>]+>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').trim();
}

function parseStockTable(html: string): ERPStockItem[] {
  const items: ERPStockItem[] = [];
  const tbody = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/)?.[1];
  if (!tbody) return items;

  for (const rowMatch of tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => cellText(m[1]));
    // 컬럼: 0=품목코드, 1=품목명, 2=타입, 3=카테고리, 4=실재고, 8=출고가능, 11=안전재고
    if (cells.length < 12) continue;
    const qty = parseInt(cells[4], 10);
    if (isNaN(qty)) continue;
    items.push({
      code: cells[0],
      name: cells[1],
      category: cells[3],
      qty,
      safeStock: parseInt(cells[11], 10) || 0,
      available: parseInt(cells[8], 10) || 0,
    });
  }
  return items;
}

export async function fetchERPData(): Promise<ERPCache | null> {
  const token = process.env.ERP_SESSION_TOKEN;
  if (!token) return null;

  const cookie = `__Secure-authjs.session-token=${token}; authjs.session-token=${token}`;
  const headers = { Cookie: cookie };

  const [dashRes, stockRes] = await Promise.all([
    fetch(`${ERP_BASE}/dashboard`, { headers, cache: 'no-store' }).catch(() => null),
    fetch(`${ERP_BASE}/inventory/stock`, { headers, cache: 'no-store' }).catch(() => null),
  ]);

  if (!dashRes?.ok || !stockRes?.ok) {
    return {
      fetchedAt: new Date().toISOString(),
      ok: false,
      dashboard: { pendingApprovals: 0, pendingShipments: 0, inProgressShipments: 0 },
      lowStock: [],
      totalItems: 0,
    };
  }

  const [dashHtml, stockHtml] = await Promise.all([dashRes.text(), stockRes.text()]);

  // 로그인 리다이렉트 감지 (세션 만료 시 ERP는 로그인 페이지로 리다이렉트)
  if (!dashHtml.includes('승인 대기')) {
    return {
      fetchedAt: new Date().toISOString(),
      ok: false,
      dashboard: { pendingApprovals: 0, pendingShipments: 0, inProgressShipments: 0 },
      lowStock: [],
      totalItems: 0,
    };
  }

  const dashboard: ERPDashboard = {
    pendingApprovals: extractCount(dashHtml, '승인 대기'),
    pendingShipments: extractCount(dashHtml, '출고 등록 대기'),
    inProgressShipments: extractCount(dashHtml, '출고 진행 중'),
  };

  const allItems = parseStockTable(stockHtml);
  const lowStock = allItems.filter(item => item.safeStock > 0 && item.qty <= item.safeStock);

  return {
    fetchedAt: new Date().toISOString(),
    ok: true,
    dashboard,
    lowStock,
    totalItems: allItems.length,
  };
}
