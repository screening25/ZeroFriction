"use client";

import { useState, useEffect, useMemo } from 'react';
import { format, addMonths, subMonths, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Circle, AlertTriangle, Calendar as CalIcon, Layers, ClipboardList, ChevronDown, Sliders, Pin, Coffee, AlertCircle, Calendar, Trophy, Search, CornerDownLeft, X } from 'lucide-react';
import { useApp } from '@/frontend/context/AppContext';
import { ACCENT_COLORS, addRecord, expandRecurringEvents } from '@/database';
import SettingsSection from '@/frontend/components/SettingsSection';
import CustomSelect from '@/frontend/components/CustomSelect';
import { getCategoryColorStyles, getMemoCardStyle } from '@/frontend/utils/styles';
import SearchSelect from '@/frontend/components/SearchSelect';
import InventoryEditModal from '@/frontend/components/InventoryEditModal';
import ScheduleEditModal from '@/frontend/components/ScheduleEditModal';
import MemoEditModal from '@/frontend/components/MemoEditModal';
import MemoSection from '@/frontend/components/MemoSection';
import InventorySection from '@/frontend/components/InventorySection';
import ScheduleSection from '@/frontend/components/ScheduleSection';

// isHoliday → @/frontend/utils/calendar, isSerialPattern → @/frontend/utils/inventory 로 분리됨
// 색상·카드 스타일 헬퍼는 @/frontend/utils/styles 로 분리됨 (hexToRgb, getCategoryColorStyles, getMemoCardStyle, getMemoModalStyle)

/** 마크다운 문법을 제거해 한 줄 발췌용 평문으로 변환한다(목록 미리보기에서 raw 마크다운이 보이지 않게). */
const stripMarkdown = (md: string): string =>
  (md || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$2')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^[\s:|-]{3,}$/gm, ' ')
    .replace(/\|/g, ' ')
    .replace(/[#>*_~`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();


/**
 * 메인 페이지(SPA 루트). activeTab에 따라 전체 개요·일정(캘린더)·재고·메모·설정 뷰를
 * 한 화면에서 전환 렌더링하며, 각 도메인의 상세 모달과 커맨드 팔레트(⌘F)를 포함한다.
 * 전역 데이터/액션은 useApp 컨텍스트에서 구독한다.
 */
export default function Home() {
  const {
    records,
    theme,
    toggleTheme,
    appSettings,
    handleSettingsChange,
    viewDate, setViewDate,
    selectedDate, setSelectedDate,
    calendarMode, setCalendarMode,
    editingSchedule, setEditingSchedule,
    editingInventory, setEditingInventory,
    handleUpdateInventory,
    isMemoModalOpen, setIsMemoModalOpen,
    memoPage, setMemoPage,
    memoForm, setMemoForm,
    activeTab, setActiveTab,
    showToast,
    reloadRecords,
    logActivity,
    handleUpdateSchedule,
    toggleComplete, handleDeleteSchedule,
    submitMemo, deleteMemo, deleteInventoryItem,
    handleDuplicateInventory, handleDuplicateMemo,
    archive, restoreArchived, permanentDelete, emptyArchive, clearActivities,
    activities,
    searchQuery, searchType, setSearchResult,
    exportToCsv, printToPdf
  } = useApp();

  const getCategoryColor = (cat: string) => getCategoryColorStyles(cat, appSettings.categoryColors).solid;
  const getCategorySoftBg = (cat: string) => getCategoryColorStyles(cat, appSettings.categoryColors).soft;
  const getCategoryBorder = (cat: string) => getCategoryColorStyles(cat, appSettings.categoryColors).border;




  // Local Category Filters for Schedule and Inventory (Enforce strict isolation!)

  // Widgets collapse/expand states inside Overview
  const [isTodaySchedulesExpanded, setIsTodaySchedulesExpanded] = useState<boolean>(true);
  const [isRecentMemosExpanded, setIsRecentMemosExpanded] = useState<boolean>(true);
  const [isInventoryFlowExpanded, setIsInventoryFlowExpanded] = useState<boolean>(true);


  // States for Cmd+F Command Palette
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [commandPaletteQuery, setCommandPaletteQuery] = useState<string>('');
  const [commandPaletteSelectedIndex, setCommandPaletteSelectedIndex] = useState<number>(0);

  // 메모 모달 보기/수정 모드 — 상세보기는 읽기 전용으로 열리고, '수정' 클릭 시에만 편집 모드로 전환된다.
  const [isMemoEditing, setIsMemoEditing] = useState<boolean>(false);

  // State for category ratio fixed tooltip (position: fixed to escape overflow clipping)
  const [categoryTooltip, setCategoryTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    cat: string;
    cnt: number;
    pct?: number;
    titles: string[];
    color: string;
  } | null>(null);

  // Listen to custom mention click events from Markdown component
  useEffect(() => {
    const handleMentionClick = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      const targetName = customEvent.detail;
      if (!targetName) return;

      const foundRecord = records.find(r => 
        r.title.trim().toLowerCase() === targetName.trim().toLowerCase()
      );

      if (foundRecord) {
        if (foundRecord.type === 'event') {
          setEditingSchedule(foundRecord);
          setIsMemoModalOpen(false);
          showToast(`일정 '${foundRecord.title}' 상세 조회를 엽니다.`);
        } else if (foundRecord.type === 'asset') {
          setEditingInventory(foundRecord);
          setIsMemoModalOpen(false);
          showToast(`재고 '${foundRecord.title}' 상세 조회를 엽니다.`);
        }
      } else {
        showToast(`'${targetName}' 일정이나 재고 항목을 찾을 수 없습니다.`);
      }
    };

    window.addEventListener('mention-click', handleMentionClick);
    return () => {
      window.removeEventListener('mention-click', handleMentionClick);
    };
  }, [records, setEditingSchedule, setEditingInventory, setIsMemoModalOpen, showToast]);

  // Listen to tray menu action events sent from Electron process (via ClientLayout)
  useEffect(() => {
    const handleTrayAction = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      const action = customEvent.detail;
      if (!action) return;

      if (action === 'new-schedule') {
        setActiveTab('calendar');
        setEditingSchedule({
          id: '',
          title: '',
          type: 'event',
          category: '일반',
          attrs: {
            date: format(selectedDate, 'yyyy-MM-dd'),
            time: '12:00',
            allDay: false,
            memo: '',
            completed: false,
            notifyOffset: appSettings.defaultNotifyOffset ?? 0
          },
          updatedAt: new Date().toISOString()
        });
      } else if (action === 'new-inventory') {
        setActiveTab('inventory');
        setEditingInventory({
          id: '',
          title: '',
          type: 'asset',
          category: '재고',
          attrs: {
            code: '',
            qty: 1,
            flow: 'IN',
            loc: '',
            mgr: '',
            serial: '',
            memo: ''
          },
          updatedAt: new Date().toISOString()
        });
      } else if (action === 'new-memo') {
        setActiveTab('memo' as any);
        setMemoForm({ title: '', content: '', pinned: false, color: '' });
        setIsMemoEditing(true);
        setIsMemoModalOpen(true);
      } else if (action === 'settings') {
        setActiveTab('settings' as any);
      }
    };

    window.addEventListener('tray-action', handleTrayAction);
    return () => {
      window.removeEventListener('tray-action', handleTrayAction);
    };
  }, [selectedDate, appSettings, setActiveTab, setEditingSchedule, setEditingInventory, setMemoForm, setIsMemoEditing, setIsMemoModalOpen]);

  // Input states for custom category creation inside modals
  const [customScheduleCategory, setCustomScheduleCategory] = useState<string>('');
  const [customInventoryCategory, setCustomInventoryCategory] = useState<string>('');

  // Filtered records by type
  const schedulesRaw = records.filter(r => r.type === 'event');
  const expandFrom = startOfWeek(subMonths(viewDate, 6));
  const expandTo = endOfWeek(addMonths(viewDate, 12));
  const schedules = typeof window !== 'undefined'
    ? expandRecurringEvents(schedulesRaw, expandFrom, expandTo)
    : schedulesRaw;
  const memos = records
    .filter(r => r.type === 'memo')
    .sort((a, b) => {
      const aPinned = a.attrs.pinned ? 1 : 0;
      const bPinned = b.attrs.pinned ? 1 : 0;
      if (aPinned !== bPinned) {
        return bPinned - aPinned;
      }
      // id 내 타임스탬프(작성 시각)로 정렬 — 수정해도 순서가 바뀌지 않음. 방향은 memoSort.
      const tsA = parseInt(a.id.split('_')[1] || '0', 10);
      const tsB = parseInt(b.id.split('_')[1] || '0', 10);
      return (appSettings.memoSort === 'asc') ? (tsA - tsB) : (tsB - tsA);
    });
  // 고객사 정렬(가나다/ABC, 오름/내림차순) — 한국어 로케일 기준
  const clientSortDir = appSettings.clientSort || 'asc';
  const sortedClients = useMemo(() => {
    const arr = [...(appSettings.clients || [])];
    arr.sort((a, b) => a.localeCompare(b, 'ko'));
    if (clientSortDir === 'desc') arr.reverse();
    return arr;
  }, [appSettings.clients, clientSortDir]);

  // 기존에 입력한 품목코드 모음(재사용용) — 중복 제거 후 정렬
  const knownCodes = useMemo(() => Array.from(new Set(
    records.filter(r => r.type === 'asset').map(r => (r.attrs.code || '').trim()).filter(Boolean)
  )).sort(), [records]);

  // 품목코드 → 그 코드로 등록된 품목명들(중복 제거·정렬). 코드 선택 시 품목명 후보로 제공.
  const namesByCode = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    records.filter(r => r.type === 'asset').forEach(r => {
      const c = (r.attrs.code || '').trim();
      const t = (r.title || '').trim();
      if (!c || !t) return;
      (m[c] ||= new Set()).add(t);
    });
    const out: Record<string, string[]> = {};
    Object.keys(m).forEach(c => { out[c] = Array.from(m[c]).sort(); });
    return out;
  }, [records]);

  // 품목코드 → 저장된 카테고리(가장 최근 갱신 기준). 코드 선택 시 카테고리 자동 선택.
  const categoryByCode = useMemo(() => {
    const best: Record<string, { cat: string; ts: number }> = {};
    records.filter(r => r.type === 'asset').forEach(r => {
      const c = (r.attrs.code || '').trim();
      if (!c || !r.category) return;
      const ts = Date.parse(r.updatedAt || '') || 0;
      if (!best[c] || ts >= best[c].ts) best[c] = { cat: r.category, ts };
    });
    const out: Record<string, string> = {};
    Object.keys(best).forEach(c => { out[c] = best[c].cat; });
    return out;
  }, [records]);

  // 재고 정렬: 'manual'(수동 드래그 sortOrder) / 'asc'·'desc'(품목코드 가나다·ABC).
  const inventorySort = appSettings.inventorySort || 'manual';
  const inventory = records.filter(r => r.type === 'asset').slice().sort((a, b) => {
    if (inventorySort === 'asc' || inventorySort === 'desc') {
      const cmp = (a.attrs.code || a.title || '').localeCompare(b.attrs.code || b.title || '', 'ko');
      return inventorySort === 'asc' ? cmp : -cmp;
    }
    // manual: 사용자가 지정한 수동 순서(attrs.sortOrder) 우선. 미지정은 기존 순서 유지(안정 정렬).
    const ao = a.attrs.sortOrder, bo = b.attrs.sortOrder;
    if (ao == null && bo == null) return 0;
    if (ao == null) return 1;
    if (bo == null) return -1;
    return ao - bo;
  });

  const filteredPaletteItems = useMemo(() => {
    if (!commandPaletteQuery.trim()) return [];
    const q = commandPaletteQuery.toLowerCase().trim();
    
    const results: {
      id: string;
      title: string;
      type: 'event' | 'asset' | 'memo';
      subtitle?: string;
      record: any;
    }[] = [];
    
    records.forEach(r => {
      if (r.type === 'event') {
        const matchTitle = r.title.toLowerCase().includes(q);
        const matchDesc = (r.attrs.description || '').toLowerCase().includes(q);
        const matchCat = (r.attrs.category || '').toLowerCase().includes(q);
        if (matchTitle || matchDesc || matchCat) {
          results.push({
            id: r.id,
            title: r.title,
            type: 'event',
            subtitle: `${r.attrs.date} | ${r.attrs.category || '기본'}`,
            record: r
          });
        }
      } else if (r.type === 'asset') {
        const matchTitle = r.title.toLowerCase().includes(q);
        const matchSerial = (r.attrs.serial || '').toLowerCase().includes(q);
        const matchMgr = (r.attrs.mgr || '').toLowerCase().includes(q);
        const matchCat = (r.attrs.category || '').toLowerCase().includes(q);
        if (matchTitle || matchSerial || matchMgr || matchCat) {
          results.push({
            id: r.id,
            title: r.title,
            type: 'asset',
            subtitle: `재고: ${r.attrs.qty}개 | 담당: ${r.attrs.mgr || '없음'}`,
            record: r
          });
        }
      } else if (r.type === 'memo') {
        const matchTitle = (r.attrs.title || '제목 없음').toLowerCase().includes(q);
        const matchContent = (r.attrs.content || '').toLowerCase().includes(q);
        if (matchTitle || matchContent) {
          results.push({
            id: r.id,
            title: r.attrs.title || '제목 없음',
            type: 'memo',
            subtitle: r.attrs.content ? (stripMarkdown(r.attrs.content).substring(0, 40) + '...') : '내용 없음',
            record: r
          });
        }
      }
    });
    
    return results.slice(0, 10);
  }, [records, commandPaletteQuery]);

  const selectPaletteItem = (item: { id: string; title: string; type: 'event' | 'asset' | 'memo'; record: any }) => {
    setIsCommandPaletteOpen(false);
    setCommandPaletteQuery('');
    setCommandPaletteSelectedIndex(0);
    
    if (item.type === 'event') {
      setEditingSchedule(item.record);
      showToast(`일정 '${item.title}' 상세 조회를 엽니다.`);
    } else if (item.type === 'asset') {
      setEditingInventory(item.record);
      showToast(`재고 '${item.title}' 상세 조회를 엽니다.`);
    } else if (item.type === 'memo') {
      setMemoForm({
        id: item.record.id,
        title: item.record.attrs.title || '',
        content: item.record.attrs.content || '',
        color: item.record.attrs.color || 'blue',
        pinned: item.record.attrs.pinned || false
      });
      setIsMemoEditing(false); // 상세보기는 읽기 전용으로 진입
      setIsMemoModalOpen(true);
      showToast(`메모 '${item.title}'를 엽니다.`);
    }
  };

  // Keyboard shortcut listener and navigator
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      
      if (isCmdOrCtrl && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => {
          const next = !prev;
          if (next) {
            setTimeout(() => {
              const inp = document.getElementById('command-palette-search-input') as HTMLInputElement;
              if (inp) inp.focus();
            }, 50);
          }
          return next;
        });
        setCommandPaletteQuery('');
        setCommandPaletteSelectedIndex(0);
        return;
      }
      
      if (!isCommandPaletteOpen) return;
      
      if (e.key === 'Escape') {
        setIsCommandPaletteOpen(false);
        setCommandPaletteQuery('');
        setCommandPaletteSelectedIndex(0);
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCommandPaletteSelectedIndex(prev => 
          Math.min(prev + 1, filteredPaletteItems.length - 1)
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCommandPaletteSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selectedItem = filteredPaletteItems[commandPaletteSelectedIndex];
        if (selectedItem) {
          selectPaletteItem(selectedItem);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [isCommandPaletteOpen, filteredPaletteItems, commandPaletteSelectedIndex]);

  const memosPerPage = appSettings.maxMemosShown || 3;
  const memoTotalPages = Math.ceil(memos.length / memosPerPage);
  const displayedMemos = memos.slice(memoPage * memosPerPage, (memoPage + 1) * memosPerPage);

  useEffect(() => {
    if (memoPage >= memoTotalPages && memoTotalPages > 0) {
      setMemoPage(memoTotalPages - 1);
    } else if (memoTotalPages === 0) {
      setMemoPage(0);
    }
  }, [memoTotalPages, memoPage]);

  // Today's summary values for Home Dashboard
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayIncompleteSchedules = schedules.filter(s => s.attrs.date === todayStr && !s.attrs.completed);
  const overdueSchedules = schedules.filter(s => s.attrs.date < todayStr && !s.attrs.completed);
  const todaySchedulesFull = schedules
    .filter(s => s.attrs.date === todayStr)
    .sort((a, b) => {
      const aAll = !!a.attrs.allDay;
      const bAll = !!b.attrs.allDay;
      if (aAll && !bAll) return -1;
      if (!aAll && bAll) return 1;
      return (a.attrs.time || '23:59').localeCompare(b.attrs.time || '23:59');
    });
  const todaySchedules = todaySchedulesFull.slice(0, appSettings.maxEventsShown || 5);
  const recentMemos = memos.slice(0, appSettings.maxMemosShown || 3); // Show latest memos on Dashboard up to limit
  const lowStockItems = inventory.filter(i => (Number(i.attrs.qty) || 0) < 0); // Critical items with negative stock (qty < 0)
  const recentInventoryFlow = inventory.slice(0, appSettings.maxInventoryShown || 5); // Show latest asset adjustments up to limit

  // 검색 결과 필터 — 제목·카테고리·내용·코드·메모뿐 아니라 고객사·시리얼·위치·담당자·날짜/시간까지 폭넓게 매칭
  const filteredSearchRecords = records.filter(r => {
    if (searchType && r.type !== searchType) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    const a = r.attrs || {};
    const hay = [
      r.title, r.category, a.content, a.code, a.memo,
      a.client, a.serial, a.loc, a.mgr, a.date, a.time
    ].filter(Boolean).join(' ').toLowerCase();
    // 공백으로 나눈 모든 토큰을 AND 매칭 (예: "수원 입고" → 둘 다 포함)
    return query.split(/\s+/).every(tok => hay.includes(tok));
  });



  // Add or Update Schedule (Support direct addition!)
  const saveSchedule = () => {
    if (!editingSchedule) return;
    if (!editingSchedule.title.trim()) {
      showToast('일정 제목을 입력해주십시오');
      return;
    }
    if (!editingSchedule.id) {
      // 신규 등록
      addRecord({
        title: editingSchedule.title,
        type: 'event',
        category: editingSchedule.category || '일반',
        attrs: editingSchedule.attrs
      });
      reloadRecords();
      showToast('새 일정 등록 완료');
      logActivity('ADD_SCHED', '일정 직접 추가', editingSchedule.title);
      setEditingSchedule(null);
    } else {
      // 기존 수정
      handleUpdateSchedule(editingSchedule.id, editingSchedule);
    }
  };

  // Add or Update Inventory (Support direct addition!)
  const saveInventory = () => {
    if (!editingInventory) return;
    const code = (editingInventory.attrs.code || '').trim();
    if (!code) {
      showToast('품목코드를 입력해주십시오');
      return;
    }
    // 품목명은 선택 — 비어 있으면 품목코드를 표시명으로 사용(레코드 식별/그룹화 안정)
    const title = editingInventory.title.trim() || code;
    if (!editingInventory.id) {
      // 신규 등록
      addRecord({
        title,
        type: 'asset',
        category: editingInventory.category || '재고',
        attrs: {
          ...editingInventory.attrs,
          qty: Number(editingInventory.attrs.qty) || 0
        }
      });
      reloadRecords();
      showToast('새 재고 품목 등록 완료');
      logActivity('ADD_INV', '재고 직접 추가', `${title} ${editingInventory.attrs.qty}개`);
      setEditingInventory(null);
    } else {
      // 기존 수정 — 품목명이 비어 있으면 품목코드를 표시명으로
      handleUpdateInventory(editingInventory.id, { ...editingInventory, title });
    }
  };

  const currentAccents = ACCENT_COLORS.map(c => theme === 'dark' ? { ...c, value: c.dark } : c);

  // ==================== RENDERING TABS ====================

  // 1. Settings View (Integrated Full-Page SPA!)
  if (activeTab === 'settings') {
    return <SettingsSection />;
  }

  // 2. SPA Main View (Tabs: all, calendar, inventory)
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
      
      {/* NLQ Search / Summary Result View */}
      {searchQuery !== null && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', textAlign: 'left', padding: '0.2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>검색</div>
            <button
              className="ghost-btn"
              onClick={() => setSearchResult(null, null)}
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem', borderRadius: '6px', border: '1px solid var(--panel-border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              닫기 (ESC)
            </button>
          </div>

          {/* 🔍 직접 입력 검색창 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.7rem', borderRadius: '12px', border: '1px solid var(--panel-border)', background: 'var(--input-bg)' }}>
            <Search size={15} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            <input
              autoFocus
              type="text"
              value={searchQuery || ''}
              onChange={e => setSearchResult(e.target.value, searchType)}
              placeholder="일정·재고·메모 검색 (제목, 내용, 코드, 고객사, 담당자, 날짜…)"
              style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', fontSize: '0.85rem', color: 'var(--text-primary)' }}
            />
            {searchQuery && (
              <button onClick={() => setSearchResult('', searchType)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', flexShrink: 0 }} title="지우기">
                <X size={14} />
              </button>
            )}
          </div>

          {/* 타입 필터 탭 */}
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {[
              { key: null, label: '전체' },
              { key: 'event', label: '일정' },
              { key: 'asset', label: '재고' },
              { key: 'memo', label: '메모' },
            ].map(t => {
              const isSel = (searchType || null) === t.key;
              return (
                <button
                  key={t.label}
                  onClick={() => setSearchResult(searchQuery || '', t.key)}
                  style={{
                    fontSize: '0.74rem', fontWeight: 600, padding: '0.25rem 0.7rem', borderRadius: '8px', cursor: 'pointer',
                    border: isSel ? '1px solid var(--accent-soft-border)' : '1px solid var(--panel-border)',
                    background: isSel ? 'var(--accent-soft-bg)' : 'var(--panel-bg)',
                    color: isSel ? 'var(--accent)' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {t.label}
                  <span style={{ marginLeft: '0.3rem', fontSize: '0.66rem', opacity: 0.7 }}>
                    {records.filter(r => (!t.key || r.type === t.key)).filter(r => {
                      const q = (searchQuery || '').toLowerCase().trim();
                      if (!q) return true;
                      const a = r.attrs || {};
                      const hay = [r.title, r.category, a.content, a.code, a.memo, a.client, a.serial, a.loc, a.mgr, a.date, a.time].filter(Boolean).join(' ').toLowerCase();
                      return q.split(/\s+/).every(tok => hay.includes(tok));
                    }).length}
                  </span>
                </button>
              );
            })}
          </div>

          <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
            {searchQuery ? `'${searchQuery}' 검색 결과 ${filteredSearchRecords.length}건` : `전체 ${filteredSearchRecords.length}건 · 키워드를 입력하세요`} (ESC로 닫기)
          </div>
          
          <div className="card-list" style={{ gap: '1.25rem' }}>
            {filteredSearchRecords.length === 0 ? (
              <div className="empty-box" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>검색된 결과가 없습니다.</div>
            ) : (
              filteredSearchRecords.map((item, idx) => {
                const qtyNum = Number(item.attrs.qty) || 0;
                const isNegative = qtyNum < 0;
                return (
                  <div 
                    key={item.id} 
                    className={`card ${item.attrs.completed ? 'completed opacity-40 line-through' : ''}`}
                    style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', opacity: item.attrs.completed ? 0.4 : undefined }}
                    onClick={() => {
                      if (item.type === 'event') setEditingSchedule(item);
                      else if (item.type === 'asset') setEditingInventory(item);
                      else {
                        setMemoForm({ id: item.id, title: item.title, content: item.attrs.content || '', pinned: item.attrs.pinned || false, color: item.attrs.color || '', client: item.attrs.client || '' });
                        setIsMemoEditing(false); // 상세보기 = 읽기 전용
                        setIsMemoModalOpen(true);
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                      <span className="text-xs font-mono text-gray-400 w-7 shrink-0" style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#9ca3af', width: '1.75rem', flexShrink: 0 }}>
                        #{String(idx + 1).padStart(2, '0')}
                      </span>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.45rem', justifyContent: 'flex-start' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: item.attrs.completed ? 'var(--text-tertiary)' : 'var(--text-primary)', textDecoration: item.attrs.completed ? 'line-through' : 'none' }}>{item.title}</span>
                        <span className="badge" style={{ fontSize: '0.6rem' }}>
                          {item.type === 'event' ? '일정' : item.type === 'asset' ? '재고' : '메모'}
                        </span>
                        {item.category && <span className="badge" style={{ fontSize: '0.6rem', background: 'var(--accent-soft-bg)', color: 'var(--accent)' }}>{item.category}</span>}
                      </div>
                      {item.type === 'asset' && (
                        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: isNegative ? 'var(--danger)' : 'var(--text-primary)' }}>{qtyNum}개</span>
                      )}
                    </div>
                    
                    {/* Linked Badges */}
                    {item.attrs.linkedIds && item.attrs.linkedIds.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                        {item.attrs.linkedIds.map((linkedId: string) => {
                          const linkedRecord = records.find(r => r.id === linkedId);
                          if (!linkedRecord) return null;
                          return (
                            <span 
                              key={linkedId} 
                              className="text-xs bg-white/5 text-gray-400 rounded-full px-2 py-1"
                              style={{ fontSize: '0.68rem', backgroundColor: 'rgba(255,255,255,0.08)', color: '#a1a1aa', borderRadius: '9999px', padding: '0.15rem 0.4rem', border: '1px solid rgba(255,255,255,0.05)' }}
                            >
                              #{linkedRecord.title}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ==================== 1. [전체] HOME DASHBOARD TAB (Overview) ==================== */}
      {searchQuery === null && activeTab === 'all' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>

          {/* Dashboard Summary Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.1rem 0.2rem', marginBottom: '0.1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.05rem' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '0.015em', textAlign: 'left' }}>Overview</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 500, textAlign: 'left' }}>{format(new Date(), 'yyyy년 M월 d일 EEEE')}</div>
            </div>
          </div>

          {/* Smart Daily Briefing Widget */}
          {(() => {
            const totalTodaySchedules = schedules.filter(s => s.attrs.date === todayStr).length;
            const remainingTodaySchedules = todayIncompleteSchedules.length;
            const overdueSchedulesCount = overdueSchedules.length;
            const lowStockItemsCount = inventory.filter(i => (Number(i.attrs.qty) || 0) < 0).length; // 위험 재고 = 수량 음수

            let greeting = "오늘도 좋은 하루 보내시길 바랍니다!";
            const hour = new Date().getHours();
            if (hour >= 5 && hour < 9) greeting = "오늘도 힘차게 시작하는 좋은 아침입니다!";
            else if (hour >= 9 && hour < 12) greeting = "업무에 집중하기 좋은 오전 시간입니다.";
            else if (hour >= 12 && hour < 13) greeting = "맛있는 식사와 함께 편안한 점심시간 보내세요.";
            else if (hour >= 13 && hour < 18) greeting = "오늘 오후도 활기차게 보내시길 바랍니다.";
            else if (hour >= 18 && hour < 22) greeting = "오늘 하루도 수고 많으셨습니다. 편안한 저녁 보내세요.";
            else greeting = "오늘 하루도 고생하셨습니다. 평안한 밤 되시길 바랍니다.";
            
            let briefing: {
              greeting: string;
              statusLevel: 'calm' | 'busy' | 'warning' | 'done';
              scheduleMessage: string;
              inventoryMessage: string;
              actionTip: string;
            };
            
            if (lowStockItemsCount > 0 || overdueSchedulesCount > 0) {
              const schedMsg = overdueSchedulesCount > 0 
                ? `미완료된 지난 일정이 ${overdueSchedulesCount}건 있습니다.`
                : `오늘 대기 중인 일정이 ${remainingTodaySchedules}건 있습니다.`;
              const invMsg = lowStockItemsCount > 0
                ? `수량이 부족한 품목이 ${lowStockItemsCount}건 감지되었습니다.`
                : "재고 상태가 양호합니다.";
              
              briefing = {
                greeting,
                statusLevel: 'warning',
                scheduleMessage: schedMsg,
                inventoryMessage: invMsg,
                actionTip: "빠른 확인 및 조치를 권장합니다."
              };
            } else if (totalTodaySchedules > 0 && remainingTodaySchedules === 0) {
              briefing = {
                greeting,
                statusLevel: 'done',
                scheduleMessage: "금일 등록된 일정이 모두 완료되었습니다.",
                inventoryMessage: "재고 상태가 양호합니다.",
                actionTip: "편안한 마음으로 남은 업무를 점검해 보세요."
              };
            } else if (remainingTodaySchedules > 0) {
              briefing = {
                greeting,
                statusLevel: 'busy',
                scheduleMessage: `오늘 ${remainingTodaySchedules}건의 일정이 대기 중입니다.`,
                inventoryMessage: "재고 상태가 양호합니다.",
                actionTip: "화이팅 넘치는 하루 되세요!"
              };
            } else {
              briefing = {
                greeting,
                statusLevel: 'calm',
                scheduleMessage: "오늘 새로 등록된 일정이 없습니다.",
                inventoryMessage: "재고 상태가 양호하게 유지되고 있습니다.",
                actionTip: "시간이 날 때 다음 주 일정을 미리 계획해 볼까요?"
              };
            }
            
            let styles = {
              textClass: "text-emerald-600 dark:text-emerald-400",
              containerBg: "rgba(5, 150, 105, 0.05)",
              containerBorder: "1px solid rgba(5, 150, 105, 0.15)",
              iconBg: "rgba(5, 150, 105, 0.12)",
              iconColor: "#059669",
              IconComponent: Coffee
            };
            
            if (briefing.statusLevel === 'warning') {
              styles = {
                textClass: "text-amber-600 dark:text-amber-400",
                containerBg: "rgba(217, 119, 6, 0.05)",
                containerBorder: "1px solid rgba(217, 119, 6, 0.15)",
                iconBg: "rgba(217, 119, 6, 0.12)",
                iconColor: "#d97706",
                IconComponent: AlertCircle
              };
            } else if (briefing.statusLevel === 'busy') {
              styles = {
                textClass: "text-blue-600 dark:text-blue-400",
                containerBg: "rgba(37, 99, 235, 0.05)",
                containerBorder: "1px solid rgba(37, 99, 235, 0.15)",
                iconBg: "rgba(37, 99, 235, 0.12)",
                iconColor: "#2563eb",
                IconComponent: Calendar
              };
            } else if (briefing.statusLevel === 'done') {
              styles = {
                textClass: "text-indigo-600 dark:text-indigo-400",
                containerBg: "rgba(79, 70, 229, 0.05)",
                containerBorder: "1px solid rgba(79, 70, 229, 0.15)",
                iconBg: "rgba(79, 70, 229, 0.12)",
                iconColor: "#4f46e5",
                IconComponent: Trophy
              };
            }
            
            return (
              <div style={{
                background: styles.containerBg,
                backdropFilter: 'var(--panel-blur)',
                WebkitBackdropFilter: 'var(--panel-blur)',
                border: styles.containerBorder,
                borderRadius: '16px',
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                boxShadow: 'var(--shadow-sm)',
                textAlign: 'left'
              }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: styles.iconBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: styles.iconColor,
                  flexShrink: 0
                }}>
                  <styles.IconComponent size={18} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1 }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800 }} className={styles.textClass}>
                    {briefing.greeting}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', paddingLeft: '0.1rem' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ color: styles.iconColor, fontSize: '0.8rem' }}>•</span> {briefing.scheduleMessage}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ color: styles.iconColor, fontSize: '0.8rem' }}>•</span> {briefing.inventoryMessage}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 italic" style={{ marginTop: '0.1rem', fontSize: '0.68rem', opacity: 0.8 }}>
                    💡 {briefing.actionTip}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* KPI Strip — 4 핵심 지표 한눈에 */}
          <div className="kpi-strip">
            <div className="kpi-tile clickable" onClick={() => setActiveTab('calendar')}>
              <span className="kpi-label">오늘 일정</span>
              <div className="flex items-baseline gap-1" style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                <span className="kpi-value">{todayIncompleteSchedules.length}</span>
                <span className="kpi-sub">건</span>
              </div>
              <span className="text-xs text-gray-500" style={{ fontSize: '0.72rem', color: '#8e8e93', marginTop: '0.1rem' }}>
                (밀린 일정 {overdueSchedules.length}건)
              </span>
            </div>
            <div className="kpi-tile clickable" onClick={() => setActiveTab('calendar')}>
              <span className="kpi-label">예정</span>
              <div className="flex items-baseline gap-1" style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                <span className="kpi-value">{schedules.filter(s => !s.attrs.completed).length}</span>
                <span className="kpi-sub">전체</span>
              </div>
            </div>
            <div className="kpi-tile clickable" onClick={() => setActiveTab('memo' as any)}>
              <span className="kpi-label">메모</span>
              <div className="flex items-baseline gap-1" style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                <span className="kpi-value">{memos.length}</span>
                <span className="kpi-sub">건</span>
              </div>
            </div>
            <div className="kpi-tile clickable" onClick={() => setActiveTab('inventory')}>
              <span className="kpi-label">재고 품목</span>
              <div className="flex items-baseline gap-1" style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                <span className="kpi-value">{inventory.length}</span>
                <span className="kpi-sub">품목</span>
              </div>
            </div>
          </div>

          {/* Visual Analytics Widget */}
          <div style={{
            background: 'var(--panel-bg)',
            backdropFilter: 'var(--panel-blur)',
            WebkitBackdropFilter: 'var(--panel-blur)',
            border: '1px solid var(--panel-border)',
            borderRadius: '16px',
            padding: '1.2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Sliders size={15} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>데이터 인사이트</span>
            </div>

            <div className="insight-grid">
              {/* Task Progress & Completion Rate Combined Indicator */}
              <div style={{
                background: 'var(--insight-tile-bg)',
                border: '1px solid var(--insight-tile-border)',
                borderRadius: '12px',
                padding: '0.75rem 0.9rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem'
              }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>업무 진행 및 달성</div>
                {(() => {
                  const todoCount = schedules.filter(s => !s.attrs.completed && s.attrs.status !== 'doing').length;
                  const doingCount = schedules.filter(s => !s.attrs.completed && s.attrs.status === 'doing').length;
                  const doneCount = schedules.filter(s => s.attrs.completed).length;
                  const total = todoCount + doingCount + doneCount || 1;
                  const pct = Math.round((doneCount / total) * 100);
                  
                  const todoPct = (todoCount / total) * 100;
                  const doingPct = (doingCount / total) * 100;
                  const donePct = (doneCount / total) * 100;
                  
                  return (
                    <>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.15rem' }}>
                        <span style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                          {pct}
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>% 달성</span>
                      </div>
                      
                      {/* Segmented Progress Bar */}
                      <div style={{ display: 'flex', height: '5px', borderRadius: '3px', overflow: 'hidden', background: 'var(--panel-border)', width: '100%', marginTop: '0.1rem' }}>
                        {todoCount > 0 && <div style={{ width: `${todoPct}%`, background: '#9ca3af', height: '100%' }} title={`대기: ${todoCount}건`} />}
                        {doingCount > 0 && <div style={{ width: `${doingPct}%`, background: 'var(--accent)', height: '100%' }} title={`진행: ${doingCount}건`} />}
                        {doneCount > 0 && <div style={{ width: `${donePct}%`, background: 'var(--success)', height: '100%' }} title={`완료: ${doneCount}건`} />}
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.58rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                        <span>대기 {todoCount}</span>
                        <span>진행 {doingCount}</span>
                        <span>완료 {doneCount}</span>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Inventory Health Indicator (Red / Yellow / Green) */}
              <div style={{
                background: 'var(--insight-tile-bg)',
                border: '1px solid var(--insight-tile-border)',
                borderRadius: '12px',
                padding: '0.75rem 0.9rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem'
              }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>재고 건전성</div>
                {(() => {
                  // 위험 재고 = 수량이 음수(0개 밑)로 떨어진 품목
                  const dangerItemsCount = inventory.filter(i => (Number(i.attrs.qty) || 0) < 0).length;

                  let healthText = "양호";
                  let healthColor = "var(--success)"; // Green
                  let healthIcon = <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />;
                  let healthDesc = "모든 품목 수량 충분";

                  if (dangerItemsCount > 0) {
                    healthText = "위험";
                    healthColor = "var(--danger)"; // Red
                    healthIcon = <AlertTriangle size={14} style={{ color: 'var(--danger)' }} />;
                    healthDesc = `위험 재고 ${dangerItemsCount}개 (수량 음수)`;
                  }

                  return (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        {healthIcon}
                        <span style={{ fontSize: '1.4rem', fontWeight: 900, color: healthColor }}>
                          {healthText}
                        </span>
                      </div>
                      
                      {/* Subtitle list of low stock items */}
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '0.1rem' }}>
                        {healthDesc}
                      </div>
                      
                      <div style={{ fontSize: '0.58rem', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {inventory.filter(i => (Number(i.attrs.qty) || 0) < 0).map(i => i.title).join(', ') || '위험 재고 없음'}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Category stacked bar */}
            {(() => {
              const masterCats = appSettings.scheduleCategories || ['업무', '회의', '개인', '일반'];
              const displayCats = [...masterCats];
              const hasOther = schedules.some(s => !masterCats.includes(s.category || '일반'));
              if (hasOther) {
                displayCats.push('기타');
              }
              const getSchedulesForCat = (cat: string) => {
                return schedules.filter(s => {
                  const c = s.category || '일반';
                  if (cat === '기타') {
                    return !masterCats.includes(c);
                  }
                  return c === cat;
                });
              };

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    <span>일정 카테고리 구성 비율</span>
                    <span>총 {schedules.length}건</span>
                  </div>
                  <div style={{ height: '14px', borderRadius: '7px', display: 'flex', overflow: 'visible', background: 'var(--panel-border)', width: '100%', position: 'relative' }}>
                    {(() => {
                      const activeCats = displayCats.map(cat => {
                        const catSchedules = getSchedulesForCat(cat);
                        return { cat, catSchedules, cnt: catSchedules.length };
                      }).filter(c => c.cnt > 0);
                      
                      return activeCats.map((item, idx) => {
                        const { cat, catSchedules, cnt } = item;
                        const pct = Math.round((cnt / (schedules.length || 1)) * 100);
                        
                        const isFirst = idx === 0;
                        const isLast = idx === activeCats.length - 1;
                        
                        return (
                          <div
                            key={cat}
                            className="ratio-bar-segment"
                            style={{
                              height: '100%',
                              background: getCategoryColor(cat),
                              width: `${pct}%`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#ffffff',
                              fontSize: '0.55rem',
                              fontWeight: 800,
                              transition: 'width 0.4s ease',
                              cursor: 'pointer',
                              borderTopLeftRadius: isFirst ? '7px' : '0',
                              borderBottomLeftRadius: isFirst ? '7px' : '0',
                              borderTopRightRadius: isLast ? '7px' : '0',
                              borderBottomRightRadius: isLast ? '7px' : '0'
                            }}
                            onMouseEnter={e => {
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              setCategoryTooltip({
                                visible: true,
                                x: rect.left + rect.width / 2,
                                y: rect.top - 8,
                                cat,
                                cnt,
                                pct,
                                titles: catSchedules.map(s => s.title),
                                color: getCategoryColor(cat)
                              });
                            }}
                            onMouseLeave={() => setCategoryTooltip(null)}
                          >
                            {pct > 10 && cat}
                          </div>
                        );
                      });
                    })()}
                  </div>
                  <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', marginTop: '0.1rem' }}>
                    {displayCats.map(cat => {
                      const catSchedules = getSchedulesForCat(cat);
                      const cnt = catSchedules.length;
                      if (cnt === 0) return null;

                      return (
                        <div
                          key={cat}
                          className="legend-item-container"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontSize: '0.65rem',
                            color: 'var(--text-secondary)',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                          onMouseEnter={e => {
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setCategoryTooltip({
                              visible: true,
                              x: rect.left,
                              y: rect.top - 8,
                              cat,
                              cnt,
                              titles: catSchedules.map(s => s.title),
                              color: getCategoryColor(cat)
                            });
                          }}
                          onMouseLeave={() => setCategoryTooltip(null)}
                        >
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: getCategoryColor(cat) }} />
                          <span>{cat}</span>
                          <span style={{ color: 'var(--text-tertiary)' }}>{cnt}건</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Unified Overview Status Widget */}
          <div style={{ background: 'var(--panel-bg)', backdropFilter: 'var(--panel-blur)', WebkitBackdropFilter: 'var(--panel-blur)', border: '1px solid var(--panel-border)', borderRadius: '16px', padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            
            {/* 1. 오늘 예정된 일정 (Today's Schedule) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div 
                onClick={() => setIsTodaySchedulesExpanded(!isTodaySchedulesExpanded)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <CalIcon size={13} style={{ color: 'var(--accent)' }} />
                  <span>오늘 예정된 일정</span>
                  {todaySchedulesFull.length > 0 && <span className="badge" style={{ background: 'var(--accent-soft-bg)', color: 'var(--accent)', marginLeft: '0.2rem', fontSize: '0.6rem' }}>{todaySchedulesFull.length}건</span>}
                </div>
                <ChevronDown size={13} style={{ transform: isTodaySchedulesExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: 'var(--text-tertiary)' }} />
              </div>
              
              {isTodaySchedulesExpanded && (
                <div className="card-list" style={{ gap: '0.35rem' }}>
                  {todaySchedules.length === 0 ? (
                    <div style={{ padding: '0.4rem 0.1rem', fontSize: '0.78rem', color: 'var(--text-tertiary)', fontWeight: 500, textAlign: 'left' }}>등록된 일정이 존재하지 않습니다.</div>
                  ) : (
                    todaySchedules.map((s, idx) => (
                      <div 
                        key={s.id} 
                        className={`card card-compact ${s.attrs.completed ? 'completed opacity-40 line-through' : ''}`} 
                        style={{ 
                          padding: '0.5rem 0.8rem', 
                          borderRadius: '10px', 
                          opacity: s.attrs.completed ? 0.4 : undefined,
                          height: '56px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          gap: '0.15rem',
                          overflow: 'hidden',
                          cursor: 'pointer'
                        }} 
                        onClick={() => setEditingSchedule(s)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                          {/* Complete Check Icon */}
                          <div 
                            onClick={(e) => toggleComplete(e, s)}
                            style={{ color: s.attrs.completed ? 'var(--success)' : 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', marginRight: '0.4rem', flexShrink: 0 }}
                          >
                            {s.attrs.completed ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                          </div>

                          {/* Title (flex: 1) & Category badge */}
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                            <span
                              style={{
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                color: s.attrs.completed ? 'var(--text-tertiary)' : 'var(--text-primary)',
                                textDecoration: s.attrs.completed ? 'line-through' : 'none',
                                textAlign: 'left',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                              title={s.title}
                            >
                              {s.title}
                            </span>
                            {s.category && (
                              <span
                                className="badge"
                                style={{
                                  fontSize: '0.55rem',
                                  padding: '0.05rem 0.3rem',
                                  borderRadius: '4px',
                                  fontWeight: 600,
                                  flexShrink: 0,
                                  background: getCategorySoftBg(s.category),
                                  color: getCategoryColor(s.category),
                                  border: `1px solid ${getCategoryBorder(s.category)}`
                                }}
                              >
                                {s.category}
                              </span>
                            )}
                            {s.attrs.client && (
                              <span
                                className="badge"
                                style={{
                                  fontSize: '0.55rem',
                                  padding: '0.05rem 0.3rem',
                                  borderRadius: '4px',
                                  fontWeight: 600,
                                  flexShrink: 0,
                                  background: 'var(--hover-bg)',
                                  color: 'var(--text-secondary)',
                                  border: '1px solid var(--panel-border)'
                                }}
                              >
                                {s.attrs.client}
                              </span>
                            )}
                          </div>

                          {/* Time */}
                          {s.attrs.allDay ? (
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: 600, flexShrink: 0, marginLeft: '0.5rem', background: 'var(--hover-bg)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                              하루 종일
                            </span>
                          ) : s.attrs.time ? (
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: 600, flexShrink: 0, marginLeft: '0.5rem' }}>
                              {s.attrs.time}
                            </span>
                          ) : null}
                        </div>
                        
                        {/* Linked Badges (Single row below title) */}
                        {s.attrs.linkedIds && s.attrs.linkedIds.length > 0 && (
                          <div style={{ display: 'flex', gap: '0.2rem', overflow: 'hidden', whiteSpace: 'nowrap', paddingLeft: '1.05rem' }}>
                            {s.attrs.linkedIds.map((linkedId: string) => {
                              const linkedRecord = records.find(r => r.id === linkedId);
                              if (!linkedRecord) return null;
                              return (
                                <span 
                                  key={linkedId} 
                                  style={{ fontSize: '0.58rem', backgroundColor: 'rgba(0,0,0,0.03)', color: 'var(--text-secondary)', borderRadius: '4px', padding: '0.02rem 0.25rem', border: '1px solid var(--panel-border)', flexShrink: 0 }}
                                >
                                  #{linkedRecord.title}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Divider */}
            <div style={{ height: '1px', background: 'var(--panel-border)', opacity: 0.6 }} />

            {/* 2. 최근 등록된 메모 (Recent Memos) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div 
                onClick={() => setIsRecentMemosExpanded(!isRecentMemosExpanded)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ClipboardList size={13} style={{ color: 'var(--accent)' }} />
                  <span>최근 등록된 메모</span>
                </div>
                <ChevronDown size={13} style={{ transform: isRecentMemosExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: 'var(--text-tertiary)' }} />
              </div>
              
              {isRecentMemosExpanded && (
                <div className="card-list" style={{ gap: '0.35rem' }}>
                  {recentMemos.length === 0 ? (
                    <div style={{ padding: '0.4rem 0.1rem', fontSize: '0.78rem', color: 'var(--text-tertiary)', fontWeight: 500, textAlign: 'left' }}>등록된 메모가 존재하지 않습니다.</div>
                  ) : (
                    recentMemos.map(m => (
                      <div 
                        key={m.id} 
                        className="card card-compact" 
                        style={{ 
                          padding: '0.5rem 0.8rem',
                          borderRadius: '10px',
                          height: '56px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          gap: '0.15rem',
                          cursor: 'pointer',
                          overflow: 'hidden',
                          ...getMemoCardStyle(m.attrs.color || '', theme === 'dark')
                        }} 
                        onClick={() => {
                          setMemoForm({ id: m.id, title: m.title || '제목 없음', content: m.attrs.content || '', pinned: m.attrs.pinned || false, color: m.attrs.color || '', client: m.attrs.client || '' });
                          setIsMemoEditing(false); // 상세보기 = 읽기 전용
                          setIsMemoModalOpen(true);
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', width: '100%' }}>
                          {m.attrs.pinned && <Pin size={11} style={{ color: 'var(--accent)', transform: 'rotate(45deg)', flexShrink: 0 }} />}
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>
                            {m.title || '제목 없음'}
                          </span>
                          <span style={{ fontSize: '0.58rem', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                            {format(parseISO(m.updatedAt || new Date().toISOString()), 'yy.MM.dd')}
                          </span>
                        </div>
                        
                        {/* Excerpt of content */}
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left', paddingLeft: m.attrs.pinned ? '0.85rem' : '0' }}>
                          {m.attrs.content ? stripMarkdown(m.attrs.content).substring(0, 50) : '내용 없음'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Divider */}
            <div style={{ height: '1px', background: 'var(--panel-border)', opacity: 0.6 }} />

            {/* 3. 재고 흐름 요약 (Inventory Flow Summary) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div 
                onClick={() => setIsInventoryFlowExpanded(!isInventoryFlowExpanded)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Layers size={13} style={{ color: 'var(--accent)' }} />
                  <span>재고 흐름 요약</span>
                </div>
                <ChevronDown size={13} style={{ transform: isInventoryFlowExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: 'var(--text-tertiary)' }} />
              </div>

              {isInventoryFlowExpanded && (
                <div className="card-list" style={{ gap: '0.35rem' }}>
                  
                  {/* Low Stock Alerts */}
                  {lowStockItems.length > 0 && (
                    <div style={{ background: 'var(--danger-soft-bg)', border: '1px solid var(--danger-soft-border)', borderRadius: '8px', padding: '0.4rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <AlertTriangle size={12} style={{ color: 'var(--danger)' }} />
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--danger)' }}>수량 부족 품목 {lowStockItems.length}개 검출! 빠른 확인 요망.</span>
                    </div>
                  )}

                  {recentInventoryFlow.length === 0 ? (
                    <div style={{ padding: '0.4rem 0.1rem', fontSize: '0.78rem', color: 'var(--text-tertiary)', fontWeight: 500, textAlign: 'left' }}>등록된 재고가 존재하지 않습니다.</div>
                  ) : (
                    recentInventoryFlow.map((item, idx) => {
                      const qtyNum = Number(item.attrs.qty) || 0;
                      const isNegative = qtyNum < 0;
                      return (
                        <div 
                          key={item.id} 
                          className="inv-card" 
                          style={{ 
                            padding: '0.5rem 0.8rem', 
                            borderRadius: '10px',
                            height: '56px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            gap: '0.15rem',
                            overflow: 'hidden',
                            cursor: 'pointer'
                          }} 
                          onClick={() => setEditingInventory(item)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            {/* Flow Badge & Title */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0, flex: 1 }}>
                              <span
                                className="badge"
                                style={{
                                  background: isNegative ? 'var(--danger-soft-bg)' : qtyNum === 0 ? 'var(--hover-bg)' : 'var(--success-soft-bg)',
                                  color: isNegative ? 'var(--danger)' : qtyNum === 0 ? 'var(--text-tertiary)' : 'var(--success)',
                                  fontSize: '0.55rem',
                                  padding: '0.05rem 0.25rem',
                                  borderRadius: '4px',
                                  fontWeight: 800,
                                  flexShrink: 0
                                }}
                              >
                                {isNegative ? '부족' : qtyNum === 0 ? '소진' : '보유'}
                              </span>
                              <span 
                                style={{ 
                                  fontSize: '0.78rem', 
                                  fontWeight: 700, 
                                  color: 'var(--text-primary)', 
                                  textOverflow: 'ellipsis', 
                                  overflow: 'hidden', 
                                  whiteSpace: 'nowrap',
                                  textAlign: 'left'
                                }}
                                title={item.title}
                              >
                                {item.title}
                              </span>
                            </div>
                            
                            {/* Quantity */}
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.15rem', flexShrink: 0, marginLeft: '0.5rem' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: isNegative ? 'var(--danger)' : 'var(--text-primary)' }}>
                                {qtyNum}
                              </span>
                              <span style={{ fontSize: '0.58rem', color: 'var(--text-tertiary)' }}>개</span>
                            </div>
                          </div>

                          {/* Subtitle row: Index & Code Badge */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.62rem', color: 'var(--text-tertiary)', paddingLeft: '1.95rem' }}>
                            <span style={{ fontFamily: 'monospace' }}>#{String(idx + 1).padStart(2, '0')}</span>
                            {item.attrs.code && (
                              <span className="badge" style={{ fontSize: '0.52rem', padding: '0.01rem 0.25rem', borderRadius: '3px' }}>
                                Code: {item.attrs.code}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ==================== 2. [일정] CALENDAR PAGE TAB ==================== */}
      {searchQuery === null && activeTab === 'calendar' && (
        <ScheduleSection schedules={schedules} sortedClients={sortedClients} />
      )}

      {/* ==================== 3. [재고] INVENTORY TAB ==================== */}
      {searchQuery === null && activeTab === 'inventory' && (
        <InventorySection inventory={inventory} />
      )}

      {/* ==================== 4. [메모] MEMO TAB ==================== */}
      {searchQuery === null && activeTab === ('memo' as any) && (
        <MemoSection
          memos={memos}
          displayedMemos={displayedMemos}
          memoTotalPages={memoTotalPages}
          memosPerPage={memosPerPage}
          setIsMemoEditing={setIsMemoEditing}
        />
      )}

      {/* Schedule Edit Modal (Serves both Add & Edit!) */}
      <AnimatePresence>
        {editingSchedule && (
          <ScheduleEditModal
            editingSchedule={editingSchedule}
            setEditingSchedule={setEditingSchedule}
            onClose={() => { setEditingSchedule(null); setCustomScheduleCategory(''); }}
            saveSchedule={saveSchedule}
            handleDeleteSchedule={handleDeleteSchedule}
            appSettings={appSettings}
            sortedClients={sortedClients}
            records={records}
          />
        )}
      </AnimatePresence>

      {/* Inventory Item Edit Modal (Serves both Add & Edit!) */}
      <AnimatePresence>
        {editingInventory && (
          <InventoryEditModal
            editingInventory={editingInventory}
            setEditingInventory={setEditingInventory}
            onClose={() => { setEditingInventory(null); setCustomInventoryCategory(''); }}
            saveInventory={saveInventory}
            deleteInventoryItem={deleteInventoryItem}
            knownCodes={knownCodes}
            namesByCode={namesByCode}
            categoryByCode={categoryByCode}
            appSettings={appSettings}
            sortedClients={sortedClients}
          />
        )}
      </AnimatePresence>

      {/* Memo (Key Updates) Edit Modal */}
      <AnimatePresence>
        {isMemoModalOpen && (
          <MemoEditModal
            memoForm={memoForm}
            setMemoForm={setMemoForm}
            onClose={() => setIsMemoModalOpen(false)}
            isMemoEditing={isMemoEditing}
            setIsMemoEditing={setIsMemoEditing}
            submitMemo={submitMemo}
            deleteMemo={deleteMemo}
            exportToCsv={exportToCsv}
            printToPdf={printToPdf}
            theme={theme}
            sortedClients={sortedClients}
            schedules={schedules}
            inventory={inventory}
          />
        )}
      </AnimatePresence>

      {/* Cmd+F Command Palette Modal */}
      <AnimatePresence>
        {isCommandPaletteOpen && (
          <div 
            className="modal-overlay" 
            onClick={() => {
              setIsCommandPaletteOpen(false);
              setCommandPaletteQuery('');
              setCommandPaletteSelectedIndex(0);
            }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              backgroundColor: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              zIndex: 2000,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              paddingTop: '25vh'
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: -20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: -20 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="modal-content"
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '600px',
                background: 'var(--input-bg)',
                borderRadius: '20px',
                border: '1px solid var(--panel-border)',
                boxShadow: '0 20px 60px var(--shadow-color)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                padding: 0
              }}
            >
              {/* Search Input Bar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '1.2rem',
                borderBottom: '1px solid var(--panel-border)',
                background: 'rgba(255,255,255,0.01)'
              }}>
                <Search size={20} style={{ color: 'var(--text-tertiary)' }} />
                <input
                  id="command-palette-search-input"
                  type="text"
                  placeholder="일정, 재고, 메모 검색... (방향키 이동 & Enter 선택)"
                  value={commandPaletteQuery}
                  onChange={e => {
                    setCommandPaletteQuery(e.target.value);
                    setCommandPaletteSelectedIndex(0);
                  }}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: '1.05rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    padding: 0
                  }}
                />
                <button
                  onClick={() => {
                    setIsCommandPaletteOpen(false);
                    setCommandPaletteQuery('');
                    setCommandPaletteSelectedIndex(0);
                  }}
                  style={{
                    background: 'var(--row-bg)',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  ESC
                </button>
              </div>

              {/* Results List */}
              <div style={{
                maxHeight: '350px',
                overflowY: 'auto',
                padding: '0.6rem'
              }}>
                {!commandPaletteQuery.trim() ? (
                  <div style={{
                    padding: '3rem 2rem',
                    textAlign: 'center',
                    color: 'var(--text-tertiary)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.6rem'
                  }}>
                    <Search size={32} style={{ color: 'var(--text-tertiary)', opacity: 0.5 }} />
                    <div style={{ fontSize: '0.86rem', fontWeight: 600 }}>통합 검색 및 명령 팔레트</div>
                    <div style={{ fontSize: '0.76rem', opacity: 0.7 }}>일정, 재고(품목명/시리얼/담당자), 메모 제목 및 본문을 검색해 보세요.</div>
                  </div>
                ) : filteredPaletteItems.length === 0 ? (
                  <div style={{
                    padding: '3rem 2rem',
                    textAlign: 'center',
                    color: 'var(--text-tertiary)',
                    fontSize: '0.84rem',
                    fontWeight: 600
                  }}>
                    {`'${commandPaletteQuery}'에 대한 검색 결과가 없습니다.`}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    {filteredPaletteItems.map((item, idx) => {
                      const isSelected = idx === commandPaletteSelectedIndex;
                      return (
                        <div
                          key={item.id}
                          onClick={() => selectPaletteItem(item)}
                          onMouseEnter={() => setCommandPaletteSelectedIndex(idx)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.65rem 0.85rem',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            background: isSelected ? 'var(--row-bg)' : 'transparent',
                            transform: isSelected ? 'scale(1.005)' : 'none',
                            borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', overflow: 'hidden', flex: 1 }}>
                            {/* Type Badge */}
                            <span style={{
                              fontSize: '0.65rem',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '6px',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              background: item.type === 'event' 
                                ? 'rgba(0,122,255,0.1)' 
                                : item.type === 'asset'
                                  ? 'rgba(52,199,89,0.1)'
                                  : 'rgba(175,82,222,0.1)',
                              color: item.type === 'event'
                                ? '#007aff'
                                : item.type === 'asset'
                                  ? '#34c759'
                                  : '#af52de',
                              flexShrink: 0
                            }}>
                              {item.type === 'event' ? '일정' : item.type === 'asset' ? '재고' : '메모'}
                            </span>

                            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                              <span style={{
                                fontSize: '0.86rem',
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {item.title}
                              </span>
                              {item.subtitle && (
                                <span style={{
                                  fontSize: '0.72rem',
                                  color: 'var(--text-secondary)',
                                  marginTop: '0.15rem',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  opacity: 0.85
                                }}>
                                  {item.subtitle}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Quick Go Hint */}
                          {isSelected && (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.2rem',
                              fontSize: '0.68rem',
                              color: 'var(--text-tertiary)',
                              fontWeight: 700,
                              background: 'rgba(0,0,0,0.05)',
                              padding: '0.15rem 0.4rem',
                              borderRadius: '4px',
                              flexShrink: 0
                            }}>
                              <span>이동</span>
                              <CornerDownLeft size={10} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bottom Hotkey Guide Bar */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem 1.2rem',
                borderTop: '1px solid var(--panel-border)',
                background: 'rgba(0,0,0,0.02)',
                fontSize: '0.68rem',
                color: 'var(--text-tertiary)',
                fontWeight: 600
              }}>
                <div style={{ display: 'flex', gap: '0.8rem' }}>
                  <span>↑↓ 이동</span>
                  <span>Enter 선택</span>
                  <span>ESC 닫기</span>
                </div>
                <div>
                  <span>Cmd + F 로 언제든지 열기</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Fixed-position category tooltip — escapes overflow/stacking-context clipping */}
      {categoryTooltip && categoryTooltip.visible && (
        <div
          style={{
            position: 'fixed',
            left: categoryTooltip.x,
            top: categoryTooltip.y,
            transform: 'translate(-50%, -100%)',
            background: 'var(--input-bg)',
            border: '1px solid var(--panel-border)',
            boxShadow: '0 10px 30px var(--shadow-color)',
            borderRadius: '8px',
            padding: '0.6rem 0.8rem',
            zIndex: 9999,
            width: 'max-content',
            maxWidth: '250px',
            color: 'var(--text-primary)',
            textAlign: 'left',
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontWeight: 800, fontSize: '0.75rem', marginBottom: '0.35rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.2rem', color: categoryTooltip.color, display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
            <span>{categoryTooltip.cat}</span>
            <span>{categoryTooltip.cnt}건{categoryTooltip.pct !== undefined ? ` (${categoryTooltip.pct}%)` : ''}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {categoryTooltip.titles.map((title, i) => (
              <div key={i} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                • {title}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
