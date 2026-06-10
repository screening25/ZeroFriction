'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { useApp } from '@/frontend/context/AppContext';
import { updateRecord } from '@/database';

/**
 * 입출고 로그 모달 (page.tsx에서 추출 — 동작 동일).
 * 전체 재고 트랜잭션 통합 로그(최신순), 항목별 수정/삭제(잔량·순재고 재계산), CSV 내보내기 포함.
 */
export default function TxnLogModal({ onClose }: { onClose: () => void }) {
  const { records, showToast, reloadRecords } = useApp();

  const [editingTxnId, setEditingTxnId] = useState<string | null>(null); // 수정 중인 로그 항목
  const [txnDraft, setTxnDraft] = useState<{ flow: 'IN' | 'OUT'; qty: number; memo: string }>({ flow: 'IN', qty: 0, memo: '' });

  // 전체 재고의 입출고 트랜잭션을 시간 역순으로 모은 통합 로그
  const allTxns = useMemo(() => {
    const rows: any[] = [];
    records.filter(r => r.type === 'asset').forEach(r => {
      (r.attrs.txns || []).forEach((tx: any) => rows.push({ ...tx, recId: r.id, itemTitle: r.title, itemCode: (r.attrs.code || '').trim() }));
    });
    rows.sort((a, b) => (b.ts || '').localeCompare(a.ts || ''));
    return rows;
  }, [records]);

  // 입출고 로그 항목 수정/삭제 — txn 변경 후 해당 품목의 잔량·순재고를 시간순으로 재계산
  const recomputeItemFromTxns = (rec: any, txns: any[]) => {
    const sorted = [...txns].sort((a, b) => (a.ts || '').localeCompare(b.ts || ''));
    let bal = 0;
    sorted.forEach(t => { bal += (t.flow === 'OUT' ? -1 : 1) * (Math.abs(Number(t.qty)) || 0); t.balance = bal; });
    updateRecord(rec.id, { attrs: { ...rec.attrs, txns: sorted, qty: bal, flow: bal < 0 ? 'OUT' : 'IN' } });
  };
  const saveTxnEdit = (recId: string, txnId: string, changes: { flow?: 'IN' | 'OUT'; qty?: number; memo?: string }) => {
    const rec = records.find(r => r.id === recId);
    if (!rec) return;
    const txns = (rec.attrs.txns || []).map((t: any) => t.id === txnId ? { ...t, ...changes, qty: Math.abs(Number(changes.qty ?? t.qty)) || 0 } : t);
    recomputeItemFromTxns(rec, txns);
    reloadRecords();
    showToast('입출고 기록을 수정했습니다.');
  };
  const deleteTxn = (recId: string, txnId: string) => {
    const rec = records.find(r => r.id === recId);
    if (!rec) return;
    const txns = (rec.attrs.txns || []).filter((t: any) => t.id !== txnId);
    recomputeItemFromTxns(rec, txns);
    reloadRecords();
    showToast('입출고 기록을 삭제했습니다.');
  };

  // 입출고 로그 CSV 내보내기
  const exportTxnLog = () => {
    if (allTxns.length === 0) { showToast('내보낼 입출고 로그가 없습니다.'); return; }
    const header = ['일시', '구분', '품목코드', '품목명', '수량', '직후잔량', '보관위치', '담당자', '고객사', '메모'];
    const rows = allTxns.map(t => [
      t.ts ? format(parseISO(t.ts), 'yyyy-MM-dd HH:mm') : '',
      t.flow === 'OUT' ? '출고' : '입고',
      t.itemCode || '', t.itemTitle || '', t.qty ?? '', t.balance ?? '',
      t.loc || '', t.mgr || '', t.client || '', (t.memo || '').replace(/[\r\n]+/g, ' '),
    ]);
    const csv = '﻿' + [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `입출고로그_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    a.click(); URL.revokeObjectURL(url);
    showToast(`입출고 로그 ${allTxns.length}건을 내보냈습니다.`);
  };

  return (
              <div className="modal-overlay" onClick={onClose}>
                <motion.div
                  className="modal-content"
                  onClick={e => e.stopPropagation()}
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  style={{ maxWidth: '480px', width: '95%' }}
                >
                  <div className="ios-modal-header">
                    <button className="ios-text-btn" onClick={onClose}>닫기</button>
                    <div className="ios-modal-title">입출고 로그</div>
                    <button className="ios-text-btn bold" onClick={exportTxnLog}>CSV</button>
                  </div>

                  <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', margin: '0.2rem 0 0.5rem' }}>
                    전체 {allTxns.length}건 · 최신순
                  </div>

                  {allTxns.length === 0 ? (
                    <div className="empty-box" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>입출고 기록이 없습니다.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '60vh', overflowY: 'auto' }}>
                      {allTxns.map((t, i) => {
                        const isEditing = editingTxnId === t.id;
                        return (
                        <div key={t.id || i} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '0.5rem 0.6rem', borderRadius: '10px', background: 'var(--surface-elevated)', border: '1px solid var(--surface-elevated-border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="badge" style={{ flexShrink: 0, fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.35rem', borderRadius: '4px', background: t.flow === 'OUT' ? 'var(--danger-soft-bg)' : 'var(--success-soft-bg)', color: t.flow === 'OUT' ? 'var(--danger)' : 'var(--success)' }}>
                              {t.flow === 'OUT' ? '출고' : '입고'}
                            </span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, flexShrink: 0, color: t.flow === 'OUT' ? 'var(--danger)' : 'var(--success)', width: '3rem' }}>
                              {t.flow === 'OUT' ? '-' : '+'}{t.qty}개
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', minWidth: 0 }}>
                                {t.itemCode && <span style={{ fontSize: '0.6rem', fontFamily: 'monospace', color: 'var(--accent)', flexShrink: 0 }}>{t.itemCode}</span>}
                                <span style={{ fontSize: '0.76rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.itemTitle}</span>
                              </div>
                              <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {[t.client, t.mgr, t.loc].filter(Boolean).join(' · ')}{(t.client || t.mgr || t.loc) ? ' · ' : ''}잔량 {t.balance}개{t.ts ? ` · ${format(parseISO(t.ts), 'MM.dd HH:mm')}` : ''}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => { if (isEditing) { setEditingTxnId(null); } else { setEditingTxnId(t.id); setTxnDraft({ flow: t.flow === 'OUT' ? 'OUT' : 'IN', qty: Math.abs(Number(t.qty)) || 0, memo: t.memo || '' }); } }}
                              style={{ flexShrink: 0, background: 'transparent', border: '1px solid var(--panel-border)', borderRadius: '6px', padding: '0.15rem 0.4rem', fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer' }}
                            >
                              {isEditing ? '닫기' : '수정'}
                            </button>
                          </div>

                          {isEditing && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid var(--panel-border)' }}>
                              <select className="input-sm" style={{ width: 'auto', flexShrink: 0, fontWeight: 700, color: txnDraft.flow === 'IN' ? 'var(--success)' : 'var(--danger)' }} value={txnDraft.flow} onChange={e => setTxnDraft({ ...txnDraft, flow: e.target.value as 'IN' | 'OUT' })}>
                                <option value="IN">입고</option>
                                <option value="OUT">출고</option>
                              </select>
                              <input type="number" min="0" className="input-sm" style={{ width: '5rem', flexShrink: 0 }} value={txnDraft.qty} onChange={e => setTxnDraft({ ...txnDraft, qty: Math.max(0, parseInt(e.target.value, 10) || 0) })} />
                              <input type="text" className="input-sm" style={{ flex: 1, minWidth: '6rem' }} placeholder="메모" value={txnDraft.memo} onChange={e => setTxnDraft({ ...txnDraft, memo: e.target.value })} />
                              <button type="button" onClick={() => { saveTxnEdit(t.recId, t.id, txnDraft); setEditingTxnId(null); }} style={{ flexShrink: 0, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.3rem 0.6rem', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>저장</button>
                              <button type="button" onClick={() => { if (confirm('이 입출고 기록을 삭제할까요? 해당 품목 수량이 다시 계산됩니다.')) { deleteTxn(t.recId, t.id); setEditingTxnId(null); } }} style={{ flexShrink: 0, background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger-soft-border)', borderRadius: '6px', padding: '0.3rem 0.6rem', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>삭제</button>
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              </div>
  );
}
