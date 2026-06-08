"use client";

import React from 'react';
import { Check } from 'lucide-react';

/**
 * 고객사 선택/입력 위젯.
 * 일정·재고·메모 편집 폼 공용. 등록된 고객사를 흩어진 태그가 아니라
 * 깔끔한 세로 리스트로 보여주고, 직접 입력도 가능하게 한다.
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
  const raw = (value || '').trim();
  const query = raw.toLowerCase();
  const isExactClient = clients.some(c => c === raw);
  // 직접 입력 중일 때만 리스트를 좁힌다. 이미 등록 고객사를 고른 상태면 전체를 보여 재선택 가능.
  const filtered = (query && !isExactClient) ? clients.filter(c => c.toLowerCase().includes(query)) : clients;

  return (
    <div className="form-group">
      <span className="form-label">고객사</span>
      <input
        type="text"
        className="input-sm"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
      />
      {clients.length > 0 && (
        <div
          style={{
            marginTop: '0.4rem',
            border: '1px solid var(--panel-border)',
            borderRadius: '10px',
            overflow: 'hidden',
            maxHeight: '160px',
            overflowY: 'auto',
            background: 'var(--input-bg)',
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: '0.5rem 0.7rem', fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
              일치하는 고객사가 없습니다. 위에 입력한 값으로 등록됩니다.
            </div>
          ) : (
            filtered.map(client => {
              const isSelected = value === client;
              return (
                <button
                  key={client}
                  type="button"
                  onClick={() => onChange(isSelected ? '' : client)}
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
                    transition: 'background 0.12s ease',
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
