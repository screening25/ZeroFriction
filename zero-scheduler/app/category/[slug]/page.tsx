"use client";

import React, { use } from 'react';
import { format, parseISO } from 'date-fns';
import { useApp } from '@/frontend/context/AppContext';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function CategoryPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const slug = decodeURIComponent(resolvedParams.slug);
  const { records, deleteInventoryItem, handleDeleteSchedule, deleteMemo } = useApp();

  const filteredRecords = records.filter(r => r.category === slug);

  const handleDelete = (id: string, type: string) => {
    if (type === 'asset') deleteInventoryItem(id);
    else if (type === 'event') handleDeleteSchedule(id);
    else if (type === 'memo') deleteMemo(id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>카테고리: {slug}</div>
      </div>

      {filteredRecords.length === 0 ? (
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
        }}>등록된 데이터가 존재하지 않습니다.</div>
      ) : (
        <div className="card-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {filteredRecords.map((item, index) => {
            const orderNum = `#${String(index + 1).padStart(2, '0')}`;
            return (
              <div key={item.id} className="inv-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.55rem 0.7rem', background: 'var(--panel-bg)', border: '1px solid var(--panel-border)', borderRadius: '10px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--text-tertiary)', width: '22px', flexShrink: 0 }}>
                    {orderNum}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <div className="inv-name text-ellipsis whitespace-nowrap overflow-hidden" style={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.title}</div>
                      <span className="badge" style={{ background: 'var(--hover-bg)', color: 'var(--text-secondary)', fontSize: '0.62rem', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>
                        {item.type.toUpperCase()}
                      </span>
                    </div>
                    <div className="inv-detail text-ellipsis whitespace-nowrap overflow-hidden" style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '0.2rem' }}>
                      수정일: {format(parseISO(item.updatedAt), 'yyyy.MM.dd HH:mm')}
                    </div>
                  </div>
                </div>
                <div className="card-hover-actions">
                  <button className="ghost-btn danger" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }} onClick={() => handleDelete(item.id, item.type)}>삭제</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
    </div>
  );
}
