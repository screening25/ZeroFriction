"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { format, addWeeks, subWeeks, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, parseISO, isToday } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, ChevronLeft, ChevronRight, CheckCircle2, Circle, Package, AlertTriangle, Calendar as CalIcon, Layers, ClipboardList, ChevronDown, FileText, MapPin, Tag, User, Sliders, Pin, Coffee, AlertCircle, Calendar, Trophy, Search, CornerDownLeft, FileSpreadsheet, Printer, X, ListPlus, Trash2, Menu, MoreHorizontal, ArrowDownUp } from 'lucide-react';
import { useApp } from '@/frontend/context/AppContext';
import { ACCENT_COLORS, addRecord, updateRecord, deleteRecord, expandRecurringEvents } from '@/database';
import SettingsSection from '@/frontend/components/SettingsSection';
import CustomTimePicker from '@/frontend/components/CustomTimePicker';
import CustomSelect from '@/frontend/components/CustomSelect';
import CustomDatePicker from '@/frontend/components/CustomDatePicker';
import Markdown from '@/frontend/components/Markdown';
import { hexToRgb, getCategoryColorStyles, getMemoCardStyle, getMemoModalStyle } from '@/frontend/utils/styles';
import { isHoliday } from '@/frontend/utils/calendar';
import { isSerialPattern } from '@/frontend/utils/inventory';
import ClientPicker from '@/frontend/components/ClientPicker';
import SearchSelect from '@/frontend/components/SearchSelect';
import CameraScan from '@/frontend/components/CameraScan';

interface BulkRow {
  code: string;
  title: string;
  qty: number;
  flow: 'IN' | 'OUT';
  loc: string;
  mgr: string;
  memo: string;
  serial?: string;
}

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
    submitMemo, updateMemoContentDirectly, deleteMemo, deleteInventoryItem,
    handleDuplicateSchedule, handleDuplicateInventory, handleDuplicateMemo,
    archive, restoreArchived, permanentDelete, emptyArchive, clearActivities,
    activities,
    searchQuery, searchType, setSearchResult,
    exportToCsv, printToPdf
  } = useApp();

  const getCategoryColor = (cat: string) => getCategoryColorStyles(cat, appSettings.categoryColors).solid;
  const getCategorySoftBg = (cat: string) => getCategoryColorStyles(cat, appSettings.categoryColors).soft;
  const getCategoryBorder = (cat: string) => getCategoryColorStyles(cat, appSettings.categoryColors).border;

  const [selectedCategoryColor, setSelectedCategoryColor] = useState('#AF52DE');



  // Local Category Filters for Schedule and Inventory (Enforce strict isolation!)
  const [selectedScheduleCategory, setSelectedScheduleCategory] = useState<string>('전체');
  const [selectedInventoryCategory, setSelectedInventoryCategory] = useState<string>('전체');

  // Widgets collapse/expand states inside Overview
  const [isTodaySchedulesExpanded, setIsTodaySchedulesExpanded] = useState<boolean>(true);
  const [isRecentMemosExpanded, setIsRecentMemosExpanded] = useState<boolean>(true);
  const [isInventoryFlowExpanded, setIsInventoryFlowExpanded] = useState<boolean>(true);

  const [schedulePage, setSchedulePage] = useState<number>(0);
  const [inventoryPage, setInventoryPage] = useState<number>(0);
  const [inventoryFlowView, setInventoryFlowView] = useState<'all' | 'IN' | 'OUT'>('all'); // 총재고/입고/출고 뷰
  const [isTxnLogOpen, setIsTxnLogOpen] = useState(false); // 입출고 로그 모달
  const [editingTxnId, setEditingTxnId] = useState<string | null>(null); // 수정 중인 로그 항목
  const [txnDraft, setTxnDraft] = useState<{ flow: 'IN' | 'OUT'; qty: number; memo: string }>({ flow: 'IN', qty: 0, memo: '' });
  const [isInvMenuOpen, setIsInvMenuOpen] = useState(false); // 재고 '더보기' 메뉴
  // 일정 안에서 특정 재고를 입출고 기록하기 위한 드래프트
  const [schedInv, setSchedInv] = useState<{ assetId: string; qty: number; flow: 'IN' | 'OUT'; memo: string }>({ assetId: '', qty: 1, flow: 'OUT', memo: '' });
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set()); // 접힌 재고 그룹(코드)
  const toggleGroupCollapse = (code: string) => setCollapsedGroups(prev => {
    const next = new Set(prev);
    next.has(code) ? next.delete(code) : next.add(code);
    return next;
  });
  const [dragKey, setDragKey] = useState<string | null>(null); // 드래그 중인 재고 그룹 코드(시각 표시용)
  const dragKeyRef = useRef<string | null>(null); // 핸들러가 동기로 읽는 값(상태는 비동기라 stale closure 방지)
  const [dragItemId, setDragItemId] = useState<string | null>(null); // 그룹 내 개별 항목 드래그(시각용)
  const dragItemRef = useRef<string | null>(null);

  // States for @mention suggestion autocomplete popup
  const [mentionTriggerInfo, setMentionTriggerInfo] = useState<{ query: string; triggerIndex: number } | null>(null);
  const [hoveredMentionId, setHoveredMentionId] = useState<string | null>(null);

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

  useEffect(() => {
    setSchedulePage(0);
  }, [selectedScheduleCategory, selectedDate]);

  useEffect(() => {
    setInventoryPage(0);
  }, [selectedInventoryCategory]);

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

  const [isMasterSettingsOpen, setIsMasterSettingsOpen] = useState(false);
  const [newLocInput, setNewLocInput] = useState('');
  const [newCatInput, setNewCatInput] = useState('');
  const [newMgrInput, setNewMgrInput] = useState('');
  const [newClientInput, setNewClientInput] = useState('');

  // Bulk Inventory States
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [pasteText, setPasteText] = useState('');
  const [createMemo, setCreateMemo] = useState(false);
  const [memoTitle, setMemoTitle] = useState('');
  const [memoContent, setMemoContent] = useState('');
  const [isMemoCustom, setIsMemoCustom] = useState(false);

  const locations = appSettings.locations?.length ? appSettings.locations : ['비즈니스 창고', '메인 매장', '이동용 밴', 'A창고', 'B창고'];
  const managers = appSettings.managers?.length ? appSettings.managers : ['윤상영', '김철수', '이영희', '박민수'];

  const [isScheduleMasterSettingsOpen, setIsScheduleMasterSettingsOpen] = useState(false);
  const [newSchedCatInput, setNewSchedCatInput] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);

  const addMasterScheduleCategory = (cat: string, color: string) => {
    if (!cat.trim()) return;
    const current = appSettings.scheduleCategories || ['업무', '회의', '개인', '일반'];
    if (current.includes(cat.trim())) return;
    
    const colors = { ...(appSettings.categoryColors || {}) };
    colors[cat.trim()] = color;
    
    const updated = { 
      ...appSettings, 
      scheduleCategories: [...current, cat.trim()],
      categoryColors: colors
    };
    handleSettingsChange(updated);
    setNewSchedCatInput('');
    setSelectedCategoryColor('#AF52DE');
    showToast(`일정 카테고리 '${cat.trim()}' 추가 완료`);
  };

  const deleteMasterScheduleCategory = (cat: string) => {
    const current = appSettings.scheduleCategories || ['업무', '회의', '개인', '일반'];
    const colors = { ...(appSettings.categoryColors || {}) };
    delete colors[cat];
    
    const updated = { 
      ...appSettings, 
      scheduleCategories: current.filter(x => x !== cat),
      categoryColors: colors
    };
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

  const addMasterClient = (client: string) => {
    if (!client.trim()) return;
    const current = appSettings.clients || [];
    if (current.includes(client.trim())) return;
    const updated = { ...appSettings, clients: [...current, client.trim()] };
    handleSettingsChange(updated);
    setNewClientInput('');
    showToast(`고객사 '${client.trim()}' 추가 완료`);
  };

  const deleteMasterClient = (client: string) => {
    const current = appSettings.clients || [];
    const updated = { ...appSettings, clients: current.filter(x => x !== client) };
    handleSettingsChange(updated);
    showToast(`고객사 '${client}' 삭제 완료`);
  };

  // Auto-generate Memo Title & Content when rows or checkboxes change
  useEffect(() => {
    if (!createMemo) return;
    
    if (!memoTitle) {
      setMemoTitle(`[재고 일괄 처리] ${format(new Date(), 'yyyy-MM-dd')} 작업`);
    }
    
    if (isMemoCustom) return;

    const validRows = bulkRows.filter(r => r.title.trim() !== '' || r.code.trim() !== '');
    if (validRows.length === 0) {
      setMemoContent('등록된 일괄 처리 품목이 없습니다.');
      return;
    }

    let markdown = `### 📦 재고 일괄 처리 내역 (${format(new Date(), 'yyyy-MM-dd HH:mm')})\n\n`;
    markdown += `이번 일괄 처리 작업을 통해 총 **${validRows.length}개**의 품목이 조정되었습니다.\n\n`;
    markdown += `| 품목코드 | 품목명 | 수량 | 구분 | 보관위치 | 담당자 | 메모 |\n`;
    markdown += `| --- | --- | --- | --- | --- | --- | --- |\n`;

    validRows.forEach(row => {
      const flowText = row.flow === 'OUT' ? '🔴 출고' : '🟢 입고';
      markdown += `| \`${row.code || '-'}\` | **${row.title || '품목명 없음'}** | ${row.qty}개 | ${flowText} | ${row.loc || '-'} | ${row.mgr || '-'} | ${row.memo || '-'} |\n`;
    });

    setMemoContent(markdown);
  }, [bulkRows, createMemo, isMemoCustom, memoTitle]);

  // Merge rows helper to group duplicates and net their quantities
  const mergeRows = (rows: BulkRow[]): BulkRow[] => {
    const mergedList: BulkRow[] = [];
    rows.forEach(row => {
      // If the row has a serial number, keep it as a distinct entry.
      if (row.serial) {
        mergedList.push({ ...row });
        return;
      }

      // Find an existing row with the same title that does not have a serial number.
      const existing = mergedList.find(r => r.title.trim() === row.title.trim() && !r.serial);
      if (!existing) {
        mergedList.push({ ...row });
      } else {
        const existingNet = existing.flow === 'IN' ? existing.qty : -existing.qty;
        const currentNet = row.flow === 'IN' ? row.qty : -row.qty;
        const totalNet = existingNet + currentNet;

        existing.qty = Math.abs(totalNet);
        existing.flow = totalNet >= 0 ? 'IN' : 'OUT';

        if (!existing.code && row.code) {
          existing.code = row.code.trim();
        }
        if (row.loc && row.loc !== locations[0]) {
          existing.loc = row.loc.trim();
        }
        if (row.mgr && row.mgr !== managers[0]) {
          existing.mgr = row.mgr.trim();
        }
        const memos = [existing.memo, row.memo].map(m => m.trim()).filter(Boolean);
        existing.memo = memos.join('; ');
      }
    });
    return mergedList;
  };

  // Parse clipboard TSV/CSV/Markdown data
  const parsePasteData = (text: string) => {
    if (!text.trim()) {
      showToast('분석할 텍스트를 입력해 주세요.');
      return;
    }
    const lines = text.split(/\r?\n/);
    const parsed: BulkRow[] = [];
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Skip Markdown separator lines like | --- | --- |
      if (/^[|\s\-:]+$/.test(trimmed)) {
        return;
      }

      let cols: string[] = [];
      if (trimmed.includes('|')) {
        // Parse as Markdown table row
        cols = trimmed.split('|').map(s => s.trim());
        // Remove empty first/last elements if it had leading/trailing pipes
        if (cols.length > 0 && cols[0] === '') cols.shift();
        if (cols.length > 0 && cols[cols.length - 1] === '') cols.pop();
      } else {
        // Parse as standard TSV / CSV
        cols = trimmed.split(/\t|,/).map(s => s.trim());
      }

      if (cols.length === 0) return;

      // Skip header row or total lines
      const rawFirst = (cols[0] || '').replace(/\*/g, '').trim();
      const firstColLower = rawFirst.toLowerCase().replace(/\s+/g, '');
      
      const isHeaderOrTotal = 
        !rawFirst ||
        [
          '코드', 'code', '품목코드', '구분', '품명', '품목명', '수량',
          '기기번호', '기기번호', '시리얼', '시리얼번호', '일련번호', '일련번호', 'serial', 'serialnumber', 'serialno',
          's/n', 'sn', '기기명', '모델', '모델명', 'model', 'modelname', '기기', '번호', '비고', '상태'
        ].includes(firstColLower) ||
        firstColLower.includes('total') ||
        firstColLower.includes('합계') ||
        firstColLower.includes('grand');

      if (isHeaderOrTotal) {
        return;
      }

      let code = cols[0] || '';
      let title = cols[1] || '';
      let serial = '';
      let memo = cols[6] || '';
      
      const isSerial = isSerialPattern(code);
      if (isSerial) {
        serial = code.trim();
        const parts = serial.split(/[-_]/);
        const prefix = parts.slice(0, parts.length - 1).join('-');
        code = prefix;

        const secColClean = (cols[1] || '').trim();
        const secColLower = secColClean.toLowerCase().replace(/\s+/g, '');
        const isStatusOrInfo = 
          !secColClean ||
          [
            '보유', '출고', '입고', '사용중', '폐기', '수리중', '대여중', '정상', '고장', '불량', '미개봉',
            'in', 'out', 'active', 'inactive', 'lost', 'broken', 'damaged', 'stored', 'available', 'status',
            '동고fc', '안산fc', '충원고등학교', '경기모션fc', 'leofc', '동명대학교', '전북현대u18', '보물섬남해u15', '비즈니스팀', 'champasakavenir', '보물섬남해u15', '보물섬남해u18', '동고fc',
            '비고'
          ].includes(secColLower) ||
          secColClean.includes('데모') ||
          secColClean.includes('입고') ||
          secColClean.includes('출고');

        if (isStatusOrInfo) {
          title = prefix;
          // Combine second column status with third column comments (if any)
          const extraInfo = cols[2] ? cols[2].trim() : '';
          const statusMemo = secColClean + (extraInfo ? ` (${extraInfo})` : '');
          memo = memo ? `${statusMemo}; ${memo}` : statusMemo;
        } else {
          title = secColClean;
        }
      }

      const qtyStr = cols[2] || '1';
      const qty = isSerial ? 1 : (parseInt(qtyStr, 10) || 1);
      const flowText = cols[3] || '입고';
      const flow = (flowText.includes('출') || flowText.toLowerCase().includes('out')) ? 'OUT' : 'IN';
      const loc = cols[4] || locations[0];
      const mgr = cols[5] || managers[0];

      const validLoc = locations.includes(loc) ? loc : locations[0];
      const validMgr = managers.includes(mgr) ? mgr : managers[0];

      if (title || code) {
        parsed.push({
          code: code.trim(),
          title: (title || code).trim(),
          qty,
          flow,
          loc: validLoc,
          mgr: validMgr,
          memo: memo.trim(),
          serial: serial.trim()
        });
      }
    });

    if (parsed.length > 0) {
      setBulkRows(prev => mergeRows([...prev, ...parsed]));
      showToast(`${parsed.length}개의 품목 데이터가 파싱 및 병합 추가되었습니다.`);
      setPasteText('');
    } else {
      showToast('올바른 품목 데이터를 추출하지 못했습니다. 형식을 확인해 주세요.');
    }
  };

  const addNewRow = () => {
    setBulkRows(prev => [
      ...prev,
      {
        code: '',
        title: '',
        qty: 1,
        flow: 'IN',
        loc: locations[0],
        mgr: managers[0],
        memo: '',
        serial: ''
      }
    ]);
  };

  const deleteRow = (idx: number) => {
    setBulkRows(prev => prev.filter((_, i) => i !== idx));
  };

  const updateRow = (idx: number, field: keyof BulkRow, val: any) => {
    setBulkRows(prev => prev.map((row, i) => i === idx ? { ...row, [field]: val } : row));
  };

  const submitBulkInventory = () => {
    // Filter and merge duplicates on submit
    const validRows = mergeRows(bulkRows.filter(r => r.title.trim() !== '' || r.code.trim() !== ''));
    if (validRows.length === 0) {
      showToast('등록할 품목 데이터가 없습니다.');
      return;
    }

    const hasEmptyTitle = validRows.some(r => r.title.trim() === '');
    if (hasEmptyTitle) {
      showToast('품목명은 필수 입력 항목입니다.');
      return;
    }

    // 1. Create unified Memo first if enabled
    let memoId = '';
    if (createMemo) {
      const newMemo = addRecord({
        title: memoTitle.trim() || `[재고 일괄 처리] ${format(new Date(), 'yyyy-MM-dd')}`,
        type: 'memo',
        category: '메모',
        attrs: {
          content: memoContent,
          pinned: false,
          color: '',
          effectiveDate: format(new Date(), 'yyyy-MM-dd'),
          linkedIds: []
        }
      });
      memoId = newMemo.id;
    }

    const assetIds: string[] = [];

    // 2. Add inventory records
    validRows.forEach(row => {
      const qtyNum = Number(row.qty) || 1;
      const existingAsset = records.find(r => r.type === 'asset' && r.title.trim() === row.title.trim());
      const existingLinkedIds = existingAsset?.attrs?.linkedIds || [];
      const newLinkedIds = memoId ? [...existingLinkedIds, memoId].filter((v, i, a) => a.indexOf(v) === i) : existingLinkedIds;

      const attrs = {
        code: row.code.trim() || existingAsset?.attrs?.code || '',
        qty: qtyNum,
        flow: row.flow || 'IN',
        loc: row.loc || existingAsset?.attrs?.loc || locations[0],
        mgr: row.mgr || existingAsset?.attrs?.mgr || managers[0],
        serial: row.serial?.trim() || existingAsset?.attrs?.serial || '',
        memo: row.memo.trim() || existingAsset?.attrs?.memo || '',
        linkedIds: newLinkedIds
      };

      const resAsset = addRecord({
        title: row.title.trim(),
        type: 'asset',
        category: '재고',
        attrs
      });

      if (resAsset && resAsset.id) {
        assetIds.push(resAsset.id);
      }
    });

    // 3. Update Memo record with bidirectional references
    if (memoId && assetIds.length > 0) {
      updateRecord(memoId, {
        attrs: {
          content: memoContent,
          pinned: false,
          color: '',
          effectiveDate: format(new Date(), 'yyyy-MM-dd'),
          linkedIds: assetIds
        }
      });
    }

    // 4. Log unified activity
    logActivity('ADD_INV', '재고 일괄 처리', `${validRows.length}건 입출고 처리 완료`);
    reloadRecords();
    showToast(`${validRows.length}개의 재고가 정상적으로 처리되었습니다.`);
    setIsBulkModalOpen(false);
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
    .sort((a, b) => {
      const aAll = !!a.attrs.allDay;
      const bAll = !!b.attrs.allDay;
      if (aAll && !bAll) return -1;
      if (!aAll && bAll) return 1;
      return (a.attrs.time || '23:59').localeCompare(b.attrs.time || '23:59');
    });

  // Apply Schedule Local Category filter
  const displaySchedules = selectedScheduleCategory === '전체'
    ? selectedSchedules
    : selectedSchedules.filter(s => s.category === selectedScheduleCategory);

  const schedulesPerPage = appSettings.maxEventsShown || 5;
  const scheduleTotalPages = Math.ceil(displaySchedules.length / schedulesPerPage);
  const paginatedSchedules = displaySchedules.slice(schedulePage * schedulesPerPage, (schedulePage + 1) * schedulesPerPage);

  // Apply Inventory Local Category filter
  const displayInventories = (selectedInventoryCategory === '전체'
    ? inventory
    : inventory.filter(i => i.category === selectedInventoryCategory)
  ).filter(i => {
    if (inventoryFlowView === 'all') return true;
    const q = Number(i.attrs.qty) || 0;
    return inventoryFlowView === 'IN' ? q > 0 : q <= 0; // IN=보유(>0), OUT=소진·부족(<=0)
  });

  // 동일 품목코드끼리 그룹으로 묶는다(코드 없으면 품목명 단독 그룹). 그룹 내에서 사이즈·변형별로 나열.
  const groupedInventories = useMemo(() => {
    const groups: { code: string; label: string; items: typeof displayInventories }[] = [];
    const seen = new Map<string, number>();
    displayInventories.forEach(item => {
      const codeRaw = (item.attrs.code || '').trim();
      const key = codeRaw || `__no_code__${item.title}`;
      const label = codeRaw || item.title;
      if (seen.has(key)) {
        groups[seen.get(key)!].items.push(item);
      } else {
        seen.set(key, groups.length);
        groups.push({ code: key, label, items: [item] });
      }
    });
    return groups;
  }, [displayInventories]);

  const inventoryPerPage = appSettings.maxInventoryShown || 5;
  const inventoryTotalPages = Math.ceil(groupedInventories.length / inventoryPerPage);
  const paginatedGroups = groupedInventories.slice(inventoryPage * inventoryPerPage, (inventoryPage + 1) * inventoryPerPage);

  // 재고 그룹을 드래그하여 순서 변경 — 새 순서대로 모든 항목에 sortOrder를 재부여해 영속화
  // 기존에 따로 쌓인 같은 (품목코드+품목명) 재고 레코드를 하나로 합친다(수량 합산·이력 통합).
  // 합산 기준이 도입되기 전 입·출고가 별도 레코드로 남아 "따로 보이는" 경우를 정리.
  const consolidateInventory = () => {
    const assets = records.filter(r => r.type === 'asset');
    const groups = new Map<string, typeof assets>();
    assets.forEach(r => {
      const key = `${(r.attrs.code || '').trim()}|||${(r.title || '').trim()}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    });
    let merged = 0;
    groups.forEach(list => {
      if (list.length < 2) return;
      const keeper = list[0];
      let netQty = 0;
      let txns: any[] = [];
      list.forEach(r => { netQty += Number(r.attrs.qty) || 0; txns = txns.concat(r.attrs.txns || []); });
      txns.sort((a, b) => (a.ts || '').localeCompare(b.ts || ''));
      updateRecord(keeper.id, { attrs: { ...keeper.attrs, qty: netQty, flow: netQty < 0 ? 'OUT' : 'IN', txns } });
      list.slice(1).forEach(r => deleteRecord(r.id, { permanent: true }));
      merged += list.length - 1;
    });
    reloadRecords();
    showToast(merged > 0 ? `중복 재고 ${merged}건을 합쳤습니다.` : '합칠 중복 재고가 없습니다.');
  };

  // 전체 재고의 입출고 트랜잭션을 시간 역순으로 모은 통합 로그
  const allTxns = useMemo(() => {
    const rows: any[] = [];
    records.filter(r => r.type === 'asset').forEach(r => {
      (r.attrs.txns || []).forEach((tx: any) => rows.push({ ...tx, recId: r.id, itemTitle: r.title, itemCode: (r.attrs.code || '').trim() }));
    });
    rows.sort((a, b) => (b.ts || '').localeCompare(a.ts || ''));
    return rows;
  }, [records]);

  // 입출고 로그 항목 수정/삭제 — txn 변경 후 해당 품목의 잔량·순재고를 시간순으로 재계산
  const recomputeItemFromTxns = (rec: any, txns: any[]) => {
    const sorted = [...txns].sort((a, b) => (a.ts || '').localeCompare(b.ts || ''));
    let bal = 0;
    sorted.forEach(t => { bal += (t.flow === 'OUT' ? -1 : 1) * (Math.abs(Number(t.qty)) || 0); t.balance = bal; });
    updateRecord(rec.id, { attrs: { ...rec.attrs, txns: sorted, qty: bal, flow: bal < 0 ? 'OUT' : 'IN' } });
  };
  const saveTxnEdit = (recId: string, txnId: string, changes: { flow?: 'IN' | 'OUT'; qty?: number; memo?: string }) => {
    const rec = records.find(r => r.id === recId);
    if (!rec) return;
    const txns = (rec.attrs.txns || []).map((t: any) => t.id === txnId ? { ...t, ...changes, qty: Math.abs(Number(changes.qty ?? t.qty)) || 0 } : t);
    recomputeItemFromTxns(rec, txns);
    reloadRecords();
    showToast('입출고 기록을 수정했습니다.');
  };
  const deleteTxn = (recId: string, txnId: string) => {
    const rec = records.find(r => r.id === recId);
    if (!rec) return;
    const txns = (rec.attrs.txns || []).filter((t: any) => t.id !== txnId);
    recomputeItemFromTxns(rec, txns);
    reloadRecords();
    showToast('입출고 기록을 삭제했습니다.');
  };

  // 입출고 로그 CSV 내보내기
  const exportTxnLog = () => {
    if (allTxns.length === 0) { showToast('내보낼 입출고 로그가 없습니다.'); return; }
    const header = ['일시', '구분', '품목코드', '품목명', '수량', '직후잔량', '보관위치', '담당자', '고객사', '메모'];
    const rows = allTxns.map(t => [
      t.ts ? format(parseISO(t.ts), 'yyyy-MM-dd HH:mm') : '',
      t.flow === 'OUT' ? '출고' : '입고',
      t.itemCode || '', t.itemTitle || '', t.qty ?? '', t.balance ?? '',
      t.loc || '', t.mgr || '', t.client || '', (t.memo || '').replace(/[\r\n]+/g, ' '),
    ]);
    const csv = '﻿' + [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `입출고로그_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    a.click(); URL.revokeObjectURL(url);
    showToast(`입출고 로그 ${allTxns.length}건을 내보냈습니다.`);
  };

  const reorderInventoryGroups = (fromKey: string, toKey: string) => {
    if (!fromKey || fromKey === toKey) return;
    const order = groupedInventories.map(g => g.code);
    const from = order.indexOf(fromKey);
    const to = order.indexOf(toKey);
    if (from < 0 || to < 0) return;
    order.splice(to, 0, order.splice(from, 1)[0]);
    let seq = 0;
    order.forEach(code => {
      const g = groupedInventories.find(x => x.code === code);
      g?.items.forEach(it => {
        updateRecord(it.id, { attrs: { ...it.attrs, sortOrder: seq++ } });
      });
    });
    reloadRecords();
    showToast('재고 순서를 변경했습니다.');
  };

  // 같은 그룹(동일 품목코드) 안에서 개별 항목 순서 변경
  const reorderInventoryItems = (fromId: string, toId: string) => {
    if (!fromId || fromId === toId) return;
    const codeOf = (it: any) => (it.attrs.code || '').trim() || `__no_code__${it.title}`;
    const from = inventory.find(i => i.id === fromId);
    const to = inventory.find(i => i.id === toId);
    if (!from || !to || codeOf(from) !== codeOf(to)) return; // 같은 그룹 내에서만
    const flat = groupedInventories.flatMap(g => g.items);
    const order = flat.map(i => i.id);
    const fi = order.indexOf(fromId), ti = order.indexOf(toId);
    if (fi < 0 || ti < 0) return;
    order.splice(ti, 0, order.splice(fi, 1)[0]);
    let seq = 0;
    order.forEach(id => {
      const it = flat.find(x => x.id === id);
      if (it) updateRecord(it.id, { attrs: { ...it.attrs, sortOrder: seq++ } });
    });
    reloadRecords();
    showToast('순서를 변경했습니다.');
  };

  const memosPerPage = appSettings.maxMemosShown || 3;
  const memoTotalPages = Math.ceil(memos.length / memosPerPage);
  const displayedMemos = memos.slice(memoPage * memosPerPage, (memoPage + 1) * memosPerPage);

  useEffect(() => {
    if (schedulePage >= scheduleTotalPages && scheduleTotalPages > 0) {
      setSchedulePage(scheduleTotalPages - 1);
    } else if (scheduleTotalPages === 0) {
      setSchedulePage(0);
    }
  }, [scheduleTotalPages, schedulePage]);

  useEffect(() => {
    if (inventoryPage >= inventoryTotalPages && inventoryTotalPages > 0) {
      setInventoryPage(inventoryTotalPages - 1);
    } else if (inventoryTotalPages === 0) {
      setInventoryPage(0);
    }
  }, [inventoryTotalPages, inventoryPage]);

  useEffect(() => {
    if (memoPage >= memoTotalPages && memoTotalPages > 0) {
      setMemoPage(memoTotalPages - 1);
    } else if (memoTotalPages === 0) {
      setMemoPage(0);
    }
  }, [memoTotalPages, memoPage]);

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
                const daySchedules = schedules.filter(s => s.attrs.date === dayStr);
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
              {/* 📊 엑셀 내보내기 버튼 */}
              <button 
                className="btn-ghost" 
                onClick={() => exportToCsv('event')}
                title="일정 엑셀 다운로드"
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
                onClick={() => printToPdf('event')}
                title="일정 PDF 인쇄"
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
                  color: 'var(--text-secondary)',
                  flexShrink: 0
                }}
              >
                <Sliders size={12} />
                <span className="btn-label-hide-md">카테고리 설정</span>
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
                    allDay: false,
                    memo: '',
                    completed: false,
                    notifyOffset: appSettings.defaultNotifyOffset ?? 0
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
                  color: 'var(--accent)',
                  flexShrink: 0
                }}
              >
                <Plus size={12} />
                <span className="btn-label-hide-sm">일정 등록</span>
              </button>
            </div>
          </div>

          {/* ⚙️ 일정 카테고리 기준 정보 설정 모달 */}
          <AnimatePresence>
            {isScheduleMasterSettingsOpen && (
              <div className="modal-overlay" onClick={() => { setIsScheduleMasterSettingsOpen(false); setEditingCategory(null); }}>
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
                    <button className="ios-text-btn" onClick={() => { setIsScheduleMasterSettingsOpen(false); setEditingCategory(null); }}>닫기</button>
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
                          onClick={() => addMasterScheduleCategory(newSchedCatInput, selectedCategoryColor)}
                          className="ghost-btn"
                          style={{ padding: '0.25rem 0.65rem', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          추가
                        </button>
                      </div>

                      {/* 색상 선택 */}
                      <div style={{ marginTop: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700 }}>카테고리 색상 지정</div>
                        <div className="premium-color-dot-container">
                          {[
                            '#007AFF', // Blue
                            '#34C759', // Green
                            '#AF52DE', // Purple
                            '#FF9500', // Orange
                            '#FF2D55', // Pink
                            '#5AC8FA', // Teal
                            '#FFCC00', // Yellow
                            '#5856D6', // Indigo
                            '#8E8E93', // Gray
                          ].map(color => {
                            const isSelected = selectedCategoryColor.toUpperCase() === color.toUpperCase();
                            const rgb = hexToRgb(color);
                            const isBright = rgb ? (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 180 : false;
                            return (
                              <button
                                key={color}
                                type="button"
                                onClick={() => setSelectedCategoryColor(color)}
                                className="premium-color-dot"
                                style={{
                                  backgroundColor: color,
                                  boxShadow: isSelected 
                                    ? `0 0 0 2.5px var(--bg-color), 0 0 0 5px ${color}, 0 4px 10px rgba(0,0,0,0.15)`
                                    : undefined,
                                  transform: isSelected ? 'scale(1.1)' : undefined,
                                }}
                                title={color}
                              >
                                {isSelected && (
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isBright ? '#000000' : '#FFFFFF'} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                )}
                              </button>
                            );
                          })}
                          
                          {/* 커스텀 팔레트 (color input) */}
                          <div style={{ position: 'relative', display: 'inline-block', width: '26px', height: '26px' }}>
                            <input
                              type="color"
                              value={
                                [
                                  '#007AFF', '#34C759', '#AF52DE', '#FF9500', '#FF2D55', '#5AC8FA', '#FFCC00', '#5856D6', '#8E8E93'
                                ].includes(selectedCategoryColor.toUpperCase()) ? '#AF52DE' : selectedCategoryColor
                              }
                              onChange={(e) => {
                                setSelectedCategoryColor(e.target.value);
                              }}
                              style={{
                                opacity: 0,
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                cursor: 'pointer',
                                zIndex: 2
                              }}
                              title="직접 지정"
                            />
                            {(() => {
                              const isCustomSelected = ![
                                '#007AFF', '#34C759', '#AF52DE', '#FF9500', '#FF2D55', '#5AC8FA', '#FFCC00', '#5856D6', '#8E8E93'
                              ].includes(selectedCategoryColor.toUpperCase());
                              const rgb = isCustomSelected ? hexToRgb(selectedCategoryColor) : null;
                              const isBright = rgb ? (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 180 : false;
                              
                              return (
                                <div
                                  className="premium-color-dot"
                                  style={{
                                    width: '26px',
                                    height: '26px',
                                    background: isCustomSelected 
                                      ? selectedCategoryColor 
                                      : 'conic-gradient(from 0deg, #ff3b30, #ff9500, #ffcc00, #34c759, #007aff, #5856d6, #ff2d55, #ff3b30)',
                                    boxShadow: isCustomSelected 
                                      ? `0 0 0 2.5px var(--bg-color), 0 0 0 5px ${selectedCategoryColor}, 0 4px 10px rgba(0,0,0,0.15)`
                                      : undefined,
                                    transform: isCustomSelected ? 'scale(1.1)' : undefined,
                                    pointerEvents: 'none',
                                  }}
                                >
                                  {isCustomSelected ? (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isBright ? '#000000' : '#FFFFFF'} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                  ) : (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}>
                                      <line x1="12" y1="5" x2="12" y2="19" />
                                      <line x1="5" y1="12" x2="19" y2="12" />
                                    </svg>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '1rem', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
                        {(appSettings.scheduleCategories || ['업무', '회의', '개인', '일반']).map(cat => {
                          const col = getCategoryColor(cat);
                          const bg = getCategorySoftBg(cat);
                          const border = getCategoryBorder(cat);
                          const isEditing = editingCategory === cat;

                          return (
                            <div
                              key={cat}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                background: 'var(--input-bg)',
                                border: '1px solid var(--panel-border)',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                transition: 'all 0.2s ease',
                                boxShadow: isEditing ? '0 4px 12px rgba(0,0,0,0.06)' : 'none',
                                transform: isEditing ? 'translateY(-1px)' : 'none',
                              }}
                            >
                              {/* Header Row */}
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '0.55rem 0.75rem',
                                  cursor: 'pointer',
                                }}
                                onClick={() => setEditingCategory(isEditing ? null : cat)}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  {/* Color Dot indicator */}
                                  <div
                                    style={{
                                      width: '10px',
                                      height: '10px',
                                      borderRadius: '50%',
                                      backgroundColor: col,
                                      border: `1px solid ${border}`,
                                    }}
                                  />
                                  <span
                                    style={{
                                      fontSize: '0.82rem',
                                      fontWeight: 600,
                                      color: 'var(--text-primary)',
                                    }}
                                  >
                                    {cat}
                                  </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={e => e.stopPropagation()}>
                                  {/* Edit Trigger Button */}
                                  <button
                                    type="button"
                                    onClick={() => setEditingCategory(isEditing ? null : cat)}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      cursor: 'pointer',
                                      color: isEditing ? 'var(--accent)' : 'var(--text-secondary)',
                                      padding: '0.2rem 0.4rem',
                                      fontSize: '0.72rem',
                                      fontWeight: 600,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.15rem'
                                    }}
                                  >
                                    <span>색상 지정</span>
                                    <ChevronDown
                                      size={12}
                                      style={{
                                        transform: isEditing ? 'rotate(180deg)' : 'none',
                                        transition: 'transform 0.2s ease',
                                        color: isEditing ? 'var(--accent)' : 'var(--text-secondary)'
                                      }}
                                    />
                                  </button>

                                  {/* Delete Button */}
                                  <button
                                    type="button"
                                    onClick={() => deleteMasterScheduleCategory(cat)}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      cursor: 'pointer',
                                      padding: '0.2rem',
                                      color: '#FF3B30',
                                      opacity: 0.8,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                    title={`${cat} 삭제`}
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              </div>

                              {/* Expanded Editor Drawer */}
                              <AnimatePresence initial={false}>
                                {isEditing && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.18, ease: 'easeInOut' }}
                                    style={{
                                      borderTop: '1px solid var(--panel-border)',
                                      background: 'var(--card-bg)',
                                      padding: '0.75rem',
                                    }}
                                  >
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                      {/* Preview Label */}
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700 }}>미리보기</span>
                                        <span
                                          className="badge"
                                          style={{ 
                                            padding: '0.2rem 0.5rem', 
                                            fontSize: '0.72rem', 
                                            borderRadius: '6px',
                                            background: bg,
                                            color: col,
                                            border: `1px solid ${border}`,
                                            fontWeight: 600,
                                          }}
                                        >
                                          {cat}
                                        </span>
                                      </div>

                                      {/* Preset Colors */}
                                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700, marginTop: '0.25rem' }}>색상 프리셋 지정</div>
                                      <div className="premium-color-dot-container">
                                        {[
                                          '#007AFF', // Blue
                                          '#34C759', // Green
                                          '#AF52DE', // Purple
                                          '#FF9500', // Orange
                                          '#FF2D55', // Pink
                                          '#5AC8FA', // Teal
                                          '#FFCC00', // Yellow
                                          '#5856D6', // Indigo
                                          '#8E8E93', // Gray
                                        ].map(color => {
                                          const isColorSelected = col.toUpperCase() === color.toUpperCase();
                                          const rgb = hexToRgb(color);
                                          const isBright = rgb ? (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 180 : false;
                                          return (
                                            <button
                                              key={color}
                                              type="button"
                                              onClick={() => {
                                                const colors = { ...(appSettings.categoryColors || {}) };
                                                colors[cat] = color;
                                                const updated = { ...appSettings, categoryColors: colors };
                                                handleSettingsChange(updated);
                                                showToast(`'${cat}' 카테고리 색상 변경 완료`);
                                              }}
                                              className="premium-color-dot"
                                              style={{
                                                backgroundColor: color,
                                                boxShadow: isColorSelected 
                                                  ? `0 0 0 2.5px var(--input-bg), 0 0 0 5px ${color}, 0 4px 10px rgba(0,0,0,0.15)`
                                                  : undefined,
                                                transform: isColorSelected ? 'scale(1.1)' : undefined,
                                              }}
                                              title={color}
                                            >
                                              {isColorSelected && (
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isBright ? '#000000' : '#FFFFFF'} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                                                  <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                              )}
                                            </button>
                                          );
                                        })}

                                        {/* Custom Color Input */}
                                        <div style={{ position: 'relative', display: 'inline-block', width: '26px', height: '26px' }}>
                                          <input
                                            type="color"
                                            value={col}
                                            onChange={(e) => {
                                              const newColor = e.target.value;
                                              const colors = { ...(appSettings.categoryColors || {}) };
                                              colors[cat] = newColor;
                                              const updated = { ...appSettings, categoryColors: colors };
                                              handleSettingsChange(updated);
                                              showToast(`'${cat}' 카테고리 색상 변경 완료`);
                                            }}
                                            style={{
                                              opacity: 0,
                                              position: 'absolute',
                                              top: 0,
                                              left: 0,
                                              width: '100%',
                                              height: '100%',
                                              cursor: 'pointer',
                                              zIndex: 2
                                            }}
                                            title="직접 지정"
                                          />
                                          {(() => {
                                            const isCustomSelected = ![
                                              '#007AFF', '#34C759', '#AF52DE', '#FF9500', '#FF2D55', '#5AC8FA', '#FFCC00', '#5856D6', '#8E8E93'
                                            ].includes(col.toUpperCase());
                                            const rgb = isCustomSelected ? hexToRgb(col) : null;
                                            const isBright = rgb ? (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 180 : false;
                                            
                                            return (
                                              <div
                                                className="premium-color-dot"
                                                style={{
                                                  width: '26px',
                                                  height: '26px',
                                                  background: isCustomSelected 
                                                    ? col 
                                                    : 'conic-gradient(from 0deg, #ff3b30, #ff9500, #ffcc00, #34c759, #007aff, #5856d6, #ff2d55, #ff3b30)',
                                                  boxShadow: isCustomSelected 
                                                    ? `0 0 0 2.5px var(--input-bg), 0 0 0 5px ${col}, 0 4px 10px rgba(0,0,0,0.15)`
                                                    : undefined,
                                                  transform: isCustomSelected ? 'scale(1.1)' : undefined,
                                                  pointerEvents: 'none',
                                                }}
                                              >
                                                {isCustomSelected ? (
                                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isBright ? '#000000' : '#FFFFFF'} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                                                    <polyline points="20 6 9 17 4 12" />
                                                  </svg>
                                                ) : (
                                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}>
                                                    <line x1="12" y1="5" x2="12" y2="19" />
                                                    <line x1="5" y1="12" x2="19" y2="12" />
                                                  </svg>
                                                )}
                                              </div>
                                            );
                                          })()}
                                        </div>
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 고객사 관리 (일정에서 주로 사용) */}
                    <div className="form-group" style={{ textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>
                        <span>고객사 관리</span>
                        <button
                          type="button"
                          onClick={() => handleSettingsChange({ ...appSettings, clientSort: clientSortDir === 'asc' ? 'desc' : 'asc' })}
                          title="가나다·ABC 정렬 방향"
                          style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.15rem 0.45rem', borderRadius: '6px', border: '1px solid var(--panel-border)', background: 'var(--panel-bg)', color: 'var(--text-secondary)', fontSize: '0.66rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          가나다 {clientSortDir === 'asc' ? '↑' : '↓'}
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <input
                          type="text"
                          placeholder="새 고객사 입력"
                          className="input-sm"
                          value={newClientInput}
                          onChange={e => setNewClientInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMasterClient(newClientInput); } }}
                          style={{ flex: 1, fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                        />
                        <button
                          type="button"
                          onClick={() => addMasterClient(newClientInput)}
                          className="ghost-btn"
                          style={{ padding: '0.25rem 0.65rem', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          추가
                        </button>
                      </div>
                      {(appSettings.clients || []).length === 0 ? (
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>등록된 고객사가 없습니다.</div>
                      ) : (
                        <div style={{ marginTop: '0.5rem', border: '1px solid var(--panel-border)', borderRadius: '10px', overflow: 'hidden', maxHeight: '220px', overflowY: 'auto' }}>
                          {sortedClients.map((client, ci) => (
                            <div
                              key={client}
                              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.6rem', borderTop: ci > 0 ? '1px solid var(--panel-border)' : 'none', background: 'var(--input-bg)' }}
                            >
                              <span style={{ fontSize: '0.66rem', fontFamily: 'monospace', color: 'var(--text-tertiary)', width: '1.4rem', flexShrink: 0 }}>{String(ci + 1).padStart(2, '0')}</span>
                              <span style={{ flex: 1, minWidth: 0, fontSize: '0.78rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client}</span>
                              <button
                                type="button"
                                onClick={() => deleteMasterClient(client)}
                                title="삭제"
                                style={{ flexShrink: 0, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex', alignItems: 'center', padding: '0.15rem' }}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
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
                      border: isSelected 
                        ? `1px solid ${cat === '전체' ? 'var(--accent-soft-border)' : getCategoryBorder(cat)}` 
                        : '1px solid var(--panel-border)',
                      background: isSelected 
                        ? (cat === '전체' ? 'var(--accent-soft-bg)' : getCategorySoftBg(cat)) 
                        : 'var(--panel-bg)',
                      color: isSelected 
                        ? (cat === '전체' ? 'var(--accent)' : getCategoryColor(cat)) 
                        : 'var(--text-secondary)',
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
                    {s.attrs.allDay ? (
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: 600, background: 'var(--hover-bg)', padding: '0.1rem 0.25rem', borderRadius: '4px', textAlign: 'center', whiteSpace: 'nowrap' }}>종일</span>
                    ) : s.attrs.time ? (
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>{s.attrs.time}</span>
                    ) : null}
                  </div>

                  {/* Col 4: Category badge (aligned right) */}
                  <div style={{ width: '55px', flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    {s.category && (
                      <span 
                        className="badge" 
                        style={{ 
                          fontSize: '0.55rem', 
                          padding: '0.1rem 0.35rem', 
                          borderRadius: '4px', 
                          fontWeight: 600, 
                          maxWidth: '50px', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis', 
                          whiteSpace: 'nowrap',
                          background: getCategorySoftBg(s.category),
                          color: getCategoryColor(s.category),
                          border: `1px solid ${getCategoryBorder(s.category)}`
                        }}
                      >
                        {s.category}
                      </span>
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
                  <button className="ghost-btn" onClick={(e) => { e.stopPropagation(); handleDuplicateSchedule(s.id); }}>복제</button>
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
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', position: 'relative' }}>
              {/* ➕ 재고 등록 (주요 동작) */}
              <button
                className="btn-ghost"
                onClick={() => setEditingInventory({
                  id: '', title: '', type: 'asset', category: '재고',
                  attrs: { code: '', qty: 1, flow: 'IN', loc: '', mgr: '', serial: '', memo: '' },
                  updatedAt: new Date().toISOString()
                })}
                title="재고 등록"
                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.35rem 0.7rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, border: '1px solid var(--accent-soft-border)', background: 'var(--accent-soft-bg)', color: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }}
              >
                <Plus size={14} /> 등록
              </button>

              {/* ⋯ 더보기 — 나머지 기능을 메뉴로 묶음 */}
              <button
                className="btn-ghost"
                onClick={() => setIsInvMenuOpen(o => !o)}
                title="더보기"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.35rem', width: '2rem', height: '2rem', borderRadius: '8px', border: '1px solid var(--panel-border)', background: isInvMenuOpen ? 'var(--hover-bg)' : 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0 }}
              >
                <MoreHorizontal size={16} />
              </button>

              {isInvMenuOpen && (
                <>
                  <div onClick={() => setIsInvMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.4rem', zIndex: 50, minWidth: '200px', background: 'var(--panel-bg)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: '1px solid var(--panel-border)', borderRadius: '12px', boxShadow: '0 10px 30px var(--shadow-color)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {([
                      { icon: <ListPlus size={14} />, label: '일괄 등록', on: () => { setIsBulkModalOpen(true); setBulkRows([]); setPasteText(''); setCreateMemo(false); setMemoTitle(''); setMemoContent(''); setIsMemoCustom(false); } },
                      { icon: <ClipboardList size={14} />, label: '입출고 로그', on: () => setIsTxnLogOpen(true) },
                      { icon: <ArrowDownUp size={14} />, label: `정렬: ${inventorySort === 'manual' ? '수동(드래그)' : inventorySort === 'asc' ? '코드 오름차순' : '코드 내림차순'}`, on: () => handleSettingsChange({ ...appSettings, inventorySort: inventorySort === 'manual' ? 'asc' : inventorySort === 'asc' ? 'desc' : 'manual' }), keepOpen: true },
                      { icon: <Layers size={14} />, label: '중복 합치기', on: () => { if (confirm('같은 품목코드+품목명으로 따로 등록된 재고를 하나로 합치고 수량을 합산합니다. 진행할까요?')) consolidateInventory(); } },
                      { icon: <Sliders size={14} />, label: '기준 정보 관리', on: () => setIsMasterSettingsOpen(true) },
                      { icon: <FileSpreadsheet size={14} />, label: 'Excel 내보내기', on: () => exportToCsv('asset') },
                      { icon: <Printer size={14} />, label: 'PDF 인쇄', on: () => printToPdf('asset') },
                    ] as { icon: React.ReactNode; label: string; on: () => void; keepOpen?: boolean }[]).map((m, mi) => (
                      <button
                        key={mi}
                        onClick={() => { m.on(); if (!m.keepOpen) setIsInvMenuOpen(false); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', width: '100%', padding: '0.6rem 0.8rem', border: 'none', borderTop: mi > 0 ? '1px solid var(--panel-border)' : 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 600, textAlign: 'left', cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <span style={{ color: 'var(--text-tertiary)', display: 'flex', flexShrink: 0 }}>{m.icon}</span>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
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

          {/* 📜 입출고 로그 모달 */}
          <AnimatePresence>
            {isTxnLogOpen && (
              <div className="modal-overlay" onClick={() => setIsTxnLogOpen(false)}>
                <motion.div
                  className="modal-content"
                  onClick={e => e.stopPropagation()}
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  style={{ maxWidth: '480px', width: '95%' }}
                >
                  <div className="ios-modal-header">
                    <button className="ios-text-btn" onClick={() => setIsTxnLogOpen(false)}>닫기</button>
                    <div className="ios-modal-title">입출고 로그</div>
                    <button className="ios-text-btn bold" onClick={exportTxnLog}>CSV</button>
                  </div>

                  <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', margin: '0.2rem 0 0.5rem' }}>
                    전체 {allTxns.length}건 · 최신순
                  </div>

                  {allTxns.length === 0 ? (
                    <div className="empty-box" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>입출고 기록이 없습니다.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '60vh', overflowY: 'auto' }}>
                      {allTxns.map((t, i) => {
                        const isEditing = editingTxnId === t.id;
                        return (
                        <div key={t.id || i} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '0.5rem 0.6rem', borderRadius: '10px', background: 'var(--surface-elevated)', border: '1px solid var(--surface-elevated-border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="badge" style={{ flexShrink: 0, fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.35rem', borderRadius: '4px', background: t.flow === 'OUT' ? 'var(--danger-soft-bg)' : 'var(--success-soft-bg)', color: t.flow === 'OUT' ? 'var(--danger)' : 'var(--success)' }}>
                              {t.flow === 'OUT' ? '출고' : '입고'}
                            </span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, flexShrink: 0, color: t.flow === 'OUT' ? 'var(--danger)' : 'var(--success)', width: '3rem' }}>
                              {t.flow === 'OUT' ? '-' : '+'}{t.qty}개
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', minWidth: 0 }}>
                                {t.itemCode && <span style={{ fontSize: '0.6rem', fontFamily: 'monospace', color: 'var(--accent)', flexShrink: 0 }}>{t.itemCode}</span>}
                                <span style={{ fontSize: '0.76rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.itemTitle}</span>
                              </div>
                              <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {[t.client, t.mgr, t.loc].filter(Boolean).join(' · ')}{(t.client || t.mgr || t.loc) ? ' · ' : ''}잔량 {t.balance}개{t.ts ? ` · ${format(parseISO(t.ts), 'MM.dd HH:mm')}` : ''}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => { if (isEditing) { setEditingTxnId(null); } else { setEditingTxnId(t.id); setTxnDraft({ flow: t.flow === 'OUT' ? 'OUT' : 'IN', qty: Math.abs(Number(t.qty)) || 0, memo: t.memo || '' }); } }}
                              style={{ flexShrink: 0, background: 'transparent', border: '1px solid var(--panel-border)', borderRadius: '6px', padding: '0.15rem 0.4rem', fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer' }}
                            >
                              {isEditing ? '닫기' : '수정'}
                            </button>
                          </div>

                          {isEditing && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid var(--panel-border)' }}>
                              <select className="input-sm" style={{ width: 'auto', flexShrink: 0, fontWeight: 700, color: txnDraft.flow === 'IN' ? 'var(--success)' : 'var(--danger)' }} value={txnDraft.flow} onChange={e => setTxnDraft({ ...txnDraft, flow: e.target.value as 'IN' | 'OUT' })}>
                                <option value="IN">입고</option>
                                <option value="OUT">출고</option>
                              </select>
                              <input type="number" min="0" className="input-sm" style={{ width: '5rem', flexShrink: 0 }} value={txnDraft.qty} onChange={e => setTxnDraft({ ...txnDraft, qty: Math.max(0, parseInt(e.target.value, 10) || 0) })} />
                              <input type="text" className="input-sm" style={{ flex: 1, minWidth: '6rem' }} placeholder="메모" value={txnDraft.memo} onChange={e => setTxnDraft({ ...txnDraft, memo: e.target.value })} />
                              <button type="button" onClick={() => { saveTxnEdit(t.recId, t.id, txnDraft); setEditingTxnId(null); }} style={{ flexShrink: 0, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.3rem 0.6rem', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>저장</button>
                              <button type="button" onClick={() => { if (confirm('이 입출고 기록을 삭제할까요? 해당 품목 수량이 다시 계산됩니다.')) { deleteTxn(t.recId, t.id); setEditingTxnId(null); } }} style={{ flexShrink: 0, background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger-soft-border)', borderRadius: '6px', padding: '0.3rem 0.6rem', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>삭제</button>
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* 📦 재고 일괄 등록 모달 */}
          <AnimatePresence>
            {isBulkModalOpen && (
              <div className="modal-overlay" onClick={() => setIsBulkModalOpen(false)}>
                <motion.div 
                  className="modal-content"
                  onClick={e => e.stopPropagation()}
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  style={{ 
                    maxWidth: '480px', 
                    width: '95%'
                  }}
                >
                  <div className="ios-modal-header">
                    <button className="ios-text-btn" onClick={() => setIsBulkModalOpen(false)}>취소</button>
                    <div className="ios-modal-title">재고 일괄 등록</div>
                    <button className="ios-text-btn bold" onClick={submitBulkInventory}>저장</button>
                  </div>

                  {/* 📋 복사 / 붙여넣기 파싱 영역 */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem',
                    background: 'var(--surface-elevated)',
                    padding: '0.9rem',
                    borderRadius: '14px',
                    border: '1px solid var(--surface-elevated-border)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)' }}>Excel / 마크다운 분석</span>
                      <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-soft-bg)', border: '1px solid var(--accent-soft-border)', padding: '0.1rem 0.4rem', borderRadius: '6px' }}>
                        CSV · TSV · MD
                      </span>
                    </div>
                    <div style={{ fontSize: '0.66rem', color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
                      순서: 코드 · 품목명 · 수량 · 구분 · 보관위치 · 담당자 · 메모
                    </div>

                    <textarea
                      placeholder="복사한 데이터를 붙여넣으세요. 구분 기호와 표 헤더는 자동 제외됩니다."
                      value={pasteText}
                      onChange={e => setPasteText(e.target.value)}
                      className="input-sm"
                      style={{
                        height: '84px',
                        resize: 'vertical',
                        fontFamily: 'var(--font-mono, SFMono-Regular, Consolas, Monaco, monospace)',
                        fontSize: '0.74rem',
                        lineHeight: '1.45',
                        background: 'var(--input-bg)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--panel-border)',
                        borderRadius: '10px',
                        padding: '0.6rem'
                      }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-tertiary)', fontSize: '0.66rem', lineHeight: 1.4 }}>
                      <span>💡</span>
                      <span>시리얼 감지 시 품목코드·시리얼이 자동 분류되어 개별 등록됩니다.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => parsePasteData(pasteText)}
                      style={{
                        width: '100%',
                        height: '38px',
                        fontSize: '0.8rem',
                        borderRadius: '10px',
                        fontWeight: 700,
                        background: 'var(--accent)',
                        color: '#ffffff',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--accent)'}
                    >
                      분석 적용
                    </button>
                  </div>

                  {/* 📊 등록 대기 목록 헤더 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)' }}>등록 대기 목록</span>
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-secondary)', background: 'var(--hover-bg)', padding: '0.1rem 0.4rem', borderRadius: '6px' }}>
                        {bulkRows.length}개
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBulkRows([])}
                      disabled={bulkRows.length === 0}
                      style={{
                        fontSize: '0.7rem',
                        padding: '0.25rem 0.6rem',
                        borderRadius: '8px',
                        border: '1px solid var(--danger-soft-border)',
                        background: 'transparent',
                        color: 'var(--danger)',
                        fontWeight: 700,
                        opacity: bulkRows.length > 0 ? 1 : 0.4,
                        cursor: bulkRows.length > 0 ? 'pointer' : 'not-allowed',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      전체 비우기
                    </button>
                  </div>

                  {/* 📦 카드형 편집 리스트 (좁은 위젯 폭에 맞춘 세로 레이아웃) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '320px', overflowY: 'auto', paddingRight: '2px' }}>
                    {bulkRows.length === 0 ? (
                      <div style={{
                        padding: '2.5rem 1rem',
                        textAlign: 'center',
                        border: '1px dashed var(--panel-border)',
                        borderRadius: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.4rem'
                      }}>
                        <span style={{ fontSize: '1.5rem' }}>📦</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>대기 중인 품목이 없습니다.</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>위 영역에 붙여넣거나 '새 행 추가'를 누르세요.</span>
                      </div>
                    ) : (
                      bulkRows.map((row, idx) => (
                        <div key={idx} style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem',
                          padding: '0.8rem',
                          background: 'var(--surface-elevated)',
                          border: '1px solid var(--surface-elevated-border)',
                          borderRadius: '14px'
                        }}>
                          {/* 헤더: 번호 + 품목명(필수) + 삭제 */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.66rem', fontWeight: 800, color: 'var(--text-tertiary)', flexShrink: 0 }}>#{String(idx + 1).padStart(2, '0')}</span>
                            <input
                              type="text"
                              className="input-sm"
                              style={{ flex: 1, minWidth: 0, fontWeight: 600, border: !row.title.trim() ? '1.5px solid var(--danger)' : undefined }}
                              value={row.title}
                              placeholder="품목명 (필수)"
                              onChange={e => updateRow(idx, 'title', e.target.value)}
                            />
                            <button
                              type="button"
                              onClick={() => deleteRow(idx)}
                              style={{ flexShrink: 0, padding: '0.35rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                              title="삭제"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          {/* 2열 그리드: 코드 · 시리얼 · 수량 · 구분 · 보관위치 · 담당자 */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                            <input type="text" className="input-sm" value={row.code} placeholder="코드" onChange={e => updateRow(idx, 'code', e.target.value)} />
                            <input type="text" className="input-sm" value={row.serial || ''} placeholder="시리얼" onChange={e => updateRow(idx, 'serial', e.target.value)} />
                            <input type="number" className="input-sm" value={row.qty} min="1" placeholder="수량" onChange={e => updateRow(idx, 'qty', Math.max(1, parseInt(e.target.value, 10) || 1))} />
                            <select className="input-sm" style={{ color: row.flow === 'IN' ? 'var(--success)' : 'var(--danger)', fontWeight: 700, cursor: 'pointer' }} value={row.flow} onChange={e => updateRow(idx, 'flow', e.target.value as 'IN' | 'OUT')}>
                              <option value="IN">입고 (+)</option>
                              <option value="OUT">출고 (-)</option>
                            </select>
                            <select className="input-sm" style={{ cursor: 'pointer' }} value={row.loc} onChange={e => updateRow(idx, 'loc', e.target.value)}>
                              {locations.map(loc => (<option key={loc} value={loc}>{loc}</option>))}
                            </select>
                            <select className="input-sm" style={{ cursor: 'pointer' }} value={row.mgr} onChange={e => updateRow(idx, 'mgr', e.target.value)}>
                              {managers.map(mgr => (<option key={mgr} value={mgr}>{mgr}</option>))}
                            </select>
                          </div>

                          {/* 메모 */}
                          <input type="text" className="input-sm" style={{ width: '100%' }} value={row.memo} placeholder="비고 / 메모" onChange={e => updateRow(idx, 'memo', e.target.value)} />
                        </div>
                      ))
                    )}
                  </div>

                  {/* 행 추가 버튼 */}
                  <button
                    type="button"
                    onClick={addNewRow}
                    className="ghost-btn"
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.3rem', 
                      fontSize: '0.75rem', 
                      padding: '0.4rem 0.8rem',
                      alignSelf: 'flex-start',
                      fontWeight: 700,
                      borderRadius: '8px',
                      border: '1px solid var(--panel-border)',
                      background: 'var(--panel-bg)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'var(--accent-soft-bg)';
                      e.currentTarget.style.color = 'var(--accent)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'var(--panel-bg)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }}
                  >
                    <Plus size={13} />
                    <span>새 행 추가</span>
                  </button>

                  {/* 🔗 통합 메모 작성 연동 */}
                  <div style={{ 
                    borderTop: '1px solid var(--panel-border)', 
                    marginTop: '0.4rem', 
                    paddingTop: '0.8rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem'
                  }}>
                    <label className="custom-checkbox" style={{ alignSelf: 'flex-start' }}>
                      <input 
                        type="checkbox" 
                        checked={createMemo} 
                        onChange={e => setCreateMemo(e.target.checked)} 
                      />
                      <span>이 일괄 처리 내역을 변동 사항 메모로 자동 생성하고 연동</span>
                    </label>

                    {createMemo && (
                      <motion.div 
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: '0.7rem', 
                          padding: '1.2rem',
                          background: 'var(--panel-bg)',
                          backdropFilter: 'var(--panel-blur)',
                          WebkitBackdropFilter: 'var(--panel-blur)',
                          borderRadius: '16px',
                          border: '1px solid var(--panel-border)',
                          boxShadow: '0 4px 12px var(--shadow-color)',
                          marginTop: '0.2rem'
                        }}
                      >
                        <div className="form-group">
                          <label className="form-label">메모 제목</label>
                          <input
                            type="text"
                            className="input-sm"
                            value={memoTitle}
                            onChange={e => setMemoTitle(e.target.value)}
                            placeholder="일괄 재고 처리 메모 제목"
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">메모 내용 (자동 생성됨, 수정 가능)</label>
                          <textarea
                            className="input-sm"
                            style={{ 
                              minHeight: '100px', 
                              fontFamily: 'monospace', 
                              resize: 'vertical'
                            }}
                            value={memoContent}
                            onChange={e => {
                              setMemoContent(e.target.value);
                              setIsMemoCustom(true);
                            }}
                            placeholder="이곳에 일괄 재고 변동 내역의 추가 메모 사항을 남기세요."
                          />
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Local Inventory Category Horizon Filtering Bar - Show ONLY when custom categories exist! */}
          {/* 총 재고 / 보유 / 소진·부족 현황 세그먼트 (현재 수량 기준) */}
          {(() => {
            const catFiltered = selectedInventoryCategory === '전체' ? inventory : inventory.filter(i => i.category === selectedInventoryCategory);
            const counts = {
              all: catFiltered.length,
              IN: catFiltered.filter(i => (Number(i.attrs.qty) || 0) > 0).length,
              OUT: catFiltered.filter(i => (Number(i.attrs.qty) || 0) <= 0).length,
            };
            const views: { key: 'all' | 'IN' | 'OUT'; label: string }[] = [
              { key: 'all', label: '총 재고' },
              { key: 'IN', label: '보유 중' },
              { key: 'OUT', label: '소진·부족' },
            ];
            return (
              <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.6rem' }}>
                {views.map(v => {
                  const sel = inventoryFlowView === v.key;
                  return (
                    <button
                      key={v.key}
                      onClick={() => { setInventoryFlowView(v.key); setInventoryPage(0); }}
                      style={{
                        flex: 1, fontSize: '0.74rem', fontWeight: 700, padding: '0.4rem 0.3rem', borderRadius: '10px', cursor: 'pointer',
                        border: sel ? '1px solid var(--accent-soft-border)' : '1px solid var(--panel-border)',
                        background: sel ? 'var(--accent-soft-bg)' : 'var(--panel-bg)',
                        color: sel ? 'var(--accent)' : 'var(--text-secondary)',
                        transition: 'all 0.15s ease', whiteSpace: 'nowrap'
                      }}
                    >
                      {v.label}
                      <span style={{ marginLeft: '0.25rem', fontSize: '0.66rem', opacity: 0.7 }}>{counts[v.key]}</span>
                    </button>
                  );
                })}
              </div>
            );
          })()}

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
              {paginatedGroups.map((group, groupIdx) => {
                const groupOrderNum = `#${String(inventoryPage * inventoryPerPage + groupIdx + 1).padStart(2, '0')}`;
                const hasNoCode = group.code.startsWith('__no_code__');
                const isSingleItem = group.items.length === 1;
                const groupHasDanger = group.items.some(it => (Number(it.attrs.qty) || 0) < 0);
                const showGroupHeader = !hasNoCode && !isSingleItem;
                const isCollapsed = showGroupHeader && collapsedGroups.has(group.code);
                return (
                <div
                  key={group.code}
                  onDragOver={e => { const k = dragKeyRef.current; if (k && k !== group.code) e.preventDefault(); }}
                  onDrop={e => { e.preventDefault(); const k = dragKeyRef.current; if (k) reorderInventoryGroups(k, group.code); dragKeyRef.current = null; setDragKey(null); }}
                  style={{ display: 'flex', alignItems: 'stretch', gap: '0.4rem', opacity: dragKey === group.code ? 0.45 : 1, transition: 'opacity 0.15s ease' }}
                >
                  {/* ☰ 드래그 핸들 — 잡고 위/아래로 옮기면 순서 변경 */}
                  <div
                    draggable
                    onDragStart={e => { dragKeyRef.current = group.code; setDragKey(group.code); try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', group.code); } catch {} }}
                    onDragEnd={() => { dragKeyRef.current = null; setDragKey(null); }}
                    onClick={e => e.stopPropagation()}
                    title="드래그하여 순서 변경"
                    style={{ flexShrink: 0, alignSelf: 'center', padding: '0.25rem', cursor: 'grab', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', touchAction: 'none' }}
                  >
                    <Menu size={16} />
                  </div>
                  <div
                    style={showGroupHeader ? {
                      flex: 1,
                      minWidth: 0,
                      border: groupHasDanger ? '1px solid var(--danger-soft-border)' : '1px solid var(--panel-border)',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      background: 'var(--surface-elevated)'
                    } : { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
                  >
                  {showGroupHeader && (
                    <div
                      onClick={() => toggleGroupCollapse(group.code)}
                      title={isCollapsed ? '펼치기' : '접기'}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.9rem', borderBottom: isCollapsed ? 'none' : '1px solid var(--panel-border)', background: 'var(--hover-bg)', cursor: 'pointer', userSelect: 'none' }}
                    >
                      <ChevronDown size={14} style={{ flexShrink: 0, color: 'var(--text-tertiary)', transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s ease' }} />
                      <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--text-tertiary)', flexShrink: 0 }}>{groupOrderNum}</span>
                      <span className="badge" style={{ background: 'var(--accent-soft-bg)', color: 'var(--accent)', border: '1px solid var(--accent-soft-border)', fontSize: '0.68rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '5px', flexShrink: 0 }}>{group.label}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginLeft: 'auto', fontWeight: 600 }}>{group.items.length}종</span>
                      {groupHasDanger && (
                        <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', background: 'var(--danger-soft-bg)', color: 'var(--danger)', border: '1px solid var(--danger-soft-border)', fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.35rem', borderRadius: '4px', flexShrink: 0 }}>
                          <AlertTriangle size={9} />위험 재고 포함
                        </span>
                      )}
                    </div>
                  )}
                  <div style={{ ...(showGroupHeader ? { display: isCollapsed ? 'none' : 'flex', flexDirection: 'column' } : { display: 'contents' }) }}>
                  {group.items.map((item) => {
                const qtyNum = Number(item.attrs.qty) || 0;
                const isNegative = qtyNum < 0;
                return (
                <div
                  key={item.id}
                  className={showGroupHeader ? 'inv-row' : 'card card-compact'}
                  onDragOver={showGroupHeader ? (e => { const k = dragItemRef.current; if (k && k !== item.id) e.preventDefault(); }) : undefined}
                  onDrop={showGroupHeader ? (e => { e.preventDefault(); const k = dragItemRef.current; if (k) reorderInventoryItems(k, item.id); dragItemRef.current = null; setDragItemId(null); }) : undefined}
                  style={showGroupHeader ? {
                    padding: '0.9rem',
                    borderTop: '1px solid var(--panel-border)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                    position: 'relative',
                    opacity: dragItemId === item.id ? 0.45 : 1,
                    background: isNegative ? 'var(--danger-tint)' : 'transparent'
                  } : {
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
                    {/* 그룹 내 항목 드래그 핸들 (사이즈별 순서 변경) */}
                    {showGroupHeader && (
                      <div
                        draggable
                        onDragStart={e => { dragItemRef.current = item.id; setDragItemId(item.id); try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', item.id); } catch {} e.stopPropagation(); }}
                        onDragEnd={() => { dragItemRef.current = null; setDragItemId(null); }}
                        onClick={e => e.stopPropagation()}
                        title="드래그하여 순서 변경"
                        style={{ flexShrink: 0, marginRight: '0.3rem', padding: '0.15rem', cursor: 'grab', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}
                      >
                        <Menu size={13} />
                      </div>
                    )}
                    {/* Col 1: Index + Package Icon */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '3.1rem', flexShrink: 0 }}>
                      <span className="text-xs font-mono text-gray-400" style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#9ca3af' }}>
                        {showGroupHeader ? '' : groupOrderNum}
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
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: 'block',
                          width: '100%'
                        }}
                        title={item.title}
                      >
                        {item.title}
                      </span>
                    </div>

                    {/* Col 4: 재고 상태 뱃지 (보유/소진/부족) — 마지막 이동이 아니라 현재 수량 기준 */}
                    <div style={{ width: '55px', flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      {(() => {
                        const isOut = qtyNum < 0;
                        const isZero = qtyNum === 0;
                        const label = isOut ? '부족' : isZero ? '소진' : '보유';
                        const color = isOut ? 'var(--danger)' : isZero ? 'var(--text-tertiary)' : 'var(--success)';
                        const bg = isOut ? 'var(--danger-soft-bg)' : isZero ? 'var(--hover-bg)' : 'var(--success-soft-bg)';
                        const bd = isOut ? 'var(--danger-soft-border)' : isZero ? 'var(--panel-border)' : 'var(--success-soft-border)';
                        return (
                          <span className="badge" style={{ background: bg, color, border: `1px solid ${bd}`, fontSize: '0.6rem', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 600 }}>
                            {label}
                          </span>
                        );
                      })()}
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
                      {isNegative && (
                        <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', background: 'var(--danger-soft-bg)', color: 'var(--danger)', border: '1px solid var(--danger-soft-border)', fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                          <AlertTriangle size={9} />위험 재고
                        </span>
                      )}
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
                      {item.attrs.client && (
                        <>
                          <span className="badge" style={{ background: 'var(--hover-bg)', color: 'var(--text-secondary)', border: '1px solid var(--panel-border)', fontSize: '0.6rem', fontWeight: 600, padding: '0.1rem 0.3rem', borderRadius: '4px' }}>{item.attrs.client}</span>
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
                    <button className="ghost-btn" onClick={(e) => { e.stopPropagation(); handleDuplicateInventory(item.id); }}>복제</button>
                    <button className="ghost-btn danger" onClick={(e) => { e.stopPropagation(); deleteInventoryItem(item.id); }}>삭제</button>
                  </div>
                </div>
                );
                  })}
                  </div>
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
                          border: isSelected ? `1px solid ${getCategoryBorder(cat)}` : '1px solid var(--panel-border)',
                          background: isSelected ? getCategorySoftBg(cat) : 'var(--surface-color)',
                          color: isSelected ? getCategoryColor(cat) : 'var(--text-secondary)',
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
              
              {/* 고객사 선택 */}
              <ClientPicker
                value={editingSchedule.attrs.client || ''}
                clients={sortedClients}
                onChange={v => setEditingSchedule({ ...editingSchedule, attrs: { ...editingSchedule.attrs, client: v } })}
              />

              <div style={{ display: 'flex', gap: '0.8rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', height: '22px' }}>
                    <span className="form-label">날짜<span className="req-star">*</span></span>
                  </div>
                  <CustomDatePicker value={editingSchedule.attrs.date || ''} onChange={date => setEditingSchedule({...editingSchedule, attrs: { ...editingSchedule.attrs, date }})} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '22px' }}>
                    <span className="form-label">시간</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', transform: 'scale(0.85)', transformOrigin: 'right center' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>하루 종일</span>
                      <button
                        type="button"
                        className={`ios-toggle ${editingSchedule.attrs.allDay ? 'on' : ''}`}
                        aria-pressed={!!editingSchedule.attrs.allDay}
                        onClick={() => setEditingSchedule({ ...editingSchedule, attrs: { ...editingSchedule.attrs, allDay: !editingSchedule.attrs.allDay } })}
                      >
                        <span className="ios-toggle-knob" />
                      </button>
                    </div>
                  </div>
                  {editingSchedule.attrs.allDay ? (
                    <div style={{
                      height: '38px',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 0.65rem',
                      borderRadius: '10px',
                      border: '1px solid var(--panel-border)',
                      background: 'var(--hover-bg)',
                      color: 'var(--text-tertiary)',
                      fontSize: '0.78rem',
                      fontWeight: 600
                    }}>
                      하루 종일
                    </div>
                  ) : (
                    <CustomTimePicker value={editingSchedule.attrs.time || '12:00'} onChange={time => setEditingSchedule({...editingSchedule, attrs: { ...editingSchedule.attrs, time }})} />
                  )}
                </div>
              </div>
              
              <div className="form-group">
                <span className="form-label">메모</span>
                <textarea rows={4} className="input-sm" value={editingSchedule.attrs.memo || ''} onChange={e => setEditingSchedule({...editingSchedule, attrs: { ...editingSchedule.attrs, memo: e.target.value }})} />
              </div>
              
              <div style={{ display: 'flex', gap: '0.8rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <span className="form-label">알림 설정</span>
                  <CustomSelect
                    value={editingSchedule.attrs.notifyOffset ?? appSettings.defaultNotifyOffset ?? 0}
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
              
              {/* 📦 이 일정에서 재고 입출고 기록 — 특정 품목을 선택해 즉시 입·출고 처리하고 메모를 남긴다 */}
              <div className="form-group" style={{ marginTop: '0.6rem' }}>
                <span className="form-label">이 일정에서 재고 입출고</span>
                {records.filter(r => r.type === 'asset').length === 0 ? (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', paddingLeft: '0.2rem' }}>등록된 재고가 없습니다.</span>
                ) : (
                  <>
                    <CustomSelect
                      value={schedInv.assetId}
                      placeholder="품목 선택"
                      options={[
                        { value: '', label: '품목 선택' },
                        ...records.filter(r => r.type === 'asset').map(r => ({
                          value: r.id,
                          label: `${r.attrs.code ? '[' + r.attrs.code + '] ' : ''}${r.title} (${Number(r.attrs.qty) || 0}개)`
                        }))
                      ]}
                      onChange={val => setSchedInv({ ...schedInv, assetId: val })}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.45rem' }}>
                      <input type="number" min={1} className="input-sm" style={{ flex: 1 }} value={schedInv.qty}
                        onChange={e => setSchedInv({ ...schedInv, qty: Number(e.target.value) })} />
                      <div style={{ width: '120px' }}>
                        <CustomSelect value={schedInv.flow}
                          options={[{ value: 'IN', label: '입고' }, { value: 'OUT', label: '출고' }]}
                          onChange={val => setSchedInv({ ...schedInv, flow: val as 'IN' | 'OUT' })} />
                      </div>
                    </div>
                    <input type="text" className="input-sm" placeholder="메모(선택)" style={{ marginTop: '0.45rem' }}
                      value={schedInv.memo} onChange={e => setSchedInv({ ...schedInv, memo: e.target.value })} />
                    <button type="button" className="ghost-btn" style={{ marginTop: '0.5rem', width: '100%' }}
                      onClick={() => {
                        const asset = records.find(r => r.id === schedInv.assetId && r.type === 'asset');
                        if (!asset) { showToast('품목을 선택하세요.'); return; }
                        const q = Math.abs(Number(schedInv.qty) || 0);
                        if (q <= 0) { showToast('수량을 입력하세요.'); return; }
                        addRecord({
                          title: asset.title,
                          type: 'asset',
                          category: asset.category || '재고',
                          attrs: {
                            code: asset.attrs.code || '',
                            qty: q,
                            flow: schedInv.flow,
                            loc: asset.attrs.loc,
                            mgr: asset.attrs.mgr,
                            client: editingSchedule.attrs.client || asset.attrs.client,
                            memo: `[일정] ${editingSchedule.title}${schedInv.memo ? ' · ' + schedInv.memo : ''}`,
                          }
                        });
                        const linked = editingSchedule.attrs.linkedIds || [];
                        if (!linked.includes(asset.id)) {
                          setEditingSchedule({ ...editingSchedule, attrs: { ...editingSchedule.attrs, linkedIds: [...linked, asset.id] } });
                        }
                        reloadRecords();
                        logActivity('UPDATE_INV', '일정 연동 입출고', `${asset.title} ${schedInv.flow === 'OUT' ? '출고' : '입고'} ${q}개`);
                        showToast(`${asset.title} ${schedInv.flow === 'OUT' ? '출고' : '입고'} ${q}개 기록됨`);
                        setSchedInv({ assetId: '', qty: 1, flow: 'OUT', memo: '' });
                      }}
                    >
                      재고 기록
                    </button>
                  </>
                )}
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

              {/* 📷 카메라 라벨 스캔 — 모델명(코드)/사이즈(품목명)/시리얼을 찍어 자동 입력 */}
              <CameraScan
                onApply={fields => setEditingInventory({
                  ...editingInventory,
                  ...(fields.title ? { title: fields.title } : {}),
                  attrs: {
                    ...editingInventory.attrs,
                    ...(fields.code ? { code: fields.code } : {}),
                    ...(fields.serial ? { serial: fields.serial } : {}),
                  },
                })}
              />

              {/* 품목코드 및 품목명 각각 독립된 세로 form-group 으로 배치하여 100% 화면에 핏(Fit)되도록 교정! */}
              <SearchSelect
                label="품목코드"
                required
                value={editingInventory.attrs.code || ''}
                options={knownCodes}
                placeholder="품목코드 검색 또는 입력"
                emptyText="기존 코드가 없습니다. 입력한 값으로 등록됩니다."
                onChange={code => {
                  const codeT = code.trim();
                  const names = namesByCode[codeT] || [];
                  const savedCat = categoryByCode[codeT];
                  setEditingInventory({
                    ...editingInventory,
                    // 코드에 저장된 카테고리 자동 선택
                    category: savedCat || editingInventory.category,
                    // 품목명: 이미 입력값이 있으면 유지, 없고 후보가 1개뿐이면 자동 채움(여러 개면 아래 드롭다운에서 선택)
                    title: editingInventory.title?.trim() ? editingInventory.title : (names.length === 1 ? names[0] : editingInventory.title),
                    attrs: { ...editingInventory.attrs, code },
                  });
                }}
              />

              <SearchSelect
                label="품목명"
                value={editingInventory.title}
                options={namesByCode[(editingInventory.attrs.code || '').trim()] || []}
                placeholder="품목명 검색 또는 입력"
                emptyText="이 코드로 등록된 품목명이 없습니다. 입력한 값으로 등록됩니다."
                onChange={t => setEditingInventory({ ...editingInventory, title: t })}
              />

              {/* Category Dropdown (Master Data Only) */}
              <div className="form-group">
                <span className="form-label">카테고리</span>
                <CustomSelect
                  value={editingInventory.category || ''}
                  options={[
                    { value: '', label: '' },
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

              {/* 고객사 선택 */}
              <ClientPicker
                value={editingInventory.attrs.client || ''}
                clients={sortedClients}
                onChange={v => setEditingInventory({ ...editingInventory, attrs: { ...editingInventory.attrs, client: v } })}
              />

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
                <span className="form-label">메모</span>
                <textarea
                  rows={5}
                  className="input-sm"
                  placeholder=""
                  style={{ resize: 'vertical', lineHeight: 1.5, fontSize: '0.85rem' }}
                  value={editingInventory.attrs.memo || ''}
                  onChange={e => setEditingInventory({ ...editingInventory, attrs: { ...editingInventory.attrs, memo: e.target.value } })}
                />
              </div>

              {/* 📜 입출고 이력 (트랜잭션 로그) */}
              {Array.isArray(editingInventory.attrs.txns) && editingInventory.attrs.txns.length > 0 && (
                <details className="form-group" style={{ textAlign: 'left' }}>
                  <summary style={{ cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    <ClipboardList size={13} style={{ color: 'var(--accent)' }} />
                    <span>입출고 이력 ({editingInventory.attrs.txns.length}건)</span>
                    <ChevronDown size={13} style={{ marginLeft: 'auto', color: 'var(--text-tertiary)' }} />
                  </summary>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                    {[...editingInventory.attrs.txns].reverse().map((tx: any) => (
                      <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.55rem', borderRadius: '8px', background: 'var(--surface-elevated)', border: '1px solid var(--surface-elevated-border)' }}>
                        <span className="badge" style={{ flexShrink: 0, fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.35rem', borderRadius: '4px', background: tx.flow === 'OUT' ? 'var(--danger-soft-bg)' : 'var(--success-soft-bg)', color: tx.flow === 'OUT' ? 'var(--danger)' : 'var(--success)' }}>
                          {tx.flow === 'OUT' ? '출고' : '입고'}
                        </span>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, flexShrink: 0, color: tx.flow === 'OUT' ? 'var(--danger)' : 'var(--success)' }}>
                          {tx.flow === 'OUT' ? '-' : '+'}{tx.qty}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', flexShrink: 0 }}>→ {tx.balance}개</span>
                        <span style={{ fontSize: '0.66rem', color: 'var(--text-tertiary)', marginLeft: 'auto', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {[tx.client, tx.mgr].filter(Boolean).join(' · ')}{tx.ts ? ` · ${format(parseISO(tx.ts), 'MM.dd HH:mm')}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

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
                  onClick={() => setIsMemoModalOpen(false)}
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
