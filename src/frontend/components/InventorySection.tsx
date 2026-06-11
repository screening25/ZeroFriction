'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { Plus, MoreHorizontal, ListPlus, ClipboardList, ArrowDownUp, Layers, Sliders, FileSpreadsheet, Printer, MapPin, Tag, User, Menu, ChevronDown, AlertTriangle, Package } from 'lucide-react';
import { useApp } from '@/frontend/context/AppContext';
import { updateRecord, deleteRecord } from '@/database';
import CameraScan from './CameraScan';
import TxnLogModal from './TxnLogModal';
import BulkInventoryModal from './BulkInventoryModal';
import type { UniversalRecord } from '@/database';

/**
 * 재고 탭 섹션 (page.tsx에서 추출 — 동작 동일).
 * 카메라 스캔 품목 식별, 더보기 메뉴(일괄 등록·입출고 로그·정렬·중복 합치기·마스터 설정),
 * 카테고리/입출고 필터, 품목코드별 그룹 목록(접기·드래그 순서 변경), 페이지네이션과
 * 마스터 설정·입출고 로그·일괄 등록 모달 포함.
 */
export default function InventorySection({ inventory }: { inventory: UniversalRecord[] }) {
  const {
    records, appSettings, handleSettingsChange, setEditingInventory,
    showToast, reloadRecords, exportToCsv, printToPdf,
    handleDuplicateInventory, deleteInventoryItem,
  } = useApp();

  const inventorySort = appSettings.inventorySort || 'manual';

  const [selectedInventoryCategory, setSelectedInventoryCategory] = useState<string>('전체');
  const [inventoryPage, setInventoryPage] = useState<number>(0);
  const [inventoryFlowView, setInventoryFlowView] = useState<'all' | 'IN' | 'OUT'>('all'); // 총재고/입고/출고 뷰
  const [isTxnLogOpen, setIsTxnLogOpen] = useState(false); // 입출고 로그 모달
  const [isInvMenuOpen, setIsInvMenuOpen] = useState(false); // 재고 '더보기' 메뉴
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set()); // 접힌 재고 그룹(코드)
  const toggleGroupCollapse = (code: string) => setCollapsedGroups(prev => {
    const next = new Set(prev);
    next.has(code) ? next.delete(code) : next.add(code);
    return next;
  });
  const [dragKey, setDragKey] = useState<string | null>(null); // 드래그 중인 재고 그룹 코드(시각 표시용)
  const dragKeyRef = useRef<string | null>(null); // 핸들러가 동기로 읽는 값(상태는 비동기라 stale closure 방지)
  const [dragItemId, setDragItemId] = useState<string | null>(null); // 그룹 내 개별 항목 드래그(시각용)
  const dragItemRef = useRef<string | null>(null);

  useEffect(() => {
    setInventoryPage(0);
  }, [selectedInventoryCategory]);

  const [isMasterSettingsOpen, setIsMasterSettingsOpen] = useState(false);
  const [newLocInput, setNewLocInput] = useState('');
  const [newCatInput, setNewCatInput] = useState('');
  const [newMgrInput, setNewMgrInput] = useState('');

  // Bulk Inventory States
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  const addMasterLocation = (loc: string) => {
    if (!loc.trim()) return;
    const current = appSettings.locations || ['비즈니스 창고', '메인 매장', '이동용 밴', 'A창고', 'B창고'];
    if (current.includes(loc.trim())) return;
    const updated = { ...appSettings, locations: [...current, loc.trim()] };
    handleSettingsChange(updated);
    setNewLocInput('');
    showToast(`보관 위치 '${loc.trim()}' 추가 완료`);
  };

  const deleteMasterLocation = (loc: string) => {
    const current = appSettings.locations || ['비즈니스 창고', '메인 매장', '이동용 밴', 'A창고', 'B창고'];
    const updated = { ...appSettings, locations: current.filter(x => x !== loc) };
    handleSettingsChange(updated);
    showToast(`보관 위치 '${loc}' 삭제 완료`);
  };

  const addMasterCategory = (cat: string) => {
    if (!cat.trim()) return;
    const current = appSettings.categories || ['재고', 'IT 장비', '촬영 장비', '사무 용품', '기타'];
    if (current.includes(cat.trim())) return;
    const updated = { ...appSettings, categories: [...current, cat.trim()] };
    handleSettingsChange(updated);
    setNewCatInput('');
    showToast(`카테고리 '${cat.trim()}' 추가 완료`);
  };

  const deleteMasterCategory = (cat: string) => {
    const current = appSettings.categories || ['재고', 'IT 장비', '촬영 장비', '사무 용품', '기타'];
    const updated = { ...appSettings, categories: current.filter(x => x !== cat) };
    handleSettingsChange(updated);
    showToast(`카테고리 '${cat}' 삭제 완료`);
  };

  const addMasterManager = (mgr: string) => {
    if (!mgr.trim()) return;
    const current = appSettings.managers || ['윤상영', '김철수', '이영희', '박민수'];
    if (current.includes(mgr.trim())) return;
    const updated = { ...appSettings, managers: [...current, mgr.trim()] };
    handleSettingsChange(updated);
    setNewMgrInput('');
    showToast(`담당 관리자 '${mgr.trim()}' 추가 완료`);
  };

  const deleteMasterManager = (mgr: string) => {
    const current = appSettings.managers || ['윤상영', '김철수', '이영희', '박민수'];
    const updated = { ...appSettings, managers: current.filter(x => x !== mgr) };
    handleSettingsChange(updated);
    showToast(`담당 관리자 '${mgr}' 삭제 완료`);
  };

  // Apply Inventory Local Category filter
  const displayInventories = (selectedInventoryCategory === '전체'
    ? inventory
    : inventory.filter(i => i.category === selectedInventoryCategory)
  ).filter(i => {
    if (inventoryFlowView === 'all') return true;
    const q = Number(i.attrs.qty) || 0;
    return inventoryFlowView === 'IN' ? q > 0 : q <= 0; // IN=보유(>0), OUT=소진·부족(<=0)
  });

  // 동일 품목코드끼리 그룹으로 묶는다(코드 없으면 품목명 단독 그룹). 그룹 내에서 사이즈·변형별로 나열.
  const groupedInventories = useMemo(() => {
    const groups: { code: string; label: string; items: typeof displayInventories }[] = [];
    const seen = new Map<string, number>();
    displayInventories.forEach(item => {
      const codeRaw = (item.attrs.code || '').trim();
      const key = codeRaw || `__no_code__${item.title}`;
      const label = codeRaw || item.title;
      if (seen.has(key)) {
        groups[seen.get(key)!].items.push(item);
      } else {
        seen.set(key, groups.length);
        groups.push({ code: key, label, items: [item] });
      }
    });
    return groups;
  }, [displayInventories]);

  const inventoryPerPage = appSettings.maxInventoryShown || 5;
  const inventoryTotalPages = Math.ceil(groupedInventories.length / inventoryPerPage);
  const paginatedGroups = groupedInventories.slice(inventoryPage * inventoryPerPage, (inventoryPage + 1) * inventoryPerPage);

  // 재고 그룹을 드래그하여 순서 변경 — 새 순서대로 모든 항목에 sortOrder를 재부여해 영속화
  // 기존에 따로 쌓인 같은 (품목코드+품목명) 재고 레코드를 하나로 합친다(수량 합산·이력 통합).
  // 합산 기준이 도입되기 전 입·출고가 별도 레코드로 남아 "따로 보이는" 경우를 정리.
  const consolidateInventory = () => {
    const assets = records.filter(r => r.type === 'asset');
    const groups = new Map<string, typeof assets>();
    assets.forEach(r => {
      const key = `${(r.attrs.code || '').trim()}|||${(r.title || '').trim()}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    });
    let merged = 0;
    groups.forEach(list => {
      if (list.length < 2) return;
      const keeper = list[0];
      let netQty = 0;
      let txns: any[] = [];
      list.forEach(r => { netQty += Number(r.attrs.qty) || 0; txns = txns.concat(r.attrs.txns || []); });
      txns.sort((a, b) => (a.ts || '').localeCompare(b.ts || ''));
      updateRecord(keeper.id, { attrs: { ...keeper.attrs, qty: netQty, flow: netQty < 0 ? 'OUT' : 'IN', txns } });
      list.slice(1).forEach(r => deleteRecord(r.id, { permanent: true }));
      merged += list.length - 1;
    });
    reloadRecords();
    showToast(merged > 0 ? `중복 재고 ${merged}건을 합쳤습니다.` : '합칠 중복 재고가 없습니다.');
  };

  // 카메라 스캔 결과로 어떤 품목인지 식별: 시리얼 → 코드+품목명 → 코드 → 품목명 순으로 매칭.
  // 일치하면 그 품목의 수정 모달을 열어 보여주고, 없으면 스캔 값이 채워진 신규 등록을 연다.
  const openScannedInventory = (fields: { code?: string; title?: string; serial?: string }) => {
    const assets = records.filter(r => r.type === 'asset');
    const code = (fields.code || '').trim();
    const title = (fields.title || '').trim();
    const serial = (fields.serial || '').trim();
    let found: any;
    if (serial) found = assets.find(r => (r.attrs.serial || '').trim() === serial);
    if (!found && code && title) found = assets.find(r => (r.attrs.code || '').trim() === code && r.title.trim() === title);
    if (!found && code) found = assets.find(r => (r.attrs.code || '').trim() === code);
    if (!found && title) found = assets.find(r => r.title.trim() === title);
    if (found) {
      setEditingInventory(found);
      showToast(`기존 품목으로 인식: ${found.title}`);
    } else {
      setEditingInventory({
        id: '', title, type: 'asset', category: '재고',
        attrs: { code, qty: 1, flow: 'IN', loc: '', mgr: '', serial, memo: '' },
        updatedAt: new Date().toISOString()
      });
      showToast('일치하는 품목이 없어 새 재고 등록으로 엽니다.');
    }
  };

  const reorderInventoryGroups = (fromKey: string, toKey: string) => {
    if (!fromKey || fromKey === toKey) return;
    const order = groupedInventories.map(g => g.code);
    const from = order.indexOf(fromKey);
    const to = order.indexOf(toKey);
    if (from < 0 || to < 0) return;
    order.splice(to, 0, order.splice(from, 1)[0]);
    let seq = 0;
    order.forEach(code => {
      const g = groupedInventories.find(x => x.code === code);
      g?.items.forEach(it => {
        updateRecord(it.id, { attrs: { ...it.attrs, sortOrder: seq++ } });
      });
    });
    reloadRecords();
    showToast('재고 순서를 변경했습니다.');
  };

  // 같은 그룹(동일 품목코드) 안에서 개별 항목 순서 변경
  const reorderInventoryItems = (fromId: string, toId: string) => {
    if (!fromId || fromId === toId) return;
    const codeOf = (it: any) => (it.attrs.code || '').trim() || `__no_code__${it.title}`;
    const from = inventory.find(i => i.id === fromId);
    const to = inventory.find(i => i.id === toId);
    if (!from || !to || codeOf(from) !== codeOf(to)) return; // 같은 그룹 내에서만
    const flat = groupedInventories.flatMap(g => g.items);
    const order = flat.map(i => i.id);
    const fi = order.indexOf(fromId), ti = order.indexOf(toId);
    if (fi < 0 || ti < 0) return;
    order.splice(ti, 0, order.splice(fi, 1)[0]);
    let seq = 0;
    order.forEach(id => {
      const it = flat.find(x => x.id === id);
      if (it) updateRecord(it.id, { attrs: { ...it.attrs, sortOrder: seq++ } });
    });
    reloadRecords();
    showToast('순서를 변경했습니다.');
  };

  useEffect(() => {
    if (inventoryPage >= inventoryTotalPages && inventoryTotalPages > 0) {
      setInventoryPage(inventoryTotalPages - 1);
    } else if (inventoryTotalPages === 0) {
      setInventoryPage(0);
    }
  }, [inventoryTotalPages, inventoryPage]);

  const inventoryCategories = ['전체', ...(appSettings.categories || ['재고', 'IT 장비', '촬영 장비', '사무 용품', '기타'])];
  const showInventoryFilterBar = inventoryCategories.filter(c => c !== '전체').length >= 1;

  return (
        <section>
          <div className="section-header" style={{ marginBottom: '0.8rem' }}>
            <div className="section-title">재고 현황</div>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', position: 'relative' }}>
              {/* 📷 라벨 스캔 — 아무 품목이나 찍어 어떤 재고인지 식별(시리얼/코드/품목명 매칭) */}
              <CameraScan compact onApply={openScannedInventory} />

              {/* ➕ 재고 등록 (주요 동작) */}
              <button
                className="btn-ghost"
                onClick={() => setEditingInventory({
                  id: '', title: '', type: 'asset', category: '재고',
                  attrs: { code: '', qty: 1, flow: 'IN', loc: '', mgr: '', serial: '', memo: '' },
                  updatedAt: new Date().toISOString()
                })}
                title="재고 등록"
                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.35rem 0.7rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, border: '1px solid var(--accent-soft-border)', background: 'var(--accent-soft-bg)', color: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }}
              >
                <Plus size={14} /> 등록
              </button>

              {/* ⋯ 더보기 — 나머지 기능을 메뉴로 묶음 */}
              <button
                className="btn-ghost"
                onClick={() => setIsInvMenuOpen(o => !o)}
                title="더보기"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.35rem', width: '2rem', height: '2rem', borderRadius: '8px', border: '1px solid var(--panel-border)', background: isInvMenuOpen ? 'var(--hover-bg)' : 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0 }}
              >
                <MoreHorizontal size={16} />
              </button>

              {isInvMenuOpen && (
                <>
                  <div onClick={() => setIsInvMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.4rem', zIndex: 50, minWidth: '200px', background: 'var(--panel-bg)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: '1px solid var(--panel-border)', borderRadius: '12px', boxShadow: '0 10px 30px var(--shadow-color)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {([
                      { icon: <ListPlus size={14} />, label: '일괄 등록', on: () => setIsBulkModalOpen(true) },
                      { icon: <ClipboardList size={14} />, label: '입출고 로그', on: () => setIsTxnLogOpen(true) },
                      { icon: <ArrowDownUp size={14} />, label: `정렬: ${inventorySort === 'manual' ? '수동(드래그)' : inventorySort === 'asc' ? '코드 오름차순' : '코드 내림차순'}`, on: () => handleSettingsChange({ ...appSettings, inventorySort: inventorySort === 'manual' ? 'asc' : inventorySort === 'asc' ? 'desc' : 'manual' }), keepOpen: true },
                      { icon: <Layers size={14} />, label: '중복 합치기', on: () => { if (confirm('같은 품목코드+품목명으로 따로 등록된 재고를 하나로 합치고 수량을 합산합니다. 진행할까요?')) consolidateInventory(); } },
                      { icon: <Sliders size={14} />, label: '기준 정보 관리', on: () => setIsMasterSettingsOpen(true) },
                      { icon: <FileSpreadsheet size={14} />, label: 'Excel 내보내기', on: () => exportToCsv('asset') },
                      { icon: <Printer size={14} />, label: 'PDF 인쇄', on: () => printToPdf('asset') },
                    ] as { icon: React.ReactNode; label: string; on: () => void; keepOpen?: boolean }[]).map((m, mi) => (
                      <button
                        key={mi}
                        onClick={() => { m.on(); if (!m.keepOpen) setIsInvMenuOpen(false); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', width: '100%', padding: '0.6rem 0.8rem', border: 'none', borderTop: mi > 0 ? '1px solid var(--panel-border)' : 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 600, textAlign: 'left', cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <span style={{ color: 'var(--text-tertiary)', display: 'flex', flexShrink: 0 }}>{m.icon}</span>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ⚙️ 재고 기준 정보 설정 마스터 데이터 관리 모달 */}
          <AnimatePresence>
            {isMasterSettingsOpen && (
              <div className="modal-overlay" onClick={() => setIsMasterSettingsOpen(false)}>
                <motion.div 
                  initial={{ scale: 0.95, opacity: 0 }} 
                  animate={{ scale: 1, opacity: 1 }} 
                  exit={{ scale: 0.95, opacity: 0 }} 
                  transition={{ duration: 0.15 }} 
                  className="modal-content" 
                  onClick={e => e.stopPropagation()}
                  style={{ maxWidth: '400px' }}
                >
                  <div className="ios-modal-header">
                    <button className="ios-text-btn" onClick={() => setIsMasterSettingsOpen(false)}>닫기</button>
                    <div className="ios-modal-title">기준 정보 설정</div>
                    <div style={{ width: '40px' }} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>
                    {/* 1. 보관 위치 설정 */}
                    <div className="form-group" style={{ textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                        <MapPin size={13} style={{ color: 'var(--accent)' }} />
                        <span>보관 위치 관리</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <input
                          type="text"
                          placeholder="새 보관 위치 입력"
                          className="input-sm"
                          value={newLocInput}
                          onChange={e => setNewLocInput(e.target.value)}
                          style={{ flex: 1, fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                        />
                        <button
                          type="button"
                          onClick={() => addMasterLocation(newLocInput)}
                          className="ghost-btn"
                          style={{ padding: '0.25rem 0.65rem', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          추가
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.5rem' }}>
                        {(appSettings.locations || ['비즈니스 창고', '메인 매장', '이동용 밴', 'A창고', 'B창고']).map(loc => (
                          <span
                            key={loc}
                            className="badge"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.15rem 0.45rem', fontSize: '0.68rem', borderRadius: '6px' }}
                          >
                            {loc}
                            <span
                              onClick={() => deleteMasterLocation(loc)}
                              style={{ cursor: 'pointer', fontWeight: 800, color: 'var(--danger)', marginLeft: '0.25rem' }}
                            >
                              ×
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* 2. 카테고리 설정 */}
                    <div className="form-group" style={{ textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                        <Tag size={13} style={{ color: 'var(--accent)' }} />
                        <span>재고 카테고리 관리</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <input
                          type="text"
                          placeholder="새 카테고리 입력"
                          className="input-sm"
                          value={newCatInput}
                          onChange={e => setNewCatInput(e.target.value)}
                          style={{ flex: 1, fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                        />
                        <button
                          type="button"
                          onClick={() => addMasterCategory(newCatInput)}
                          className="ghost-btn"
                          style={{ padding: '0.25rem 0.65rem', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          추가
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.5rem' }}>
                        {(appSettings.categories || ['재고', 'IT 장비', '촬영 장비', '사무 용품', '기타']).map(cat => (
                          <span
                            key={cat}
                            className="badge"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.15rem 0.45rem', fontSize: '0.68rem', borderRadius: '6px' }}
                          >
                            {cat}
                            <span
                              onClick={() => deleteMasterCategory(cat)}
                              style={{ cursor: 'pointer', fontWeight: 800, color: 'var(--danger)', marginLeft: '0.25rem' }}
                            >
                              ×
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* 3. 담당 관리자 설정 */}
                    <div className="form-group" style={{ textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                        <User size={13} style={{ color: 'var(--accent)' }} />
                        <span>담당 관리자 관리</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <input
                          type="text"
                          placeholder="새 담당 관리자 입력"
                          className="input-sm"
                          value={newMgrInput}
                          onChange={e => setNewMgrInput(e.target.value)}
                          style={{ flex: 1, fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                        />
                        <button
                          type="button"
                          onClick={() => addMasterManager(newMgrInput)}
                          className="ghost-btn"
                          style={{ padding: '0.25rem 0.65rem', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          추가
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.5rem' }}>
                        {(appSettings.managers || ['윤상영', '김철수', '이영희', '박민수']).map(mgr => (
                          <span
                            key={mgr}
                            className="badge"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.15rem 0.45rem', fontSize: '0.68rem', borderRadius: '6px' }}
                          >
                            {mgr}
                            <span
                              onClick={() => deleteMasterManager(mgr)}
                              style={{ cursor: 'pointer', fontWeight: 800, color: 'var(--danger)', marginLeft: '0.25rem' }}
                            >
                              ×
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* 📜 입출고 로그 모달 */}
          <AnimatePresence>
            {isTxnLogOpen && (
              <TxnLogModal onClose={() => setIsTxnLogOpen(false)} />
            )}
          </AnimatePresence>

          {/* 📦 재고 일괄 등록 모달 */}
          <AnimatePresence>
            {isBulkModalOpen && (
              <BulkInventoryModal onClose={() => setIsBulkModalOpen(false)} />
            )}
          </AnimatePresence>

          {/* Local Inventory Category Horizon Filtering Bar - Show ONLY when custom categories exist! */}
          {/* 총 재고 / 보유 / 소진·부족 현황 세그먼트 (현재 수량 기준) */}
          {(() => {
            const catFiltered = selectedInventoryCategory === '전체' ? inventory : inventory.filter(i => i.category === selectedInventoryCategory);
            const counts = {
              all: catFiltered.length,
              IN: catFiltered.filter(i => (Number(i.attrs.qty) || 0) > 0).length,
              OUT: catFiltered.filter(i => (Number(i.attrs.qty) || 0) <= 0).length,
            };
            const views: { key: 'all' | 'IN' | 'OUT'; label: string }[] = [
              { key: 'all', label: '총 재고' },
              { key: 'IN', label: '보유 중' },
              { key: 'OUT', label: '소진·부족' },
            ];
            return (
              <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.6rem' }}>
                {views.map(v => {
                  const sel = inventoryFlowView === v.key;
                  return (
                    <button
                      key={v.key}
                      onClick={() => { setInventoryFlowView(v.key); setInventoryPage(0); }}
                      style={{
                        flex: 1, fontSize: '0.74rem', fontWeight: 700, padding: '0.4rem 0.3rem', borderRadius: '10px', cursor: 'pointer',
                        border: sel ? '1px solid var(--accent-soft-border)' : '1px solid var(--panel-border)',
                        background: sel ? 'var(--accent-soft-bg)' : 'var(--panel-bg)',
                        color: sel ? 'var(--accent)' : 'var(--text-secondary)',
                        transition: 'all 0.15s ease', whiteSpace: 'nowrap'
                      }}
                    >
                      {v.label}
                      <span style={{ marginLeft: '0.25rem', fontSize: '0.66rem', opacity: 0.7 }}>{counts[v.key]}</span>
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {showInventoryFilterBar && (
            <div
              style={{
                display: 'flex',
                gap: '0.35rem',
                overflowX: 'auto',
                paddingBottom: '0.5rem',
                marginBottom: '0.5rem',
                scrollbarWidth: 'none',
                WebkitOverflowScrolling: 'touch'
              }}
            >
              {inventoryCategories.map(cat => {
                const isSelected = selectedInventoryCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedInventoryCategory(cat)}
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      padding: '0.25rem 0.6rem',
                      borderRadius: '8px',
                      // Apple-style translucent Cupertino Tint selection!
                      border: isSelected ? '1px solid var(--accent-soft-border)' : '1px solid var(--panel-border)',
                      background: isSelected ? 'var(--accent-soft-bg)' : 'var(--panel-bg)',
                      color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {cat === '전체' ? '전체' : `# ${cat}`}
                  </button>
                );
              })}
            </div>
          )}

          {displayInventories.length === 0 ? (
            <div className="empty-box">등록된 재고가 존재하지 않습니다.</div>
          ) : (
            <div className="card-list" style={{ gap: '1.25rem' }}>
              {paginatedGroups.map((group, groupIdx) => {
                const groupOrderNum = `#${String(inventoryPage * inventoryPerPage + groupIdx + 1).padStart(2, '0')}`;
                const hasNoCode = group.code.startsWith('__no_code__');
                const isSingleItem = group.items.length === 1;
                const groupHasDanger = group.items.some(it => (Number(it.attrs.qty) || 0) < 0);
                const showGroupHeader = !hasNoCode && !isSingleItem;
                const isCollapsed = showGroupHeader && collapsedGroups.has(group.code);
                return (
                <div
                  key={group.code}
                  onDragOver={e => { const k = dragKeyRef.current; if (k && k !== group.code) e.preventDefault(); }}
                  onDrop={e => { e.preventDefault(); const k = dragKeyRef.current; if (k) reorderInventoryGroups(k, group.code); dragKeyRef.current = null; setDragKey(null); }}
                  style={{ display: 'flex', alignItems: 'stretch', gap: '0.4rem', opacity: dragKey === group.code ? 0.45 : 1, transition: 'opacity 0.15s ease' }}
                >
                  {/* ☰ 드래그 핸들 — 잡고 위/아래로 옮기면 순서 변경 */}
                  <div
                    draggable
                    onDragStart={e => { dragKeyRef.current = group.code; setDragKey(group.code); try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', group.code); } catch {} }}
                    onDragEnd={() => { dragKeyRef.current = null; setDragKey(null); }}
                    onClick={e => e.stopPropagation()}
                    title="드래그하여 순서 변경"
                    style={{ flexShrink: 0, alignSelf: 'center', padding: '0.25rem', cursor: 'grab', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', touchAction: 'none' }}
                  >
                    <Menu size={16} />
                  </div>
                  <div
                    style={showGroupHeader ? {
                      flex: 1,
                      minWidth: 0,
                      border: groupHasDanger ? '1px solid var(--danger-soft-border)' : '1px solid var(--panel-border)',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      background: 'var(--surface-elevated)'
                    } : { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
                  >
                  {showGroupHeader && (
                    <div
                      onClick={() => toggleGroupCollapse(group.code)}
                      title={isCollapsed ? '펼치기' : '접기'}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.9rem', borderBottom: isCollapsed ? 'none' : '1px solid var(--panel-border)', background: 'var(--hover-bg)', cursor: 'pointer', userSelect: 'none' }}
                    >
                      <ChevronDown size={14} style={{ flexShrink: 0, color: 'var(--text-tertiary)', transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s ease' }} />
                      <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--text-tertiary)', flexShrink: 0 }}>{groupOrderNum}</span>
                      <span className="badge" style={{ background: 'var(--accent-soft-bg)', color: 'var(--accent)', border: '1px solid var(--accent-soft-border)', fontSize: '0.68rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '5px', flexShrink: 0 }}>{group.label}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginLeft: 'auto', fontWeight: 600 }}>{group.items.length}종</span>
                      {groupHasDanger && (
                        <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', background: 'var(--danger-soft-bg)', color: 'var(--danger)', border: '1px solid var(--danger-soft-border)', fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.35rem', borderRadius: '4px', flexShrink: 0 }}>
                          <AlertTriangle size={9} />위험 재고 포함
                        </span>
                      )}
                    </div>
                  )}
                  <div style={{ ...(showGroupHeader ? { display: isCollapsed ? 'none' : 'flex', flexDirection: 'column' } : { display: 'contents' }) }}>
                  {group.items.map((item) => {
                const qtyNum = Number(item.attrs.qty) || 0;
                const isNegative = qtyNum < 0;
                return (
                <div
                  key={item.id}
                  className={showGroupHeader ? 'inv-row' : 'card card-compact'}
                  onDragOver={showGroupHeader ? (e => { const k = dragItemRef.current; if (k && k !== item.id) e.preventDefault(); }) : undefined}
                  onDrop={showGroupHeader ? (e => { e.preventDefault(); const k = dragItemRef.current; if (k) reorderInventoryItems(k, item.id); dragItemRef.current = null; setDragItemId(null); }) : undefined}
                  style={showGroupHeader ? {
                    padding: '0.9rem',
                    borderTop: '1px solid var(--panel-border)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                    position: 'relative',
                    opacity: dragItemId === item.id ? 0.45 : 1,
                    background: isNegative ? 'var(--danger-tint)' : 'transparent'
                  } : {
                    padding: '1.25rem',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    height: '115px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    overflow: 'hidden'
                  }}
                  onClick={() => setEditingInventory ? setEditingInventory(item) : null}
                >
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    {/* 그룹 내 항목 드래그 핸들 (사이즈별 순서 변경) */}
                    {showGroupHeader && (
                      <div
                        draggable
                        onDragStart={e => { dragItemRef.current = item.id; setDragItemId(item.id); try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', item.id); } catch {} e.stopPropagation(); }}
                        onDragEnd={() => { dragItemRef.current = null; setDragItemId(null); }}
                        onClick={e => e.stopPropagation()}
                        title="드래그하여 순서 변경"
                        style={{ flexShrink: 0, marginRight: '0.3rem', padding: '0.15rem', cursor: 'grab', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}
                      >
                        <Menu size={13} />
                      </div>
                    )}
                    {/* Col 1: Index + Package Icon */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '3.1rem', flexShrink: 0 }}>
                      <span className="text-xs font-mono text-gray-400" style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#9ca3af' }}>
                        {showGroupHeader ? '' : groupOrderNum}
                      </span>
                      <div style={{ color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}>
                        <Package size={13} />
                      </div>
                    </div>

                    {/* Col 2: Code badge (fixed width) */}
                    <div style={{ width: '70px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                      {item.attrs.code ? (
                        <span 
                          className="badge" 
                          style={{ 
                            background: 'var(--panel-border)', 
                            color: 'var(--text-secondary)', 
                            fontSize: '0.65rem', 
                            fontWeight: 700,
                            maxWidth: '60px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'inline-block',
                            textAlign: 'center'
                          }}
                          title={item.attrs.code}
                        >
                          {item.attrs.code}
                        </span>
                      ) : (
                        <span style={{ width: '60px' }} />
                      )}
                    </div>

                    {/* Col 3: Item Title (flex: 1) */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', minWidth: 0, paddingLeft: '0.5rem' }}>
                      <span
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          textAlign: 'left',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: 'block',
                          width: '100%'
                        }}
                        title={item.title}
                      >
                        {item.title}
                      </span>
                    </div>

                    {/* Col 4: 재고 상태 뱃지 (보유/소진/부족) — 마지막 이동이 아니라 현재 수량 기준 */}
                    <div style={{ width: '55px', flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      {(() => {
                        const isOut = qtyNum < 0;
                        const isZero = qtyNum === 0;
                        const label = isOut ? '부족' : isZero ? '소진' : '보유';
                        const color = isOut ? 'var(--danger)' : isZero ? 'var(--text-tertiary)' : 'var(--success)';
                        const bg = isOut ? 'var(--danger-soft-bg)' : isZero ? 'var(--hover-bg)' : 'var(--success-soft-bg)';
                        const bd = isOut ? 'var(--danger-soft-border)' : isZero ? 'var(--panel-border)' : 'var(--success-soft-border)';
                        return (
                          <span className="badge" style={{ background: bg, color, border: `1px solid ${bd}`, fontSize: '0.6rem', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 600 }}>
                            {label}
                          </span>
                        );
                      })()}
                    </div>
                    
                    {/* Col 5: Quantity indicator (aligned right) */}
                    <div 
                      className="inv-qty" 
                      style={{ 
                        color: isNegative ? 'var(--danger)' : 'var(--accent)',
                        background: isNegative ? 'var(--danger-soft-bg)' : 'var(--accent-soft-bg)',
                        border: `1px solid ${isNegative ? 'var(--danger-soft-border)' : 'var(--accent-soft-border)'}`,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.45rem',
                        borderRadius: '5px',
                        whiteSpace: 'nowrap',
                        marginLeft: '0.5rem',
                        flexShrink: 0,
                        width: '45px',
                        textAlign: 'center'
                      }}
                    >
                      {qtyNum > 0 ? `+${qtyNum}` : `${qtyNum}`}개
                    </div>
                  </div>

                  {/* Spacious Metadata Row & Linked Badges nicely offset to align with Title */}
                  <div style={{ paddingLeft: '3.1rem', marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <div className="inv-detail" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-tertiary)', fontSize: '0.72rem', flexWrap: 'wrap', textAlign: 'left' }}>
                      {isNegative && (
                        <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', background: 'var(--danger-soft-bg)', color: 'var(--danger)', border: '1px solid var(--danger-soft-border)', fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                          <AlertTriangle size={9} />위험 재고
                        </span>
                      )}
                      {item.attrs.serial && (
                        <>
                          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>S/N: {item.attrs.serial}</span>
                          <span style={{ opacity: 0.3 }}>•</span>
                        </>
                      )}
                      {item.attrs.loc && (
                        <>
                          <span>{item.attrs.loc}</span>
                          <span style={{ opacity: 0.3 }}>•</span>
                        </>
                      )}
                      {item.attrs.mgr && (
                        <>
                          <span>{item.attrs.mgr}</span>
                          <span style={{ opacity: 0.3 }}>•</span>
                        </>
                      )}
                      {item.attrs.client && (
                        <>
                          <span className="badge" style={{ background: 'var(--hover-bg)', color: 'var(--text-secondary)', border: '1px solid var(--panel-border)', fontSize: '0.6rem', fontWeight: 600, padding: '0.1rem 0.3rem', borderRadius: '4px' }}>{item.attrs.client}</span>
                          <span style={{ opacity: 0.3 }}>•</span>
                        </>
                      )}
                      {item.updatedAt && (
                        <>
                          <span>{format(parseISO(item.updatedAt), 'MM.dd HH:mm')}</span>
                        </>
                      )}
                      {item.category && item.category !== '재고' && item.category !== 'assets' && (
                        <>
                          <span style={{ opacity: 0.3 }}>•</span>
                          <span className="badge" style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem' }}>{item.category}</span>
                        </>
                      )}
                    </div>

                    {/* Linked Badges */}
                    {item.attrs.linkedIds && item.attrs.linkedIds.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.1rem' }}>
                        {item.attrs.linkedIds.map((linkedId: string) => {
                          const linkedRecord = records.find(r => r.id === linkedId);
                          if (!linkedRecord) return null;
                          return (
                            <span 
                              key={linkedId} 
                              className="text-xs bg-white/5 text-gray-400 rounded-full px-2 py-1"
                              style={{ fontSize: '0.68rem', backgroundColor: 'rgba(255,255,255,0.08)', color: '#a1a1aa', borderRadius: '9999px', padding: '0.15rem 0.4rem', border: '1px solid rgba(255,255,255,0.05)' }}
                            >
                              #{linkedRecord.title}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="card-hover-actions">
                    <button className="ghost-btn" onClick={(e) => { e.stopPropagation(); setEditingInventory(item); }}>수정</button>
                    <button className="ghost-btn" onClick={(e) => { e.stopPropagation(); handleDuplicateInventory(item.id); }}>복제</button>
                    <button className="ghost-btn danger" onClick={(e) => { e.stopPropagation(); deleteInventoryItem(item.id); }}>삭제</button>
                  </div>
                </div>
                );
                  })}
                  </div>
                  </div>
                </div>
                );
              })}

              {inventoryTotalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.8rem', marginTop: '0.5rem' }}>
                  <button 
                    onClick={() => setInventoryPage(prev => Math.max(0, prev - 1))}
                    disabled={inventoryPage === 0}
                    className="ghost-btn"
                    style={{ opacity: inventoryPage === 0 ? 0.3 : 1, padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                  >
                    이전
                  </button>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {inventoryPage + 1} / {inventoryTotalPages}
                  </span>
                  <button 
                    onClick={() => setInventoryPage(prev => Math.min(inventoryTotalPages - 1, prev + 1))}
                    disabled={inventoryPage === inventoryTotalPages - 1}
                    className="ghost-btn"
                    style={{ opacity: inventoryPage === inventoryTotalPages - 1 ? 0.3 : 1, padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                  >
                    다음
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
  );
}
