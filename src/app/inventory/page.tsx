"use client";

import React from 'react';
import { format, parseISO } from 'date-fns';
import { useApp } from '@/frontend/context/AppContext';

export default function InventoryPage() {
  const { records, deleteInventoryItem, setEditingInventory } = useApp();
  const inventory = records.filter(r => r.type === 'asset');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>재고 대장 관리</div>
      </div>

      {inventory.length === 0 ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px dashed var(--panel-border)',
          borderRadius: '10px',
          padding: '1.2rem 0.8rem',
          color: 'var(--text-secondary)',
          fontSize: '0.82rem',
          background: 'transparent'
        }}>등록된 재고 항목이 없습니다.</div>
      ) : (
        <div className="card-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {inventory.map((item, index) => {
            const orderNum = `#${String(index + 1).padStart(2, '0')}`;
            const qtyNum = Number(item.attrs.qty) || 0;
            const isNegative = qtyNum < 0;
            return (
              <div key={item.id} className="inv-card" onClick={() => setEditingInventory(item)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.55rem 0.7rem', background: isNegative ? 'var(--danger-tint)' : 'var(--success-tint)', border: isNegative ? '1px solid var(--danger-soft-border)' : '1px solid var(--success-soft-border)', borderRadius: '10px', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--text-tertiary)', width: '22px', flexShrink: 0 }}>
                    {orderNum}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
                        {item.attrs.code && (
                          <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', background: 'var(--hover-bg)', color: 'var(--text-secondary)', padding: '0.08rem 0.3rem', borderRadius: '4px', border: '1px solid var(--panel-border)', flexShrink: 0 }}>
                            {item.attrs.code}
                          </span>
                        )}
                        <div className="inv-name text-ellipsis whitespace-nowrap overflow-hidden" style={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.title}</div>
                      </div>
                      <span className="badge" style={{ background: item.attrs.flow === 'OUT' ? 'var(--danger-soft-bg)' : 'var(--success-soft-bg)', color: item.attrs.flow === 'OUT' ? 'var(--danger)' : 'var(--success)', fontSize: '0.62rem', padding: '0.1rem 0.3rem', borderRadius: '4px', flexShrink: 0 }}>
                        {item.attrs.flow === 'OUT' ? '출고' : '입고'}
                      </span>
                      {isNegative && (
                        <span className="badge" style={{ background: 'var(--danger-soft-bg-strong)', color: 'var(--danger)', fontSize: '0.6rem', padding: '0.1rem 0.3rem', borderRadius: '4px', flexShrink: 0, fontWeight: 700 }}>
                          재고 부족
                        </span>
                      )}
                    </div>
                    <div className="inv-detail text-ellipsis whitespace-nowrap overflow-hidden" style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '0.2rem' }}>
                      {item.attrs.loc && `${item.attrs.loc}`}{item.attrs.mgr && ` · ${item.attrs.mgr}`} · {format(parseISO(item.updatedAt), 'MM.dd HH:mm')}
                    </div>
                  </div>
                </div>
                <div className="inv-qty" style={{ fontSize: '0.9rem', fontWeight: 700, flexShrink: 0, paddingRight: '0.5rem', color: isNegative ? 'var(--danger)' : 'var(--success)' }}>
                  {qtyNum >= 0 ? '+' : ''}{qtyNum}개
                </div>
                <div className="card-hover-actions">
                  <button className="ghost-btn danger" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }} onClick={(e) => { e.stopPropagation(); deleteInventoryItem(item.id); }}>삭제</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
    </div>
  );
}
