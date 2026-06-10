'use client';

import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { ClipboardList, ChevronDown, AlertTriangle } from 'lucide-react';
import SearchSelect from './SearchSelect';
import CustomSelect from './CustomSelect';
import ClientPicker from './ClientPicker';
import type { AppSettings } from '@/database';

/**
 * 재고 등록/수정 모달 (page.tsx에서 추출 — 동작 동일).
 * 품목코드/품목명 검색선택, 입출고 이력, 음수 재고 경고 포함.
 */
export default function InventoryEditModal({
  editingInventory,
  setEditingInventory,
  onClose,
  saveInventory,
  deleteInventoryItem,
  knownCodes,
  namesByCode,
  categoryByCode,
  appSettings,
  sortedClients,
}: {
  editingInventory: any;
  setEditingInventory: (v: any) => void;
  onClose: () => void;
  saveInventory: () => void;
  deleteInventoryItem: (id: string) => void;
  knownCodes: string[];
  namesByCode: Record<string, string[]>;
  categoryByCode: Record<string, string>;
  appSettings: AppSettings;
  sortedClients: string[];
}) {
  return (
          <div className="modal-overlay" onClick={onClose}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} transition={{ duration: 0.15 }} className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="ios-modal-header">
                <button className="ios-text-btn" onClick={onClose}>취소</button>
                <div className="ios-modal-title">재고 등록</div>
                <button className="ios-text-btn bold" onClick={saveInventory}>저장</button>
              </div>

              {/* 품목코드 및 품목명 각각 독립된 세로 form-group 으로 배치하여 100% 화면에 핏(Fit)되도록 교정! */}
              <SearchSelect
                label="품목코드"
                required
                value={editingInventory.attrs.code || ''}
                options={knownCodes}
                placeholder="품목코드 검색 또는 입력"
                emptyText="기존 코드가 없습니다. 입력한 값으로 등록됩니다."
                onChange={code => {
                  const codeT = code.trim();
                  const names = namesByCode[codeT] || [];
                  const savedCat = categoryByCode[codeT];
                  setEditingInventory({
                    ...editingInventory,
                    // 코드에 저장된 카테고리 자동 선택
                    category: savedCat || editingInventory.category,
                    // 품목명: 이미 입력값이 있으면 유지, 없고 후보가 1개뿐이면 자동 채움(여러 개면 아래 드롭다운에서 선택)
                    title: editingInventory.title?.trim() ? editingInventory.title : (names.length === 1 ? names[0] : editingInventory.title),
                    attrs: { ...editingInventory.attrs, code },
                  });
                }}
              />

              <SearchSelect
                label="품목명"
                value={editingInventory.title}
                options={namesByCode[(editingInventory.attrs.code || '').trim()] || []}
                placeholder="품목명 검색 또는 입력"
                emptyText="이 코드로 등록된 품목명이 없습니다. 입력한 값으로 등록됩니다."
                onChange={t => setEditingInventory({ ...editingInventory, title: t })}
              />

              {/* Category Dropdown (Master Data Only) */}
              <div className="form-group">
                <span className="form-label">카테고리</span>
                <CustomSelect
                  value={editingInventory.category || ''}
                  options={[
                    { value: '', label: '' },
                    ...(appSettings.categories || ['재고', 'IT 장비', '촬영 장비', '사무 용품', '기타']).map(cat => ({
                      value: cat,
                      label: cat
                    }))
                  ]}
                  onChange={val => setEditingInventory({...editingInventory, category: val})}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.8rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <span className="form-label">수량<span className="req-star">*</span></span>
                  <input type="number" className="input-sm" value={editingInventory.attrs.qty ?? 0} onChange={e => setEditingInventory({...editingInventory, attrs: { ...editingInventory.attrs, qty: Number(e.target.value) }})} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <span className="form-label">구분</span>
                  <CustomSelect
                    value={editingInventory.attrs.flow || 'IN'}
                    options={[
                      { value: 'IN', label: '입고' },
                      { value: 'OUT', label: '출고' }
                    ]}
                    onChange={val => setEditingInventory({...editingInventory, attrs: { ...editingInventory.attrs, flow: val }})}
                  />
                </div>
              </div>

              {/* Storage Location Dropdown (Master Data Only) */}
              <div className="form-group">
                <span className="form-label">보관 창고<span className="req-star">*</span></span>
                <CustomSelect
                  value={editingInventory.attrs.loc || ''}
                  placeholder="보관 창고 선택"
                  options={(appSettings.locations || ['비즈니스 창고', '메인 매장', '이동용 밴', 'A창고', 'B창고']).map(loc => ({
                    value: loc,
                    label: loc
                  }))}
                  onChange={val => setEditingInventory({...editingInventory, attrs: { ...editingInventory.attrs, loc: val }})}
                />
              </div>

              {/* Manager Dropdown (Master Data Only) */}
              <div className="form-group">
                <span className="form-label">담당 관리자<span className="req-star">*</span></span>
                <CustomSelect
                  value={editingInventory.attrs.mgr || ''}
                  placeholder="담당 관리자 선택"
                  options={(appSettings.managers || ['윤상영', '김철수', '이영희', '박민수']).map(mgr => ({
                    value: mgr,
                    label: mgr
                  }))}
                  onChange={val => setEditingInventory({...editingInventory, attrs: { ...editingInventory.attrs, mgr: val }})}
                />
              </div>

              {/* 고객사 선택 */}
              <ClientPicker
                value={editingInventory.attrs.client || ''}
                clients={sortedClients}
                onChange={v => setEditingInventory({ ...editingInventory, attrs: { ...editingInventory.attrs, client: v } })}
              />

              {/* Serial Number Input */}
              <div className="form-group">
                <span className="form-label">시리얼 번호</span>
                <input
                  type="text"
                  className="input-sm"
                  placeholder="시리얼 번호"
                  value={editingInventory.attrs.serial || ''}
                  onChange={e => setEditingInventory({...editingInventory, attrs: { ...editingInventory.attrs, serial: e.target.value }})}
                />
              </div>

              {/* Memo Textarea */}
              <div className="form-group">
                <span className="form-label">메모</span>
                <textarea
                  rows={5}
                  className="input-sm"
                  placeholder=""
                  style={{ resize: 'vertical', lineHeight: 1.5, fontSize: '0.85rem' }}
                  value={editingInventory.attrs.memo || ''}
                  onChange={e => setEditingInventory({ ...editingInventory, attrs: { ...editingInventory.attrs, memo: e.target.value } })}
                />
              </div>

              {/* 📜 입출고 이력 (트랜잭션 로그) */}
              {Array.isArray(editingInventory.attrs.txns) && editingInventory.attrs.txns.length > 0 && (
                <details className="form-group" style={{ textAlign: 'left' }}>
                  <summary style={{ cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    <ClipboardList size={13} style={{ color: 'var(--accent)' }} />
                    <span>입출고 이력 ({editingInventory.attrs.txns.length}건)</span>
                    <ChevronDown size={13} style={{ marginLeft: 'auto', color: 'var(--text-tertiary)' }} />
                  </summary>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                    {[...editingInventory.attrs.txns].reverse().map((tx: any) => (
                      <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.55rem', borderRadius: '8px', background: 'var(--surface-elevated)', border: '1px solid var(--surface-elevated-border)' }}>
                        <span className="badge" style={{ flexShrink: 0, fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.35rem', borderRadius: '4px', background: tx.flow === 'OUT' ? 'var(--danger-soft-bg)' : 'var(--success-soft-bg)', color: tx.flow === 'OUT' ? 'var(--danger)' : 'var(--success)' }}>
                          {tx.flow === 'OUT' ? '출고' : '입고'}
                        </span>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, flexShrink: 0, color: tx.flow === 'OUT' ? 'var(--danger)' : 'var(--success)' }}>
                          {tx.flow === 'OUT' ? '-' : '+'}{tx.qty}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', flexShrink: 0 }}>→ {tx.balance}개</span>
                        <span style={{ fontSize: '0.66rem', color: 'var(--text-tertiary)', marginLeft: 'auto', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {[tx.client, tx.mgr].filter(Boolean).join(' · ')}{tx.ts ? ` · ${format(parseISO(tx.ts), 'MM.dd HH:mm')}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {Number(editingInventory.attrs.qty) < 0 && (
                <div style={{
                  background: 'var(--danger-soft-bg)',
                  border: '1px solid var(--danger-soft-border)',
                  borderRadius: '10px',
                  padding: '0.55rem 0.7rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                  fontSize: '0.72rem',
                  color: 'var(--danger)',
                  fontWeight: 600,
                  textAlign: 'left'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span className="badge" style={{ background: 'var(--danger)', color: '#ffffff', border: 'none', fontSize: '0.62rem', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 800 }}>
                      재고 부족
                    </span>
                    <AlertTriangle size={13} style={{ color: 'var(--danger)' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <span>현재 재고가 부족한 음수 상태입니다.</span>
                    <span>보유분보다 많이 출고된 미배송/미정산 상태로 추적됩니다.</span>
                  </div>
                </div>
              )}

              {editingInventory.id && <button className="ios-delete-btn" onClick={() => deleteInventoryItem(editingInventory.id)}>재고 삭제</button>}
            </motion.div>
          </div>
  );
}
