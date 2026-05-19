"use client";

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Download, Upload, AlertTriangle, Settings } from 'lucide-react';
import { useApp } from '@/frontend/context/AppContext';
import { ACCENT_COLORS } from '@/database';
import { AnimatePresence, motion } from 'framer-motion';

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
  } = useApp();

  const fileRef = useRef<HTMLInputElement>(null);
  const [localSettings, setLocalSettings] = useState({ ...appSettings });
  const [isTrashModalOpen, setIsTrashModalOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [settingsToast, setSettingsToast] = useState(false);
  const settingsToastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const prevDeviceSizeRef = useRef(appSettings.deviceSize);

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
      <div className="settings-section" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--surface-elevated-border)', borderRadius: '14px', padding: '0.65rem 0.8rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', textAlign: 'left' }}>AI 연동 설정</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>AI API Key</span>
          <input
            type="password"
            className="input-sm"
            placeholder="API Key 입력"
            value={localSettings.apiKey}
            onChange={e => {
              const updated = { ...localSettings, apiKey: e.target.value };
              updateSingleSetting(updated);
            }}
            style={{
              width: '150px',
              padding: '0.25rem 0.5rem',
              borderRadius: '6px',
              border: '1px solid var(--panel-border)',
              background: 'var(--surface-color)',
              color: 'var(--text-primary)',
              fontSize: '0.72rem',
              outline: 'none',
              boxShadow: 'none'
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

      {/* Display Settings */}
      <div className="settings-section" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--surface-elevated-border)', borderRadius: '14px', padding: '0.65rem 0.8rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', textAlign: 'left' }}>디스플레이 설정</div>

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
                    // Apple-style Double Ring highlight
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
          <select
            className="settings-select-compact"
            value={localSettings.density}
            onChange={e => {
              const updated = { ...localSettings, density: e.target.value as any };
              updateSingleSetting(updated);
            }}
          >
            <option value="compact">조밀하게</option>
            <option value="cozy">여유있게</option>
          </select>
        </div>

        <div className="flex items-center justify-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0' }}>
          <span className="settings-label-compact">시간 표기 방식</span>
          <select
            className="settings-select-compact"
            value={localSettings.timeFormat}
            onChange={e => {
              const updated = { ...localSettings, timeFormat: e.target.value as any };
              updateSingleSetting(updated);
            }}
          >
            <option value="12h">12시간</option>
            <option value="24h">24시간</option>
          </select>
        </div>
      </div>

      {/* Content Settings */}
      <div className="settings-section" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--surface-elevated-border)', borderRadius: '14px', padding: '0.65rem 0.8rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', textAlign: 'left' }}>콘텐츠 표시 설정</div>

        <div className="flex items-center justify-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0' }}>
          <span className="settings-label-compact">달력 시작 요일</span>
          <select
            className="settings-select-compact"
            value={localSettings.weekStartsOn}
            onChange={e => {
              const updated = { ...localSettings, weekStartsOn: Number(e.target.value) as any };
              updateSingleSetting(updated);
            }}
          >
            <option value={0}>일요일</option>
            <option value={1}>월요일</option>
          </select>
        </div>

        <div className="flex items-center justify-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0' }}>
          <span className="settings-label-compact">일정 노출 개수</span>
          <select
            className="settings-select-compact"
            value={localSettings.maxEventsShown}
            onChange={e => {
              const updated = { ...localSettings, maxEventsShown: Number(e.target.value) };
              updateSingleSetting(updated);
            }}
          >
            <option value={2}>2개</option>
            <option value={3}>3개</option>
            <option value={4}>4개</option>
            <option value={5}>5개</option>
          </select>
        </div>

        <div className="flex items-center justify-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0' }}>
          <span className="settings-label-compact">재고 노출 개수</span>
          <select
            className="settings-select-compact"
            value={localSettings.maxInventoryShown}
            onChange={e => {
              const updated = { ...localSettings, maxInventoryShown: Number(e.target.value) };
              updateSingleSetting(updated);
            }}
          >
            <option value={3}>3개</option>
            <option value={5}>5개</option>
            <option value={10}>10개</option>
          </select>
        </div>

        <div className="flex items-center justify-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0' }}>
          <span className="settings-label-compact">메모 노출 개수</span>
          <select
            className="settings-select-compact"
            value={localSettings.maxMemosShown}
            onChange={e => {
              const updated = { ...localSettings, maxMemosShown: Number(e.target.value) };
              updateSingleSetting(updated);
            }}
          >
            <option value={4}>4개</option>
            <option value={6}>6개</option>
            <option value={8}>8개</option>
          </select>
        </div>
      </div>

      {/* 데이터 관리 (Consolidated Data Management) */}
      <div className="settings-section" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--surface-elevated-border)', borderRadius: '14px', padding: '0.65rem 0.8rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', textAlign: 'left' }}>데이터 관리</div>

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


      {/* Soft Delete Trash Modal (Instant overlay within Settings!) */}
      <AnimatePresence>
        {isTrashModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center backdrop-blur-md bg-white/95 dark:bg-zinc-900/95 p-4" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
            <style>{`.group:hover .group-hover\\:opacity-100 { opacity: 1 !important; }`}</style>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} transition={{ duration: 0.15 }} className="w-full max-w-md bg-white dark:bg-zinc-800 rounded-2xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-700 flex flex-col gap-4" style={{ width: '100%', maxWidth: '400px', borderRadius: '16px', padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid var(--panel-border)', background: 'var(--bg-color)', boxShadow: '0 15px 45px rgba(0,0,0,0.25)' }}>
              <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50" style={{ fontSize: '1.1rem', fontWeight: 800 }}>휴지통 ({archive.length})</h3>
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                  {archive.length > 0 && (
                    <button
                      className="text-sm cursor-pointer"
                      onClick={() => {
                        if (confirm('휴지통을 완전히 비우시겠습니까? 모든 데이터가 영구히 삭제됩니다.')) {
                          emptyArchive();
                        }
                      }}
                      style={{ background: 'transparent', border: 'none', color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      전체 비우기
                    </button>
                  )}
                  <button className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 cursor-pointer" onClick={() => setIsTrashModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>닫기</button>
                </div>
              </div>
              <div className="flex flex-col gap-2 overflow-y-auto max-h-[300px]" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
                {archive.length === 0 ? (
                  <div className="text-center text-zinc-500 text-sm py-8" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>휴지통이 비어 있습니다.</div>
                ) : (
                  archive.map((item, idx) => (
                    <div key={item.id} className="group flex justify-between items-center p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700/50 hover:bg-zinc-100 dark:hover:bg-zinc-800" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.7rem', background: 'var(--row-bg)', border: '1px solid var(--row-border)', borderRadius: '8px' }}>
                      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200" style={{ fontSize: '0.85rem', color: 'var(--text-primary)', textAlign: 'left' }}>
                        #{String(idx + 1).padStart(2, '0')} {item.title || '(제목 없음)'}
                        <span className="text-xs text-zinc-400 dark:text-zinc-500 ml-2" style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginLeft: '0.5rem' }}>
                          ({item.type === 'event' ? '일정' : item.type === 'asset' ? '재고' : '메모'})
                        </span>
                      </span>
                      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                        <button
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => restoreArchived(item.id)}
                          style={{ fontSize: '0.72rem', fontWeight: 700, color: '#3b82f6', background: 'transparent', border: 'none', cursor: 'pointer' }}
                        >
                          복구
                        </button>
                        <button
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => {
                            if (confirm('이 항목을 영구 삭제하시겠습니까?')) {
                              permanentDelete(item.id);
                            }
                          }}
                          style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--danger)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
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
