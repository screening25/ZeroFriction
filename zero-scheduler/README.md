# Zero-Friction Widget

> 인지 마찰과 조작 마찰을 0으로 — 자연어 한 줄로 일정·재고·변동사항을 동시에 다루는 데일리 오퍼레이션 위젯

![Stack](https://img.shields.io/badge/Next.js-16.2-black) ![React](https://img.shields.io/badge/React-19-61dafb) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6) ![Electron](https://img.shields.io/badge/Electron-42-47848f) ![Gemini](https://img.shields.io/badge/Gemini-2.5_Flash-4285f4) ![Prisma](https://img.shields.io/badge/Prisma-7.8-2d3748)

---

## 1. Overview — 왜 "Zero-Friction"인가

기존 일정·재고 관리 도구는 **두 가지 종류의 마찰**로 사용자의 흐름을 끊습니다.

- **인지 마찰(Cognitive Friction)** — 어느 메뉴에서 어떤 폼을 어떤 순서로 채워야 하는지 학습해야 함
- **조작 마찰(Operational Friction)** — 클릭·탭 전환·Save 버튼 확인 등 다단계 입력 시퀀스

Zero-Friction Widget은 두 마찰을 **언어 인터페이스 + 즉시 영속화**로 동시에 제거합니다.

> "내일 오후 3시 디자인 리뷰 10분 전 알림" → Enter 한 번. 분류·시간·알림·카테고리 자동 생성, Save 버튼 없이 영구 저장.

핵심 가치 한 줄: **"앱을 학습할 필요 없이, 평소 말투 그대로 적고 잊어버려도 되는 위젯."**

---

## 2. Core Features

### 2.1 Intelligent Task & Inventory Tracking
오늘 일정과 **과거 미처리 일정(overdue)**, 미완료 전체를 별도 KPI 카드로 분리해 한눈에 우선순위 식별을 강제합니다.

- `app/page.tsx`의 `overdueSchedules` 필터 — `s.attrs.date < todayStr && !s.attrs.completed`
- Overview 상단 **KPI 스트립 4종**: 오늘 일정 · 미완료(밀린 일정 N건 부제) · 변동 사항 · 재고 부족
- 재고는 단순 카운트가 아닌 **누적 순재고(net stock)** 모델. 보유분 0인 상태에서 출고하거나 보유분보다 많이 출고하면 **음수 재고**로 자동 기록되어 미배송·채무를 추적 (`database/index.ts` `addRecord`)
- `lowStockItems` 필터(`qty <= 3`)와 음수 재고는 **자동 danger 톤 + "재고 부족" 뱃지**로 즉시 강조

### 2.2 Natural Language Query (NLQ) & Virtual Recurrent Engine
자연어 한 줄을 백엔드에서 **4가지 의도(C/U/D/R)**로 분류해 동작을 결정합니다.

- 의도 액션: **C** (Create), **U** (Update), **D** (Delete), **R** (Read/조회 NLQ)
- `R` 액션은 데이터 저장 없이 기존 records를 필터링하는 자연어 질의 — *"이번주 재고 부족한 거 뭐 있어?"*, *"맥북 관련 일정 보여줘"*
- 백엔드 LLM 서비스 계층 (`backend/services/llm/`):
  - `gemini.ts` — Gemini 2.5 Flash + responseSchema 정형 JSON
  - `parser.ts` — 룰 기반 fallback (API Key 없거나 LLM 실패 시 graceful degradation)
  - `prompts.ts` — Few-shot 프롬프트 (한국어 조사 정밀 제거 규칙 포함)
  - `index.ts` — `parseHandler` 오케스트레이터
- **Virtual Recurrent Engine** — `database/index.ts`의 `expandRecurringEvents`가 `rec: 'daily' | 'weekly' | 'monthly'` 필드를 일정 표시 시점에 동적으로 가상 인스턴스로 펼침. 저장 공간을 N배 절약하면서 무한 반복 일정을 표현

### 2.3 Smart Entity Linking
입력에 `#태그`, `@멘션`, "관련"/"연결" 키워드가 있으면 LLM이 `link[]`를 추출하고, `AppContext.tsx`가 **레코드 저장 시점에 자동으로 `linkedIds`로 해석**합니다.

- `backend/services/llm/parser.ts` — 해시태그/멘션 키워드 추출 (`extractLinkKeywords`)
- `frontend/context/AppContext.tsx` (286~313줄) — 추출된 keyword 배열로 records 검색해 매칭되는 id를 `attrs.linkedIds`로 주입
- `app/page.tsx` (349~) — `linkedIds`가 있는 레코드는 **pill 뱃지**로 연관 항목을 시각화. 클릭 시 해당 레코드 모달 열림

> 예: "맥북 발주 #프로젝트A 관련 회의" → 회의 일정이 자동으로 '맥북 발주' 재고와 '프로젝트A' 레코드에 링크되어 표시

### 2.4 Zero-Friction Auto-Save
**Save 버튼이 단 하나도 존재하지 않습니다.** 모든 상태 변경은 mutator 함수 호출 즉시 localStorage로 영속화됩니다.

- `database/index.ts`의 `saveRecords` / `persistSettings` / `persistActivities`가 모든 CRUD 진입점에서 호출
- `addRecord` / `updateRecord` / `deleteRecord` 가 내부에서 자동 `saveRecords()` 실행
- `handleSettingsChange`는 토큰/색상 변경 즉시 `persistSettings()` 호출
- `logActivity`는 활동 발생 즉시 `persistActivities()` 호출 (최대 50건 유지)
- 결과: 페이지 새로고침·앱 재시작·강제 종료 어떤 시나리오에서도 데이터 손실 0
- 백업 필요 시 환경설정 **데이터 내보내기/불러오기** 로 JSON 한 파일 교환

### 2.5 Consolidated Data Management & Trash Modal Overlay
삭제는 영구가 아닌 **소프트 삭제 → 휴지통 이동**입니다. React 상태 기반의 모달 오버레이로 통합 관리합니다.

- `archived_records` 별도 localStorage 키 (`database/index.ts`)
- 최대 200건 자동 보관, 항목별 **복구 / 영구 삭제** 지원
- 환경설정 탭의 **데이터 휴지통 섹션**에서 React state(`archive: ArchivedRecord[]`)와 직접 바인딩
- `restoreArchived(id)` → 휴지통 → 활성 records 복귀
- `permanentDelete(id)` → 휴지통에서도 완전 제거
- `emptyArchive()` → confirm 다이얼로그 후 일괄 영구 삭제
- 활동 로그도 **독립적으로 초기화 가능** (`clearActivities()`)

---

## 3. Architecture & Directory Structure

기존 모놀리식 `src/app/` 단일 트리에서 **3계층 분리 아키텍처**로 리팩토링되었습니다.

```
zero-scheduler/
├── app/                          # Next.js App Router (라우팅만 담당 — Thin Handler)
│   ├── layout.tsx                # 루트 레이아웃, AppProvider 주입
│   ├── page.tsx                  # SPA 메인 (Overview/Calendar/Inventory/Settings 4탭 컨디셔널 렌더)
│   ├── globals.css               # 디자인 토큰 & 컴포넌트 클래스 (라이트/다크 자동 전환)
│   ├── calendar/page.tsx         # 캘린더 라우트
│   ├── category/[slug]/page.tsx  # 카테고리 동적 라우트
│   ├── inventory/page.tsx        # 재고 라우트
│   └── api/                      # 라우트 핸들러 (모든 비즈니스 로직은 backend/services로 위임)
│       ├── notify/route.ts       # → backend/services/notify
│       ├── parse/route.ts        # → backend/services/llm
│       ├── policy/route.ts       # → backend/services/policy
│       └── schedule/route.ts     # → backend/services/schedule
│
├── frontend/                     # UI 레이어 (브라우저 전용)
│   ├── components/
│   │   ├── ClientLayout.tsx      # 헤더·NLP 입력바·탭 네비·플로팅 버튼·키보드 단축키
│   │   ├── CommandPalette.tsx    # ⌘K 글로벌 명령 팔레트 (퍼지 검색 + 액션 실행)
│   │   ├── SettingsSection.tsx   # 환경설정 SPA 뷰 (설정·휴지통·앱 가이드)
│   │   └── SettingsModal.tsx     # 모달형 환경설정 (보조)
│   └── context/
│       └── AppContext.tsx        # 전역 상태 + 비즈니스 액션 오케스트레이션 (theme/records/archive/activities)
│
├── backend/                      # 서버 레이어 (Server-only, Node.js APIs 사용 가능)
│   └── services/
│       ├── notify.ts             # macOS osascript 강제 알림 송출
│       ├── policy.ts             # Prisma PolicyTracker CRUD
│       ├── schedule.ts           # Prisma Schedule CRUD
│       └── llm/                  # NLP 파싱 도메인
│           ├── index.ts          # parseHandler (Gemini → fallback graceful degradation)
│           ├── gemini.ts         # Gemini 2.5 Flash API + responseSchema
│           ├── parser.ts         # 룰 기반 파서 (C/U/D/R 액션 + 한국어 조사 정밀 제거)
│           └── prompts.ts        # Few-shot system prompt builder
│
├── database/                     # 데이터/스토리지 레이어 (localStorage 어댑터 + 도메인 모델)
│   └── index.ts                  # UniversalRecord/ArchivedRecord/ActivityLog/AppSettings
│                                 # getRecords/saveRecords/addRecord/updateRecord/deleteRecord
│                                 # getArchive/restoreFromArchive/permanentDeleteArchived/purgeArchive
│                                 # loadSettings/persistSettings/loadActivities/persistActivities
│                                 # exportAllData/importAllData/clearAllData
│                                 # expandRecurringEvents (Virtual Recurrent Engine)
│                                 # solarHolidays/lunarHolidays2026, ACCENT_COLORS
│
├── lib/
│   └── prisma.ts                 # Prisma Client 싱글턴 (PostgreSQL adapter-pg)
│
├── prisma/
│   └── schema.prisma             # Schedule / PolicyTracker 모델 정의
│
├── public/                       # 정적 자산 (아이콘 등)
├── main.js                       # Electron 메인 프로세스 (frameless 위젯 윈도우 420×850)
├── next.config.ts                # Next.js 설정 (devIndicators 비활성화로 위젯 모드 최적화)
└── tsconfig.json                 # 경로 별칭: @/app, @/frontend, @/backend, @/database, @/lib
```

### 아키텍처 의존 방향

```
app/  ──┐
        ├──► frontend/  ──► database/
        │
        └──► backend/   ──► database/   (Prisma) + lib/prisma
```

- **app/**은 얇은 라우팅·SPA 셸 — 비즈니스 로직 0%
- **frontend/**는 브라우저 전용. `'use client'` 컴포넌트만 거주
- **backend/**는 서버 전용. `child_process`·`@google/genai`·Prisma 등 Node 의존성
- **database/**는 양방향 의존 가능한 순수 모듈 (localStorage 가드로 SSR-safe)

---

## 4. Tech Stack

| 영역 | 사용 기술 |
| --- | --- |
| 프레임워크 | Next.js 16.2.6 (App Router, Turbopack), React 19.2.4 |
| 언어 | TypeScript 5 (strict mode) |
| UI/모션 | Framer Motion 12.38, Lucide React |
| LLM | Gemini 2.5 Flash (`@google/genai` 2.4) |
| 데이터베이스 | PostgreSQL 15 + Prisma 7.8 (adapter-pg) |
| 클라이언트 저장소 | localStorage (universal_records / archived_records / zero_settings / zero_activities) |
| 데스크톱 셸 | Electron 42 + electron-builder 26 (com.zero.friction) |
| 날짜 처리 | date-fns 4.1 |

---

## 5. Quick Start

### 5.1 개발 모드 (Web)
```bash
npm install
npm run dev        # http://localhost:3005
```

### 5.2 Electron 위젯 모드
```bash
# 1) Postgres 컨테이너
docker-compose up -d

# 2) Next dev + Electron 동시 기동 (포함된 스크립트)
bash ../start_scheduler.sh
```

### 5.3 데이터베이스 (선택)
```bash
npx prisma migrate dev   # Schedule / PolicyTracker 테이블 생성
```

---

## 6. Keyboard Shortcuts

| 키 | 동작 |
| --- | --- |
| `⌘ K` | 명령 팔레트 (전 레코드 퍼지 검색 + 액션 실행) |
| `⌘ 1` / `⌘ 2` / `⌘ 3` | 전체 / 일정 / 재고 탭 즉시 이동 |
| `⌘ ,` | 환경설정 토글 |
| `/` | 어디서든 NLP 입력창으로 즉시 커서 점프 |
| `esc` | 드로워/모달 닫기 |
| `↑ ↓ ↵` | 팔레트 항목 이동·선택 |

---

## 7. Design System

- **디자인 토큰 100% 변수화** — `app/globals.css`의 `:root` / `[data-theme='dark']`에 모든 색·간격·radius·blur 정의
- 라이트/다크 자동 전환은 토큰 재정의만으로 처리 (JS 분기 0)
- 글래스모피즘 표면(`--panel-bg` + `--panel-blur`), Apple HIG 톤
- 의미 토큰: `--accent-soft-bg`, `--danger-soft-border`, `--success-tint`, `--warning-soft-bg`, `--purple-soft-bg`, `--drawer-bg`(항상-다크 오버레이)
- KPI 스트립·명령 팔레트·휴지통·온보딩 카드·캘린더 일정 밀도 도트 모두 동일 토큰 시스템 위에 구축

---

## 8. Presentation Guide — 5 Slide Pitch Script

> 임원·고객사 PT용 슬라이드 스크립트. 슬라이드당 90초 기준.

### Slide 1 — The Problem
**제목:** *"우리는 일정·재고를 관리하는 게 아니라, '관리하는 행위'를 관리하고 있다."*

> 노트북을 열고, 일정 앱을 켜고, 폼을 채우고, Save를 누르고, 다시 재고 앱을 켜고, 카테고리를 선택하고… 정작 의사결정에 쓰여야 할 인지 자원이 **도구 조작**에 소모됩니다.
>
> 시장의 대부분 ERP·일정 도구는 기능이 부족한 게 아니라, **마찰이 과잉**입니다. Zero-Friction은 이 마찰을 두 종류로 정의했습니다 — **인지 마찰**과 **조작 마찰**. 우리는 둘 다 0으로 만듭니다.

### Slide 2 — The Solution: One Sentence In, Everything Done
**제목:** *"평소 말투 그대로. 학습 곡선 0."*

> 데모: 입력창에 `내일 오후 3시 디자인 리뷰 10분 전 알림` 입력 → Enter.
>
> 동작: Gemini 2.5 Flash가 **C 액션, event 타입, WORK 카테고리, date=2026-05-19, time=15:00, notifyOffset=10**으로 분해해 일정으로 저장. **0.4초**.
>
> 추가: `이번주 재고 부족한 거 뭐 있어?` → 동일한 입력창에서 **R 액션**으로 인식, 저장 없이 조회 결과만 출력. **검색창과 입력창이 분리되지 않은 통합 인터페이스.**

### Slide 3 — Zero Save Button, Zero Data Loss
**제목:** *"우리 앱에는 '저장' 버튼이 없습니다."*

> 모든 state 변경은 mutator 호출 즉시 localStorage로 영속화됩니다. 백엔드 라운드트립 0. 사용자는 **저장했는지 걱정할 필요가 없고**, 우리는 **저장 버튼을 만들 필요가 없습니다.**
>
> 동시에 **소프트 삭제 → 휴지통(최대 200건 자동 보관)**으로 실수 복구를 보장합니다. *"진짜 지우려면 한 번 더 누르세요"* — 영구 삭제는 명시적 동작으로 분리.
>
> 데이터 이동은 **단일 JSON 파일 Export/Import**로 끝. 기기 간 동기화의 복잡도를 사용자의 통제 범위 안에 둡니다.

### Slide 4 — Architecture: Layered, Boring, Scalable
**제목:** *"화려하지 않은 게 강한 아키텍처입니다."*

> 4계층 분리:
> - **app/** — Next.js 라우팅. 비즈니스 로직 0%
> - **frontend/** — UI/State. localStorage 직접 접근 금지
> - **backend/** — 서버 로직. LLM·Prisma·OS 콜
> - **database/** — 단일 진실의 원천. 모든 mutation 게이트
>
> 의존 방향은 단방향. 새 채널(모바일·CLI·MCP) 추가 시 frontend만 교체하면 backend/database는 그대로 재사용됩니다.
>
> LLM 의존성은 격리되어 있어 **API 키 없이도 룰 기반 fallback이 동작** — graceful degradation으로 오프라인·키 만료 상황을 모두 흡수합니다.

### Slide 5 — Beyond the Widget: Roadmap
**제목:** *"한 줄 입력은 시작일 뿐입니다."*

> 단기 (Q3):
> - MCP 서버 노출 — Claude/ChatGPT에서 직접 일정·재고 조작
> - Prisma Cloud Sync — 멀티 디바이스 동기화 옵션
> - 음성 입력 (Whisper) — 화면조차 보지 않는 입력
>
> 중기 (Q4):
> - 팀 모드 — `linkedIds` 기반 협업 그래프
> - 자동 인사이트 — *"이번 달 미배송 패턴 분석"*
> - Plugin/Skill 마켓플레이스
>
> 비전:
> > 운영 도구는 **언어**로 수렴합니다. Zero-Friction은 그 변곡점에서, **사용자가 도구를 의식하지 않도록 하는 첫 번째 위젯**입니다.

---

## 9. License & Maintainer

- App ID: `com.zero.friction`
- Product Name: `Zero-Friction`
- Maintainer: Fitogether Inc.
- © 2026 All rights reserved.
