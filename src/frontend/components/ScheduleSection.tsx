'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { format, addWeeks, subWeeks, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, Plus, X, Tag, ChevronDown, Sliders, FileSpreadsheet, Printer } from 'lucide-react';
import { useApp } from '@/frontend/context/AppContext';
import { hexToRgb, getCategoryColorStyles } from '@/frontend/utils/styles';
import { isHoliday } from '@/frontend/utils/calendar';
import type { UniversalRecord } from '@/database';

/**
 * 일정 캘린더 탭 섹션 (page.tsx에서 추출 — 동작 동일).
 * 월간/주간/일간 캘린더, 선택 날짜의 일정 목록(카테고리 필터·페이지네이션),
 * 일정 카테고리 마스터 설정 모달(색상 지정), Excel/PDF 내보내기 포함.
 */
export default function ScheduleSection({ schedules, sortedClients }: { schedules: UniversalRecord[]; sortedClients: string[] }) {
  const {
    records, appSettings, handleSettingsChange, showToast,
    calendarMode, setCalendarMode, viewDate, setViewDate,
    selectedDate, setSelectedDate, setEditingSchedule,
    toggleComplete, handleDeleteSchedule, handleDuplicateSchedule,
    exportToCsv, printToPdf,
  } = useApp();

  const clientSortDir = appSettings.clientSort || 'asc';

  const getCategoryColor = (cat: string) => getCategoryColorStyles(cat, appSettings.categoryColors).solid;
  const getCategorySoftBg = (cat: string) => getCategoryColorStyles(cat, appSettings.categoryColors).soft;
  const getCategoryBorder = (cat: string) => getCategoryColorStyles(cat, appSettings.categoryColors).border;

  const [selectedCategoryColor, setSelectedCategoryColor] = useState('#AF52DE');
  const [selectedScheduleCategory, setSelectedScheduleCategory] = useState<string>('전체');
  const [schedulePage, setSchedulePage] = useState<number>(0);

  useEffect(() => {
    setSchedulePage(0);
  }, [selectedScheduleCategory, selectedDate]);

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

  const [newClientInput, setNewClientInput] = useState('');

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

  useEffect(() => {
    if (schedulePage >= scheduleTotalPages && scheduleTotalPages > 0) {
      setSchedulePage(scheduleTotalPages - 1);
    } else if (scheduleTotalPages === 0) {
      setSchedulePage(0);
    }
  }, [scheduleTotalPages, schedulePage]);

  // Dynamic isolated category pools
  const scheduleCategories = ['전체', ...(appSettings.scheduleCategories || ['업무', '회의', '개인', '일반'])];

  // Check if filtering is dynamically required (Only show bar if there are meaningful custom categories!)
  const showScheduleFilterBar = scheduleCategories.filter(c => c !== '전체').length >= 1;

  return (
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
  );
}
