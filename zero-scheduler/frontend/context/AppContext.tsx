"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { format, parseISO, differenceInSeconds } from 'date-fns';
import {
  UniversalRecord, getRecords, saveRecords, addRecord, updateRecord, deleteRecord,
  ActivityLog, ActivityType, AppSettings, loadSettings, persistSettings,
  loadActivities, persistActivities, DEFAULT_SETTINGS,
  ArchivedRecord, getArchive, restoreFromArchive, permanentDeleteArchived, purgeArchive
} from '@/database';

interface AppContextProps {
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  records: UniversalRecord[];
  setRecords: (r: UniversalRecord[]) => void;
  toast: string | null;
  setToast: (t: string | null) => void;
  activities: ActivityLog[];
  setActivities: React.Dispatch<React.SetStateAction<ActivityLog[]>>;
  appSettings: AppSettings;
  setAppSettings: (s: AppSettings) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (o: boolean) => void;
  viewDate: Date;
  setViewDate: (d: Date) => void;
  selectedDate: Date;
  setSelectedDate: (d: Date) => void;
  calendarMode: 'monthly' | 'weekly' | 'daily';
  setCalendarMode: (m: 'monthly' | 'weekly' | 'daily') => void;
  isActivityDrawerOpen: boolean;
  setIsActivityDrawerOpen: (o: boolean) => void;
  nlpInput: string;
  setNlpInput: (v: string) => void;
  loading: boolean;
  setLoading: (l: boolean) => void;
  editingSchedule: UniversalRecord | null;
  setEditingSchedule: (s: UniversalRecord | null) => void;
  editingInventory: UniversalRecord | null;
  setEditingInventory: (s: UniversalRecord | null) => void;
  handleUpdateInventory: (id: string, payload: Partial<UniversalRecord>) => void;
  isMemoModalOpen: boolean;
  setIsMemoModalOpen: (o: boolean) => void;
  memoPage: number;
  setMemoPage: (p: number) => void;
  memoForm: { id?: string; title: string; content: string };
  setMemoForm: (f: { id?: string; title: string; content: string }) => void;
  activeTab: 'all' | 'calendar' | 'inventory' | 'category' | 'settings';
  setActiveTab: (t: 'all' | 'calendar' | 'inventory' | 'category' | 'settings') => void;
  activeCategory: string | null;
  setActiveCategory: (c: string | null) => void;
  
  reloadRecords: () => void;
  toggleTheme: () => void;
  logActivity: (type: ActivityType, title: string, snippet: string) => void;
  archive: ArchivedRecord[];
  reloadArchive: () => void;
  restoreArchived: (id: string) => void;
  permanentDelete: (id: string) => void;
  emptyArchive: () => void;
  clearActivities: () => void;
  // NLQ (자연어 검색) 상태 — R 액션 시 활성화, esc로 해제
  searchQuery: string | null;
  searchType: string | null;
  setSearchResult: (query: string | null, type?: string | null) => void;
  showCompleted: boolean;
  setShowCompleted: (b: boolean) => void;
  handleSettingsChange: (s: AppSettings) => void;
  showToast: (msg: string) => void;
  handleNlpSubmit: (e: React.KeyboardEvent<HTMLInputElement>) => Promise<void>;
  handleUpdateSchedule: (id: string, updatedFields: Partial<UniversalRecord>) => void;
  toggleComplete: (e: React.MouseEvent, s: UniversalRecord) => void;
  handleDeleteSchedule: (id: string) => void;
  submitMemo: () => void;
  deleteMemo: (id: string) => void;
  deleteInventoryItem: (id: string) => void;
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [records, setRecords] = useState<UniversalRecord[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const [calendarMode, setCalendarMode] = useState<'monthly' | 'weekly' | 'daily'>('monthly');
  const [isActivityDrawerOpen, setIsActivityDrawerOpen] = useState(false);

  const [nlpInput, setNlpInput] = useState('');
  const [loading, setLoading] = useState(false);

  const [editingSchedule, setEditingSchedule] = useState<UniversalRecord | null>(null);
  const [editingInventory, setEditingInventory] = useState<UniversalRecord | null>(null);
  const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);
  const [memoPage, setMemoPage] = useState(0);
  const [memoForm, setMemoForm] = useState<{id?: string; title: string; content: string}>({ title: '', content: '' });
  const [notified, setNotified] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'all' | 'calendar' | 'inventory' | 'category' | 'settings'>('all');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const applyAccentColor = (color: string) => {
    document.documentElement.style.setProperty('--accent', color);
    document.documentElement.style.setProperty('--accent-glow', color + '40');
  };

  // Init
  useEffect(() => {
    const savedTheme = localStorage.getItem('zero_theme') as 'light' | 'dark' | null;
    const initTheme = savedTheme || 'light';
    setTheme(initTheme);
    document.documentElement.setAttribute('data-theme', initTheme);
    
    const s = loadSettings();
    setAppSettings(s);
    setCalendarMode(s.calendarView);
    applyAccentColor(s.accentColor);
    document.documentElement.setAttribute('data-density', s.density);
    setActivities(loadActivities());
    
    reloadRecords();
  }, []);

  const reloadRecords = () => {
    setRecords(getRecords());
  };

  const [archive, setArchive] = useState<ArchivedRecord[]>([]);
  const reloadArchive = () => setArchive(getArchive());
  useEffect(() => { reloadArchive(); }, []);

  const restoreArchived = (id: string) => {
    restoreFromArchive(id);
    reloadRecords();
    reloadArchive();
    showToast('항목을 복구했습니다');
  };
  const permanentDelete = (id: string) => {
    permanentDeleteArchived(id);
    reloadArchive();
    showToast('영구 삭제 완료');
  };
  const emptyArchive = () => {
    if (!confirm('휴지통의 모든 항목을 영구 삭제하시겠습니까?')) return;
    purgeArchive();
    reloadArchive();
    showToast('휴지통을 비웠습니다');
  };
  const clearActivities = () => {
    if (!confirm('모든 활동 로그를 삭제하시겠습니까?')) return;
    setActivities([]);
    persistActivities([]);
    showToast('활동 로그를 초기화했습니다');
  };

  // NLQ 검색 임시 뷰 상태
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  const [searchType, setSearchType] = useState<string | null>(null);
  const setSearchResult = (query: string | null, type: string | null = null) => {
    setSearchQuery(query);
    setSearchType(type);
  };

  // 완료된 항목 표시 토글 (캘린더 일정 등)
  const [showCompleted, setShowCompleted] = useState<boolean>(false);

  // Esc 키로 검색 뷰 해제
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && searchQuery !== null) {
        setSearchQuery(null);
        setSearchType(null);
      }
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [searchQuery]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('zero_theme', newTheme);
  };

  const logActivity = (type: ActivityType, title: string, snippet: string) => {
    const newAct: ActivityLog = { id: Date.now().toString(), type, title, snippet, timestamp: Date.now() };
    setActivities(prev => {
      const updated = [newAct, ...prev].slice(0, 50);
      persistActivities(updated);
      return updated;
    });
  };

  const handleSettingsChange = (s: AppSettings) => {
    setAppSettings(s);
    applyAccentColor(s.accentColor);
    document.documentElement.setAttribute('data-density', s.density);
    persistSettings(s);
  };

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  // Notifications
  useEffect(() => {
    const schedules = records.filter(r => r.type === 'event');
    const checkNotifications = () => {
      const now = new Date();
      const newNotified = new Set(notified);
      let hasNew = false;
      
      schedules.forEach(s => {
        if (!s.attrs.completed && s.attrs.time) {
          const scheduleTime = parseISO(`${s.attrs.date}T${s.attrs.time}`);
          const triggerTime = new Date(scheduleTime.getTime() - (s.attrs.notifyOffset ?? 10) * 60000);
          const diffSeconds = differenceInSeconds(now, triggerTime);
          if ((s.attrs.notifyOffset ?? 10) >= 0 && diffSeconds >= 0 && diffSeconds <= 300 && !notified.has(s.id)) {
            fetch('/api/notify', { method: 'POST', body: JSON.stringify({ title: '일정 알림', body: `${s.title} (${s.attrs.time})` }) });
            newNotified.add(s.id);
            hasNew = true;
          }
        }
      });
      if (hasNew) setNotified(newNotified);
    };

    checkNotifications(); 
    const interval = setInterval(() => checkNotifications(), 10000); 
    return () => clearInterval(interval);
  }, [records, notified]);

  const handleNlpSubmit = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && nlpInput.trim() && !loading) {
      setLoading(true);
      try {
        const parseRes = await fetch('/api/parse', { method: 'POST', body: JSON.stringify({ text: nlpInput, apiKey: appSettings.apiKey || undefined }) });
        const cleanErrorMessage = (rawErr: string) => {
          if (!rawErr) return 'E-900';
          const msg = String(rawErr).toLowerCase();
          if (msg.includes('api_key') || msg.includes('invalid') || msg.includes('key') || msg.includes('400')) {
            return 'E-100';
          }
          if (msg.includes('quota') || msg.includes('limit') || msg.includes('429')) {
            return 'E-200';
          }
          if (msg.includes('network') || msg.includes('fetch') || msg.includes('connect')) {
            return 'E-300';
          }
          return 'E-900';
        };

        const parsed = await parseRes.json();
        if (parsed.error) { 
          showToast(`⚠️ API 연결 실패: ${cleanErrorMessage(parsed.error)}`); 
          setLoading(false); 
          return; 
        }

        // API Key diagnostic feedback
        const isGemini = parsed._parser === 'gemini';
        if (!isGemini && parsed._error && parsed._error !== 'API Key가 설정되어 있지 않습니다.') {
          // Display the cleaned error E-code!
          showToast(`⚠️ AI 연동 실패: ${cleanErrorMessage(parsed._error)} (로컬 처리됨)`);
        } else if (isGemini) {
          showToast('✨ AI 분석 완료');
        } else {
          showToast('로컬 분석 및 등록 완료');
        }
        
        const action = parsed.a || 'C';
        const type = parsed.t || 'event';
        const category = parsed.c || '일반';
        const val = parsed.v || '';
        const attr = parsed.attr || {};
        const kw = parsed.k || '';
        const rec: 'none' | 'daily' | 'weekly' | 'monthly' = parsed.rec || 'none';
        const linkKeywords: string[] = Array.isArray(parsed.link) ? parsed.link : [];

        // 엔티티 링크 — 기존 records에서 link 키워드와 매칭되는 ID 수집
        const linkedIds: string[] = [];
        if (linkKeywords.length > 0) {
          linkKeywords.forEach(kw2 => {
            if (!kw2) return;
            const lowered = String(kw2).toLowerCase();
            records.forEach(r => {
              const hay = `${r.title} ${r.category} ${r.attrs?.content || ''} ${r.attrs?.code || ''} ${r.attrs?.memo || ''}`.toLowerCase();
              if (hay.includes(lowered) && !linkedIds.includes(r.id)) {
                linkedIds.push(r.id);
              }
            });
          });
        }

        // 자연어 질의 (READ) — DB 변경 없이 검색 뷰만 활성화
        if (action === 'R') {
          setSearchResult(kw || val || '', type || null);
          showToast(`'${kw || val || type || '전체'}' 검색 결과를 표시합니다 (Esc로 닫기)`);
          setNlpInput('');
          setLoading(false);
          return;
        }

        // 새 레코드에 recurrence / linkedIds 주입
        const enrichedAttrs = {
          ...attr,
          ...(rec !== 'none' && type === 'event' ? { recurrence: rec } : {}),
          ...(linkedIds.length > 0 ? { linkedIds } : {})
        };

        if (action === 'C') {
          const result = addRecord({ title: val, type, category, attrs: enrichedAttrs });
          reloadRecords();
          
          if (type === 'event') {
            logActivity('ADD_SCHED', '일정 등록', val);
          } else if (type === 'memo') {
            logActivity('ADD_MEMO', '변동 사항 등록', val);
          } else if (type === 'asset') {
            const opLabel = attr.flow === 'OUT' ? '출고' : '입고';
            const netQty = Number(result.attrs.qty) || 0;
            const lowStockNote = netQty < 0 ? ' ⚠️ 재고 부족' : '';
            logActivity('ADD_INV', `재고 ${opLabel}`, `${result.title} ${attr.qty}개${lowStockNote}`);
          }
        } 
        else if (action === 'U') {
          const target = records.find(r => r.type === type && (kw && r.title.includes(kw)));
          if (target) {
            updateRecord(target.id, { title: val || target.title, category, attrs: enrichedAttrs });
            reloadRecords();
            
            if (type === 'event') {
              logActivity('UPDATE_SCHED', '일정 수정', val || target.title);
            } else if (type === 'memo') {
              logActivity('UPDATE_MEMO', '변동 사항 수정', val || target.title);
            } else if (type === 'asset') {
              logActivity('UPDATE_INV', '재고 수정', val || target.title);
            }
          } else {
            showToast('수정 대상을 찾을 수 없습니다.');
          }
        } 
        else if (action === 'D') {
          const target = records.find(r => r.type === type && (kw && r.title.includes(kw)));
          if (target) {
            deleteRecord(target.id);
            reloadRecords();
            
            if (type === 'event') {
              logActivity('DEL_SCHED', '일정 삭제', target.title);
            } else if (type === 'memo') {
              logActivity('DEL_MEMO', '변동 사항 삭제', target.title);
            } else if (type === 'asset') {
              logActivity('DEL_INV', '재고 삭제', target.title);
            }
          } else {
            showToast('삭제 대상을 찾을 수 없습니다.');
          }
        }
        
        setNlpInput('');
      } catch (err) { showToast('오류 발생'); }
      setLoading(false);
    }
  };

  const handleUpdateSchedule = (id: string, updatedFields: Partial<UniversalRecord>) => {
    if (id.includes('__v_')) {
      // Materialize virtual schedule into a concrete one
      const cleanAttrs = { ...updatedFields.attrs } as any;
      delete cleanAttrs._virtual;
      delete cleanAttrs._sourceId;
      addRecord({
        title: updatedFields.title || '',
        type: 'event',
        category: updatedFields.category || '일반',
        attrs: cleanAttrs
      });
    } else {
      updateRecord(id, updatedFields);
    }
    reloadRecords();
    showToast('저장 완료');
    if (editingSchedule && editingSchedule.id === id) setEditingSchedule(null);
    logActivity('UPDATE_SCHED', '일정 수정', updatedFields.title || '상세 내용 변경');
  };

  const handleUpdateInventory = (id: string, updatedFields: Partial<UniversalRecord>) => {
    updateRecord(id, updatedFields);
    reloadRecords();
    showToast('저장 완료');
    if (editingInventory && editingInventory.id === id) setEditingInventory(null);
    logActivity('UPDATE_INV', '재고 수정', updatedFields.title || '상세 내용 변경');
  };

  const toggleComplete = (e: React.MouseEvent, s: UniversalRecord) => {
    e.stopPropagation();
    const updatedStatus = !s.attrs.completed;
    if (s.id.includes('__v_') || s.attrs._virtual) {
      // Materialize this virtual instance
      const cleanAttrs = { ...s.attrs, completed: updatedStatus } as any;
      delete cleanAttrs._virtual;
      delete cleanAttrs._sourceId;
      addRecord({
        title: s.title,
        type: 'event',
        category: s.category,
        attrs: cleanAttrs
      });
    } else {
      updateRecord(s.id, { attrs: { ...s.attrs, completed: updatedStatus } });
    }
    reloadRecords();
    logActivity(updatedStatus ? 'DONE_SCHED' : 'UPDATE_SCHED', updatedStatus ? '일정 완료' : '일정 재개', s.title);
  };

  const handleDeleteSchedule = (id: string) => {
    if (id.includes('__v_')) {
      // Delete the source schedule of this virtual schedule
      const sourceId = id.split('__v_')[0];
      const target = records.find(r => r.id === sourceId);
      if (target) {
        deleteRecord(sourceId);
        logActivity('DEL_SCHED', '일정 삭제', target.title || '항목이 제거되었습니다');
      }
    } else {
      const target = records.find(r => r.id === id);
      deleteRecord(id);
      logActivity('DEL_SCHED', '일정 삭제', target?.title || '항목이 제거되었습니다');
    }
    reloadRecords();
    reloadArchive();
    showToast('일정 삭제 (휴지통으로 이동)');
    if (editingSchedule) setEditingSchedule(null);
  };

  const submitMemo = () => {
    if (!memoForm.title || !memoForm.content) return;
    if (memoForm.id) {
      updateRecord(memoForm.id, { title: memoForm.title, attrs: { content: memoForm.content } });
      logActivity('UPDATE_MEMO', '변동 사항 수정', memoForm.title);
    } else {
      addRecord({ 
        title: memoForm.title, 
        type: 'memo',
        category: '메모',
        attrs: { 
          content: memoForm.content, 
          effectiveDate: new Date().toISOString().split('T')[0] 
        } 
      });
      logActivity('ADD_MEMO', '변동 사항 등록', memoForm.title);
    }
    setMemoForm({ title: '', content: '' });
    setIsMemoModalOpen(false);
    reloadRecords();
    showToast('저장 완료');
  };

  const deleteMemo = (id: string) => {
    deleteRecord(id);
    setMemoForm({ title: '', content: '' });
    setIsMemoModalOpen(false);
    reloadRecords();
    reloadArchive();
    showToast('항목 삭제 (휴지통으로 이동)');
    logActivity('DEL_MEMO', '변동 사항 삭제', '해당 항목이 제거되었습니다.');
  };

  const deleteInventoryItem = (id: string) => {
    const target = records.find(r => r.id === id);
    deleteRecord(id);
    reloadRecords();
    reloadArchive();
    showToast('재고 삭제 (휴지통으로 이동)');
    if (target) logActivity('DEL_INV', '재고 삭제', target.title);
  };

  return (
    <AppContext.Provider value={{
      theme, setTheme, records, setRecords, toast, setToast, activities, setActivities, appSettings, setAppSettings,
      isSettingsOpen, setIsSettingsOpen, viewDate, setViewDate, selectedDate, setSelectedDate, calendarMode, setCalendarMode,
      isActivityDrawerOpen, setIsActivityDrawerOpen, nlpInput, setNlpInput, loading, setLoading, 
      editingSchedule, setEditingSchedule, editingInventory, setEditingInventory, handleUpdateInventory,
      isMemoModalOpen, setIsMemoModalOpen, memoPage, setMemoPage, memoForm, setMemoForm,
      activeTab, setActiveTab, activeCategory, setActiveCategory,
      reloadRecords, toggleTheme, logActivity, handleSettingsChange, showToast, handleNlpSubmit, handleUpdateSchedule,
      toggleComplete, handleDeleteSchedule, submitMemo, deleteMemo, deleteInventoryItem,
      archive, reloadArchive, restoreArchived, permanentDelete, emptyArchive, clearActivities,
      searchQuery, searchType, setSearchResult,
      showCompleted, setShowCompleted
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within an AppProvider");
  return context;
}
