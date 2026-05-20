"use client";

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sun, Moon, Calendar, Package, Layers, Activity, Settings, Tag, Command, FileText, X, Workflow } from 'lucide-react';
import { useApp } from '@/frontend/context/AppContext';
import CommandPalette from '@/frontend/components/CommandPalette';

const getActivityColor = (type: string) => {
  if (type.includes('ADD_SCHED')) return 'var(--accent)';
  if (type.includes('DONE_SCHED')) return 'var(--success)';
  if (type.includes('UPDATE_SCHED')) return 'var(--purple)';
  if (type.includes('DEL_SCHED')) return 'var(--danger)';
  if (type.includes('ADD_MEMO')) return 'var(--warning)';
  if (type.includes('UPDATE_MEMO')) return 'var(--warning)';
  if (type.includes('DEL_MEMO')) return 'var(--danger)';
  if (type.includes('ADD_INV')) return 'var(--success)';
  if (type.includes('UPDATE_INV')) return 'var(--purple)';
  if (type.includes('DEL_INV')) return 'var(--danger)';
  return 'var(--text-secondary)';
};

const getActivityBgColor = (type: string) => {
  if (type.includes('ADD_SCHED')) return 'var(--accent-soft-bg)';
  if (type.includes('DONE_SCHED')) return 'var(--success-soft-bg)';
  if (type.includes('UPDATE_SCHED')) return 'var(--purple-soft-bg)';
  if (type.includes('DEL_SCHED')) return 'var(--danger-soft-bg)';
  if (type.includes('ADD_MEMO')) return 'var(--warning-soft-bg)';
  if (type.includes('UPDATE_MEMO')) return 'var(--warning-soft-bg)';
  if (type.includes('DEL_MEMO')) return 'var(--danger-soft-bg)';
  if (type.includes('ADD_INV')) return 'var(--success-soft-bg)';
  if (type.includes('UPDATE_INV')) return 'var(--purple-soft-bg)';
  if (type.includes('DEL_INV')) return 'var(--danger-soft-bg)';
  return 'var(--hover-bg)';
};

const getActivityMessage = (act: any) => {
  switch (act.type) {
    case 'ADD_SCHED': return <span>새로운 일정 <strong>{act.snippet}</strong> 항목을 추가했습니다.</span>;
    case 'DONE_SCHED': return <span><strong>{act.snippet}</strong> 일정을 완료 처리했습니다.</span>;
    case 'UPDATE_SCHED': return <span><strong>{act.snippet}</strong> 일정을 수정했습니다.</span>;
    case 'DEL_SCHED': return <span>일정 항목을 삭제했습니다.</span>;
    case 'ADD_MEMO': return <span>새로운 변동 사항 <strong>{act.snippet}</strong> 항목을 추가했습니다.</span>;
    case 'UPDATE_MEMO': return <span>변동 사항 <strong>{act.snippet}</strong> 항목을 수정했습니다.</span>;
    case 'DEL_MEMO': return <span>변동 사항을 삭제했습니다.</span>;
    case 'ADD_INV': return <span>재고 <strong>{act.snippet}</strong> 항목이 등록되었습니다.</span>;
    case 'UPDATE_INV': return <span>재고 <strong>{act.snippet}</strong> 항목이 변경되었습니다.</span>;
    case 'DEL_INV': return <span>재고 항목이 삭제되었습니다.</span>;
    default: return <span>{act.snippet}</span>;
  }
};

const getRelativeTime = (timestamp: number) => {
  const diffMins = Math.floor((Date.now() - timestamp) / 60000);
  if (diffMins < 60) return diffMins === 0 ? '방금 전' : `${diffMins}분 전`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;
  return new Date(timestamp).toLocaleDateString();
};

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    theme, toggleTheme,
    toast,
    activities,
    appSettings, handleSettingsChange,
    isSettingsOpen, setIsSettingsOpen,
    isActivityDrawerOpen, setIsActivityDrawerOpen,
    nlpInput, setNlpInput, loading, handleNlpSubmit,
    records,
    activeTab, setActiveTab,
    activeCategory, setActiveCategory
  } = useApp();

  // Extract unique categories (except memo)
  const categories = Array.from(new Set(
    records
      .map(r => r.category || r.attrs.category)
      .filter(c => c && c !== '메모')
  ));

  // Command Palette open state
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      const meta = e.metaKey || e.ctrlKey;

      // ⌘K / Ctrl+K → 명령 팔레트 토글
      if (meta && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsPaletteOpen(p => !p);
        return;
      }
      // ⌘1 / 2 / 3 → 탭 전환
      if (meta && (e.key === '1' || e.key === '2' || e.key === '3')) {
        e.preventDefault();
        if (e.key === '1') setActiveTab('all');
        else if (e.key === '2') setActiveTab('calendar');
        else if (e.key === '3') setActiveTab('inventory');
        return;
      }
      // ⌘, → 환경설정
      if (meta && e.key === ',') {
        e.preventDefault();
        setActiveTab(activeTab === 'settings' ? 'all' : 'settings');
        return;
      }
      // / → 커맨드바 포커스 (입력 중이 아닐 때만)
      if (!isTyping && e.key === '/') {
        e.preventDefault();
        const el = document.querySelector<HTMLInputElement>('.command-input');
        el?.focus();
        return;
      }
      // Esc → 드로워 닫기 (모달은 자체 처리)
      if (e.key === 'Escape') {
        if (isActivityDrawerOpen) {
          setIsActivityDrawerOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTab, isActivityDrawerOpen, setActiveTab, setIsActivityDrawerOpen]);

  if (!mounted) {
    return <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#F2F2F7' }} />;
  }

  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      
      {/* Sleek Frameless Window Header with Integrated Navigation Topbar */}
      <header className="sticky-header" style={{
        padding: '2.0rem 1.2rem 0.6rem 1.2rem',
        gap: '0.6rem'
      }}>
        {/* Top Row: Brand Title + Quick Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="app-title" style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '0.015em', userSelect: 'none' }}>
            Zero-Friction
          </div>
          <div className="header-actions" style={{ display: 'flex', gap: '0.4rem' }}>
            <button className="theme-toggle" onClick={() => setIsPaletteOpen(true)} title="명령 팔레트 (⌘K)">
              <Command size={17} />
            </button>
            <button className={`theme-toggle ${isActivityDrawerOpen ? 'active' : ''}`} onClick={() => setIsActivityDrawerOpen(!isActivityDrawerOpen)} title="활동 내역">
              <Activity size={17} />
            </button>
            <button className={`theme-toggle ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab(activeTab === 'settings' ? 'all' : 'settings')} title="환경설정 (⌘,)">
              <Settings size={17} />
            </button>
          </div>
        </div>

        {/* Command Bar Input */}
        <div className="command-bar" style={{ position: 'relative' }}>
          <input
            type="text"
            className="command-input"
            value={nlpInput}
            onChange={e => setNlpInput(e.target.value)}
            onKeyDown={handleNlpSubmit}
            placeholder="일정, 메모, 재고 입력 (/ 로 빠르게 포커스)"
            disabled={loading}
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '12px',
              fontSize: '0.85rem'
            }}
          />
          {loading && <span className="command-loading" style={{ right: '1rem', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>분석 중...</span>}
        </div>


        {/* Top Navigation Row (Segmented Control SPA style!) */}
        <nav
          className="app-nav"
          style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem', WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`nav-link ${activeTab === 'all' ? 'active' : ''} focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0`}
            style={{ flex: 1, cursor: 'pointer', border: 'none', outline: 'none', boxShadow: 'none' } as React.CSSProperties}
          >
            <Layers size={14} />
            <span>전체</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('calendar')}
            className={`nav-link ${activeTab === 'calendar' ? 'active' : ''} focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0`}
            style={{ flex: 1, cursor: 'pointer', border: 'none', outline: 'none', boxShadow: 'none' } as React.CSSProperties}
          >
            <Calendar size={14} />
            <span>일정</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className={`nav-link ${activeTab === 'inventory' ? 'active' : ''} focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0`}
            style={{ flex: 1, cursor: 'pointer', border: 'none', outline: 'none', boxShadow: 'none' } as React.CSSProperties}
          >
            <Package size={14} />
            <span>재고</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('memo' as any)}
            className={`nav-link ${activeTab === ('memo' as any) ? 'active' : ''} focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0`}
            style={{ flex: 1, cursor: 'pointer', border: 'none', outline: 'none', boxShadow: 'none' } as React.CSSProperties}
          >
            <FileText size={14} />
            <span>메모</span>
          </button>
        </nav>
      </header>

      {/* Main Workspace Area (Scrollable Content Container - 100% Responsive Width!) */}
      <main className="body-wrapper" style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        padding: '0.8rem 1.2rem',
        boxSizing: 'border-box'
      }}>
        {children}
      </main>

      <footer className="app-footer">
        <span className="footer-text">© 2026 screening25. All rights reserved.</span>
        <span className="footer-sep">·</span>
        <span className="footer-text">Zero-Friction Overview</span>
      </footer>

      {/* Shared Activity Drawer -> Compact Popover Card Overhaul! */}
      <AnimatePresence>
        {isActivityDrawerOpen && (
          <div 
            className="popover-overlay" 
            onClick={() => setIsActivityDrawerOpen(false)}
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'default'
            }}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }} 
              transition={{ duration: 0.15 }}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '520px',
                maxHeight: '75vh',
                background: 'var(--bg-color)',
                border: '1px solid var(--panel-border)',
                borderRadius: '20px',
                boxShadow: '0 15px 45px rgba(0, 0, 0, 0.3)',
                overflow: 'hidden',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.8rem',
                zIndex: 1001
              }}
            >
              <div className="ios-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.65rem', marginBottom: '0.2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-primary)' }}>
                  <Activity size={16} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontSize: '1.05rem', fontWeight: 800 }}>전체 활동 내역</span>
                  <span style={{ 
                    fontSize: '0.72rem', 
                    fontWeight: 700, 
                    color: 'var(--text-secondary)', 
                    background: 'var(--hover-bg)', 
                    padding: '0.15rem 0.45rem', 
                    borderRadius: '6px' 
                  }}>
                    {activities.length}개 기록됨
                  </span>
                </div>
                <button 
                  onClick={() => setIsActivityDrawerOpen(false)} 
                  style={{ 
                    background: 'transparent', 
                    border: 'none', 
                    color: 'var(--text-secondary)', 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.2rem',
                    borderRadius: '50%',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover-bg)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <X size={16} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', overflowY: 'auto', maxHeight: '55vh', paddingRight: '2px' }}>
                {activities.length === 0 ? (
                  <div style={{ padding: '3rem 1.5rem', fontSize: '0.8rem', textAlign: 'center', color: 'var(--text-tertiary)', border: '1px dashed var(--panel-border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                    <Activity size={24} style={{ opacity: 0.3 }} />
                    <span>활동 내역이 없습니다.</span>
                  </div>
                ) : (
                  activities.map((act) => (
                    <div 
                      key={act.id} 
                      style={{ 
                        display: 'flex', 
                        gap: '0.65rem', 
                        fontSize: '0.78rem', 
                        alignItems: 'flex-start',
                        padding: '0.65rem 0.8rem', 
                        background: 'var(--surface-elevated)', 
                        border: '1px solid var(--panel-border)', 
                        borderRadius: '10px' 
                      }}
                    >
                      <div style={{ 
                        width: '8px', 
                        height: '8px', 
                        borderRadius: '50%', 
                        background: getActivityColor(act.type), 
                        marginTop: '0.35rem', 
                        flexShrink: 0 
                      }} />
                      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                        <div style={{ color: 'var(--text-primary)', lineHeight: 1.45, fontWeight: 600 }}>{getActivityMessage(act)}</div>
                        <div style={{ color: 'var(--text-tertiary)', fontSize: '0.68rem', marginTop: '0.2rem' }}>{getRelativeTime(act.timestamp)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 테마 플로팅 버튼 (우측 하단 구석 고정 배치) */}
      <button 
        className="theme-floating-btn" 
        onClick={toggleTheme} 
        title={theme === 'light' ? '다크 모드 전환' : '라이트 모드 전환'}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: 'var(--panel-bg)',
          backdropFilter: 'var(--panel-blur)',
          WebkitBackdropFilter: 'var(--panel-blur)',
          border: '1px solid var(--panel-border)',
          color: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 9999,
          boxShadow: '0 4px 14px var(--shadow-color)',
          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          outline: 'none',
        }}
      >
        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
      </button>

      {/* Global Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: 20, x: '-50%' }} className="toast">{toast}</motion.div>
        )}
      </AnimatePresence>

      {/* Global Command Palette (⌘K) */}
      <CommandPalette open={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} />

    </div>
  );
}
