"use client";

import { useState, useEffect, useMemo } from 'react';
import { format, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, CornerDownLeft, X } from 'lucide-react';
import { useApp } from '@/frontend/context/AppContext';
import { ACCENT_COLORS, addRecord, expandRecurringEvents } from '@/database';
import SettingsSection from '@/frontend/components/SettingsSection';
import CustomSelect from '@/frontend/components/CustomSelect';
import { stripMarkdown } from '@/frontend/utils/markdown';
import SearchSelect from '@/frontend/components/SearchSelect';
import InventoryEditModal from '@/frontend/components/InventoryEditModal';
import ScheduleEditModal from '@/frontend/components/ScheduleEditModal';
import MemoEditModal from '@/frontend/components/MemoEditModal';
import MemoSection from '@/frontend/components/MemoSection';
import InventorySection from '@/frontend/components/InventorySection';
import ScheduleSection from '@/frontend/components/ScheduleSection';
import OverviewSection from '@/frontend/components/OverviewSection';

// isHoliday → @/frontend/utils/calendar, isSerialPattern → @/frontend/utils/inventory 로 분리됨
// 색상·카드 스타일 헬퍼는 @/frontend/utils/styles 로 분리됨 (hexToRgb, getCategoryColorStyles, getMemoCardStyle, getMemoModalStyle)



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





  // Local Category Filters for Schedule and Inventory (Enforce strict isolation!)



  // States for Cmd+F Command Palette
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [commandPaletteQuery, setCommandPaletteQuery] = useState<string>('');
  const [commandPaletteSelectedIndex, setCommandPaletteSelectedIndex] = useState<number>(0);

  // 메모 모달 보기/수정 모드 — 상세보기는 읽기 전용으로 열리고, '수정' 클릭 시에만 편집 모드로 전환된다.
  const [isMemoEditing, setIsMemoEditing] = useState<boolean>(false);


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
        <OverviewSection
          schedules={schedules}
          memos={memos}
          inventory={inventory}
          setIsMemoEditing={setIsMemoEditing}
        />
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

    </div>
  );
}
