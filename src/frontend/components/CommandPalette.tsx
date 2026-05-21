"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, Package, ClipboardList, Layers, Settings, Sun, Moon, Search } from 'lucide-react';
import { useApp } from '@/frontend/context/AppContext';

type CmdItem = {
  id: string;
  kind: 'event' | 'memo' | 'asset' | 'action';
  title: string;
  meta?: string;
  icon: React.ReactNode;
  run: () => void;
};

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {
    records,
    setActiveTab,
    setEditingSchedule,
    setEditingInventory,
    setIsMemoModalOpen,
    setMemoForm,
    toggleTheme,
    theme,
    appSettings
  } = useApp();

  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Build item list
  const items = useMemo<CmdItem[]>(() => {
    const actions: CmdItem[] = [
      { id: 'tab-all', kind: 'action', title: '전체 대시보드로 이동', meta: '⌘1', icon: <Layers size={13} />, run: () => { setActiveTab('all'); onClose(); } },
      { id: 'tab-cal', kind: 'action', title: '일정 캘린더 열기', meta: '⌘2', icon: <Calendar size={13} />, run: () => { setActiveTab('calendar'); onClose(); } },
      { id: 'tab-inv', kind: 'action', title: '재고 현황 열기', meta: '⌘3', icon: <Package size={13} />, run: () => { setActiveTab('inventory'); onClose(); } },
      { id: 'tab-set', kind: 'action', title: '환경설정 열기', meta: '⌘,', icon: <Settings size={13} />, run: () => { setActiveTab('settings'); onClose(); } },
      { id: 'theme', kind: 'action', title: theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환', icon: theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />, run: () => { toggleTheme(); onClose(); } },
      {
        id: 'new-event', kind: 'action', title: '새 일정 작성', icon: <Calendar size={13} />,
        run: () => {
          setActiveTab('calendar');
          setEditingSchedule({ id: '', title: '', type: 'event', category: '일반', attrs: { date: new Date().toISOString().split('T')[0], time: '12:00', memo: '', completed: false, notifyOffset: appSettings.defaultNotifyOffset ?? 0 }, updatedAt: new Date().toISOString() } as any);
          onClose();
        }
      },
      {
        id: 'new-inv', kind: 'action', title: '새 재고 품목 등록', icon: <Package size={13} />,
        run: () => {
          setActiveTab('inventory');
          setEditingInventory({ id: '', title: '', type: 'asset', category: '재고', attrs: { code: '', qty: 1, flow: 'IN', loc: '', mgr: '', memo: '' }, updatedAt: new Date().toISOString() } as any);
          onClose();
        }
      },
      {
        id: 'new-memo', kind: 'action', title: '새 변동 사항 작성', icon: <ClipboardList size={13} />,
        run: () => {
          setMemoForm({ title: '', content: '' });
          setIsMemoModalOpen(true);
          onClose();
        }
      }
    ];

    const recordItems: CmdItem[] = records.map(r => {
      let icon: React.ReactNode;
      let meta = r.category || '';
      if (r.type === 'event') {
        icon = <Calendar size={13} />;
        if (r.attrs.date) meta = `${r.attrs.date}${r.attrs.time ? ' ' + r.attrs.time : ''}`;
      } else if (r.type === 'asset') {
        icon = <Package size={13} />;
        meta = `재고 ${r.attrs.qty ?? 0}개`;
      } else {
        icon = <ClipboardList size={13} />;
      }
      return {
        id: r.id,
        kind: r.type as any,
        title: r.title || '(제목 없음)',
        meta,
        icon,
        run: () => {
          if (r.type === 'event') setEditingSchedule(r as any);
          else if (r.type === 'asset') setEditingInventory(r as any);
          else if (r.type === 'memo') {
            setMemoForm({ id: r.id, title: r.title, content: r.attrs.content || '' });
            setIsMemoModalOpen(true);
          }
          onClose();
        }
      };
    });

    return [...actions, ...recordItems];
  }, [records, theme, setActiveTab, setEditingSchedule, setEditingInventory, setIsMemoModalOpen, setMemoForm, toggleTheme, onClose, appSettings]);

  // Fuzzy filter
  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(it =>
      it.title.toLowerCase().includes(q) ||
      (it.meta && it.meta.toLowerCase().includes(q))
    );
  }, [items, query]);

  // Reset active index on filter change
  useEffect(() => { setActiveIdx(0); }, [query]);

  // Keyboard handlers
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const target = filtered[activeIdx];
        if (target) target.run();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, filtered, activeIdx, onClose]);

  // Group filtered items by section
  const actionItems = filtered.filter(i => i.kind === 'action');
  const eventItems = filtered.filter(i => i.kind === 'event');
  const memoItems = filtered.filter(i => i.kind === 'memo');
  const assetItems = filtered.filter(i => i.kind === 'asset');

  // Compute flattened active position for highlight
  const flatList = [...actionItems, ...eventItems, ...memoItems, ...assetItems];
  const activeId = flatList[activeIdx]?.id;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="cmdk-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: -10, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -10, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="cmdk-shell"
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 0.85rem', borderBottom: '1px solid var(--panel-border)' }}>
              <Search size={14} style={{ color: 'var(--text-tertiary)' }} />
              <input
                ref={inputRef}
                className="cmdk-input"
                placeholder="검색하거나 명령 실행… (일정, 변동사항, 재고, 액션)"
                value={query}
                onChange={e => setQuery(e.target.value)}
                style={{ border: 'none', borderBottom: 'none', padding: '0.95rem 0' }}
              />
            </div>

            <div className="cmdk-list">
              {filtered.length === 0 ? (
                <div className="cmdk-empty">일치하는 결과가 없습니다.</div>
              ) : (
                <>
                  {actionItems.length > 0 && (
                    <>
                      <div className="cmdk-section-label">액션</div>
                      {actionItems.map(it => (
                        <div key={it.id} className={`cmdk-item ${activeId === it.id ? 'active' : ''}`} onMouseEnter={() => setActiveIdx(flatList.findIndex(f => f.id === it.id))} onClick={it.run}>
                          <span className="cmdk-item-icon">{it.icon}</span>
                          <span className="cmdk-item-title">{it.title}</span>
                          {it.meta && <span className="cmdk-item-meta">{it.meta}</span>}
                        </div>
                      ))}
                    </>
                  )}
                  {eventItems.length > 0 && (
                    <>
                      <div className="cmdk-section-label">일정</div>
                      {eventItems.map(it => (
                        <div key={it.id} className={`cmdk-item ${activeId === it.id ? 'active' : ''}`} onMouseEnter={() => setActiveIdx(flatList.findIndex(f => f.id === it.id))} onClick={it.run}>
                          <span className="cmdk-item-icon">{it.icon}</span>
                          <span className="cmdk-item-title">{it.title}</span>
                          {it.meta && <span className="cmdk-item-meta">{it.meta}</span>}
                        </div>
                      ))}
                    </>
                  )}
                  {memoItems.length > 0 && (
                    <>
                      <div className="cmdk-section-label">변동 사항</div>
                      {memoItems.map(it => (
                        <div key={it.id} className={`cmdk-item ${activeId === it.id ? 'active' : ''}`} onMouseEnter={() => setActiveIdx(flatList.findIndex(f => f.id === it.id))} onClick={it.run}>
                          <span className="cmdk-item-icon">{it.icon}</span>
                          <span className="cmdk-item-title">{it.title}</span>
                          {it.meta && <span className="cmdk-item-meta">{it.meta}</span>}
                        </div>
                      ))}
                    </>
                  )}
                  {assetItems.length > 0 && (
                    <>
                      <div className="cmdk-section-label">재고</div>
                      {assetItems.map(it => (
                        <div key={it.id} className={`cmdk-item ${activeId === it.id ? 'active' : ''}`} onMouseEnter={() => setActiveIdx(flatList.findIndex(f => f.id === it.id))} onClick={it.run}>
                          <span className="cmdk-item-icon">{it.icon}</span>
                          <span className="cmdk-item-title">{it.title}</span>
                          {it.meta && <span className="cmdk-item-meta">{it.meta}</span>}
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>

            <div className="cmdk-footer">
              <span>
                <span className="cmdk-kbd">↑</span>
                <span className="cmdk-kbd">↓</span>
                <span>이동</span>
                <span className="cmdk-kbd">↵</span>
                <span>선택</span>
                <span className="cmdk-kbd">esc</span>
                <span>닫기</span>
              </span>
              <span>{filtered.length}개 결과</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
