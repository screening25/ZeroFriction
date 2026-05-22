"use client";

import React from 'react';
import { format, parseISO } from 'date-fns';
import { useApp } from '@/frontend/context/AppContext';
import { FileSpreadsheet, Printer } from 'lucide-react';

export default function InventoryPage() {
  const { records, deleteInventoryItem, setEditingInventory, exportToCsv, printToPdf, appSettings } = useApp();
  const inventory = records.filter(r => r.type === 'asset');

  const [currentPage, setCurrentPage] = React.useState(0);
  const itemsPerPage = appSettings?.maxInventoryShown || 5;
  const totalPages = Math.ceil(inventory.length / itemsPerPage);
  const paginatedInventory = inventory.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

  React.useEffect(() => {
    if (currentPage >= totalPages && totalPages > 0) {
      setCurrentPage(totalPages - 1);
    }
  }, [inventory.length, totalPages, currentPage]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>재고 대장 관리</div>
        
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          {/* 📊 엑셀 내보내기 버튼 */}
          <button 
            onClick={() => exportToCsv('asset')}
            title="재고 엑셀 다운로드"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.25rem', 
              padding: '0.25rem 0.5rem', 
              borderRadius: '6px', 
              fontSize: '0.72rem', 
              fontWeight: 650, 
              border: '1px solid var(--panel-border)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <FileSpreadsheet size={11} />
            <span className="btn-label-hide-md">Excel</span>
          </button>

          {/* 🖨️ PDF 인쇄 버튼 */}
          <button 
            onClick={() => printToPdf('asset')}
            title="재고 PDF 인쇄"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.25rem', 
              padding: '0.25rem 0.5rem', 
              borderRadius: '6px', 
              fontSize: '0.72rem', 
              fontWeight: 650, 
              border: '1px solid var(--panel-border)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <Printer size={11} />
            <span className="btn-label-hide-md">PDF</span>
          </button>
        </div>
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
          {paginatedInventory.map((item, index) => {
            const orderNum = `#${String(currentPage * itemsPerPage + index + 1).padStart(2, '0')}`;
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

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.8rem', marginTop: '0.8rem', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button 
            onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
            disabled={currentPage === 0}
            style={{ 
              opacity: currentPage === 0 ? 0.3 : 1, 
              padding: '0.2rem 0.5rem', 
              fontSize: '0.72rem',
              borderRadius: '6px',
              border: '1px solid var(--panel-border)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              cursor: currentPage === 0 ? 'default' : 'pointer'
            }}
          >
            이전
          </button>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            {currentPage + 1} / {totalPages}
          </span>
          <button 
            onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
            disabled={currentPage === totalPages - 1}
            style={{ 
              opacity: currentPage === totalPages - 1 ? 0.3 : 1, 
              padding: '0.2rem 0.5rem', 
              fontSize: '0.72rem',
              borderRadius: '6px',
              border: '1px solid var(--panel-border)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              cursor: currentPage === totalPages - 1 ? 'default' : 'pointer'
            }}
          >
            다음
          </button>
        </div>
      )}
      
    </div>
  );
}
