'use client';

import { format, parseISO } from 'date-fns';
import { Plus, Pin, FileText, FileSpreadsheet, Printer } from 'lucide-react';
import { useApp } from '@/frontend/context/AppContext';
import Markdown from './Markdown';
import { getMemoCardStyle } from '@/frontend/utils/styles';
import type { UniversalRecord } from '@/database';

/**
 * 메모 탭 섹션 (page.tsx에서 추출 — 동작 동일).
 * 작성일 정렬·Excel/PDF 내보내기·메모 추가 헤더, 메모 카드 목록(마크다운
 * 미리보기·체크박스 토글), 페이지네이션 포함.
 */
export default function MemoSection({
  memos,
  displayedMemos,
  memoTotalPages,
  memosPerPage,
  setIsMemoEditing,
}: {
  memos: UniversalRecord[];
  displayedMemos: UniversalRecord[];
  memoTotalPages: number;
  memosPerPage: number;
  setIsMemoEditing: (v: boolean) => void;
}) {
  const {
    records, appSettings, handleSettingsChange, theme,
    memoPage, setMemoPage, setMemoForm, setIsMemoModalOpen,
    deleteMemo, handleDuplicateMemo, updateMemoContentDirectly,
    exportToCsv, printToPdf,
  } = useApp();

  const handleMemoCheckboxToggle = (memoId: string, lineIndex: number, newCheckedState: boolean) => {
    const memo = records.find(m => m.id === memoId && m.type === 'memo');
    if (!memo) return;
    const content = memo.attrs.content || '';
    const lines = content.replace(/\r\n/g, '\n').split('\n');
    if (lineIndex < 0 || lineIndex >= lines.length) return;
    
    const line = lines[lineIndex];
    // Find checkbox pattern: - [ ] or - [x]
    const updatedLine = line.replace(/^(\s*[-*]\s+\[)([ xX])(\]\s+.*)$/, (_match: string, prefix: string, _checked: string, suffix: string) => {
      return `${prefix}${newCheckedState ? 'x' : ' '}${suffix}`;
    });
    
    lines[lineIndex] = updatedLine;
    const newContent = lines.join('\n');
    
    updateMemoContentDirectly(memo.id, newContent);
  };

  return (
        <section>
          <div className="section-header">
            <div className="section-title">메모</div>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              {/* 정렬: 작성일 최신순(↓)/오래된순(↑) */}
              <button
                className="btn-ghost"
                onClick={() => handleSettingsChange({ ...appSettings, memoSort: appSettings.memoSort === 'asc' ? 'desc' : 'asc' })}
                title="작성일 정렬"
                style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 700, border: '1px solid var(--panel-border)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', flexShrink: 0 }}
              >
                작성일 {appSettings.memoSort === 'asc' ? '↑' : '↓'}
              </button>
              {/* 📊 엑셀 내보내기 버튼 */}
              <button
                className="btn-ghost"
                onClick={() => exportToCsv('memo')}
                title="메모 엑셀 다운로드"
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.3rem', 
                  padding: '0.25rem 0.55rem', 
                  borderRadius: '6px', 
                  fontSize: '0.72rem', 
                  fontWeight: 650, 
                  border: '1px solid var(--panel-border)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                  flexShrink: 0
                }}
              >
                <FileSpreadsheet size={12} />
                <span className="btn-label-hide-md">Excel</span>
              </button>

              {/* 🖨️ PDF 인쇄 버튼 */}
              <button 
                className="btn-ghost" 
                onClick={() => printToPdf('memo')}
                title="메모 PDF 인쇄"
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.3rem', 
                  padding: '0.25rem 0.55rem', 
                  borderRadius: '6px', 
                  fontSize: '0.72rem', 
                  fontWeight: 650, 
                  border: '1px solid var(--panel-border)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                  flexShrink: 0
                }}
              >
                <Printer size={12} />
                <span className="btn-label-hide-md">PDF</span>
              </button>

              <button 
                className="btn-ghost" 
                onClick={() => {
                  setMemoForm({ title: '', content: '', pinned: false, color: '' });
                  setIsMemoEditing(true); // 신규 메모는 곧바로 편집 모드로 진입
                  setIsMemoModalOpen(true);
                }}
                title="메모 추가"
                style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Plus size={16} />
              </button>
              <FileText size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            </div>
          </div>

          <div className="card-list" style={{ gap: '1.25rem' }}>
            {memos.length === 0 ? (
              <div className="empty-box">등록된 메모가 없습니다.</div>
            ) : null}

            {displayedMemos.map((m, idx) => (
              <div
                key={m.id}
                className="card card-compact"
                style={{
                  padding: '1.25rem',
                  borderRadius: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  height: '150px',      // 모든 메모 카드 높이 통일
                  overflow: 'hidden',   // 내용이 길어도 카드 크기는 고정 (초과분 클리핑)
                  ...getMemoCardStyle(m.attrs.color || '', theme === 'dark')
                }}
                onClick={() => {
                  setMemoForm({ id: m.id, title: m.title, content: m.attrs.content || '', pinned: m.attrs.pinned || false, color: m.attrs.color || '', client: m.attrs.client || '' });
                  setIsMemoEditing(false); // 카드 클릭 = 상세보기(읽기 전용)
                  setIsMemoModalOpen(true);
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                  <span className="text-xs font-mono text-gray-400 w-7 shrink-0" style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#9ca3af', width: '1.75rem', flexShrink: 0, textAlign: 'left' }}>
                    #{String(memoPage * memosPerPage + idx + 1).padStart(2, '0')}
                  </span>
                  <div style={{ color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    <FileText size={13} />
                  </div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0, marginLeft: '0.5rem' }}>
                    {m.attrs.pinned && <Pin size={11} className="text-accent" style={{ color: 'var(--accent)', transform: 'rotate(45deg)', flexShrink: 0 }} />}
                    <span
                      className="text-ellipsis whitespace-nowrap overflow-hidden"
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        textAlign: 'left'
                      }}
                    >
                      {m.title || '(제목 없음)'}
                    </span>
                    {m.category && (
                      <span className="badge" style={{ fontSize: '0.55rem', padding: '0.08rem 0.3rem', flexShrink: 0, marginLeft: '0.5rem' }}>{m.category}</span>
                    )}
                    {m.attrs.client && (
                      <span className="badge" style={{ fontSize: '0.55rem', padding: '0.08rem 0.3rem', flexShrink: 0, background: 'var(--accent-soft-bg)', color: 'var(--accent)', border: '1px solid var(--accent-soft-border)' }}>{m.attrs.client}</span>
                    )}
                  </div>
                  {/* 작성 날짜 */}
                  {(() => {
                    const ts = parseInt((m.id.split('_')[1] || '0'), 10);
                    const created = m.attrs.effectiveDate ? parseISO(m.attrs.effectiveDate) : (ts ? new Date(ts) : (m.updatedAt ? parseISO(m.updatedAt) : null));
                    return created ? (
                      <span style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', flexShrink: 0, fontFamily: 'monospace' }}>
                        {format(created, 'yy.MM.dd')}
                      </span>
                    ) : null;
                  })()}
                </div>

                {m.attrs.content && (
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      paddingLeft: '3.1rem',
                      textAlign: 'left',
                      lineHeight: '1.4',
                      flex: 1,            // 남은 공간을 채워 카드 높이를 일정하게 유지
                      overflow: 'hidden'  // 긴 내용은 카드 경계에서 잘림
                    }}
                  >
                    <Markdown 
                      content={m.attrs.content} 
                      compact 
                      onCheckboxToggle={(lineIndex, newCheckedState) => {
                        handleMemoCheckboxToggle(m.id, lineIndex, newCheckedState);
                      }} 
                    />
                  </div>
                )}

                <div className="card-hover-actions">
                  <button className="ghost-btn" onClick={(e) => { e.stopPropagation(); setMemoForm({ id: m.id, title: m.title, content: m.attrs.content || '', pinned: m.attrs.pinned || false, color: m.attrs.color || '', client: m.attrs.client || '' }); setIsMemoEditing(true); setIsMemoModalOpen(true); }}>수정</button>
                  <button className="ghost-btn" onClick={(e) => { e.stopPropagation(); handleDuplicateMemo(m.id); }}>복제</button>
                  <button className="ghost-btn danger" onClick={(e) => { e.stopPropagation(); deleteMemo(m.id); }}>삭제</button>
                </div>
              </div>
            ))}

            {memoTotalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.8rem', marginTop: '0.5rem' }}>
                <button 
                  onClick={() => setMemoPage(Math.max(0, memoPage - 1))}
                  disabled={memoPage === 0}
                  className="ghost-btn"
                  style={{ opacity: memoPage === 0 ? 0.3 : 1, padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                >
                  이전
                </button>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {memoPage + 1} / {memoTotalPages}
                </span>
                <button 
                  onClick={() => setMemoPage(Math.min(memoTotalPages - 1, memoPage + 1))}
                  disabled={memoPage === memoTotalPages - 1}
                  className="ghost-btn"
                  style={{ opacity: memoPage === memoTotalPages - 1 ? 0.3 : 1, padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                >
                  다음
                </button>
              </div>
            )}
          </div>
        </section>
  );
}
