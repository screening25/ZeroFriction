"use client";

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { format, addWeeks, subWeeks, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, parseISO, isToday } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { Sun, Moon, Plus, ChevronLeft, ChevronRight, CheckCircle2, Circle, Package, Download, Upload, AlertTriangle, Calendar as CalIcon, Layers, ClipboardList, ChevronDown, FileText, Settings, MapPin, Tag, User, Sliders, Pin } from 'lucide-react';
import { useApp } from '@/frontend/context/AppContext';
import { solarHolidays, lunarHolidays2026, ACCENT_COLORS, addRecord, expandRecurringEvents } from '@/database';
import SettingsSection from '@/frontend/components/SettingsSection';
import CustomTimePicker from '@/frontend/components/CustomTimePicker';
import CustomSelect from '@/frontend/components/CustomSelect';
import CustomDatePicker from '@/frontend/components/CustomDatePicker';
import Markdown from '@/frontend/components/Markdown';

const isHoliday = (date: Date) => solarHolidays.includes(format(date, 'MM-dd')) || lunarHolidays2026.includes(format(date, 'yyyy-MM-dd'));

const getCategoryColor = (cat: string) => {
  switch (cat) {
    case '업무': return '#007AFF';
    case '회의': return '#FF9500';
    case '개인': return '#34C759';
    default: return '#AF52DE';
  }
};

const getCategorySoftBg = (cat: string) => {
  switch (cat) {
    case '업무': return 'rgba(0, 122, 255, 0.12)';
    case '회의': return 'rgba(255, 149, 0, 0.12)';
    case '개인': return 'rgba(52, 199, 89, 0.12)';
    default: return 'rgba(175, 82, 222, 0.12)';
  }
};

const getCategoryBorder = (cat: string) => {
  switch (cat) {
    case '업무': return 'rgba(0, 122, 255, 0.25)';
    case '회의': return 'rgba(255, 149, 0, 0.25)';
    case '개인': return 'rgba(52, 199, 89, 0.25)';
    default: return 'rgba(175, 82, 222, 0.25)';
  }
};

const getMemoCardStyle = (color: string, isDark: boolean) => {
  // 프리미엄 소프트 틴트 — 라이트는 파스텔-50, 다크는 저채도 muted
  const light: Record<string, { backgroundColor: string; border: string }> = {
    red:    { backgroundColor: '#FEF2F2', border: '1px solid rgba(239, 68, 68, 0.14)' },
    orange: { backgroundColor: '#FFF7ED', border: '1px solid rgba(249, 115, 22, 0.14)' },
    yellow: { backgroundColor: '#FEFCE8', border: '1px solid rgba(234, 179, 8, 0.16)' },
    green:  { backgroundColor: '#F0FDF4', border: '1px solid rgba(34, 197, 94, 0.14)' },
    blue:   { backgroundColor: '#EFF6FF', border: '1px solid rgba(59, 130, 246, 0.14)' },
    purple: { backgroundColor: '#FAF5FF', border: '1px solid rgba(168, 85, 247, 0.14)' },
  };
  const dark: Record<string, { backgroundColor: string; border: string }> = {
    red:    { backgroundColor: 'rgba(248, 113, 113, 0.10)', border: '1px solid rgba(248, 113, 113, 0.18)' },
    orange: { backgroundColor: 'rgba(251, 146, 60, 0.10)',  border: '1px solid rgba(251, 146, 60, 0.18)' },
    yellow: { backgroundColor: 'rgba(250, 204, 21, 0.10)',  border: '1px solid rgba(250, 204, 21, 0.18)' },
    green:  { backgroundColor: 'rgba(74, 222, 128, 0.10)',  border: '1px solid rgba(74, 222, 128, 0.18)' },
    blue:   { backgroundColor: 'rgba(96, 165, 250, 0.10)',  border: '1px solid rgba(96, 165, 250, 0.18)' },
    purple: { backgroundColor: 'rgba(192, 132, 252, 0.10)', border: '1px solid rgba(192, 132, 252, 0.18)' },
  };
  const palette = isDark ? dark : light;
  if (color && palette[color]) return palette[color];
  // 기본(무색) — 깔끔한 중립 카드
  return isDark
    ? { backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.08)' }
    : { backgroundColor: '#FFFFFF', border: '1px solid rgba(0, 0, 0, 0.06)' };
};


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
    archive, restoreArchived, permanentDelete, emptyArchive, clearActivities,
    activities,
    searchQuery, searchType, setSearchResult
  } = useApp();



  // Local Category Filters for Schedule and Inventory (Enforce strict isolation!)
  const [selectedScheduleCategory, setSelectedScheduleCategory] = useState<string>('전체');
  const [selectedInventoryCategory, setSelectedInventoryCategory] = useState<string>('전체');

  // Widgets collapse/expand states inside Overview
  const [isTodaySchedulesExpanded, setIsTodaySchedulesExpanded] = useState<boolean>(true);
  const [isRecentMemosExpanded, setIsRecentMemosExpanded] = useState<boolean>(true);
  const [isInventoryFlowExpanded, setIsInventoryFlowExpanded] = useState<boolean>(true);

  const [schedulePage, setSchedulePage] = useState<number>(0);
  const [inventoryPage, setInventoryPage] = useState<number>(0);

  useEffect(() => {
    setSchedulePage(0);
  }, [selectedScheduleCategory, selectedDate]);

  useEffect(() => {
    setInventoryPage(0);
  }, [selectedInventoryCategory]);

  // Input states for custom category creation inside modals
  const [customScheduleCategory, setCustomScheduleCategory] = useState<string>('');
  const [customInventoryCategory, setCustomInventoryCategory] = useState<string>('');

  const [isMasterSettingsOpen, setIsMasterSettingsOpen] = useState(false);
  const [newLocInput, setNewLocInput] = useState('');
  const [newCatInput, setNewCatInput] = useState('');
  const [newMgrInput, setNewMgrInput] = useState('');

  const [isScheduleMasterSettingsOpen, setIsScheduleMasterSettingsOpen] = useState(false);
  const [newSchedCatInput, setNewSchedCatInput] = useState('');

  const addMasterScheduleCategory = (cat: string) => {
    if (!cat.trim()) return;
    const current = appSettings.scheduleCategories || ['업무', '회의', '개인', '일반'];
    if (current.includes(cat.trim())) return;
    const updated = { ...appSettings, scheduleCategories: [...current, cat.trim()] };
    handleSettingsChange(updated);
    setNewSchedCatInput('');
    showToast(`일정 카테고리 '${cat.trim()}' 추가 완료`);
  };

  const deleteMasterScheduleCategory = (cat: string) => {
    const current = appSettings.scheduleCategories || ['업무', '회의', '개인', '일반'];
    const updated = { ...appSettings, scheduleCategories: current.filter(x => x !== cat) };
    handleSettingsChange(updated);
    showToast(`일정 카테고리 '${cat}' 삭제 완료`);
  };

  const addMasterLocation = (loc: string) => {
    if (!loc.trim()) return;
    const current = appSettings.locations || ['비즈니스 창고', '메인 매장', '이동용 밴', 'A창고', 'B창고'];
    if (current.includes(loc.trim())) return;
    const updated = { ...appSettings, locations: [...current, loc.trim()] };
    handleSettingsChange(updated);
    setNewLocInput('');
    showToast(`보관 위치 '${loc.trim()}' 추가 완료`);
  };

  const deleteMasterLocation = (loc: string) => {
    const current = appSettings.locations || ['비즈니스 창고', '메인 매장', '이동용 밴', 'A창고', 'B창고'];
    const updated = { ...appSettings, locations: current.filter(x => x !== loc) };
    handleSettingsChange(updated);
    showToast(`보관 위치 '${loc}' 삭제 완료`);
  };

  const addMasterCategory = (cat: string) => {
    if (!cat.trim()) return;
    const current = appSettings.categories || ['재고', 'IT 장비', '촬영 장비', '사무 용품', '기타'];
    if (current.includes(cat.trim())) return;
    const updated = { ...appSettings, categories: [...current, cat.trim()] };
    handleSettingsChange(updated);
    setNewCatInput('');
    showToast(`카테고리 '${cat.trim()}' 추가 완료`);
  };

  const deleteMasterCategory = (cat: string) => {
    const current = appSettings.categories || ['재고', 'IT 장비', '촬영 장비', '사무 용품', '기타'];
    const updated = { ...appSettings, categories: current.filter(x => x !== cat) };
    handleSettingsChange(updated);
    showToast(`카테고리 '${cat}' 삭제 완료`);
  };

  const addMasterManager = (mgr: string) => {
    if (!mgr.trim()) return;
    const current = appSettings.managers || ['윤상영', '김철수', '이영희', '박민수'];
    if (current.includes(mgr.trim())) return;
    const updated = { ...appSettings, managers: [...current, mgr.trim()] };
    handleSettingsChange(updated);
    setNewMgrInput('');
    showToast(`담당 관리자 '${mgr.trim()}' 추가 완료`);
  };

  const deleteMasterManager = (mgr: string) => {
    const current = appSettings.managers || ['윤상영', '김철수', '이영희', '박민수'];
    const updated = { ...appSettings, managers: current.filter(x => x !== mgr) };
    handleSettingsChange(updated);
    showToast(`담당 관리자 '${mgr}' 삭제 완료`);
  };

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
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  const inventory = records.filter(r => r.type === 'asset');

  // Calendar rendering logic (Used inside Calendar Page)
  let days: Date[] = [];
  if (calendarMode === 'monthly') {
    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(monthStart);
    days = eachDayOfInterval({ start: startOfWeek(monthStart, { weekStartsOn: 0 }), end: endOfWeek(monthEnd, { weekStartsOn: 0 }) });
  } else if (calendarMode === 'weekly') {
    days = eachDayOfInterval({ start: startOfWeek(viewDate, { weekStartsOn: 0 }), end: endOfWeek(viewDate, { weekStartsOn: 0 }) });
  } else if (calendarMode === 'daily') {
    days = [viewDate];
  }

  const navigatePrev = () => {
    if (calendarMode === 'monthly') setViewDate(subMonths(viewDate, 1));
    else if (calendarMode === 'weekly') setViewDate(subWeeks(viewDate, 1));
    else setViewDate(new Date(viewDate.getTime() - 86400000));
  };
  const navigateNext = () => {
    if (calendarMode === 'monthly') setViewDate(addMonths(viewDate, 1));
    else if (calendarMode === 'weekly') setViewDate(addWeeks(viewDate, 1));
    else setViewDate(new Date(viewDate.getTime() + 86400000));
  };

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const selectedSchedules = schedules
    .filter(s => s.attrs.date === selectedDateStr)
    .sort((a, b) => (a.attrs.time || '23:59').localeCompare(b.attrs.time || '23:59'));

  // Apply Schedule Local Category filter
  const displaySchedules = selectedScheduleCategory === '전체'
    ? selectedSchedules
    : selectedSchedules.filter(s => s.category === selectedScheduleCategory);

  const schedulesPerPage = appSettings.maxEventsShown || 5;
  const scheduleTotalPages = Math.ceil(displaySchedules.length / schedulesPerPage);
  const paginatedSchedules = displaySchedules.slice(schedulePage * schedulesPerPage, (schedulePage + 1) * schedulesPerPage);

  // Apply Inventory Local Category filter
  const displayInventories = selectedInventoryCategory === '전체'
    ? inventory
    : inventory.filter(i => i.category === selectedInventoryCategory);

  const inventoryPerPage = appSettings.maxInventoryShown || 5;
  const inventoryTotalPages = Math.ceil(displayInventories.length / inventoryPerPage);
  const paginatedInventories = displayInventories.slice(inventoryPage * inventoryPerPage, (inventoryPage + 1) * inventoryPerPage);

  const memosPerPage = appSettings.maxMemosShown || 3;
  const memoTotalPages = Math.ceil(memos.length / memosPerPage);
  const displayedMemos = memos.slice(memoPage * memosPerPage, (memoPage + 1) * memosPerPage);

  // Dynamic isolated category pools
  const scheduleCategories = ['전체', ...(appSettings.scheduleCategories || ['업무', '회의', '개인', '일반'])];
  const inventoryCategories = ['전체', ...(appSettings.categories || ['재고', 'IT 장비', '촬영 장비', '사무 용품', '기타'])];

  // Check if filtering is dynamically required (Only show bar if there are meaningful custom categories!)
  const showScheduleFilterBar = scheduleCategories.filter(c => c !== '전체').length >= 1;
  const showInventoryFilterBar = inventoryCategories.filter(c => c !== '전체').length >= 1;

  // Today's summary values for Home Dashboard
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayIncompleteSchedules = schedules.filter(s => s.attrs.date === todayStr && !s.attrs.completed);
  const overdueSchedules = schedules.filter(s => s.attrs.date < todayStr && !s.attrs.completed);
  const todaySchedulesFull = schedules
    .filter(s => s.attrs.date === todayStr)
    .sort((a, b) => (a.attrs.time || '23:59').localeCompare(b.attrs.time || '23:59'));
  const todaySchedules = todaySchedulesFull.slice(0, appSettings.maxEventsShown || 5);
  const recentMemos = memos.slice(0, appSettings.maxMemosShown || 3); // Show latest memos on Dashboard up to limit
  const lowStockItems = inventory.filter(i => (Number(i.attrs.qty) || 0) < 0); // Critical items with negative stock (qty < 0)
  const recentInventoryFlow = inventory.slice(0, appSettings.maxInventoryShown || 5); // Show latest asset adjustments up to limit

  // Filter records for NLQ View
  const filteredSearchRecords = records.filter(r => {
    if (searchType && r.type !== searchType) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const hay = `${r.title} ${r.category} ${r.attrs?.content || ''} ${r.attrs?.code || ''} ${r.attrs?.memo || ''}`.toLowerCase();
    return hay.includes(query);
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
    if (!editingInventory.title.trim()) {
      showToast('품목명을 입력해주십시오');
      return;
    }
    if (!editingInventory.id) {
      // 신규 등록
      addRecord({
        title: editingInventory.title,
        type: 'asset',
        category: editingInventory.category || '재고',
        attrs: {
          ...editingInventory.attrs,
          qty: Number(editingInventory.attrs.qty) || 0
        }
      });
      reloadRecords();
      showToast('새 재고 품목 등록 완료');
      logActivity('ADD_INV', '재고 직접 추가', `${editingInventory.title} ${editingInventory.attrs.qty}개`);
      setEditingInventory(null);
    } else {
      // 기존 수정
      handleUpdateInventory(editingInventory.id, editingInventory);
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.05rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>검색 결과</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>검색된 결과입니다</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>'{searchQuery}' 키워드 검색 결과 (ESC 누르면 대시보드로 복귀)</div>
            </div>
            <button 
              className="ghost-btn" 
              onClick={() => setSearchResult(null, null)}
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem', borderRadius: '6px', border: '1px solid var(--panel-border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              닫기 (ESC)
            </button>
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
                        setMemoForm({ id: item.id, title: item.title, content: item.attrs.content || '', pinned: item.attrs.pinned || false, color: item.attrs.color || '' });
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.8rem' }}>
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
                <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: 700 }}>업무 진행 및 달성</div>
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
                <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: 700 }}>재고 건전성</div>
                {(() => {
                  const lowStockItemsCount = inventory.filter(i => (Number(i.attrs.qty) || 0) < 5).length;
                  const outOfStockItemsCount = inventory.filter(i => (Number(i.attrs.qty) || 0) === 0).length;
                  
                  let healthText = "양호";
                  let healthColor = "var(--success)"; // Green
                  let healthIcon = <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />;
                  let healthDesc = "모든 품목 수량 충분";
                  
                  if (outOfStockItemsCount > 0 || lowStockItemsCount >= 3) {
                    healthText = "위험";
                    healthColor = "var(--danger)"; // Red
                    healthIcon = <AlertTriangle size={14} style={{ color: 'var(--danger)' }} />;
                    healthDesc = `${outOfStockItemsCount > 0 ? `품절 ${outOfStockItemsCount}개 · ` : ''}총 ${lowStockItemsCount}개 부족`;
                  } else if (lowStockItemsCount > 0) {
                    healthText = "주의";
                    healthColor = "#EAB308"; // Amber/Yellow
                    healthIcon = <AlertTriangle size={14} style={{ color: '#EAB308' }} />;
                    healthDesc = `${lowStockItemsCount}개 품목 안전재고 이하`;
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
                        {inventory.filter(i => (Number(i.attrs.qty) || 0) < 5).map(i => i.title).join(', ') || '부족한 품목 없음'}
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
              const getCountForCat = (cat: string) => {
                return schedules.filter(s => {
                  const c = s.category || '일반';
                  if (cat === '기타') {
                    return !masterCats.includes(c);
                  }
                  return c === cat;
                }).length;
              };

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    <span>일정 카테고리 구성 비율</span>
                    <span>총 {schedules.length}건</span>
                  </div>
                  <div style={{ height: '14px', borderRadius: '7px', display: 'flex', overflow: 'hidden', background: 'var(--panel-border)', width: '100%' }}>
                    {displayCats.map(cat => {
                      const cnt = getCountForCat(cat);
                      const pct = Math.round((cnt / (schedules.length || 1)) * 100);
                      if (pct === 0) return null;
                      return (
                        <div
                          key={cat}
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
                            transition: 'width 0.4s ease'
                          }}
                          title={`${cat}: ${cnt}건 (${pct}%)`}
                        >
                          {pct > 10 && cat}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', marginTop: '0.1rem' }}>
                    {displayCats.map(cat => {
                      const cnt = getCountForCat(cat);
                      if (cnt === 0) return null;
                      return (
                        <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
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
                <div className="card-list" style={{ gap: '1.25rem' }}>
                  {todaySchedules.length === 0 ? (
                    <div style={{ padding: '0.4rem 0.1rem', fontSize: '0.78rem', color: 'var(--text-tertiary)', fontWeight: 500, textAlign: 'left' }}>등록된 일정이 존재하지 않습니다.</div>
                  ) : (
                    todaySchedules.map((s, idx) => (
                      <div 
                        key={s.id} 
                        className={`card card-compact ${s.attrs.completed ? 'completed opacity-40 line-through' : ''}`} 
                        style={{ 
                          padding: '1.25rem', 
                          borderRadius: '10px', 
                          opacity: s.attrs.completed ? 0.4 : undefined,
                          height: '78px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          overflow: 'hidden'
                        }} 
                        onClick={() => setEditingSchedule(s)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                          {/* Col 1: Complete Check Icon */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '1.5rem', flexShrink: 0 }}>
                            <div
                              onClick={(e) => toggleComplete(e, s)}
                              style={{ color: s.attrs.completed ? 'var(--success)' : 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                            >
                              {s.attrs.completed ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                            </div>
                          </div>

                          {/* Col 2: Title (flex: 1) */}
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', minWidth: 0, paddingLeft: '0.5rem' }}>
                            <span
                              style={{
                                fontSize: '0.82rem',
                                fontWeight: 600,
                                color: s.attrs.completed ? 'var(--text-tertiary)' : 'var(--text-primary)',
                                textDecoration: s.attrs.completed ? 'line-through' : 'none',
                                textAlign: 'left',
                                maxWidth: '120px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: 'inline-block'
                              }}
                              title={s.title}
                            >
                              {s.title}
                            </span>
                          </div>

                          {/* Col 3: Time (fixed width/aligned) */}
                          <div style={{ width: '55px', flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            {s.attrs.time && (
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>{s.attrs.time}</span>
                            )}
                          </div>

                          {/* Col 4: Category badge (aligned right) */}
                          <div style={{ width: '55px', flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            {s.category && (
                              <span className="badge" style={{ fontSize: '0.55rem', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 600, maxWidth: '50px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.category}</span>
                            )}
                          </div>
                        </div>
                        {/* Linked Badges */}
                        {s.attrs.linkedIds && s.attrs.linkedIds.length > 0 && (
                          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.4rem', marginLeft: '2.5rem' }}>
                            {s.attrs.linkedIds.map((linkedId: string) => {
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
                          padding: '0.5rem 0.7rem',
                          ...getMemoCardStyle(m.attrs.color || '', theme === 'dark')
                        }} 
                        onClick={() => { 
                          setMemoForm({ id: m.id, title: m.title, content: m.attrs.content || '', pinned: m.attrs.pinned || false, color: m.attrs.color || '' }); 
                          setIsMemoModalOpen(true); 
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.1rem', width: '100%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', width: '100%' }}>
                            {m.attrs.pinned && <Pin size={11} className="text-accent" style={{ color: 'var(--accent)', transform: 'rotate(45deg)', flexShrink: 0 }} />}
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>{m.title}</span>
                          </div>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{format(parseISO(m.updatedAt || new Date().toISOString()), 'yy.MM.dd')} 업데이트</span>
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
                            padding: '0.5rem 0.65rem', 
                            borderRadius: '10px',
                            height: '42px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            overflow: 'hidden'
                          }} 
                          onClick={() => setEditingInventory(item)}
                        >
                          {/* Col 1: Index */}
                          <span className="text-xs font-mono text-gray-400" style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#9ca3af', width: '1.4rem', flexShrink: 0, textAlign: 'left' }}>
                            #{String(idx + 1).padStart(2, '0')}
                          </span>

                          {/* Col 2: Code badge (fixed width) */}
                          <div style={{ width: '50px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                            {item.attrs.code ? (
                              <span 
                                className="badge" 
                                style={{ 
                                  fontSize: '0.55rem', 
                                  padding: '0.08rem 0.2rem',
                                  maxWidth: '42px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  display: 'inline-block',
                                  textAlign: 'center'
                                }}
                                title={item.attrs.code}
                              >
                                {item.attrs.code}
                              </span>
                            ) : (
                              <span style={{ width: '42px' }} />
                            )}
                          </div>

                          {/* Col 3: Title (flex: 1) */}
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', minWidth: 0, paddingLeft: '0.3rem' }}>
                            <span
                              style={{
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: 'inline-block',
                                maxWidth: '100px'
                              }}
                              title={item.title}
                            >
                              {item.title}
                            </span>
                          </div>

                          {/* Col 4: Flow badge (fixed width/aligned) */}
                          <div style={{ width: '42px', flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <span className="badge" style={{ background: item.attrs.flow === 'OUT' ? 'var(--danger-soft-bg)' : 'var(--success-soft-bg)', color: item.attrs.flow === 'OUT' ? 'var(--danger)' : 'var(--success)', fontSize: '0.55rem', padding: '0.08rem 0.25rem', borderRadius: '4px', fontWeight: 600 }}>
                              {item.attrs.flow === 'OUT' ? '출고' : '입고'}
                            </span>
                          </div>

                          {/* Col 5: Quantity Badge (aligned right) */}
                          <div style={{ width: '38px', flexShrink: 0, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: isNegative ? 'var(--danger)' : 'var(--text-primary)' }}>{qtyNum}개</span>
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
        <section>
          <div className="section-header">
            <div className="section-title">일정 캘린더</div>
            <div className="segment-control">
              <button className={`segment-btn ${calendarMode === 'monthly' ? 'active' : ''}`} onClick={() => setCalendarMode('monthly')}>월간</button>
              <button className={`segment-btn ${calendarMode === 'weekly' ? 'active' : ''}`} onClick={() => setCalendarMode('weekly')}>주간</button>
              <button className={`segment-btn ${calendarMode === 'daily' ? 'active' : ''}`} onClick={() => setCalendarMode('daily')}>일간</button>
            </div>
          </div>
          
          <div className="mini-calendar">
            <div className="cal-nav">
              <button className="btn-ghost" onClick={navigatePrev}><ChevronLeft size={16} /></button>
              <span>{format(viewDate, calendarMode === 'daily' ? 'yyyy. MM. dd' : 'yyyy. MM')}</span>
              <button className="btn-ghost" onClick={navigateNext}><ChevronRight size={16} /></button>
            </div>
            <div className="cal-grid" style={{ gridTemplateColumns: calendarMode === 'daily' ? '1fr' : 'repeat(7, 1fr)' }}>
              {calendarMode !== 'daily' && ['일', '월', '화', '수', '목', '금', '토'].map(d => (
                <div key={d} className="cal-day-name">{d}</div>
              ))}
              {calendarMode === 'daily' && (
                <div className="cal-day-name">{format(viewDate, 'EEEE')}</div>
              )}
              {days.map(day => {
                const dayStr = format(day, 'yyyy-MM-dd');
                const daySchedules = schedules.filter(s => s.attrs.date === dayStr && !s.attrs.completed);
                const scheduleCount = daySchedules.length;
                const dotCount = Math.min(scheduleCount, 3);
                const isSun = day.getDay() === 0;
                const isSat = day.getDay() === 6;
                const isHol = isHoliday(day);

                let dayClass = '';
                if (isSun || isHol) dayClass = 'sunday';
                else if (isSat) dayClass = 'saturday';

                return (
                  <div
                    key={day.toString()}
                    className={`cal-cell ${dayClass} ${isSameDay(day, selectedDate) ? 'active' : ''} ${isToday(day) ? 'today' : ''} ${!isSameMonth(day, viewDate) && calendarMode === 'monthly' ? 'disabled' : ''}`}
                    onClick={() => setSelectedDate(day)}
                    title={scheduleCount > 0 ? `${scheduleCount}건의 일정` : ''}
                  >
                    <span>{format(day, 'd')}</span>
                    {daySchedules.length > 0 && (
                      <div className="cal-dots">
                        {daySchedules.slice(0, 3).map((s) => (
                          <span 
                            key={s.id} 
                            className="cal-dot" 
                            style={{ background: getCategoryColor(s.category) }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="section-header" style={{ marginTop: '1.2rem', marginBottom: '0.6rem' }}>
            <div className="section-title" style={{ fontSize: '1.1rem' }}>{format(selectedDate, 'M월 d일')} 일정 리스트</div>
            
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              {/* ⚙️ 일정 카테고리 기준 정보 설정 모달 버튼 */}
              <button 
                className="btn-ghost" 
                onClick={() => setIsScheduleMasterSettingsOpen(true)}
                title="일정 카테고리 설정"
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
                  color: 'var(--text-secondary)'
                }}
              >
                <Sliders size={12} />
                <span>카테고리 설정</span>
              </button>

              {/* ➕ 일정 등록 버튼! */}
              <button 
                className="btn-ghost" 
                onClick={() => setEditingSchedule({
                  id: '',
                  title: '',
                  type: 'event',
                  category: '일반',
                  attrs: {
                    date: format(selectedDate, 'yyyy-MM-dd'),
                    time: '12:00',
                    memo: '',
                    completed: false,
                    notifyOffset: 10
                  },
                  updatedAt: new Date().toISOString()
                })}
                title="일정 등록"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.2rem',
                  padding: '0.25rem 0.55rem',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 650,
                  border: '1px solid var(--accent-soft-border)',
                  background: 'var(--accent-soft-bg)',
                  color: 'var(--accent)'
                }}
              >
                <Plus size={12} />
                <span>일정 등록</span>
              </button>
            </div>
          </div>

          {/* ⚙️ 일정 카테고리 기준 정보 설정 모달 */}
          <AnimatePresence>
            {isScheduleMasterSettingsOpen && (
              <div className="modal-overlay" onClick={() => setIsScheduleMasterSettingsOpen(false)}>
                <motion.div 
                  initial={{ scale: 0.95, opacity: 0 }} 
                  animate={{ scale: 1, opacity: 1 }} 
                  exit={{ scale: 0.95, opacity: 0 }} 
                  transition={{ duration: 0.15 }} 
                  className="modal-content" 
                  onClick={e => e.stopPropagation()}
                  style={{ maxWidth: '400px' }}
                >
                  <div className="ios-modal-header">
                    <button className="ios-text-btn" onClick={() => setIsScheduleMasterSettingsOpen(false)}>닫기</button>
                    <div className="ios-modal-title">일정 카테고리 설정</div>
                    <div style={{ width: '40px' }} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>
                    <div className="form-group" style={{ textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                        <Tag size={13} style={{ color: 'var(--accent)' }} />
                        <span>일정 카테고리 목록</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <input
                          type="text"
                          placeholder="새 일정 카테고리 입력"
                          className="input-sm"
                          value={newSchedCatInput}
                          onChange={e => setNewSchedCatInput(e.target.value)}
                          style={{ flex: 1, fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                        />
                        <button
                          type="button"
                          onClick={() => addMasterScheduleCategory(newSchedCatInput)}
                          className="ghost-btn"
                          style={{ padding: '0.25rem 0.65rem', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          추가
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.5rem' }}>
                        {(appSettings.scheduleCategories || ['업무', '회의', '개인', '일반']).map(cat => (
                          <span
                            key={cat}
                            className="badge"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.15rem 0.45rem', fontSize: '0.68rem', borderRadius: '6px' }}
                          >
                            {cat}
                            <span
                              onClick={() => deleteMasterScheduleCategory(cat)}
                              style={{ cursor: 'pointer', fontWeight: 800, color: 'var(--danger)', marginLeft: '0.25rem' }}
                            >
                              ×
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Local Schedule Category Horizon Filtering Bar - Show ONLY when custom categories exist! */}
          {showScheduleFilterBar && (
            <div 
              style={{
                display: 'flex',
                gap: '0.35rem',
                overflowX: 'auto',
                paddingBottom: '0.5rem',
                marginBottom: '0.4rem',
                scrollbarWidth: 'none',
                WebkitOverflowScrolling: 'touch'
              }}
            >
              {scheduleCategories.map(cat => {
                const isSelected = selectedScheduleCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedScheduleCategory(cat)}
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      padding: '0.25rem 0.6rem',
                      borderRadius: '8px',
                      // Apple-style translucent Cupertino Tint selection!
                      border: isSelected ? '1px solid var(--accent-soft-border)' : '1px solid var(--panel-border)',
                      background: isSelected ? 'var(--accent-soft-bg)' : 'var(--panel-bg)',
                      color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {cat === '전체' ? '전체' : `# ${cat}`}
                  </button>
                );
              })}
            </div>
          )}

          <div className="card-list" style={{ gap: '1.25rem' }}>
            {displaySchedules.length === 0 ? (
              <div className="empty-box">등록된 일정이 없습니다.</div>
            ) : null}

            {paginatedSchedules.map((s, idx) => (
              <div
                key={s.id}
                className={`card card-compact ${s.attrs.completed ? 'completed opacity-40 line-through' : ''}`}
                style={{ 
                  padding: '1.25rem', 
                  borderRadius: '10px', 
                  opacity: s.attrs.completed ? 0.4 : undefined,
                  height: '78px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  overflow: 'hidden'
                }}
                onClick={() => setEditingSchedule(s)}
              >
                <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  {/* Col 1: Complete Check Icon */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '1.5rem', flexShrink: 0 }}>
                    <div
                      onClick={(e) => toggleComplete(e, s)}
                      style={{ color: s.attrs.completed ? 'var(--success)' : 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      {s.attrs.completed ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                    </div>
                  </div>

                  {/* Col 2: Title (flex: 1) */}
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', minWidth: 0, paddingLeft: '0.5rem' }}>
                    <span
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: s.attrs.completed ? 'var(--text-tertiary)' : 'var(--text-primary)',
                        textDecoration: s.attrs.completed ? 'line-through' : 'none',
                        textAlign: 'left',
                        maxWidth: '120px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: 'inline-block'
                      }}
                      title={s.title}
                    >
                      {s.title}
                    </span>
                  </div>

                  {/* Col 3: Time (fixed width/aligned) */}
                  <div style={{ width: '55px', flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    {s.attrs.time && (
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>{s.attrs.time}</span>
                    )}
                  </div>

                  {/* Col 4: Category badge (aligned right) */}
                  <div style={{ width: '55px', flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    {s.category && (
                      <span className="badge" style={{ fontSize: '0.55rem', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 600, maxWidth: '50px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.category}</span>
                    )}
                  </div>
                </div>
                {/* Linked Badges */}
                {s.attrs.linkedIds && s.attrs.linkedIds.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.4rem', marginLeft: '2.5rem' }}>
                    {s.attrs.linkedIds.map((linkedId: string) => {
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
                <div className="card-hover-actions">
                  <button className="ghost-btn" onClick={(e) => { e.stopPropagation(); setEditingSchedule(s); }}>수정</button>
                  <button className="ghost-btn danger" onClick={(e) => { e.stopPropagation(); handleDeleteSchedule(s.id); }}>삭제</button>
                </div>
              </div>
            ))}

            {scheduleTotalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.8rem', marginTop: '0.5rem' }}>
                <button 
                  onClick={() => setSchedulePage(prev => Math.max(0, prev - 1))}
                  disabled={schedulePage === 0}
                  className="ghost-btn"
                  style={{ opacity: schedulePage === 0 ? 0.3 : 1, padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                >
                  이전
                </button>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {schedulePage + 1} / {scheduleTotalPages}
                </span>
                <button 
                  onClick={() => setSchedulePage(prev => Math.min(scheduleTotalPages - 1, prev + 1))}
                  disabled={schedulePage === scheduleTotalPages - 1}
                  className="ghost-btn"
                  style={{ opacity: schedulePage === scheduleTotalPages - 1 ? 0.3 : 1, padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                >
                  다음
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ==================== 3. [재고] INVENTORY TAB ==================== */}
      {searchQuery === null && activeTab === 'inventory' && (
        <section>
          <div className="section-header" style={{ marginBottom: '0.8rem' }}>
            <div className="section-title">재고 현황</div>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              {/* ⚙️ 기준 정보 관리 모달 버튼 */}
              <button 
                className="btn-ghost" 
                onClick={() => setIsMasterSettingsOpen(true)}
                title="기준 정보 관리"
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
                  color: 'var(--text-secondary)'
                }}
              >
                <Sliders size={12} />
                <span>기준 정보 관리</span>
              </button>

              {/* ➕ 재고 등록 버튼! */}
              <button 
                className="btn-ghost" 
                onClick={() => setEditingInventory({
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
                })}
                title="재고 등록"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.2rem',
                  padding: '0.25rem 0.55rem',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 650,
                  border: '1px solid var(--accent-soft-border)',
                  background: 'var(--accent-soft-bg)',
                  color: 'var(--accent)'
                }}
              >
                <Plus size={12} />
                <span>재고 등록</span>
              </button>
              <Package size={14} style={{ color: 'var(--text-tertiary)' }} />
            </div>
          </div>

          {/* ⚙️ 재고 기준 정보 설정 마스터 데이터 관리 모달 */}
          <AnimatePresence>
            {isMasterSettingsOpen && (
              <div className="modal-overlay" onClick={() => setIsMasterSettingsOpen(false)}>
                <motion.div 
                  initial={{ scale: 0.95, opacity: 0 }} 
                  animate={{ scale: 1, opacity: 1 }} 
                  exit={{ scale: 0.95, opacity: 0 }} 
                  transition={{ duration: 0.15 }} 
                  className="modal-content" 
                  onClick={e => e.stopPropagation()}
                  style={{ maxWidth: '400px' }}
                >
                  <div className="ios-modal-header">
                    <button className="ios-text-btn" onClick={() => setIsMasterSettingsOpen(false)}>닫기</button>
                    <div className="ios-modal-title">기준 정보 설정</div>
                    <div style={{ width: '40px' }} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>
                    {/* 1. 보관 위치 설정 */}
                    <div className="form-group" style={{ textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                        <MapPin size={13} style={{ color: 'var(--accent)' }} />
                        <span>보관 위치 관리</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <input
                          type="text"
                          placeholder="새 보관 위치 입력"
                          className="input-sm"
                          value={newLocInput}
                          onChange={e => setNewLocInput(e.target.value)}
                          style={{ flex: 1, fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                        />
                        <button
                          type="button"
                          onClick={() => addMasterLocation(newLocInput)}
                          className="ghost-btn"
                          style={{ padding: '0.25rem 0.65rem', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          추가
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.5rem' }}>
                        {(appSettings.locations || ['비즈니스 창고', '메인 매장', '이동용 밴', 'A창고', 'B창고']).map(loc => (
                          <span
                            key={loc}
                            className="badge"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.15rem 0.45rem', fontSize: '0.68rem', borderRadius: '6px' }}
                          >
                            {loc}
                            <span
                              onClick={() => deleteMasterLocation(loc)}
                              style={{ cursor: 'pointer', fontWeight: 800, color: 'var(--danger)', marginLeft: '0.25rem' }}
                            >
                              ×
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* 2. 카테고리 설정 */}
                    <div className="form-group" style={{ textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                        <Tag size={13} style={{ color: 'var(--accent)' }} />
                        <span>재고 카테고리 관리</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <input
                          type="text"
                          placeholder="새 카테고리 입력"
                          className="input-sm"
                          value={newCatInput}
                          onChange={e => setNewCatInput(e.target.value)}
                          style={{ flex: 1, fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                        />
                        <button
                          type="button"
                          onClick={() => addMasterCategory(newCatInput)}
                          className="ghost-btn"
                          style={{ padding: '0.25rem 0.65rem', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          추가
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.5rem' }}>
                        {(appSettings.categories || ['재고', 'IT 장비', '촬영 장비', '사무 용품', '기타']).map(cat => (
                          <span
                            key={cat}
                            className="badge"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.15rem 0.45rem', fontSize: '0.68rem', borderRadius: '6px' }}
                          >
                            {cat}
                            <span
                              onClick={() => deleteMasterCategory(cat)}
                              style={{ cursor: 'pointer', fontWeight: 800, color: 'var(--danger)', marginLeft: '0.25rem' }}
                            >
                              ×
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* 3. 담당 관리자 설정 */}
                    <div className="form-group" style={{ textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                        <User size={13} style={{ color: 'var(--accent)' }} />
                        <span>담당 관리자 관리</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <input
                          type="text"
                          placeholder="새 담당 관리자 입력"
                          className="input-sm"
                          value={newMgrInput}
                          onChange={e => setNewMgrInput(e.target.value)}
                          style={{ flex: 1, fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                        />
                        <button
                          type="button"
                          onClick={() => addMasterManager(newMgrInput)}
                          className="ghost-btn"
                          style={{ padding: '0.25rem 0.65rem', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          추가
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.5rem' }}>
                        {(appSettings.managers || ['윤상영', '김철수', '이영희', '박민수']).map(mgr => (
                          <span
                            key={mgr}
                            className="badge"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.15rem 0.45rem', fontSize: '0.68rem', borderRadius: '6px' }}
                          >
                            {mgr}
                            <span
                              onClick={() => deleteMasterManager(mgr)}
                              style={{ cursor: 'pointer', fontWeight: 800, color: 'var(--danger)', marginLeft: '0.25rem' }}
                            >
                              ×
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Local Inventory Category Horizon Filtering Bar - Show ONLY when custom categories exist! */}
          {showInventoryFilterBar && (
            <div 
              style={{
                display: 'flex',
                gap: '0.35rem',
                overflowX: 'auto',
                paddingBottom: '0.5rem',
                marginBottom: '0.5rem',
                scrollbarWidth: 'none',
                WebkitOverflowScrolling: 'touch'
              }}
            >
              {inventoryCategories.map(cat => {
                const isSelected = selectedInventoryCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedInventoryCategory(cat)}
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      padding: '0.25rem 0.6rem',
                      borderRadius: '8px',
                      // Apple-style translucent Cupertino Tint selection!
                      border: isSelected ? '1px solid var(--accent-soft-border)' : '1px solid var(--panel-border)',
                      background: isSelected ? 'var(--accent-soft-bg)' : 'var(--panel-bg)',
                      color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {cat === '전체' ? '전체' : `# ${cat}`}
                  </button>
                );
              })}
            </div>
          )}

          {displayInventories.length === 0 ? (
            <div className="empty-box">등록된 재고가 존재하지 않습니다.</div>
          ) : (
            <div className="card-list" style={{ gap: '1.25rem' }}>
              {paginatedInventories.map((item, idx) => {
                const qtyNum = Number(item.attrs.qty) || 0;
                const isNegative = qtyNum < 0;
                return (
                <div
                  key={item.id}
                  className="card card-compact"
                  style={{
                    padding: '1.25rem',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    height: '115px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    overflow: 'hidden'
                  }}
                  onClick={() => setEditingInventory ? setEditingInventory(item) : null}
                >
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    {/* Col 1: Index + Package Icon */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '3.1rem', flexShrink: 0 }}>
                      <span className="text-xs font-mono text-gray-400" style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#9ca3af' }}>
                        #{String(inventoryPage * inventoryPerPage + idx + 1).padStart(2, '0')}
                      </span>
                      <div style={{ color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}>
                        <Package size={13} />
                      </div>
                    </div>

                    {/* Col 2: Code badge (fixed width) */}
                    <div style={{ width: '70px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                      {item.attrs.code ? (
                        <span 
                          className="badge" 
                          style={{ 
                            background: 'var(--panel-border)', 
                            color: 'var(--text-secondary)', 
                            fontSize: '0.65rem', 
                            fontWeight: 700,
                            maxWidth: '60px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'inline-block',
                            textAlign: 'center'
                          }}
                          title={item.attrs.code}
                        >
                          {item.attrs.code}
                        </span>
                      ) : (
                        <span style={{ width: '60px' }} />
                      )}
                    </div>

                    {/* Col 3: Item Title (flex: 1) */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', minWidth: 0, paddingLeft: '0.5rem' }}>
                      <span
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          textAlign: 'left',
                          maxWidth: '120px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: 'inline-block'
                        }}
                        title={item.title}
                      >
                        {item.title}
                      </span>
                    </div>

                    {/* Col 4: Flow badge (fixed width/aligned) */}
                    <div style={{ width: '55px', flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      <span className="badge" style={{ background: item.attrs.flow === 'OUT' ? 'var(--danger-soft-bg)' : 'var(--success-soft-bg)', color: item.attrs.flow === 'OUT' ? 'var(--danger)' : 'var(--success)', border: `1px solid ${item.attrs.flow === 'OUT' ? 'var(--danger-soft-border)' : 'var(--success-soft-border)'}`, fontSize: '0.6rem', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 600 }}>
                        {item.attrs.flow === 'OUT' ? '출고' : '입고'}
                      </span>
                    </div>
                    
                    {/* Col 5: Quantity indicator (aligned right) */}
                    <div 
                      className="inv-qty" 
                      style={{ 
                        color: isNegative ? 'var(--danger)' : 'var(--accent)',
                        background: isNegative ? 'var(--danger-soft-bg)' : 'var(--accent-soft-bg)',
                        border: `1px solid ${isNegative ? 'var(--danger-soft-border)' : 'var(--accent-soft-border)'}`,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.45rem',
                        borderRadius: '5px',
                        whiteSpace: 'nowrap',
                        marginLeft: '0.5rem',
                        flexShrink: 0,
                        width: '45px',
                        textAlign: 'center'
                      }}
                    >
                      {qtyNum > 0 ? `+${qtyNum}` : `${qtyNum}`}개
                    </div>
                  </div>

                  {/* Spacious Metadata Row & Linked Badges nicely offset to align with Title */}
                  <div style={{ paddingLeft: '3.1rem', marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <div className="inv-detail" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-tertiary)', fontSize: '0.72rem', flexWrap: 'wrap', textAlign: 'left' }}>
                      {item.attrs.serial && (
                        <>
                          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>S/N: {item.attrs.serial}</span>
                          <span style={{ opacity: 0.3 }}>•</span>
                        </>
                      )}
                      {item.attrs.loc && (
                        <>
                          <span>{item.attrs.loc}</span>
                          <span style={{ opacity: 0.3 }}>•</span>
                        </>
                      )}
                      {item.attrs.mgr && (
                        <>
                          <span>{item.attrs.mgr}</span>
                          <span style={{ opacity: 0.3 }}>•</span>
                        </>
                      )}
                      {item.updatedAt && (
                        <>
                          <span>{format(parseISO(item.updatedAt), 'MM.dd HH:mm')}</span>
                        </>
                      )}
                      {item.category && item.category !== '재고' && item.category !== 'assets' && (
                        <>
                          <span style={{ opacity: 0.3 }}>•</span>
                          <span className="badge" style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem' }}>{item.category}</span>
                        </>
                      )}
                    </div>

                    {/* Linked Badges */}
                    {item.attrs.linkedIds && item.attrs.linkedIds.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.1rem' }}>
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

                  <div className="card-hover-actions">
                    <button className="ghost-btn" onClick={(e) => { e.stopPropagation(); setEditingInventory(item); }}>수정</button>
                    <button className="ghost-btn danger" onClick={(e) => { e.stopPropagation(); deleteInventoryItem(item.id); }}>삭제</button>
                  </div>
                </div>
                );
              })}

              {inventoryTotalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.8rem', marginTop: '0.5rem' }}>
                  <button 
                    onClick={() => setInventoryPage(prev => Math.max(0, prev - 1))}
                    disabled={inventoryPage === 0}
                    className="ghost-btn"
                    style={{ opacity: inventoryPage === 0 ? 0.3 : 1, padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                  >
                    이전
                  </button>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {inventoryPage + 1} / {inventoryTotalPages}
                  </span>
                  <button 
                    onClick={() => setInventoryPage(prev => Math.min(inventoryTotalPages - 1, prev + 1))}
                    disabled={inventoryPage === inventoryTotalPages - 1}
                    className="ghost-btn"
                    style={{ opacity: inventoryPage === inventoryTotalPages - 1 ? 0.3 : 1, padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                  >
                    다음
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ==================== 4. [메모] MEMO TAB ==================== */}
      {searchQuery === null && activeTab === ('memo' as any) && (
        <section>
          <div className="section-header">
            <div className="section-title">메모</div>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <button 
                className="btn-ghost" 
                onClick={() => {
                  setMemoForm({ title: '', content: '', pinned: false, color: '' });
                  setIsMemoModalOpen(true);
                }}
                title="메모 추가"
              >
                <Plus size={16} />
              </button>
              <FileText size={16} style={{ color: 'var(--text-tertiary)' }} />
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
                  ...getMemoCardStyle(m.attrs.color || '', theme === 'dark')
                }}
                onClick={() => {
                  setMemoForm({ id: m.id, title: m.title, content: m.attrs.content || '', pinned: m.attrs.pinned || false, color: m.attrs.color || '' });
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
                  </div>
                </div>

                {m.attrs.content && (
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      paddingLeft: '3.1rem',
                      textAlign: 'left',
                      lineHeight: '1.4'
                    }}
                  >
                    <Markdown content={m.attrs.content} compact />
                  </div>
                )}

                <div className="card-hover-actions">
                  <button className="ghost-btn" onClick={(e) => { e.stopPropagation(); setMemoForm({ id: m.id, title: m.title, content: m.attrs.content || '', pinned: m.attrs.pinned || false, color: m.attrs.color || '' }); setIsMemoModalOpen(true); }}>수정</button>
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
      )}

      {/* Schedule Edit Modal (Serves both Add & Edit!) */}
      <AnimatePresence>
        {editingSchedule && (
          <div className="modal-overlay" onClick={() => { setEditingSchedule(null); setCustomScheduleCategory(''); }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} transition={{ duration: 0.15 }} className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="ios-modal-header">
                <button className="ios-text-btn" onClick={() => { setEditingSchedule(null); setCustomScheduleCategory(''); }}>취소</button>
                <div className="ios-modal-title">일정 등록</div>
                <button className="ios-text-btn bold" onClick={saveSchedule}>저장</button>
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
                          border: isSelected ? '1px solid var(--accent-soft-border)' : '1px solid var(--panel-border)',
                          background: isSelected ? 'var(--accent-soft-bg)' : 'var(--surface-color)',
                          color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
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
              
              <div style={{ display: 'flex', gap: '0.8rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <span className="form-label">날짜<span className="req-star">*</span></span>
                  <CustomDatePicker value={editingSchedule.attrs.date || ''} onChange={date => setEditingSchedule({...editingSchedule, attrs: { ...editingSchedule.attrs, date }})} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <span className="form-label">시간</span>
                  <CustomTimePicker value={editingSchedule.attrs.time || '12:00'} onChange={time => setEditingSchedule({...editingSchedule, attrs: { ...editingSchedule.attrs, time }})} />
                </div>
              </div>
              
              <div className="form-group">
                <span className="form-label">메모</span>
                <textarea rows={2} className="input-sm" value={editingSchedule.attrs.memo || ''} onChange={e => setEditingSchedule({...editingSchedule, attrs: { ...editingSchedule.attrs, memo: e.target.value }})} />
              </div>
              
              <div style={{ display: 'flex', gap: '0.8rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <span className="form-label">알림 설정</span>
                  <CustomSelect
                    value={editingSchedule.attrs.notifyOffset ?? 10}
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
        )}
      </AnimatePresence>

      {/* Inventory Item Edit Modal (Serves both Add & Edit!) */}
      <AnimatePresence>
        {editingInventory && (
          <div className="modal-overlay" onClick={() => { setEditingInventory(null); setCustomInventoryCategory(''); }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} transition={{ duration: 0.15 }} className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="ios-modal-header">
                <button className="ios-text-btn" onClick={() => { setEditingInventory(null); setCustomInventoryCategory(''); }}>취소</button>
                <div className="ios-modal-title">재고 등록</div>
                <button className="ios-text-btn bold" onClick={saveInventory}>저장</button>
              </div>

              {/* 품목코드 및 품목명 각각 독립된 세로 form-group 으로 배치하여 100% 화면에 핏(Fit)되도록 교정! */}
              <div className="form-group">
                <span className="form-label">품목코드</span>
                <input 
                  type="text" 
                  className="input-sm" 
                  value={editingInventory.attrs.code || ''} 
                  onChange={e => setEditingInventory({...editingInventory, attrs: { ...editingInventory.attrs, code: e.target.value }})} 
                  placeholder="예: CODE-01"
                />
              </div>

              <div className="form-group">
                <span className="form-label">품목명<span className="req-star">*</span></span>
                <input 
                  type="text" 
                  className="input-sm" 
                  placeholder=""
                  value={editingInventory.title} 
                  onChange={e => setEditingInventory({...editingInventory, title: e.target.value})} 
                />
              </div>

              {/* Category Dropdown (Master Data Only) */}
              <div className="form-group">
                <span className="form-label">카테고리</span>
                <CustomSelect
                  value={editingInventory.category || ''}
                  options={[
                    { value: '', label: '카테고리 선택' },
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
                <span className="form-label">특이사항</span>
                <textarea
                  rows={3}
                  className="input-sm"
                  placeholder=""
                  style={{ resize: 'vertical', lineHeight: 1.5, fontSize: '0.85rem' }}
                  value={editingInventory.attrs.memo || ''}
                  onChange={e => setEditingInventory({ ...editingInventory, attrs: { ...editingInventory.attrs, memo: e.target.value } })}
                />
              </div>

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
        )}
      </AnimatePresence>

      {/* Memo (Key Updates) Edit Modal */}
      <AnimatePresence>
        {isMemoModalOpen && (
          <div className="modal-overlay" onClick={() => setIsMemoModalOpen(false)}>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }} 
              transition={{ duration: 0.15 }} 
              className="modal-content memo-modal-content"
              style={{
                ...getMemoCardStyle(memoForm.color || '', theme === 'dark'),
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
                  onClick={() => setIsMemoModalOpen(false)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '0.82rem', cursor: 'pointer' }}
                >
                  취소
                </button>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>메모</div>
                <button 
                  className="memo-text-btn save-btn" 
                  onClick={submitMemo}
                  style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  저장
                </button>
              </div>

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

                <textarea
                  placeholder="내용을 마크다운으로 입력하세요…"
                  className="memo-content-textarea"
                  rows={10}
                  value={memoForm.content}
                  onChange={e => setMemoForm({...memoForm, content: e.target.value})}
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
                    padding: '0.4rem 0'
                  }}
                />
              </div>

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
        )}
      </AnimatePresence>


    </div>
  );
}
