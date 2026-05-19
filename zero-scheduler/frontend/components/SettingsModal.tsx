"use client";
import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Settings, Download, Upload, AlertTriangle } from 'lucide-react';
import { AppSettings, DEFAULT_SETTINGS, ACCENT_COLORS, persistSettings, exportAllData, importAllData, clearAllData } from '@/database';

export default function SettingsModal({ settings, setSettings, onClose, theme }: { settings: AppSettings; setSettings: (s: AppSettings) => void; onClose: () => void; theme: string }) {
  const [local, setLocal] = useState<AppSettings>({ ...settings });
  const fileRef = useRef<HTMLInputElement>(null);

  const update = (patch: Partial<AppSettings>) => {
    setLocal(prev => {
      const next = { ...prev, ...patch };
      persistSettings(next);
      setSettings(next);
      return next;
    });
  };

  const handleExport = () => {
    const blob = new Blob([exportAllData()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `zero-friction-backup-${new Date().toISOString().split('T')[0]}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { if (importAllData(ev.target?.result as string)) { window.location.reload(); } };
    reader.readAsText(file);
  };

  const handleClear = () => { if (confirm('정말로 모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) { clearAllData(); window.location.reload(); } };

  const currentAccents = ACCENT_COLORS.map(c => theme === 'dark' ? { ...c, value: c.dark } : c);

  return (
    <div 
      className="popover-overlay" 
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'transparent',
        zIndex: 999,
        cursor: 'default'
      }}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: -10 }} 
        animate={{ scale: 1, opacity: 1, y: 0 }} 
        exit={{ scale: 0.95, opacity: 0, y: -10 }} 
        transition={{ duration: 0.15 }} 
        className="modal-content" 
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute',
          right: '1.2rem',
          top: '4.8rem',
          width: '320px',
          maxHeight: '550px',
          background: 'var(--panel-bg)',
          backdropFilter: 'var(--panel-blur)',
          WebkitBackdropFilter: 'var(--panel-blur)',
          border: '1px solid var(--panel-border)',
          borderRadius: '18px',
          boxShadow: '0 15px 45px var(--shadow-color)',
          overflowY: 'auto',
          padding: '1.2rem 1.0rem',
          display: 'flex', 
          flexDirection: 'column', 
          gap: '1.0rem',
          zIndex: 1000
        }}
      >
        <div className="ios-modal-header" style={{ borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.4rem', marginBottom: '0.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="ios-modal-title" style={{ fontSize: '1rem', fontWeight: 700 }}>환경설정</div>
          <button className="ios-text-btn bold" onClick={onClose} style={{ fontSize: '0.85rem', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>닫기</button>
        </div>

        {/* API Key */}
        <div className="settings-section">
          <div className="settings-section-title">AI 연동</div>
          <div className="settings-group">
            <div className="settings-row" style={{ padding: '0.6rem 0.8rem' }}>
              <span className="settings-label" style={{ fontSize: '0.82rem' }}>Gemini API Key</span>
              <input className="settings-input" type="password" placeholder="키를 입력하세요" value={local.apiKey} onChange={e => update({ apiKey: e.target.value })} style={{ width: '130px', fontSize: '0.8rem' }} />
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="settings-section">
          <div className="settings-section-title">디스플레이</div>
          <div className="settings-group">
            <div className="settings-row" style={{ padding: '0.6rem 0.8rem' }}>
              <span className="settings-label" style={{ fontSize: '0.82rem' }}>포인트 색상</span>
              <div className="color-chips">
                {currentAccents.map(c => (
                  <div key={c.name} className={`color-chip ${local.accentColor === c.value ? 'active' : ''}`} style={{ background: c.value, color: c.value, width: '18px', height: '18px' }} onClick={() => update({ accentColor: c.value })} />
                ))}
              </div>
            </div>
            <div className="settings-row" style={{ padding: '0.6rem 0.8rem' }}>
              <span className="settings-label" style={{ fontSize: '0.82rem' }}>UI 밀도</span>
              <select className="settings-select" value={local.density} onChange={e => update({ density: e.target.value as any })} style={{ fontSize: '0.8rem' }}>
                <option value="compact">Compact</option>
                <option value="comfortable">Comfortable</option>
              </select>
            </div>
            <div className="settings-row" style={{ padding: '0.6rem 0.8rem' }}>
              <span className="settings-label" style={{ fontSize: '0.82rem' }}>시간 표기</span>
              <select className="settings-select" value={local.timeFormat} onChange={e => update({ timeFormat: e.target.value as any })} style={{ fontSize: '0.8rem' }}>
                <option value="24h">24시간</option>
                <option value="12h">12시간</option>
              </select>
            </div>
          </div>
        </div>

        {/* Calendar & Content */}
        <div className="settings-section">
          <div className="settings-section-title">캘린더 및 콘텐츠</div>
          <div className="settings-group">
            <div className="settings-row" style={{ padding: '0.6rem 0.8rem' }}>
              <span className="settings-label" style={{ fontSize: '0.82rem' }}>기본 캘린더 뷰</span>
              <select className="settings-select" value={local.calendarView} onChange={e => update({ calendarView: e.target.value as any })} style={{ fontSize: '0.8rem' }}>
                <option value="monthly">월간</option>
                <option value="weekly">주간</option>
                <option value="daily">일간</option>
              </select>
            </div>
            <div className="settings-row" style={{ padding: '0.6rem 0.8rem' }}>
              <span className="settings-label" style={{ fontSize: '0.82rem' }}>주의 시작일</span>
              <select className="settings-select" value={local.weekStartsOn} onChange={e => update({ weekStartsOn: Number(e.target.value) as any })} style={{ fontSize: '0.8rem' }}>
                <option value={0}>일요일</option>
                <option value={1}>월요일</option>
              </select>
            </div>
            <div className="settings-row" style={{ padding: '0.6rem 0.8rem' }}>
              <span className="settings-label" style={{ fontSize: '0.82rem' }}>일정 노출 개수</span>
              <select className="settings-select" value={local.maxEventsShown} onChange={e => update({ maxEventsShown: Number(e.target.value) })} style={{ fontSize: '0.8rem' }}>
                <option value={3}>3개씩</option>
                <option value={5}>5개씩</option>
                <option value={10}>10개씩</option>
              </select>
            </div>
            <div className="settings-row" style={{ padding: '0.6rem 0.8rem' }}>
              <span className="settings-label" style={{ fontSize: '0.82rem' }}>재고 노출 개수</span>
              <select className="settings-select" value={local.maxInventoryShown} onChange={e => update({ maxInventoryShown: Number(e.target.value) })} style={{ fontSize: '0.8rem' }}>
                <option value={3}>3개씩</option>
                <option value={5}>5개씩</option>
                <option value={10}>10개씩</option>
              </select>
            </div>
            <div className="settings-row" style={{ padding: '0.6rem 0.8rem' }}>
              <span className="settings-label" style={{ fontSize: '0.82rem' }}>변동사항 노출 개수</span>
              <select className="settings-select" value={local.maxMemosShown} onChange={e => update({ maxMemosShown: Number(e.target.value) })} style={{ fontSize: '0.8rem' }}>
                <option value={3}>3개씩</option>
                <option value={5}>5개씩</option>
                <option value={10}>10개씩</option>
              </select>
            </div>
            <div className="settings-row" style={{ padding: '0.6rem 0.8rem' }}>
              <span className="settings-label" style={{ fontSize: '0.82rem' }}>기본 알림 시간</span>
              <select className="settings-select" value={local.defaultNotifyOffset} onChange={e => update({ defaultNotifyOffset: Number(e.target.value) })} style={{ fontSize: '0.8rem' }}>
                <option value={-1}>알림 없음</option>
                <option value={0}>정각</option>
                <option value={10}>10분 전</option>
                <option value={30}>30분 전</option>
                <option value={60}>1시간 전</option>
              </select>
            </div>
          </div>
        </div>

        {/* Data Management */}
        <div className="settings-section">
          <div className="settings-section-title">데이터 관리</div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button className="data-btn" onClick={handleExport} style={{ padding: '0.6rem', fontSize: '0.8rem' }}><Download size={12} /> 내보내기</button>
            <button className="data-btn" onClick={() => fileRef.current?.click()} style={{ padding: '0.6rem', fontSize: '0.8rem' }}><Upload size={12} /> 불러오기</button>
            <input ref={fileRef} type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
          </div>
        </div>

        {/* Danger Zone */}
        <div className="danger-zone" style={{ padding: '0.8rem', gap: '0.4rem' }}>
          <div className="danger-zone-title" style={{ fontSize: '0.75rem' }}><AlertTriangle size={10} /> DANGER ZONE</div>
          <button className="data-btn danger-btn" onClick={handleClear} style={{ padding: '0.6rem', fontSize: '0.8rem' }}>모든 데이터 초기화</button>
        </div>
      </motion.div>
    </div>
  );
}
