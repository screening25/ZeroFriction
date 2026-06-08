"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { parseISO, differenceInSeconds } from 'date-fns';
import {
  UniversalRecord, getRecords, addRecord, updateRecord, deleteRecord,
  ActivityLog, ActivityType, AppSettings, loadSettings, persistSettings,
  loadActivities, persistActivities, DEFAULT_SETTINGS,
  ArchivedRecord, getArchive, restoreFromArchive, permanentDeleteArchived, purgeArchive,
  initData
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
  memoForm: { id?: string; title: string; content: string; pinned?: boolean; color?: string };
  setMemoForm: (f: { id?: string; title: string; content: string; pinned?: boolean; color?: string }) => void;
  activeTab: 'all' | 'calendar' | 'inventory' | 'category' | 'settings';
  setActiveTab: (t: 'all' | 'calendar' | 'inventory' | 'category' | 'settings') => void;
  activeCategory: string | null;
  setActiveCategory: (c: string | null) => void;
  
  reloadRecords: () => void;
  manualSync: () => Promise<void>;
  syncing: boolean;
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
  executeNlpCommand: (text: string) => Promise<void>;
  handleUpdateSchedule: (id: string, updatedFields: Partial<UniversalRecord>) => void;
  toggleComplete: (e: React.MouseEvent, s: UniversalRecord) => void;
  toggleDone: (e: React.MouseEvent, r: UniversalRecord) => void;
  handleDeleteSchedule: (id: string) => void;
  submitMemo: () => void;
  updateMemoContentDirectly: (id: string, newContent: string) => void;
  deleteMemo: (id: string) => void;
  deleteInventoryItem: (id: string) => void;
  handleDuplicateSchedule: (id: string) => void;
  handleDuplicateInventory: (id: string) => void;
  handleDuplicateMemo: (id: string) => void;
  exportToCsv: (type: 'event' | 'asset' | 'memo', specificRecordId?: string) => void;
  printToPdf: (type: 'event' | 'asset' | 'memo', specificRecordId?: string) => void;
  activeNotification: {
    id: string;
    title: string;
    body: string;
    time: string;
    date: string;
  } | null;
  setActiveNotification: (n: { id: string; title: string; body: string; time: string; date: string } | null) => void;
  handleDismissNotification: () => void;
  handleSnoozeNotification: (scheduleId: string) => void;
  handleCompleteNotificationSchedule: (scheduleId: string) => void;
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

function renderMarkdownToHtml(md: string): string {
  if (!md) return '';
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  let html = '';
  let inList = false;
  let isOrdered = false;
  let inCode = false;
  let codeContent = '';
  let codeLang = '';

  const flushList = () => {
    if (inList) {
      html += isOrdered ? '</ol>\n' : '</ul>\n';
      inList = false;
    }
  };

  const parseInline = (text: string): string => {
    let escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    escaped = escaped.replace(/_([^_]+)_/g, '<em>$1</em>');
    escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
    escaped = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    escaped = escaped.replace(/#([a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣_]+)/g, '<span class="hashtag">#$1</span>');
    escaped = escaped.replace(/@([a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣_]+)/g, '<span class="mention">@$1</span>');
    return escaped;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      flushList();
      if (inCode) {
        html += `<pre class="code-block">${codeLang ? `<div class="code-lang" style="font-size: 11px; color: #868e96; margin-bottom: 4px; font-weight: bold;">${codeLang}</div>` : ''}<code>${codeContent}</code></pre>\n`;
        inCode = false;
        codeContent = '';
        codeLang = '';
      } else {
        inCode = true;
        codeLang = line.replace('```', '').trim();
      }
      continue;
    }

    if (inCode) {
      codeContent += line + '\n';
      continue;
    }

    if (line.trim().startsWith('|') && i + 1 < lines.length && lines[i+1].trim().includes('|') && /^[|:\-\s]+$/.test(lines[i+1].trim())) {
      flushList();
      const headers = line.split('|').map(s => s.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      const alignLine = lines[i+1];
      const aligns = alignLine.split('|').map(s => s.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).map(cell => {
        if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
        if (cell.endsWith(':')) return 'right';
        return 'left';
      });

      let tableHtml = '<table><thead><tr>';
      headers.forEach((h, idx) => {
        const align = aligns[idx] || 'left';
        tableHtml += `<th style="text-align: ${align}">${parseInline(h)}</th>`;
      });
      tableHtml += '</tr></thead><tbody>';

      i += 2;
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i].split('|').map(s => s.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        tableHtml += '<tr>';
        for (let cIdx = 0; cIdx < headers.length; cIdx++) {
          const align = aligns[cIdx] || 'left';
          tableHtml += `<td style="text-align: ${align}">${parseInline(cells[cIdx] || '')}</td>`;
        }
        tableHtml += '</tr>';
        i++;
      }
      tableHtml += '</tbody></table>\n';
      html += tableHtml;
      i--;
      continue;
    }

    if (line.trim() === '---') {
      flushList();
      html += '<hr />\n';
      continue;
    }

    if (line.startsWith('# ')) {
      flushList();
      html += `<h1>${parseInline(line.slice(2))}</h1>\n`;
      continue;
    }
    if (line.startsWith('## ')) {
      flushList();
      html += `<h2>${parseInline(line.slice(3))}</h2>\n`;
      continue;
    }
    if (line.startsWith('### ')) {
      flushList();
      html += `<h3>${parseInline(line.slice(4))}</h3>\n`;
      continue;
    }

    const bulletMatch = line.match(/^(\s*)([-*])\s+(.+)$/);
    if (bulletMatch) {
      const content = bulletMatch[3];
      if (!inList || isOrdered) {
        flushList();
        inList = true;
        isOrdered = false;
        html += '<ul>\n';
      }
      html += `<li>${parseInline(content)}</li>\n`;
      continue;
    }

    const numMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
    if (numMatch) {
      const content = numMatch[3];
      if (!inList || !isOrdered) {
        flushList();
        inList = true;
        isOrdered = true;
        html += '<ol>\n';
      }
      html += `<li>${parseInline(content)}</li>\n`;
      continue;
    }

    if (line.trim().startsWith('>')) {
      flushList();
      html += `<blockquote>${parseInline(line.trim().slice(1).trim())}</blockquote>\n`;
      continue;
    }

    if (line.trim() === '') {
      flushList();
      continue;
    }

    flushList();
    html += `<p>${parseInline(line)}</p>\n`;
  }

  flushList();
  return html;
}

/**
 * 앱 전역 상태/액션을 제공하는 Context Provider.
 *
 * 일정(event)·재고(asset)·메모(memo)를 단일 `UniversalRecord` 모델로 통합 관리하며,
 * 로컬 영속화(localStorage 기반 database 모듈), 활동 로그, 자연어 입력(NLP) 처리,
 * 일정 알림 스케줄링, 휴지통(아카이브), CSV 내보내기 등을 담당한다.
 *
 * @param children Provider 하위에 렌더링할 React 노드
 */
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
  const [memoForm, setMemoForm] = useState<{id?: string; title: string; content: string; pinned?: boolean; color?: string}>({ title: '', content: '', pinned: false, color: '' });
  const [notified, setNotified] = useState<Set<string>>(new Set());
  const [activeNotification, setActiveNotification] = useState<{
    id: string;
    title: string;
    body: string;
    time: string;
    date: string;
  } | null>(null);
  const [snoozedSchedules, setSnoozedSchedules] = useState<Record<string, number>>({});

  const handleDismissNotification = () => {
    setActiveNotification(null);
  };

  const handleSnoozeNotification = (scheduleId: string) => {
    setSnoozedSchedules(prev => ({
      ...prev,
      [scheduleId]: Date.now() + 10 * 60 * 1000
    }));
    setNotified(prev => {
      const next = new Set(prev);
      next.delete(scheduleId);
      return next;
    });
    const schedule = records.find(r => r.id === scheduleId);
    showToast(`⏰ '${schedule?.title || '일정'}' 알림이 10분 뒤로 미뤄졌습니다.`);
    setActiveNotification(null);
  };

  const handleCompleteNotificationSchedule = (scheduleId: string) => {
    const schedule = records.find(r => r.id === scheduleId);
    if (schedule) {
      // completed 플래그는 최상위가 아니라 attrs 내부에 위치한다 (UniversalRecord 구조)
      handleUpdateSchedule(scheduleId, { attrs: { ...schedule.attrs, completed: true } });
      logActivity('DONE_SCHED', schedule.title, schedule.title);
      showToast(`✓ 일정 '${schedule.title}' 완료 처리됨`);
    }
    setActiveNotification(null);
  };

  const [activeTab, setActiveTab] = useState<'all' | 'calendar' | 'inventory' | 'category' | 'settings'>('all');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const applyAccentColor = (color: string) => {
    document.documentElement.style.setProperty('--accent', color);
    document.documentElement.style.setProperty('--accent-glow', color + '40');
  };

  const [archive, setArchive] = useState<ArchivedRecord[]>([]);
  const reloadRecords = () => {
    setRecords(getRecords());
  };
  const reloadArchive = () => setArchive(getArchive());

  // 서버(공유 DB)에서 모든 상태를 다시 받아 화면에 반영한다.
  // 초기 로드 + 창 포커스/탭 복귀 시 호출 → 다른 기기(APK 등)의 변경이 즉시 반영된다.
  const syncFromServer = async (applySettings = true) => {
    await initData();
    reloadRecords();
    reloadArchive();
    setActivities(loadActivities());
    if (applySettings) {
      const s = loadSettings();
      setAppSettings(s);
      setCalendarMode(s.calendarView);
      applyAccentColor(s.accentColor);
      document.documentElement.setAttribute('data-density', s.density);
      document.documentElement.setAttribute('data-font-size', s.fontSize || 'medium');
    }
  };

  // 수동 동기화 — Sync 버튼이 호출. 서버에서 최신 데이터를 즉시 다시 불러온다.
  const [syncing, setSyncing] = useState(false);
  const manualSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await syncFromServer(false);
      showToast('🔄 동기화 완료');
    } catch {
      showToast('⚠️ 동기화 실패 — 네트워크를 확인하세요');
    } finally {
      setSyncing(false);
    }
  };

  // Init — 테마는 기기별(localStorage), 데이터는 서버에서 로드
  useEffect(() => {
    const savedTheme = localStorage.getItem('zero_theme') as 'light' | 'dark' | null;
    const initTheme = savedTheme || 'light';
    setTheme(initTheme);
    document.documentElement.setAttribute('data-theme', initTheme);

    syncFromServer();

    // 다른 기기에서 바뀐 데이터를 가져오기 위해 창이 다시 활성화될 때마다 재동기화
    const onFocus = () => { syncFromServer(false); };
    const onVisible = () => { if (document.visibilityState === 'visible') syncFromServer(false); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

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
    const newAct: ActivityLog = { id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, type, title, snippet, timestamp: Date.now() };
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
    document.documentElement.setAttribute('data-font-size', s.fontSize || 'medium');
    persistSettings(s);
  };

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  // 일정 알림 스케줄러: 10초마다 임박한 일정을 검사해 알림을 발송한다.
  // 트리거 시각(일정시각 - notifyOffset) 기준 0~300초 윈도 안에서, 아직 알리지 않은 건만 발송한다.
  useEffect(() => {
    const schedules = records.filter(r => r.type === 'event');
    const checkNotifications = () => {
      const now = new Date();
      const newNotified = new Set(notified);
      let hasNew = false;
      
      schedules.forEach(s => {
        if (!s.attrs.completed && !s.attrs.allDay && s.attrs.time) {
          const scheduleTime = parseISO(`${s.attrs.date}T${s.attrs.time}`);
          const offset = s.attrs.notifyOffset ?? appSettings.defaultNotifyOffset ?? 0;
          const triggerTime = new Date(scheduleTime.getTime() - offset * 60000);
          const diffSeconds = differenceInSeconds(now, triggerTime);

          // Check if snoozed
          const snoozeUntil = snoozedSchedules[s.id];
          const isSnoozed = snoozeUntil && Date.now() < snoozeUntil;

          if (offset >= 0 && diffSeconds >= 0 && diffSeconds <= 300 && !isSnoozed && !notified.has(s.id)) {
            if (appSettings.enableNotifications !== false) {
              const title = '일정 알림';
              const body = `${s.title}`;
              const fullBody = `${s.title} (${s.attrs.time})`;

              const isElectron = (typeof window !== 'undefined') && (
                (window as any).__IS_ELECTRON__ ||
                (typeof (window as any).process !== 'undefined' && (window as any).process.versions && !!(window as any).process.versions.electron) ||
                (!!window.navigator && !!window.navigator.userAgent && window.navigator.userAgent.toLowerCase().indexOf(' electron/') > -1)
              );

              // ① 인앱 글래스모피즘 카드는 알림 타입과 무관하게 항상 표시 — 제시각 알림의 기본 UI
              setActiveNotification({
                id: s.id,
                title,
                body,
                time: s.attrs.time || '',
                date: s.attrs.date || ''
              });

              // ② 데스크톱(Electron) 앱이면 창을 앞으로 가져와 카드가 확실히 보이도록 한다
              if (isElectron && (window as any).ipcRenderer) {
                (window as any).ipcRenderer.send('focus-window');
              }

              // ③ 'browser'(OS 배너) 설정이면 OS 레벨 배너도 함께 발송 (앱이 백그라운드일 때 대비)
              if (appSettings.notificationType === 'browser' && typeof window !== 'undefined') {
                if (isElectron && (window as any).ipcRenderer) {
                  (window as any).ipcRenderer.send('send-notification', { title, body: fullBody });
                } else if ('Notification' in window && Notification.permission === 'granted') {
                  new Notification(title, { body: fullBody });
                } else {
                  fetch('/api/notify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, body: fullBody, type: 'browser' })
                  }).catch(() => {});
                }
              }
            }
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
  }, [records, notified, snoozedSchedules, appSettings]);

  /**
   * 커맨드 바의 자연어 입력을 처리한다 (Enter 입력 시 동작).
   * `/api/parse`로 텍스트를 보내 의도를 분석하고, 결과의 액션 코드에 따라 분기한다.
   * - R: 검색 뷰만 활성화(DB 변경 없음)  - C: 생성  - U: 수정  - D: 삭제
   * 그 외 enrichedAttrs로 반복(recurrence)·엔티티 링크(linkedIds)를 주입한다.
   * @param e 입력창 keydown 이벤트
   */
  const executeNlpCommand = async (text: string) => {
    if (!text.trim() || loading) return;
    setLoading(true);
    try {
      const parseRes = await fetch('/api/parse', { method: 'POST', body: JSON.stringify({ text, apiKey: appSettings.apiKey || undefined }) });
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
    } catch (err) { showToast('오류 발생'); }
    setLoading(false);
  };

  const handleNlpSubmit = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Enter 키 + 공백 아닌 입력 + 비로딩 상태에서만 분석 실행
    if (e.key === 'Enter' && nlpInput.trim() && !loading) {
      await executeNlpCommand(nlpInput);
      setNlpInput('');
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

  /**
   * 일정/재고/메모 공통 완료 토글 (업무 플로우 관리용).
   * 일정(event)은 반복/가상 인스턴스 처리가 필요하므로 toggleComplete로 위임한다.
   * @param e 클릭 이벤트 (버블링으로 인한 상위 핸들러 실행을 막기 위해 전파 차단)
   * @param r 토글 대상 레코드
   */
  const toggleDone = (e: React.MouseEvent, r: UniversalRecord) => {
    e.stopPropagation();
    // 일정은 반복/가상 일정 분기 로직이 있으므로 전용 핸들러로 위임 후 조기 종료
    if (r.type === 'event') { toggleComplete(e, r); return; }
    const updatedStatus = !r.attrs.completed;
    updateRecord(r.id, { attrs: { ...r.attrs, completed: updatedStatus } });
    reloadRecords();
    // NOTE: 활동 로그 타입은 완료/재개와 무관하게 동일(UPDATE_*)하며, 표시 문구만 달라진다.
    if (r.type === 'asset') {
      logActivity('UPDATE_INV', updatedStatus ? '재고 완료 처리' : '재고 재개', r.title);
    } else {
      logActivity('UPDATE_MEMO', updatedStatus ? '메모 완료 처리' : '메모 재개', r.title);
    }
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

  const handleDuplicateSchedule = (id: string) => {
    const target = records.find(r => r.id === id);
    if (!target) return;
    const newRecord = addRecord({
      title: `${target.title} (복사본)`,
      type: target.type,
      category: target.category,
      attrs: { ...target.attrs, completed: false }
    });
    reloadRecords();
    showToast(`'${target.title}' 복제 — 수정 후 저장하세요`);
    logActivity('ADD_SCHED', '일정 복제', target.title);
    setEditingSchedule(newRecord);
  };

  const handleDuplicateInventory = (id: string) => {
    const target = records.find(r => r.id === id);
    if (!target) return;
    const newRecord = addRecord({
      title: `${target.title} (복사본)`,
      type: target.type,
      category: target.category,
      attrs: { ...target.attrs }
    });
    reloadRecords();
    showToast(`'${target.title}' 복제 — 수정 후 저장하세요`);
    logActivity('ADD_INV', '재고 복제', target.title);
    setEditingInventory(newRecord);
  };

  const handleDuplicateMemo = (id: string) => {
    const target = records.find(r => r.id === id);
    if (!target) return;
    const newRecord = addRecord({
      title: `${target.title} (복사본)`,
      type: target.type,
      category: target.category,
      attrs: { ...target.attrs }
    });
    reloadRecords();
    showToast(`'${target.title}' 복제 — 수정 후 저장하세요`);
    logActivity('ADD_MEMO', '메모 복제', target.title);
    setMemoForm({
      id: newRecord.id,
      title: newRecord.title,
      content: newRecord.attrs.content || '',
      pinned: newRecord.attrs.pinned || false,
      color: newRecord.attrs.color || ''
    });
    setIsMemoModalOpen(true);
  };

  const submitMemo = () => {
    if (!memoForm.title || !memoForm.content) return;
    if (memoForm.id) {
      updateRecord(memoForm.id, { 
        title: memoForm.title, 
        attrs: { 
          content: memoForm.content,
          pinned: memoForm.pinned || false,
          color: memoForm.color || ''
        } 
      });
      logActivity('UPDATE_MEMO', '변동 사항 수정', memoForm.title);
    } else {
      addRecord({ 
        title: memoForm.title, 
        type: 'memo',
        category: '메모',
        attrs: { 
          content: memoForm.content, 
          pinned: memoForm.pinned || false,
          color: memoForm.color || '',
          effectiveDate: new Date().toISOString().split('T')[0] 
        } 
      });
      logActivity('ADD_MEMO', '변동 사항 등록', memoForm.title);
    }
    setMemoForm({ title: '', content: '', pinned: false, color: '' });
    setIsMemoModalOpen(false);
    reloadRecords();
    showToast('저장 완료');
  };

  const updateMemoContentDirectly = (id: string, newContent: string) => {
    const memo = records.find(r => r.id === id);
    if (!memo) return;
    updateRecord(id, {
      attrs: {
        ...memo.attrs,
        content: newContent
      }
    });
    reloadRecords();
  };

  const deleteMemo = (id: string) => {
    deleteRecord(id);
    setMemoForm({ title: '', content: '', pinned: false, color: '' });
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
    if (editingInventory && editingInventory.id === id) setEditingInventory(null);
  };

  /**
   * 일정, 재고, 메모 데이터를 CSV 파일로 내보낸다.
   * Excel 한글 깨짐 방지를 위해 BOM(﻿)을 선두에 추가한다.
   * @param type 'event'(일정), 'asset'(재고), 'memo'(메모)
   */
  const exportToCsv = (type: 'event' | 'asset' | 'memo', specificRecordId?: string) => {
    let filtered = records.filter(r => r.type === type);

    if (specificRecordId) {
      filtered = filtered.filter(r => r.id === specificRecordId);
    } else {
      filtered = filtered.sort((a, b) => {
        if (type === 'event') {
          const dateA = a.attrs.date || '';
          const dateB = b.attrs.date || '';
          if (dateA !== dateB) return dateA.localeCompare(dateB);
          const timeA = a.attrs.allDay ? '00:00' : (a.attrs.time || '23:59');
          const timeB = b.attrs.allDay ? '00:00' : (b.attrs.time || '23:59');
          return timeA.localeCompare(timeB);
        }
        if (type === 'asset') {
          const catA = a.category || '';
          const catB = b.category || '';
          if (catA !== catB) return catA.localeCompare(catB);
          return (a.title || '').localeCompare(b.title || '');
        }
        if (type === 'memo') {
          const pinnedA = a.attrs.pinned ? 1 : 0;
          const pinnedB = b.attrs.pinned ? 1 : 0;
          if (pinnedA !== pinnedB) return pinnedB - pinnedA; // Pinned first
          const dateA = a.attrs.effectiveDate || '';
          const dateB = b.attrs.effectiveDate || '';
          return dateB.localeCompare(dateA); // Newest first
        }
        return 0;
      });
    }

    let csvContent = "";
    
    if (type === 'event') {
      csvContent += "구분,제목,카테고리,날짜,시간,완료여부\n";
      filtered.forEach(r => {
        const title = `"${(r.title || '').replace(/"/g, '""')}"`;
        const cat = `"${(r.category || '').replace(/"/g, '""')}"`;
        const date = r.attrs.date || '';
        const time = r.attrs.allDay ? '하루 종일' : (r.attrs.time || '');
        const done = r.attrs.completed ? "완료" : "미완료";
        csvContent += `일정,${title},${cat},${date},${time},${done}\n`;
      });
    } else if (type === 'asset') {
      csvContent += "구분,품명,카테고리,수량,상태,위치,담당자\n";
      filtered.forEach(r => {
        const title = `"${(r.title || '').replace(/"/g, '""')}"`;
        const cat = `"${(r.category || '').replace(/"/g, '""')}"`;
        const qty = r.attrs.qty || 0;
        const flow = r.attrs.flow === 'OUT' ? '출고' : '입고';
        const loc = `"${(r.attrs.location || '').replace(/"/g, '""')}"`;
        const mgr = `"${(r.attrs.manager || '').replace(/"/g, '""')}"`;
        csvContent += `재고,${title},${cat},${qty},${flow},${loc},${mgr}\n`;
      });
    } else if (type === 'memo') {
      csvContent += "구분,제목,카테고리,내용,고정여부,작성일자\n";
      filtered.forEach(r => {
        const title = `"${(r.title || '').replace(/"/g, '""')}"`;
        const cat = `"${(r.category || '').replace(/"/g, '""')}"`;
        const content = `"${(r.attrs.content || '').replace(/"/g, '""')}"`;
        const pinned = r.attrs.pinned ? "고정" : "일반";
        const date = r.attrs.effectiveDate || '';
        csvContent += `메모,${title},${cat},${content},${pinned},${date}\n`;
      });
    }

    const bom = "\uFEFF"; // BOM for Excel encoding
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    let filename = `zero_`;
    if (specificRecordId && filtered.length > 0) {
      const safeTitle = (filtered[0].title || 'memo').trim().replace(/[^a-zA-Z0-9가-힣_-]/g, '_').substring(0, 30);
      filename += `${safeTitle}_`;
    } else {
      if (type === 'event') filename += 'schedule_';
      else if (type === 'asset') filename += 'inventory_';
      else filename += 'memo_';
    }
    filename += `${new Date().toISOString().split('T')[0]}.csv`;

    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    let displayName = '일정';
    if (type === 'asset') displayName = '재고';
    else if (type === 'memo') displayName = '메모';

    if (specificRecordId && filtered.length > 0) {
      showToast(`"${filtered[0].title || displayName}" CSV 내보내기 완료`);
    } else {
      showToast(`${displayName} CSV 내보내기 완료`);
    }
  };

  /**
   * 데이터를 PDF 인쇄 창(Save as PDF)으로 내보낸다.
   * @param type 'event'(일정), 'asset'(재고), 'memo'(메모)
   */
  const printToPdf = (type: 'event' | 'asset' | 'memo', specificRecordId?: string) => {
    let filtered = records.filter(r => r.type === type);

    if (specificRecordId) {
      filtered = filtered.filter(r => r.id === specificRecordId);
    } else {
      filtered = filtered.sort((a, b) => {
        if (type === 'event') {
          const dateA = a.attrs.date || '';
          const dateB = b.attrs.date || '';
          if (dateA !== dateB) return dateA.localeCompare(dateB);
          const timeA = a.attrs.allDay ? '00:00' : (a.attrs.time || '23:59');
          const timeB = b.attrs.allDay ? '00:00' : (b.attrs.time || '23:59');
          return timeA.localeCompare(timeB);
        }
        if (type === 'asset') {
          const catA = a.category || '';
          const catB = b.category || '';
          if (catA !== catB) return catA.localeCompare(catB);
          return (a.title || '').localeCompare(b.title || '');
        }
        if (type === 'memo') {
          const pinnedA = a.attrs.pinned ? 1 : 0;
          const pinnedB = b.attrs.pinned ? 1 : 0;
          if (pinnedA !== pinnedB) return pinnedB - pinnedA; // Pinned first
          const dateA = a.attrs.effectiveDate || '';
          const dateB = b.attrs.effectiveDate || '';
          return dateB.localeCompare(dateA); // Newest first
        }
        return 0;
      });
    }

    let titleText = '';
    let bodyContent = '';

    if (type === 'event') {
      titleText = specificRecordId && filtered.length > 0 ? `일정 상세: ${filtered[0].title || ''}` : '일정 리스트';
      bodyContent = `
        <table>
          <thead>
            <tr>
              <th style="width: 15%;">날짜</th>
              <th style="width: 15%;">시간</th>
              <th>제목</th>
              <th style="width: 20%;">카테고리</th>
              <th style="width: 15%;">완료 여부</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(r => `
              <tr>
                <td>${r.attrs.date || ''}</td>
                <td>${r.attrs.allDay ? '하루 종일' : (r.attrs.time || '')}</td>
                <td style="font-weight: 500;">${r.title || ''}</td>
                <td>${r.category || '일반'}</td>
                <td>
                  <span class="badge ${r.attrs.completed ? 'badge-completed' : 'badge-pending'}">
                    ${r.attrs.completed ? '완료' : '미완료'}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (type === 'asset') {
      titleText = specificRecordId && filtered.length > 0 ? `재고 상세: ${filtered[0].title || ''}` : '재고 리스트';
      bodyContent = `
        <table>
          <thead>
            <tr>
              <th>품명</th>
              <th style="width: 15%;">카테고리</th>
              <th style="width: 10%;">수량</th>
              <th style="width: 10%;">상태</th>
              <th style="width: 20%;">위치</th>
              <th style="width: 15%;">담당자</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(r => `
              <tr>
                <td style="font-weight: 500;">${r.title || ''}</td>
                <td>${r.category || ''}</td>
                <td>${r.attrs.qty || 0}</td>
                <td>
                  <span class="badge ${r.attrs.flow === 'OUT' ? 'badge-out' : 'badge-in'}">
                    ${r.attrs.flow === 'OUT' ? '출고' : '입고'}
                  </span>
                </td>
                <td>${r.attrs.location || ''}</td>
                <td>${r.attrs.manager || ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (type === 'memo') {
      titleText = specificRecordId && filtered.length > 0 ? `메모 상세: ${filtered[0].title || ''}` : '메모 리스트';
      bodyContent = `
        <div class="memo-list">
          ${filtered.map(r => `
            <div class="memo-card">
              <div class="memo-header">
                <div class="memo-title-wrapper">
                  ${r.attrs.pinned ? '<span class="memo-badge-pinned">고정</span>' : ''}
                  <h3 class="memo-title">${r.title || '제목 없음'}</h3>
                </div>
                <div>
                  <span class="memo-category">${r.category || '메모'}</span>
                  <span class="memo-date" style="margin-left: 8px;">${r.attrs.effectiveDate || ''}</span>
                </div>
              </div>
              <div class="memo-content">
                ${renderMarkdownToHtml(r.attrs.content || '')}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${titleText}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #333; padding: 20px; line-height: 1.6; }
          h1 { font-size: 24px; color: #111; margin-bottom: 5px; border-bottom: 2px solid #0070f3; padding-bottom: 10px; }
          .meta { font-size: 12px; color: #666; margin-bottom: 20px; text-align: right; }
          
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #ddd; padding: 10px 12px; text-align: left; font-size: 13px; }
          th { background-color: #f7f7f7; font-weight: bold; color: #555; }
          tr:nth-child(even) { background-color: #fafafa; }
          
          .badge { display: inline-block; padding: 2px 6px; font-size: 11px; font-weight: bold; border-radius: 4px; }
          .badge-completed { background-color: #e6fffa; color: #00875a; border: 1px solid #b2f5ea; }
          .badge-pending { background-color: #fffaf0; color: #dd6b20; border: 1px solid #fde8d0; }
          .badge-in { background-color: #ebf8ff; color: #2b6cb0; border: 1px solid #bee3f8; }
          .badge-out { background-color: #fff5f5; color: #c53030; border: 1px solid #fed7d7; }
          
          .memo-card { border: 1px solid #e1e4e8; border-radius: 8px; padding: 16px; margin-bottom: 20px; page-break-inside: avoid; background-color: #fff; }
          .memo-header { display: flex; justify-content: space-between; border-bottom: 1px solid #f1f2f4; padding-bottom: 8px; margin-bottom: 12px; }
          .memo-title-wrapper { display: flex; align-items: center; gap: 8px; }
          .memo-title { font-size: 16px; font-weight: bold; color: #111; margin: 0; }
          .memo-badge-pinned { background-color: #ffe8cc; color: #d9480f; padding: 2px 6px; font-size: 10px; font-weight: bold; border-radius: 4px; border: 1px solid #ffd8a8; }
          .memo-date { font-size: 12px; color: #868e96; }
          .memo-category { font-size: 12px; color: #0070f3; font-weight: bold; }
          
          .memo-content { font-size: 13px; color: #444; }
          .memo-content p { margin: 0 0 10px 0; }
          .memo-content p:last-child { margin-bottom: 0; }
          .memo-content h1 { font-size: 18px; margin-top: 15px; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
          .memo-content h2 { font-size: 16px; margin-top: 14px; margin-bottom: 6px; }
          .memo-content h3 { font-size: 14px; margin-top: 12px; margin-bottom: 5px; }
          .memo-content ul, .memo-content ol { padding-left: 20px; margin: 0 0 10px 0; }
          .memo-content li { margin-bottom: 4px; }
          .memo-content code { font-family: ui-monospace, monospace; background-color: #f1f3f5; padding: 2px 4px; border-radius: 4px; font-size: 90%; }
          .memo-content pre { font-family: ui-monospace, monospace; background-color: #f8f9fa; padding: 12px; border-radius: 6px; border: 1px solid #e9ecef; overflow-x: auto; margin: 10px 0; }
          .memo-content pre code { background-color: transparent; padding: 0; border-radius: 0; font-size: 100%; }
          .memo-content blockquote { border-left: 4px solid #0070f3; padding-left: 12px; color: #666; margin: 10px 0; font-style: italic; }
          .memo-content table { width: 100%; border-collapse: collapse; margin: 12px 0; }
          .memo-content th, .memo-content td { border: 1px solid #dee2e6; padding: 8px 10px; text-align: left; font-size: 12px; }
          .memo-content th { background-color: #f1f3f5; }
          .memo-content .hashtag { color: #0070f3; background-color: #ebf8ff; padding: 2px 4px; border-radius: 4px; font-size: 90%; font-weight: bold; }
          .memo-content .mention { color: #0070f3; background-color: #ebf8ff; padding: 2px 4px; border-radius: 4px; font-size: 90%; font-weight: bold; }

          @media print {
            body { padding: 0; }
            .memo-card { border-color: #ccc; }
          }
        </style>
      </head>
      <body>
        <h1>${titleText}</h1>
        <div class="meta">출력 일시: ${new Date().toLocaleString('ko-KR')}</div>
        ${bodyContent}
      </body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();

      iframe.contentWindow?.focus();
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 500);
    } else {
      showToast('PDF 인쇄 창을 열지 못했습니다.');
    }
  };

  return (
    <AppContext.Provider value={{
      theme, setTheme, records, setRecords, toast, setToast, activities, setActivities, appSettings, setAppSettings,
      isSettingsOpen, setIsSettingsOpen, viewDate, setViewDate, selectedDate, setSelectedDate, calendarMode, setCalendarMode,
      isActivityDrawerOpen, setIsActivityDrawerOpen, nlpInput, setNlpInput, loading, setLoading, 
      editingSchedule, setEditingSchedule, editingInventory, setEditingInventory, handleUpdateInventory,
      isMemoModalOpen, setIsMemoModalOpen, memoPage, setMemoPage, memoForm, setMemoForm,
      activeTab, setActiveTab, activeCategory, setActiveCategory,
      reloadRecords, manualSync, syncing, toggleTheme, logActivity, handleSettingsChange, showToast, handleNlpSubmit, executeNlpCommand, handleUpdateSchedule,
      toggleComplete, toggleDone, handleDeleteSchedule, submitMemo, updateMemoContentDirectly, deleteMemo, deleteInventoryItem,
      handleDuplicateSchedule, handleDuplicateInventory, handleDuplicateMemo,
      archive, reloadArchive, restoreArchived, permanentDelete, emptyArchive, clearActivities,
      searchQuery, searchType, setSearchResult,
      showCompleted, setShowCompleted, exportToCsv, printToPdf,
      activeNotification, setActiveNotification, handleDismissNotification, handleSnoozeNotification, handleCompleteNotificationSchedule
    }}>
      {children}
    </AppContext.Provider>
  );
}

/**
 * 앱 전역 컨텍스트에 접근하는 커스텀 훅.
 * @throws AppProvider 외부에서 호출되면 에러를 던진다.
 * @returns 전역 상태와 액션이 담긴 컨텍스트 값
 */
export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within an AppProvider");
  return context;
}
