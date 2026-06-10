'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import CustomTimePicker from './CustomTimePicker';
import CustomSelect from './CustomSelect';
import CustomDatePicker from './CustomDatePicker';
import ClientPicker from './ClientPicker';
import ScheduleMemoInventory, { type ScheduleMemoInventoryHandle } from './ScheduleMemoInventory';
import { getCategoryColorStyles } from '@/frontend/utils/styles';
import type { AppSettings, UniversalRecord } from '@/database';

/**
 * 일정 등록/수정 모달 (page.tsx에서 추출 — 동작 동일).
 * 카테고리 필, 고객사/날짜/시간, 메모 속 재고 인식·즉시 기록, 알림·반복, 연관 데이터 연결 포함.
 */
export default function ScheduleEditModal({
  editingSchedule,
  setEditingSchedule,
  onClose,
  saveSchedule,
  handleDeleteSchedule,
  appSettings,
  sortedClients,
  records,
}: {
  editingSchedule: UniversalRecord;
  setEditingSchedule: (v: UniversalRecord | null) => void;
  onClose: () => void;
  saveSchedule: () => void;
  handleDeleteSchedule: (id: string) => void;
  appSettings: AppSettings;
  sortedClients: string[];
  records: UniversalRecord[];
}) {
  const getCategoryColor = (cat: string) => getCategoryColorStyles(cat, appSettings.categoryColors).solid;
  const getCategorySoftBg = (cat: string) => getCategoryColorStyles(cat, appSettings.categoryColors).soft;
  const getCategoryBorder = (cat: string) => getCategoryColorStyles(cat, appSettings.categoryColors).border;

  // 일정 저장 시 보류 중인 재고 행을 함께 기록하기 위한 핸들
  const invRef = useRef<ScheduleMemoInventoryHandle>(null);

  const handleSave = () => {
    // 보류 중인 재고 행을 먼저 기록하고, 생성/합산된 품목 id를 이 일정의 연관 데이터로 연결한다.
    // saveSchedule은 같은 클릭 틱에서 setState 결과를 볼 수 없으므로, 저장 직전 1회에 한해
    // editingSchedule 객체의 linkedIds를 직접 갱신한다(곧바로 영속화되고 모달이 닫힘).
    const ids = invRef.current?.recordPending() ?? [];
    if (ids.length > 0) {
      const cur = editingSchedule.attrs.linkedIds || [];
      editingSchedule.attrs.linkedIds = [...cur, ...ids.filter((id: string) => !cur.includes(id))];
    }
    saveSchedule();
  };

  return (
          <div className="modal-overlay" onClick={onClose}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} transition={{ duration: 0.15 }} className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="ios-modal-header">
                <button className="ios-text-btn" onClick={onClose}>취소</button>
                <div className="ios-modal-title">일정 등록</div>
                <button className="ios-text-btn bold" onClick={handleSave}>저장</button>
              </div>
              
              <div className="form-group">
                <span className="form-label">제목<span className="req-star">*</span></span>
                <input type="text" className="input-sm" placeholder="" value={editingSchedule.title} onChange={e => setEditingSchedule({...editingSchedule, title: e.target.value})} />
              </div>

              {/* Strict Isolated Schedule Category pills inside schedule edit modal! */}
              <div className="form-group">
                <span className="form-label">카테고리</span>
                <input 
                  type="text" 
                  className="input-sm" 
                  value={editingSchedule.category || ''} 
                  onChange={e => setEditingSchedule({...editingSchedule, category: e.target.value})} 
                  placeholder="카테고리를 선택하거나 신규로 입력하십시오."
                />

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.45rem' }}>
                  {(appSettings.scheduleCategories || ['업무', '회의', '개인', '일반']).map(cat => {
                    const isSelected = editingSchedule.category === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setEditingSchedule({...editingSchedule, category: cat})}
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '0.15rem 0.45rem',
                          borderRadius: '8px',
                          // Apple-style translucent Cupertino Tint selection!
                          border: isSelected ? `1px solid ${getCategoryBorder(cat)}` : '1px solid var(--panel-border)',
                          background: isSelected ? getCategorySoftBg(cat) : 'var(--surface-color)',
                          color: isSelected ? getCategoryColor(cat) : 'var(--text-secondary)',
                          cursor: 'pointer',
                          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                        }}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* 고객사 선택 */}
              <ClientPicker
                value={editingSchedule.attrs.client || ''}
                clients={sortedClients}
                onChange={v => setEditingSchedule({ ...editingSchedule, attrs: { ...editingSchedule.attrs, client: v } })}
              />

              <div style={{ display: 'flex', gap: '0.8rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', height: '22px' }}>
                    <span className="form-label">날짜<span className="req-star">*</span></span>
                  </div>
                  <CustomDatePicker value={editingSchedule.attrs.date || ''} onChange={date => setEditingSchedule({...editingSchedule, attrs: { ...editingSchedule.attrs, date }})} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '22px' }}>
                    <span className="form-label">시간</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', transform: 'scale(0.85)', transformOrigin: 'right center' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>하루 종일</span>
                      <button
                        type="button"
                        className={`ios-toggle ${editingSchedule.attrs.allDay ? 'on' : ''}`}
                        aria-pressed={!!editingSchedule.attrs.allDay}
                        onClick={() => setEditingSchedule({ ...editingSchedule, attrs: { ...editingSchedule.attrs, allDay: !editingSchedule.attrs.allDay } })}
                      >
                        <span className="ios-toggle-knob" />
                      </button>
                    </div>
                  </div>
                  {editingSchedule.attrs.allDay ? (
                    <div style={{
                      height: '38px',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 0.65rem',
                      borderRadius: '10px',
                      border: '1px solid var(--panel-border)',
                      background: 'var(--hover-bg)',
                      color: 'var(--text-tertiary)',
                      fontSize: '0.78rem',
                      fontWeight: 600
                    }}>
                      하루 종일
                    </div>
                  ) : (
                    <CustomTimePicker value={editingSchedule.attrs.time || '12:00'} onChange={time => setEditingSchedule({...editingSchedule, attrs: { ...editingSchedule.attrs, time }})} />
                  )}
                </div>
              </div>
              
              <div className="form-group">
                <span className="form-label">메모</span>
                <textarea rows={4} className="input-sm" value={editingSchedule.attrs.memo || ''} onChange={e => setEditingSchedule({...editingSchedule, attrs: { ...editingSchedule.attrs, memo: e.target.value }})} />
                {/* 재고 직접 추가 — 행 입력 후 일정 저장 시 함께 입출고 기록·일정에 자동 연결 */}
                <ScheduleMemoInventory
                  ref={invRef}
                  scheduleTitle={editingSchedule.title}
                  client={editingSchedule.attrs.client}
                />
              </div>
              
              <div style={{ display: 'flex', gap: '0.8rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <span className="form-label">알림 설정</span>
                  <CustomSelect
                    value={editingSchedule.attrs.notifyOffset ?? appSettings.defaultNotifyOffset ?? 0}
                    options={[
                      { value: -1, label: '알림 없음' },
                      { value: 0, label: '정각' },
                      { value: 10, label: '10분 전' },
                      { value: 30, label: '30분 전' },
                      { value: 60, label: '1시간 전' },
                      { value: 1440, label: '1일 전' }
                    ]}
                    onChange={val => setEditingSchedule({...editingSchedule, attrs: { ...editingSchedule.attrs, notifyOffset: Number(val) }})}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <span className="form-label">반복 주기</span>
                  <CustomSelect
                    value={editingSchedule.attrs.recurrence ?? 'none'}
                    options={[
                      { value: 'none', label: '없음' },
                      { value: 'daily', label: '매일' },
                      { value: 'weekly', label: '매주' },
                      { value: 'monthly', label: '매월' }
                    ]}
                    onChange={val => setEditingSchedule({...editingSchedule, attrs: { ...editingSchedule.attrs, recurrence: val as any }})}
                  />
                </div>
              </div>

              {/* Linked Related Data (Inventory/Memo) */}
              <div className="form-group" style={{ marginTop: '0.6rem' }}>
                <span className="form-label">연관 데이터 연결</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.2rem', maxHeight: '110px', overflowY: 'auto', padding: '0.1rem' }}>
                  {records
                    .filter(r => r.type === 'asset' || r.type === 'memo')
                    .map(r => {
                      const isLinked = (editingSchedule.attrs.linkedIds || []).includes(r.id);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => {
                            const current = editingSchedule.attrs.linkedIds || [];
                            const next = current.includes(r.id)
                              ? current.filter(id => id !== r.id)
                              : [...current, r.id];
                            setEditingSchedule({
                              ...editingSchedule,
                              attrs: { ...editingSchedule.attrs, linkedIds: next }
                            });
                          }}
                          style={{
                            padding: '0.35rem 0.65rem',
                            borderRadius: '20px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            border: isLinked ? '1px solid var(--accent)' : '1px solid var(--panel-border)',
                            background: isLinked ? 'var(--accent-soft-bg)' : 'var(--bg-secondary)',
                            color: isLinked ? 'var(--accent)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)'
                          }}
                        >
                          <span>{r.type === 'asset' ? '📦' : '📝'}</span>
                          <span>{r.title}</span>
                        </button>
                      );
                    })}
                  {records.filter(r => r.type === 'asset' || r.type === 'memo').length === 0 && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', paddingLeft: '0.2rem' }}>연결 가능한 재고나 메모가 없습니다.</span>
                  )}
                </div>
              </div>
              
              <div className="ios-toggle-row">
                <span className="ios-toggle-label">완료 처리</span>
                <button
                  type="button"
                  className={`ios-toggle ${editingSchedule.attrs.completed ? 'on' : ''}`}
                  aria-pressed={!!editingSchedule.attrs.completed}
                  onClick={() => setEditingSchedule({ ...editingSchedule, attrs: { ...editingSchedule.attrs, completed: !editingSchedule.attrs.completed } })}
                >
                  <span className="ios-toggle-knob" />
                </button>
              </div>

              {editingSchedule.id && <button className="ios-delete-btn" onClick={() => handleDeleteSchedule(editingSchedule.id)}>일정 삭제</button>}
            </motion.div>
          </div>
  );
}
