"use client";

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

interface CustomSelectProps {
  value: any;
  onChange: (val: any) => void;
  options: { value: any; label: string }[];
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function CustomSelect({ value, onChange, options, placeholder, className, style }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateCoords = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      const handleScrollResize = () => {
        setIsOpen(false);
      };
      window.addEventListener('scroll', handleScrollResize, true);
      window.addEventListener('resize', handleScrollResize);
      return () => {
        window.removeEventListener('scroll', handleScrollResize, true);
        window.removeEventListener('resize', handleScrollResize);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        !target.closest('.custom-select-portal-dropdown')
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOpt = options.find(opt => String(opt.value) === String(value));
  const displayText = selectedOpt ? selectedOpt.label : (placeholder || '선택...');

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={className || "input-sm"}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          textAlign: 'left',
          cursor: 'pointer',
          height: '38px',
          outline: 'none',
          boxShadow: isOpen ? '0 0 0 3px var(--accent-glow)' : 'none',
          borderColor: isOpen ? 'var(--accent)' : 'var(--panel-border)',
          ...style
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayText}
        </span>
        <ChevronDown 
          size={12} 
          style={{ 
            color: 'var(--text-tertiary)', 
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
            flexShrink: 0
          }} 
        />
      </button>

      {isOpen && mounted && createPortal(
        <div
          ref={dropdownRef}
          className="custom-select-portal-dropdown"
          style={{
            position: 'absolute',
            top: `${coords.top + 4}px`,
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            background: 'var(--dropdown-bg, var(--surface-elevated))',
            border: '1px solid var(--panel-border)',
            borderRadius: '10px',
            boxShadow: '0 6px 16px var(--shadow-color, rgba(0,0,0,0.15))',
            zIndex: 99999,
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
                  width: '100%',
                  padding: '0.45rem 0.6rem',
                  border: 'none',
                  background: isSelected ? 'var(--accent-soft-bg)' : 'transparent',
                  color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                  textAlign: 'left',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'block',
                  transition: 'background 0.15s ease',
                  fontWeight: isSelected ? 700 : 500
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
    </>
  );
}
