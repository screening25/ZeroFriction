"use client";

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Download, Upload, AlertTriangle, Trash2, RotateCcw, X } from 'lucide-react';
import { useApp } from '@/frontend/context/AppContext';
import { ACCENT_COLORS } from '@/database';
import { AnimatePresence, motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { createPortal } from 'react-dom';

interface CustomSelectCompactProps {
  value: string | number;
  options: { value: string | number; label: string }[];
  onChange: (val: any) => void;
}

/**
 * 설정 화면 전용 컴팩트 셀렉트 박스.
 * 드롭다운을 createPortal로 document.body에 렌더링하여 부모의 overflow 클리핑을 회피한다.
 * 스크롤/리사이즈 시 자동으로 닫혀 위치 어긋남을 방지한다.
 * @param value 현재 선택된 값
 * @param options 선택 가능한 옵션 목록 ({ value, label })
 * @param onChange 옵션 선택 시 호출되는 콜백
 */
function CustomSelectCompact({ value, options, onChange }: CustomSelectCompactProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (
        containerRef.current && 
        !containerRef.current.contains(target) &&
        !target.closest('.custom-select-portal-dropdown')
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleScrollResize = () => {
      setIsOpen(false);
    };
    window.addEventListener('scroll', handleScrollResize, true);
    window.addEventListener('resize', handleScrollResize);
    return () => {
      window.removeEventListener('scroll', handleScrollResize, true);
      window.removeEventListener('resize', handleScrollResize);
    };
  }, [isOpen]);

  const selectedOpt = options.find(opt => String(opt.value) === String(value));
  const displayText = selectedOpt ? selectedOpt.label : '선택...';

  const handleButtonClick = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const dropdownWidthPx = 7.5 * rootFontSize;
      
      setCoords({
        top: rect.bottom + window.scrollY,
        left: Math.max(8, rect.right + window.scrollX - dropdownWidthPx)
      });
    }
    setIsOpen(!isOpen);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '6.0rem' }}>
      <button
        ref={buttonRef}
        type="button"
        style={{
          width: '6.0rem',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--input-bg)',
          border: isOpen ? '1px solid var(--accent)' : '1px solid var(--panel-border)',
          borderRadius: '10px',
          padding: '0 0.5rem',
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          cursor: 'pointer',
          outline: 'none',
          boxShadow: isOpen ? '0 0 0 2px var(--accent-glow)' : 'none',
          transition: 'all 0.15s ease',
          textAlign: 'left'
        }}
        onClick={handleButtonClick}
      >
        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', textAlign: 'left', flex: 1 }}>
          {displayText}
        </span>
        <ChevronDown 
          size={12} 
          style={{ 
            opacity: 0.6, 
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', 
            transition: 'transform 0.15s ease',
            marginLeft: '0.2rem',
            flexShrink: 0
          }} 
        />
      </button>

      {isOpen && mounted && createPortal(
        <div
          className="custom-select-portal-dropdown"
          style={{
            position: 'absolute',
            top: `${coords.top + 4}px`,
            left: `${coords.left}px`,
            width: '7.5rem',
            background: 'var(--dropdown-bg, var(--surface-elevated))',
            border: '1px solid var(--panel-border)',
            borderRadius: '10px',
            boxShadow: '0 6px 16px var(--shadow-color, rgba(0,0,0,0.15))',
            zIndex: 9999,
            maxHeight: '180px',
            overflowY: 'auto',
            padding: '0.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.1rem',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)'
          }}
        >
          {options.map(opt => {
            const isSelected = String(opt.value) === String(value);
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  padding: '0.45rem 0.6rem',
                  fontSize: '12px',
                  fontWeight: isSelected ? 700 : 500,
                  textAlign: 'left',
                  background: isSelected ? 'var(--accent-soft-bg)' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.1s ease',
                  width: '100%'
                }}
                onMouseEnter={e => {
                  if (!isSelected) e.currentTarget.style.background = 'var(--hover-bg, rgba(255,255,255,0.05))';
                }}
                onMouseLeave={e => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent';
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

/**
 * 환경설정 화면.
 * 사용 가이드, AI 연동, 디스플레이/콘텐츠/알림 설정, 데이터 관리(백업·CSV·휴지통·초기화)를 제공한다.
 * 설정 변경은 updateSingleSetting을 통해 즉시 반영·영속화된다.
 */
type VersionLog = { version: string; date: string; latest?: boolean; items: { b: string; t: string }[] };

/** 설정 > 업데이트 정보에 표시할 버전별 변경 로그 (최신순). UPDATES_PER_PAGE개씩 페이지네이션한다. */
const UPDATES_PER_PAGE = 2;
const VERSION_LOGS: VersionLog[] = [
  { version: "v0.5.3", date: "2026-05-22", latest: true, items: [
    { b: "일정 등록 시간 입력 UI 통일 및 수평 정렬", t: ": 시간(Time) 선택기의 트리거 인풋을 날짜 선택기(DatePicker)와 동일하게 일관된 버튼 형태로 변경하여 디자인 일인화를 이루었습니다. 또한 날짜/시간 라벨의 높이를 22px로 통일하여 두 입력 박스의 시작 수평 높이를 정밀하게 정렬했습니다." },
    { b: "상단 바 퀵 액션 단축 패널 라이트 모드 전환 및 화이트 박스 버튼 통일", t: ": 자연어 입력창 하단 단축 패널의 테마를 깔끔한 라이트 모드(반투명 연회색)로 전면 변경하고, 하단의 모든 기능 버튼들을 선명한 테두리를 가진 단정한 화이트 박스 스타일로 통일하여 시인성과 조작성을 대폭 강화했습니다." }
  ] },
  { version: "v0.5.2", date: "2026-05-22", items: [
    { b: "macOS 상단 바 트레이 드롭다운 패널 연동", t: ": 트레이 아이콘 클릭 또는 '열기' 시 메인 윈도우가 상단 바 바로 아래에 드롭다운 형태로 자동 위치하도록 개선했습니다." },
    { b: "상단 바 퀵 입력 포커스(Auto-Focus)", t: ": 트레이 아이콘 클릭 시 자연어 분석 입력창(.command-input)에 자동으로 포커스 및 텍스트 전체 선택이 되어 바로 타이핑할 수 있습니다." },
    { b: "트레이 아이콘 시인성 및 브랜드 디자인 개선", t: ": Zero-Friction 브랜드 아이덴티티를 살린 '0 안의 체크마크' 스타일의 굵고 선명한 아이콘 디자인(trayTemplate.png)으로 전면 교체했습니다." },
    { b: "시간 입력 UI 깨짐 및 레이아웃 교정", t: ": 일정 등록 시 시간 입력 인풋이 찌그러지거나 잘리던 레이아웃 버그를 수정하고, '하루 종일' 토글과 38px 높이를 완벽하게 조화시켰습니다." },
    { b: "백그라운드 실행 지원 및 안전한 앱 종료", t: ": 창을 닫아도 백그라운드에 유지되며, 상단 바 메뉴의 '종료' 또는 Cmd+Q를 통해 완전히 안전하게 종료됩니다." }
  ] },
  { version: "v0.5.1", date: "2026-05-22", items: [
    { b: "알림 제시각 표시 보장", t: ": 알림 타입·권한 상태와 무관하게 일정 시각이 되면 인앱 글래스모피즘 알림 카드가 항상 표시되도록 발송 로직을 통합했습니다." },
    { b: "알림 카드 확인 버튼 추가", t: ": 알림 카드에 '완료'와 '스누즈' 버튼 외에 단순히 알림을 인지하고 창을 닫는 '확인' 버튼을 추가하여 즉시 완료 처리를 원치 않는 경우를 배려했습니다." },
    { b: "시간 설정 직접 입력 지원", t: ": 일정 등록 및 수정 시 시간 선택기를 직접 클릭해 'HH:MM' 형태의 텍스트로 자유롭게 타이핑할 수 있게 하였으며, 다양한 간편 형식 자동 완성 및 포커스 아웃/엔터 입력 시 유효성 검증을 지원합니다." },
    { b: "테스트 알림 미리보기 수정", t: ": '데스크톱 알림창' 설정에서 '테스트 실행' 시 실제와 동일한 인앱 알림 카드가 즉시 표시되도록 변경했습니다." },
    { b: "중복 OS 다이얼로그 제거", t: ": '데스크톱 알림창' 타입에서 별도의 osascript 경고창을 띄우지 않고 인앱 카드로 일원화했습니다." },
  ] },
  { version: "v0.5.0", date: "2026-05-22", items: [
    { b: "커스텀 인앱 알람 팝업", t: ": 일정 알림 시 화면 상단 중앙에 글래스모피즘 알림 카드를 슬라이드 애니메이션으로 표시하고, '완료' 및 '10분 후 알림(스누즈)' 동작을 제공합니다." },
    { b: "Electron 알림 IPC 보강", t: ": 알람 발생 시 데스크톱 창을 자동으로 복원·포커스하도록 'focus-window' IPC 바인딩을 추가했습니다." },
    { b: "macOS 알림 안정화", t: ": osascript 호출을 문자열 보간 대신 인자(argv) 기반 실행으로 변경해 따옴표/이스케이프 오류를 방지했습니다." },
    { b: "업데이트 정보 페이지네이션", t: ": 설정의 업데이트 내역을 페이지 단위(2개씩)로 나눠 '이전/다음'으로 탐색할 수 있도록 개선했습니다." },
  ] },
  { version: "v0.4.4", date: "2026-05-22", items: [
    { b: "일정/재고/메모 데이터 엑셀 및 PDF 내보내기 지원", t: ": 각 페이지(대시보드 일정/메모/재고 목록, 캘린더 페이지, 재고 페이지) 상단에 엑셀(CSV) 및 PDF 다운로드 버튼을 추가하였으며, 개별 메모 상세 보기 모달에서도 해당 메모만 즉시 엑셀/PDF로 내보낼 수 있도록 개선했습니다." },
    { b: "Excel 한글 깨짐 방지", t: ": UTF-8 BOM을 자동으로 추가하여 다운로드한 CSV 파일을 엑셀에서 열 때 한글이 깨지지 않고 올바르게 출력되도록 구현했습니다." },
    { b: "인쇄 전용 스타일 및 마크다운 렌더링 지원", t: ": PDF 저장 또는 인쇄 시 깔끔하게 스타일링된 출력 전용 문서를 동적으로 생성하며, 메모 내 표·리스트·코드 블록 등의 마크다운 서식을 원본 레이아웃 그대로 유지하여 인쇄합니다." },
    { b: "엑셀 내보내기 버튼 표기·크기 개선", t: ": 버튼 텍스트를 'Excel'로 변경하고, 화면이 줄어들어도 버튼 크기가 변형되지 않도록 축소 방지 스타일(flexShrink)을 적용했습니다." },
    { b: "반응형 레이아웃 세부 조절 및 축소 방지", t: ": 900px, 680px, 480px 단계별로 버튼 라벨·탭 텍스트를 숨기고 아이콘만 노출하며, 주요 카드들이 찌그러지지 않도록 레이아웃 고정 스타일을 적용했습니다." },
    { b: "일정/재고 서브페이지 페이지네이션 탑재", t: ": 캘린더 당일 일정 목록 및 재고 서브페이지에 페이지네이션을 구현해 데이터가 많아도 모바일 화면을 넘치지 않게 개선했습니다." },
  ] },
  { version: "v0.4.3", date: "2026-05-22", items: [
    { b: "일정 하루 종일 옵션 지원", t: ": 일정 생성/편집 시 '하루 종일' 토글을 지원하고, 활성화 시 시간 대신 '하루 종일' 배지를 노출하며 목록 최상단에 자동 정렬합니다." },
    { b: "완료 일정 달력 표시 유지", t: ": 일정이 완료되어도 달력 셀 하단의 표시용 점들이 사라지지 않도록 보완했습니다." },
    { b: "메모 마크다운 표·코드 블록 확장", t: ": 메모 보기창에서 마크다운 테이블(정렬 지원) 및 코드 블록이 올바르게 렌더링되도록 확장했습니다." },
  ] },
  { version: "v0.4.2", date: "2026-05-22", items: [
    { b: "시간 선택기 미니멀화", t: ": 복잡한 숫자 그리드를 제거하고 상/하 화살표 스텝 방식으로 시간 선택 UI를 간소화했습니다." },
    { b: "시간 입력 이벤트 전파 방지", t: ": 시간 선택기를 클릭해도 부모 등록/수정창이 닫히지 않도록 이벤트 차단을 강화했습니다." },
    { b: "터미널 중복 기동 수정", t: ": 데스크톱 실행기 기동 시 열리던 빈 터미널 창이 노출되지 않도록 자동 실행 스크립트를 무소음 패치했습니다." },
  ] },
  { version: "v0.4.1", date: "2026-05-21", items: [
    { b: "재고 삭제 UX 개선", t: ": 재고 상세 모달·리스트 삭제 시 모달 닫힘 연동 및 클릭 버블링 문제를 수정했습니다." },
    { b: "기본 알림 시간 변경", t: ": 일정 등록 시 기본 알림을 10분 전에서 정각(0분)으로 일원화했습니다." },
  ] },
  { version: "v0.4.0", date: "2026-05-21", items: [
    { b: "메모 읽기 전용 뷰/수정 모드 분리", t: ": 메모 카드를 클릭하면 읽기 모드로 열리고, 우측 상단 '수정'으로 편집 모드로 전환합니다." },
    { b: "메모 리스트 디자인 통일", t: ": 메모 카드 높이를 150px로 통일하고 넘치는 내용을 보기 좋게 자릅니다." },
    { b: "입력 폼 컴팩트화 및 안내문구 최적화", t: "." },
  ] },
];

export default function SettingsSection() {
  const {
    theme,
    appSettings,
    handleSettingsChange,
    showToast,
    reloadRecords,
    logActivity,
    archive,
    restoreArchived,
    permanentDelete,
    emptyArchive,
    clearActivities,
    exportToCsv,
    setActiveNotification
  } = useApp();

  const fileRef = useRef<HTMLInputElement>(null);
  // 화면 입력용 로컬 설정 사본 — 전역 appSettings와 분리해 즉시 UI 반영을 담당
  const [localSettings, setLocalSettings] = useState({ ...appSettings });
  const [isTrashModalOpen, setIsTrashModalOpen] = useState(false);
  const [trashSearchQuery, setTrashSearchQuery] = useState('');
  const [trashFilterType, setTrashFilterType] = useState<'all' | 'event' | 'asset' | 'memo'>('all');
  const [expandedTrashId, setExpandedTrashId] = useState<string | null>(null);
  const [updatePage, setUpdatePage] = useState(0);

  // Electron 창 리사이즈 비교용 — 직전 deviceSize 값을 추적
  const prevDeviceSizeRef = useRef(appSettings.deviceSize);

  // 전역 설정이 바뀌면 로컬 사본도 동기화
  useEffect(() => {
    setLocalSettings({ ...appSettings });
    prevDeviceSizeRef.current = appSettings.deviceSize;
  }, [appSettings]);

  /**
   * 단일 설정 항목을 즉시 반영·영속화한다.
   * Electron 환경에서 deviceSize가 바뀌면 네이티브 창 크기 조정 IPC를 전송한다.
   * @param newSettings 갱신된 전체 설정 객체
   */
  const updateSingleSetting = (newSettings: typeof appSettings) => {
    setLocalSettings(newSettings);
    handleSettingsChange(newSettings);
    if (typeof window !== 'undefined') {
      localStorage.setItem('zero_settings', JSON.stringify(newSettings));

      // Electron에서만: deviceSize 변경 시 네이티브 프레임 리사이즈 트리거
      if ((window as any).__IS_ELECTRON__ && (window as any).ipcRenderer) {
        const size = newSettings.deviceSize || 'default';
        if (size !== prevDeviceSizeRef.current) {
          prevDeviceSizeRef.current = size;
          // Trigger electron frame size adjustments!
          (window as any).ipcRenderer.send('resize-window', { size });
        }
      }
    }
  };

  /**
   * 모든 로컬 데이터(레코드·활동로그·설정)를 단일 JSON 백업 파일로 내보낸다.
   */
  const handleExportData = () => {
    try {
      const recordsData = localStorage.getItem('universal_records') || '[]';
      const activitiesData = localStorage.getItem('zero_activities') || '[]';
      const settingsData = localStorage.getItem('zero_settings') || '{}';

      const backup = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        records: JSON.parse(recordsData),
        activities: JSON.parse(activitiesData),
        settings: JSON.parse(settingsData),
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zero_friction_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      logActivity('UPDATE_SCHED', '데이터 백업 내보내기 완료', 'settings');
      showToast('📦 전체 데이터 백업 파일 내보내기 완료');
    } catch (e) {
      showToast('⚠️ 백업 실패');
    }
  };

  /**
   * JSON 백업 파일을 읽어 데이터를 복원한다.
   * 형식 검증(records 배열 존재 여부) 후 사용자 확인을 거쳐 localStorage를 덮어쓰고 새로고침한다.
   * @param e 파일 input change 이벤트
   */
  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const backup = JSON.parse(event.target?.result as string);
        if (!backup.records || !Array.isArray(backup.records)) {
          showToast('⚠️ 유효하지 않은 백업 파일 형식');
          return;
        }

        if (confirm('백업 파일을 복원하시겠습니까? 현재 데이터는 모두 덮어써집니다.')) {
          localStorage.setItem('universal_records', JSON.stringify(backup.records));
          if (backup.activities) localStorage.setItem('zero_activities', JSON.stringify(backup.activities));
          if (backup.settings) localStorage.setItem('zero_settings', JSON.stringify(backup.settings));

          reloadRecords();
          showToast('🎉 데이터 복원 완료! 시스템을 새로고침합니다.');
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      } catch (err) {
        showToast('⚠️ 파일 분석 실패');
      }
    };
    reader.readAsText(file);
  };

  /**
   * 전체 시스템 초기화. 되돌릴 수 없으므로 2단계 확인 후 localStorage를 비우고 새로고침한다.
   */
  const handleResetAll = () => {
    if (confirm('⚠️ [경고] 모든 데이터(일정, 재고, 메모, 설정, 활동로그)가 영구적으로 삭제됩니다. 계속하시겠습니까?')) {
      if (confirm('진짜로 초기화하시겠습니까? 이 작업은 취소할 수 없습니다.')) {
        localStorage.clear();
        showToast('🔥 시스템 전체 초기화 완료');
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    }
  };

  const currentAccents = ACCENT_COLORS.map(c => theme === 'dark' ? { ...c, value: c.dark } : c);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', width: '100%', padding: '0.4rem 0.2rem 1.0rem 0.2rem' }}>

      {/* Settings Header (Apple Cupertino Style) */}
      <div className="section-header" style={{ marginBottom: '0.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="section-title">환경설정</div>
      </div>

      {/* 앱 사용 방법 (Collapsible Guide) */}
      <details className="settings-section help-section" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--surface-elevated-border)', borderRadius: '14px', padding: '0', overflow: 'hidden' }}>
        <summary style={{ listStyle: 'none', cursor: 'pointer', padding: '0.7rem 0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ fontSize: '0.95rem' }}>📖</span>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>앱 사용 방법</span>
          </div>
          <ChevronDown size={14} style={{ color: 'var(--text-tertiary)', transition: 'transform 0.2s ease' }} className="help-chevron" />
        </summary>

        <div style={{ padding: '0 0.85rem 0.85rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.7rem', borderTop: '1px solid var(--panel-border)', paddingTop: '0.75rem' }}>

          {/* 1. 자연어 입력 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', textAlign: 'left' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.3px' }}>1 · 자연어 입력</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              상단 입력창에 한국어로 자연스럽게 적으면 AI가 자동 분류·등록합니다.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.1rem' }}>
              {[
                { tag: '일정', ex: '"내일 오후 3시 디자인 리뷰 10분 전 알림"' },
                { tag: '재고 입고', ex: '"사과 12개 입고"' },
                { tag: '재고 출고', ex: '"배 5개 출고"' },
                { tag: '단순 메모', ex: '"장보기 리스트 작성하기 메모"' }
              ].map(item => (
                <div key={item.tag} style={{ display: 'flex', gap: '0.4rem', fontSize: '0.65rem' }}>
                  <span style={{ color: 'var(--accent)', fontWeight: 800, width: '50px', textAlign: 'left' }}>{item.tag}</span>
                  <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{item.ex}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 2. 키보드 단축키 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', textAlign: 'left' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.3px' }}>2 · 시스템 단축키</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              {[
                { keys: '⌘ K / Ctrl+K', desc: '글로벌 커맨드 팔레트 검색 바 실행' },
                { keys: 'ESC', desc: '검색 바 닫기 / 대시보드로 돌아가기' },
                { keys: 'Enter (입력창)', desc: '자연어 분석 등록 실행' }
              ].map(item => (
                <div key={item.keys} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem' }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{item.keys}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{item.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 3. 재고 관리 룰 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', textAlign: 'left' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.3px' }}>3 · 실시간 재고 스마트 경고</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              재고 등록 시 설정한 <span style={{ color: 'var(--danger)', fontWeight: 700 }}>적정 안전 재고량</span>보다 현재 수량이 작거나 같아지면
              대시보드와 재고 현황에 자동으로 경고 불빛이 들어옵니다.
            </div>
          </div>

          {/* 4. 데이터 휴지통 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', textAlign: 'left' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.3px' }}>4 · 2단계 안전 휴지통</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              데이터를 실수로 삭제하는 것을 방지하기 위해 모든 데이터는 1차적으로 휴지통에 보관됩니다.
              설정의 데이터 관리 탭에서 영구 삭제하거나 즉시 복구할 수 있습니다.
            </div>
          </div>

          {/* 5. 탭 & 뷰 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', textAlign: 'left' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.3px' }}>5 · 커스텀 캘린더 스타일</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              디바이스 및 취향에 따라 일요일 혹은 월요일 시작 기준을 설정할 수 있으며,
              달력의 한 셀에 최대로 보여줄 일정 개수를 자유롭게 조절할 수 있습니다.
            </div>
          </div>

          {/* 6. 데이터 백업 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', textAlign: 'left' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.3px' }}>6 · 오프라인 로컬 백업</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              데이터 관리는 100% 클라이언트 보안 쿠키 및 로컬 브라우저 저장소 기반입니다.
              주기적으로 데이터 백업 파일을 다운로드하여 영구 보존하세요.
            </div>
          </div>

        </div>
      </details>

      {/* AI API Key */}
      <details className="settings-section settings-section-details" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--surface-elevated-border)', borderRadius: '14px', padding: '0', overflow: 'hidden' }} open>
        <summary style={{ listStyle: 'none', cursor: 'pointer', padding: '0.7rem 0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>AI 연동 설정</span>
          </div>
          <ChevronDown size={14} style={{ color: 'var(--text-tertiary)', transition: 'transform 0.2s ease' }} className="settings-chevron" />
        </summary>
        <div style={{ padding: '0 0.85rem 0.85rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', borderTop: '1px solid var(--panel-border)', paddingTop: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="settings-label-compact">AI API Key</span>
            <input
              type="password"
              className="settings-select-compact"
              placeholder="API Key"
              value={localSettings.apiKey}
              onChange={e => {
                const updated = { ...localSettings, apiKey: e.target.value };
                updateSingleSetting(updated);
              }}
            />
          </div>
          <div style={{ height: '1px', background: 'var(--panel-border)', margin: '0.2rem 0' }} />
          <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.3px' }}>AI 연동 오류 코드 안내</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.62rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <div>• <strong style={{ color: 'var(--text-primary)' }}>E-100</strong>: 유효하지 않은 API Key (입력값 오타 또는 만료)</div>
              <div>• <strong style={{ color: 'var(--text-primary)' }}>E-200</strong>: API 호출 한도 초과 (무료 할당량 초과)</div>
              <div>• <strong style={{ color: 'var(--text-primary)' }}>E-300</strong>: 네트워크 통신 장애 또는 연결 오류</div>
              <div>• <strong style={{ color: 'var(--text-primary)' }}>E-900</strong>: 기타 시스템 연동 오류 (서버 일시 에러)</div>
            </div>
          </div>
        </div>
      </details>

      {/* Display Settings */}
      <details className="settings-section settings-section-details" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--surface-elevated-border)', borderRadius: '14px', padding: '0', overflow: 'hidden' }} open>
        <summary style={{ listStyle: 'none', cursor: 'pointer', padding: '0.7rem 0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>디스플레이 설정</span>
          </div>
          <ChevronDown size={14} style={{ color: 'var(--text-tertiary)', transition: 'transform 0.2s ease' }} className="settings-chevron" />
        </summary>
        <div style={{ padding: '0 0.85rem 0.85rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', borderTop: '1px solid var(--panel-border)', paddingTop: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>포인트 색상</span>
            <div className="color-chips" style={{ display: 'flex', gap: '0.5rem', padding: '0.1rem 0' }}>
              {currentAccents.map(c => {
                const isActive = localSettings.accentColor === c.value;
                return (
                  <div
                    key={c.name}
                    className={`color-chip ${isActive ? 'active' : ''}`}
                    style={{
                      background: c.value,
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      outline: 'none',
                      border: isActive ? `2px solid var(--bg-color)` : '2px solid transparent',
                      boxShadow: isActive ? `0 0 0 1.5px ${c.value}` : 'none'
                    }}
                    onClick={() => {
                      const updated = { ...localSettings, accentColor: c.value };
                      updateSingleSetting(updated);
                    }}
                  />
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0' }}>
            <span className="settings-label-compact">레이아웃 밀도</span>
            <CustomSelectCompact
              value={localSettings.density}
              options={[
                { value: 'compact', label: 'Compact' },
                { value: 'cozy', label: 'Cozy' }
              ]}
              onChange={val => updateSingleSetting({ ...localSettings, density: val })}
            />
          </div>

          <div className="flex items-center justify-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0' }}>
            <span className="settings-label-compact">글자 크기</span>
            <CustomSelectCompact
              value={localSettings.fontSize || 'medium'}
              options={[
                { value: 'small', label: '작게' },
                { value: 'medium', label: '중간' },
                { value: 'large', label: '크게' }
              ]}
              onChange={val => updateSingleSetting({ ...localSettings, fontSize: val })}
            />
          </div>

          <div className="flex items-center justify-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0' }}>
            <span className="settings-label-compact">시간 표기 방식</span>
            <CustomSelectCompact
              value={localSettings.timeFormat}
              options={[
                { value: '12h', label: '12시간' },
                { value: '24h', label: '24시간' }
              ]}
              onChange={val => updateSingleSetting({ ...localSettings, timeFormat: val })}
            />
          </div>
        </div>
      </details>

      {/* Content Settings */}
      <details className="settings-section settings-section-details" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--surface-elevated-border)', borderRadius: '14px', padding: '0', overflow: 'hidden' }} open>
        <summary style={{ listStyle: 'none', cursor: 'pointer', padding: '0.7rem 0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>콘텐츠 표시 설정</span>
          </div>
          <ChevronDown size={14} style={{ color: 'var(--text-tertiary)', transition: 'transform 0.2s ease' }} className="settings-chevron" />
        </summary>
        <div style={{ padding: '0 0.85rem 0.85rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', borderTop: '1px solid var(--panel-border)', paddingTop: '0.75rem' }}>
          <div className="flex items-center justify-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0' }}>
            <span className="settings-label-compact">달력 시작 요일</span>
            <CustomSelectCompact
              value={localSettings.weekStartsOn}
              options={[
                { value: 0, label: '일요일' },
                { value: 1, label: '월요일' }
              ]}
              onChange={val => updateSingleSetting({ ...localSettings, weekStartsOn: val })}
            />
          </div>

          <div className="flex items-center justify-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0' }}>
            <span className="settings-label-compact">일정 노출 개수</span>
            <CustomSelectCompact
              value={localSettings.maxEventsShown}
              options={[
                { value: 2, label: '2개' },
                { value: 3, label: '3개' },
                { value: 4, label: '4개' },
                { value: 5, label: '5개' }
              ]}
              onChange={val => updateSingleSetting({ ...localSettings, maxEventsShown: val })}
            />
          </div>

          <div className="flex items-center justify-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0' }}>
            <span className="settings-label-compact">재고 노출 개수</span>
            <CustomSelectCompact
              value={localSettings.maxInventoryShown}
              options={[
                { value: 3, label: '3개' },
                { value: 5, label: '5개' },
                { value: 10, label: '10개' }
              ]}
              onChange={val => updateSingleSetting({ ...localSettings, maxInventoryShown: val })}
            />
          </div>

          <div className="flex items-center justify-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0' }}>
            <span className="settings-label-compact">메모 노출 개수</span>
            <CustomSelectCompact
              value={localSettings.maxMemosShown}
              options={[
                { value: 4, label: '4개' },
                { value: 6, label: '6개' },
                { value: 8, label: '8개' }
              ]}
              onChange={val => updateSingleSetting({ ...localSettings, maxMemosShown: val })}
            />
          </div>
        </div>
      </details>

      {/* 알림 설정 (Notification Settings) */}
      <details className="settings-section settings-section-details" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--surface-elevated-border)', borderRadius: '14px', padding: '0', overflow: 'hidden' }} open>
        <summary style={{ listStyle: 'none', cursor: 'pointer', padding: '0.7rem 0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>알림 설정</span>
          </div>
          <ChevronDown size={14} style={{ color: 'var(--text-tertiary)', transition: 'transform 0.2s ease' }} className="settings-chevron" />
        </summary>
        <div style={{ padding: '0 0.85rem 0.85rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', borderTop: '1px solid var(--panel-border)', paddingTop: '0.75rem' }}>
          {/* 시스템 알림 권한 */}
          <div className="flex items-center justify-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0' }}>
            <span className="settings-label-compact">시스템 알림 권한</span>
            <button
              type="button"
              className="settings-btn-compact"
              onClick={async () => {
                const currentVal = localSettings.enableNotifications !== false;
                if (!currentVal) {
                  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
                    await Notification.requestPermission();
                  }
                }
                updateSingleSetting({ ...localSettings, enableNotifications: !currentVal });
              }}
              style={{ width: '6.0rem' }}
            >
              {(localSettings.enableNotifications !== false) ? '허용됨' : '거부됨'}
            </button>
          </div>

          {/* 기본 알림 시간 */}
          <div className="flex items-center justify-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0' }}>
            <span className="settings-label-compact">기본 알림 시간</span>
            <CustomSelectCompact
              value={localSettings.defaultNotifyOffset ?? 0}
              options={[
                { value: -1, label: '알림 없음' },
                { value: 0, label: '정각' },
                { value: 10, label: '10분 전' },
                { value: 30, label: '30분 전' },
                { value: 60, label: '1시간 전' },
                { value: 1440, label: '1일 전' }
              ]}
              onChange={val => updateSingleSetting({ ...localSettings, defaultNotifyOffset: val })}
            />
          </div>

          {/* 알림 전송 방식 */}
          <div className="flex items-center justify-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0' }}>
            <span className="settings-label-compact">알림 전송 방식</span>
            <CustomSelectCompact
              value={localSettings.notificationType ?? 'system'}
              options={[
                { value: 'system', label: '데스크톱 알림창' },
                { value: 'browser', label: 'OS 배너 알림' }
              ]}
              onChange={val => updateSingleSetting({ ...localSettings, notificationType: val })}
            />
          </div>

          {/* 알림 테스트 */}
          <div className="flex items-center justify-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0' }}>
            <span className="settings-label-compact">알림 기능 테스트</span>
            <button
              type="button"
              className="settings-btn-compact"
              onClick={async () => {
                if (localSettings.enableNotifications === false) {
                  showToast('알림 서비스가 비활성화 상태입니다.');
                  return;
                }

                try {
                  const now = new Date();
                  const isBrowser = localSettings.notificationType === 'browser';

                  if (isBrowser) {
                    // OS 배너 알림 테스트 (기존 경로 유지)
                    const title = 'Zero-Friction 알림 테스트';
                    const body = 'OS 표준 슬라이드 배너 알림이 정상 작동 중입니다!';
                    if (typeof window !== 'undefined' && (window as any).__IS_ELECTRON__ && (window as any).ipcRenderer) {
                      (window as any).ipcRenderer.send('send-notification', { title, body });
                      showToast('테스트 배너 알림을 발송했습니다.');
                    } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                      new Notification(title, { body });
                      showToast('테스트 배너 알림을 발송했습니다.');
                    } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'denied') {
                      showToast('시스템 알림 권한이 거부되어 알림을 발송할 수 없습니다.');
                    } else {
                      const res = await fetch('/api/notify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title, body, type: 'browser' })
                      });
                      showToast(res.ok ? '테스트 배너 알림이 발송되었습니다.' : '알림 발송에 실패했습니다.');
                    }
                  } else {
                    // 'system'(데스크톱 알림창) = 새 인앱 글래스모피즘 알림 카드를 즉시 미리보기
                    setActiveNotification({
                      id: '__test__',
                      title: 'Zero-Friction 알림 테스트',
                      body: '인앱 알림 카드가 정상적으로 표시됩니다!',
                      time: format(now, 'HH:mm'),
                      date: format(now, 'yyyy-MM-dd')
                    });
                    showToast('테스트 알림 카드를 표시했습니다.');
                  }
                } catch (e) {
                  showToast('테스트 알림 오류 발생');
                }
              }}
              style={{ width: '6.0rem' }}
            >
              테스트 실행
            </button>
          </div>
        </div>
      </details>

      {/* 데이터 관리 (Consolidated Data Management) */}
      <details className="settings-section settings-section-details" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--surface-elevated-border)', borderRadius: '14px', padding: '0', overflow: 'hidden' }} open>
        <summary style={{ listStyle: 'none', cursor: 'pointer', padding: '0.7rem 0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>데이터 관리</span>
          </div>
          <ChevronDown size={14} style={{ color: 'var(--text-tertiary)', transition: 'transform 0.2s ease' }} className="settings-chevron" />
        </summary>
        <div style={{ padding: '0 0.85rem 0.85rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', borderTop: '1px solid var(--panel-border)', paddingTop: '0.75rem' }}>
          {/* Row 1 (Safe & Export): 데이터 내보내기 & 데이터 불러오기 */}
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
            <button
              className="settings-btn-compact"
              onClick={handleExportData}
              style={{ flex: 1, gap: '0.25rem' }}
            >
              <Download size={12} /> 데이터 내보내기 (.json)
            </button>

            <button
              className="settings-btn-compact"
              onClick={() => fileRef.current?.click()}
              style={{ flex: 1, gap: '0.25rem' }}
            >
              <Upload size={12} /> 데이터 불러오기
            </button>
            <input
              type="file"
              ref={fileRef}
              style={{ display: 'none' }}
              accept=".json"
              onChange={handleImportData}
            />
          </div>

          {/* Row 1.5 (CSV Exports): 일정 CSV & 재고 CSV 내보내기 */}
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
            <button
              className="settings-btn-compact"
              onClick={() => exportToCsv('event')}
              style={{ flex: 1, gap: '0.25rem' }}
            >
              <Download size={12} /> 일정 백업 (.csv)
            </button>
            <button
              className="settings-btn-compact"
              onClick={() => exportToCsv('asset')}
              style={{ flex: 1, gap: '0.25rem' }}
            >
              <Download size={12} /> 재고 백업 (.csv)
            </button>
          </div>

          {/* Row 2 (Trash & Logs): 휴지통 & 활동 로그 초기화 */}
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
            <button
              className="settings-btn-compact accent-btn"
              onClick={() => setIsTrashModalOpen(true)}
              style={{ flex: 1 }}
            >
              🗑️ 휴지통 ({archive.length})
            </button>

            <button
              className="settings-btn-compact"
              onClick={() => {
                if (confirm('모든 활동 로그를 삭제하시겠습니까?')) {
                  clearActivities();
                  showToast('🧹 활동 로그 초기화 완료');
                }
              }}
              style={{ flex: 1 }}
            >
              활동 로그 초기화
            </button>
          </div>

          {/* Row 3 (Destructive): 모든 데이터 초기화 */}
          <button
            className="settings-btn-compact danger-btn"
            onClick={handleResetAll}
            style={{ width: '100%', gap: '0.3rem' }}
          >
            <AlertTriangle size={12} /> 시스템 전체 초기화 (영구 삭제)
          </button>
        </div>
      </details>

      {/* 업데이트 정보 (Version & Changelog) */}
      <details className="settings-section settings-section-details" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--surface-elevated-border)', borderRadius: '14px', padding: '0', overflow: 'hidden' }}>
        <summary style={{ listStyle: 'none', cursor: 'pointer', padding: '0.7rem 0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>업데이트 정보 (v0.5.3)</span>
          </div>
          <ChevronDown size={14} style={{ color: 'var(--text-tertiary)', transition: 'transform 0.2s ease' }} className="settings-chevron" />
        </summary>
        <div style={{ padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', borderTop: '1px solid var(--panel-border)', textAlign: 'left' }}>
          {(() => {
            const totalPages = Math.max(1, Math.ceil(VERSION_LOGS.length / UPDATES_PER_PAGE));
            // 데이터 변동/경계 초과에도 안전하도록 현재 페이지를 항상 유효 범위로 보정
            const safePage = Math.min(Math.max(updatePage, 0), totalPages - 1);
            const startIdx = safePage * UPDATES_PER_PAGE;
            const pageLogs = VERSION_LOGS.slice(startIdx, startIdx + UPDATES_PER_PAGE);
            return (
              <>
                {pageLogs.map((log, i) => (
                  <div key={log.version} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 800, color: log.latest ? 'var(--accent)' : 'var(--text-primary)' }}>{log.version} ({log.date})</span>
                      {log.latest && (
                        <span style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', background: 'var(--hover-bg)', padding: '0.1rem 0.3rem', borderRadius: '4px', fontWeight: 700 }}>최신 버전</span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      {log.items.map((it, j) => (
                        <div key={j}>• <strong>{it.b}</strong>{it.t}</div>
                      ))}
                    </div>
                    {i < pageLogs.length - 1 && (
                      <div style={{ height: '1px', background: 'var(--panel-border)', margin: '0.5rem 0 0.1rem 0' }} />
                    )}
                  </div>
                ))}

                {/* 페이지 내비게이션 (이전/다음 + 인디케이터) */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.8rem', marginTop: '0.4rem', borderTop: '1px solid var(--panel-border)', paddingTop: '0.7rem' }}>
                  <button type="button" className="ghost-btn" onClick={() => setUpdatePage(prev => Math.max(0, prev - 1))} disabled={safePage <= 0} style={{ opacity: safePage <= 0 ? 0.3 : 1, padding: '0.2rem 0.6rem', fontSize: '0.72rem' }}>이전</button>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>{safePage + 1} / {totalPages}</span>
                  <button type="button" className="ghost-btn" onClick={() => setUpdatePage(prev => Math.min(totalPages - 1, prev + 1))} disabled={safePage >= totalPages - 1} style={{ opacity: safePage >= totalPages - 1 ? 0.3 : 1, padding: '0.2rem 0.6rem', fontSize: '0.72rem' }}>다음</button>
                </div>
              </>
            );
          })()}
        </div>
      </details>


      {/* Soft Delete Trash Modal (Instant overlay within Settings!) */}
      <AnimatePresence>
        {isTrashModalOpen && (
          <div 
            className="fixed inset-0 z-[60] flex items-center justify-center p-4" 
            style={{ 
              position: 'fixed', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0, 
              zIndex: 1000, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              background: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(12px)', 
              WebkitBackdropFilter: 'blur(12px)' 
            }}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }} 
              transition={{ duration: 0.15 }} 
              style={{ 
                width: '100%', 
                maxWidth: '460px', 
                borderRadius: '20px', 
                padding: '1.25rem', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '0.8rem', 
                border: '1px solid var(--panel-border)', 
                background: 'var(--bg-color)', 
                boxShadow: '0 15px 45px rgba(0,0,0,0.25)',
                maxHeight: '85vh',
                overflow: 'hidden'
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-primary)' }}>
                  <Trash2 size={16} style={{ color: 'var(--danger)' }} />
                  <span style={{ fontSize: '1.05rem', fontWeight: 800 }}>휴지통</span>
                  <span style={{ 
                    fontSize: '0.72rem', 
                    fontWeight: 700, 
                    color: 'var(--text-secondary)', 
                    background: 'var(--hover-bg)', 
                    padding: '0.15rem 0.45rem', 
                    borderRadius: '6px' 
                  }}>
                    {archive.length}개 보관됨
                  </span>
                </div>
                <button 
                  onClick={() => {
                    setIsTrashModalOpen(false);
                    setTrashSearchQuery('');
                    setTrashFilterType('all');
                    setExpandedTrashId(null);
                  }} 
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

              {/* Subtitle / Tip */}
              <div style={{ 
                fontSize: '0.72rem', 
                color: 'var(--text-secondary)', 
                lineHeight: '1.4', 
                textAlign: 'left',
                paddingBottom: '0.4rem'
              }}>
                휴지통의 데이터는 최대 200개까지 보관되며, 클릭 시 상세 정보를 확인하고 원래 탭으로 복구할 수 있습니다.
              </div>

              {/* Search Bar */}
              <div style={{ width: '100%' }}>
                <input 
                  type="text" 
                  placeholder="이름, 내용, 코드 등으로 검색..." 
                  value={trashSearchQuery}
                  onChange={(e) => setTrashSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.75rem',
                    fontSize: '0.75rem',
                    background: 'var(--surface-elevated)',
                    border: '1px solid var(--panel-border)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    textAlign: 'left'
                  }}
                />
              </div>

              {/* Tab Filters */}
              <div style={{ display: 'flex', gap: '0.3rem', fontSize: '0.72rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
                {(['all', 'event', 'asset', 'memo'] as const).map((t) => {
                  const label = t === 'all' ? '전체' : t === 'event' ? '일정' : t === 'asset' ? '재고' : '메모';
                  const count = t === 'all' ? archive.length : archive.filter(x => x.type === t).length;
                  const active = trashFilterType === t;
                  return (
                    <button
                      key={t}
                      onClick={() => {
                        setTrashFilterType(t);
                        setExpandedTrashId(null);
                      }}
                      style={{
                        padding: '0.25rem 0.6rem',
                        borderRadius: '6px',
                        border: active ? '1px solid var(--accent)' : '1px solid var(--panel-border)',
                        background: active ? 'var(--accent-soft-bg)' : 'transparent',
                        color: active ? 'var(--accent)' : 'var(--text-secondary)',
                        fontWeight: active ? 700 : 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                        flexShrink: 0
                      }}
                    >
                      <span>{label}</span>
                      <span style={{ fontSize: '0.62rem', opacity: 0.6 }}>{count}</span>
                    </button>
                  );
                })}
              </div>

              {/* Trash Items List */}
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '0.5rem', 
                maxHeight: '320px', 
                overflowY: 'auto',
                paddingRight: '2px',
                marginTop: '0.2rem'
              }}>
                {(() => {
                  const filteredArchive = archive.filter(item => {
                    if (trashFilterType !== 'all' && item.type !== trashFilterType) return false;
                    if (trashSearchQuery.trim() !== '') {
                      const q = trashSearchQuery.toLowerCase();
                      const titleMatch = (item.title || '').toLowerCase().includes(q);
                      const descMatch = (item.attrs?.description || item.attrs?.content || '').toLowerCase().includes(q);
                      const codeMatch = (item.attrs?.code || '').toLowerCase().includes(q);
                      const categoryMatch = (item.category || '').toLowerCase().includes(q);
                      return titleMatch || descMatch || codeMatch || categoryMatch;
                    }
                    return true;
                  });

                  if (filteredArchive.length === 0) {
                    return (
                      <div style={{ 
                        padding: '3rem 1.5rem', 
                        textAlign: 'center', 
                        color: 'var(--text-tertiary)', 
                        fontSize: '0.8rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.4rem'
                      }}>
                        <Trash2 size={24} style={{ opacity: 0.3 }} />
                        <span>검색 결과 또는 보관된 항목이 없습니다.</span>
                      </div>
                    );
                  }

                  return filteredArchive.map((item) => {
                    const formattedDate = item.archivedAt 
                      ? format(parseISO(item.archivedAt), 'yy.MM.dd HH:mm') 
                      : '';
                    const typeLabel = item.type === 'event' ? '일정' : item.type === 'asset' ? '재고' : '메모';
                    
                    const typeColor = item.type === 'event' 
                      ? 'var(--accent)' 
                      : item.type === 'asset' 
                        ? 'var(--success)' 
                        : 'var(--purple)';
                    const typeBg = item.type === 'event' 
                      ? 'var(--accent-soft-bg)' 
                      : item.type === 'asset' 
                        ? 'var(--success-soft-bg)' 
                        : 'var(--purple-soft-bg)';

                    const isExpanded = expandedTrashId === item.id;

                    return (
                      <div 
                        key={item.id} 
                        style={{ 
                          display: 'flex', 
                          flexDirection: 'column',
                          padding: '0.65rem 0.8rem', 
                          background: 'var(--surface-elevated)', 
                          border: '1px solid var(--panel-border)', 
                          borderRadius: '10px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        onClick={() => setExpandedTrashId(isExpanded ? null : item.id)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, minWidth: 0, textAlign: 'left' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                              <span style={{ 
                                fontSize: '0.62rem', 
                                fontWeight: 800, 
                                color: typeColor, 
                                background: typeBg, 
                                padding: '0.1rem 0.35rem', 
                                borderRadius: '4px',
                                flexShrink: 0
                              }}>
                                {typeLabel}
                              </span>
                              <span 
                                style={{ 
                                  fontSize: '0.82rem', 
                                  fontWeight: 600, 
                                  color: 'var(--text-primary)', 
                                  overflow: 'hidden', 
                                  textOverflow: 'ellipsis', 
                                  whiteSpace: 'nowrap' 
                                }}
                                title={item.title}
                              >
                                {item.title || '(제목 없음)'}
                              </span>
                            </div>
                            {formattedDate && (
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
                                {formattedDate} 삭제됨
                              </span>
                            )}
                          </div>

                          {/* Actions */}
                          <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                restoreArchived(item.id);
                              }}
                              style={{ 
                                background: 'var(--hover-bg)', 
                                border: 'none', 
                                color: 'var(--accent)', 
                                cursor: 'pointer',
                                padding: '0.3rem 0.5rem',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <RotateCcw size={10} />
                              복구
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('이 항목을 영구 삭제하시겠습니까?')) {
                                  permanentDelete(item.id);
                                }
                              }}
                              style={{ 
                                background: 'var(--hover-bg)', 
                                border: 'none', 
                                color: 'var(--danger)', 
                                cursor: 'pointer',
                                padding: '0.3rem 0.5rem',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <Trash2 size={10} />
                              삭제
                            </button>
                          </div>
                        </div>

                        {/* Accordion Details */}
                        {isExpanded && (
                          <div 
                            style={{
                              marginTop: '0.6rem',
                              padding: '0.6rem 0.8rem',
                              background: 'var(--panel-bg)',
                              borderRadius: '8px',
                              border: '1px dashed var(--panel-border)',
                              fontSize: '0.72rem',
                              color: 'var(--text-secondary)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.4rem',
                              textAlign: 'left'
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {item.type === 'event' && (
                              <>
                                <div><strong>일정 일시:</strong> {item.attrs.date} {item.attrs.allDay ? '하루 종일' : (item.attrs.time || '')}</div>
                                <div><strong>카테고리:</strong> {item.category || '기본'}</div>
                                {item.attrs.description && (
                                  <div style={{ borderTop: '1px solid var(--panel-border)', paddingTop: '0.3rem', whiteSpace: 'pre-wrap' }}>
                                    {item.attrs.description}
                                  </div>
                                )}
                              </>
                            )}
                            {item.type === 'asset' && (
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem' }}>
                                <div><strong>품목 코드:</strong> {item.attrs.code || '없음'}</div>
                                <div><strong>현재 수량:</strong> {item.attrs.qty || 0} 개</div>
                                <div><strong>보관 위치:</strong> {item.attrs.location || '지정 없음'}</div>
                                <div><strong>담당자:</strong> {item.attrs.manager || '없음'}</div>
                                <div><strong>카테고리:</strong> {item.category || '기본'}</div>
                              </div>
                            )}
                            {item.type === 'memo' && (
                              <>
                                {item.category && <div><strong>카테고리:</strong> {item.category}</div>}
                                <div 
                                  style={{ 
                                    maxHeight: '120px', 
                                    overflowY: 'auto', 
                                    whiteSpace: 'pre-wrap', 
                                    padding: '0.4rem', 
                                    background: 'var(--surface-elevated)', 
                                    borderRadius: '6px', 
                                    border: '1px solid var(--panel-border)',
                                    fontFamily: 'monospace',
                                    fontSize: '0.68rem'
                                  }}
                                >
                                  {item.attrs.content || '내용 없음'}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Bottom Actions / Footer */}
              {archive.length > 0 && (
                <div style={{ 
                  marginTop: '0.2rem', 
                  borderTop: '1px solid var(--panel-border)', 
                  paddingTop: '0.8rem',
                  display: 'flex',
                  justifyContent: 'flex-end'
                }}>
                  <button
                    onClick={() => {
                      if (confirm('휴지통을 완전히 비우시겠습니까? 모든 데이터가 영구히 삭제됩니다.')) {
                        emptyArchive();
                      }
                    }}
                    style={{ 
                      background: 'var(--danger-soft-bg)', 
                      border: '1px solid var(--danger-soft-border)', 
                      color: 'var(--danger)', 
                      fontSize: '0.75rem', 
                      fontWeight: 700, 
                      cursor: 'pointer',
                      padding: '0.45rem 0.8rem',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Trash2 size={12} />
                    휴지통 비우기
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
