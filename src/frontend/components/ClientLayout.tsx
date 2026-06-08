"use client";

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Sun, Moon, Calendar, Package, Layers, Activity, Settings, Command, FileText, X, Bell, Clock, Check, RefreshCw, Search } from 'lucide-react';
import { useApp } from '@/frontend/context/AppContext';
import CommandPalette from '@/frontend/components/CommandPalette';

/**
 * 활동 유형(접두사) → 표시 색상(CSS 변수) 매핑 테이블.
 * NOTE: 순서가 곧 우선순위다. 위에서부터 부분 문자열(includes)이 처음 일치하는 색을 사용한다.
 */
const ACTIVITY_COLOR_MAP: ReadonlyArray<[prefix: string, color: string]> = [
  ['ADD_SCHED', 'var(--accent)'],
  ['DONE_SCHED', 'var(--success)'],
  ['UPDATE_SCHED', 'var(--purple)'],
  ['DEL_SCHED', 'var(--danger)'],
  ['ADD_MEMO', 'var(--warning)'],
  ['UPDATE_MEMO', 'var(--warning)'],
  ['DEL_MEMO', 'var(--danger)'],
  ['ADD_INV', 'var(--success)'],
  ['UPDATE_INV', 'var(--purple)'],
  ['DEL_INV', 'var(--danger)'],
];

/**
 * 활동 로그 유형에 대응하는 점(dot) 색상을 반환한다.
 * @param type 활동 로그 타입 문자열 (예: 'ADD_SCHED')
 * @returns CSS 변수 형태의 색상 값. 매칭이 없으면 보조 텍스트 색.
 */
const getActivityColor = (type: string) =>
  ACTIVITY_COLOR_MAP.find(([prefix]) => type.includes(prefix))?.[1] ?? 'var(--text-secondary)';

/**
 * 활동 로그 항목을 사용자에게 보여줄 한국어 메시지(JSX)로 변환한다.
 * @param act 활동 로그 객체 ({ type, snippet, ... })
 * @returns 활동 내역 리스트에 렌더링할 메시지 노드
 */
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

/**
 * 타임스탬프를 "방금 전 / N분 전 / N시간 전 / 날짜" 형태의 상대 시간으로 변환한다.
 * @param timestamp 활동이 발생한 시각(ms 단위 epoch)
 * @returns 사람이 읽기 쉬운 상대 시간 문자열
 */
const getRelativeTime = (timestamp: number) => {
  const diffMins = Math.floor((Date.now() - timestamp) / 60000);
  if (diffMins < 60) return diffMins === 0 ? '방금 전' : `${diffMins}분 전`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;
  // 하루가 지난 항목은 절대 날짜로 표기
  return new Date(timestamp).toLocaleDateString();
};

/**
 * 상단 세그먼트 네비게이션 탭 정의.
 * NOTE: 동일한 마크업이 반복되던 4개 버튼을 데이터로 추출(DRY)하여 map으로 렌더링한다.
 *       'memo'는 컨텍스트의 activeTab 유니온 타입에 없으므로 렌더 시 as any로 캐스팅한다(기존 동작 유지).
 */
const NAV_ITEMS: ReadonlyArray<{ tab: string; icon: React.ElementType; label: string }> = [
  { tab: 'all', icon: Layers, label: '전체' },
  { tab: 'calendar', icon: Calendar, label: '일정' },
  { tab: 'inventory', icon: Package, label: '재고' },
  { tab: 'memo', icon: FileText, label: '메모' },
];

/**
 * 앱 전역 셸(Shell) 레이아웃.
 * 상단 헤더(브랜드/빠른 동작/커맨드 바/탭 네비), 메인 스크롤 영역, 푸터,
 * 활동 내역 드로워, 테마 토글 FAB, 토스트, 커맨드 팔레트를 구성한다.
 * @param children 현재 탭/라우트에 해당하는 페이지 콘텐츠
 */
export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // SSR/CSR 하이드레이션 불일치 방지용 마운트 플래그.
  // 초기 렌더는 빈 셸만 그리고, 클라이언트 마운트 이후에 실제 UI를 노출한다.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      // Electron 환경 감지는 이제 window.electronAPI(preload 노출) 유무로 판단한다.
      // (contextIsolation/sandbox 환경에서는 window.process·require가 존재하지 않는다.)
      // OS 알림 권한 요청 (앱 첫 실행 시)
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, []);

  // Listen to IPC 'tray-action' events and dispatch them to the window
  useEffect(() => {
    if (!mounted) return;
    const api = (window as any).electronAPI;
    if (!api) return;
    // onTrayAction은 구독 해제 함수를 반환한다 → 그대로 cleanup으로 사용
    return api.onTrayAction((action: string) => {
      window.dispatchEvent(new CustomEvent('tray-action', { detail: action }));
    });
  }, [mounted]);

  // Listen to IPC 'focus-nlp-input' events and focus/select the input
  useEffect(() => {
    if (!mounted) return;
    const api = (window as any).electronAPI;
    if (!api) return;
    return api.onFocusNlpInput(() => {
      const el = document.querySelector<HTMLInputElement>('.command-input');
      if (el) {
        el.focus();
        el.select();
      }
    });
  }, [mounted]);

  // 전역 앱 상태/액션 (실제로 이 레이아웃에서 사용하는 값만 구독)
  const {
    theme, toggleTheme,
    toast,
    activities,
    isActivityDrawerOpen, setIsActivityDrawerOpen,
    nlpInput, setNlpInput, loading, handleNlpSubmit, executeNlpCommand,
    manualSync, syncing,
    searchQuery, setSearchResult,
    activeTab, setActiveTab,
    activeNotification, handleDismissNotification, handleSnoozeNotification, handleCompleteNotificationSchedule
  } = useApp();

  // Listen to IPC 'execute-quick-nlp' and execute command on main window
  useEffect(() => {
    if (!mounted) return;
    const api = (window as any).electronAPI;
    if (!api) return;
    return api.onExecuteQuickNlp((text: string) => {
      executeNlpCommand(text);
    });
  }, [mounted, executeNlpCommand]);

  // activeNotification 발생 시 OS 배너 알림 발사
  useEffect(() => {
    if (!activeNotification) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    const n = new Notification(activeNotification.title || '일정 알림', {
      body: `${activeNotification.body}  ${activeNotification.date} ${activeNotification.time}`,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
    });
    // 배너 클릭 시 앱 포커스
    n.onclick = () => {
      window.focus();
      n.close();
    };
  }, [activeNotification]);

  // 앱 업데이트 — 서비스 워커 캐시 완전 삭제 후 강제 새로고침
  const [isUpdating, setIsUpdating] = useState(false);
  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      // 1. 서비스 워커 전체 unregister
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(r => r.unregister()));
      }
      // 2. Cache Storage 전체 삭제
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } catch (e) {
      console.warn('캐시 삭제 실패, 그냥 새로고침:', e);
    }
    // 3. 캐시버스팅 강제 새로고침 — location.reload()는 Electron/Chromium의 HTTP 디스크
    //    캐시를 우회하지 못해 옛 HTML을 다시 받을 수 있다. 쿼리스트링을 새로 붙여
    //    네트워크에서 최신 HTML(→최신 청크)을 강제로 받아오게 한다.
    const url = new URL(window.location.href);
    url.searchParams.set('_v', Date.now().toString());
    window.location.replace(url.toString());
  };

  // 커맨드 팔레트(⌘K) 열림 상태
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  // 전역 키보드 단축키 등록
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

  if (pathname === '/quick-input') {
    return <>{children}</>;
  }

  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      
      {/* Sleek Frameless Window Header with Integrated Navigation Topbar */}
      <header className="sticky-header" style={{
        padding: '2.0rem 1.2rem 0.6rem 1.2rem',
        gap: '0.6rem'
      }}>
        {/* Top Row: Brand Title + Quick Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'nowrap', width: '100%' }}>
          <div className="app-title" style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '0.015em', userSelect: 'none', flexShrink: 0 }}>
            Zero-Friction
          </div>
          <div className="header-actions" style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
            <button
              className={`theme-toggle ${searchQuery !== null ? 'active' : ''}`}
              onClick={() => { if (searchQuery !== null) { setSearchResult(null, null); } else { setActiveTab('all'); setSearchResult('', null); } }}
              title="검색 (일정·재고·메모)"
            >
              <Search size={17} />
            </button>
            <button className="theme-toggle" onClick={() => manualSync()} disabled={syncing} title="동기화 (서버에서 최신 데이터 불러오기)">
              <RefreshCw size={17} style={syncing ? { animation: 'spin 0.8s linear infinite' } : undefined} />
            </button>
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
            placeholder="일정, 메모, 재고 입력 (Press / to focus)"
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
          {/* NAV_ITEMS 데이터를 순회하여 동일 마크업의 탭 버튼을 생성 (기존 4개 버튼과 DOM 동일) */}
          {NAV_ITEMS.map(({ tab, icon: Icon, label }) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab as any)}
              className={`nav-link ${activeTab === (tab as any) ? 'active' : ''} focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0`}
              style={{ flex: 1, cursor: 'pointer', border: 'none', outline: 'none', boxShadow: 'none' } as React.CSSProperties}
            >
              <Icon size={14} />
              <span>{label}</span>
            </button>
          ))}
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

      {/* Custom Alarm Notification Card */}
      <AnimatePresence>
        {activeNotification && (
          <motion.div
            initial={{ opacity: 0, y: -50, x: '-50%', scale: 0.95 }}
            animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }}
            exit={{ opacity: 0, y: -30, x: '-50%', scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            style={{
              position: 'fixed',
              top: '24px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '380px',
              maxWidth: 'calc(100vw - 32px)',
              background: 'var(--panel-bg)',
              backdropFilter: 'var(--panel-blur)',
              WebkitBackdropFilter: 'var(--panel-blur)',
              border: '1px solid var(--panel-border)',
              borderRadius: '20px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
              padding: '1.2rem',
              zIndex: 99999,
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent)' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'var(--accent-soft-bg)',
                  border: '1px solid var(--accent-soft-border)',
                }}>
                  <Bell size={16} className="ringing-bell-icon" />
                </div>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {activeNotification.title || '알림'}
                </span>
              </div>
              <button
                onClick={handleDismissNotification}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, wordBreak: 'break-all' }}>
                {activeNotification.body}
              </h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                <Clock size={13} />
                <span>
                  {activeNotification.date} {activeNotification.time}
                </span>
              </div>
            </div>

             {/* Actions */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
              <button
                onClick={() => handleSnoozeNotification(activeNotification.id)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.3rem',
                  padding: '0.6rem 0.4rem',
                  borderRadius: '12px',
                  border: '1px solid var(--panel-border)',
                  background: 'var(--surface-elevated)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--hover-bg)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'var(--surface-elevated)';
                }}
              >
                <Clock size={13} />
                <span style={{ whiteSpace: 'nowrap' }}>10분 후 알림</span>
              </button>
              <button
                onClick={handleDismissNotification}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.3rem',
                  padding: '0.6rem 0.4rem',
                  borderRadius: '12px',
                  border: '1px solid var(--panel-border)',
                  background: 'var(--surface-elevated)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--hover-bg)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'var(--surface-elevated)';
                }}
              >
                <span style={{ whiteSpace: 'nowrap' }}>확인</span>
              </button>
              <button
                onClick={() => handleCompleteNotificationSchedule(activeNotification.id)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.3rem',
                  padding: '0.6rem 0.4rem',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'var(--accent)',
                  color: '#FFFFFF',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 12px var(--accent-glow)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--accent-hover)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'var(--accent)';
                }}
              >
                <Check size={13} />
                <span style={{ whiteSpace: 'nowrap' }}>완료</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 20, x: '-50%' }} 
            animate={{ opacity: 1, y: 0, x: '-50%' }} 
            exit={{ opacity: 0, y: 20, x: '-50%' }} 
            className="toast"
            style={{ pointerEvents: 'none' }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Command Palette (⌘K) */}
      <CommandPalette open={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} />

    </div>
  );
}
