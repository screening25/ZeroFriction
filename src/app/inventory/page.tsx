"use client";

import React from 'react';
import { format, parseISO } from 'date-fns';
import { useApp } from '@/frontend/context/AppContext';
import { FileSpreadsheet, Printer, ListPlus, Trash2, Plus, X, AlertTriangle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { addRecord, updateRecord } from '@/database';

interface BulkRow {
  code: string;
  title: string;
  qty: number;
  flow: 'IN' | 'OUT';
  loc: string;
  mgr: string;
  memo: string;
}

export default function InventoryPage() {
  const { 
    records, 
    deleteInventoryItem, 
    setEditingInventory, 
    exportToCsv, 
    printToPdf, 
    appSettings,
    reloadRecords,
    logActivity,
    showToast
  } = useApp();

  const inventory = records.filter(r => r.type === 'asset');

  const [currentPage, setCurrentPage] = React.useState(0);
  const itemsPerPage = appSettings?.maxInventoryShown || 5;
  const totalPages = Math.ceil(inventory.length / itemsPerPage);
  const paginatedInventory = inventory.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

  // Bulk Modal States
  const [isBulkModalOpen, setIsBulkModalOpen] = React.useState(false);
  const [bulkRows, setBulkRows] = React.useState<BulkRow[]>([]);
  const [pasteText, setPasteText] = React.useState('');
  const [createMemo, setCreateMemo] = React.useState(false);
  const [memoTitle, setMemoTitle] = React.useState('');
  const [memoContent, setMemoContent] = React.useState('');
  const [isMemoCustom, setIsMemoCustom] = React.useState(false);

  const locations = appSettings.locations?.length ? appSettings.locations : ['비즈니스 창고', '메인 매장', '이동용 밴', 'A창고', 'B창고'];
  const managers = appSettings.managers?.length ? appSettings.managers : ['윤상영', '김철수', '이영희', '박민수'];

  React.useEffect(() => {
    if (currentPage >= totalPages && totalPages > 0) {
      setCurrentPage(totalPages - 1);
    }
  }, [inventory.length, totalPages, currentPage]);

  // Auto-generate Memo Title & Content when rows or checkboxes change
  React.useEffect(() => {
    if (!createMemo) return;
    
    if (!memoTitle) {
      setMemoTitle(`[재고 일괄 처리] ${format(new Date(), 'yyyy-MM-dd')} 작업`);
    }
    
    if (isMemoCustom) return;

    const validRows = bulkRows.filter(r => r.title.trim() !== '' || r.code.trim() !== '');
    if (validRows.length === 0) {
      setMemoContent('등록된 일괄 처리 품목이 없습니다.');
      return;
    }

    let markdown = `### 📦 재고 일괄 처리 내역 (${format(new Date(), 'yyyy-MM-dd HH:mm')})\n\n`;
    markdown += `이번 일괄 처리 작업을 통해 총 **${validRows.length}개**의 품목이 조정되었습니다.\n\n`;
    markdown += `| 품목코드 | 품목명 | 수량 | 구분 | 보관위치 | 담당자 | 메모 |\n`;
    markdown += `| --- | --- | --- | --- | --- | --- | --- |\n`;

    validRows.forEach(row => {
      const flowText = row.flow === 'OUT' ? '🔴 출고' : '🟢 입고';
      markdown += `| \`${row.code || '-'}\` | **${row.title || '품목명 없음'}** | ${row.qty}개 | ${flowText} | ${row.loc || '-'} | ${row.mgr || '-'} | ${row.memo || '-'} |\n`;
    });

    setMemoContent(markdown);
  }, [bulkRows, createMemo, isMemoCustom, memoTitle]);

  // Parse clipboard TSV/CSV data
  const parsePasteData = (text: string) => {
    if (!text.trim()) {
      showToast('분석할 텍스트를 입력해 주세요.');
      return;
    }
    const lines = text.split(/\r?\n/);
    const parsed: BulkRow[] = [];
    
    lines.forEach(line => {
      if (!line.trim()) return;

      const cols = line.split(/\t|,/);
      if (cols.length === 0) return;

      const firstCol = cols[0]?.trim().toLowerCase();
      if (firstCol === '코드' || firstCol === 'code' || firstCol === '품목코드') {
        return; // Skip header row
      }

      const code = cols[0]?.trim() || '';
      const title = cols[1]?.trim() || '';
      const qtyStr = cols[2]?.trim() || '1';
      const qty = parseInt(qtyStr, 10) || 1;
      const flowText = cols[3]?.trim() || '입고';
      const flow = (flowText.includes('출') || flowText.toLowerCase().includes('out')) ? 'OUT' : 'IN';
      const loc = cols[4]?.trim() || locations[0];
      const mgr = cols[5]?.trim() || managers[0];
      const memo = cols[6]?.trim() || '';

      if (title || code) {
        parsed.push({
          code,
          title: title || code,
          qty,
          flow,
          loc: locations.includes(loc) ? loc : locations[0],
          mgr: managers.includes(mgr) ? mgr : managers[0],
          memo
        });
      }
    });

    if (parsed.length > 0) {
      setBulkRows(prev => [...prev, ...parsed]);
      showToast(`${parsed.length}개의 품목 데이터가 파싱 및 추가되었습니다.`);
      setPasteText('');
    } else {
      showToast('올바른 품목 데이터를 추출하지 못했습니다. 형식을 확인해 주세요.');
    }
  };

  const addNewRow = () => {
    setBulkRows(prev => [
      ...prev,
      {
        code: '',
        title: '',
        qty: 1,
        flow: 'IN',
        loc: locations[0],
        mgr: managers[0],
        memo: ''
      }
    ]);
  };

  const deleteRow = (idx: number) => {
    setBulkRows(prev => prev.filter((_, i) => i !== idx));
  };

  const updateRow = (idx: number, field: keyof BulkRow, value: any) => {
    setBulkRows(prev => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        [field]: value
      };
      return next;
    });
  };

  const submitBulkInventory = () => {
    const validRows = bulkRows.filter(r => r.title.trim() !== '' || r.code.trim() !== '');
    if (validRows.length === 0) {
      showToast('등록할 품목 데이터가 없습니다.');
      return;
    }

    const hasEmptyTitle = validRows.some(r => r.title.trim() === '');
    if (hasEmptyTitle) {
      showToast('품목명은 필수 입력 항목입니다.');
      return;
    }

    // 1. Create unified Memo first if enabled
    let memoId = '';
    if (createMemo) {
      const newMemo = addRecord({
        title: memoTitle.trim() || `[재고 일괄 처리] ${format(new Date(), 'yyyy-MM-dd')}`,
        type: 'memo',
        category: '메모',
        attrs: {
          content: memoContent,
          pinned: false,
          color: '',
          effectiveDate: format(new Date(), 'yyyy-MM-dd'),
          linkedIds: []
        }
      });
      memoId = newMemo.id;
    }

    const assetIds: string[] = [];

    // 2. Add inventory records
    validRows.forEach(row => {
      const qtyNum = Number(row.qty) || 1;
      const existingAsset = records.find(r => r.type === 'asset' && r.title.trim() === row.title.trim());
      const existingLinkedIds = existingAsset?.attrs?.linkedIds || [];
      const newLinkedIds = memoId ? [...existingLinkedIds, memoId].filter((v, i, a) => a.indexOf(v) === i) : existingLinkedIds;

      const attrs = {
        code: row.code.trim() || existingAsset?.attrs?.code || '',
        qty: qtyNum,
        flow: row.flow || 'IN',
        loc: row.loc || existingAsset?.attrs?.loc || locations[0],
        mgr: row.mgr || existingAsset?.attrs?.mgr || managers[0],
        serial: existingAsset?.attrs?.serial || '',
        memo: row.memo.trim() || existingAsset?.attrs?.memo || '',
        linkedIds: newLinkedIds
      };

      const resAsset = addRecord({
        title: row.title.trim(),
        type: 'asset',
        category: '재고',
        attrs
      });

      if (resAsset && resAsset.id) {
        assetIds.push(resAsset.id);
      }
    });

    // 3. Update Memo record with bidirectional references
    if (memoId && assetIds.length > 0) {
      updateRecord(memoId, {
        attrs: {
          content: memoContent,
          pinned: false,
          color: '',
          effectiveDate: format(new Date(), 'yyyy-MM-dd'),
          linkedIds: assetIds
        }
      });
    }

    // 4. Log unified activity
    logActivity('ADD_INV', '재고 일괄 처리', `${validRows.length}건 입출고 처리 완료`);
    reloadRecords();
    showToast(`${validRows.length}개의 재고가 정상적으로 처리되었습니다.`);
    setIsBulkModalOpen(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>재고 대장 관리</div>
        
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          {/* 📦 일괄 등록 버튼 */}
          <button 
            onClick={() => {
              setIsBulkModalOpen(true);
              setBulkRows([]);
              setPasteText('');
              setCreateMemo(false);
              setMemoTitle('');
              setMemoContent('');
              setIsMemoCustom(false);
            }}
            title="재고 여러 개를 한 번에 처리"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.25rem', 
              padding: '0.25rem 0.5rem', 
              borderRadius: '6px', 
              fontSize: '0.72rem', 
              fontWeight: 650, 
              border: '1px solid var(--accent-glow)',
              background: 'var(--accent-soft-bg)',
              color: 'var(--accent)',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <ListPlus size={11} />
            <span>일괄 등록</span>
          </button>

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

                    {/* Linked Badges */}
                    {item.attrs.linkedIds && item.attrs.linkedIds.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                        {item.attrs.linkedIds.map((linkedId: string) => {
                          const linkedRecord = records.find(r => r.id === linkedId);
                          if (!linkedRecord) return null;
                          return (
                            <span 
                              key={linkedId} 
                              style={{ 
                                fontSize: '0.65rem', 
                                backgroundColor: 'var(--hover-bg)', 
                                color: 'var(--text-secondary)', 
                                borderRadius: '9999px', 
                                padding: '0.1rem 0.35rem', 
                                border: '1px solid var(--panel-border)' 
                              }}
                            >
                              #{linkedRecord.title}
                            </span>
                          );
                        })}
                      </div>
                    )}
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

      {/* 📦 재고 일괄 등록 모달 */}
      <AnimatePresence>
        {isBulkModalOpen && (
          <div className="modal-overlay" onClick={() => setIsBulkModalOpen(false)}>
            <motion.div 
              className="modal-content"
              onClick={e => e.stopPropagation()}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{ maxWidth: '850px', width: '95%', gap: '0.8rem' }}
            >
              <div className="ios-modal-header">
                <button className="ios-text-btn" onClick={() => setIsBulkModalOpen(false)}>취소</button>
                <div className="ios-modal-title">재고 일괄 등록</div>
                <button className="ios-text-btn bold" onClick={submitBulkInventory}>등록 완료</button>
              </div>

              {/* 📋 복사 / 붙여넣기 파싱 영역 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', background: 'var(--hover-bg)', padding: '0.6rem', borderRadius: '10px', border: '1px solid var(--panel-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Excel / 스프레드시트 데이터 붙여넣기
                  </label>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>
                    (순서: 코드 | 품목명 | 수량 | 구분 | 보관위치 | 담당자 | 메모)
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
                  <textarea
                    placeholder="여기에 복사한 행 데이터를 붙여넣으세요. 탭 또는 쉼표(,) 구분자를 자동 분석합니다.&#10;예시:&#10;A001&#9;아이패드 PRO&#9;10&#9;입고&#9;A창고&#9;윤상영&#9;프로모션 지급용"
                    value={pasteText}
                    onChange={e => setPasteText(e.target.value)}
                    className="input-sm"
                    style={{ height: '70px', resize: 'vertical', fontSize: '0.75rem', flex: 1, fontFamily: 'monospace' }}
                  />
                  <button
                    type="button"
                    onClick={() => parsePasteData(pasteText)}
                    className="ghost-btn"
                    style={{ height: '70px', padding: '0 0.8rem', fontSize: '0.75rem', borderRadius: '10px', flexShrink: 0, fontWeight: 700 }}
                  >
                    분석 적용
                  </button>
                </div>
              </div>

              {/* 📊 동적 편집 그리드 테이블 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  등록 대기 품목 ({bulkRows.length}개)
                </div>
                <button
                  type="button"
                  onClick={() => setBulkRows([])}
                  className="ghost-btn danger"
                  style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', opacity: bulkRows.length > 0 ? 1 : 0.5 }}
                  disabled={bulkRows.length === 0}
                >
                  전체 삭제
                </button>
              </div>

              <div style={{ overflowX: 'auto', maxHeight: '260px', border: '1px solid var(--panel-border)', borderRadius: '10px', background: 'rgba(255,255,255,0.01)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--panel-border)' }}>
                      <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', width: '90px' }}>코드</th>
                      <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', minWidth: '130px' }}>품목명 <span style={{ color: 'var(--danger)' }}>*</span></th>
                      <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', width: '70px' }}>수량</th>
                      <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', width: '90px' }}>구분</th>
                      <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', minWidth: '100px' }}>보관위치</th>
                      <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', minWidth: '95px' }}>담당자</th>
                      <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', minWidth: '120px' }}>메모</th>
                      <th style={{ padding: '0.4rem 0.5rem', textAlign: 'center', width: '40px' }}>삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                          대기 중인 품목이 없습니다. 데이터를 붙여넣거나 아래 '행 추가' 버튼을 눌러 목록을 구성하세요.
                        </td>
                      </tr>
                    ) : (
                      bulkRows.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--panel-border)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                          
                          {/* 코드 */}
                          <td style={{ padding: '0.2rem' }}>
                            <input
                              type="text"
                              className="input-sm"
                              style={{ height: '30px', fontSize: '0.75rem', padding: '0 0.4rem', borderRadius: '6px' }}
                              value={row.code}
                              placeholder="코드"
                              onChange={e => updateRow(idx, 'code', e.target.value)}
                            />
                          </td>

                          {/* 품목명 */}
                          <td style={{ padding: '0.2rem' }}>
                            <input
                              type="text"
                              className="input-sm"
                              style={{ 
                                height: '30px', 
                                fontSize: '0.75rem', 
                                padding: '0 0.4rem', 
                                borderRadius: '6px',
                                border: !row.title.trim() ? '1px solid var(--danger)' : '1px solid var(--panel-border)'
                              }}
                              value={row.title}
                              placeholder="품목명 입력"
                              onChange={e => updateRow(idx, 'title', e.target.value)}
                            />
                          </td>

                          {/* 수량 */}
                          <td style={{ padding: '0.2rem' }}>
                            <input
                              type="number"
                              className="input-sm"
                              style={{ height: '30px', fontSize: '0.75rem', padding: '0 0.4rem', borderRadius: '6px' }}
                              value={row.qty}
                              min="1"
                              onChange={e => updateRow(idx, 'qty', Math.max(1, parseInt(e.target.value, 10) || 1))}
                            />
                          </td>

                          {/* 구분 (입/출고) */}
                          <td style={{ padding: '0.2rem' }}>
                            <select
                              className="input-sm"
                              style={{ height: '30px', fontSize: '0.75rem', padding: '0 0.2rem', borderRadius: '6px', background: 'var(--input-bg)' }}
                              value={row.flow}
                              onChange={e => updateRow(idx, 'flow', e.target.value as 'IN' | 'OUT')}
                            >
                              <option value="IN">입고 (+)</option>
                              <option value="OUT">출고 (-)</option>
                            </select>
                          </td>

                          {/* 보관위치 */}
                          <td style={{ padding: '0.2rem' }}>
                            <select
                              className="input-sm"
                              style={{ height: '30px', fontSize: '0.75rem', padding: '0 0.2rem', borderRadius: '6px', background: 'var(--input-bg)' }}
                              value={row.loc}
                              onChange={e => updateRow(idx, 'loc', e.target.value)}
                            >
                              {locations.map(loc => (
                                <option key={loc} value={loc}>{loc}</option>
                              ))}
                            </select>
                          </td>

                          {/* 담당자 */}
                          <td style={{ padding: '0.2rem' }}>
                            <select
                              className="input-sm"
                              style={{ height: '30px', fontSize: '0.75rem', padding: '0 0.2rem', borderRadius: '6px', background: 'var(--input-bg)' }}
                              value={row.mgr}
                              onChange={e => updateRow(idx, 'mgr', e.target.value)}
                            >
                              {managers.map(mgr => (
                                <option key={mgr} value={mgr}>{mgr}</option>
                              ))}
                            </select>
                          </td>

                          {/* 메모 */}
                          <td style={{ padding: '0.2rem' }}>
                            <input
                              type="text"
                              className="input-sm"
                              style={{ height: '30px', fontSize: '0.75rem', padding: '0 0.4rem', borderRadius: '6px' }}
                              value={row.memo}
                              placeholder="메모"
                              onChange={e => updateRow(idx, 'memo', e.target.value)}
                            />
                          </td>

                          {/* 삭제 액션 */}
                          <td style={{ padding: '0.2rem', textAlign: 'center' }}>
                            <button
                              type="button"
                              className="ghost-btn danger"
                              style={{ padding: '0.3rem', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              onClick={() => deleteRow(idx)}
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>

                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* 행 추가 버튼 */}
              <button
                type="button"
                onClick={addNewRow}
                className="ghost-btn"
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.25rem', 
                  fontSize: '0.72rem', 
                  padding: '0.25rem 0.5rem',
                  alignSelf: 'flex-start',
                  fontWeight: 650
                }}
              >
                <Plus size={11} />
                <span>행 추가</span>
              </button>

              {/* 🔗 통합 메모 작성 연동 */}
              <div style={{ borderTop: '1px solid var(--panel-border)', marginTop: '0.4rem', paddingTop: '0.8rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={createMemo}
                    onChange={e => setCreateMemo(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    이 일괄 처리에 대한 변동 사항 메모 생성 및 상호 연동
                  </span>
                </label>

                {createMemo && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.6rem', paddingLeft: '1.2rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}>메모 제목</span>
                      <input
                        type="text"
                        className="input-sm"
                        value={memoTitle}
                        onChange={e => setMemoTitle(e.target.value)}
                        placeholder="일괄 재고 처리 메모 제목"
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}>메모 내용 (자동 생성됨, 수정 가능)</span>
                      <textarea
                        className="input-sm"
                        style={{ minHeight: '110px', fontSize: '0.75rem', fontFamily: 'monospace', resize: 'vertical' }}
                        value={memoContent}
                        onChange={e => {
                          setMemoContent(e.target.value);
                          setIsMemoCustom(true);
                        }}
                        placeholder="이곳에 일괄 재고 변동 내역의 추가 메모 사항을 남기세요."
                      />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
    </div>
  );
}
