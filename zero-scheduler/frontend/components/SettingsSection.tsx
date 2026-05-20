"use client";

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Download, Upload, AlertTriangle, Settings, Trash2, RotateCcw, X } from 'lucide-react';
import { useApp } from '@/frontend/context/AppContext';
import { ACCENT_COLORS } from '@/database';
import { AnimatePresence, motion } from 'framer-motion';
import { useNotifications } from '@/frontend/hooks/useNotifications';
import { format, parseISO } from 'date-fns';
import { createPortal } from 'react-dom';

interface CustomSelectCompactProps {
  value: string | number;
  options: { value: string | number; label: string }[];
  onChange: (val: any) => void;
}

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

export default function SettingsSection() {
  const {
    theme,
    appSettings,
    handleSettingsChange,
    setActiveTab,
    showToast,
    reloadRecords,
    logActivity,
    archive,
    restoreArchived,
    permanentDelete,
    emptyArchive,
    clearActivities,
    exportToCsv
  } = useApp();

  const fileRef = useRef<HTMLInputElement>(null);
  const [localSettings, setLocalSettings] = useState({ ...appSettings });
  const [isTrashModalOpen, setIsTrashModalOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [settingsToast, setSettingsToast] = useState(false);
  const settingsToastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const prevDeviceSizeRef = useRef(appSettings.deviceSize);
  const { permission, requestPermission } = useNotifications();

  // Keep localSettings in sync with appSettings
  useEffect(() => {
    setLocalSettings({ ...appSettings });
    prevDeviceSizeRef.current = appSettings.deviceSize;
  }, [appSettings]);

  const updateSingleSetting = (newSettings: typeof appSettings) => {
    setLocalSettings(newSettings);
    handleSettingsChange(newSettings);
    if (typeof window !== 'undefined') {
      localStorage.setItem('zero_settings', JSON.stringify(newSettings));

      // Apple Electron dynamic responsive frame resize logic!
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

  const handleSaveSettings = () => {
    setSaveStatus('saving');
    handleSettingsChange(localSettings);
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => {
        setSaveStatus('idle');
        setActiveTab('all');
        setSettingsToast(true);
        setTimeout(() => {
          setSettingsToast(false);
        }, 2000);
      }, 500);
    }, 400);
  };

  // Export all databases into unified premium Zero Backup JSON!
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

  // Import complete system backup and verify structural schemas!
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
              value={localSettings.defaultNotifyOffset ?? 10}
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
                  const title = 'Zero-Friction 알림 테스트';
                  const body = localSettings.notificationType === 'browser'
                    ? 'OS 표준 슬라이드 배너 알림이 정상 작동 중입니다!'
                    : '시스템 다이얼로그 경고창이 정상 작동 중입니다!';

                  if (localSettings.notificationType === 'browser') {
                    if (typeof window !== 'undefined') {
                      if ((window as any).__IS_ELECTRON__ && (window as any).ipcRenderer) {
                        (window as any).ipcRenderer.send('send-notification', { title, body });
                        showToast('테스트 배너 알림을 발송했습니다.');
                        return;
                      } else if ('Notification' in window && Notification.permission === 'granted') {
                        new Notification(title, { body });
                        showToast('테스트 배너 알림을 발송했습니다.');
                        return;
                      } else if ('Notification' in window && Notification.permission === 'denied') {
                        showToast('시스템 알림 권한이 거부되어 알림을 발송할 수 없습니다.');
                        return;
                      }
                    }
                  }

                  // Web/Local API fallback
                  const res = await fetch('/api/notify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      title,
                      body,
                      type: localSettings.notificationType || 'system'
                    })
                  });
                  if (res.ok) {
                    showToast(localSettings.notificationType === 'browser'
                      ? '테스트 배너 알림이 발송되었습니다.'
                      : '테스트 알림창이 발송되었습니다.'
                    );
                  } else {
                    showToast('알림 발송에 실패했습니다.');
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
                maxWidth: '440px', 
                borderRadius: '20px', 
                padding: '1.25rem', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '1rem', 
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
                  onClick={() => setIsTrashModalOpen(false)} 
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
                borderBottom: '1px solid var(--panel-border)',
                paddingBottom: '0.75rem'
              }}>
                휴지통의 데이터는 최대 200개까지 보관되며, 언제든지 원래 탭으로 복구하거나 영구히 삭제할 수 있습니다.
              </div>

              {/* Trash Items List */}
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '0.6rem', 
                maxHeight: '350px', 
                overflowY: 'auto',
                paddingRight: '2px'
              }}>
                {archive.length === 0 ? (
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
                    <span>휴지통이 비어 있습니다.</span>
                  </div>
                ) : (
                  archive.map((item) => {
                    const formattedDate = item.archivedAt 
                      ? format(parseISO(item.archivedAt), 'yy.MM.dd HH:mm') 
                      : '';
                    const typeLabel = item.type === 'event' ? '일정' : item.type === 'asset' ? '재고' : '메모';
                    
                    // Type-specific badge styling
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

                    return (
                      <div 
                        key={item.id} 
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          padding: '0.65rem 0.8rem', 
                          background: 'var(--surface-elevated)', 
                          border: '1px solid var(--panel-border)', 
                          borderRadius: '10px',
                          gap: '0.75rem'
                        }}
                      >
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
                            onClick={() => restoreArchived(item.id)}
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
                            onClick={() => {
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
                    );
                  })
                )}
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

      {/* Settings Saved Toast (Instant overlay within Settings!) */}
      <AnimatePresence>
        {settingsToast && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[70] bg-zinc-800 text-white rounded-full px-4 py-1.5 text-xs shadow-md" style={{ position: 'fixed', top: '1.5rem', left: '50%', transform: 'translateX(-50%)', zIndex: 70, backgroundColor: '#27272a', color: '#ffffff', borderRadius: '9999px', padding: '0.375rem 1rem', fontSize: '0.75rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)' }}>
            설정이 변경되었습니다.
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
