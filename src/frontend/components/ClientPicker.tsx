"use client";

import React, { useState, useRef } from 'react';
import { Check, Search, ChevronDown } from 'lucide-react';

/**
 * 고객사 선택/입력 위젯.
 * 기본은 깔끔한 '검색창' 형태로 접혀 있고, 클릭하거나 입력하면 아래로 목록이 펼쳐진다.
 * 목록에서 고르거나(입력으로 검색·필터) 직접 입력할 수 있다.
 */
export default function ClientPicker({
  value,
  clients,
  onChange,
}: {
  value: string;
  clients: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const raw = (value || '').trim();
  const query = raw.toLowerCase();
  const isExactClient = clients.some(c => c === raw);
  // 직접 입력 중일 때만 필터, 이미 고른 상태면 전체 표시(재선택 가능)
  const filtered = (query && !isExactClient) ? clients.filter(c => c.toLowerCase().includes(query)) : clients;

  const closeSoon = () => { blurTimer.current = setTimeout(() => setOpen(false), 120); };
  const cancelClose = () => { if (blurTimer.current) clearTimeout(blurTimer.current); };

  return (
    <div className="form-group" style={{ position: 'relative' }}>
      <span className="form-label">고객사</span>
      <div style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
        <input
          type="text"
          className="input-sm"
          value={value || ''}
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={closeSoon}
          placeholder="고객사 검색 또는 직접 입력"
          style={{ paddingLeft: '1.9rem', paddingRight: '1.7rem' }}
        />
        {clients.length > 0 && (
          <ChevronDown
            size={15}
            onMouseDown={e => { e.preventDefault(); cancelClose(); setOpen(o => !o); }}
            style={{ position: 'absolute', right: '0.55rem', top: '50%', transform: `translateY(-50%) ${open ? 'rotate(180deg)' : ''}`, color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'transform 0.15s ease' }}
          />
        )}
      </div>

      {open && clients.length > 0 && (
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
            <div style={{ padding: '0.55rem 0.7rem', fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
              일치하는 고객사가 없습니다. 입력한 값으로 등록됩니다.
            </div>
          ) : (
            filtered.map(client => {
              const isSelected = value === client;
              return (
                <button
                  key={client}
                  type="button"
                  onClick={() => { onChange(isSelected ? '' : client); setOpen(false); }}
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
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
