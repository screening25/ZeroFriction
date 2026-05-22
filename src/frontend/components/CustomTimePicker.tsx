import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Clock, ChevronUp, ChevronDown } from 'lucide-react';
import { useApp } from '@/frontend/context/AppContext';

interface CustomTimePickerProps {
  value: string; // "HH:MM" 24h format
  onChange: (newValue: string) => void;
}

export default function CustomTimePicker({ value, onChange }: CustomTimePickerProps) {
  const { theme } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const isDark = theme === 'dark';

  // Parse current value
  const parseTime = (timeStr: string) => {
    const parts = (timeStr || "12:00").split(':');
    let hour = parseInt(parts[0], 10);
    let minute = parseInt(parts[1], 10);

    if (isNaN(hour) || hour < 0 || hour > 23) hour = 12;
    if (isNaN(minute) || minute < 0 || minute > 59) minute = 0;
    
    return { hour, minute };
  };

  const { hour, minute } = parseTime(value);

  const hourStr = String(hour).padStart(2, '0');
  const minuteStr = String(minute).padStart(2, '0');

  // Local state for typed time
  const [inputValue, setInputValue] = useState(value || "12:00");

  useEffect(() => {
    setInputValue(value || "12:00");
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const filtered = val.replace(/[^0-9:]/g, '');
    setInputValue(filtered);

    // If it's a perfect match (HH:MM), propagate onChange immediately
    if (/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/.test(filtered)) {
      onChange(filtered);
    }
  };

  const handleInputBlur = () => {
    let timeStr = inputValue.trim();
    if (!timeStr) {
      setInputValue(value);
      return;
    }

    if (/^\d{4}$/.test(timeStr)) {
      timeStr = timeStr.slice(0, 2) + ':' + timeStr.slice(2);
    } else if (/^\d{3}$/.test(timeStr)) {
      timeStr = '0' + timeStr.slice(0, 1) + ':' + timeStr.slice(1);
    } else if (/^\d{1,2}$/.test(timeStr)) {
      const h = parseInt(timeStr, 10);
      if (h >= 0 && h <= 23) {
        timeStr = String(h).padStart(2, '0') + ':00';
      }
    }

    const parts = timeStr.split(':');
    if (parts.length === 2) {
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(h) && h >= 0 && h <= 23 && !isNaN(m) && m >= 0 && m <= 59) {
        const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        setInputValue(formatted);
        onChange(formatted);
        return;
      }
    }

    setInputValue(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInputBlur();
      setIsOpen(false);
      triggerRef.current?.blur();
    }
  };

  // Update coords when opening or resizing
  const updateCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const margin = 8;
      const popWidth = 190; // Extremely compact width for just the steppers
      const estHeight = 140; // compact height

      // Center aligns relative to the button trigger
      let left = rect.left + window.scrollX + (rect.width - popWidth) / 2;
      if (left + popWidth > window.innerWidth - margin) {
        left = window.innerWidth - popWidth - margin;
      }
      if (left < margin) left = margin;

      // Flip above if not enough space below
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

  const handleSelect = (newHour: number, newMin: number) => {
    const clampedHour = Math.max(0, Math.min(23, newHour));
    const clampedMin = Math.max(0, Math.min(59, newMin));
    const hStr = String(clampedHour).padStart(2, '0');
    const mStr = String(clampedMin).padStart(2, '0');
    onChange(`${hStr}:${mStr}`);
  };

  // Increment / Decrement handlers
  const adjustHour = (amount: number) => {
    let nextHour = hour + amount;
    if (nextHour > 23) nextHour = 0;
    if (nextHour < 0) nextHour = 23;
    handleSelect(nextHour, minute);
  };

  const adjustMinute = (amount: number) => {
    let nextMin = minute + amount;
    if (nextMin > 59) nextMin = 0;
    if (nextMin < 0) nextMin = 59;
    handleSelect(hour, nextMin);
  };

  // Translucent colors for Apple look
  const popoverBg = isDark ? 'rgba(28, 28, 30, 0.92)' : 'rgba(255, 255, 255, 0.92)';
  const popoverBorder = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';
  const popoverShadow = isDark ? '0 10px 40px rgba(0, 0, 0, 0.4)' : '0 10px 40px rgba(0, 0, 0, 0.1)';
  const selectionBorder = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
  const boxBg = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.03)';

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <style>{`
        @keyframes iosPopoverFadeIn {
          from {
            opacity: 0;
            transform: scale(0.96) translateY(-4px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>

      <div style={{ position: 'relative', width: '100%' }}>
        <Clock 
          size={13} 
          style={{ 
            position: 'absolute', 
            left: '0.75rem', 
            top: '50%', 
            transform: 'translateY(-50%)', 
            color: 'var(--accent)', 
            zIndex: 2, 
            cursor: 'pointer' 
          }} 
          onClick={() => setIsOpen(!isOpen)}
        />
        <input
          ref={triggerRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder="HH:MM"
          className="input-sm"
          style={{
            display: 'block',
            boxSizing: 'border-box',
            width: '100%',
            height: '38px',
            padding: '0 0.75rem 0 2rem',
            fontSize: '0.85rem',
            background: 'var(--input-bg)',
            border: '1px solid var(--panel-border)',
            borderRadius: '10px',
            color: 'var(--text-primary)',
            fontWeight: 500,
            cursor: 'text',
            outline: 'none',
          }}
        />
      </div>

      {isOpen && typeof window !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            zIndex: 99999,
            width: `${coords.width}px`,
            backgroundColor: popoverBg,
            border: `1px solid ${popoverBorder}`,
            borderRadius: '16px',
            boxShadow: popoverShadow,
            padding: '0.6rem 0.6rem 0.8rem 0.6rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
            animation: 'iosPopoverFadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '0.2rem',
            borderBottom: `1px solid ${selectionBorder}`,
          }}>
            <span style={{
              fontSize: '0.78rem',
              fontWeight: '600',
              color: 'var(--text-secondary)',
            }}>
              시간 선택
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent)',
                fontSize: '0.78rem',
                fontWeight: '700',
                cursor: 'pointer',
                padding: '0.1rem 0.3rem',
                marginRight: '-0.15rem',
                transition: 'opacity 0.1s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              완료
            </button>
          </div>

          {/* Large Digital Display with Steppers */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.2rem 0',
          }}>
            {/* Hour Block */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1rem' }}>
              <button
                type="button"
                onClick={() => adjustHour(1)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '0.1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.8
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.8')}
              >
                <ChevronUp size={15} />
              </button>
              <div
                style={{
                  width: '46px',
                  height: '36px',
                  fontSize: '1.25rem',
                  fontWeight: '700',
                  color: 'var(--text-primary)',
                  backgroundColor: boxBg,
                  border: `1px solid ${selectionBorder}`,
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  userSelect: 'none',
                }}
              >
                {hourStr}
              </div>
              <button
                type="button"
                onClick={() => adjustHour(-1)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '0.1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.8
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.8')}
              >
                <ChevronDown size={15} />
              </button>
            </div>

            {/* Separator */}
            <span style={{
              fontSize: '1.25rem',
              fontWeight: '700',
              color: 'var(--text-secondary)',
              marginTop: '2px'
            }}>
              :
            </span>

            {/* Minute Block */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1rem' }}>
              <button
                type="button"
                onClick={() => adjustMinute(1)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '0.1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.8
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.8')}
              >
                <ChevronUp size={15} />
              </button>
              <div
                style={{
                  width: '46px',
                  height: '36px',
                  fontSize: '1.25rem',
                  fontWeight: '700',
                  color: 'var(--text-primary)',
                  backgroundColor: boxBg,
                  border: `1px solid ${selectionBorder}`,
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  userSelect: 'none',
                }}
              >
                {minuteStr}
              </div>
              <button
                type="button"
                onClick={() => adjustMinute(-1)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '0.1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.8
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.8')}
              >
                <ChevronDown size={15} />
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
