'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useApp } from '@/frontend/context/AppContext';
import { addRecord } from '@/database';

interface Row {
  code: string;
  title: string;
  qty: number;
  flow: 'IN' | 'OUT';
  serial: string;
}

/**
 * 일정 메모 안의 재고 줄을 인식해 즉시 입·출고로 기록하는 패널(메모 textarea 바로 아래에 결합).
 * - "FTG13-0005 CLBX5 (Cell X5) 48" 같은 "코드 품목명 수량" 줄을 자동 인식
 * - "Hardcase 2" 같은 코드 없는 "품목명 수량" 줄도 인식(시리얼/세트 표기인 콜론 줄은 제외)
 * - 행을 직접 추가해 품목코드·품목명·수량·시리얼을 손으로 입력할 수도 있다
 * 기록된 품목 id는 onLink로 돌려줘 일정의 연관 데이터(linkedIds)에 자동 연결한다.
 */
export default function ScheduleMemoInventory({
  memo,
  scheduleTitle,
  client,
  onLink,
}: {
  memo: string;
  scheduleTitle: string;
  client?: string;
  onLink: (assetIds: string[]) => void;
}) {
  const { showToast, logActivity, reloadRecords } = useApp();
  const [rows, setRows] = useState<Row[]>([]);

  const parseMemo = () => {
    const out: Row[] = [];
    memo.split('\n').forEach(raw => {
      const line = raw.trim();
      if (!line) return;
      // ① "품목코드 품목명 수량" — 예: FTG13-0005 CLBX5 (Cell X5) 48
      let m = line.match(/^([A-Za-z]{2,6}\d{1,3}-\d{3,6})\s+(.+?)\s+(\d{1,4})$/);
      if (m) {
        out.push({ code: m[1], title: m[2].trim(), qty: Number(m[3]), flow: 'IN', serial: '' });
        return;
      }
      // ② 코드 없는 "품목명 수량" — 예: Hardcase 2 (Hub:LHP1-… 같은 시리얼 줄 오인 방지를 위해 콜론 줄 제외)
      if (!line.includes(':')) {
        m = line.match(/^([A-Za-z][\w\s\-_+()./]{1,40}?)\s+(\d{1,3})$/);
        if (m) out.push({ code: '', title: m[1].trim(), qty: Number(m[2]), flow: 'IN', serial: '' });
      }
    });
    if (out.length === 0) {
      showToast('메모에서 재고 형식 줄을 찾지 못했습니다. (예: FTG13-0005 CLBX5 48)');
      return;
    }
    setRows(out);
    showToast(`${out.length}개 품목을 인식했습니다. 확인 후 기록하세요.`);
  };

  const update = (i: number, patch: Partial<Row>) =>
    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const recordAll = () => {
    const valid = rows.filter(r => (r.code.trim() || r.title.trim()) && Math.abs(Number(r.qty)) > 0);
    if (valid.length === 0) {
      showToast('기록할 품목이 없습니다. 코드(또는 품목명)와 수량을 확인하세요.');
      return;
    }
    const ids: string[] = [];
    valid.forEach(r => {
      const rec = addRecord({
        title: r.title.trim() || r.code.trim(),
        type: 'asset',
        category: '재고',
        attrs: {
          code: r.code.trim(),
          qty: Math.abs(Number(r.qty)),
          flow: r.flow,
          ...(client ? { client } : {}),
          ...(r.serial.trim() ? { serial: r.serial.trim() } : {}),
          memo: `[일정] ${scheduleTitle || '제목 없음'}`,
        },
      });
      ids.push(rec.id);
    });
    reloadRecords();
    onLink(ids);
    logActivity('UPDATE_INV', '일정 메모 재고 기록', `${valid.length}건 입출고 처리`);
    showToast(`${valid.length}건 재고를 기록했습니다.`);
    setRows([]);
  };

  return (
    <div style={{ marginTop: '0.45rem' }}>
      <div style={{ display: 'flex', gap: '0.4rem' }}>
        <button type="button" className="ghost-btn" onClick={parseMemo}>메모에서 재고 인식</button>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => setRows(prev => [...prev, { code: '', title: '', qty: 1, flow: 'IN', serial: '' }])}
        >
          재고 직접 추가
        </button>
      </div>

      {rows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.5rem' }}>
          {rows.map((r, i) => (
            <div
              key={i}
              style={{
                border: '1px solid var(--panel-border)', borderRadius: '10px', padding: '0.5rem',
                background: 'var(--surface-color)', display: 'flex', flexDirection: 'column', gap: '0.35rem',
              }}
            >
              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                <input className="input-sm" placeholder="품목코드" value={r.code}
                  onChange={e => update(i, { code: e.target.value })} style={{ flex: 1, minWidth: 0 }} />
                <input className="input-sm" type="number" min={1} value={r.qty}
                  onChange={e => update(i, { qty: Number(e.target.value) })} style={{ width: '62px', flexShrink: 0 }} />
                <button
                  type="button"
                  onClick={() => update(i, { flow: r.flow === 'IN' ? 'OUT' : 'IN' })}
                  style={{
                    flexShrink: 0, fontSize: '0.7rem', fontWeight: 700, padding: '0.35rem 0.5rem', borderRadius: '8px',
                    border: 'none', cursor: 'pointer',
                    background: r.flow === 'OUT' ? 'var(--danger-soft-bg)' : 'var(--success-soft-bg)',
                    color: r.flow === 'OUT' ? 'var(--danger)' : 'var(--success)',
                  }}
                >
                  {r.flow === 'OUT' ? '출고' : '입고'}
                </button>
                <button type="button" onClick={() => setRows(prev => prev.filter((_, idx) => idx !== i))}
                  style={{ flexShrink: 0, border: 'none', background: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '0.2rem' }}>
                  <X size={14} />
                </button>
              </div>
              <input className="input-sm" placeholder="품목명(사이즈)" value={r.title}
                onChange={e => update(i, { title: e.target.value })} />
              <input className="input-sm" placeholder="시리얼 번호(선택)" value={r.serial}
                onChange={e => update(i, { serial: e.target.value })} />
            </div>
          ))}
          <button type="button" className="ghost-btn" style={{ width: '100%', fontWeight: 700 }} onClick={recordAll}>
            {rows.length}건 재고 기록
          </button>
        </div>
      )}
    </div>
  );
}
