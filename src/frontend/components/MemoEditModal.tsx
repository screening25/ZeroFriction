'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Pin, FileSpreadsheet, Printer } from 'lucide-react';
import ClientPicker from './ClientPicker';
import Markdown from './Markdown';
import AttachmentField from './AttachmentField';
import { useApp } from '@/frontend/context/AppContext';
import { getMemoModalStyle } from '@/frontend/utils/styles';
import type { UniversalRecord, AttachmentMeta } from '@/database';

type MemoForm = { id?: string; title: string; content: string; pinned?: boolean; color?: string; client?: string; files?: AttachmentMeta[] };

/**
 * 메모 보기/편집 모달 (page.tsx에서 추출 — 동작 동일).
 * 읽기 전용 상세보기, 마크다운 에디터, @멘션 자동완성, 색상/고정 설정, Excel/PDF 내보내기 포함.
 */
export default function MemoEditModal({
  memoForm,
  setMemoForm,
  onClose,
  isMemoEditing,
  setIsMemoEditing,
  submitMemo,
  deleteMemo,
  exportToCsv,
  printToPdf,
  theme,
  sortedClients,
  schedules,
  inventory,
}: {
  memoForm: MemoForm;
  setMemoForm: (f: MemoForm) => void;
  onClose: () => void;
  isMemoEditing: boolean;
  setIsMemoEditing: (v: boolean) => void;
  submitMemo: () => void;
  deleteMemo: (id: string) => void;
  exportToCsv: (type: 'event' | 'asset' | 'memo', specificRecordId?: string) => void;
  printToPdf: (type: 'event' | 'asset' | 'memo', specificRecordId?: string) => void;
  theme: 'light' | 'dark';
  sortedClients: string[];
  schedules: UniversalRecord[];
  inventory: UniversalRecord[];
}) {
  const { records } = useApp();

  // States for @mention suggestion autocomplete popup
  const [mentionTriggerInfo, setMentionTriggerInfo] = useState<{ query: string; triggerIndex: number } | null>(null);
  const [hoveredMentionId, setHoveredMentionId] = useState<string | null>(null);

  // 첨부파일 목록 — 호출부가 memoForm.files를 채우지 않아도 기존 첨부가 보존되도록 레코드에서 보충한다.
  const memoFiles = memoForm.files ?? (memoForm.id ? records.find(r => r.id === memoForm.id)?.attrs.files || [] : []);

  // Autocomplete / suggestion helpers for @mentions in textarea
  const getMentionQuery = (text: string, cursorIndex: number) => {
    const beforeCursor = text.substring(0, cursorIndex);
    const lastAtIdx = beforeCursor.lastIndexOf('@');
    if (lastAtIdx === -1) return null;
    
    const textSinceAt = beforeCursor.substring(lastAtIdx + 1);
    if (/\s/.test(textSinceAt)) return null;
    
    if (lastAtIdx > 0 && !/\s/.test(beforeCursor[lastAtIdx - 1])) {
      return null;
    }
    
    return {
      query: textSinceAt,
      triggerIndex: lastAtIdx
    };
  };

  const filteredMentionItems = (() => {
    if (!mentionTriggerInfo) return [];
    const q = mentionTriggerInfo.query.toLowerCase().trim();
    
    const candidates = [
      ...schedules.map(s => ({ id: s.id, title: s.title, type: 'event' })),
      ...inventory.map(i => ({ id: i.id, title: i.title, type: 'asset' }))
    ];
    
    const filtered = q 
      ? candidates.filter(c => c.title.toLowerCase().includes(q))
      : candidates;
      
    return filtered.slice(0, 8);
  })();

  const selectMention = (title: string) => {
    const textarea = document.querySelector('.memo-content-textarea') as HTMLTextAreaElement;
    if (!textarea || !mentionTriggerInfo) return;
    
    const text = memoForm.content;
    const start = mentionTriggerInfo.triggerIndex;
    const end = textarea.selectionStart;
    
    const formattedMention = title.includes(' ') ? `@"${title}"` : `@${title}`;
    const before = text.substring(0, start);
    const after = text.substring(end);
    
    const newContent = before + formattedMention + ' ' + after;
    setMemoForm({ ...memoForm, content: newContent });
    setMentionTriggerInfo(null);
    setHoveredMentionId(null);
    
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + formattedMention.length + 1;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 50);
  };

  return (
          <div className="modal-overlay" onClick={onClose}>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }} 
              transition={{ duration: 0.15 }} 
              className="modal-content memo-modal-content"
              style={{
                ...getMemoModalStyle(memoForm.color || '', theme === 'dark'),
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                padding: '1.25rem',
                maxWidth: '480px',
                borderRadius: '20px',
                border: '1px solid var(--panel-border)',
                transition: 'background-color 0.3s ease, border-color 0.3s ease'
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: '0.6rem' }}>
                <button
                  className="memo-text-btn"
                  onClick={onClose}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '0.82rem', cursor: 'pointer' }}
                >
                  {isMemoEditing ? '취소' : '닫기'}
                </button>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>메모</div>
                {/* 편집 모드: 저장 / 보기 모드: 수정 진입 + 엑셀 & PDF 내보내기 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  {!isMemoEditing && memoForm.id && (
                    <>
                      {/* 엑셀 내보내기 */}
                      <button
                        type="button"
                        onClick={() => exportToCsv('memo', memoForm.id)}
                        title="이 메모 Excel로 내보내기"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '0.25rem',
                          borderRadius: '6px',
                          transition: 'background-color 0.15s ease',
                          flexShrink: 0
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <FileSpreadsheet size={13} />
                      </button>
                      {/* PDF 내보내기 */}
                      <button
                        type="button"
                        onClick={() => printToPdf('memo', memoForm.id)}
                        title="이 메모 PDF로 저장/인쇄"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '0.25rem',
                          borderRadius: '6px',
                          transition: 'background-color 0.15s ease',
                          flexShrink: 0
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <Printer size={13} />
                      </button>
                    </>
                  )}
                  {isMemoEditing ? (
                    <button
                      className="memo-text-btn save-btn"
                      onClick={submitMemo}
                      style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer' }}
                    >
                      저장
                    </button>
                  ) : (
                    <button
                      className="memo-text-btn save-btn"
                      onClick={() => setIsMemoEditing(true)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer' }}
                    >
                      수정
                    </button>
                  )}
                </div>
              </div>

              {/* 보기 모드: 읽기 전용 상세보기 / 편집 모드: 에디터 */}
              {isMemoEditing ? (
              <>
              {/* Editor Workspace */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', flex: 1 }}>
                <input
                  type="text"
                  placeholder="제목"
                  value={memoForm.title}
                  onChange={e => setMemoForm({...memoForm, title: e.target.value})}
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: '1.2rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    padding: '0.2rem 0'
                  }}
                />

                {/* Minimalist Formatting Toolbar */}
                <div style={{
                  display: 'flex',
                  gap: '0.4rem',
                  alignItems: 'center',
                  fontSize: '0.72rem',
                  color: 'var(--text-secondary)',
                  borderBottom: '1px solid rgba(0,0,0,0.04)',
                  paddingBottom: '0.4rem'
                }}>
                  {[
                    { label: 'H1', syntax: '# ' },
                    { label: 'H2', syntax: '## ' },
                    { label: '굵게', syntax: '**텍스트**' },
                    { label: '기울임', syntax: '*텍스트*' },
                    { label: '글머리', syntax: '\n- ' },
                    { label: '할일', syntax: '\n- [ ] ' }
                  ].map(btn => (
                    <button
                      key={btn.label}
                      type="button"
                      onClick={() => {
                        const textarea = document.querySelector('.memo-content-textarea') as HTMLTextAreaElement;
                        if (!textarea) return;
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const text = textarea.value;
                        const before = text.substring(0, start);
                        const after = text.substring(end, text.length);
                        const val = before + btn.syntax + after;
                        setMemoForm({ ...memoForm, content: val });
                        setTimeout(() => {
                          textarea.focus();
                          textarea.setSelectionRange(start + btn.syntax.length, start + btn.syntax.length);
                        }, 50);
                      }}
                      style={{
                        background: 'rgba(0,0,0,0.03)',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0.2rem 0.45rem',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: 1, marginTop: '0.4rem' }}>
                  {/* Mention Autocomplete List (Absolute positioned overlaying the textarea, so it NEVER shifts layout!) */}
                  {mentionTriggerInfo && filteredMentionItems.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      zIndex: 100,
                      background: 'var(--input-bg)',
                      backdropFilter: 'var(--panel-blur)',
                      WebkitBackdropFilter: 'var(--panel-blur)',
                      border: '1px solid var(--panel-border)',
                      borderRadius: '12px',
                      boxShadow: '0 8px 24px var(--shadow-color)',
                      padding: '0.4rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.1rem',
                      maxHeight: '140px',
                      overflowY: 'auto',
                      borderLeft: '4px solid var(--accent)'
                    }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', fontWeight: 700, padding: '0.2rem 0.4rem' }}>
                        언급할 일정 또는 재고 선택
                      </div>
                      {filteredMentionItems.map(item => (
                        <div
                          key={item.id}
                          onClick={() => selectMention(item.title)}
                          onMouseEnter={() => setHoveredMentionId(item.id)}
                          onMouseLeave={() => setHoveredMentionId(null)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            padding: '0.35rem 0.5rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.74rem',
                            transition: 'background 0.15s ease',
                            background: hoveredMentionId === item.id 
                              ? 'var(--row-bg)' 
                              : 'transparent'
                          }}
                        >
                          <span style={{
                            fontSize: '0.62rem',
                            padding: '0.1rem 0.3rem',
                            borderRadius: '4px',
                            fontWeight: 800,
                            background: item.type === 'event' ? 'rgba(0,122,255,0.1)' : 'rgba(52,199,89,0.1)',
                            color: item.type === 'event' ? '#007aff' : '#34c759'
                          }}>
                            {item.type === 'event' ? '일정' : '재고'}
                          </span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                            {item.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <textarea
                    placeholder="내용을 입력해주세요."
                    className="memo-content-textarea"
                    rows={10}
                    value={memoForm.content}
                    onChange={e => {
                      const val = e.target.value;
                      setMemoForm({...memoForm, content: val});
                      const trigger = getMentionQuery(val, e.target.selectionStart);
                      setMentionTriggerInfo(trigger);
                    }}
                    onKeyUp={e => {
                      const target = e.target as HTMLTextAreaElement;
                      const trigger = getMentionQuery(target.value, target.selectionStart);
                      setMentionTriggerInfo(trigger);
                    }}
                    onMouseUp={e => {
                      const target = e.target as HTMLTextAreaElement;
                      const trigger = getMentionQuery(target.value, target.selectionStart);
                      setMentionTriggerInfo(trigger);
                    }}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      resize: 'none',
                      fontSize: '0.85rem',
                      lineHeight: '1.5',
                      color: 'var(--text-primary)',
                      minHeight: '280px',
                      padding: '0.4rem 0',
                      flex: 1
                    }}
                  />
                </div>
              </div>

              {/* 고객사 선택 */}
              <ClientPicker
                value={memoForm.client || ''}
                clients={sortedClients}
                onChange={v => setMemoForm({ ...memoForm, client: v })}
              />

              {/* 첨부 파일 — 본문은 /api/files, 메모에는 메타데이터만 저장 */}
              <AttachmentField
                files={memoFiles}
                onChange={files => setMemoForm({ ...memoForm, files })}
              />

              {/* Bottom Settings Control Bar */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                padding: '0.65rem 0.85rem',
                borderRadius: '12px',
                border: '1px solid var(--panel-border)',
                marginTop: '0.2rem'
              }}>
                {/* Pin Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Pin size={13} style={{ color: memoForm.pinned ? 'var(--accent)' : 'var(--text-tertiary)', transform: 'rotate(45deg)' }} />
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>상단 고정</span>
                  <button
                    type="button"
                    className={`ios-toggle accent ${memoForm.pinned ? 'on' : ''}`}
                    aria-pressed={!!memoForm.pinned}
                    onClick={() => setMemoForm({ ...memoForm, pinned: !memoForm.pinned })}
                    style={{ marginLeft: '0.2rem' }}
                  >
                    <span className="ios-toggle-knob" />
                  </button>
                </div>

                {/* Color Swatches */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    {[
                      { value: '', swatch: 'var(--row-bg)' },
                      { value: 'red', swatch: '#FF3B30' },
                      { value: 'orange', swatch: '#FF9500' },
                      { value: 'yellow', swatch: '#FFCC00' },
                      { value: 'green', swatch: '#34C759' },
                      { value: 'blue', swatch: '#007AFF' },
                      { value: 'purple', swatch: '#AF52DE' }
                    ].map(opt => {
                      const active = memoForm.color === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setMemoForm({ ...memoForm, color: opt.value })}
                          style={{
                            width: '0.95rem',
                            height: '0.95rem',
                            borderRadius: '50%',
                            backgroundColor: opt.swatch,
                            border: opt.value === '' ? '1px solid var(--panel-border)' : 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: active ? '0 0 0 1.5px var(--bg-color), 0 0 0 3px var(--accent)' : 'none',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {active && (
                            <span style={{ color: opt.value === '' || opt.value === 'yellow' ? 'var(--text-primary)' : '#fff', fontSize: '0.5rem', fontWeight: 900 }}>✓</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              </>
              ) : (
              /* 읽기 전용 상세보기 — 제목/내용만 표시, 편집 위젯 없음 */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', flex: 1, minHeight: '280px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.2rem 0' }}>
                  {memoForm.pinned && <Pin size={14} style={{ color: 'var(--accent)', transform: 'rotate(45deg)', flexShrink: 0 }} />}
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {memoForm.title || '(제목 없음)'}
                  </div>
                  {memoForm.client && (
                    <span className="badge" style={{ fontSize: '0.6rem', padding: '0.1rem 0.4rem', flexShrink: 0, background: 'var(--accent-soft-bg)', color: 'var(--accent)', border: '1px solid var(--accent-soft-border)' }}>{memoForm.client}</span>
                  )}
                </div>
                <div style={{ fontSize: '0.85rem', lineHeight: '1.5', color: 'var(--text-primary)', flex: 1, overflowY: 'auto', paddingTop: '0.2rem' }}>
                  {memoForm.content
                    ? <Markdown content={memoForm.content} />
                    : <span style={{ color: 'var(--text-tertiary)' }}>(내용 없음)</span>}
                </div>
                {/* 첨부 파일 (보기 전용 — 칩 클릭으로 열기/다운로드) */}
                <AttachmentField files={memoFiles} readOnly />
              </div>
              )}

              {/* Destructive Delete Button */}
              {memoForm.id && (
                <button 
                  type="button" 
                  onClick={() => {
                    if (confirm('정말로 이 메모를 삭제하시겠습니까?')) {
                      deleteMemo(memoForm.id!);
                    }
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#ff4d4f',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: '0.4rem 0',
                    width: '100%',
                    textAlign: 'center',
                    borderRadius: '8px',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255, 77, 79, 0.08)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  메모 영구 삭제
                </button>
              )}
            </motion.div>
          </div>
  );
}
