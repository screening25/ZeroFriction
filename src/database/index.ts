// ===== Data Layer: Abstracted handlers for future DB migration =====

export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';

export interface UniversalRecord {
  id: string;
  title: string;
  type: "event" | "asset" | "memo";
  category: string;
  attrs: Record<string, any> & {
    recurrence?: Recurrence;
    linkedIds?: string[];
  };
  updatedAt: string;
}

// 반복(recurrence) 원본 일정으로부터 [from, to] 구간의 가상 인스턴스를 생성한다.
// DB에 복제본을 만들지 않고 캘린더/리스트 렌더 직전에 메모리에서 펼친다.
export function expandRecurringEvents(
  events: UniversalRecord[],
  from: Date,
  to: Date
): UniversalRecord[] {
  const out: UniversalRecord[] = [];
  const fromTs = from.getTime();
  const toTs = to.getTime();
  events.forEach(ev => {
    const rec: Recurrence = (ev.attrs?.recurrence as Recurrence) || 'none';
    if (!ev.attrs?.date) { out.push(ev); return; }
    if (rec === 'none') { out.push(ev); return; }
    const base = new Date(`${ev.attrs.date}T${ev.attrs.time || '00:00'}`);
    if (isNaN(base.getTime())) { out.push(ev); return; }
    let cursor = new Date(base);
    // 원본이 from 보다 미래면 그대로 시작점이 됨
    while (cursor.getTime() < fromTs) {
      if (rec === 'daily') cursor.setDate(cursor.getDate() + 1);
      else if (rec === 'weekly') cursor.setDate(cursor.getDate() + 7);
      else if (rec === 'monthly') cursor.setMonth(cursor.getMonth() + 1);
      else break;
    }
    // 보호 상한 (무한 루프 방지)
    let safety = 0;
    while (cursor.getTime() <= toTs && safety < 366) {
      const dateStr = cursor.toLocaleDateString('sv-SE');
      // 원본 인스턴스이면 그대로, 아니면 가상 복제 (id에 접미사)
      if (dateStr === ev.attrs.date) {
        out.push(ev);
      } else {
        out.push({
          ...ev,
          id: `${ev.id}__v_${dateStr}`,
          attrs: { ...ev.attrs, date: dateStr, _virtual: true, _sourceId: ev.id }
        });
      }
      if (rec === 'daily') cursor.setDate(cursor.getDate() + 1);
      else if (rec === 'weekly') cursor.setDate(cursor.getDate() + 7);
      else if (rec === 'monthly') cursor.setMonth(cursor.getMonth() + 1);
      else break;
      safety++;
    }
  });
  return out;
}

export type ActivityType = 'ADD_SCHED' | 'UPDATE_SCHED' | 'DONE_SCHED' | 'DEL_SCHED' | 'ADD_MEMO' | 'UPDATE_MEMO' | 'DEL_MEMO' | 'ADD_INV' | 'UPDATE_INV' | 'DEL_INV';
export interface ActivityLog { id: string; type: ActivityType; title: string; snippet: string; timestamp: number; }

export interface AppSettings {
  apiKey: string;
  accentColor: string;
  calendarView: 'monthly' | 'weekly' | 'daily';
  maxEventsShown: number;
  maxInventoryShown: number;
  maxMemosShown: number;
  defaultNotifyOffset: number;
  weekStartsOn: 0 | 1;
  timeFormat: '12h' | '24h';
  density: 'compact' | 'comfortable';
  deviceSize: 'default' | 'iphone' | 'galaxy' | 'ipad' | 'mac';
  fontSize?: 'small' | 'medium' | 'large';
  locations?: string[];
  categories?: string[];
  managers?: string[];
  scheduleCategories?: string[];
  notificationType?: 'system' | 'browser';
  enableNotifications?: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  accentColor: '#007AFF',
  calendarView: 'monthly',
  maxEventsShown: 5,
  maxInventoryShown: 5,
  maxMemosShown: 3,
  defaultNotifyOffset: 0,
  weekStartsOn: 0,
  timeFormat: '24h',
  density: 'comfortable',
  deviceSize: 'default',
  fontSize: 'medium',
  locations: ['비즈니스 창고', '메인 매장', '이동용 밴', 'A창고', 'B창고'],
  categories: ['재고', 'IT 장비', '촬영 장비', '사무 용품', '기타'],
  managers: ['윤상영', '김철수', '이영희', '박민수'],
  scheduleCategories: ['업무', '회의', '개인', '일반'],
  notificationType: 'system',
  enableNotifications: true
};

const ACCENT_COLORS = [
  { name: 'Blue', value: '#007AFF', dark: '#0A84FF' },
  { name: 'Green', value: '#34C759', dark: '#30D158' },
  { name: 'Purple', value: '#AF52DE', dark: '#BF5AF2' },
  { name: 'Orange', value: '#FF9500', dark: '#FF9F0A' },
  { name: 'Pink', value: '#FF2D55', dark: '#FF375F' },
  { name: 'Teal', value: '#5AC8FA', dark: '#64D2FF' },
];
export { ACCENT_COLORS };

// --- Universal Records Handlers ---
const REC_KEY = 'universal_records';
const ARCHIVE_KEY = 'archived_records';

export function getRecords(): UniversalRecord[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(REC_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveRecords(records: UniversalRecord[]): void {
  localStorage.setItem(REC_KEY, JSON.stringify(records));
}

// --- Archive (휴지통) ---
export interface ArchivedRecord extends UniversalRecord {
  archivedAt: string;
}

export function getArchive(): ArchivedRecord[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(ARCHIVE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveArchive(items: ArchivedRecord[]): void {
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(items));
}

export function restoreFromArchive(id: string): UniversalRecord | null {
  const archive = getArchive();
  const idx = archive.findIndex(r => r.id === id);
  if (idx < 0) return null;
  const { archivedAt, ...rest } = archive[idx];
  const records = getRecords();
  records.push({ ...rest, updatedAt: new Date().toISOString() });
  saveRecords(records);
  archive.splice(idx, 1);
  saveArchive(archive);
  return rest;
}

export function permanentDeleteArchived(id: string): void {
  const archive = getArchive().filter(r => r.id !== id);
  saveArchive(archive);
}

export function purgeArchive(): void {
  saveArchive([]);
}

export function addRecord(rec: Omit<UniversalRecord, 'id' | 'updatedAt'>): UniversalRecord {
  const records = getRecords();
  const id = `${rec.type}_${Date.now()}`;
  const updatedAt = new Date().toISOString();
  const category = rec.category || "일반";
  
  if (rec.type === 'asset') {
    // 수량을 안전하게 숫자로 변환하여 문자열 덧셈 방지
    rec.attrs.qty = Number(rec.attrs.qty) || 0;

    // ERP/자산(asset) 핵심 데이터 룰:
    // 재고 이동은 IN(입고/증가)과 OUT(출고/감소) 2가지 트랜잭션으로 누적 기록한다.
    // attrs.qty 는 현재 누적 재고(net stock) — 출고가 보유분보다 많거나
    // 재고가 0인 상태에서 출고하면 음수로 떨어진다 (정확한 채무/미배송 추적).
    const existIdx = records.findIndex(r => r.type === 'asset' && r.title === rec.title);
    const flow = rec.attrs.flow || 'IN';
    const txQty = Math.abs(Number(rec.attrs.qty) || 0);

    if (existIdx >= 0) {
      const existing = records[existIdx];
      let currentQty = Number(existing.attrs.qty) || 0;

      if (flow === 'IN') currentQty += txQty;
      else if (flow === 'OUT') currentQty = currentQty - txQty;

      existing.attrs = {
        ...existing.attrs,
        ...rec.attrs,
        flow,
        qty: currentQty
      };
      existing.updatedAt = updatedAt;
      existing.category = category;
      records[existIdx] = existing;
      saveRecords(records);
      return existing;
    }

    // 신규 자산: OUT으로 시작하면 보유분이 0이었던 것이므로 음수 재고로 기록한다.
    const initialQty = flow === 'OUT' ? -txQty : txQty;
    const newAsset: UniversalRecord = {
      ...rec,
      category,
      id,
      updatedAt,
      attrs: { ...rec.attrs, flow, qty: initialQty }
    };
    records.push(newAsset);
    saveRecords(records);
    return newAsset;
  }

  const newRecord: UniversalRecord = { ...rec, category, id, updatedAt };
  records.push(newRecord);
  saveRecords(records);
  return newRecord;
}

export function updateRecord(id: string, payload: Partial<UniversalRecord>): UniversalRecord | null {
  const records = getRecords();
  const idx = records.findIndex(r => r.id === id);
  if (idx < 0) return null;
  
  const existing = records[idx];
  
  // 수량을 안전하게 숫자로 형변환
  if (payload.attrs && 'qty' in payload.attrs) {
    payload.attrs.qty = Number(payload.attrs.qty) || 0;
  }
  
  records[idx] = {
    ...existing,
    ...payload,
    attrs: {
      ...existing.attrs,
      ...(payload.attrs || {})
    },
    updatedAt: new Date().toISOString()
  };
  saveRecords(records);
  return records[idx];
}

export function deleteRecord(id: string, opts: { permanent?: boolean } = {}): void {
  const records = getRecords();
  const target = records.find(r => r.id === id);
  const remaining = records.filter(r => r.id !== id);
  saveRecords(remaining);
  // 소프트 삭제: 휴지통으로 이동. permanent=true 면 archive 단계도 건너뜀.
  if (target && !opts.permanent) {
    const archive = getArchive();
    archive.unshift({ ...target, archivedAt: new Date().toISOString() });
    // 최대 200건 유지 (오래된 것 자동 청소)
    if (archive.length > 200) archive.length = 200;
    saveArchive(archive);
  }
}

// --- Settings ---
const SETTINGS_KEY = 'zero_settings';
export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  const raw = localStorage.getItem(SETTINGS_KEY);
  return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
}
export function persistSettings(s: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// --- Activities ---
const ACT_KEY = 'zero_activities';
export function loadActivities(): ActivityLog[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(ACT_KEY);
  return raw ? JSON.parse(raw) : [];
}
export function persistActivities(acts: ActivityLog[]): void {
  localStorage.setItem(ACT_KEY, JSON.stringify(acts));
}

// --- Export / Import ---
export function exportAllData(): string {
  const data: Record<string, any> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('zero_') || key.startsWith('erp_') || key === 'universal_records')) {
      try { data[key] = JSON.parse(localStorage.getItem(key) || ''); } catch { data[key] = localStorage.getItem(key); }
    }
  }
  return JSON.stringify(data, null, 2);
}

export function importAllData(json: string): boolean {
  try {
    const data = JSON.parse(json);
    Object.entries(data).forEach(([key, val]) => {
      localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
    });
    return true;
  } catch { return false; }
}

export function clearAllData(): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('zero_') || key.startsWith('erp_') || key === 'universal_records' || key === 'archived_records')) keys.push(key);
  }
  keys.forEach(k => localStorage.removeItem(k));
}

// --- Holidays ---
export const solarHolidays = ['01-01', '03-01', '05-05', '06-06', '08-15', '10-03', '10-09', '12-25'];
export const lunarHolidays2026 = ['2026-02-16', '2026-02-17', '2026-02-18', '2026-05-24', '2026-09-24', '2026-09-25', '2026-09-26', '2026-03-02', '2026-05-25', '2026-08-17'];
