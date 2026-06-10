'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Plus, Trash2 } from 'lucide-react';
import { useApp } from '@/frontend/context/AppContext';
import { addRecord, updateRecord } from '@/database';
import { BulkRow, mergeBulkRows, parseBulkPasteText } from '@/frontend/utils/inventory';

/**
 * 재고 일괄 등록 모달 (page.tsx에서 추출 — 동작 동일).
 * TSV/CSV/마크다운 표 붙여넣기 파싱, 행 직접 추가/수정, 중복 행 병합, 통합 메모 생성 포함.
 */
export default function BulkInventoryModal({ onClose }: { onClose: () => void }) {
  const { records, appSettings, showToast, logActivity, reloadRecords } = useApp();

  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [pasteText, setPasteText] = useState('');
  const [createMemo, setCreateMemo] = useState(false);
  const [memoTitle, setMemoTitle] = useState('');
  const [memoContent, setMemoContent] = useState('');
  const [isMemoCustom, setIsMemoCustom] = useState(false);

  const locations = appSettings.locations?.length ? appSettings.locations : ['비즈니스 창고', '메인 매장', '이동용 밴', 'A창고', 'B창고'];
  const managers = appSettings.managers?.length ? appSettings.managers : ['윤상영', '김철수', '이영희', '박민수'];

  // Auto-generate Memo Title & Content when rows or checkboxes change
  useEffect(() => {
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

  const mergeRows = (rows: BulkRow[]): BulkRow[] => mergeBulkRows(rows, locations, managers);

  // Parse clipboard TSV/CSV/Markdown data
  const parsePasteData = (text: string) => {
    if (!text.trim()) {
      showToast('분석할 텍스트를 입력해 주세요.');
      return;
    }
    const parsed = parseBulkPasteText(text, locations, managers);
    if (parsed.length > 0) {
      setBulkRows(prev => mergeRows([...prev, ...parsed]));
      showToast(`${parsed.length}개의 품목 데이터가 파싱 및 병합 추가되었습니다.`);
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
        memo: '',
        serial: ''
      }
    ]);
  };

  const deleteRow = (idx: number) => {
    setBulkRows(prev => prev.filter((_, i) => i !== idx));
  };

  const updateRow = (idx: number, field: keyof BulkRow, val: any) => {
    setBulkRows(prev => prev.map((row, i) => i === idx ? { ...row, [field]: val } : row));
  };

  const submitBulkInventory = () => {
    // Filter and merge duplicates on submit
    const validRows = mergeRows(bulkRows.filter(r => r.title.trim() !== '' || r.code.trim() !== ''));
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
        serial: row.serial?.trim() || existingAsset?.attrs?.serial || '',
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
    onClose();
  };

  return (
              <div className="modal-overlay" onClick={onClose}>
                <motion.div 
                  className="modal-content"
                  onClick={e => e.stopPropagation()}
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  style={{ 
                    maxWidth: '480px', 
                    width: '95%'
                  }}
                >
                  <div className="ios-modal-header">
                    <button className="ios-text-btn" onClick={onClose}>취소</button>
                    <div className="ios-modal-title">재고 일괄 등록</div>
                    <button className="ios-text-btn bold" onClick={submitBulkInventory}>저장</button>
                  </div>

                  {/* 📋 복사 / 붙여넣기 파싱 영역 */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem',
                    background: 'var(--surface-elevated)',
                    padding: '0.9rem',
                    borderRadius: '14px',
                    border: '1px solid var(--surface-elevated-border)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)' }}>Excel / 마크다운 분석</span>
                      <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-soft-bg)', border: '1px solid var(--accent-soft-border)', padding: '0.1rem 0.4rem', borderRadius: '6px' }}>
                        CSV · TSV · MD
                      </span>
                    </div>
                    <div style={{ fontSize: '0.66rem', color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
                      순서: 코드 · 품목명 · 수량 · 구분 · 보관위치 · 담당자 · 메모
                    </div>

                    <textarea
                      placeholder="복사한 데이터를 붙여넣으세요. 구분 기호와 표 헤더는 자동 제외됩니다."
                      value={pasteText}
                      onChange={e => setPasteText(e.target.value)}
                      className="input-sm"
                      style={{
                        height: '84px',
                        resize: 'vertical',
                        fontFamily: 'var(--font-mono, SFMono-Regular, Consolas, Monaco, monospace)',
                        fontSize: '0.74rem',
                        lineHeight: '1.45',
                        background: 'var(--input-bg)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--panel-border)',
                        borderRadius: '10px',
                        padding: '0.6rem'
                      }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-tertiary)', fontSize: '0.66rem', lineHeight: 1.4 }}>
                      <span>💡</span>
                      <span>시리얼 감지 시 품목코드·시리얼이 자동 분류되어 개별 등록됩니다.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => parsePasteData(pasteText)}
                      style={{
                        width: '100%',
                        height: '38px',
                        fontSize: '0.8rem',
                        borderRadius: '10px',
                        fontWeight: 700,
                        background: 'var(--accent)',
                        color: '#ffffff',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--accent)'}
                    >
                      분석 적용
                    </button>
                  </div>

                  {/* 📊 등록 대기 목록 헤더 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)' }}>등록 대기 목록</span>
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-secondary)', background: 'var(--hover-bg)', padding: '0.1rem 0.4rem', borderRadius: '6px' }}>
                        {bulkRows.length}개
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBulkRows([])}
                      disabled={bulkRows.length === 0}
                      style={{
                        fontSize: '0.7rem',
                        padding: '0.25rem 0.6rem',
                        borderRadius: '8px',
                        border: '1px solid var(--danger-soft-border)',
                        background: 'transparent',
                        color: 'var(--danger)',
                        fontWeight: 700,
                        opacity: bulkRows.length > 0 ? 1 : 0.4,
                        cursor: bulkRows.length > 0 ? 'pointer' : 'not-allowed',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      전체 비우기
                    </button>
                  </div>

                  {/* 📦 카드형 편집 리스트 (좁은 위젯 폭에 맞춘 세로 레이아웃) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '320px', overflowY: 'auto', paddingRight: '2px' }}>
                    {bulkRows.length === 0 ? (
                      <div style={{
                        padding: '2.5rem 1rem',
                        textAlign: 'center',
                        border: '1px dashed var(--panel-border)',
                        borderRadius: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.4rem'
                      }}>
                        <span style={{ fontSize: '1.5rem' }}>📦</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>대기 중인 품목이 없습니다.</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>위 영역에 붙여넣거나 '새 행 추가'를 누르세요.</span>
                      </div>
                    ) : (
                      bulkRows.map((row, idx) => (
                        <div key={idx} style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem',
                          padding: '0.8rem',
                          background: 'var(--surface-elevated)',
                          border: '1px solid var(--surface-elevated-border)',
                          borderRadius: '14px'
                        }}>
                          {/* 헤더: 번호 + 품목명(필수) + 삭제 */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.66rem', fontWeight: 800, color: 'var(--text-tertiary)', flexShrink: 0 }}>#{String(idx + 1).padStart(2, '0')}</span>
                            <input
                              type="text"
                              className="input-sm"
                              style={{ flex: 1, minWidth: 0, fontWeight: 600, border: !row.title.trim() ? '1.5px solid var(--danger)' : undefined }}
                              value={row.title}
                              placeholder="품목명 (필수)"
                              onChange={e => updateRow(idx, 'title', e.target.value)}
                            />
                            <button
                              type="button"
                              onClick={() => deleteRow(idx)}
                              style={{ flexShrink: 0, padding: '0.35rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                              title="삭제"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          {/* 2열 그리드: 코드 · 시리얼 · 수량 · 구분 · 보관위치 · 담당자 */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                            <input type="text" className="input-sm" value={row.code} placeholder="코드" onChange={e => updateRow(idx, 'code', e.target.value)} />
                            <input type="text" className="input-sm" value={row.serial || ''} placeholder="시리얼" onChange={e => updateRow(idx, 'serial', e.target.value)} />
                            <input type="number" className="input-sm" value={row.qty} min="1" placeholder="수량" onChange={e => updateRow(idx, 'qty', Math.max(1, parseInt(e.target.value, 10) || 1))} />
                            <select className="input-sm" style={{ color: row.flow === 'IN' ? 'var(--success)' : 'var(--danger)', fontWeight: 700, cursor: 'pointer' }} value={row.flow} onChange={e => updateRow(idx, 'flow', e.target.value as 'IN' | 'OUT')}>
                              <option value="IN">입고 (+)</option>
                              <option value="OUT">출고 (-)</option>
                            </select>
                            <select className="input-sm" style={{ cursor: 'pointer' }} value={row.loc} onChange={e => updateRow(idx, 'loc', e.target.value)}>
                              {locations.map(loc => (<option key={loc} value={loc}>{loc}</option>))}
                            </select>
                            <select className="input-sm" style={{ cursor: 'pointer' }} value={row.mgr} onChange={e => updateRow(idx, 'mgr', e.target.value)}>
                              {managers.map(mgr => (<option key={mgr} value={mgr}>{mgr}</option>))}
                            </select>
                          </div>

                          {/* 메모 */}
                          <input type="text" className="input-sm" style={{ width: '100%' }} value={row.memo} placeholder="비고 / 메모" onChange={e => updateRow(idx, 'memo', e.target.value)} />
                        </div>
                      ))
                    )}
                  </div>

                  {/* 행 추가 버튼 */}
                  <button
                    type="button"
                    onClick={addNewRow}
                    className="ghost-btn"
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.3rem', 
                      fontSize: '0.75rem', 
                      padding: '0.4rem 0.8rem',
                      alignSelf: 'flex-start',
                      fontWeight: 700,
                      borderRadius: '8px',
                      border: '1px solid var(--panel-border)',
                      background: 'var(--panel-bg)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'var(--accent-soft-bg)';
                      e.currentTarget.style.color = 'var(--accent)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'var(--panel-bg)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }}
                  >
                    <Plus size={13} />
                    <span>새 행 추가</span>
                  </button>

                  {/* 🔗 통합 메모 작성 연동 */}
                  <div style={{ 
                    borderTop: '1px solid var(--panel-border)', 
                    marginTop: '0.4rem', 
                    paddingTop: '0.8rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem'
                  }}>
                    <label className="custom-checkbox" style={{ alignSelf: 'flex-start' }}>
                      <input 
                        type="checkbox" 
                        checked={createMemo} 
                        onChange={e => setCreateMemo(e.target.checked)} 
                      />
                      <span>이 일괄 처리 내역을 변동 사항 메모로 자동 생성하고 연동</span>
                    </label>

                    {createMemo && (
                      <motion.div 
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: '0.7rem', 
                          padding: '1.2rem',
                          background: 'var(--panel-bg)',
                          backdropFilter: 'var(--panel-blur)',
                          WebkitBackdropFilter: 'var(--panel-blur)',
                          borderRadius: '16px',
                          border: '1px solid var(--panel-border)',
                          boxShadow: '0 4px 12px var(--shadow-color)',
                          marginTop: '0.2rem'
                        }}
                      >
                        <div className="form-group">
                          <label className="form-label">메모 제목</label>
                          <input
                            type="text"
                            className="input-sm"
                            value={memoTitle}
                            onChange={e => setMemoTitle(e.target.value)}
                            placeholder="일괄 재고 처리 메모 제목"
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">메모 내용 (자동 생성됨, 수정 가능)</label>
                          <textarea
                            className="input-sm"
                            style={{ 
                              minHeight: '100px', 
                              fontFamily: 'monospace', 
                              resize: 'vertical'
                            }}
                            value={memoContent}
                            onChange={e => {
                              setMemoContent(e.target.value);
                              setIsMemoCustom(true);
                            }}
                            placeholder="이곳에 일괄 재고 변동 내역의 추가 메모 사항을 남기세요."
                          />
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              </div>
  );
}
