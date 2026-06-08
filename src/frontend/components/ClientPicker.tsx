"use client";

import React from 'react';

/**
 * 고객사 선택/입력 위젯.
 * 일정·재고·메모 편집 폼에 중복돼 있던 동일 UI를 단일 컴포넌트로 통합.
 * - 직접 입력 가능
 * - 등록된 고객사는 배지로 빠른 선택(다시 누르면 해제)
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
  return (
    <div className="form-group">
      <span className="form-label">고객사</span>
      <input
        type="text"
        className="input-sm"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder="고객사를 선택하거나 직접 입력하세요."
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.45rem' }}>
        {clients.map(client => {
          const isSelected = value === client;
          return (
            <button
              key={client}
              type="button"
              onClick={() => onChange(isSelected ? '' : client)}
              style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '0.15rem 0.45rem',
                borderRadius: '8px',
                border: isSelected ? '1px solid var(--accent-soft-border)' : '1px solid var(--panel-border)',
                background: isSelected ? 'var(--accent-soft-bg)' : 'var(--surface-color)',
                color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {client}
            </button>
          );
        })}
      </div>
    </div>
  );
}
