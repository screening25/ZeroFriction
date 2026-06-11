// ===== Data Layer: Abstracted handlers for future DB migration =====

export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';

/**
 * 재고 입출고 트랜잭션(이력) 한 건.
 * attrs.qty(순재고)는 그대로 두고, 각 이동을 누적 기록해 이력 추적을 가능하게 한다.
 */
export interface InventoryTxn {
  id: string;
  ts: string;          // ISO 시각
  flow: 'IN' | 'OUT';  // 입고/출고
  qty: number;         // 이동 수량(양수)
  balance: number;     // 이동 직후 순재고
  loc?: string;
  mgr?: string;
  client?: string;
  memo?: string;
}

/**
 * 첨부파일 메타데이터 — 본문은 서버(Attachment 테이블, /api/files)에 따로 저장하고
 * 레코드에는 이 메타데이터만 남긴다(공유 상태 JSON 비대화 방지).
 */
export interface AttachmentMeta {
  id: string;
  name: string;
  mime: string;
  size: number;
}

export interface UniversalRecord {
  id: string;
  title: string;
  type: "event" | "asset" | "memo";
  category: string;
  attrs: Record<string, any> & {
    recurrence?: Recurrence;
    linkedIds?: string[];
    txns?: InventoryTxn[]; // 재고(asset) 전용 — 입출고 이력
    files?: AttachmentMeta[]; // 일정·메모 첨부파일
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
  categoryColors?: Record<string, string>;
  notificationType?: 'system' | 'browser';
  enableNotifications?: boolean;
  clients?: string[];
  clientSort?: 'asc' | 'desc';      // 고객사 정렬 방향(가나다/ABC)
  memoSort?: 'asc' | 'desc';        // 메모 정렬(작성일)
  inventorySort?: 'manual' | 'asc' | 'desc'; // 재고 정렬(수동 드래그/품목코드 오름·내림)
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
  categoryColors: {
    '업무': '#007AFF',
    '회의': '#FF9500',
    '개인': '#34C759',
    '일반': '#AF52DE'
  },
  notificationType: 'system',
  enableNotifications: true,
  clients: [],
  clientSort: 'asc',
  memoSort: 'desc',
  inventorySort: 'manual'
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

// ===== 공유 저장소 (클라우드 동기화) =====
// 기존에는 localStorage(기기별 격리)에 저장했기에 APK와 데스크톱 앱이 서로 다른 데이터를 봤다.
// 이제 모든 데이터는 서버(/api/state → Neon Postgres)에 저장되어 모든 기기가 같은 데이터를 본다.
// 동기 인터페이스를 유지하기 위해 인메모리 캐시를 두고, 읽기는 캐시에서, 쓰기는 캐시+서버에 한다.
const REC_KEY = 'universal_records';
const ARCHIVE_KEY = 'archived_records';
const SETTINGS_KEY = 'zero_settings';
const ACT_KEY = 'zero_activities';

type SyncKey = typeof REC_KEY | typeof ARCHIVE_KEY | typeof SETTINGS_KEY | typeof ACT_KEY;

// 인메모리 캐시 — initData()로 서버에서 채운다.
const _cache: Record<string, any> = {};
let _initialized = false;

/** 서버에 단일 키 값을 비동기로 저장한다 (last-write-wins). 실패해도 UI를 막지 않는다. */
function pushToServer(key: SyncKey, value: any): void {
  if (typeof window === 'undefined') return;
  fetch('/api/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
    keepalive: true,
  }).catch((e) => console.error('[sync] save failed', key, e));
}

/**
 * 앱 시작 시 1회 호출 — 서버에서 전체 상태를 받아 캐시를 채운다.
 * 이 함수가 끝난 뒤에 getRecords/loadSettings 등을 호출해야 동기화된 데이터를 얻는다.
 */
export async function initData(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const res = await fetch('/api/state', { cache: 'no-store' });
    const data = res.ok ? await res.json() : {};
    const serverHasRecords = Object.prototype.hasOwnProperty.call(data, REC_KEY);
    _cache[REC_KEY] = Array.isArray(data[REC_KEY]) ? data[REC_KEY] : [];
    _cache[ARCHIVE_KEY] = Array.isArray(data[ARCHIVE_KEY]) ? data[ARCHIVE_KEY] : [];
    _cache[SETTINGS_KEY] = data[SETTINGS_KEY] && typeof data[SETTINGS_KEY] === 'object' ? data[SETTINGS_KEY] : {};
    _cache[ACT_KEY] = Array.isArray(data[ACT_KEY]) ? data[ACT_KEY] : [];
    _initialized = true;
    // 🔒 일회성 자동 마이그레이션: 서버에 기록 키가 아직 없고(=한 번도 안 올라감)
    // 이 기기 localStorage에 기존 데이터가 있으면 서버로 올려 보존한다.
    if (!serverHasRecords) migrateFromLocalStorage();
  } catch (e) {
    console.error('[sync] initData failed', e);
    if (!_cache[REC_KEY]) _cache[REC_KEY] = [];
    if (!_cache[ARCHIVE_KEY]) _cache[ARCHIVE_KEY] = [];
    if (!_cache[SETTINGS_KEY]) _cache[SETTINGS_KEY] = {};
    if (!_cache[ACT_KEY]) _cache[ACT_KEY] = [];
  }
}

/**
 * 기존 localStorage 데이터를 서버(공유 DB)로 1회 이전한다.
 * 서버가 비어 있을 때만 호출되며, localStorage에 데이터가 있으면 그대로 보존·업로드한다.
 */
function migrateFromLocalStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const rawRecords = localStorage.getItem(REC_KEY);
    const parsedRecords = rawRecords ? JSON.parse(rawRecords) : [];
    if (!Array.isArray(parsedRecords) || parsedRecords.length === 0) return; // 옮길 데이터 없음

    _cache[REC_KEY] = parsedRecords;
    pushToServer(REC_KEY, parsedRecords);

    const rawArchive = localStorage.getItem(ARCHIVE_KEY);
    if (rawArchive) {
      const a = JSON.parse(rawArchive);
      if (Array.isArray(a)) { _cache[ARCHIVE_KEY] = a; pushToServer(ARCHIVE_KEY, a); }
    }
    const rawSettings = localStorage.getItem(SETTINGS_KEY);
    if (rawSettings) {
      const s = JSON.parse(rawSettings);
      if (s && typeof s === 'object') { _cache[SETTINGS_KEY] = s; pushToServer(SETTINGS_KEY, s); }
    }
    const rawAct = localStorage.getItem(ACT_KEY);
    if (rawAct) {
      const ac = JSON.parse(rawAct);
      if (Array.isArray(ac)) { _cache[ACT_KEY] = ac; pushToServer(ACT_KEY, ac); }
    }
    console.info('[sync] migrated localStorage → server:', parsedRecords.length, 'records');
  } catch (e) {
    console.error('[sync] migrateFromLocalStorage failed', e);
  }
}

/** initData가 한 번이라도 완료되었는지 여부 */
export function isDataReady(): boolean { return _initialized; }

// --- Universal Records Handlers ---
export function getRecords(): UniversalRecord[] {
  if (typeof window === 'undefined') return [];
  const list: UniversalRecord[] | undefined = _cache[REC_KEY];
  if (!list || !Array.isArray(list)) return [];
  try {
    let changed = false;
    const seenIds = new Set<string>();
    const repaired = list.map(item => {
      if (!item.id) {
        item.id = `${item.type || 'item'}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        changed = true;
      }
      if (seenIds.has(item.id)) {
        const baseId = item.id;
        let newId = `${baseId}_${Math.random().toString(36).substring(2, 6)}`;
        while (seenIds.has(newId)) {
          newId = `${baseId}_${Math.random().toString(36).substring(2, 6)}`;
        }
        item.id = newId;
        changed = true;
      }
      seenIds.add(item.id);
      return item;
    });
    if (changed) {
      saveRecords(repaired);
    }
    return repaired;
  } catch (e) {
    console.error("Failed to parse records", e);
    return [];
  }
}

export function saveRecords(records: UniversalRecord[]): void {
  _cache[REC_KEY] = records;
  pushToServer(REC_KEY, records);
}

// --- Archive (휴지통) ---
export interface ArchivedRecord extends UniversalRecord {
  archivedAt: string;
}

export function getArchive(): ArchivedRecord[] {
  if (typeof window === 'undefined') return [];
  const list = _cache[ARCHIVE_KEY];
  return Array.isArray(list) ? list : [];
}

export function saveArchive(items: ArchivedRecord[]): void {
  _cache[ARCHIVE_KEY] = items;
  pushToServer(ARCHIVE_KEY, items);
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
  const id = `${rec.type}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const updatedAt = new Date().toISOString();
  const category = rec.category || "일반";
  
  if (rec.type === 'asset') {
    // 수량을 안전하게 숫자로 변환하여 문자열 덧셈 방지
    rec.attrs.qty = Number(rec.attrs.qty) || 0;

    // ERP/자산(asset) 핵심 데이터 룰:
    // 재고 이동은 IN(입고/증가)과 OUT(출고/감소) 2가지 트랜잭션으로 누적 기록한다.
    // attrs.qty 는 현재 누적 재고(net stock) — 출고가 보유분보다 많거나
    // 재고가 0인 상태에서 출고하면 음수로 떨어진다 (정확한 채무/미배송 추적).
    //
    // 합산(netting) 기준: 품목코드 + 품목명(사이즈). 즉 같은 코드의 같은 사이즈끼리만
    // IN/OUT을 누적한다. 코드가 없으면 과거 호환을 위해 품목명만으로 매칭한다.
    const recCode = (rec.attrs.code || '').trim();
    const existIdx = recCode
      ? records.findIndex(r => r.type === 'asset' && (r.attrs.code || '').trim() === recCode && r.title === rec.title)
      : records.findIndex(r => r.type === 'asset' && r.title === rec.title);
    const flow = rec.attrs.flow || 'IN';
    const txQty = Math.abs(Number(rec.attrs.qty) || 0);

    // 트랜잭션 한 건 생성 헬퍼 (이력 추가용)
    const makeTxn = (balance: number): InventoryTxn => ({
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      ts: updatedAt,
      flow,
      qty: txQty,
      balance,
      loc: rec.attrs.loc,
      mgr: rec.attrs.mgr,
      client: rec.attrs.client,
      memo: rec.attrs.memo,
    });

    if (existIdx >= 0) {
      const existing = records[existIdx];
      let currentQty = Number(existing.attrs.qty) || 0;

      if (flow === 'IN') currentQty += txQty;
      else if (flow === 'OUT') currentQty = currentQty - txQty;

      // 기존 이력에 이번 이동을 append (가산 방식 — 기존 데이터 손상 없음)
      const txns: InventoryTxn[] = [ ...(existing.attrs.txns || []), makeTxn(currentQty) ];

      existing.attrs = {
        ...existing.attrs,
        ...rec.attrs,
        flow,
        qty: currentQty,
        txns
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
      attrs: { ...rec.attrs, flow, qty: initialQty, txns: [makeTxn(initialQty)] }
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
export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  const s = _cache[SETTINGS_KEY];
  return s && typeof s === 'object' ? { ...DEFAULT_SETTINGS, ...s } : DEFAULT_SETTINGS;
}
export function persistSettings(s: AppSettings): void {
  _cache[SETTINGS_KEY] = s;
  pushToServer(SETTINGS_KEY, s);
}

// --- Activities ---
export function loadActivities(): ActivityLog[] {
  if (typeof window === 'undefined') return [];
  const list = _cache[ACT_KEY];
  return Array.isArray(list) ? list : [];
}
export function persistActivities(acts: ActivityLog[]): void {
  _cache[ACT_KEY] = acts;
  pushToServer(ACT_KEY, acts);
}

// --- Export / Import ---
// 백업/복원은 동기화 대상 4개 키를 캐시에서 직접 읽고/쓴다.
export function exportAllData(): string {
  const data: Record<string, any> = {};
  [REC_KEY, ARCHIVE_KEY, SETTINGS_KEY, ACT_KEY].forEach((key) => {
    if (_cache[key] !== undefined) data[key] = _cache[key];
  });
  return JSON.stringify(data, null, 2);
}

export function importAllData(json: string): boolean {
  try {
    const data = JSON.parse(json);
    ([REC_KEY, ARCHIVE_KEY, SETTINGS_KEY, ACT_KEY] as SyncKey[]).forEach((key) => {
      if (data[key] !== undefined) {
        _cache[key] = data[key];
        pushToServer(key, data[key]);
      }
    });
    return true;
  } catch { return false; }
}

export function clearAllData(): void {
  _cache[REC_KEY] = [];
  _cache[ARCHIVE_KEY] = [];
  _cache[ACT_KEY] = [];
  pushToServer(REC_KEY, []);
  pushToServer(ARCHIVE_KEY, []);
  pushToServer(ACT_KEY, []);
  // 설정은 보존(테마/색상 등). 필요 시 별도 초기화.
}

// --- Holidays ---
export const solarHolidays = ['01-01', '03-01', '05-05', '06-06', '08-15', '10-03', '10-09', '12-25'];
export const lunarHolidays2026 = ['2026-02-16', '2026-02-17', '2026-02-18', '2026-05-24', '2026-09-24', '2026-09-25', '2026-09-26', '2026-03-02', '2026-05-25', '2026-08-17'];
