'use client';

import { forwardRef, useImperativeHandle, useState } from 'react';
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

export interface ScheduleMemoInventoryHandle {
  /** 보류 중인 행을 입·출고로 기록하고 생성/합산된 품목 id 목록을 돌려준다(행 없으면 빈 배열). */
  recordPending: () => string[];
}

/**
 * 일정 안에서 재고를 직접 입력하는 패널(메모 textarea 바로 아래에 결합).
 * 행을 추가해 품목코드·품목명·수량·시리얼을 입력하면 "일정 저장" 시 함께 입·출고로 기록된다
 * (같은 코드+품목명은 기존 재고에 합산). 별도 기록 버튼을 누를 필요가 없다.
 * 기록된 품목 id는 부모(일정 모달)가 받아 일정의 연관 데이터(linkedIds)로 연결한다.
 */
const ScheduleMemoInventory = forwardRef<
  ScheduleMemoInventoryHandle,
  { scheduleTitle: string; client?: string }
>(function ScheduleMemoInventory({ scheduleTitle, client }, ref) {
  const { showToast, logActivity, reloadRecords } = useApp();
  const [rows, setRows] = useState<Row[]>([]);

  const update = (i: number, patch: Partial<Row>) =>
    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  useImperativeHandle(ref, () => ({
    recordPending(): string[] {
      const valid = rows.filter(r => (r.code.trim() || r.title.trim()) && Math.abs(Number(r.qty)) > 0);
      if (valid.length === 0) return [];
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
      logActivity('UPDATE_INV', '일정 재고 기록', `${valid.length}건 입출고 처리`);
      showToast(`${valid.length}건 재고를 기록했습니다.`);
      setRows([]);
      return ids;
    },
  }));

  return (
    <div style={{ marginTop: '0.45rem' }}>
      <button
        type="button"
        className="ghost-btn"
        onClick={() => setRows(prev => [...prev, { code: '', title: '', qty: 1, flow: 'IN', serial: '' }])}
      >
        재고 직접 추가
      </button>

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
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent)', textAlign: 'center', padding: '0.2rem 0' }}>
            일정을 저장하면 {rows.length}건이 재고에 함께 기록됩니다
          </div>
        </div>
      )}
    </div>
  );
});

export default ScheduleMemoInventory;
