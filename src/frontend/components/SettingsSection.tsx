"use client";

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Download, Upload, AlertTriangle, Trash2, RotateCcw, X, RefreshCw } from 'lucide-react';
import { useApp } from '@/frontend/context/AppContext';
import { ACCENT_COLORS, getRecords, loadActivities, loadSettings, saveRecords, persistActivities, persistSettings, clearAllData } from '@/database';
import { AnimatePresence, motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { createPortal } from 'react-dom';

interface CustomSelectCompactProps {
  value: string | number;
  options: { value: string | number; label: string }[];
  onChange: (val: any) => void;
}

/**
 * 설정 화면 전용 컴팩트 셀렉트 박스.
 * 드롭다운을 createPortal로 document.body에 렌더링하여 부모의 overflow 클리핑을 회피한다.
 * 스크롤/리사이즈 시 자동으로 닫혀 위치 어긋남을 방지한다.
 * @param value 현재 선택된 값
 * @param options 선택 가능한 옵션 목록 ({ value, label })
 * @param onChange 옵션 선택 시 호출되는 콜백
 */
function CustomSelectCompact({ value, options, onChange }: CustomSelectCompactProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (
        containerRef.current && 
        !containerRef.current.contains(target) &&
        !target.closest('.custom-select-portal-dropdown')
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleScrollResize = () => {
      setIsOpen(false);
    };
    window.addEventListener('scroll', handleScrollResize, true);
    window.addEventListener('resize', handleScrollResize);
    return () => {
      window.removeEventListener('scroll', handleScrollResize, true);
      window.removeEventListener('resize', handleScrollResize);
    };
  }, [isOpen]);

  const selectedOpt = options.find(opt => String(opt.value) === String(value));
  const displayText = selectedOpt ? selectedOpt.label : '선택...';

  const handleButtonClick = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const dropdownWidthPx = 7.5 * rootFontSize;
      
      setCoords({
        top: rect.bottom + window.scrollY,
        left: Math.max(8, rect.right + window.scrollX - dropdownWidthPx)
      });
    }
    setIsOpen(!isOpen);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '6.0rem' }}>
      <button
        ref={buttonRef}
        type="button"
        style={{
          width: '6.0rem',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--input-bg)',
          border: isOpen ? '1px solid var(--accent)' : '1px solid var(--panel-border)',
          borderRadius: '10px',
          padding: '0 0.5rem',
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          cursor: 'pointer',
          outline: 'none',
          boxShadow: isOpen ? '0 0 0 2px var(--accent-glow)' : 'none',
          transition: 'all 0.15s ease',
          textAlign: 'left'
        }}
        onClick={handleButtonClick}
      >
        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', textAlign: 'left', flex: 1 }}>
          {displayText}
        </span>
        <ChevronDown 
          size={12} 
          style={{ 
            opacity: 0.6, 
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', 
            transition: 'transform 0.15s ease',
            marginLeft: '0.2rem',
            flexShrink: 0
          }} 
        />
      </button>

      {isOpen && mounted && createPortal(
        <div
          className="custom-select-portal-dropdown"
          style={{
            position: 'absolute',
            top: `${coords.top + 4}px`,
            left: `${coords.left}px`,
            width: '7.5rem',
            background: 'var(--dropdown-bg, var(--surface-elevated))',
            border: '1px solid var(--panel-border)',
            borderRadius: '10px',
            boxShadow: '0 6px 16px var(--shadow-color, rgba(0,0,0,0.15))',
            zIndex: 9999,
            maxHeight: '180px',
            overflowY: 'auto',
            padding: '0.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.1rem',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)'
          }}
        >
          {options.map(opt => {
            const isSelected = String(opt.value) === String(value);
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  padding: '0.45rem 0.6rem',
                  fontSize: '12px',
                  fontWeight: isSelected ? 700 : 500,
                  textAlign: 'left',
                  background: isSelected ? 'var(--accent-soft-bg)' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.1s ease',
                  width: '100%'
                }}
                onMouseEnter={e => {
                  if (!isSelected) e.currentTarget.style.background = 'var(--hover-bg, rgba(255,255,255,0.05))';
                }}
                onMouseLeave={e => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent';
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

/**
 * 환경설정 화면.
 * 사용 가이드, AI 연동, 디스플레이/콘텐츠/알림 설정, 데이터 관리(백업·CSV·휴지통·초기화)를 제공한다.
 * 설정 변경은 updateSingleSetting을 통해 즉시 반영·영속화된다.
 */
type VersionLog = { version: string; date: string; latest?: boolean; items: { b: string; t: string }[] };

/** 설정 > 업데이트 정보에 표시할 버전별 변경 로그 (최신순). UPDATES_PER_PAGE개씩 페이지네이션한다. */
const UPDATES_PER_PAGE = 2;
const VERSION_LOGS: VersionLog[] = [
  { version: "v0.9.4", date: "2026-06-09", latest: true, items: [
    { b: "재고 상단 버튼 정리(더보기 메뉴)", t: ": 재고 화면 상단에 버튼이 너무 많아 제목이 두 줄로 깨지고 누르기 힘들던 것을, '＋등록' 버튼과 '⋯ 더보기' 메뉴 두 개로 정리했습니다. 일괄등록·입출고 로그·정렬·합치기·기준 정보·Excel·PDF는 더보기 메뉴에 모았습니다." },
  ] },
  { version: "v0.9.3", date: "2026-06-09", items: [
    { b: "입출고 로그(통합) 추가", t: ": 재고 탭의 '로그' 버튼으로 전체 입·출고 기록을 시간순으로 한 곳에서 봅니다. 각 기록의 품목코드·품목명·수량·직후 잔량·담당자·고객사·위치·시각을 보여주고, CSV로 내보낼 수 있습니다." },
  ] },
  { version: "v0.9.2", date: "2026-06-09", items: [
    { b: "재고 카드 입고/출고 → 재고 상태로 변경", t: ": 합산 재고에서 입고/출고 뱃지가 마지막 이동에 따라 뒤집혀 헷갈리던 것을, 현재 수량 기준 '보유/소진/부족' 상태로 바꿨습니다. 개별 입고·출고는 '입출고 이력'에서 건별로 확인합니다. 현황 탭도 '총 재고/보유 중/소진·부족'으로 정리." },
  ] },
  { version: "v0.9.1", date: "2026-06-09", items: [
    { b: "Overview 메모 마크다운 표시 수정", t: ": 전체(Overview) 화면의 메모 미리보기에서 마크다운 기호(#, *, | 등)가 그대로 보이던 것을 깔끔한 평문으로 정리했습니다." },
    { b: "카드 수정·복제·삭제 버튼 겹침 수정", t: ": 평소엔 숨겨두고 카드에 마우스를 올릴 때만 떠 있는 칩 형태로 표시해, 내용과 겹치지 않습니다." },
    { b: "재고 중복 합치기 추가", t: ": 같은 품목코드+품목명으로 따로 쌓인 입·출고 레코드를 '합치기' 버튼으로 하나로 합산할 수 있습니다(이전 데이터 정리용). 신규 입·출고는 자동으로 합산됩니다." },
  ] },
  { version: "v0.9.0", date: "2026-06-09", items: [
    { b: "검색창 아이콘 겹침·호버 수정", t: ": 품목코드·품목명·고객사 검색창에서 돋보기 아이콘이 글자와 겹치던 문제를 없애고(아이콘 제거로 깔끔하게), 드롭다운 항목에 마우스를 올리면 강조 표시되도록 했습니다." },
  ] },
  { version: "v0.8.9", date: "2026-06-09", items: [
    { b: "품목코드·품목명 검색창 UI 정돈", t: ": 검색 목록이 펼쳐질 때 아래 입력칸들이 밀려 어색하게 움직이던 문제를 고쳤습니다. 이제 목록이 입력칸 위에 떠서(overlay) 표시돼 화면이 흔들리지 않습니다." },
  ] },
  { version: "v0.8.8", date: "2026-06-09", items: [
    { b: "정렬(오름·내림차순) 추가", t: ": 고객사는 가나다·ABC 오름/내림차순으로 정렬되고(일정 카테고리 설정에서 방향 토글), 메모는 작성일 오름/내림차순, 재고는 수동(드래그)·품목코드 오름/내림차순으로 각 화면 상단 버튼에서 바꿀 수 있습니다." },
  ] },
  { version: "v0.8.7", date: "2026-06-09", items: [
    { b: "입출고 합산 기준 수정", t: ": 출고가 같은 품목코드+품목명의 입고 수량에서 차감되도록 고쳤습니다. 이전엔 품목명만으로 합산해 코드가 같아도 따로 잡히던 문제를 해결했습니다. (이후 등록되는 입·출고부터 적용)" },
  ] },
  { version: "v0.8.6", date: "2026-06-08", items: [
    { b: "품목코드별 품목명·카테고리 재사용", t: ": 품목코드를 고르면 그 코드로 등록했던 품목명들이 목록으로 떠서 여러 개 중 골라 쓸 수 있고, 카테고리는 저장된 값으로 자동 선택됩니다." },
  ] },
  { version: "v0.8.5", date: "2026-06-08", items: [
    { b: "품목코드 재사용(자동완성)", t: ": 재고 등록 시 품목코드 칸이 검색창으로 바뀌어, 기존에 입력했던 품목코드를 검색·선택해 재사용할 수 있습니다." },
  ] },
  { version: "v0.8.4", date: "2026-06-08", items: [
    { b: "메모 작성 날짜 표시", t: ": 메모 카드 우측에 작성 날짜(yy.MM.dd)를 표시합니다." },
    { b: "상단 브랜드 텍스트 제거", t: ": 헤더의 'Zero-Friction' 글자를 없애 화면을 더 깔끔하게 정리했습니다." },
  ] },
  { version: "v0.8.3", date: "2026-06-08", items: [
    { b: "고객사 선택을 검색창(접힘) 방식으로", t: ": 일정·재고·메모의 고객사 입력이 기본은 깔끔한 검색창으로 접혀 있고, 클릭하면 아래로 목록이 펼쳐집니다. 검색해서 고르거나 직접 입력할 수 있습니다." },
  ] },
  { version: "v0.8.2", date: "2026-06-08", items: [
    { b: "고객사 목록을 리스트형으로 변경", t: ": 흩어진 태그(뱃지) 대신 깔끔한 세로 리스트로 표시합니다. 설정의 고객사 관리도 번호가 매겨진 목록으로 정리했습니다." },
  ] },
  { version: "v0.8.1", date: "2026-06-08", items: [
    { b: "재고 그룹 접기/펴기", t: ": 같은 품목코드 그룹 헤더를 누르면 사이즈별 항목들을 접거나 펼칠 수 있습니다. 품목이 많을 때 큰 틀만 보고 필요한 그룹만 펼쳐 볼 수 있습니다." },
  ] },
  { version: "v0.8.0", date: "2026-06-08", items: [
    { b: "재고 품목코드 필수화", t: ": 재고 등록 시 필수 항목을 품목명 → 품목코드로 변경했습니다. 품목명은 선택이며, 비워 두면 품목코드가 표시명으로 쓰입니다." },
    { b: "총 재고 / 입고 / 출고 현황 분리", t: ": 재고 화면 상단에 '총 재고 현황·입고 현황·출고 현황' 세그먼트를 추가해 구분(flow)별로 건수와 함께 볼 수 있습니다." },
    { b: "그룹 안 사이즈별 순서도 드래그", t: ": 같은 품목코드 그룹 안의 개별 항목(사이즈별)도 각 행의 ☰ 핸들로 끌어 순서를 바꿀 수 있습니다." },
    { b: "동기화 버튼을 설정으로 이동", t: ": 상단 헤더가 복잡해 데이터 동기화 버튼을 설정 화면으로 옮겼습니다." },
    { b: "고객사 입력 안내문구 제거", t: ": 고객사 입력칸의 플레이스홀더 문구를 없앴습니다." },
  ] },
  { version: "v0.7.9", date: "2026-06-08", items: [
    { b: "재고 순서 직접 변경(드래그)", t: ": 재고 카드 왼쪽의 ☰ 핸들을 잡고 위/아래로 끌어 원하는 순서로 재배치할 수 있습니다. 바뀐 순서는 저장되어 다음에도 유지됩니다." },
  ] },
  { version: "v0.7.8", date: "2026-06-08", items: [
    { b: "재고 입출고 이력(트랜잭션) 기록", t: ": 재고가 입고/출고될 때마다 이동 수량·직후 잔량·담당자·고객사·시각을 이력으로 남깁니다. 재고 항목 수정 화면에서 '입출고 이력'을 펼쳐 확인할 수 있습니다. (기존 데이터는 그대로 두고 이후 이동부터 기록되는 안전한 방식)" },
  ] },
  { version: "v0.7.7", date: "2026-06-08", items: [
    { b: "일정·재고·메모 통합 검색 추가", t: ": 상단 헤더의 돋보기 버튼으로 검색을 엽니다. 키워드를 입력하면 제목·내용·코드·고객사·담당자·보관위치·시리얼·날짜까지 폭넓게 매칭되고, 전체/일정/재고/메모 탭으로 종류별 필터와 실시간 건수를 볼 수 있습니다. (여러 단어는 모두 포함되는 AND 검색)" },
    { b: "데스크톱 앱 보안 강화", t: ": Electron 창을 contextIsolation·sandbox 기반으로 전환하고 IPC를 preload 화이트리스트로 제한해, 원격 콘텐츠가 OS 권한에 접근하지 못하도록 했습니다." },
  ] },
  { version: "v0.7.6", date: "2026-06-08", items: [
    { b: "고객사 등록 위치를 일정 설정으로 이동", t: ": 고객사 목록을 등록·삭제하는 '고객사 관리'를 재고 '기준 정보 설정'에서 일정 탭의 '일정 카테고리 설정' 모달로 옮겼습니다. 고객사를 주로 일정에서 쓰는 흐름에 맞췄습니다. (등록된 목록은 일정·재고·메모 어디서나 그대로 공유됩니다)" },
  ] },
  { version: "v0.7.5", date: "2026-06-08", items: [
    { b: "위험 재고 기준 음수로 통일", t: ": 대시보드 '재고 건전성' 타일과 브리핑이 안전재고(5개 미만)·품절(0개) 기준을 쓰던 것을, 위험 재고 = 수량이 0개 밑(음수)으로 떨어진 품목으로 통일했습니다. 카드 뱃지와 동일한 기준입니다." },
  ] },
  { version: "v0.7.4", date: "2026-06-08", items: [
    { b: "업데이트가 안 되던 문제 수정 (캐시버스팅)", t: ": 업데이트 버튼이 캐시된 옛 화면을 다시 불러오던 문제를 수정했습니다. 이제 새로고침 시 쿼리스트링을 붙여 항상 최신 버전을 강제로 받아옵니다. 데스크톱 앱은 Cmd/Ctrl+R로도 최신화되며, 앱 시작 시 캐시를 비웁니다." },
    { b: "고객사 입력칸 항상 표시", t: ": 등록된 고객사가 없어도 일정·재고·메모에 고객사 입력칸이 항상 보이도록 변경했습니다. 직접 입력하거나, 설정 > 재고 마스터 설정에서 등록하면 배지로 빠르게 선택할 수 있습니다." },
  ] },
  { version: "v0.7.3", date: "2026-06-08", items: [
    { b: "다크모드 메모 모달 가독성 수정", t: ": 메모를 열었을 때 모달 배경이 반투명 틴트뿐이라 뒤 화면이 비쳐 글자가 안 보이던 문제를 수정했습니다. 이제 불투명 배경 위에 색상 틴트가 입혀져 또렷하게 보입니다." },
  ] },
  { version: "v0.7.2", date: "2026-06-08", items: [
    { b: "재고·메모에도 고객사 연동", t: ": 일정뿐 아니라 재고·메모 등록/수정 시에도 등록된 고객사를 선택하거나 직접 입력할 수 있습니다. 지정한 고객사는 재고 카드·메모 카드에 배지로 표시됩니다." },
  ] },
  { version: "v0.7.1", date: "2026-06-08", items: [
    { b: "메인 화면 재고 그룹화 적용", t: ": 재고 그룹화·위험 재고 표시가 메인 재고 화면에도 실제로 반영되도록 수정했습니다(이전엔 별도 화면에만 적용되어 보이지 않았습니다)." },
    { b: "다크모드 메모 가독성 개선", t: ": 다크모드에서 본문·보조 텍스트 회색이 너무 어두워 잘 안 보이던 문제를 밝은 톤으로 조정했습니다." },
  ] },
  { version: "v0.7.0", date: "2026-06-08", items: [
    { b: "재고현황 품목코드별 그룹화 및 사이즈 분류", t: ": 동일한 품목코드를 가진 항목들이 하나의 그룹 카드로 묶이며, 그룹 내에서 사이즈·변형별로 나열됩니다. 그룹 헤더에 코드 배지와 종류 수가 표시됩니다." },
    { b: "위험 재고 기준 명확화 (qty < 0)", t: ": 수량이 0개 미만으로 떨어진 항목에 위험 재고 뱃지와 경고 아이콘이 표시됩니다. 그룹 내 위험 항목이 있으면 그룹 헤더에도 경고가 함께 표시됩니다." },
    { b: "메모 순서 고정", t: ": 메모를 수정해도 목록 순서가 바뀌지 않습니다. 생성 시각 기준으로 정렬되어 수정 빈도와 무관하게 위치가 안정적으로 유지됩니다." },
    { b: "고객사 관리 기능 추가", t: ": 설정 > 재고 마스터 설정에 고객사 관리 섹션이 추가되었습니다. 고객사를 추가·삭제하여 목록을 저장할 수 있습니다." },
    { b: "일정 고객사 연동", t: ": 일정 등록·수정 시 등록된 고객사를 선택하거나 직접 입력할 수 있습니다. 지정한 고객사는 일정 카드에 배지로 표시됩니다." },
    { b: "헤더 수동 동기화 버튼 추가", t: ": 상단 헤더에 새로고침 버튼을 추가했습니다. 클릭하면 서버에서 최신 데이터를 즉시 다시 불러옵니다." },
    { b: "할 일 알림 기본값 정각 보장", t: ": 새 일정 생성 시 알림 기본값이 항상 정각(0분)으로 적용됩니다." },
  ] },
  { version: "v0.6.2", date: "2026-05-29", items: [
    { b: "일정·재고·메모 복제(Duplicate) 기능 추가", t: ": 각 항목 카드 호버 시 나타나는 액션 버튼에 '복제' 버튼을 추가했습니다. 누르면 동일한 내용의 항목이 '(복사본)' 접미사와 함께 즉시 생성됩니다." },
    { b: "설정 내 앱 업데이트 버튼 추가", t: ": 설정 탭 하단에 '지금 업데이트' 버튼을 추가했습니다. 버튼 하나로 Vercel 서버에서 최신 버전을 즉시 불러옵니다." },
  ] },
  { version: "v0.6.1", date: "2026-05-29", items: [
    { b: "OS 배너 알림 지원 (Android/PWA)", t: ": 앱 실행 시 알림 권한을 요청하고, 일정 알림 발생 시 인앱 카드뿐 아니라 기기 OS 배너 알림도 함께 표시하도록 개선했습니다." },
    { b: "헤더 앱 업데이트 버튼 추가", t: ": 상단 헤더에 새로고침 버튼을 추가하여 언제든지 최신 버전으로 즉시 업데이트할 수 있도록 했습니다." },
    { b: "컴퓨터·폰 앱 데이터 실시간 동기화", t: ": Electron 데스크톱 앱이 로컬 서버 대신 Vercel 서버(Neon DB)를 바라보도록 변경하여, 폰 앱과 컴퓨터 앱 간 데이터가 자동으로 동기화됩니다." },
  ] },
  { version: "v0.6.0", date: "2026-05-29", items: [
    { b: "Vercel 클라우드 배포 및 Neon PostgreSQL 연결", t: ": 앱을 Vercel에 배포하고 Neon 클라우드 DB를 연결하여 어디서든 접속 가능한 웹 서비스로 전환했습니다." },
    { b: "Android APK 빌드 (Capacitor)", t: ": Capacitor를 활용해 Android 네이티브 앱(APK)을 빌드했습니다. 폰에 설치하면 일반 앱처럼 사용할 수 있습니다." },
    { b: "카테고리 비율 툴팁 클리핑 버그 수정", t: ": 스크롤 시 카테고리 비율 호버 툴팁이 가려지는 문제를 position: fixed 방식으로 전환하여 완전히 해결했습니다." },
    { b: "인사이트 타일 레이블 줄바꿈 수정", t: ": '업무 진행 및 달성', '재고 건전성' 레이블이 타일 폭에 따라 두 줄로 깨지던 문제를 수정했습니다." },
  ] },
  { version: "v0.5.10", date: "2026-05-22", items: [
    { b: "시리얼 번호 파싱 분류 고도화 및 중복 병합 방지", t: ": 기기 일련번호(예: CLBX-5A-15689)가 입력될 때 품목코드와 시리얼을 정확히 분리하고, 기기 상태 정보가 품목명으로 혼입되는 오류를 해결했습니다. 고유 시리얼을 가진 품목은 중복 합산되지 않고 개별 등록되며, 일괄 편집 그리드에 '시리얼' 필드를 추가했습니다." },
    { b: "삭제 처리 시 페이지 바운더리 자동 보정(Pagination Clamp)", t: ": 리스트에서 항목을 연속으로 바로 삭제하여 현재 페이지의 마지막 항목이 사라지는 경우, 유효한 마지막 페이지로 자동 이동하도록 반응형 페이징 보정 훅을 추가하여 빈 화면 노출 현상을 완전히 해결했습니다." }
  ] },
  { version: "v0.5.9", date: "2026-05-22", items: [
    { b: "데이터베이스 중복 ID 자동 복구 및 신규 생성 고유성 확보", t: ": 다량의 데이터 일괄 등록 시 동일 밀초에 등록되어 ID가 중복 생성되는 문제를 해결하기 위해, 신규 등록 건마다 무작위 7자리 고유 접미사를 부여했습니다. 추가로, 기존 로컬스토리지 내 중복 ID가 존재할 경우 로드 시점에 이를 탐지하여 고유 ID로 강제 치환하는 자가 복구 루틴을 getRecords에 내장했습니다." },
    { b: "리스트 내 카드 호버 액션 이벤트 버블링 차단 및 클릭 영역 개선", t: ": 리스트에서 직접 수정/삭제 단추를 누를 때, 간격을 클릭하거나 단추 외곽을 터치해도 카드 배경의 onClick이 작동하여 편집 상세 모달이 뜨는 현상을 방지하기 위해 호버 액션 컨테이너에 onClick={e => e.stopPropagation()}을 매핑하고, globals.css에서 z-index: 10을 설정하여 우선순위를 보장했습니다." }
  ] },
  { version: "v0.5.8", date: "2026-05-22", items: [
    { b: "연속 삭제 조작성 및 토스트 차단 문제 완전 해결", t: ": 토스트 알림 컴포넌트에 인라인 스타일로 pointer-events: none을 강제 매핑하여 브라우저 캐시 여부와 관계없이 마우스 클릭 차단 가능성을 완전 봉쇄했습니다. 또한, 카드 삭제/수정 버튼의 기본 투명도를 0.35로 상시 표시하고 상호작용 가능하도록 설계하여, 항목 삭제 시 마우스 이동 및 호버 딜레이 없이 초고속으로 연속 삭제 처리가 가능하도록 조율했습니다." }
  ] },
  { version: "v0.5.7", date: "2026-05-22", items: [
    { b: "토스트 알림 클릭 패스스루(Click-Through) 적용", t: ": 일정/재고/메모 삭제 완료 등 안내 토스트 메시지 노출 중에도 뒤편의 버튼이나 목록 영역을 차단 없이 바로 클릭(마우스 이벤트 통과)할 수 있도록 pointer-events 설정을 조율하여 연속 삭제 등 빠른 연속 작업성을 극대화했습니다." },
    { b: "재고 일괄 등록 Markdown 표(Table) 파싱 지원", t: ": 스프레드시트 외에도 챗봇이나 문서에서 복사한 마크다운 형태의 표 데이터를 일괄 등록 입력창에 붙여넣으면, 컬럼 구분 기호(|)와 테이블 구조선 및 헤더를 자동으로 인식하여 필드를 파싱하고 정렬하도록 기능을 확장했습니다." },
    { b: "동일 품목 그룹화 및 수량 누적 병합(Merge) 탑재", t: ": 일괄 등록 시 동일한 품목명을 가진 행들이 존재할 경우, 이를 자동으로 하나로 합산(입고/출고 방향에 따라 수량을 가감 계산)하고 메모들을 세미콜론(;)으로 연결하여 최종 1개의 행으로 단일 정규화하여 생성하도록 개선했습니다." }
  ] },
  { version: "v0.5.6", date: "2026-05-22", items: [
    { b: "재고 일괄 등록 및 조정 기능 추가", t: ": Excel/스프레드시트에서 복사한 데이터를 붙여넣거나 직접 행을 추가하여 여러 개의 재고를 한 번에 등록 및 처리할 수 있는 일괄 등록 모달을 제공합니다." },
    { b: "통합 변동 사항 메모 생성 및 상호 연동", t: ": 일괄 처리 시 상세 조정 목록에 대한 마크다운 표가 담긴 통합 메모를 자동 생성하고, 재고와 메모를 linkedIds 기반으로 상호 연동하여 언제든 관계성을 확인할 수 있도록 구현했습니다." },
    { b: "목록 뷰 연동 배지 시각화", t: ": 재고 목록 내 개별 카드에서 연동된 메모의 제목을 해시태그 형태의 배지(#메모제목)로 직관적으로 표시하도록 디자인했습니다." }
  ] },
  { version: "v0.5.5", date: "2026-05-22", items: [
    { b: "일정 카테고리 색상 선택 UI 리디자인 및 프리미엄 도트 버튼 적용", t: ": 카테고리 생성 시 색상 선택 단추를 26px의 프리미엄 도트 형태로 리디자인하고, 선택 시 동일 톤의 아우라(Halo Ring)와 명도 대비가 고려된 SVG 체크마크로 시인성 및 클릭 조작 피드백을 강화했습니다." }
  ] },
  { version: "v0.5.4", date: "2026-05-22", items: [
    { b: "일정 카테고리별 커스텀 색상 지정 기능 추가", t: ": 일정 카테고리 추가 시, 9가지 기본 테마 색상 프리셋뿐만 아니라 색상 팔레트(Color Picker)를 통해 자유롭게 원하는 색상을 생성하고 매핑할 수 있는 기능을 추가했습니다." },
    { b: "개별 카테고리 색상 직접 변경 및 관리 UI 탑재", t: ": 설정의 일정 카테고리 목록을 직관적인 리스트 형태로 시각화하고, 각 카테고리 옆에 개별 9가지 프리셋 버튼 및 커스텀 컬러 피커를 제공하여 기존 카테고리의 색상도 즉시 개별 편집할 수 있도록 개선했습니다." },
    { b: "카테고리 색상 동적 렌더링 및 UI 통일", t: ": 생성한 커스텀 카테고리 색상이 메인 대시보드의 일정 카테고리 구성 비율 바(Chart), 캘린더 날짜별 일정 점(Dot), 일정 관리 리스트 및 카테고리 필터링 뱃지/버튼에 동적으로 반영되도록 개선했습니다." }
  ] },
  { version: "v0.5.3", date: "2026-05-22", items: [
    { b: "일정 등록 시간 입력 UI 통일 및 수평 정렬", t: ": 시간(Time) 선택기의 트리거 인풋을 날짜 선택기(DatePicker)와 동일하게 일관된 버튼 형태로 변경하여 디자인 일인화를 이루었습니다. 또한 날짜/시간 라벨의 높이를 22px로 통일하여 두 입력 박스의 시작 수평 높이를 정밀하게 정렬했습니다." },
    { b: "상단 바 퀵 액션 단축 패널 라이트 모드 전환 및 화이트 박스 버튼 통일", t: ": 자연어 입력창 하단 단축 패널의 테마를 깔끔한 라이트 모드(반투명 연회색)로 전면 변경하고, 하단의 모든 기능 버튼들을 선명한 테두리를 가진 단정한 화이트 박스 스타일로 통일하여 시인성과 조작성을 대폭 강화했습니다." }
  ] },
  { version: "v0.5.2", date: "2026-05-22", items: [
    { b: "macOS 상단 바 트레이 드롭다운 패널 연동", t: ": 트레이 아이콘 클릭 또는 '열기' 시 메인 윈도우가 상단 바 바로 아래에 드롭다운 형태로 자동 위치하도록 개선했습니다." },
    { b: "상단 바 퀵 입력 포커스(Auto-Focus)", t: ": 트레이 아이콘 클릭 시 자연어 분석 입력창(.command-input)에 자동으로 포커스 및 텍스트 전체 선택이 되어 바로 타이핑할 수 있습니다." },
    { b: "트레이 아이콘 시인성 및 브랜드 디자인 개선", t: ": Zero-Friction 브랜드 아이덴티티를 살린 '0 안의 체크마크' 스타일의 굵고 선명한 아이콘 디자인(trayTemplate.png)으로 전면 교체했습니다." },
    { b: "시간 입력 UI 깨짐 및 레이아웃 교정", t: ": 일정 등록 시 시간 입력 인풋이 찌그러지거나 잘리던 레이아웃 버그를 수정하고, '하루 종일' 토글과 38px 높이를 완벽하게 조화시켰습니다." },
    { b: "백그라운드 실행 지원 및 안전한 앱 종료", t: ": 창을 닫아도 백그라운드에 유지되며, 상단 바 메뉴의 '종료' 또는 Cmd+Q를 통해 완전히 안전하게 종료됩니다." }
  ] },
  { version: "v0.5.1", date: "2026-05-22", items: [
    { b: "알림 제시각 표시 보장", t: ": 알림 타입·권한 상태와 무관하게 일정 시각이 되면 인앱 글래스모피즘 알림 카드가 항상 표시되도록 발송 로직을 통합했습니다." },
    { b: "알림 카드 확인 버튼 추가", t: ": 알림 카드에 '완료'와 '스누즈' 버튼 외에 단순히 알림을 인지하고 창을 닫는 '확인' 버튼을 추가하여 즉시 완료 처리를 원치 않는 경우를 배려했습니다." },
    { b: "시간 설정 직접 입력 지원", t: ": 일정 등록 및 수정 시 시간 선택기를 직접 클릭해 'HH:MM' 형태의 텍스트로 자유롭게 타이핑할 수 있게 하였으며, 다양한 간편 형식 자동 완성 및 포커스 아웃/엔터 입력 시 유효성 검증을 지원합니다." },
    { b: "테스트 알림 미리보기 수정", t: ": '데스크톱 알림창' 설정에서 '테스트 실행' 시 실제와 동일한 인앱 알림 카드가 즉시 표시되도록 변경했습니다." },
    { b: "중복 OS 다이얼로그 제거", t: ": '데스크톱 알림창' 타입에서 별도의 osascript 경고창을 띄우지 않고 인앱 카드로 일원화했습니다." },
  ] },
  { version: "v0.5.0", date: "2026-05-22", items: [
    { b: "커스텀 인앱 알람 팝업", t: ": 일정 알림 시 화면 상단 중앙에 글래스모피즘 알림 카드를 슬라이드 애니메이션으로 표시하고, '완료' 및 '10분 후 알림(스누즈)' 동작을 제공합니다." },
    { b: "Electron 알림 IPC 보강", t: ": 알람 발생 시 데스크톱 창을 자동으로 복원·포커스하도록 'focus-window' IPC 바인딩을 추가했습니다." },
    { b: "macOS 알림 안정화", t: ": osascript 호출을 문자열 보간 대신 인자(argv) 기반 실행으로 변경해 따옴표/이스케이프 오류를 방지했습니다." },
    { b: "업데이트 정보 페이지네이션", t: ": 설정의 업데이트 내역을 페이지 단위(2개씩)로 나눠 '이전/다음'으로 탐색할 수 있도록 개선했습니다." },
  ] },
  { version: "v0.4.4", date: "2026-05-22", items: [
    { b: "일정/재고/메모 데이터 엑셀 및 PDF 내보내기 지원", t: ": 각 페이지(대시보드 일정/메모/재고 목록, 캘린더 페이지, 재고 페이지) 상단에 엑셀(CSV) 및 PDF 다운로드 버튼을 추가하였으며, 개별 메모 상세 보기 모달에서도 해당 메모만 즉시 엑셀/PDF로 내보낼 수 있도록 개선했습니다." },
    { b: "Excel 한글 깨짐 방지", t: ": UTF-8 BOM을 자동으로 추가하여 다운로드한 CSV 파일을 엑셀에서 열 때 한글이 깨지지 않고 올바르게 출력되도록 구현했습니다." },
    { b: "인쇄 전용 스타일 및 마크다운 렌더링 지원", t: ": PDF 저장 또는 인쇄 시 깔끔하게 스타일링된 출력 전용 문서를 동적으로 생성하며, 메모 내 표·리스트·코드 블록 등의 마크다운 서식을 원본 레이아웃 그대로 유지하여 인쇄합니다." },
    { b: "엑셀 내보내기 버튼 표기·크기 개선", t: ": 버튼 텍스트를 'Excel'로 변경하고, 화면이 줄어들어도 버튼 크기가 변형되지 않도록 축소 방지 스타일(flexShrink)을 적용했습니다." },
    { b: "반응형 레이아웃 세부 조절 및 축소 방지", t: ": 900px, 680px, 480px 단계별로 버튼 라벨·탭 텍스트를 숨기고 아이콘만 노출하며, 주요 카드들이 찌그러지지 않도록 레이아웃 고정 스타일을 적용했습니다." },
    { b: "일정/재고 서브페이지 페이지네이션 탑재", t: ": 캘린더 당일 일정 목록 및 재고 서브페이지에 페이지네이션을 구현해 데이터가 많아도 모바일 화면을 넘치지 않게 개선했습니다." },
  ] },
  { version: "v0.4.3", date: "2026-05-22", items: [
    { b: "일정 하루 종일 옵션 지원", t: ": 일정 생성/편집 시 '하루 종일' 토글을 지원하고, 활성화 시 시간 대신 '하루 종일' 배지를 노출하며 목록 최상단에 자동 정렬합니다." },
    { b: "완료 일정 달력 표시 유지", t: ": 일정이 완료되어도 달력 셀 하단의 표시용 점들이 사라지지 않도록 보완했습니다." },
    { b: "메모 마크다운 표·코드 블록 확장", t: ": 메모 보기창에서 마크다운 테이블(정렬 지원) 및 코드 블록이 올바르게 렌더링되도록 확장했습니다." },
  ] },
  { version: "v0.4.2", date: "2026-05-22", items: [
    { b: "시간 선택기 미니멀화", t: ": 복잡한 숫자 그리드를 제거하고 상/하 화살표 스텝 방식으로 시간 선택 UI를 간소화했습니다." },
    { b: "시간 입력 이벤트 전파 방지", t: ": 시간 선택기를 클릭해도 부모 등록/수정창이 닫히지 않도록 이벤트 차단을 강화했습니다." },
    { b: "터미널 중복 기동 수정", t: ": 데스크톱 실행기 기동 시 열리던 빈 터미널 창이 노출되지 않도록 자동 실행 스크립트를 무소음 패치했습니다." },
  ] },
  { version: "v0.4.1", date: "2026-05-21", items: [
    { b: "재고 삭제 UX 개선", t: ": 재고 상세 모달·리스트 삭제 시 모달 닫힘 연동 및 클릭 버블링 문제를 수정했습니다." },
    { b: "기본 알림 시간 변경", t: ": 일정 등록 시 기본 알림을 10분 전에서 정각(0분)으로 일원화했습니다." },
  ] },
  { version: "v0.4.0", date: "2026-05-21", items: [
    { b: "메모 읽기 전용 뷰/수정 모드 분리", t: ": 메모 카드를 클릭하면 읽기 모드로 열리고, 우측 상단 '수정'으로 편집 모드로 전환합니다." },
    { b: "메모 리스트 디자인 통일", t: ": 메모 카드 높이를 150px로 통일하고 넘치는 내용을 보기 좋게 자릅니다." },
    { b: "입력 폼 컴팩트화 및 안내문구 최적화", t: "." },
  ] },
];

export default function SettingsSection() {
  const {
    theme,
    appSettings,
    handleSettingsChange,
    showToast,
    reloadRecords,
    logActivity,
    archive,
    restoreArchived,
    permanentDelete,
    emptyArchive,
    clearActivities,
    exportToCsv,
    setActiveNotification,
    manualSync,
    syncing
  } = useApp();

  const fileRef = useRef<HTMLInputElement>(null);
  // 화면 입력용 로컬 설정 사본 — 전역 appSettings와 분리해 즉시 UI 반영을 담당
  const [localSettings, setLocalSettings] = useState({ ...appSettings });
  const [isTrashModalOpen, setIsTrashModalOpen] = useState(false);
  const [trashSearchQuery, setTrashSearchQuery] = useState('');
  const [trashFilterType, setTrashFilterType] = useState<'all' | 'event' | 'asset' | 'memo'>('all');
  const [expandedTrashId, setExpandedTrashId] = useState<string | null>(null);
  const [updatePage, setUpdatePage] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);

  // Electron 창 리사이즈 비교용 — 직전 deviceSize 값을 추적
  const prevDeviceSizeRef = useRef(appSettings.deviceSize);

  // 전역 설정이 바뀌면 로컬 사본도 동기화
  useEffect(() => {
    setLocalSettings({ ...appSettings });
    prevDeviceSizeRef.current = appSettings.deviceSize;
  }, [appSettings]);

  /**
   * 단일 설정 항목을 즉시 반영·영속화한다.
   * Electron 환경에서 deviceSize가 바뀌면 네이티브 창 크기 조정 IPC를 전송한다.
   * @param newSettings 갱신된 전체 설정 객체
   */
  const updateSingleSetting = (newSettings: typeof appSettings) => {
    setLocalSettings(newSettings);
    handleSettingsChange(newSettings); // 서버(공유 DB)에 저장됨 — 모든 기기 동기화
    if (typeof window !== 'undefined') {
      // Electron에서만: deviceSize 변경 시 네이티브 프레임 리사이즈 트리거
      if ((window as any).electronAPI) {
        const size = newSettings.deviceSize || 'default';
        if (size !== prevDeviceSizeRef.current) {
          prevDeviceSizeRef.current = size;
          // Trigger electron frame size adjustments!
          (window as any).electronAPI.resizeWindow({ size });
        }
      }
    }
  };

  /**
   * 모든 로컬 데이터(레코드·활동로그·설정)를 단일 JSON 백업 파일로 내보낸다.
   */
  const handleExportData = () => {
    try {
      const backup = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        records: getRecords(),
        activities: loadActivities(),
        settings: loadSettings(),
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zero_friction_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      logActivity('UPDATE_SCHED', '데이터 백업 내보내기 완료', 'settings');
      showToast('📦 전체 데이터 백업 파일 내보내기 완료');
    } catch (e) {
      showToast('⚠️ 백업 실패');
    }
  };

  /**
   * JSON 백업 파일을 읽어 데이터를 복원한다.
   * 형식 검증(records 배열 존재 여부) 후 사용자 확인을 거쳐 localStorage를 덮어쓰고 새로고침한다.
   * @param e 파일 input change 이벤트
   */
  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const backup = JSON.parse(event.target?.result as string);
        if (!backup.records || !Array.isArray(backup.records)) {
          showToast('⚠️ 유효하지 않은 백업 파일 형식');
          return;
        }

        if (confirm('백업 파일을 복원하시겠습니까? 현재 데이터는 모두 덮어써집니다.')) {
          saveRecords(backup.records); // 서버(공유 DB)에 저장 → 모든 기기 반영
          if (backup.activities) persistActivities(backup.activities);
          if (backup.settings) persistSettings(backup.settings);

          reloadRecords();
          showToast('🎉 데이터 복원 완료! 시스템을 새로고침합니다.');
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      } catch (err) {
        showToast('⚠️ 파일 분석 실패');
      }
    };
    reader.readAsText(file);
  };

  /**
   * 전체 시스템 초기화. 되돌릴 수 없으므로 2단계 확인 후 localStorage를 비우고 새로고침한다.
   */
  const handleResetAll = () => {
    if (confirm('⚠️ [경고] 모든 데이터(일정, 재고, 메모, 설정, 활동로그)가 영구적으로 삭제됩니다. 계속하시겠습니까?')) {
      if (confirm('진짜로 초기화하시겠습니까? 이 작업은 취소할 수 없습니다.')) {
        clearAllData(); // 서버(공유 DB)의 데이터까지 초기화
        localStorage.removeItem('zero_theme');
        showToast('🔥 시스템 전체 초기화 완료');
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    }
  };

  const currentAccents = ACCENT_COLORS.map(c => theme === 'dark' ? { ...c, value: c.dark } : c);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', width: '100%', padding: '0.4rem 0.2rem 1.0rem 0.2rem' }}>

      {/* Settings Header (Apple Cupertino Style) */}
      <div className="section-header" style={{ marginBottom: '0.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="section-title">환경설정</div>
      </div>

      {/* 앱 사용 방법 (Collapsible Guide) */}
      <details className="settings-section help-section" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--surface-elevated-border)', borderRadius: '14px', padding: '0', overflow: 'hidden' }}>
        <summary style={{ listStyle: 'none', cursor: 'pointer', padding: '0.7rem 0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ fontSize: '0.95rem' }}>📖</span>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>앱 사용 방법</span>
          </div>
          <ChevronDown size={14} style={{ color: 'var(--text-tertiary)', transition: 'transform 0.2s ease' }} className="help-chevron" />
        </summary>

        <div style={{ padding: '0 0.85rem 0.85rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.7rem', borderTop: '1px solid var(--panel-border)', paddingTop: '0.75rem' }}>

          {/* 1. 자연어 입력 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', textAlign: 'left' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.3px' }}>1 · 자연어 입력</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              상단 입력창에 한국어로 자연스럽게 적으면 AI가 자동 분류·등록합니다.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.1rem' }}>
              {[
                { tag: '일정', ex: '"내일 오후 3시 디자인 리뷰 10분 전 알림"' },
                { tag: '재고 입고', ex: '"사과 12개 입고"' },
                { tag: '재고 출고', ex: '"배 5개 출고"' },
                { tag: '단순 메모', ex: '"장보기 리스트 작성하기 메모"' }
              ].map(item => (
                <div key={item.tag} style={{ display: 'flex', gap: '0.4rem', fontSize: '0.65rem' }}>
                  <span style={{ color: 'var(--accent)', fontWeight: 800, width: '50px', textAlign: 'left' }}>{item.tag}</span>
                  <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{item.ex}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 2. 키보드 단축키 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', textAlign: 'left' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.3px' }}>2 · 시스템 단축키</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              {[
                { keys: '⌘ K / Ctrl+K', desc: '글로벌 커맨드 팔레트 검색 바 실행' },
                { keys: 'ESC', desc: '검색 바 닫기 / 대시보드로 돌아가기' },
                { keys: 'Enter (입력창)', desc: '자연어 분석 등록 실행' }
              ].map(item => (
                <div key={item.keys} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem' }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{item.keys}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{item.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 3. 재고 관리 룰 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', textAlign: 'left' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.3px' }}>3 · 실시간 재고 스마트 경고</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              재고 등록 시 설정한 <span style={{ color: 'var(--danger)', fontWeight: 700 }}>적정 안전 재고량</span>보다 현재 수량이 작거나 같아지면
              대시보드와 재고 현황에 자동으로 경고 불빛이 들어옵니다.
            </div>
          </div>

          {/* 4. 데이터 휴지통 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', textAlign: 'left' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.3px' }}>4 · 2단계 안전 휴지통</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              데이터를 실수로 삭제하는 것을 방지하기 위해 모든 데이터는 1차적으로 휴지통에 보관됩니다.
              설정의 데이터 관리 탭에서 영구 삭제하거나 즉시 복구할 수 있습니다.
            </div>
          </div>

          {/* 5. 탭 & 뷰 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', textAlign: 'left' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.3px' }}>5 · 커스텀 캘린더 스타일</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              디바이스 및 취향에 따라 일요일 혹은 월요일 시작 기준을 설정할 수 있으며,
              달력의 한 셀에 최대로 보여줄 일정 개수를 자유롭게 조절할 수 있습니다.
            </div>
          </div>

          {/* 6. 데이터 백업 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', textAlign: 'left' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.3px' }}>6 · 오프라인 로컬 백업</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              데이터 관리는 100% 클라이언트 보안 쿠키 및 로컬 브라우저 저장소 기반입니다.
              주기적으로 데이터 백업 파일을 다운로드하여 영구 보존하세요.
            </div>
          </div>

        </div>
      </details>

      {/* AI API Key */}
      <details className="settings-section settings-section-details" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--surface-elevated-border)', borderRadius: '14px', padding: '0', overflow: 'hidden' }} open>
        <summary style={{ listStyle: 'none', cursor: 'pointer', padding: '0.7rem 0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>AI 연동 설정</span>
          </div>
          <ChevronDown size={14} style={{ color: 'var(--text-tertiary)', transition: 'transform 0.2s ease' }} className="settings-chevron" />
        </summary>
        <div style={{ padding: '0 0.85rem 0.85rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', borderTop: '1px solid var(--panel-border)', paddingTop: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="settings-label-compact">AI API Key</span>
            <input
              type="password"
              className="settings-select-compact"
              placeholder="API Key"
              value={localSettings.apiKey}
              onChange={e => {
                const updated = { ...localSettings, apiKey: e.target.value };
                updateSingleSetting(updated);
              }}
            />
          </div>
          <div style={{ height: '1px', background: 'var(--panel-border)', margin: '0.2rem 0' }} />
          <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.3px' }}>AI 연동 오류 코드 안내</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.62rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <div>• <strong style={{ color: 'var(--text-primary)' }}>E-100</strong>: 유효하지 않은 API Key (입력값 오타 또는 만료)</div>
              <div>• <strong style={{ color: 'var(--text-primary)' }}>E-200</strong>: API 호출 한도 초과 (무료 할당량 초과)</div>
              <div>• <strong style={{ color: 'var(--text-primary)' }}>E-300</strong>: 네트워크 통신 장애 또는 연결 오류</div>
              <div>• <strong style={{ color: 'var(--text-primary)' }}>E-900</strong>: 기타 시스템 연동 오류 (서버 일시 에러)</div>
            </div>
          </div>
        </div>
      </details>

      {/* Display Settings */}
      <details className="settings-section settings-section-details" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--surface-elevated-border)', borderRadius: '14px', padding: '0', overflow: 'hidden' }} open>
        <summary style={{ listStyle: 'none', cursor: 'pointer', padding: '0.7rem 0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>디스플레이 설정</span>
          </div>
          <ChevronDown size={14} style={{ color: 'var(--text-tertiary)', transition: 'transform 0.2s ease' }} className="settings-chevron" />
        </summary>
        <div style={{ padding: '0 0.85rem 0.85rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', borderTop: '1px solid var(--panel-border)', paddingTop: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>포인트 색상</span>
            <div className="color-chips" style={{ display: 'flex', gap: '0.5rem', padding: '0.1rem 0' }}>
              {currentAccents.map(c => {
                const isActive = localSettings.accentColor === c.value;
                return (
                  <div
                    key={c.name}
                    className={`color-chip ${isActive ? 'active' : ''}`}
                    style={{
                      background: c.value,
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      outline: 'none',
                      border: isActive ? `2px solid var(--bg-color)` : '2px solid transparent',
                      boxShadow: isActive ? `0 0 0 1.5px ${c.value}` : 'none'
                    }}
                    onClick={() => {
                      const updated = { ...localSettings, accentColor: c.value };
                      updateSingleSetting(updated);
                    }}
                  />
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0' }}>
            <span className="settings-label-compact">레이아웃 밀도</span>
            <CustomSelectCompact
              value={localSettings.density}
              options={[
                { value: 'compact', label: 'Compact' },
                { value: 'cozy', label: 'Cozy' }
              ]}
              onChange={val => updateSingleSetting({ ...localSettings, density: val })}
            />
          </div>

          <div className="flex items-center justify-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0' }}>
            <span className="settings-label-compact">글자 크기</span>
            <CustomSelectCompact
              value={localSettings.fontSize || 'medium'}
              options={[
                { value: 'small', label: '작게' },
                { value: 'medium', label: '중간' },
                { value: 'large', label: '크게' }
              ]}
              onChange={val => updateSingleSetting({ ...localSettings, fontSize: val })}
            />
          </div>

          <div className="flex items-center justify-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0' }}>
            <span className="settings-label-compact">시간 표기 방식</span>
            <CustomSelectCompact
              value={localSettings.timeFormat}
              options={[
                { value: '12h', label: '12시간' },
                { value: '24h', label: '24시간' }
              ]}
              onChange={val => updateSingleSetting({ ...localSettings, timeFormat: val })}
            />
          </div>
        </div>
      </details>

      {/* Content Settings */}
      <details className="settings-section settings-section-details" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--surface-elevated-border)', borderRadius: '14px', padding: '0', overflow: 'hidden' }} open>
        <summary style={{ listStyle: 'none', cursor: 'pointer', padding: '0.7rem 0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>콘텐츠 표시 설정</span>
          </div>
          <ChevronDown size={14} style={{ color: 'var(--text-tertiary)', transition: 'transform 0.2s ease' }} className="settings-chevron" />
        </summary>
        <div style={{ padding: '0 0.85rem 0.85rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', borderTop: '1px solid var(--panel-border)', paddingTop: '0.75rem' }}>
          <div className="flex items-center justify-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0' }}>
            <span className="settings-label-compact">달력 시작 요일</span>
            <CustomSelectCompact
              value={localSettings.weekStartsOn}
              options={[
                { value: 0, label: '일요일' },
                { value: 1, label: '월요일' }
              ]}
              onChange={val => updateSingleSetting({ ...localSettings, weekStartsOn: val })}
            />
          </div>

          <div className="flex items-center justify-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0' }}>
            <span className="settings-label-compact">일정 노출 개수</span>
            <CustomSelectCompact
              value={localSettings.maxEventsShown}
              options={[
                { value: 2, label: '2개' },
                { value: 3, label: '3개' },
                { value: 4, label: '4개' },
                { value: 5, label: '5개' }
              ]}
              onChange={val => updateSingleSetting({ ...localSettings, maxEventsShown: val })}
            />
          </div>

          <div className="flex items-center justify-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0' }}>
            <span className="settings-label-compact">재고 노출 개수</span>
            <CustomSelectCompact
              value={localSettings.maxInventoryShown}
              options={[
                { value: 3, label: '3개' },
                { value: 5, label: '5개' },
                { value: 10, label: '10개' }
              ]}
              onChange={val => updateSingleSetting({ ...localSettings, maxInventoryShown: val })}
            />
          </div>

          <div className="flex items-center justify-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0' }}>
            <span className="settings-label-compact">메모 노출 개수</span>
            <CustomSelectCompact
              value={localSettings.maxMemosShown}
              options={[
                { value: 4, label: '4개' },
                { value: 6, label: '6개' },
                { value: 8, label: '8개' }
              ]}
              onChange={val => updateSingleSetting({ ...localSettings, maxMemosShown: val })}
            />
          </div>
        </div>
      </details>

      {/* 알림 설정 (Notification Settings) */}
      <details className="settings-section settings-section-details" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--surface-elevated-border)', borderRadius: '14px', padding: '0', overflow: 'hidden' }} open>
        <summary style={{ listStyle: 'none', cursor: 'pointer', padding: '0.7rem 0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>알림 설정</span>
          </div>
          <ChevronDown size={14} style={{ color: 'var(--text-tertiary)', transition: 'transform 0.2s ease' }} className="settings-chevron" />
        </summary>
        <div style={{ padding: '0 0.85rem 0.85rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', borderTop: '1px solid var(--panel-border)', paddingTop: '0.75rem' }}>
          {/* 시스템 알림 권한 */}
          <div className="flex items-center justify-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0' }}>
            <span className="settings-label-compact">시스템 알림 권한</span>
            <button
              type="button"
              className="settings-btn-compact"
              onClick={async () => {
                const currentVal = localSettings.enableNotifications !== false;
                if (!currentVal) {
                  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
                    await Notification.requestPermission();
                  }
                }
                updateSingleSetting({ ...localSettings, enableNotifications: !currentVal });
              }}
              style={{ width: '6.0rem' }}
            >
              {(localSettings.enableNotifications !== false) ? '허용됨' : '거부됨'}
            </button>
          </div>

          {/* 기본 알림 시간 */}
          <div className="flex items-center justify-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0' }}>
            <span className="settings-label-compact">기본 알림 시간</span>
            <CustomSelectCompact
              value={localSettings.defaultNotifyOffset ?? 0}
              options={[
                { value: -1, label: '알림 없음' },
                { value: 0, label: '정각' },
                { value: 10, label: '10분 전' },
                { value: 30, label: '30분 전' },
                { value: 60, label: '1시간 전' },
                { value: 1440, label: '1일 전' }
              ]}
              onChange={val => updateSingleSetting({ ...localSettings, defaultNotifyOffset: val })}
            />
          </div>

          {/* 알림 전송 방식 */}
          <div className="flex items-center justify-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0' }}>
            <span className="settings-label-compact">알림 전송 방식</span>
            <CustomSelectCompact
              value={localSettings.notificationType ?? 'system'}
              options={[
                { value: 'system', label: '데스크톱 알림창' },
                { value: 'browser', label: 'OS 배너 알림' }
              ]}
              onChange={val => updateSingleSetting({ ...localSettings, notificationType: val })}
            />
          </div>

          {/* 알림 테스트 */}
          <div className="flex items-center justify-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0' }}>
            <span className="settings-label-compact">알림 기능 테스트</span>
            <button
              type="button"
              className="settings-btn-compact"
              onClick={async () => {
                if (localSettings.enableNotifications === false) {
                  showToast('알림 서비스가 비활성화 상태입니다.');
                  return;
                }

                try {
                  const now = new Date();
                  const isBrowser = localSettings.notificationType === 'browser';

                  if (isBrowser) {
                    // OS 배너 알림 테스트 (기존 경로 유지)
                    const title = 'Zero-Friction 알림 테스트';
                    const body = 'OS 표준 슬라이드 배너 알림이 정상 작동 중입니다!';
                    if (typeof window !== 'undefined' && (window as any).electronAPI) {
                      (window as any).electronAPI.sendNotification({ title, body });
                      showToast('테스트 배너 알림을 발송했습니다.');
                    } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                      new Notification(title, { body });
                      showToast('테스트 배너 알림을 발송했습니다.');
                    } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'denied') {
                      showToast('시스템 알림 권한이 거부되어 알림을 발송할 수 없습니다.');
                    } else {
                      const res = await fetch('/api/notify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title, body, type: 'browser' })
                      });
                      showToast(res.ok ? '테스트 배너 알림이 발송되었습니다.' : '알림 발송에 실패했습니다.');
                    }
                  } else {
                    // 'system'(데스크톱 알림창) = 새 인앱 글래스모피즘 알림 카드를 즉시 미리보기
                    setActiveNotification({
                      id: '__test__',
                      title: 'Zero-Friction 알림 테스트',
                      body: '인앱 알림 카드가 정상적으로 표시됩니다!',
                      time: format(now, 'HH:mm'),
                      date: format(now, 'yyyy-MM-dd')
                    });
                    showToast('테스트 알림 카드를 표시했습니다.');
                  }
                } catch (e) {
                  showToast('테스트 알림 오류 발생');
                }
              }}
              style={{ width: '6.0rem' }}
            >
              테스트 실행
            </button>
          </div>
        </div>
      </details>

      {/* 데이터 관리 (Consolidated Data Management) */}
      <details className="settings-section settings-section-details" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--surface-elevated-border)', borderRadius: '14px', padding: '0', overflow: 'hidden' }} open>
        <summary style={{ listStyle: 'none', cursor: 'pointer', padding: '0.7rem 0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>데이터 관리</span>
          </div>
          <ChevronDown size={14} style={{ color: 'var(--text-tertiary)', transition: 'transform 0.2s ease' }} className="settings-chevron" />
        </summary>
        <div style={{ padding: '0 0.85rem 0.85rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', borderTop: '1px solid var(--panel-border)', paddingTop: '0.75rem' }}>
          {/* Row 1 (Safe & Export): 데이터 내보내기 & 데이터 불러오기 */}
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
            <button
              className="settings-btn-compact"
              onClick={handleExportData}
              style={{ flex: 1, gap: '0.25rem' }}
            >
              <Download size={12} /> 데이터 내보내기 (.json)
            </button>

            <button
              className="settings-btn-compact"
              onClick={() => fileRef.current?.click()}
              style={{ flex: 1, gap: '0.25rem' }}
            >
              <Upload size={12} /> 데이터 불러오기
            </button>
            <input
              type="file"
              ref={fileRef}
              style={{ display: 'none' }}
              accept=".json"
              onChange={handleImportData}
            />
          </div>

          {/* Row 1.5 (CSV Exports): 일정 CSV & 재고 CSV 내보내기 */}
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
            <button
              className="settings-btn-compact"
              onClick={() => exportToCsv('event')}
              style={{ flex: 1, gap: '0.25rem' }}
            >
              <Download size={12} /> 일정 백업 (.csv)
            </button>
            <button
              className="settings-btn-compact"
              onClick={() => exportToCsv('asset')}
              style={{ flex: 1, gap: '0.25rem' }}
            >
              <Download size={12} /> 재고 백업 (.csv)
            </button>
          </div>

          {/* Row 2 (Trash & Logs): 휴지통 & 활동 로그 초기화 */}
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
            <button
              className="settings-btn-compact accent-btn"
              onClick={() => setIsTrashModalOpen(true)}
              style={{ flex: 1 }}
            >
              🗑️ 휴지통 ({archive.length})
            </button>

            <button
              className="settings-btn-compact"
              onClick={() => {
                if (confirm('모든 활동 로그를 삭제하시겠습니까?')) {
                  clearActivities();
                  showToast('🧹 활동 로그 초기화 완료');
                }
              }}
              style={{ flex: 1 }}
            >
              활동 로그 초기화
            </button>
          </div>

          {/* Row 3 (Destructive): 모든 데이터 초기화 */}
          <button
            className="settings-btn-compact danger-btn"
            onClick={handleResetAll}
            style={{ width: '100%', gap: '0.3rem' }}
          >
            <AlertTriangle size={12} /> 시스템 전체 초기화 (영구 삭제)
          </button>
        </div>
      </details>

      {/* 앱 업데이트 버튼 */}
      <button
        onClick={async () => {
          setIsUpdating(true);
          try {
            if ('serviceWorker' in navigator) {
              const regs = await navigator.serviceWorker.getRegistrations();
              await Promise.all(regs.map(r => r.unregister()));
            }
            if ('caches' in window) {
              const keys = await caches.keys();
              await Promise.all(keys.map(k => caches.delete(k)));
            }
          } catch (e) {
            console.warn('캐시 삭제 실패:', e);
          }
          // 캐시버스팅 — location.reload()는 HTTP 디스크 캐시를 우회하지 못해
          // 옛 HTML이 다시 로드될 수 있다. 쿼리스트링을 새로 붙여 강제 재요청.
          const u = new URL(window.location.href);
          u.searchParams.set('_v', Date.now().toString());
          window.location.replace(u.toString());
        }}
        disabled={isUpdating}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
          padding: '0.85rem',
          borderRadius: '14px',
          border: 'none',
          background: isUpdating ? 'var(--accent-soft-bg)' : 'var(--accent)',
          color: isUpdating ? 'var(--accent)' : '#fff',
          fontSize: '0.85rem', fontWeight: 800,
          cursor: isUpdating ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: isUpdating ? 'none' : '0 4px 14px var(--accent-glow)',
          letterSpacing: '0.01em'
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: isUpdating ? 'spin 1s linear infinite' : 'none', flexShrink: 0 }}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        {isUpdating ? '업데이트 중…' : '최신 버전으로 업데이트'}
      </button>

      {/* 데이터 동기화 버튼 (헤더에서 이동) */}
      <button
        type="button"
        onClick={() => manualSync()}
        disabled={syncing}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
          padding: '0.7rem',
          borderRadius: '14px',
          border: '1px solid var(--panel-border)',
          background: 'var(--bg-secondary)',
          color: 'var(--text-secondary)',
          fontSize: '0.82rem', fontWeight: 700,
          cursor: syncing ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease'
        }}
      >
        <RefreshCw size={14} style={syncing ? { animation: 'spin 0.8s linear infinite' } : undefined} />
        {syncing ? '동기화 중…' : '데이터 동기화 (서버에서 최신 불러오기)'}
      </button>

      {/* 업데이트 정보 (Version & Changelog) */}
      <details className="settings-section settings-section-details" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--surface-elevated-border)', borderRadius: '14px', padding: '0', overflow: 'hidden' }}>
        <summary style={{ listStyle: 'none', cursor: 'pointer', padding: '0.7rem 0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>업데이트 정보 ({VERSION_LOGS[0]?.version ?? 'v0.7.0'})</span>
          </div>
          <ChevronDown size={14} style={{ color: 'var(--text-tertiary)', transition: 'transform 0.2s ease' }} className="settings-chevron" />
        </summary>
        <div style={{ padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', borderTop: '1px solid var(--panel-border)', textAlign: 'left' }}>
          {(() => {
            const totalPages = Math.max(1, Math.ceil(VERSION_LOGS.length / UPDATES_PER_PAGE));
            // 데이터 변동/경계 초과에도 안전하도록 현재 페이지를 항상 유효 범위로 보정
            const safePage = Math.min(Math.max(updatePage, 0), totalPages - 1);
            const startIdx = safePage * UPDATES_PER_PAGE;
            const pageLogs = VERSION_LOGS.slice(startIdx, startIdx + UPDATES_PER_PAGE);
            return (
              <>
                {pageLogs.map((log, i) => (
                  <div key={log.version} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 800, color: log.latest ? 'var(--accent)' : 'var(--text-primary)' }}>{log.version} ({log.date})</span>
                      {log.latest && (
                        <span style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', background: 'var(--hover-bg)', padding: '0.1rem 0.3rem', borderRadius: '4px', fontWeight: 700 }}>최신 버전</span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      {log.items.map((it, j) => (
                        <div key={j}>• <strong>{it.b}</strong>{it.t}</div>
                      ))}
                    </div>
                    {i < pageLogs.length - 1 && (
                      <div style={{ height: '1px', background: 'var(--panel-border)', margin: '0.5rem 0 0.1rem 0' }} />
                    )}
                  </div>
                ))}

                {/* 페이지 내비게이션 (이전/다음 + 인디케이터) */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.8rem', marginTop: '0.4rem', borderTop: '1px solid var(--panel-border)', paddingTop: '0.7rem' }}>
                  <button type="button" className="ghost-btn" onClick={() => setUpdatePage(prev => Math.max(0, prev - 1))} disabled={safePage <= 0} style={{ opacity: safePage <= 0 ? 0.3 : 1, padding: '0.2rem 0.6rem', fontSize: '0.72rem' }}>이전</button>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>{safePage + 1} / {totalPages}</span>
                  <button type="button" className="ghost-btn" onClick={() => setUpdatePage(prev => Math.min(totalPages - 1, prev + 1))} disabled={safePage >= totalPages - 1} style={{ opacity: safePage >= totalPages - 1 ? 0.3 : 1, padding: '0.2rem 0.6rem', fontSize: '0.72rem' }}>다음</button>
                </div>
              </>
            );
          })()}
        </div>
      </details>


      {/* Soft Delete Trash Modal (Instant overlay within Settings!) */}
      <AnimatePresence>
        {isTrashModalOpen && (
          <div 
            className="fixed inset-0 z-[60] flex items-center justify-center p-4" 
            style={{ 
              position: 'fixed', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0, 
              zIndex: 1000, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              background: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(12px)', 
              WebkitBackdropFilter: 'blur(12px)' 
            }}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }} 
              transition={{ duration: 0.15 }} 
              style={{ 
                width: '100%', 
                maxWidth: '460px', 
                borderRadius: '20px', 
                padding: '1.25rem', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '0.8rem', 
                border: '1px solid var(--panel-border)', 
                background: 'var(--bg-color)', 
                boxShadow: '0 15px 45px rgba(0,0,0,0.25)',
                maxHeight: '85vh',
                overflow: 'hidden'
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-primary)' }}>
                  <Trash2 size={16} style={{ color: 'var(--danger)' }} />
                  <span style={{ fontSize: '1.05rem', fontWeight: 800 }}>휴지통</span>
                  <span style={{ 
                    fontSize: '0.72rem', 
                    fontWeight: 700, 
                    color: 'var(--text-secondary)', 
                    background: 'var(--hover-bg)', 
                    padding: '0.15rem 0.45rem', 
                    borderRadius: '6px' 
                  }}>
                    {archive.length}개 보관됨
                  </span>
                </div>
                <button 
                  onClick={() => {
                    setIsTrashModalOpen(false);
                    setTrashSearchQuery('');
                    setTrashFilterType('all');
                    setExpandedTrashId(null);
                  }} 
                  style={{ 
                    background: 'transparent', 
                    border: 'none', 
                    color: 'var(--text-secondary)', 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.2rem',
                    borderRadius: '50%',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover-bg)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Subtitle / Tip */}
              <div style={{ 
                fontSize: '0.72rem', 
                color: 'var(--text-secondary)', 
                lineHeight: '1.4', 
                textAlign: 'left',
                paddingBottom: '0.4rem'
              }}>
                휴지통의 데이터는 최대 200개까지 보관되며, 클릭 시 상세 정보를 확인하고 원래 탭으로 복구할 수 있습니다.
              </div>

              {/* Search Bar */}
              <div style={{ width: '100%' }}>
                <input 
                  type="text" 
                  placeholder="이름, 내용, 코드 등으로 검색..." 
                  value={trashSearchQuery}
                  onChange={(e) => setTrashSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.75rem',
                    fontSize: '0.75rem',
                    background: 'var(--surface-elevated)',
                    border: '1px solid var(--panel-border)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    textAlign: 'left'
                  }}
                />
              </div>

              {/* Tab Filters */}
              <div style={{ display: 'flex', gap: '0.3rem', fontSize: '0.72rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
                {(['all', 'event', 'asset', 'memo'] as const).map((t) => {
                  const label = t === 'all' ? '전체' : t === 'event' ? '일정' : t === 'asset' ? '재고' : '메모';
                  const count = t === 'all' ? archive.length : archive.filter(x => x.type === t).length;
                  const active = trashFilterType === t;
                  return (
                    <button
                      key={t}
                      onClick={() => {
                        setTrashFilterType(t);
                        setExpandedTrashId(null);
                      }}
                      style={{
                        padding: '0.25rem 0.6rem',
                        borderRadius: '6px',
                        border: active ? '1px solid var(--accent)' : '1px solid var(--panel-border)',
                        background: active ? 'var(--accent-soft-bg)' : 'transparent',
                        color: active ? 'var(--accent)' : 'var(--text-secondary)',
                        fontWeight: active ? 700 : 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                        flexShrink: 0
                      }}
                    >
                      <span>{label}</span>
                      <span style={{ fontSize: '0.62rem', opacity: 0.6 }}>{count}</span>
                    </button>
                  );
                })}
              </div>

              {/* Trash Items List */}
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '0.5rem', 
                maxHeight: '320px', 
                overflowY: 'auto',
                paddingRight: '2px',
                marginTop: '0.2rem'
              }}>
                {(() => {
                  const filteredArchive = archive.filter(item => {
                    if (trashFilterType !== 'all' && item.type !== trashFilterType) return false;
                    if (trashSearchQuery.trim() !== '') {
                      const q = trashSearchQuery.toLowerCase();
                      const titleMatch = (item.title || '').toLowerCase().includes(q);
                      const descMatch = (item.attrs?.description || item.attrs?.content || '').toLowerCase().includes(q);
                      const codeMatch = (item.attrs?.code || '').toLowerCase().includes(q);
                      const categoryMatch = (item.category || '').toLowerCase().includes(q);
                      return titleMatch || descMatch || codeMatch || categoryMatch;
                    }
                    return true;
                  });

                  if (filteredArchive.length === 0) {
                    return (
                      <div style={{ 
                        padding: '3rem 1.5rem', 
                        textAlign: 'center', 
                        color: 'var(--text-tertiary)', 
                        fontSize: '0.8rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.4rem'
                      }}>
                        <Trash2 size={24} style={{ opacity: 0.3 }} />
                        <span>검색 결과 또는 보관된 항목이 없습니다.</span>
                      </div>
                    );
                  }

                  return filteredArchive.map((item) => {
                    const formattedDate = item.archivedAt 
                      ? format(parseISO(item.archivedAt), 'yy.MM.dd HH:mm') 
                      : '';
                    const typeLabel = item.type === 'event' ? '일정' : item.type === 'asset' ? '재고' : '메모';
                    
                    const typeColor = item.type === 'event' 
                      ? 'var(--accent)' 
                      : item.type === 'asset' 
                        ? 'var(--success)' 
                        : 'var(--purple)';
                    const typeBg = item.type === 'event' 
                      ? 'var(--accent-soft-bg)' 
                      : item.type === 'asset' 
                        ? 'var(--success-soft-bg)' 
                        : 'var(--purple-soft-bg)';

                    const isExpanded = expandedTrashId === item.id;

                    return (
                      <div 
                        key={item.id} 
                        style={{ 
                          display: 'flex', 
                          flexDirection: 'column',
                          padding: '0.65rem 0.8rem', 
                          background: 'var(--surface-elevated)', 
                          border: '1px solid var(--panel-border)', 
                          borderRadius: '10px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        onClick={() => setExpandedTrashId(isExpanded ? null : item.id)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, minWidth: 0, textAlign: 'left' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                              <span style={{ 
                                fontSize: '0.62rem', 
                                fontWeight: 800, 
                                color: typeColor, 
                                background: typeBg, 
                                padding: '0.1rem 0.35rem', 
                                borderRadius: '4px',
                                flexShrink: 0
                              }}>
                                {typeLabel}
                              </span>
                              <span 
                                style={{ 
                                  fontSize: '0.82rem', 
                                  fontWeight: 600, 
                                  color: 'var(--text-primary)', 
                                  overflow: 'hidden', 
                                  textOverflow: 'ellipsis', 
                                  whiteSpace: 'nowrap' 
                                }}
                                title={item.title}
                              >
                                {item.title || '(제목 없음)'}
                              </span>
                            </div>
                            {formattedDate && (
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
                                {formattedDate} 삭제됨
                              </span>
                            )}
                          </div>

                          {/* Actions */}
                          <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                restoreArchived(item.id);
                              }}
                              style={{ 
                                background: 'var(--hover-bg)', 
                                border: 'none', 
                                color: 'var(--accent)', 
                                cursor: 'pointer',
                                padding: '0.3rem 0.5rem',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <RotateCcw size={10} />
                              복구
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('이 항목을 영구 삭제하시겠습니까?')) {
                                  permanentDelete(item.id);
                                }
                              }}
                              style={{ 
                                background: 'var(--hover-bg)', 
                                border: 'none', 
                                color: 'var(--danger)', 
                                cursor: 'pointer',
                                padding: '0.3rem 0.5rem',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <Trash2 size={10} />
                              삭제
                            </button>
                          </div>
                        </div>

                        {/* Accordion Details */}
                        {isExpanded && (
                          <div 
                            style={{
                              marginTop: '0.6rem',
                              padding: '0.6rem 0.8rem',
                              background: 'var(--panel-bg)',
                              borderRadius: '8px',
                              border: '1px dashed var(--panel-border)',
                              fontSize: '0.72rem',
                              color: 'var(--text-secondary)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.4rem',
                              textAlign: 'left'
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {item.type === 'event' && (
                              <>
                                <div><strong>일정 일시:</strong> {item.attrs.date} {item.attrs.allDay ? '하루 종일' : (item.attrs.time || '')}</div>
                                <div><strong>카테고리:</strong> {item.category || '기본'}</div>
                                {item.attrs.description && (
                                  <div style={{ borderTop: '1px solid var(--panel-border)', paddingTop: '0.3rem', whiteSpace: 'pre-wrap' }}>
                                    {item.attrs.description}
                                  </div>
                                )}
                              </>
                            )}
                            {item.type === 'asset' && (
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem' }}>
                                <div><strong>품목 코드:</strong> {item.attrs.code || '없음'}</div>
                                <div><strong>현재 수량:</strong> {item.attrs.qty || 0} 개</div>
                                <div><strong>보관 위치:</strong> {item.attrs.location || '지정 없음'}</div>
                                <div><strong>담당자:</strong> {item.attrs.manager || '없음'}</div>
                                <div><strong>카테고리:</strong> {item.category || '기본'}</div>
                              </div>
                            )}
                            {item.type === 'memo' && (
                              <>
                                {item.category && <div><strong>카테고리:</strong> {item.category}</div>}
                                <div 
                                  style={{ 
                                    maxHeight: '120px', 
                                    overflowY: 'auto', 
                                    whiteSpace: 'pre-wrap', 
                                    padding: '0.4rem', 
                                    background: 'var(--surface-elevated)', 
                                    borderRadius: '6px', 
                                    border: '1px solid var(--panel-border)',
                                    fontFamily: 'monospace',
                                    fontSize: '0.68rem'
                                  }}
                                >
                                  {item.attrs.content || '내용 없음'}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Bottom Actions / Footer */}
              {archive.length > 0 && (
                <div style={{ 
                  marginTop: '0.2rem', 
                  borderTop: '1px solid var(--panel-border)', 
                  paddingTop: '0.8rem',
                  display: 'flex',
                  justifyContent: 'flex-end'
                }}>
                  <button
                    onClick={() => {
                      if (confirm('휴지통을 완전히 비우시겠습니까? 모든 데이터가 영구히 삭제됩니다.')) {
                        emptyArchive();
                      }
                    }}
                    style={{ 
                      background: 'var(--danger-soft-bg)', 
                      border: '1px solid var(--danger-soft-border)', 
                      color: 'var(--danger)', 
                      fontSize: '0.75rem', 
                      fontWeight: 700, 
                      cursor: 'pointer',
                      padding: '0.45rem 0.8rem',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Trash2 size={12} />
                    휴지통 비우기
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
