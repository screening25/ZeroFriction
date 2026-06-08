"use client";

import React, { useState, useRef } from 'react';
import { Check, Search, ChevronDown } from 'lucide-react';

/**
 * 범용 검색-선택 콤보박스.
 * 기본은 깔끔한 검색창으로 접혀 있고, 포커스/클릭 시 아래로 후보 목록이 펼쳐진다.
 * 목록에서 고르거나(입력으로 검색·필터) 직접 입력할 수 있다.
 * 고객사·품목코드 등 "기존 값 재사용 + 직접 입력"이 필요한 곳에 공용으로 쓴다.
 */
export default function SearchSelect({
  label,
  value,
  options,
  onChange,
  placeholder,
  required = false,
  emptyText = '일치하는 항목이 없습니다. 입력한 값으로 등록됩니다.',
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const raw = (value || '').trim();
  const query = raw.toLowerCase();
  const isExact = options.some(o => o === raw);
  const filtered = (query && !isExact) ? options.filter(o => o.toLowerCase().includes(query)) : options;

  const closeSoon = () => { blurTimer.current = setTimeout(() => setOpen(false), 120); };
  const cancelClose = () => { if (blurTimer.current) clearTimeout(blurTimer.current); };

  return (
    <div className="form-group" style={{ position: 'relative' }}>
      <span className="form-label">{label}{required && <span className="req-star">*</span>}</span>
      <div style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
        <input
          type="text"
          className="input-sm"
          value={value || ''}
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={closeSoon}
          placeholder={placeholder}
          style={{ paddingLeft: '1.9rem', paddingRight: '1.7rem' }}
        />
        {options.length > 0 && (
          <ChevronDown
            size={15}
            onMouseDown={e => { e.preventDefault(); cancelClose(); setOpen(o => !o); }}
            style={{ position: 'absolute', right: '0.55rem', top: '50%', transform: `translateY(-50%) ${open ? 'rotate(180deg)' : ''}`, color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'transform 0.15s ease' }}
          />
        )}
      </div>

      {open && options.length > 0 && (
        <div
          onMouseDown={cancelClose}
          style={{
            marginTop: '0.35rem',
            border: '1px solid var(--panel-border)',
            borderRadius: '10px',
            overflow: 'hidden',
            maxHeight: '180px',
            overflowY: 'auto',
            background: 'var(--input-bg)',
            boxShadow: '0 6px 18px var(--shadow-color)',
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: '0.55rem 0.7rem', fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{emptyText}</div>
          ) : (
            filtered.map(opt => {
              const isSelected = value === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => { onChange(isSelected ? '' : opt); setOpen(false); }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.5rem 0.7rem',
                    border: 'none',
                    borderBottom: '1px solid var(--panel-border)',
                    background: isSelected ? 'var(--accent-soft-bg)' : 'transparent',
                    color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                    fontSize: '0.8rem',
                    fontWeight: isSelected ? 700 : 500,
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <Check size={14} style={{ flexShrink: 0, opacity: isSelected ? 1 : 0, color: 'var(--accent)' }} />
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
