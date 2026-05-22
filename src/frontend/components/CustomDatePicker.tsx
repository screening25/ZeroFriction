"use client";

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar as CalIcon, ChevronLeft, ChevronRight
} from 'lucide-react';
import {
  format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, addMonths, subMonths, isSameMonth, isSameDay, isToday
} from 'date-fns';

interface CustomDatePickerProps {
  value: string; // "YYYY-MM-DD"
  onChange: (newValue: string) => void;
}

/**
 * CustomTimePicker / CustomSelect 와 동일한 디자인 언어를 따르는
 * 토큰 기반 커스텀 달력 드롭다운. 네이티브 input[type=date] 대체.
 */
export default function CustomDatePicker({ value, onChange }: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const selectedDate = value ? parseISO(value) : new Date();
  const [viewMonth, setViewMonth] = useState<Date>(selectedDate);

  // value 변경 시 보이는 달도 동기화
  useEffect(() => {
    if (value) setViewMonth(parseISO(value));
  }, [value]);

  const updateCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const margin = 8;
      const popWidth = Math.min(280, window.innerWidth - margin * 2);
      const estHeight = 340; // 달력 예상 높이

      let left = rect.left;
      if (left + popWidth > window.innerWidth - margin) {
        left = window.innerWidth - popWidth - margin;
      }
      if (left < margin) left = margin;

      const spaceBelow = window.innerHeight - rect.bottom;
      let top: number;
      if (spaceBelow < estHeight && rect.top > estHeight) {
        top = rect.top - estHeight - 6;
      } else {
        top = rect.bottom + 6;
      }

      setCoords({ top, left, width: popWidth });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      window.addEventListener('resize', updateCoords);
      window.addEventListener('scroll', updateCoords, true);
    }
    return () => {
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('scroll', updateCoords, true);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(monthStart);
  const days = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 0 }),
    end: endOfWeek(monthEnd, { weekStartsOn: 0 })
  });

  const displayLabel = value ? format(parseISO(value), 'yyyy년 M월 d일') : '날짜 선택';

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="input-sm"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          textAlign: 'left',
          cursor: 'pointer',
          height: '38px',
          padding: '0 0.75rem',
          fontSize: '0.85rem',
          background: 'var(--input-bg)',
          border: isOpen ? '1px solid var(--accent)' : '1px solid var(--panel-border)',
          boxShadow: isOpen ? '0 0 0 3px var(--accent-glow)' : 'none',
          borderRadius: '10px',
          color: 'var(--text-primary)',
          fontWeight: 500
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <CalIcon size={13} style={{ color: 'var(--accent)' }} />
          <span>{displayLabel}</span>
        </span>
      </button>

      {isOpen && typeof window !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            zIndex: 99999,
            width: `${coords.width}px`,
            backgroundColor: 'var(--input-bg)',
            border: '1px solid var(--panel-border)',
            borderRadius: '12px',
            boxShadow: '0 8px 30px var(--shadow-color)',
            padding: '0.8rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
            animation: 'fadeIn 0.15s ease'
          }}
        >
          {/* Month navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              type="button"
              onClick={() => setViewMonth(subMonths(viewMonth, 1))}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: '0.25rem', borderRadius: '6px' }}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {format(viewMonth, 'yyyy년 M월')}
            </span>
            <button
              type="button"
              onClick={() => setViewMonth(addMonths(viewMonth, 1))}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: '0.25rem', borderRadius: '6px' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Weekday header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.1rem' }}>
            {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
              <div
                key={d}
                style={{
                  textAlign: 'center',
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  color: i === 0 ? 'var(--danger)' : i === 6 ? 'var(--accent)' : 'var(--text-tertiary)'
                }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.15rem' }}>
            {days.map(day => {
              const inMonth = isSameMonth(day, viewMonth);
              const selected = value && isSameDay(day, parseISO(value));
              const today = isToday(day);
              const dow = day.getDay();
              let textColor = 'var(--text-primary)';
              if (!inMonth) textColor = 'var(--text-tertiary)';
              else if (dow === 0) textColor = 'var(--danger)';
              else if (dow === 6) textColor = 'var(--accent)';

              return (
                <button
                  key={day.toString()}
                  type="button"
                  onClick={() => { onChange(format(day, 'yyyy-MM-dd')); setIsOpen(false); }}
                  style={{
                    aspectRatio: '1 / 1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: today && !selected ? '1px solid var(--accent)' : '1px solid transparent',
                    borderRadius: '8px',
                    fontSize: '0.72rem',
                    fontWeight: selected ? 800 : 600,
                    cursor: 'pointer',
                    background: selected ? 'var(--accent)' : 'transparent',
                    color: selected ? '#ffffff' : textColor,
                    opacity: inMonth ? 1 : 0.4,
                    transition: 'all 0.1s ease'
                  }}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>

          {/* Today shortcut */}
          <button
            type="button"
            onClick={() => { onChange(format(new Date(), 'yyyy-MM-dd')); setIsOpen(false); }}
            style={{
              background: 'var(--accent-soft-bg)',
              color: 'var(--accent)',
              border: 'none',
              borderRadius: '8px',
              padding: '0.4rem',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            오늘로 이동
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
