'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CheckCircle2, Circle, AlertTriangle, Calendar as CalIcon, Layers, ClipboardList, ChevronDown, Sliders, Pin, Coffee, AlertCircle, Calendar, Trophy, RefreshCw, ExternalLink, Building2 } from 'lucide-react';
import { useApp } from '@/frontend/context/AppContext';
import { getCategoryColorStyles, getMemoCardStyle } from '@/frontend/utils/styles';
import { stripMarkdown } from '@/frontend/utils/markdown';
import type { UniversalRecord } from '@/database';

/**
 * 전체(홈 대시보드) 탭 섹션 (page.tsx에서 추출 — 동작 동일).
 * 스마트 데일리 브리핑, KPI 스트립, 데이터 인사이트(업무 진행·재고 건전성·카테고리 비율),
 * 오늘 일정·최근 메모·재고 흐름 요약 위젯과 카테고리 비율 고정 툴팁을 포함한다.
 */
export default function OverviewSection({
  schedules,
  memos,
  inventory,
  setIsMemoEditing,
}: {
  schedules: UniversalRecord[];
  memos: UniversalRecord[];
  inventory: UniversalRecord[];
  setIsMemoEditing: (v: boolean) => void;
}) {
  const {
    records, theme, appSettings, setActiveTab,
    setEditingSchedule, setEditingInventory,
    setMemoForm, setIsMemoModalOpen,
    toggleComplete,
    erpCache, erpSyncing, refreshERP,
  } = useApp();

  const getCategoryColor = (cat: string) => getCategoryColorStyles(cat, appSettings.categoryColors).solid;
  const getCategorySoftBg = (cat: string) => getCategoryColorStyles(cat, appSettings.categoryColors).soft;
  const getCategoryBorder = (cat: string) => getCategoryColorStyles(cat, appSettings.categoryColors).border;

  // Widgets collapse/expand states inside Overview
  const [isTodaySchedulesExpanded, setIsTodaySchedulesExpanded] = useState<boolean>(true);
  const [isRecentMemosExpanded, setIsRecentMemosExpanded] = useState<boolean>(true);
  const [isInventoryFlowExpanded, setIsInventoryFlowExpanded] = useState<boolean>(true);

  // State for category ratio fixed tooltip (position: fixed to escape overflow clipping)
  const [categoryTooltip, setCategoryTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    cat: string;
    cnt: number;
    pct?: number;
    titles: string[];
    color: string;
  } | null>(null);

  // Today's summary values for Home Dashboard
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayIncompleteSchedules = schedules.filter(s => s.attrs.date === todayStr && !s.attrs.completed);
  const overdueSchedules = schedules.filter(s => s.attrs.date < todayStr && !s.attrs.completed);
  const todaySchedulesFull = schedules
    .filter(s => s.attrs.date === todayStr)
    .sort((a, b) => {
      const aAll = !!a.attrs.allDay;
      const bAll = !!b.attrs.allDay;
      if (aAll && !bAll) return -1;
      if (!aAll && bAll) return 1;
      return (a.attrs.time || '23:59').localeCompare(b.attrs.time || '23:59');
    });
  const todaySchedules = todaySchedulesFull.slice(0, appSettings.maxEventsShown || 5);
  const recentMemos = memos.slice(0, appSettings.maxMemosShown || 3); // Show latest memos on Dashboard up to limit
  const lowStockItems = inventory.filter(i => (Number(i.attrs.qty) || 0) < 0); // Critical items with negative stock (qty < 0)
  const recentInventoryFlow = inventory.slice(0, appSettings.maxInventoryShown || 5); // Show latest asset adjustments up to limit

  return (
    <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>

          {/* Dashboard Summary Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.1rem 0.2rem', marginBottom: '0.1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.05rem' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '0.015em', textAlign: 'left' }}>Overview</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 500, textAlign: 'left' }}>{format(new Date(), 'yyyy년 M월 d일 EEEE')}</div>
            </div>
          </div>

          {/* Smart Daily Briefing Widget */}
          {(() => {
            const totalTodaySchedules = schedules.filter(s => s.attrs.date === todayStr).length;
            const remainingTodaySchedules = todayIncompleteSchedules.length;
            const overdueSchedulesCount = overdueSchedules.length;
            const lowStockItemsCount = inventory.filter(i => (Number(i.attrs.qty) || 0) < 0).length; // 위험 재고 = 수량 음수
            const erpPendingCount = (erpCache?.dashboard.pendingApprovals ?? 0) + (erpCache?.dashboard.pendingShipments ?? 0);
            const erpLowStockCount = erpCache?.lowStock.length ?? 0;

            let greeting = "오늘도 좋은 하루 보내시길 바랍니다!";
            const hour = new Date().getHours();
            if (hour >= 5 && hour < 9) greeting = "오늘도 힘차게 시작하는 좋은 아침입니다!";
            else if (hour >= 9 && hour < 12) greeting = "업무에 집중하기 좋은 오전 시간입니다.";
            else if (hour >= 12 && hour < 13) greeting = "맛있는 식사와 함께 편안한 점심시간 보내세요.";
            else if (hour >= 13 && hour < 18) greeting = "오늘 오후도 활기차게 보내시길 바랍니다.";
            else if (hour >= 18 && hour < 22) greeting = "오늘 하루도 수고 많으셨습니다. 편안한 저녁 보내세요.";
            else greeting = "오늘 하루도 고생하셨습니다. 평안한 밤 되시길 바랍니다.";
            
            let briefing: {
              greeting: string;
              statusLevel: 'calm' | 'busy' | 'warning' | 'done';
              scheduleMessage: string;
              inventoryMessage: string;
              actionTip: string;
            };
            
            if (lowStockItemsCount > 0 || overdueSchedulesCount > 0 || erpPendingCount > 0 || erpLowStockCount > 0) {
              const schedMsg = overdueSchedulesCount > 0
                ? `미완료된 지난 일정이 ${overdueSchedulesCount}건 있습니다.`
                : erpPendingCount > 0
                ? `ERP 승인·출고 대기가 ${erpPendingCount}건 있습니다.`
                : `오늘 대기 중인 일정이 ${remainingTodaySchedules}건 있습니다.`;
              const invMsg = lowStockItemsCount > 0
                ? `수량이 부족한 품목이 ${lowStockItemsCount}건 감지되었습니다.`
                : erpLowStockCount > 0
                ? `ERP 저재고 품목이 ${erpLowStockCount}건 있습니다.`
                : "재고 상태가 양호합니다.";
              
              briefing = {
                greeting,
                statusLevel: 'warning',
                scheduleMessage: schedMsg,
                inventoryMessage: invMsg,
                actionTip: "빠른 확인 및 조치를 권장합니다."
              };
            } else if (totalTodaySchedules > 0 && remainingTodaySchedules === 0) {
              briefing = {
                greeting,
                statusLevel: 'done',
                scheduleMessage: "금일 등록된 일정이 모두 완료되었습니다.",
                inventoryMessage: "재고 상태가 양호합니다.",
                actionTip: "편안한 마음으로 남은 업무를 점검해 보세요."
              };
            } else if (remainingTodaySchedules > 0) {
              briefing = {
                greeting,
                statusLevel: 'busy',
                scheduleMessage: `오늘 ${remainingTodaySchedules}건의 일정이 대기 중입니다.`,
                inventoryMessage: "재고 상태가 양호합니다.",
                actionTip: "화이팅 넘치는 하루 되세요!"
              };
            } else {
              briefing = {
                greeting,
                statusLevel: 'calm',
                scheduleMessage: "오늘 새로 등록된 일정이 없습니다.",
                inventoryMessage: "재고 상태가 양호하게 유지되고 있습니다.",
                actionTip: "시간이 날 때 다음 주 일정을 미리 계획해 볼까요?"
              };
            }
            
            let styles = {
              textClass: "text-emerald-600 dark:text-emerald-400",
              containerBg: "rgba(5, 150, 105, 0.05)",
              containerBorder: "1px solid rgba(5, 150, 105, 0.15)",
              iconBg: "rgba(5, 150, 105, 0.12)",
              iconColor: "#059669",
              IconComponent: Coffee
            };
            
            if (briefing.statusLevel === 'warning') {
              styles = {
                textClass: "text-amber-600 dark:text-amber-400",
                containerBg: "rgba(217, 119, 6, 0.05)",
                containerBorder: "1px solid rgba(217, 119, 6, 0.15)",
                iconBg: "rgba(217, 119, 6, 0.12)",
                iconColor: "#d97706",
                IconComponent: AlertCircle
              };
            } else if (briefing.statusLevel === 'busy') {
              styles = {
                textClass: "text-blue-600 dark:text-blue-400",
                containerBg: "rgba(37, 99, 235, 0.05)",
                containerBorder: "1px solid rgba(37, 99, 235, 0.15)",
                iconBg: "rgba(37, 99, 235, 0.12)",
                iconColor: "#2563eb",
                IconComponent: Calendar
              };
            } else if (briefing.statusLevel === 'done') {
              styles = {
                textClass: "text-indigo-600 dark:text-indigo-400",
                containerBg: "rgba(79, 70, 229, 0.05)",
                containerBorder: "1px solid rgba(79, 70, 229, 0.15)",
                iconBg: "rgba(79, 70, 229, 0.12)",
                iconColor: "#4f46e5",
                IconComponent: Trophy
              };
            }
            
            return (
              <div style={{
                background: styles.containerBg,
                backdropFilter: 'var(--panel-blur)',
                WebkitBackdropFilter: 'var(--panel-blur)',
                border: styles.containerBorder,
                borderRadius: '16px',
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                boxShadow: 'var(--shadow-sm)',
                textAlign: 'left'
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: styles.iconBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: styles.iconColor,
                  flexShrink: 0
                }}>
                  <styles.IconComponent size={16} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1 }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800 }} className={styles.textClass}>
                    {briefing.greeting}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.18rem', paddingLeft: '0.1rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ color: styles.iconColor }}>•</span> {briefing.scheduleMessage}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ color: styles.iconColor }}>•</span> {briefing.inventoryMessage}
                    </span>
                  </div>
                  <span style={{ marginTop: '0.15rem', fontSize: '0.7rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                    {briefing.actionTip}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* ERP Ops 상태 카드 */}
          {erpCache && (
            <div style={{
              background: 'var(--panel-bg)',
              backdropFilter: 'var(--panel-blur)',
              WebkitBackdropFilter: 'var(--panel-blur)',
              border: '1px solid var(--panel-border)',
              borderRadius: '16px',
              padding: '1rem 1.2rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              boxShadow: 'var(--shadow-sm)',
            }}>
              {/* 헤더 — 다른 위젯 헤더 패턴과 통일 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Building2 size={15} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>ERP Ops</span>
                  {!erpCache.ok && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--danger)', fontWeight: 700, background: 'var(--danger-soft-bg)', padding: '0.1rem 0.4rem', borderRadius: '6px' }}>세션 만료</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>
                    {Math.floor((Date.now() - new Date(erpCache.fetchedAt).getTime()) / 60000)}분 전
                  </span>
                  <button
                    onClick={refreshERP}
                    disabled={erpSyncing}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '2px', display: 'flex', opacity: erpSyncing ? 0.5 : 1 }}
                    title="ERP 데이터 새로고침"
                  >
                    <RefreshCw size={13} style={{ animation: erpSyncing ? 'spin 1s linear infinite' : 'none' }} />
                  </button>
                  <a
                    href="https://erp.fitogether.com/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--text-tertiary)', display: 'flex' }}
                    title="ERP 열기"
                  >
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>

              {erpCache.ok && (
                <>
                  {/* Metric 타일 — KPI 스트립과 동일 스타일 */}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {[
                      { label: '승인 대기', value: erpCache.dashboard.pendingApprovals, href: '/orders?status=REGISTERED' },
                      { label: '출고 대기', value: erpCache.dashboard.pendingShipments, href: '/shipments?status=PENDING' },
                      { label: '출고 진행', value: erpCache.dashboard.inProgressShipments, href: '/shipments?status=APPROVED' },
                    ].map(({ label, value, href }) => (
                      <a
                        key={label}
                        href={`https://erp.fitogether.com${href}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          flex: 1,
                          background: value > 0 ? 'var(--warning-soft-bg)' : 'var(--insight-tile-bg)',
                          border: `1px solid ${value > 0 ? 'rgba(217,119,6,0.25)' : 'var(--insight-tile-border)'}`,
                          borderRadius: '12px',
                          padding: '0.55rem 0.5rem',
                          textAlign: 'center',
                          textDecoration: 'none',
                          transition: 'transform 0.15s ease',
                        }}
                      >
                        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: value > 0 ? '#d97706' : 'var(--text-primary)', lineHeight: 1 }}>
                          {value}
                        </div>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-tertiary)', marginTop: '0.2rem', letterSpacing: '0.02em' }}>{label}</div>
                      </a>
                    ))}
                  </div>

                  {/* 저재고 목록 */}
                  {erpCache.lowStock.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', borderTop: '1px solid var(--panel-border)', paddingTop: '0.5rem' }}>
                      {erpCache.lowStock.slice(0, 3).map(item => (
                        <div key={item.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', padding: '0.1rem 0' }}>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{item.name}</span>
                          <span style={{ color: item.qty <= 0 ? 'var(--danger)' : '#d97706', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                            {item.qty} / {item.safeStock}
                          </span>
                        </div>
                      ))}
                      {erpCache.lowStock.length > 3 && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: '0.1rem' }}>
                          +{erpCache.lowStock.length - 3}개 더
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* KPI Strip — 4 핵심 지표 한눈에 */}
          <div className="kpi-strip">
            <div className="kpi-tile clickable" onClick={() => setActiveTab('calendar')}>
              <span className="kpi-label">오늘 일정</span>
              <div className="flex items-baseline gap-1" style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                <span className="kpi-value">{todayIncompleteSchedules.length}</span>
                <span className="kpi-sub">건</span>
              </div>
              <span className="text-xs text-gray-500" style={{ fontSize: '0.72rem', color: '#8e8e93', marginTop: '0.1rem' }}>
                (밀린 일정 {overdueSchedules.length}건)
              </span>
            </div>
            <div className="kpi-tile clickable" onClick={() => setActiveTab('calendar')}>
              <span className="kpi-label">예정</span>
              <div className="flex items-baseline gap-1" style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                <span className="kpi-value">{schedules.filter(s => !s.attrs.completed).length}</span>
                <span className="kpi-sub">전체</span>
              </div>
            </div>
            <div className="kpi-tile clickable" onClick={() => setActiveTab('memo' as any)}>
              <span className="kpi-label">메모</span>
              <div className="flex items-baseline gap-1" style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                <span className="kpi-value">{memos.length}</span>
                <span className="kpi-sub">건</span>
              </div>
            </div>
            <div className="kpi-tile clickable" onClick={() => setActiveTab('inventory')}>
              <span className="kpi-label">재고 품목</span>
              <div className="flex items-baseline gap-1" style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                <span className="kpi-value">{inventory.length}</span>
                <span className="kpi-sub">품목</span>
              </div>
            </div>
          </div>

          {/* Visual Analytics Widget */}
          <div style={{
            background: 'var(--panel-bg)',
            backdropFilter: 'var(--panel-blur)',
            WebkitBackdropFilter: 'var(--panel-blur)',
            border: '1px solid var(--panel-border)',
            borderRadius: '16px',
            padding: '1.2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Sliders size={15} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>데이터 인사이트</span>
            </div>

            <div className="insight-grid">
              {/* Task Progress & Completion Rate Combined Indicator */}
              <div style={{
                background: 'var(--insight-tile-bg)',
                border: '1px solid var(--insight-tile-border)',
                borderRadius: '12px',
                padding: '0.75rem 0.9rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem'
              }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>업무 진행 및 달성</div>
                {(() => {
                  const todoCount = schedules.filter(s => !s.attrs.completed && s.attrs.status !== 'doing').length;
                  const doingCount = schedules.filter(s => !s.attrs.completed && s.attrs.status === 'doing').length;
                  const doneCount = schedules.filter(s => s.attrs.completed).length;
                  const total = todoCount + doingCount + doneCount || 1;
                  const pct = Math.round((doneCount / total) * 100);
                  
                  const todoPct = (todoCount / total) * 100;
                  const doingPct = (doingCount / total) * 100;
                  const donePct = (doneCount / total) * 100;
                  
                  return (
                    <>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.15rem' }}>
                        <span style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                          {pct}
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>% 달성</span>
                      </div>
                      
                      {/* Segmented Progress Bar */}
                      <div style={{ display: 'flex', height: '5px', borderRadius: '3px', overflow: 'hidden', background: 'var(--panel-border)', width: '100%', marginTop: '0.1rem' }}>
                        {todoCount > 0 && <div style={{ width: `${todoPct}%`, background: '#9ca3af', height: '100%' }} title={`대기: ${todoCount}건`} />}
                        {doingCount > 0 && <div style={{ width: `${doingPct}%`, background: 'var(--accent)', height: '100%' }} title={`진행: ${doingCount}건`} />}
                        {doneCount > 0 && <div style={{ width: `${donePct}%`, background: 'var(--success)', height: '100%' }} title={`완료: ${doneCount}건`} />}
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                        <span>대기 {todoCount}</span>
                        <span>진행 {doingCount}</span>
                        <span>완료 {doneCount}</span>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Inventory Health Indicator (Red / Yellow / Green) */}
              <div style={{
                background: 'var(--insight-tile-bg)',
                border: '1px solid var(--insight-tile-border)',
                borderRadius: '12px',
                padding: '0.75rem 0.9rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem'
              }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>재고 건전성</div>
                {(() => {
                  // 위험 재고 = 수량이 음수(0개 밑)로 떨어진 품목
                  const dangerItemsCount = inventory.filter(i => (Number(i.attrs.qty) || 0) < 0).length;

                  let healthText = "양호";
                  let healthColor = "var(--success)"; // Green
                  let healthIcon = <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />;
                  let healthDesc = "모든 품목 수량 충분";

                  if (dangerItemsCount > 0) {
                    healthText = "위험";
                    healthColor = "var(--danger)"; // Red
                    healthIcon = <AlertTriangle size={14} style={{ color: 'var(--danger)' }} />;
                    healthDesc = `위험 재고 ${dangerItemsCount}개 (수량 음수)`;
                  }

                  return (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        {healthIcon}
                        <span style={{ fontSize: '1.4rem', fontWeight: 900, color: healthColor }}>
                          {healthText}
                        </span>
                      </div>
                      
                      {/* Subtitle list of low stock items */}
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '0.1rem' }}>
                        {healthDesc}
                      </div>
                      
                      <div style={{ fontSize: '0.58rem', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {inventory.filter(i => (Number(i.attrs.qty) || 0) < 0).map(i => i.title).join(', ') || '위험 재고 없음'}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Category stacked bar */}
            {(() => {
              const masterCats = appSettings.scheduleCategories || ['업무', '회의', '개인', '일반'];
              const displayCats = [...masterCats];
              const hasOther = schedules.some(s => !masterCats.includes(s.category || '일반'));
              if (hasOther) {
                displayCats.push('기타');
              }
              const getSchedulesForCat = (cat: string) => {
                return schedules.filter(s => {
                  const c = s.category || '일반';
                  if (cat === '기타') {
                    return !masterCats.includes(c);
                  }
                  return c === cat;
                });
              };

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    <span>일정 카테고리 구성 비율</span>
                    <span>총 {schedules.length}건</span>
                  </div>
                  <div style={{ height: '14px', borderRadius: '7px', display: 'flex', overflow: 'visible', background: 'var(--panel-border)', width: '100%', position: 'relative' }}>
                    {(() => {
                      const activeCats = displayCats.map(cat => {
                        const catSchedules = getSchedulesForCat(cat);
                        return { cat, catSchedules, cnt: catSchedules.length };
                      }).filter(c => c.cnt > 0);
                      
                      return activeCats.map((item, idx) => {
                        const { cat, catSchedules, cnt } = item;
                        const pct = Math.round((cnt / (schedules.length || 1)) * 100);
                        
                        const isFirst = idx === 0;
                        const isLast = idx === activeCats.length - 1;
                        
                        return (
                          <div
                            key={cat}
                            className="ratio-bar-segment"
                            style={{
                              height: '100%',
                              background: getCategoryColor(cat),
                              width: `${pct}%`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#ffffff',
                              fontSize: '0.55rem',
                              fontWeight: 800,
                              transition: 'width 0.4s ease',
                              cursor: 'pointer',
                              borderTopLeftRadius: isFirst ? '7px' : '0',
                              borderBottomLeftRadius: isFirst ? '7px' : '0',
                              borderTopRightRadius: isLast ? '7px' : '0',
                              borderBottomRightRadius: isLast ? '7px' : '0'
                            }}
                            onMouseEnter={e => {
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              setCategoryTooltip({
                                visible: true,
                                x: rect.left + rect.width / 2,
                                y: rect.top - 8,
                                cat,
                                cnt,
                                pct,
                                titles: catSchedules.map(s => s.title),
                                color: getCategoryColor(cat)
                              });
                            }}
                            onMouseLeave={() => setCategoryTooltip(null)}
                          >
                            {pct > 10 && cat}
                          </div>
                        );
                      });
                    })()}
                  </div>
                  <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', marginTop: '0.1rem' }}>
                    {displayCats.map(cat => {
                      const catSchedules = getSchedulesForCat(cat);
                      const cnt = catSchedules.length;
                      if (cnt === 0) return null;

                      return (
                        <div
                          key={cat}
                          className="legend-item-container"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontSize: '0.65rem',
                            color: 'var(--text-secondary)',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                          onMouseEnter={e => {
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setCategoryTooltip({
                              visible: true,
                              x: rect.left,
                              y: rect.top - 8,
                              cat,
                              cnt,
                              titles: catSchedules.map(s => s.title),
                              color: getCategoryColor(cat)
                            });
                          }}
                          onMouseLeave={() => setCategoryTooltip(null)}
                        >
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: getCategoryColor(cat) }} />
                          <span>{cat}</span>
                          <span style={{ color: 'var(--text-tertiary)' }}>{cnt}건</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Unified Overview Status Widget */}
          <div style={{ background: 'var(--panel-bg)', backdropFilter: 'var(--panel-blur)', WebkitBackdropFilter: 'var(--panel-blur)', border: '1px solid var(--panel-border)', borderRadius: '16px', padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            
            {/* 1. 오늘 예정된 일정 (Today's Schedule) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div 
                onClick={() => setIsTodaySchedulesExpanded(!isTodaySchedulesExpanded)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <CalIcon size={13} style={{ color: 'var(--accent)' }} />
                  <span>오늘 예정된 일정</span>
                  {todaySchedulesFull.length > 0 && <span className="badge" style={{ background: 'var(--accent-soft-bg)', color: 'var(--accent)', marginLeft: '0.2rem', fontSize: '0.6rem' }}>{todaySchedulesFull.length}건</span>}
                </div>
                <ChevronDown size={13} style={{ transform: isTodaySchedulesExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: 'var(--text-tertiary)' }} />
              </div>
              
              {isTodaySchedulesExpanded && (
                <div className="card-list" style={{ gap: '0.35rem' }}>
                  {todaySchedules.length === 0 ? (
                    <div style={{ padding: '0.4rem 0.1rem', fontSize: '0.78rem', color: 'var(--text-tertiary)', fontWeight: 500, textAlign: 'left' }}>등록된 일정이 존재하지 않습니다.</div>
                  ) : (
                    todaySchedules.map((s, idx) => (
                      <div 
                        key={s.id} 
                        className={`card card-compact ${s.attrs.completed ? 'completed opacity-40 line-through' : ''}`} 
                        style={{ 
                          padding: '0.5rem 0.8rem', 
                          borderRadius: '10px', 
                          opacity: s.attrs.completed ? 0.4 : undefined,
                          height: '56px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          gap: '0.15rem',
                          overflow: 'hidden',
                          cursor: 'pointer'
                        }} 
                        onClick={() => setEditingSchedule(s)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                          {/* Complete Check Icon */}
                          <div 
                            onClick={(e) => toggleComplete(e, s)}
                            style={{ color: s.attrs.completed ? 'var(--success)' : 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', marginRight: '0.4rem', flexShrink: 0 }}
                          >
                            {s.attrs.completed ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                          </div>

                          {/* Title (flex: 1) & Category badge */}
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                            <span
                              style={{
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                color: s.attrs.completed ? 'var(--text-tertiary)' : 'var(--text-primary)',
                                textDecoration: s.attrs.completed ? 'line-through' : 'none',
                                textAlign: 'left',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                              title={s.title}
                            >
                              {s.title}
                            </span>
                            {s.category && (
                              <span
                                className="badge"
                                style={{
                                  fontSize: '0.55rem',
                                  padding: '0.05rem 0.3rem',
                                  borderRadius: '4px',
                                  fontWeight: 600,
                                  flexShrink: 0,
                                  background: getCategorySoftBg(s.category),
                                  color: getCategoryColor(s.category),
                                  border: `1px solid ${getCategoryBorder(s.category)}`
                                }}
                              >
                                {s.category}
                              </span>
                            )}
                            {s.attrs.client && (
                              <span
                                className="badge"
                                style={{
                                  fontSize: '0.55rem',
                                  padding: '0.05rem 0.3rem',
                                  borderRadius: '4px',
                                  fontWeight: 600,
                                  flexShrink: 0,
                                  background: 'var(--hover-bg)',
                                  color: 'var(--text-secondary)',
                                  border: '1px solid var(--panel-border)'
                                }}
                              >
                                {s.attrs.client}
                              </span>
                            )}
                          </div>

                          {/* Time */}
                          {s.attrs.allDay ? (
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: 600, flexShrink: 0, marginLeft: '0.5rem', background: 'var(--hover-bg)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                              하루 종일
                            </span>
                          ) : s.attrs.time ? (
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: 600, flexShrink: 0, marginLeft: '0.5rem' }}>
                              {s.attrs.time}
                            </span>
                          ) : null}
                        </div>
                        
                        {/* Linked Badges (Single row below title) */}
                        {s.attrs.linkedIds && s.attrs.linkedIds.length > 0 && (
                          <div style={{ display: 'flex', gap: '0.2rem', overflow: 'hidden', whiteSpace: 'nowrap', paddingLeft: '1.05rem' }}>
                            {s.attrs.linkedIds.map((linkedId: string) => {
                              const linkedRecord = records.find(r => r.id === linkedId);
                              if (!linkedRecord) return null;
                              return (
                                <span 
                                  key={linkedId} 
                                  style={{ fontSize: '0.58rem', backgroundColor: 'rgba(0,0,0,0.03)', color: 'var(--text-secondary)', borderRadius: '4px', padding: '0.02rem 0.25rem', border: '1px solid var(--panel-border)', flexShrink: 0 }}
                                >
                                  #{linkedRecord.title}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Divider */}
            <div style={{ height: '1px', background: 'var(--panel-border)', opacity: 0.6 }} />

            {/* 2. 최근 등록된 메모 (Recent Memos) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div 
                onClick={() => setIsRecentMemosExpanded(!isRecentMemosExpanded)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ClipboardList size={13} style={{ color: 'var(--accent)' }} />
                  <span>최근 등록된 메모</span>
                </div>
                <ChevronDown size={13} style={{ transform: isRecentMemosExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: 'var(--text-tertiary)' }} />
              </div>
              
              {isRecentMemosExpanded && (
                <div className="card-list" style={{ gap: '0.35rem' }}>
                  {recentMemos.length === 0 ? (
                    <div style={{ padding: '0.4rem 0.1rem', fontSize: '0.78rem', color: 'var(--text-tertiary)', fontWeight: 500, textAlign: 'left' }}>등록된 메모가 존재하지 않습니다.</div>
                  ) : (
                    recentMemos.map(m => (
                      <div 
                        key={m.id} 
                        className="card card-compact" 
                        style={{ 
                          padding: '0.5rem 0.8rem',
                          borderRadius: '10px',
                          height: '56px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          gap: '0.15rem',
                          cursor: 'pointer',
                          overflow: 'hidden',
                          ...getMemoCardStyle(m.attrs.color || '', theme === 'dark')
                        }} 
                        onClick={() => {
                          setMemoForm({ id: m.id, title: m.title || '제목 없음', content: m.attrs.content || '', pinned: m.attrs.pinned || false, color: m.attrs.color || '', client: m.attrs.client || '' });
                          setIsMemoEditing(false); // 상세보기 = 읽기 전용
                          setIsMemoModalOpen(true);
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', width: '100%' }}>
                          {m.attrs.pinned && <Pin size={11} style={{ color: 'var(--accent)', transform: 'rotate(45deg)', flexShrink: 0 }} />}
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>
                            {m.title || '제목 없음'}
                          </span>
                          <span style={{ fontSize: '0.58rem', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                            {format(parseISO(m.updatedAt || new Date().toISOString()), 'yy.MM.dd')}
                          </span>
                        </div>
                        
                        {/* Excerpt of content */}
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left', paddingLeft: m.attrs.pinned ? '0.85rem' : '0' }}>
                          {m.attrs.content ? stripMarkdown(m.attrs.content).substring(0, 50) : '내용 없음'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Divider */}
            <div style={{ height: '1px', background: 'var(--panel-border)', opacity: 0.6 }} />

            {/* 3. 재고 흐름 요약 (Inventory Flow Summary) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div 
                onClick={() => setIsInventoryFlowExpanded(!isInventoryFlowExpanded)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Layers size={13} style={{ color: 'var(--accent)' }} />
                  <span>재고 흐름 요약</span>
                </div>
                <ChevronDown size={13} style={{ transform: isInventoryFlowExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: 'var(--text-tertiary)' }} />
              </div>

              {isInventoryFlowExpanded && (
                <div className="card-list" style={{ gap: '0.35rem' }}>
                  
                  {/* Low Stock Alerts */}
                  {lowStockItems.length > 0 && (
                    <div style={{ background: 'var(--danger-soft-bg)', border: '1px solid var(--danger-soft-border)', borderRadius: '8px', padding: '0.4rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <AlertTriangle size={12} style={{ color: 'var(--danger)' }} />
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--danger)' }}>수량 부족 품목 {lowStockItems.length}개 검출! 빠른 확인 요망.</span>
                    </div>
                  )}

                  {recentInventoryFlow.length === 0 ? (
                    <div style={{ padding: '0.4rem 0.1rem', fontSize: '0.78rem', color: 'var(--text-tertiary)', fontWeight: 500, textAlign: 'left' }}>등록된 재고가 존재하지 않습니다.</div>
                  ) : (
                    recentInventoryFlow.map((item, idx) => {
                      const qtyNum = Number(item.attrs.qty) || 0;
                      const isNegative = qtyNum < 0;
                      return (
                        <div 
                          key={item.id} 
                          className="inv-card" 
                          style={{ 
                            padding: '0.5rem 0.8rem', 
                            borderRadius: '10px',
                            height: '56px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            gap: '0.15rem',
                            overflow: 'hidden',
                            cursor: 'pointer'
                          }} 
                          onClick={() => setEditingInventory(item)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            {/* Flow Badge & Title */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0, flex: 1 }}>
                              <span
                                className="badge"
                                style={{
                                  background: isNegative ? 'var(--danger-soft-bg)' : qtyNum === 0 ? 'var(--hover-bg)' : 'var(--success-soft-bg)',
                                  color: isNegative ? 'var(--danger)' : qtyNum === 0 ? 'var(--text-tertiary)' : 'var(--success)',
                                  fontSize: '0.55rem',
                                  padding: '0.05rem 0.25rem',
                                  borderRadius: '4px',
                                  fontWeight: 800,
                                  flexShrink: 0
                                }}
                              >
                                {isNegative ? '부족' : qtyNum === 0 ? '소진' : '보유'}
                              </span>
                              <span 
                                style={{ 
                                  fontSize: '0.78rem', 
                                  fontWeight: 700, 
                                  color: 'var(--text-primary)', 
                                  textOverflow: 'ellipsis', 
                                  overflow: 'hidden', 
                                  whiteSpace: 'nowrap',
                                  textAlign: 'left'
                                }}
                                title={item.title}
                              >
                                {item.title}
                              </span>
                            </div>
                            
                            {/* Quantity */}
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.15rem', flexShrink: 0, marginLeft: '0.5rem' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: isNegative ? 'var(--danger)' : 'var(--text-primary)' }}>
                                {qtyNum}
                              </span>
                              <span style={{ fontSize: '0.58rem', color: 'var(--text-tertiary)' }}>개</span>
                            </div>
                          </div>

                          {/* Subtitle row: Index & Code Badge */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.62rem', color: 'var(--text-tertiary)', paddingLeft: '1.95rem' }}>
                            <span style={{ fontFamily: 'monospace' }}>#{String(idx + 1).padStart(2, '0')}</span>
                            {item.attrs.code && (
                              <span className="badge" style={{ fontSize: '0.52rem', padding: '0.01rem 0.25rem', borderRadius: '3px' }}>
                                Code: {item.attrs.code}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

          </div>
        </div>

      {/* Fixed-position category tooltip — escapes overflow/stacking-context clipping */}
      {categoryTooltip && categoryTooltip.visible && (
        <div
          style={{
            position: 'fixed',
            left: categoryTooltip.x,
            top: categoryTooltip.y,
            transform: 'translate(-50%, -100%)',
            background: 'var(--input-bg)',
            border: '1px solid var(--panel-border)',
            boxShadow: '0 10px 30px var(--shadow-color)',
            borderRadius: '8px',
            padding: '0.6rem 0.8rem',
            zIndex: 9999,
            width: 'max-content',
            maxWidth: '250px',
            color: 'var(--text-primary)',
            textAlign: 'left',
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontWeight: 800, fontSize: '0.75rem', marginBottom: '0.35rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.2rem', color: categoryTooltip.color, display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
            <span>{categoryTooltip.cat}</span>
            <span>{categoryTooltip.cnt}건{categoryTooltip.pct !== undefined ? ` (${categoryTooltip.pct}%)` : ''}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {categoryTooltip.titles.map((title, i) => (
              <div key={i} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                • {title}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
