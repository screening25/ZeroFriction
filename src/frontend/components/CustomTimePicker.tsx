import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Clock } from 'lucide-react';

interface CustomTimePickerProps {
  value: string; // "HH:MM" 24h format
  onChange: (newValue: string) => void;
}

export default function CustomTimePicker({ value, onChange }: CustomTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  // Parse current value
  const parseTime = (timeStr: string) => {
    const parts = (timeStr || "12:00").split(':');
    let hour = parseInt(parts[0], 10);
    const minute = parts[1] || "00";
    
    const isPM = hour >= 12;
    if (hour > 12) hour -= 12;
    if (hour === 0) hour = 12;
    
    return {
      isPM,
      hourStr: String(hour),
      minuteStr: minute
    };
  };

  const { isPM, hourStr, minuteStr } = parseTime(value);

  // Update coords when opening or resizing — 화면 밖으로 나가지 않도록 클램프 + 위/아래 플립
  const updateCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const margin = 8;
      const popWidth = Math.min(280, window.innerWidth - margin * 2);
      const estHeight = 330; // 시간 피커 예상 높이

      // 좌우 클램프
      let left = rect.left + window.scrollX;
      if (left + popWidth > window.innerWidth - margin) {
        left = window.innerWidth - popWidth - margin;
      }
      if (left < margin) left = margin;

      // 아래 공간이 부족하면 위로 플립
      const spaceBelow = window.innerHeight - rect.bottom;
      let top: number;
      if (spaceBelow < estHeight && rect.top > estHeight) {
        top = rect.top + window.scrollY - estHeight - 6;
      } else {
        top = rect.bottom + window.scrollY + 6;
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

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (newIsPM: boolean, newHourStr: string, newMinStr: string) => {
    let h = parseInt(newHourStr, 10);
    if (newIsPM) {
      if (h < 12) h += 12;
    } else {
      if (h === 12) h = 0;
    }
    const hStr = String(h).padStart(2, '0');
    onChange(`${hStr}:${newMinStr}`);
  };

  const hours = Array.from({ length: 12 }, (_, i) => String(i + 1));
  const minutes = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

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
          border: '1px solid var(--panel-border)',
          borderRadius: '10px',
          color: 'var(--text-primary)',
          fontWeight: 500
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Clock size={13} style={{ color: 'var(--accent)' }} />
          <span>{isPM ? '오후' : '오전'} {hourStr.padStart(2, '0')}:{minuteStr}</span>
        </span>
      </button>

      {isOpen && typeof window !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          style={{
            position: 'absolute',
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
            gap: '0.75rem',
            animation: 'fadeIn 0.15s ease'
          }}
        >
          {/* AM / PM Segmented Control */}
          <div style={{ display: 'flex', background: 'var(--row-bg)', padding: '2px', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
            <button
              type="button"
              onClick={() => handleSelect(false, hourStr, minuteStr)}
              style={{
                flex: 1,
                padding: '0.3rem',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: !isPM ? 'var(--accent)' : 'transparent',
                color: !isPM ? '#ffffff' : 'var(--text-secondary)',
                transition: 'all 0.1s ease'
              }}
            >
              오전
            </button>
            <button
              type="button"
              onClick={() => handleSelect(true, hourStr, minuteStr)}
              style={{
                flex: 1,
                padding: '0.3rem',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: isPM ? 'var(--accent)' : 'transparent',
                color: isPM ? '#ffffff' : 'var(--text-secondary)',
                transition: 'all 0.1s ease'
              }}
            >
              오후
            </button>
          </div>

          {/* Hour Selector (Grid) */}
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: '0.3rem', paddingLeft: '0.2rem' }}>시 (Hour)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.25rem' }}>
              {hours.map(h => {
                const isSelected = hourStr === h;
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => handleSelect(isPM, h, minuteStr)}
                    style={{
                      padding: '0.3rem 0',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      backgroundColor: isSelected ? 'var(--accent-soft-bg)' : 'transparent',
                      color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: isSelected ? 'var(--accent)' : 'transparent',
                      transition: 'all 0.1s ease'
                    }}
                  >
                    {h}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Minute Selector (Grid) */}
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: '0.3rem', paddingLeft: '0.2rem' }}>분 (Minute)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.25rem' }}>
              {minutes.map(m => {
                const isSelected = minuteStr === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleSelect(isPM, hourStr, m)}
                    style={{
                      padding: '0.3rem 0',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      backgroundColor: isSelected ? 'var(--accent-soft-bg)' : 'transparent',
                      color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: isSelected ? 'var(--accent)' : 'transparent',
                      transition: 'all 0.1s ease'
                    }}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
