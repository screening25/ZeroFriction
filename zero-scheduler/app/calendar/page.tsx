"use client";

import React from 'react';
import { format, addWeeks, subWeeks, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, Calendar } from 'lucide-react';
import { useApp } from '@/frontend/context/AppContext';
import { solarHolidays, lunarHolidays2026 } from '@/database';

const isHoliday = (date: Date) => solarHolidays.includes(format(date, 'MM-dd')) || lunarHolidays2026.includes(format(date, 'yyyy-MM-dd'));

export default function CalendarPage() {
  const {
    records,
    viewDate, setViewDate,
    selectedDate, setSelectedDate,
    calendarMode, setCalendarMode,
    editingSchedule, setEditingSchedule,
    toggleComplete, handleDeleteSchedule, handleUpdateSchedule
  } = useApp();

  const schedules = records.filter(r => r.type === 'event');

  // Calendar rendering logic
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
    .filter(s => s.attrs.date === selectedDateStr && !s.attrs.completed)
    .sort((a, b) => (a.attrs.time || '23:59').localeCompare(b.attrs.time || '23:59'));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      
      {/* Mini Title + Switch View (Highly Compact!) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <Calendar size={14} />
          <span>캘린더 뷰어</span>
        </div>
        <div style={{ display: 'flex', gap: '0.2rem', background: 'var(--panel-bg)', padding: '0.2rem', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
          {['monthly', 'weekly', 'daily'].map((mode) => (
            <button 
              key={mode} 
              onClick={() => setCalendarMode(mode as any)}
              style={{
                background: calendarMode === mode ? 'var(--hover-bg)' : 'transparent',
                border: 'none',
                color: calendarMode === mode ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '0.25rem 0.5rem',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {mode === 'monthly' ? '월간' : mode === 'weekly' ? '주간' : '일간'}
            </button>
          ))}
        </div>
      </div>
      
      {/* Calendar Grid Box (Density compressed, tighter gaps, smaller fonts!) */}
      <div style={{ background: 'var(--panel-bg)', padding: '0.5rem', borderRadius: '12px', border: '1px solid var(--panel-border)' }}>
        <div className="cal-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
          <button className="theme-toggle" onClick={navigatePrev} style={{ padding: '0.3rem' }}><ChevronLeft size={14} /></button>
          <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)' }}>{format(viewDate, calendarMode === 'daily' ? 'yyyy. MM. dd' : 'yyyy. MM')}</span>
          <button className="theme-toggle" onClick={navigateNext} style={{ padding: '0.3rem' }}><ChevronRight size={14} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: calendarMode === 'daily' ? '1fr' : 'repeat(7, 1fr)', gap: '0.18rem', textAlign: 'center' }}>
          {calendarMode !== 'daily' && ['일', '월', '화', '수', '목', '금', '토'].map(d => (
            <div key={d} style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', fontWeight: 600, paddingBottom: '0.2rem' }}>{d}</div>
          ))}
          {calendarMode === 'daily' && (
            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', fontWeight: 600, paddingBottom: '0.2rem' }}>{format(viewDate, 'EEEE')}</div>
          )}
          {days.map(day => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const hasSchedule = schedules.some(s => s.attrs.date === dayStr && !s.attrs.completed);
            const isSun = day.getDay() === 0;
            const isSat = day.getDay() === 6;
            const isHol = isHoliday(day);
            
            let dayColor = 'var(--text-primary)';
            if (isSun || isHol) dayColor = 'var(--danger)';
            else if (isSat) dayColor = 'var(--accent)';
            
            const isSel = isSameDay(day, selectedDate);
            const isTod = isToday(day);
            const isOutside = !isSameMonth(day, viewDate) && calendarMode === 'monthly';

            return (
              <div 
                key={day.toString()} 
                onClick={() => setSelectedDate(day)}
                style={{
                  position: 'relative',
                  aspectRatio: '1.1/1',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.78rem',
                  fontWeight: isSel || isTod ? 700 : 500,
                  color: isSel ? '#ffffff' : isOutside ? 'var(--text-tertiary)' : dayColor,
                  opacity: isOutside ? 0.35 : 1,
                  borderRadius: '6px',
                  background: isSel ? 'var(--accent)' : isTod ? 'var(--hover-bg)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <span>{format(day, 'd')}</span>
                {hasSchedule && <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: isSel ? '#ffffff' : 'var(--accent)', position: 'absolute', bottom: '3px' }} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Date Header */}
      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '0.1rem' }}>
        {format(selectedDate, 'M월 d일')} 주요 일정
      </div>
      
      {/* Selected Date Schedules list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {selectedSchedules.length === 0 ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px dashed var(--panel-border)',
            borderRadius: '10px',
            padding: '0.8rem',
            color: 'var(--text-secondary)',
            fontSize: '0.8rem',
            background: 'transparent'
          }}>등록된 일정이 존재하지 않습니다.</div>
        ) : (
          selectedSchedules.map((s, index) => {
            const orderNum = `#${String(index + 1).padStart(2, '0')}`;
            return (
              <div key={s.id} className="card card-compact" onClick={() => setEditingSchedule(s)} style={{ padding: '0.5rem 0.65rem', borderRadius: '10px', background: 'var(--panel-bg)', border: '1px solid var(--panel-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--text-tertiary)', width: '22px', flexShrink: 0 }}>
                    {orderNum}
                  </span>
                  <div onClick={(e) => toggleComplete(e, s)} style={{ color: s.attrs.completed ? 'var(--success)' : 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    {s.attrs.completed ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                  </div>
                  <span className="text-ellipsis whitespace-nowrap overflow-hidden" style={{ fontSize: '0.82rem', fontWeight: 600, color: s.attrs.completed ? 'var(--text-tertiary)' : 'var(--text-primary)', textDecoration: s.attrs.completed ? 'line-through' : 'none' }}>
                    {s.title}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0, marginLeft: '0.5rem' }}>
                  {s.attrs.time && <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{s.attrs.time}</span>}
                  {s.attrs.category && <span style={{ fontSize: '0.62rem', background: 'var(--hover-bg)', padding: '0.15rem 0.35rem', borderRadius: '4px', color: 'var(--text-secondary)' }}>{s.attrs.category}</span>}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Schedule Edit Modal */}
      <AnimatePresence>
        {editingSchedule && (
          <div className="modal-overlay" onClick={() => setEditingSchedule(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} transition={{ duration: 0.15 }} className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="ios-modal-header">
                <button className="ios-text-btn" onClick={() => setEditingSchedule(null)}>취소</button>
                <div className="ios-modal-title">상세 정보</div>
                <button className="ios-text-btn bold" onClick={() => handleUpdateSchedule(editingSchedule.id, editingSchedule)}>저장 완료</button>
              </div>
              
              <div className="form-group">
                <span className="form-label">제목</span>
                <input type="text" className="input-sm" value={editingSchedule.title} onChange={e => setEditingSchedule({...editingSchedule, title: e.target.value})} />
              </div>
              
              <div style={{ display: 'flex', gap: '0.8rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <span className="form-label">날짜</span>
                  <input type="date" className="input-sm" value={editingSchedule.attrs.date || ''} onChange={e => setEditingSchedule({...editingSchedule, attrs: { ...editingSchedule.attrs, date: e.target.value }})} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <span className="form-label">시간</span>
                  <input type="time" className="input-sm" value={editingSchedule.attrs.time || ''} onChange={e => setEditingSchedule({...editingSchedule, attrs: { ...editingSchedule.attrs, time: e.target.value }})} />
                </div>
              </div>
              
              <div className="form-group">
                <span className="form-label">메모</span>
                <textarea rows={2} className="input-sm" value={editingSchedule.attrs.memo || ''} onChange={e => setEditingSchedule({...editingSchedule, attrs: { ...editingSchedule.attrs, memo: e.target.value }})} />
              </div>
              
              <div style={{ display: 'flex', gap: '0.8rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <span className="form-label">알림 설정</span>
                  <select 
                    className="input-sm" 
                    value={editingSchedule.attrs.notifyOffset ?? 10} 
                    onChange={e => setEditingSchedule({...editingSchedule, attrs: { ...editingSchedule.attrs, notifyOffset: Number(e.target.value) }})}
                  >
                    <option value={-1}>알림 없음</option>
                    <option value={0}>정각</option>
                    <option value={10}>10분 전</option>
                    <option value={30}>30분 전</option>
                    <option value={60}>1시간 전</option>
                    <option value={1440}>1일 전</option>
                  </select>
                </div>
              </div>
              
              <label className="custom-checkbox">
                <input type="checkbox" checked={!!editingSchedule.attrs.completed} onChange={e => setEditingSchedule({...editingSchedule, attrs: { ...editingSchedule.attrs, completed: e.target.checked }})} />
                <span>완료 처리</span>
              </label>
              
              <button className="ios-delete-btn" onClick={() => handleDeleteSchedule(editingSchedule.id)}>일정 삭제</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
    </div>
  );
}
